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

            private groupDecoCache = new Map<string, Decoration>();

            constructor(public view: EditorView) {
                this.decorations = this.buildDecorations();
            }

            update(u: ViewUpdate) {
                if (
                    u.selectionSet ||
                    u.docChanged ||
                    u.viewportChanged ||
                    plugin.settings.occuraPluginEnabled !== this.lastEnabled ||
                    plugin.settings.autoKeywordsHighlightEnabled !== this.lastAutoHL
                ) {
                    this.decorations = this.buildDecorations();
                }
            }

            private getGroupDecoration(groupId: string): Decoration {
                let deco = this.groupDecoCache.get(groupId);
                if (!deco) {
                    deco = Decoration.mark({
                        class: `occura-kw-${groupId}`,
                        priority: 50,
                    });
                    this.groupDecoCache.set(groupId, deco);
                }
                return deco;
            }

            private buildDecorations() {
                this.lastEnabled = plugin.settings.occuraPluginEnabled;
                this.lastAutoHL = plugin.settings.autoKeywordsHighlightEnabled;

                const matches: { from: number; to: number; deco: Decoration; startSide: number }[] = [];
                const addedSpans = new Set<string>();
                foundCount = 0;

                /* --- selected text occurrences --- */
                if (plugin.settings.occuraPluginEnabled) {
                    const { state } = this.view;
                    const sel = state.selection.main;
                    if (!sel.empty) {
                        const txt = state.doc.sliceString(sel.from, sel.to).trim();
                        if (txt && !/\s/.test(txt)) {
                            const re = buildRegex(txt, plugin.settings.occuraCaseSensitive, false);
                            this.collectVisibleMatches(re, selectedTextDecoration, matches, addedSpans);
                            this.updateStatusBar(txt);
                        } else {
                            this.updateStatusBar('');
                        }
                    } else {
                        this.updateStatusBar('');
                    }
                }

                /* --- class-based keywords --- */
                if (
                    plugin.settings.occuraPluginEnabled &&
                    plugin.settings.autoKeywordsHighlightEnabled &&
                    Array.isArray(plugin.settings.keywordGroups)
                ) {
                    for (const group of plugin.settings.keywordGroups) {
                        if (!group?.enabled) continue;

                        const words = (group.keywords ?? [])
                            .map(w => w.trim())
                            .filter(Boolean);

                        if (words.length === 0) continue;

                        const deco = this.getGroupDecoration(group.id);
                        for (const w of words) {
                            const re = buildRegex(w, !!group.caseSensitive, true);
                            this.collectVisibleMatches(re, deco, matches, addedSpans);
                        }
                    }
                }

                /* --- sort THEN add to builder --- */
                matches.sort((a, b) => (a.from - b.from) || (a.startSide - b.startSide) || (a.to - b.to));

                const builder = new RangeSetBuilder<Decoration>();
                for (const m of matches) builder.add(m.from, m.to, m.deco);

                return builder.finish();
            }

            /** Collect matches (do not add directly). Keeps them sorted later. */
            private collectVisibleMatches(
                re: RegExp,
                deco: Decoration,
                out: { from: number; to: number; deco: Decoration; startSide: number }[],
                addedSpans: Set<string>,
            ) {
                const startSide = (deco as any)?.spec?.startSide ?? 0; // default 0
                const { state } = this.view;

                for (const { from, to } of this.view.visibleRanges) {
                    const text = state.doc.sliceString(from, to);
                    re.lastIndex = 0; // important for /g
                    let m: RegExpExecArray | null;
                    while ((m = re.exec(text))) {
                        const s = from + m.index;
                        const e = s + m[0].length;
                        const key = `${s}:${e}`;
                        if (addedSpans.has(key)) continue; // avoid duplicate exact spans
                        addedSpans.add(key);
                        out.push({ from: s, to: e, deco, startSide });
                        foundCount++;
                    }
                }
            }

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