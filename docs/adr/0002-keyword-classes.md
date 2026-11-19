# ADR-0002: Store keywords in classes

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

Occura stored keywords in one list with one highlight color.

## Decision

Store keywords in named classes. Set the color, enabled state, and case sensitivity for each class.

## Rationale

Different colors can identify terms from different domains.

## Alternatives

Not recorded.

## Consequences

Users can add a selected word to an existing class from the editor menu.

## Implementation

Store each class in `keywordGroups`. Give each class a stable `id`.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `KeywordGroup` | `src/settings.ts` | interface | `10` |
| `OccuraPluginSettings.keywordGroups` | `src/settings.ts` | property | `34` |
| `registerWordClassesEditorMenu` | `src/wordClasses.ts` | function | `74` |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/c3ca52642676dae3d9c976735f7de8839ad8ead0
- https://github.com/Krusty84/obsidian-occura-plugin/commit/f46c6e92a9bd4333251cddc0d0c6bcdf85c60330
