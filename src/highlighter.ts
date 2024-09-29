import {EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin} from '@codemirror/view';
import {RangeSetBuilder} from '@codemirror/state';

// Create a decoration for highlighting
const highlightDecoration = Decoration.mark({class: 'my-highlight88'});

export const highlightOccurrencesExtension = ViewPlugin.fromClass(
    class {
        decorations: DecorationSet;

        constructor(public view: EditorView) {
            this.decorations = this.createDecorations();
        }

        update(update: ViewUpdate) {
            if (update.selectionSet || update.docChanged || update.viewportChanged) {
                this.decorations = this.createDecorations();
            }
        }

        createDecorations() {
            const {state} = this.view;
            const selection = state.selection.main;
            if (selection.empty) return Decoration.none;
            const selectedText = state.doc.sliceString(selection.from, selection.to).trim();
            if (!selectedText || /\s/.test(selectedText)) return Decoration.none;
            const builder = new RangeSetBuilder<Decoration>();
            const regex = new RegExp(selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            for (const {from, to} of this.view.visibleRanges) {
                const text = state.doc.sliceString(from, to);
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const start = from + match.index;
                    const end = start + match[0].length;
                    builder.add(start, end, highlightDecoration);
                }
            }
            return builder.finish();
        }
    },
    {
        decorations: v => v.decorations,
    }
);