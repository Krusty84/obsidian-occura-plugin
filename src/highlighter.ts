import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import type OccuraPlugin from 'main';
import { MarkdownView, Notice } from 'obsidian';

// Decoration for selected text highlights (e.g., search matches)
export const selectedTextDecoration = Decoration.mark({
    class: 'found-occurrence', // CSS class for styling
    priority: 100,             // Higher priority so it appears above others
});

// Decoration for keyword highlights from the user list
export const keywordDecoration = Decoration.mark({
    class: 'keyword-occurrence', // CSS class for styling keywords
    priority: 50,                // Lower priority than selected text
});

// Global count of found occurrences (used in status bar)
let iFoundOccurCount = 0;

/**
 * Main extension to highlight occurrences and keywords in the editor.
 * @param plugin - the main plugin instance for accessing settings and state
 */
export function highlightOccurrenceExtension(plugin: OccuraPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;            // holds the active decorations
            lastOccuraPluginEnabledState: boolean; // track last "enabled" state
            lastAutoKeywordsHighlightEnabledState: boolean; // track last "auto highlight" state

            constructor(public view: EditorView) {
                // Save initial setting states
                this.lastOccuraPluginEnabledState = plugin.settings.occuraPluginEnabled;
                this.lastAutoKeywordsHighlightEnabledState = plugin.settings.autoKeywordsHighlightEnabled;
                // Create initial decorations
                this.decorations = this.createDecorations();
            }

            /**
             * Called when the editor updates (selection, content, or viewport changes)
             */
            update(update: ViewUpdate) {
                // If something relevant changed or settings toggled, rebuild decorations
                if (
                    update.selectionSet ||
                    update.docChanged ||
                    update.viewportChanged ||
                    plugin.settings.occuraPluginEnabled !== this.lastOccuraPluginEnabledState ||
                    plugin.settings.autoKeywordsHighlightEnabled !== this.lastAutoKeywordsHighlightEnabledState
                ) {
                    this.decorations = this.createDecorations();
                }
            }

            /**
             * Scan the visible document range and create decorations for matches
             */
            createDecorations() {
                // Update our saved setting states
                this.lastOccuraPluginEnabledState = plugin.settings.occuraPluginEnabled;
                this.lastAutoKeywordsHighlightEnabledState = plugin.settings.autoKeywordsHighlightEnabled;

                const { state } = this.view;
                const matches: { from: number; to: number; decoration: Decoration }[] = [];
                iFoundOccurCount = 0; // reset counter each time

                // --- Dynamically Highlight selected text ---
                if (plugin.settings.occuraPluginEnabled) {
                    const selection = state.selection.main;

                    // Only proceed if there is a non-empty selection
                    if (!selection.empty) {
                        const selectedText = state.doc
                            .sliceString(selection.from, selection.to)
                            .trim();

                        // Make sure the selected text is a single word or phrase (no spaces-only)
                        if (selectedText && !/\s/.test(selectedText)) {
                            //case sensitive/insensitive option
                            const flags = plugin.settings.occuraCaseSensitive ? 'g' : 'gi';
                            // Escape special regex chars and create a global regex
                            const regex = new RegExp(
                                selectedText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&'),
                                flags
                            );

                            // Search in each visible range
                            for (const { from, to } of this.view.visibleRanges) {
                                const text = state.doc.sliceString(from, to);
                                let match;
                                while ((match = regex.exec(text)) !== null) {
                                    const start = from + match.index;
                                    const end = start + match[0].length;
                                    matches.push({ from: start, to: end, decoration: selectedTextDecoration });
                                    iFoundOccurCount++;
                                }
                            }

                            // Update status bar with count if enabled
                            if (
                                plugin.statusBarOccurrencesNumber &&
                                plugin.settings.statusBarOccurrencesNumberEnabled
                            ) {
                                plugin.statusBarOccurrencesNumber.setText(
                                    `Occura found: ${selectedText} ${iFoundOccurCount} times`
                                );
                            }
                        } else {
                            // Clear status bar if text is empty or just spaces
                            if (
                                plugin.statusBarOccurrencesNumber &&
                                plugin.settings.statusBarOccurrencesNumberEnabled
                            ) {
                                plugin.statusBarOccurrencesNumber.setText('');
                            }
                        }
                    } else {
                        // Clear status bar when nothing is selected
                        if (
                            plugin.statusBarOccurrencesNumber &&
                            plugin.settings.statusBarOccurrencesNumberEnabled
                        ) {
                            plugin.statusBarOccurrencesNumber.setText('');
                        }
                    }
                }

                // --- Highlight keywords from list ---
                if (
                    plugin.settings.occuraPluginEnabled &&
                    plugin.settings.autoKeywordsHighlightEnabled &&
                    plugin.settings.keywords.length > 0
                ) {
                    // Filter out empty keywords
                    const keywords = plugin.settings.keywords.filter(k => k.trim() !== '');
                    if (keywords.length > 0) {
                        // Build regex for each keyword, respect case sensitivity
                        const flags = plugin.settings.keywordsCaseSensitive ? 'g' : 'gi';
                        const regexList = keywords.map(word => {
                            const esc = word.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
                            return new RegExp(`\\b${esc}\\b`, flags);
                        });

                        // Search each visible range for each keyword
                        for (const { from, to } of this.view.visibleRanges) {
                            const text = state.doc.sliceString(from, to);
                            regexList.forEach(regex => {
                                let match;
                                while ((match = regex.exec(text)) !== null) {
                                    const start = from + match.index;
                                    const end = start + match[0].length;
                                    matches.push({ from: start, to: end, decoration: keywordDecoration });
                                }
                            });
                        }
                    }
                }

                // Sort matches by position to avoid overlap issues
                matches.sort((a, b) => a.from - b.from);

                // Build a decoration set from sorted ranges
                const builder = new RangeSetBuilder<Decoration>();
                for (const m of matches) {
                    builder.add(m.from, m.to, m.decoration);
                }
                return builder.finish();
            }
        },
        { decorations: v => v.decorations } // tell CodeMirror where to get decorations
    );
}

//region Permanent highlight commands
/**
 * Permanently mark all occurrences of selected text using ==text== syntax
 */
export function setPermanentHighlightOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        new Notice('No active editor');
        return;
    }

    const editor = view.editor;
    const selText = editor.getSelection().trim();
    // Only single words or phrases without spaces
    if (!selText || /\s/.test(selText)) {
        new Notice('Please select some text to highlight.');
        return;
    }

    // Create a regex to find all matches
    const esc = selText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const regex = new RegExp(esc, 'g');
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let match;
    while ((match = regex.exec(doc)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No occurrences found.');
        return;
    }

    // Get the low-level EditorView to dispatch changes
    const cmView = (editor as any).cm as EditorView;
    if (!cmView) {
        new Notice('Cannot access the editor view.');
        return;
    }

    // Prepare insertions in reverse order to keep positions valid
    const changes = matches.reverse().map(r => ({
        from: r.from,
        to: r.to,
        insert: `==${doc.slice(r.from, r.to)}==`,
    }));

    // Apply all changes in one go
    cmView.dispatch({ changes });
    new Notice(`Permanently highlighted ${matches.length} occurrences.`);
}

/**
 * Remove permanent ==text== highlighting for selected text
 */
export function removePermanentHighlightOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        new Notice('No active editor');
        return;
    }

    const editor = view.editor;
    const selText = editor.getSelection().trim();
    if (!selText || /\s/.test(selText)) {
        new Notice('Please select some text to remove highlighting from.');
        return;
    }

    // Build pattern to match ==text==
    const esc = selText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const pattern = `==${esc}==`;
    const regex = new RegExp(pattern, 'g');
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let match;
    while ((match = regex.exec(doc)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No highlighted occurrences found.');
        return;
    }

    const cmView = (editor as any).cm as EditorView;
    if (!cmView) {
        new Notice('Cannot access the editor view.');
        return;
    }

    // Reverse and replace ==text== with the original text
    const changes = matches.reverse().map(r => {
        const original = doc.slice(r.from + 2, r.to - 2);
        return { from: r.from, to: r.to, insert: original };
    });

    cmView.dispatch({ changes });
    new Notice(`Removed highlighting from ${matches.length} occurrences.`);
}
//endregion Permanent highlight

//region Tag commands
/**
 * Add a '#' tag before each occurrence of the selected word
 */
export function createTagForOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        new Notice('No active editor');
        return;
    }

    const editor = view.editor;
    const selText = editor.getSelection().trim();
    if (!selText || /\s/.test(selText)) {
        new Notice('Please select a single word to tag.');
        return;
    }

    // Match whole words using word boundaries
    const esc = selText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${esc}\\b`, 'g');
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let match;
    while ((match = regex.exec(doc)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No occurrences found.');
        return;
    }

    // Insert tags from end to start to keep positions valid
    matches.reverse().forEach(range => {
        const fromPos = editor.offsetToPos(range.from);
        const toPos = editor.offsetToPos(range.to);
        const word = editor.getRange(fromPos, toPos);
        editor.replaceRange(`#${word}`, fromPos, toPos);
    });

    new Notice(`Tagged ${matches.length} occurrences.`);
}

/**
 * Remove '#' tags from occurrences of the selected word
 */
export function removeTagFromOccurrences(context: any) {
    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        new Notice('No active editor');
        return;
    }

    const editor = view.editor;
    const selText = editor.getSelection().trim();
    if (!selText || /\s/.test(selText)) {
        new Notice('Please select the tagged word to remove tags from.');
        return;
    }

    // Match words preceded by '#'
    const esc = selText.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
    const regex = new RegExp(`#\\b${esc}\\b`, 'g');
    const doc = editor.getValue();
    const matches: { from: number; to: number }[] = [];
    let match;
    while ((match = regex.exec(doc)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No tagged occurrences found.');
        return;
    }

    // Remove tags from end to start to avoid shifting
    matches.reverse().forEach(range => {
        const fromPos = editor.offsetToPos(range.from);
        const toPos = editor.offsetToPos(range.to);
        const text = editor.getRange(fromPos, toPos).replace(/^#+/, '');
        editor.replaceRange(text, fromPos, toPos);
    });

    new Notice(`Removed tags from ${matches.length} occurrences.`);
}
//endregion Tag commands