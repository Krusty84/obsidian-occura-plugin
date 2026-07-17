/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import type OccuraPlugin from "main";
import { MarkdownView } from "obsidian";
import { validateSelectionQuery } from "src/editorOccurrences";
import { findMatches } from "src/matching";

export interface ReadingViewOccurrenceController {
  clearAll(): void;
  refreshDocuments(): void;
}

type SavedReadingViewSelection = {
  anchorOffset: number;
  focusOffset: number;
};

const EXCLUDED_READING_VIEW_SELECTOR = [
  "code",
  "pre",
  "a",
  "script",
  "style",
  "textarea",
  "input",
  "button",
  "select",
  "svg",
  "canvas",
  ".metadata-container",
  ".frontmatter",
  ".math",
  ".math-block",
  ".mjx-container",
  ".cm-editor",
  ".occura-reading-selection-occurrence",
].join(",");

export function registerReadingViewOccurrenceHighlighting(
  plugin: OccuraPlugin,
): ReadingViewOccurrenceController {
  const controller = new ReadingViewOccurrenceControllerImpl(plugin);
  controller.refreshDocuments();
  return controller;
}

class ReadingViewOccurrenceControllerImpl implements ReadingViewOccurrenceController {
  private readonly registeredDocuments = new WeakSet<Document>();
  private readonly pointerDownDocuments = new WeakSet<Document>();
  private debounceTimer: number | null = null;
  private pendingDocument: Document | null = null;
  private isApplyingHighlights = false;
  private ignoreSelectionChangesUntil = 0;
  private lastRoot: HTMLElement | null = null;
  private lastQuery: string | null = null;
  private lastStatusWasReadingView = false;

  constructor(private readonly plugin: OccuraPlugin) {
    this.plugin.register(() => {
      if (this.debounceTimer !== null) {
        window.clearTimeout(this.debounceTimer);
      }
    });
  }

  clearAll(): void {
    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
      this.pendingDocument = null;
    }

    const wasApplyingHighlights = this.isApplyingHighlights;
    this.isApplyingHighlights = true;
    this.ignoreSelectionChangesUntil = Date.now() + 250;

    try {
      for (const root of getReadingViewRoots(this.plugin)) {
        const savedSelection = captureReadingViewSelection(root);
        clearReadingViewDynamicHighlights(root);
        restoreReadingViewSelection(root, savedSelection);
      }
    } finally {
      this.isApplyingHighlights = wasApplyingHighlights;
    }

    this.clearReadingViewStatus();
    this.lastRoot = null;
    this.lastQuery = null;
  }

  refreshDocuments(): void {
    for (const doc of getWorkspaceDocuments(this.plugin)) {
      if (this.registeredDocuments.has(doc)) continue;

      this.plugin.registerDomEvent(doc, "pointerdown", () => {
        this.pointerDownDocuments.add(doc);
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
      });
      this.plugin.registerDomEvent(doc, "pointerup", () => {
        this.pointerDownDocuments.delete(doc);
        this.scheduleSelectionHandling(doc);
      });
      this.plugin.registerDomEvent(doc, "pointercancel", () => {
        this.pointerDownDocuments.delete(doc);
        if (this.pendingDocument === doc) this.pendingDocument = null;
        if (this.debounceTimer !== null) {
          window.clearTimeout(this.debounceTimer);
          this.debounceTimer = null;
        }
      });
      this.plugin.registerDomEvent(doc, "selectionchange", () => {
        this.scheduleSelectionHandling(doc);
      });
      this.registeredDocuments.add(doc);
    }
  }

  private scheduleSelectionHandling(doc: Document): void {
    if (
      this.isApplyingHighlights ||
      Date.now() < this.ignoreSelectionChangesUntil
    ) {
      return;
    }

    this.pendingDocument = doc;
    if (this.pointerDownDocuments.has(doc)) {
      return;
    }

    if (this.debounceTimer !== null) {
      window.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      this.debounceTimer = null;

      const targetDocument = this.pendingDocument;
      this.pendingDocument = null;
      if (!targetDocument) return;

      this.handleSelectionChange(targetDocument);
    }, 120);
  }

  private handleSelectionChange(doc: Document): void {
    if (
      this.isApplyingHighlights ||
      Date.now() < this.ignoreSelectionChangesUntil
    ) {
      return;
    }

    const selection = doc.getSelection();
    if (!selection) {
      this.clearAll();
      return;
    }

    const readingViewRoot = getReadingViewRootFromSelection(selection);
    if (!readingViewRoot) {
      if (selectionTouchesCodeMirror(selection)) {
        return;
      }

      this.clearAll();
      return;
    }

    if (!this.plugin.settings.occuraPluginEnabled) {
      this.clearAll();
      return;
    }

    const query = selection.toString().trim();
    if (validateSelectionQuery(query, this.plugin.settings) !== "valid") {
      this.clearAll();
      return;
    }

    if (
      this.lastRoot === readingViewRoot &&
      this.lastQuery === query &&
      hasDynamicHighlightsForQuery(readingViewRoot, query)
    ) {
      return;
    }

    this.isApplyingHighlights = true;
    this.ignoreSelectionChangesUntil = Date.now() + 250;

    try {
      const savedSelection = captureReadingViewSelection(readingViewRoot);
      const count = applyReadingViewDynamicHighlights(
        readingViewRoot,
        query,
        this.plugin,
      );
      restoreReadingViewSelection(readingViewRoot, savedSelection);

      if (this.plugin.isReadingViewActive(readingViewRoot)) {
        this.plugin.setOccurrenceStatus(query, count, null);
      }

      this.lastRoot = readingViewRoot;
      this.lastQuery = query;
      this.lastStatusWasReadingView = true;
    } finally {
      this.isApplyingHighlights = false;
    }
  }

  private clearReadingViewStatus(): void {
    if (this.lastStatusWasReadingView) this.plugin.clearOccurrenceStatus();

    this.lastStatusWasReadingView = false;
  }
}

function getWorkspaceDocuments(plugin: OccuraPlugin): Document[] {
  const docs = new Set<Document>();

  docs.add(activeDocument);
  docs.add(plugin.app.workspace.containerEl.doc);

  plugin.app.workspace.iterateAllLeaves((leaf) => {
    docs.add(leaf.view.containerEl.doc);
  });

  return Array.from(docs);
}

function getReadingViewRoots(plugin: OccuraPlugin): HTMLElement[] {
  const roots: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();

  const markdownViews = plugin.app.workspace
    .getLeavesOfType("markdown")
    .map((leaf) => leaf.view)
    .filter((view): view is MarkdownView => view instanceof MarkdownView);

  for (const view of markdownViews) {
    const root = view.containerEl.querySelector(".markdown-preview-view");
    if (!(root instanceof HTMLElement)) continue;
    if (seen.has(root)) continue;

    seen.add(root);
    roots.push(root);
  }

  return roots;
}

function asElement(node: Node | null): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function captureReadingViewSelection(
  root: HTMLElement,
): SavedReadingViewSelection | null {
  const selection = root.ownerDocument.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const anchorOffset = getCharacterOffset(
    root,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focusOffset = getCharacterOffset(
    root,
    selection.focusNode,
    selection.focusOffset,
  );

  if (anchorOffset === null || focusOffset === null) return null;

  return {
    anchorOffset,
    focusOffset,
  };
}

function getCharacterOffset(
  root: HTMLElement,
  node: Node | null,
  nodeOffset: number,
): number | null {
  if (!node || !root.contains(node)) return null;

  const range = root.ownerDocument.createRange();
  range.selectNodeContents(root);

  try {
    range.setEnd(node, nodeOffset);
  } catch {
    return null;
  }

  return range.toString().length;
}

function restoreReadingViewSelection(
  root: HTMLElement,
  savedSelection: SavedReadingViewSelection | null,
): void {
  if (!savedSelection || !root.isConnected) return;

  const selection = root.ownerDocument.getSelection();
  if (!selection) return;

  if (!selection.isCollapsed) {
    if (selection.anchorNode?.isConnected && selection.focusNode?.isConnected) {
      return;
    }
  }

  const anchor = resolveCharacterOffset(root, savedSelection.anchorOffset);
  const focus = resolveCharacterOffset(root, savedSelection.focusOffset);
  if (!anchor || !focus) return;

  if (typeof selection.setBaseAndExtent === "function") {
    selection.setBaseAndExtent(
      anchor.node,
      anchor.offset,
      focus.node,
      focus.offset,
    );
    return;
  }

  const range = root.ownerDocument.createRange();
  if (savedSelection.anchorOffset <= savedSelection.focusOffset) {
    range.setStart(anchor.node, anchor.offset);
    range.setEnd(focus.node, focus.offset);
  } else {
    range.setStart(focus.node, focus.offset);
    range.setEnd(anchor.node, anchor.offset);
  }

  selection.removeAllRanges();
  selection.addRange(range);
}

function resolveCharacterOffset(
  root: HTMLElement,
  characterOffset: number,
): { node: Text; offset: number } | null {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT);
  let remaining = characterOffset;

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!(node instanceof win.Text)) continue;

    const length = node.nodeValue?.length ?? 0;
    if (remaining <= length) {
      return { node, offset: remaining };
    }

    remaining -= length;
  }

  return null;
}

function selectionTouchesCodeMirror(selection: Selection): boolean {
  if (selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const startEl = asElement(range.startContainer);
  const endEl = asElement(range.endContainer);

  return !!startEl?.closest(".cm-editor") || !!endEl?.closest(".cm-editor");
}

export function getReadingViewRootFromSelection(
  selection: Selection,
): HTMLElement | null {
  if (selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);

  const startEl = asElement(range.startContainer);
  const endEl = asElement(range.endContainer);

  if (!startEl || !endEl) return null;

  if (startEl.closest(".cm-editor") || endEl.closest(".cm-editor")) {
    return null;
  }

  const startRoot = startEl.closest(".markdown-preview-view");
  const endRoot = endEl.closest(".markdown-preview-view");

  if (!startRoot || startRoot !== endRoot) return null;
  if (!(startRoot instanceof HTMLElement)) return null;

  return startRoot;
}

function clearReadingViewDynamicHighlights(root: HTMLElement): void {
  const marks = Array.from(
    root.querySelectorAll("mark.occura-reading-selection-occurrence"),
  );

  for (const mark of marks) {
    if (mark instanceof HTMLElement) {
      unwrapMark(mark);
    }
  }
}

function hasDynamicHighlightsForQuery(
  root: HTMLElement,
  query: string,
): boolean {
  const marks = Array.from(
    root.querySelectorAll("mark.occura-reading-selection-occurrence"),
  );
  for (const mark of marks) {
    if (!(mark instanceof HTMLElement)) continue;
    if (mark.dataset.occuraQuery === query) {
      return true;
    }
  }

  return false;
}

function unwrapMark(mark: HTMLElement): void {
  const parent = mark.parentNode;
  if (!parent) return;

  while (mark.firstChild) {
    parent.insertBefore(mark.firstChild, mark);
  }

  parent.removeChild(mark);
  parent.normalize();
}

export function applyReadingViewDynamicHighlights(
  root: HTMLElement,
  query: string,
  plugin: OccuraPlugin,
): number {
  for (const currentRoot of getReadingViewRoots(plugin)) {
    clearReadingViewDynamicHighlights(currentRoot);
  }

  const textNodes = collectEligibleTextNodes(root);
  let count = 0;

  for (const textNode of textNodes) {
    count += wrapMatchesInTextNode(
      textNode,
      query,
      plugin.settings.occuraCaseSensitive,
      plugin.settings.minimumSelectionLength,
    );
  }

  return count;
}

export function getReadingViewDynamicOccurrenceMarks(
  root: HTMLElement,
  query: string,
): HTMLElement[] {
  return Array.from(
    root.querySelectorAll("mark.occura-reading-selection-occurrence"),
  ).filter(
    (mark): mark is HTMLElement =>
      mark instanceof HTMLElement && mark.dataset.occuraQuery === query,
  );
}

export function getReadingViewDynamicOccurrenceQuery(
  root: HTMLElement,
): string | null {
  const mark = root.querySelector("mark.occura-reading-selection-occurrence");
  if (!(mark instanceof HTMLElement)) return null;

  return mark.dataset.occuraQuery ?? null;
}

export function selectReadingViewOccurrence(mark: HTMLElement): void {
  const doc = mark.ownerDocument;
  const selection = doc.getSelection();
  if (!selection) return;

  const range = doc.createRange();
  range.selectNodeContents(mark);

  selection.removeAllRanges();
  selection.addRange(range);
  mark.scrollIntoView({ block: "nearest" });
}

function collectEligibleTextNodes(root: HTMLElement): Text[] {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const textNodes: Text[] = [];

  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof win.Text)) {
        return win.NodeFilter.FILTER_REJECT;
      }

      if (!node.nodeValue?.trim()) {
        return win.NodeFilter.FILTER_REJECT;
      }

      const parent = node.parentElement;
      if (!parent) {
        return win.NodeFilter.FILTER_REJECT;
      }

      if (shouldSkipElement(parent)) {
        return win.NodeFilter.FILTER_REJECT;
      }

      return win.NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    if (currentNode instanceof win.Text) {
      textNodes.push(currentNode);
    }
  }

  return textNodes;
}

function shouldSkipElement(element: Element): boolean {
  return !!element.closest(EXCLUDED_READING_VIEW_SELECTOR);
}

function wrapMatchesInTextNode(
  textNode: Text,
  query: string,
  caseSensitive: boolean,
  minimumLength: number,
): number {
  const text = textNode.nodeValue ?? "";
  const matches = findMatches(text, query, {
    caseSensitive,
    wholeWord: true,
    minimumLength,
  });

  if (matches.length === 0) return 0;

  const doc = textNode.ownerDocument;
  const fragment = doc.createDocumentFragment();
  let cursor = 0;

  for (const currentMatch of matches) {
    if (currentMatch.from > cursor) {
      fragment.appendChild(
        doc.createTextNode(text.slice(cursor, currentMatch.from)),
      );
    }

    const mark = doc.createElement("mark");
    mark.classList.add(
      "found-occurrence",
      "occura-reading-selection-occurrence",
    );
    mark.dataset.occuraQuery = query;
    mark.textContent = text.slice(currentMatch.from, currentMatch.to);
    fragment.appendChild(mark);

    cursor = currentMatch.to;
  }

  if (cursor < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(cursor)));
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
  return matches.length;
}
