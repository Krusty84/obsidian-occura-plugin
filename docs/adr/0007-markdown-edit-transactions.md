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

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/dd95f58cf6c2bdfdb6508d760263847a70dcc764
