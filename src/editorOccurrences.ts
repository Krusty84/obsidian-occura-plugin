/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import { RangeSetBuilder, type Text } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
} from "@codemirror/view";
import type { OccuraPluginSettings } from "src/settings";
import { findMatches, type MatchOptions, type TextMatch } from "src/matching";

export interface EditorOccurrenceHost {
  settings: OccuraPluginSettings;
  clearOccurrenceStatus(): void;
  isEditorViewActive(view: EditorView): boolean;
  setOccurrenceStatus(
    query: string,
    count: number,
    currentIndex: number | null,
  ): void;
}

export interface SelectionQuery {
  query: string;
  from: number;
  to: number;
}

export interface EditorOccurrenceSnapshot extends SelectionQuery {
  matches: TextMatch[];
  currentIndex: number | null;
}

export type SelectionValidationReason =
  | "valid"
  | "empty"
  | "multiline"
  | "phrase-disabled"
  | "too-short";

export const SELECTION_DEBOUNCE_MS = 120;

const selectedTextDecoration = Decoration.mark({
  class: "found-occurrence",
  priority: 100,
});

interface CachedMatches {
  document: Text;
  query: string;
  optionsKey: string;
  matches: TextMatch[];
}

const editorMatchCache = new WeakMap<EditorView, CachedMatches>();

function matchingOptions(settings: OccuraPluginSettings): MatchOptions {
  return {
    caseSensitive: settings.occuraCaseSensitive,
    wholeWord: true,
    minimumLength: settings.minimumSelectionLength,
  };
}

function optionsKey(options: MatchOptions): string {
  return `${options.caseSensitive}:${options.wholeWord}:${options.minimumLength}`;
}

export function validateSelectionQuery(
  query: string,
  settings: Pick<
    OccuraPluginSettings,
    "allowPhraseSelectionHighlighting" | "minimumSelectionLength"
  >,
): SelectionValidationReason {
  if (!query) return "empty";
  if (/\r|\n/.test(query)) return "multiline";
  if (/\s/.test(query) && settings.allowPhraseSelectionHighlighting !== true) {
    return "phrase-disabled";
  }
  if (Array.from(query).length < settings.minimumSelectionLength) {
    return "too-short";
  }
  return "valid";
}

export function getSelectionQuery(
  view: EditorView,
  settings: OccuraPluginSettings,
): SelectionQuery | null {
  const selection = view.state.selection.main;
  if (selection.empty) return null;

  const selectedText = view.state.doc.sliceString(selection.from, selection.to);
  const query = selectedText.trim();
  if (validateSelectionQuery(query, settings) !== "valid") return null;

  const leadingWhitespace =
    selectedText.length - selectedText.trimStart().length;
  return {
    query,
    from: selection.from + leadingWhitespace,
    to: selection.from + leadingWhitespace + query.length,
  };
}

export function getEditorOccurrenceSnapshot(
  view: EditorView,
  settings: OccuraPluginSettings,
  selectionQuery = getSelectionQuery(view, settings),
): EditorOccurrenceSnapshot | null {
  if (!selectionQuery) return null;

  const options = matchingOptions(settings);
  const key = optionsKey(options);
  const cached = editorMatchCache.get(view);
  let matches: TextMatch[];

  if (
    cached &&
    cached.document === view.state.doc &&
    cached.query === selectionQuery.query &&
    cached.optionsKey === key
  ) {
    matches = cached.matches;
  } else {
    matches = findMatches(
      view.state.doc.sliceString(0, view.state.doc.length),
      selectionQuery.query,
      options,
    );
    editorMatchCache.set(view, {
      document: view.state.doc,
      query: selectionQuery.query,
      optionsKey: key,
      matches,
    });
  }

  const currentIndex = matches.findIndex(
    (match) =>
      match.from === selectionQuery.from && match.to === selectionQuery.to,
  );

  return {
    ...selectionQuery,
    matches,
    currentIndex: currentIndex >= 0 ? currentIndex : null,
  };
}

function firstPotentiallyVisibleMatch(
  matches: TextMatch[],
  visibleFrom: number,
): number {
  let low = 0;
  let high = matches.length;

  while (low < high) {
    const middle = (low + high) >> 1;
    if (matches[middle].to <= visibleFrom) low = middle + 1;
    else high = middle;
  }

  return low;
}

export function getVisibleMatches(
  matches: TextMatch[],
  visibleRanges: readonly { from: number; to: number }[],
): TextMatch[] {
  const visible: TextMatch[] = [];
  const seen = new Set<string>();

  for (const range of visibleRanges) {
    let index = firstPotentiallyVisibleMatch(matches, range.from);
    while (index < matches.length && matches[index].from < range.to) {
      const match = matches[index++];
      const key = `${match.from}:${match.to}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visible.push(match);
    }
  }

  return visible;
}

export function highlightOccurrenceExtension(host: EditorOccurrenceHost) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      private snapshot: EditorOccurrenceSnapshot | null = null;
      private debounceTimer: number | null = null;

      constructor(public view: EditorView) {
        this.scheduleSelectedOccurrences();
        this.rebuildDecorations();
      }

      update(update: ViewUpdate): void {
        if (update.selectionSet || update.docChanged) {
          this.snapshot = null;
          this.scheduleSelectedOccurrences();
        }

        if (
          update.selectionSet ||
          update.docChanged ||
          update.viewportChanged
        ) {
          this.rebuildDecorations();
        }
      }

      destroy(): void {
        this.cancelPendingSelection();
      }

      private cancelPendingSelection(): void {
        if (this.debounceTimer === null) return;
        window.clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }

      private scheduleSelectedOccurrences(): void {
        this.cancelPendingSelection();
        const selectionQuery = getSelectionQuery(this.view, host.settings);
        if (!host.settings.occuraPluginEnabled || !selectionQuery) {
          if (host.isEditorViewActive(this.view)) host.clearOccurrenceStatus();
          return;
        }

        if (host.isEditorViewActive(this.view)) host.clearOccurrenceStatus();

        this.debounceTimer = window.setTimeout(() => {
          this.debounceTimer = null;
          const latestQuery = getSelectionQuery(this.view, host.settings);
          if (!latestQuery) {
            this.snapshot = null;
            if (host.isEditorViewActive(this.view))
              host.clearOccurrenceStatus();
            this.view.dispatch({});
            return;
          }

          this.snapshot = getEditorOccurrenceSnapshot(
            this.view,
            host.settings,
            latestQuery,
          );
          this.rebuildDecorations();
          if (this.snapshot && host.isEditorViewActive(this.view)) {
            host.setOccurrenceStatus(
              this.snapshot.query,
              this.snapshot.matches.length,
              this.snapshot.currentIndex,
            );
          }
          this.view.dispatch({});
        }, SELECTION_DEBOUNCE_MS);
      }

      private getGroupDecoration(color: string): Decoration {
        return Decoration.mark({
          class: "keyword-occurrence",
          attributes: { style: `background-color: ${color};` },
          priority: 50,
        });
      }

      private rebuildDecorations(): void {
        const ranges: Array<{
          from: number;
          to: number;
          decoration: Decoration;
          priority: number;
        }> = [];
        const seen = new Set<string>();

        if (host.settings.occuraPluginEnabled && this.snapshot) {
          for (const match of getVisibleMatches(
            this.snapshot.matches,
            this.view.visibleRanges,
          )) {
            const key = `${match.from}:${match.to}`;
            seen.add(key);
            ranges.push({
              ...match,
              decoration: selectedTextDecoration,
              priority: 100,
            });
          }
        }

        if (
          host.settings.occuraPluginEnabled &&
          host.settings.autoKeywordsHighlightEnabled &&
          Array.isArray(host.settings.keywordGroups)
        ) {
          for (const group of host.settings.keywordGroups) {
            if (!group?.enabled) continue;
            const decoration = this.getGroupDecoration(group.color);

            for (const keyword of group.keywords ?? []) {
              const query = keyword.trim();
              if (!query) continue;

              for (const visibleRange of this.view.visibleRanges) {
                const text = this.view.state.doc.sliceString(
                  visibleRange.from,
                  visibleRange.to,
                );
                for (const localMatch of findMatches(text, query, {
                  caseSensitive: !!group.caseSensitive,
                  wholeWord: true,
                  minimumLength: 1,
                })) {
                  const from = visibleRange.from + localMatch.from;
                  const to = visibleRange.from + localMatch.to;
                  const key = `${from}:${to}`;
                  if (seen.has(key)) continue;
                  seen.add(key);
                  ranges.push({ from, to, decoration, priority: 50 });
                }
              }
            }
          }
        }

        ranges.sort(
          (left, right) =>
            left.from - right.from ||
            right.priority - left.priority ||
            left.to - right.to,
        );

        const builder = new RangeSetBuilder<Decoration>();
        for (const range of ranges) {
          builder.add(range.from, range.to, range.decoration);
        }
        this.decorations = builder.finish();
      }
    },
    { decorations: (value) => value.decorations },
  );
}

export function getCodeMirrorEditor(editor: unknown): EditorView | undefined {
  if (typeof editor !== "object" || editor === null) return undefined;
  const cm = Reflect.get(editor, "cm");
  return cm instanceof EditorView ? cm : undefined;
}
