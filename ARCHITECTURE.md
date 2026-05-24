# Architecture

## Overview

The plugin supports both editing surfaces used by Obsidian:

- Source / Live Preview, via CodeMirror decorations.
- Reading View, via DOM post-processing and selection-driven `<mark>` wrappers.

The codebase is plugin-centric rather than layered. `main.ts` owns startup, settings lifecycle, command registration, and cross-view refresh behavior. Most feature files are thin helpers that plug back into the main plugin instance.

## Repository Structure

```text
main.ts                             Plugin entry point and runtime wiring
src/settings.ts                     Settings schema and settings tab UI
src/highlighter.ts                  CodeMirror occurrence and keyword highlighting
src/occurenceNavigation.ts          Next/previous occurrence navigation
src/readingViewDynamicOccurrences.ts Reading View selection-based highlighting
src/readingViewKeywords.ts          Reading View keyword-class highlighting
src/wordClasses.ts                  Editor context-menu integration for word classes
src/utils.ts                        Hotkey parsing and normalization helpers
styles.css                          CSS classes used by editor and Reading View marks
esbuild.config.mjs                  Bundle configuration for main.js
manifest.json                       Obsidian plugin metadata
data.json                           Example persisted plugin settings in this repo
```

## Main Runtime Components

### 1. Plugin bootstrap (`main.ts`)

`OccuraPlugin` extends Obsidian's `Plugin` and acts as the central coordinator.

Its main responsibilities are:

- Load and save persisted settings.
- Register the CodeMirror highlighting extension through a `Compartment`.
- Register Reading View integrations.
- Register commands, settings UI, and editor-menu actions.
- Keep title bar icons, status bar text, and CSS variables in sync with settings.
- Force reconfiguration or rerendering when settings change.

This file is the only real orchestration layer in the plugin.

### 2. Settings and persisted state (`src/settings.ts`)

`OccuraPluginSettings` is the single persisted state object. Important fields:

- `occuraPluginEnabled`: master on/off switch.
- `occuraCaseSensitive`: affects selected-text occurrence matching.
- `allowPhraseSelectionHighlighting`: allows spaces in selections.
- `nextOccurrenceHotkeys` and `previousOccurrenceHotkeys`: navigation shortcuts.
- `statusBarOccurrencesNumberEnabled`: controls status bar text.
- `autoKeywordsHighlightEnabled`: enables keyword-class highlighting.
- `keywordGroups[]`: current keyword-class model.

Each `KeywordGroup` contains:

- Stable `id`
- Human-readable `name`
- Highlight `color`
- `keywords[]`
- `enabled`
- `caseSensitive`

The settings tab edits this object directly, then calls `saveSettings()` and a refresh method such as `updateEditors()` or `updateKeyHandler()`.

Note: the settings schema still contains older fields such as `keywords`, `highlightColorKeywords`, and `keywordsCaseSensitive`. In the current code, class-based keyword groups are the active model for automatic keyword highlighting.

### 3. Editor highlighting (`src/highlighter.ts`)

This module contains the CodeMirror-side behavior.

Core responsibilities:

- Build regexes safely from selected text or keyword values.
- Validate whether a selection is eligible for occurrence navigation/highlighting.
- Provide `highlightOccurrenceExtension(plugin)`, a `ViewPlugin` that rebuilds decorations when selection, document, viewport, or relevant settings change.
- Count matches and write status text.

There are two editor decoration types:

- `selectedTextDecoration` for the current selection's repeated occurrences.
- Group-specific `Decoration.mark()` instances for keyword classes.

The implementation only scans `view.visibleRanges`, so editor highlighting is viewport-based rather than whole-document decoration.

This file also owns text mutation commands:

- Permanently wrap occurrences with `==...==`
- Remove that wrapping
- Prefix occurrences with `#`
- Remove those tag prefixes

Those commands operate on the active `MarkdownView` editor and mutate the note text directly.

### 4. Occurrence navigation (`src/occurenceNavigation.ts`)

This module implements next/previous navigation for both editor and Reading View.

Behavior:

- In Source / Live Preview, it reads the current CodeMirror selection, collects all document matches, computes the target index, and updates the editor selection.
- In Reading View, it reuses or creates dynamic DOM marks, computes the next/previous mark, selects it through the browser `Selection` API, and scrolls it into view.

Navigation is intentionally selection-driven. If there is no valid selection or previously highlighted Reading View query, the command stops with a notice.

### 5. Reading View dynamic occurrences (`src/readingViewDynamicOccurrences.ts`)

This module adds selected-text occurrence highlighting for preview mode, where CodeMirror decorations are not available.

It registers document-level DOM listeners for:

- `pointerdown`
- `pointerup`
- `pointercancel`
- `selectionchange`

The controller debounces selection handling, ignores events during its own DOM rewrites, and only reacts when the selection belongs to a `.markdown-preview-view` tree rather than CodeMirror.

When active, it:

1. Validates the current selection.
2. Clears prior dynamic marks.
3. Walks eligible text nodes.
4. Wraps matches in `<mark class="found-occurrence occura-reading-selection-occurrence">`.
5. Updates the shared status bar text.

This module also exposes helpers used by navigation, such as:

- Finding the Reading View root for a selection
- Querying existing dynamic marks
- Selecting a specific mark

### 6. Reading View keyword highlighting (`src/readingViewKeywords.ts`)

Keyword-class highlighting in Reading View is implemented separately from dynamic selection highlighting.

This module registers a Markdown post processor that runs after Obsidian renders preview HTML. It:

- Flattens enabled `keywordGroups` into a prepared keyword list.
- Walks eligible text nodes in the rendered preview.
- Finds non-overlapping matches.
- Replaces text nodes with fragments containing `<mark class="keyword-occurrence occura-keyword-reading-occurrence">`.

This is a render-time transform, not a live decoration system. Re-rendering the preview is how the plugin refreshes keyword-class highlights after settings changes.

### 7. Word-class editor integration (`src/wordClasses.ts`)

This module adds a context-menu entry to the editor when a single word is selected.

The flow is:

- User opens the editor menu on a selection.
- Plugin offers "Add selected word to class".
- If there is one class, the word is added immediately.
- If there are multiple classes, a `SuggestModal` lets the user choose one.

This is a thin convenience layer over the persisted `keywordGroups` settings model.

### 8. Shared helpers (`src/utils.ts`)

`src/utils.ts` contains only hotkey-related helpers:

- Parse a hotkey string into modifiers and key.
- Match keyboard events to configured hotkeys.
- Choose platform-aware default hotkeys.
- Normalize stored navigation hotkeys when loading settings.

## Data Flow

### Plugin startup

1. Obsidian loads `main.js`, which instantiates `OccuraPlugin`.
2. `onload()` reads persisted settings with `loadData()`.
3. `main.ts` creates a CodeMirror `Compartment` and registers the editor extension.
4. `main.ts` registers:
   - settings tab
   - Reading View dynamic controller
   - Reading View keyword post processor
   - commands
   - editor-menu integration
   - layout-change listener
5. CSS variables and title bar icons are initialized.

### Source / Live Preview occurrence highlighting

1. User selects text in the editor.
2. CodeMirror triggers the Occura `ViewPlugin`.
3. `highlighter.ts` validates the selection and builds a regex.
4. Visible matches are converted into decorations.
5. The status bar is updated with the count.

### Reading View occurrence highlighting

1. User selects text in Reading View.
2. DOM selection listeners fire in `readingViewDynamicOccurrences.ts`.
3. The controller debounces and validates the selection.
4. Matching text nodes are wrapped in `<mark>` elements.
5. Navigation commands can then move through those marks.

### Keyword-class updates

1. User edits classes in settings or adds a word from the editor menu.
2. The plugin saves the updated `keywordGroups`.
3. `updateEditors()` reconfigures CodeMirror editor extensions.
4. `rerenderReadingViews()` forces preview rerendering.
5. Editor decorations and Reading View post-processing rebuild from the new settings.

### Text mutation commands

1. User selects a word in the active editor.
2. A command in `main.ts` calls a helper from `highlighter.ts`.
3. The helper scans the whole document text with a regex.
4. Matching ranges are rewritten in reverse order to avoid offset drift.

## Key Design Decisions

### One plugin instance owns all cross-feature state

There is no separate service container or store. The plugin instance carries settings, the CodeMirror compartment, the Reading View controller, the status bar element, and the global key handler.

This keeps the code small, but it also means most features depend directly on `OccuraPlugin`.

### Editor and Reading View are implemented separately

The plugin does not try to unify both rendering paths behind one abstraction.

- Editor mode uses CodeMirror decorations.
- Reading View uses DOM traversal and DOM rewriting.

That matches Obsidian's actual runtime model and keeps each path straightforward.

### Refresh is imperative

Settings changes call explicit refresh methods:

- `updateEditors()` for editor extension reconfiguration
- `rerenderReadingViews()` for preview refresh
- `refreshDocuments()` for Reading View listener registration

There is no reactive data layer; refresh behavior is manual.

### Regex matching is simple and local

Matching is built from escaped user text and does not implement stemming, fuzzy matching, or markdown-aware tokenization. Whole-word boundaries are only applied when the selected text looks like a simple word.

## External Dependencies and Integrations

### Obsidian API

Used for:

- Plugin lifecycle
- Settings UI
- Commands
- Workspace and leaf traversal
- Markdown post processors
- Notices
- Status bar item creation
- Editor menu integration

### CodeMirror

Used for:

- `Compartment`-based extension reconfiguration
- `ViewPlugin`
- `Decoration` and `DecorationSet`
- `EditorView` access for editor selection and document updates

### Browser DOM APIs

Used heavily in Reading View:

- `Selection`
- `Range`
- `TreeWalker`
- DOM event listeners
- `<mark>` node insertion and unwrapping

## Build / Validation Notes

- Source files are TypeScript.
- `esbuild.config.mjs` bundles `main.ts` into `main.js`.
- `obsidian` and CodeMirror packages are treated as externals.
- `npm run build` performs a TypeScript check with `tsc -noEmit -skipLibCheck` before the production bundle.
- `styles.css`, `manifest.json`, and the generated `main.js` are part of the shipped plugin surface.

## Known Constraints

- The architecture is intentionally small and direct, but feature boundaries are not strict. `main.ts` is the coordination hub for most behavior.
- Reading View highlighting rewrites rendered DOM. That is practical, but it means behavior depends on Obsidian's preview DOM structure.
- Dynamic editor occurrence highlighting only scans visible editor ranges, while navigation scans the full document. Counting and navigation therefore come from different implementations.
- Status bar output is shared by multiple features, so the latest action wins.
- Some persisted settings fields appear to be legacy carryovers from earlier keyword implementations and are not the primary path in the current code.
- The repository currently includes work-in-progress changes that are ahead of the published `manifest.json` version. This document reflects the checked-out code, not only the released plugin package.
