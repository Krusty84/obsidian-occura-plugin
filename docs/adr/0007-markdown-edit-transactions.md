# ADR-0007: Apply planned Markdown edits in one transaction

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

Earlier tag commands called `replaceRange` for each match.

## Decision

Plan changes to permanent highlights and tags before editing. Skip protected ranges. Apply the plan in one editor transaction.

## Rationale

One transaction permits one Undo operation for all changes.

## Alternatives

The architecture notes reject edits in uncertain source ranges.

## Consequences

The command reports the number of changes.

## Implementation

Use `planMarkdownMutation` to identify protected ranges such as frontmatter, code, and links. Pass the planned changes to `editor.transaction`.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `planMarkdownMutation` | `src/markdownMutations.ts` | function | [510](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/markdownMutations.ts#L510) |
| `getBaseProtectedRanges` | `src/markdownMutations.ts` | function | [402](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/markdownMutations.ts#L402) |
| `runMarkdownMutationCommand` | `src/markdownMutations.ts` | function | [533](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/src/markdownMutations.ts#L533) |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/dd95f58cf6c2bdfdb6508d760263847a70dcc764
