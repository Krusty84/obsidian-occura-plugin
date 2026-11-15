# ADR-0004: Use one literal matcher

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

The editor and Reading View had separate match loops.

## Decision

Use one literal matcher with optional Unicode word boundaries.

## Rationale

Escape regular expression metacharacters such as `$` to search for those characters.

## Alternatives

Not recorded.

## Consequences

Selection highlights can match parts of words in the editor and Reading View. Keyword highlights use Unicode word boundaries.

## Implementation

`findMatches` returns text ranges for highlights, navigation, and Markdown commands. It accepts case sensitivity, boundary, and minimum length options.

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/244e5ca0c1ac34b56ba3fde5b368d57ee0b72f1c
- https://github.com/Krusty84/obsidian-occura-plugin/commit/c0b1e50fef0ab5425338ab3dbf855438a5759335
- https://github.com/Krusty84/obsidian-occura-plugin/commit/046f37e85a06f9df77d945930fca8743a7a8c6e9
- https://github.com/Krusty84/obsidian-occura-plugin/commit/dd95f58cf6c2bdfdb6508d760263847a70dcc764
- https://github.com/Krusty84/obsidian-occura-plugin/commit/6f4a4c030635c059f07b4b92e89a7f0c2f067a2e
