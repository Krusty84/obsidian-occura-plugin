// highlighter.ts

import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from '@codemirror/view';
import {RangeSetBuilder} from '@codemirror/state';
import type OccuraPlugin from 'main';

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
                if (selection.empty) return Decoration.none;

                const selectedText = state.doc.sliceString(selection.from, selection.to).trim();

                // Return empty decorations if selection is whitespace or empty
                if (!selectedText || /\s/.test(selectedText)) return Decoration.none;
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
                if (plugin.statusBarOccurrencesNumber){
                    plugin.statusBarOccurrencesNumber.setText(`Occura found: ${selectedText} ` + iFoundOccurCount+' times');
                }
                return builder.finish();
            }
        },
        {
            decorations: v => v.decorations,
        }
    );

}
