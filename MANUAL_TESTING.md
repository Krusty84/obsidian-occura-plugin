# Occura Manual Compatibility Checklist

Use a disposable vault containing short notes, a long note with many repeated terms,
frontmatter, links, code, tags, highlights, headings, and at least two Markdown panes.
Run the relevant checks on Windows, macOS, Linux, Android, and iOS.

## Editing modes

- [ ] In Source Mode, selecting a word highlights visible occurrences and reports the full-note total.
- [ ] In Live Preview, selection, total count, scrolling, next/previous navigation, editing, and Undo behave the same way.
- [ ] In Reading View, mouse and touch selections remain selected after highlighting and next/previous navigation wraps correctly.
- [ ] On Android and iOS, long-press selection handles and the native copy menu finish before Occura changes rendered marks.
- [ ] Selecting one character or `$` does not stall the app and navigation explains the configured minimum length.

## Compatibility

- [ ] Built-in Find and its next/previous shortcuts work normally.
- [ ] Spellcheck suggestions can be opened and applied.
- [ ] Heading and code-block folding work by mouse and keyboard.
- [ ] Vim mode selection and navigation work when Vim mode is available.
- [ ] Other plugins' shortcuts are not intercepted by Occura.
- [ ] Occura shortcuts can be assigned and changed in Settings → Hotkeys.

## Multiple panes and lifecycle

- [ ] With multiple Markdown panes, only the active pane controls status text.
- [ ] Switching notes or modes clears stale status and does not add another status item.
- [ ] A long note keeps a stable total while scrolling and decorates only visible content.
- [ ] Disabling Occura clears dynamic marks and status without changing the selection.
- [ ] Re-enabling Occura restores behavior without duplicate icons, listeners, or status items.
- [ ] Unloading the plugin removes Occura marks, icons, styles, and pending selection work.

## Safe mutation commands

- [ ] Add/remove permanent highlights and tags preserve frontmatter, code, links, wiki-links, embeds, HTML blocks, existing tags, and existing highlights.
- [ ] Repeating an add command does not create `====word====` or `##word`.
- [ ] Each command reports the number changed, reports a safe no-op when appropriate, and is reverted by one Undo.
