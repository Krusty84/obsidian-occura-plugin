# ADR-0003: Protect Reading View selections during highlighting

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Mixed

## Context

Mobile users reported missing selection handles. [Issue #13](https://github.com/Krusty84/obsidian-occura-plugin/issues/13)

## Decision

Use DOM marks in Reading View. During a pointer gesture, wait for pointer release before updating selection highlights.

## Rationale

CodeMirror decorations apply only to editor views. A DOM change during a gesture can remove native selection handles.

## Alternatives

Not recorded.

## Consequences

Tests of native selections on Android and iOS devices are necessary.

## Implementation

Put HTML `mark` elements around matches in permitted text nodes. Cancel pending updates on `pointercancel`. Save selection offsets before changing the DOM. Use the offsets if Occura must restore the selection.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `ReadingViewOccurrenceControllerImpl.refreshDocuments` | `src/readingViewOccurrences.ts` | method | [95](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/readingViewOccurrences.ts#L95) |
| `ReadingViewOccurrenceControllerImpl.scheduleSelectionHandling` | `src/readingViewOccurrences.ts` | method | [125](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/readingViewOccurrences.ts#L125) |
| `captureReadingViewSelection` | `src/readingViewOccurrences.ts` | function | [266](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/readingViewOccurrences.ts#L266) |
| `applyReadingViewDynamicHighlights` | `src/readingViewOccurrences.ts` | function | [454](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/readingViewOccurrences.ts#L454) |
| `restoreReadingViewSelection` | `src/readingViewOccurrences.ts` | function | [312](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/readingViewOccurrences.ts#L312) |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/399d1ba77ec8c0203046914ccafd30ffb3f3fe5c
- https://github.com/Krusty84/obsidian-occura-plugin/commit/85a2bc57e3f018cdd310283ae2f7e252697f4961
- https://github.com/Krusty84/obsidian-occura-plugin/commit/046f37e85a06f9df77d945930fca8743a7a8c6e9
