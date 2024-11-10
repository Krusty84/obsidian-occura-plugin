// highlighter.ts

import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from '@codemirror/view';
import {RangeSetBuilder} from '@codemirror/state';
import type OccuraPlugin from 'main';
import {MarkdownView, Notice} from "obsidian";

// Create a decoration for highlighting
export const highlightDecoration = Decoration.mark({class: 'found-occurrence'});
let iFoundOccurCount = 0;

export function highlightOccurrenceExtension(plugin: OccuraPlugin) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            lastEnabledState: boolean;

            constructor(public view: EditorView) {
                this.lastEnabledState = plugin.settings.occuraPluginEnabled;
                this.decorations = this.createDecorations();
            }

            update(update: ViewUpdate) {
                if (
                    update.selectionSet ||
                    update.docChanged ||
                    update.viewportChanged ||
                    plugin.settings.occuraPluginEnabled !== this.lastEnabledState
                ) {
                    this.decorations = this.createDecorations();
                }
            }

            createDecorations() {
                this.lastEnabledState = plugin.settings.occuraPluginEnabled;

                if (!plugin.settings.occuraPluginEnabled) {
                    return Decoration.none;
                }

                const {state} = this.view;
                const selection = state.selection.main;

                // Return empty decorations if no selection or selection is empty
                if (selection.empty) {
                    if (plugin.statusBarOccurrencesNumber) {
                        if (plugin.settings.statusBarOccurrencesNumberEnabled)
                            plugin.statusBarOccurrencesNumber.setText("");
                    }
                    return Decoration.none;
                }

                const selectedText = state.doc.sliceString(selection.from, selection.to).trim();

                // Return empty decorations if selection is whitespace or empty
                if (!selectedText || /\s/.test(selectedText)) {
                    return Decoration.none;
                }
                iFoundOccurCount = 0;
                const builder = new RangeSetBuilder<Decoration>();
                const regex = new RegExp(selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

                for (const {from, to} of this.view.visibleRanges) {
                    const text = state.doc.sliceString(from, to);
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const start = from + match.index;
                        const end = start + match[0].length;
                        builder.add(start, end, highlightDecoration);
                        iFoundOccurCount++;
                    }
                }
                if (plugin.statusBarOccurrencesNumber) {
                    if (plugin.settings.statusBarOccurrencesNumberEnabled)
                        plugin.statusBarOccurrencesNumber.setText(`Occura found: ${selectedText} ` + iFoundOccurCount + ' times');
                }
                return builder.finish();
            }
        },
        {
            decorations: v => v.decorations,
        }
    );

}

//region set/remove permanent highlighting
export function setHighlightOccurrences(context:any) {
    const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice('No active editor');
        return;
    }

    const editor = activeView.editor;
    const selectedText = editor.getSelection().trim();

    if (!selectedText || /\s/.test(selectedText)) {
        new Notice('Please select some text to highlight.');
        return;
    }

    // Escape regex special characters
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedText, 'g');

    const docText = editor.getValue();
    const matches: { from: number; to: number }[] = [];

    let match;
    while ((match = regex.exec(docText)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No occurrences found.');
        return;
    }

    // Access the underlying EditorView
    const editorView = (editor as any).cm as EditorView;
    if (!editorView) {
        new Notice('Cannot access the editor view.');
        return;
    }

    // Prepare changes
    const changes = matches.reverse().map(range => ({
        from: range.from,
        to: range.to,
        insert: `==${docText.slice(range.from, range.to)}==`,
    }));

    // Apply all changes in a single transaction
    editorView.dispatch({
        changes,
    });

    new Notice(`Permanently highlighted ${matches.length} for ${selectedText} occurrences.`);
}
export function removeHighlightOccurrences(context:any) {
    const activeView = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
        new Notice('No active editor');
        return;
    }

    const editor = activeView.editor;
    const selectedText = editor.getSelection().trim();

    if (!selectedText || /\s/.test(selectedText)) {
        new Notice('Please select some text to remove highlighting from.');
        return;
    }

    // Construct the search pattern to find ==selectedText==
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `==${escapedText}==`;
    const regex = new RegExp(pattern, 'g');

    const docText = editor.getValue();
    const matches: { from: number; to: number }[] = [];

    let match;
    while ((match = regex.exec(docText)) !== null) {
        matches.push({ from: match.index, to: match.index + match[0].length });
    }

    if (matches.length === 0) {
        new Notice('No highlighted occurrences found.');
        return;
    }

    // Access the underlying EditorView
    const editorView = (editor as any).cm as EditorView;
    if (!editorView) {
        new Notice('Cannot access the editor view.');
        return;
    }

    // Prepare changes
    const changes = matches.reverse().map(range => {
        const originalText = docText.slice(range.from + 2, range.to - 2); // Remove the '==' from both ends
        return {
            from: range.from,
            to: range.to,
            insert: originalText,
        };
    });

    // Apply all changes in a single transaction
    editorView.dispatch({
        changes,
    });

    new Notice(`Removed highlighting from ${matches.length} occurrences of ${selectedText}.`);
}
//endregion