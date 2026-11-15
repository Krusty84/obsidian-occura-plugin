# ADR-0005: Check saved settings at load

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

Occura merged saved values with defaults at load.

## Decision

Check saved settings before use. Use defaults for missing or incorrect values.

## Rationale

Not recorded.

## Alternatives

Not recorded.

## Consequences

Occura keeps valid keyword classes. The default minimum selection length is two Unicode code points.

## Implementation

Call `migrateSettings` in `loadSettings`. Save the result when `changed` is true.

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/244e5ca0c1ac34b56ba3fde5b368d57ee0b72f1c
