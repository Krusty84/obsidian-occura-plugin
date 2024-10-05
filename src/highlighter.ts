// highlighter.ts

import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from '@codemirror/view';
import {RangeSetBuilder} from '@codemirror/state';
import type HighlightOccurrencesPlugin from 'main';

// Create a decoration for highlighting
export const highlightDecoration = Decoration.mark({class: 'found-highlight'});
let iCount = 0;
// View plugin to handle highlighting occurrences
export function createHighlightPlugin(plugin: HighlightOccurrencesPlugin) {
    const statusBarItemEl = plugin.addStatusBarItem();
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            lastEnabledState: boolean;

            constructor(public view: EditorView) {
                this.lastEnabledState = plugin.settings.highlightEnabled;
                this.decorations = this.createDecorations();
            }

            update(update: ViewUpdate) {
                if (
                    update.selectionSet ||
                    update.docChanged ||
                    update.viewportChanged ||
                    plugin.settings.highlightEnabled !== this.lastEnabledState
                ) {
                    this.decorations = this.createDecorations();
                }
            }

            createDecorations() {
                this.lastEnabledState = plugin.settings.highlightEnabled;

                if (!plugin.settings.highlightEnabled) {
                    return Decoration.none;
                }

                const {state} = this.view;
                const selection = state.selection.main;

                // Return empty decorations if no selection or selection is empty
                if (selection.empty) return Decoration.none;

                const selectedText = state.doc.sliceString(selection.from, selection.to).trim();

                // Return empty decorations if selection is whitespace or empty
                if (!selectedText || /\s/.test(selectedText)) return Decoration.none;
                iCount = 0;
                const builder = new RangeSetBuilder<Decoration>();
                const regex = new RegExp(selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

                for (const {from, to} of this.view.visibleRanges) {
                    const text = state.doc.sliceString(from, to);
                    let match;
                    while ((match = regex.exec(text)) !== null) {
                        const start = from + match.index;
                        const end = start + match[0].length;
                        builder.add(start, end, highlightDecoration);
                        iCount++;
                    }
                }
                statusBarItemEl.setText(`${selectedText} found: ` + iCount);
                return builder.finish();
            }
        },
        {
            decorations: v => v.decorations,
        }
    );

}
