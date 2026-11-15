# ADR-0008: Use Obsidian input handling

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Mixed

## Context

Occura cleared the selection on clicks outside the editor. It also captured shortcuts at window level.

## Decision

Let Obsidian handle clicks outside the editor and keyboard shortcuts.

## Rationale

The click handler prevented some spellcheck and folding actions. [Issue #8](https://github.com/Krusty84/obsidian-occura-plugin/issues/8#issuecomment-2815961407)

Obsidian keeps control of the built-in Find shortcuts.

## Alternatives

Not recorded.

## Consequences

Users assign Occura shortcuts in Obsidian's Hotkeys settings.

## Implementation

Remove the document click handler and the window `keydown` listener. Keep the `addCommand` registrations.

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/14885620b79957954f786335376d3e113868f3a8
- https://github.com/Krusty84/obsidian-occura-plugin/commit/244e5ca0c1ac34b56ba3fde5b368d57ee0b72f1c
- https://github.com/Krusty84/obsidian-occura-plugin/commit/bd3b9f2735cbbad47d8dc8672a60545ada6eef33
