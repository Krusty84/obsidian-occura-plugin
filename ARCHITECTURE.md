# Architecture

## Overview

Occura highlights selected-text occurrences and configured keyword classes in
Obsidian's Source Mode, Live Preview, and Reading View. The implementation uses
CodeMirror decorations for editors and DOM marks for rendered Markdown. Both
paths share one literal, Unicode-aware matching engine.

`main.ts` remains the lifecycle coordinator: it loads settings, owns the single
status bar item, registers commands and integrations, and refreshes active views.
Matching, mutation planning, and navigation logic live in focused modules and do
not require the plugin class unless they interact with Obsidian lifecycle state.

## Repository Structure

```text
main.ts                         Plugin lifecycle and registration
src/matching.ts                 Literal Unicode-aware matching
src/settings.ts                 Settings model and settings UI
src/settingsMigration.ts        Persisted-data validation and migration
src/editorOccurrences.ts        CodeMirror selection, cache, and decorations
src/occurrenceNavigation.ts     Editor and Reading View navigation
src/readingViewOccurrences.ts   Selection-driven Reading View marks
src/readingViewKeywords.ts      Render-time keyword-class marks
src/markdownMutations.ts        Markdown-aware mutation planning and commands
src/wordClasses.ts              Editor-menu word-class integration
tests/                          Vitest and jsdom regression coverage
MANUAL_TESTING.md               Real-Obsidian compatibility checklist
validate-release.mjs            Release metadata and artifact validation
```

## Main Runtime Components

### Shared matching

`findMatches` treats every query as literal text. Case sensitivity, whole-token
boundaries, and minimum query length are explicit options. Whole-token checks use
Unicode letters, marks, numbers, and connector punctuation, while queries such as
`C++` and punctuation-only strings only receive boundaries on word-like edges.

The matcher returns non-empty source ranges. Editor occurrences, navigation,
Reading View marks, keyword classes, and Markdown mutations all consume those
ranges rather than maintaining separate regular-expression loops.

### Editor occurrences

The CodeMirror view plugin debounces selection-driven work by 120 ms. Its latest
complete-document result is cached by immutable CodeMirror document identity,
query, and matching options. Status and navigation reuse that array. Decoration
building uses only matches intersecting CodeMirror's visible ranges; scrolling
therefore changes rendered marks without changing the total.

Keyword classes are scanned only in visible ranges and are not limited by the
minimum dynamic selection length.

### Reading View occurrences

Reading View listens for `selectionchange` and pointer lifecycle events in each
workspace document. It performs no DOM rewrite while a pointer gesture is active,
debounces after pointer completion, and cancels work on pointer cancellation.

Eligible rendered text nodes are matched and wrapped in Occura `<mark>` elements.
Code, links, metadata, math, form controls, and existing Occura marks are skipped.
Logical selection offsets are captured before wrapping; an intact native selection
is left alone, while disconnected anchors are reconstructed when possible.

### Markdown mutations

Permanent highlight and tag commands first build a complete mutation plan from the
current editor source. The planner protects frontmatter, fenced and inline code,
links, wiki-links, embeds, HTML, and existing markup relevant to the operation.
Unclosed or ambiguous protected constructs fail closed through a safe boundary.

All planned changes are sent through one Obsidian editor transaction. This keeps
the reported count aligned with the actual changes and allows one Undo operation
to revert the command.

### Settings and status lifecycle

Settings migration validates persisted values, defaults the minimum selection
length to two, preserves valid keyword groups, and removes obsolete custom-hotkey
fields. Occura registers commands only; users assign shortcuts through Obsidian's
Hotkeys settings.

The plugin creates one status bar element during load. Only the active pane may
publish a count. Invalid selections, active-view changes, disabling, and unload
clear stale status.

## Data Flow

### Source Mode and Live Preview

1. CodeMirror reports a selection or document change.
2. The editor integration replaces any pending debounce timer.
3. The shared matcher scans the complete immutable document once.
4. Status and navigation retain the complete match array.
5. Visible ranges select the subset rendered as decorations.

### Reading View

1. Pointer completion or a non-pointer selection change schedules debounced work.
2. The controller validates the selected query and active Reading View root.
3. Eligible text nodes use the shared matcher and become DOM marks.
4. The original selection is retained or restored, and marks become the navigation list.

### Permanent mutations

1. An Obsidian editor command supplies the active editor and retained selection.
2. The planner identifies protected Markdown ranges.
3. Shared matching produces candidate ranges outside protected content.
4. The adapter applies all planned changes in one editor transaction.

## Key Design Decisions

- Literal matching prevents regex metacharacters such as `$` from changing query behavior.
- Complete editor match arrays provide correct totals; viewport filtering is a rendering optimization only.
- A one-entry cache per editor is sufficient because cancelled rapid selections never scan.
- Reading View uses DOM marks because CodeMirror decorations are unavailable there; mobile selection behavior still requires real-device verification.
- Markdown mutation parsing is deliberately conservative. A safe no-op is preferred over modifying uncertain source.
- No global keyboard listener or default F3 binding is installed.
- No new runtime or state-management dependency is used.

## External Dependencies and Integrations

- Obsidian API: plugin lifecycle, commands, settings, editor transactions, notices, workspace events, and status bar.
- CodeMirror: immutable documents, selections, compartments, view plugins, and decorations.
- Browser DOM: Reading View selections, ranges, tree walking, pointer events, and marks.
- Vitest and jsdom: deterministic unit and DOM regression tests.

## Build and Validation

- `npm test` runs Vitest regression tests.
- `npm run build` type-checks and creates the production `main.js` bundle.
- `npm run validate:release` checks synchronized package, lockfile, manifest, versions metadata, required manifest fields, and the built artifact.
- CI runs those commands with Node 20 after `npm ci`.

## Known Constraints

- Reading View rewrites rendered DOM, so native selection behavior must still be checked on Android and iOS WebViews.
- The conservative Markdown planner supports the protected constructs covered by regression tests; unusual plugin-defined Markdown syntax is skipped only when it resembles a protected standard construct.
- jsdom cannot reproduce Obsidian's complete spellcheck, folding, Vim, multiple-window, or mobile gesture behavior. `MANUAL_TESTING.md` remains required before release.
