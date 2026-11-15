# ADR-0009: Show the count from the active pane

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

The editor and Reading View shared the status bar. The most recent update set the count.

## Decision

Use one status bar item for Occura. Permit only the active pane to publish a count.

## Rationale

Not recorded.

## Alternatives

Not recorded.

## Consequences

Occura clears the count when the active pane changes or the user disables highlighting.

## Implementation

Create the status item in `onload`. Check the pane with `isEditorViewActive` or `isReadingViewActive` before publishing the count.

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/c0b1e50fef0ab5425338ab3dbf855438a5759335
- https://github.com/Krusty84/obsidian-occura-plugin/commit/bd3b9f2735cbbad47d8dc8672a60545ada6eef33
