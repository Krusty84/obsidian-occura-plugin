/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import type OccuraPlugin from "main";
import { MarkdownView, Notice } from "obsidian";
import {
  getCodeMirrorEditor,
  getEditorOccurrenceSnapshot,
  validateSelectionQuery,
} from "src/editorOccurrences";
import type { TextMatch } from "src/matching";
import {
  applyReadingViewDynamicHighlights,
  getReadingViewDynamicOccurrenceMarks,
  getReadingViewDynamicOccurrenceQuery,
  getReadingViewRootFromSelection,
  selectReadingViewOccurrence,
} from "src/readingViewOccurrences";

export type OccuraNavigationDirection = "next" | "previous";

type OccuraPreviewMatch = {
  mark: HTMLElement;
  range: Range;
};

export function getTargetOccurrenceIndex(
  matches: TextMatch[],
  selectionFrom: number,
  selectionTo: number,
  direction: OccuraNavigationDirection,
): number {
  const currentIndex = matches.findIndex(
    (match) => match.from === selectionFrom && match.to === selectionTo,
  );

  if (direction === "next") {
    if (currentIndex >= 0) return (currentIndex + 1) % matches.length;
    const nextIndex = matches.findIndex((match) => match.from >= selectionTo);
    return nextIndex >= 0 ? nextIndex : 0;
  }

  if (currentIndex >= 0) {
    return (currentIndex - 1 + matches.length) % matches.length;
  }

  for (let index = matches.length - 1; index >= 0; index--) {
    if (matches[index].to <= selectionFrom) return index;
  }

  return matches.length - 1;
}

function showInvalidSelectionNotice(
  query: string,
  context: OccuraPlugin,
): void {
  const reason = validateSelectionQuery(query, context.settings);
  if (reason === "too-short") {
    new Notice(
      `Selection must be at least ${context.settings.minimumSelectionLength} characters.`,
    );
    return;
  }

  new Notice("Select text to navigate occurrences.");
}

export function navigateOccurrence(
  context: OccuraPlugin,
  direction: OccuraNavigationDirection,
): void {
  if (!context.settings.occuraPluginEnabled) {
    new Notice("Please enable Occura");
    return;
  }

  const view = context.app.workspace.getActiveViewOfType(MarkdownView);
  if (!view) {
    new Notice("No active editor");
    return;
  }

  if (view.getMode() === "preview") {
    navigateReadingViewOccurrence(context, view, direction);
    return;
  }

  const codeMirror = getCodeMirrorEditor(view.editor);
  if (!codeMirror) {
    new Notice("No active editor");
    return;
  }

  const selection = codeMirror.state.selection.main;
  const query = selection.empty
    ? ""
    : codeMirror.state.doc.sliceString(selection.from, selection.to).trim();
  if (validateSelectionQuery(query, context.settings) !== "valid") {
    showInvalidSelectionNotice(query, context);
    return;
  }

  const snapshot = getEditorOccurrenceSnapshot(codeMirror, context.settings);
  if (!snapshot || snapshot.matches.length === 0) {
    new Notice("No occurrences found.");
    return;
  }

  const targetIndex = getTargetOccurrenceIndex(
    snapshot.matches,
    snapshot.from,
    snapshot.to,
    direction,
  );
  const target = snapshot.matches[targetIndex];

  codeMirror.dispatch({
    selection: { anchor: target.from, head: target.to },
    scrollIntoView: true,
    userEvent: "select.search",
  });
  codeMirror.focus();
  context.setOccurrenceStatus(
    snapshot.query,
    snapshot.matches.length,
    targetIndex,
  );

  if (snapshot.matches.length === 1) {
    new Notice("Only one occurrence found.");
  }
}

function navigateReadingViewOccurrence(
  context: OccuraPlugin,
  view: MarkdownView,
  direction: OccuraNavigationDirection,
): void {
  const root = view.containerEl.querySelector(".markdown-preview-view");
  if (!(root instanceof HTMLElement)) {
    new Notice("No active Reading View.");
    return;
  }

  const selection = view.containerEl.doc.getSelection();
  const hasSelection =
    !!selection && selection.rangeCount > 0 && !selection.isCollapsed;
  const selectionRoot =
    hasSelection && selection
      ? getReadingViewRootFromSelection(selection)
      : null;

  let query: string | null = null;
  if (hasSelection && selection && selectionRoot === root) {
    const selectedText = selection.toString().trim();
    if (validateSelectionQuery(selectedText, context.settings) === "valid") {
      query = selectedText;
    } else if (selectedText) {
      showInvalidSelectionNotice(selectedText, context);
      return;
    }
  }

  if (!query) query = getReadingViewDynamicOccurrenceQuery(root);
  if (!query) {
    new Notice("Select text in Reading View to navigate occurrences.");
    return;
  }

  let marks = getReadingViewDynamicOccurrenceMarks(root, query);
  if (marks.length === 0) {
    applyReadingViewDynamicHighlights(root, query, context);
    marks = getReadingViewDynamicOccurrenceMarks(root, query);
  }

  if (marks.length === 0) {
    new Notice("No occurrences found.");
    return;
  }

  const selectionRange =
    hasSelection && selection
      ? selection.getRangeAt(0)
      : createMarkRange(marks[0]);
  const matches = marks.map((mark) => ({
    mark,
    range: createMarkRange(mark),
  }));
  const targetIndex = getTargetPreviewOccurrenceIndex(
    matches,
    selectionRange,
    direction,
  );

  selectReadingViewOccurrence(matches[targetIndex].mark);
  context.setOccurrenceStatus(query, matches.length, targetIndex);

  if (matches.length === 1) new Notice("Only one occurrence found.");
}

function createMarkRange(mark: HTMLElement): Range {
  const range = mark.ownerDocument.createRange();
  range.selectNodeContents(mark);
  return range;
}

function getTargetPreviewOccurrenceIndex(
  matches: OccuraPreviewMatch[],
  selectionRange: Range,
  direction: OccuraNavigationDirection,
): number {
  const currentIndex = matches.findIndex((match) =>
    selectionRange.intersectsNode(match.mark),
  );

  if (direction === "next") {
    if (currentIndex >= 0) return (currentIndex + 1) % matches.length;
    const nextIndex = matches.findIndex(
      (match) =>
        selectionRange.compareBoundaryPoints(Range.END_TO_START, match.range) <=
        0,
    );
    return nextIndex >= 0 ? nextIndex : 0;
  }

  if (currentIndex >= 0) {
    return (currentIndex - 1 + matches.length) % matches.length;
  }

  for (let index = matches.length - 1; index >= 0; index--) {
    if (
      selectionRange.compareBoundaryPoints(
        Range.START_TO_END,
        matches[index].range,
      ) >= 0
    ) {
      return index;
    }
  }

  return matches.length - 1;
}
