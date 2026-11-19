# ADR-0010: Run release checks in CI

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Git History

## Context

The release uses version data in `package.json`, `package-lock.json`, `manifest.json`, and `versions.json`.

## Decision

Run the tests, production build, and release checks in CI on pushes and pull requests.

## Rationale

Not recorded.

## Alternatives

Not recorded.

## Consequences

The CI job stops with an error if there is a version mismatch. A missing or empty `main.js` also causes an error.

## Implementation

Run `npm ci` on Node.js 20. Run `validate-release.mjs` after the production build.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `fail` | `validate-release.mjs` | function | [7](https://github.com/Krusty84/obsidian-occura-plugin/blob/5e4d849cb25d7c687a4842aa15cf8a983dbfe622/validate-release.mjs#L7) |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/d96ec0f2ea8529ca7ba6fe13a8e0c988083aa729
