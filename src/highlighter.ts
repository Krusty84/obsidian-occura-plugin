import {
    EditorView,
    Decoration,
    DecorationSet,
    ViewPlugin,
    ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type OccuraPlugin from 'main';
import { MarkdownView, Notice } from 'obsidian';

/* ---------- decorations (CSS classes) ---------- */

export const selectedTextDecoration = Decoration.mark({
    class: 'found-occurrence',
    priority: 100,
});

export const keywordDecoration = Decoration.mark({
    class: 'keyword-occurrence',
    priority: 50,
});

/* ---------- tiny helpers ---------- */

/** Escape characters that have a special meaning in RegExp. */
function escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build a safe RegExp.
 * If `text` is a “pure” word (only A-Z, a-z, 0-9, _) and `wholeWord` is true,
 * wrap it in `\b … \b`.  Otherwise return the plain escaped text.
 */
function buildRegex(
    text: string,
    caseSensitive: boolean,
    wholeWord = true,
): RegExp {
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = escapeRegex(text);
    const needBoundary = wholeWord && /^\w+$/.test(text);
    return new RegExp(needBoundary ? `\\b${escaped}\\b` : escaped, flags);
}

/* ---------- live-highlight extension ---------- */

let foundCount = 0; // shown in the status bar

export function highlightOccurrenceExtension(plugin: OccuraPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            lastEnabled = plugin.settings.occuraPluginEnabled;
            lastAutoHL = plugin.settings.autoKeywordsHighlightEnabled;

            constructor(public view: EditorView) {
                this.decorations = this.buildDecorations();
            }

            update(u: ViewUpdate) {
                if (
                    u.selectionSet ||
                    u.docChanged ||
                    u.viewportChanged ||
                    plugin.settings.occuraPluginEnabled !== this.lastEnabled ||
                    plugin.settings.autoKeywordsHighlightEnabled !==
                    this.lastAutoHL
                ) {
                    this.decorations = this.buildDecorations();
                }
            }

            /* Scan the visible ranges and prepare the decoration set */
            private buildDecorations() {
                this.lastEnabled = plugin.settings.occuraPluginEnabled;
                this.lastAutoHL = plugin.settings.autoKeywordsHighlightEnabled;

                const { state } = this.view;
                const builder = new RangeSetBuilder<Decoration>();
                foundCount = 0;

                /* --- highlight the currently selected text --- */
                if (plugin.settings.occuraPluginEnabled) {
                    const sel = state.selection.main;
                    if (!sel.empty) {
                        const txt = state.doc.sliceString(sel.from, sel.to).trim();
                        if (txt && !/\s/.test(txt)) {
                            const re = buildRegex(
                                txt,
                                plugin.settings.occuraCaseSensitive,
                                /*wholeWord*/ false,
                            );
                            this.searchVisibleRanges(re, selectedTextDecoration, builder);
                            this.updateStatusBar(txt);
                        } else {
                            this.updateStatusBar('');
                        }
                    } else {
                        this.updateStatusBar('');
                    }
                }

                /* --- highlight keywords from the user list --- */
                if (
                    plugin.settings.occuraPluginEnabled &&
                    plugin.settings.autoKeywordsHighlightEnabled
                ) {
                    const words = plugin.settings.keywords
                        .map(k => k.trim())
                        .filter(k => k !== '');

                    if (words.length) {
                        const regexes = words.map(word =>
                            buildRegex(
                                word,
                                plugin.settings.keywordsCaseSensitive,
                                /*wholeWord*/ true,
                            ),
                        );
                        regexes.forEach(re =>
                            this.searchVisibleRanges(re, keywordDecoration, builder),
                        );
                    }
                }

                return builder.finish();
            }

            /* Search every visible range with `re` and add decorations to `builder`. */
            private searchVisibleRanges(
                re: RegExp,
                deco: Decoration,
                builder: RangeSetBuilder<Decoration>,
            ) {
                const { state } = this.view;
                for (const { from, to } of this.view.visibleRanges) {
                    const text = state.doc.sliceString(from, to);
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(text))) {
                        const start = from + m.index;
                        const end = start + m[0].length;
                        builder.add(start, end, deco);
                        foundCount++;
                    }
                }
            }

            /* Write “Occura found: …” into the status bar (or clear it). */
            private updateStatusBar(message: string) {
                if (
                    plugin.statusBarOccurrencesNumber &&
                    plugin.settings.statusBarOccurrencesNumberEnabled
                ) {
                    plugin.statusBarOccurrencesNumber.setText(
                        message ? `Occura found: ${message} ${foundCount} times` : '',
                    );
                }
            }
        },
        { decorations: v => v.decorations },
    );
}

//region Permanent highlight commands
/**
 * Permanently mark all occurrences of selected text using ==text== syntax
 */
export function setPermanentHighlightOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return new Notice('No active editor');

    const editor = view.editor;
    const sel = editor.getSelection().trim();
    if (!sel || /\s/.test(sel)) return new Notice('Select some text first.');

    const re = buildRegex(sel, /*caseSensitive*/ true, /*wholeWord*/ false);
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let m;
    while ((m = re.exec(doc))) matches.push({ from: m.index, to: m.index + m[0].length });

    if (!matches.length) return new Notice('No occurrences found.');

    const cm = (editor as any).cm as EditorView;
    const changes = matches
        .reverse()
        .map(r => ({ from: r.from, to: r.to, insert: `==${doc.slice(r.from, r.to)}==` }));
    cm.dispatch({ changes });
    new Notice(`Permanently highlighted ${matches.length} occurrences.`);
}

/**
 * Remove permanent ==text== highlighting for selected text
 */
export function removePermanentHighlightOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return new Notice('No active editor');

    const editor = view.editor;
    const sel = editor.getSelection().trim();
    if (!sel || /\s/.test(sel)) return new Notice('Select text to un-highlight.');

    const re = buildRegex(`==${sel}==`, /*caseSensitive*/ true, /*wholeWord*/ false);
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let m;
    while ((m = re.exec(doc))) matches.push({ from: m.index, to: m.index + m[0].length });

    if (!matches.length) return new Notice('No highlighted occurrences found.');

    const cm = (editor as any).cm as EditorView;
    const changes = matches.reverse().map(r => ({
        from: r.from,
        to: r.to,
        insert: doc.slice(r.from + 2, r.to - 2), // strip ==
    }));
    cm.dispatch({ changes });
    new Notice(`Removed highlighting from ${matches.length} occurrences.`);
}
//endregion Permanent highlight

//region Tag commands
/**
 * Add a '#' tag before each occurrence of the selected word
 */
export function createTagForOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return new Notice('No active editor');

    const editor = view.editor;
    const sel = editor.getSelection().trim();
    if (!sel || /\s/.test(sel)) return new Notice('Select one word to tag.');

    const re = buildRegex(sel, /*caseSensitive*/ true, /*wholeWord*/ true);
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let m;
    while ((m = re.exec(doc))) matches.push({ from: m.index, to: m.index + m[0].length });

    if (!matches.length) return new Notice('No occurrences found.');

    matches.reverse().forEach(r => {
        const from = editor.offsetToPos(r.from);
        const to = editor.offsetToPos(r.to);
        const word = editor.getRange(from, to);
        editor.replaceRange(`#${word}`, from, to);
    });
    new Notice(`Tagged ${matches.length} occurrences.`);
}

/**
 * Remove '#' tags from occurrences of the selected word
 */
export function removeTagFromOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return new Notice('No active editor');

    const editor = view.editor;
    const sel = editor.getSelection().trim();
    if (!sel || /\s/.test(sel)) return new Notice('Select the tagged word.');

    const re = buildRegex(`#${sel}`, /*caseSensitive*/ true, /*wholeWord*/ false);
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let m;
    while ((m = re.exec(doc))) matches.push({ from: m.index, to: m.index + m[0].length });

    if (!matches.length) return new Notice('No tagged occurrences found.');

    matches.reverse().forEach(r => {
        const from = editor.offsetToPos(r.from);
        const to = editor.offsetToPos(r.to);
        const text = editor.getRange(from, to).replace(/^#+/, '');
        editor.replaceRange(text, from, to);
    });
    new Notice(`Removed tags from ${matches.length} occurrences.`);
}
//endregion Tag commands