# ADR-0006: Cache editor matches for the full note

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

The editor counted visible matches. Navigation searched the full note.

## Decision

Cache one match list for the full note in each editor view. Use this list for the count and navigation. Draw decorations only for matches that intersect visible ranges.

## Rationale

The delay lets Occura cancel a pending scan when the selection changes.

## Alternatives

Not recorded.

## Consequences

The count stays the same when the user scrolls.

## Implementation

Wait 120 ms after a selection or document change. Reuse the cached matches when the CodeMirror document object, query, and match options are the same.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `getEditorOccurrenceSnapshot` | `src/editorOccurrences.ts` | function | [src/editorOccurrences.ts:113](../../src/editorOccurrences.ts#L113) |
| `SELECTION_DEBOUNCE_MS` | `src/editorOccurrences.ts` | constant | [src/editorOccurrences.ts:47](../../src/editorOccurrences.ts#L47) |
| `highlightOccurrenceExtension` | `src/editorOccurrences.ts` | function | [src/editorOccurrences.ts:195](../../src/editorOccurrences.ts#L195) |
| `getVisibleMatches` | `src/editorOccurrences.ts` | function | [src/editorOccurrences.ts:174](../../src/editorOccurrences.ts#L174) |
| `navigateOccurrence` | `src/occurrenceNavigation.ts` | function | [src/occurrenceNavigation.ts:71](../../src/occurrenceNavigation.ts#L71) |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/c0b1e50fef0ab5425338ab3dbf855438a5759335
