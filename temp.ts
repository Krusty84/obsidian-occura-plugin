import { App, Plugin, PluginSettingTab, Setting, MarkdownView, Notice, Keymap } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewUpdate, ViewPlugin } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Define the settings interface
interface HighlightOccurrencesSettings {
    highlightColor: string;
}

const DEFAULT_SETTINGS: HighlightOccurrencesSettings = {
    highlightColor: '#FFFF00', // Default highlight color (yellow)
};

export default class HighlightOccurrencesPlugin extends Plugin {
    settings: HighlightOccurrencesSettings;
    styleEl: HTMLStyleElement;
    highlightPlugin: ViewPlugin<any>;
    isHighlightActive: boolean = false;

    async onload() {
        await this.loadSettings();

        // Add the settings tab
        this.addSettingTab(new HighlightOccurrencesSettingTab(this.app, this));

        // Register the command with a default hotkey
        this.addCommand({
            id: 'highlight-occurrences',
            name: 'Highlight Occurrences of Selected Text',
            editorCallback: (editor, view) => this.highlightOccurrences(),
            hotkeys: [
                {
                    modifiers: ['Mod', 'Shift'],
                    key: 'H',
                },
            ],
        });

        // Add custom CSS for highlighting
        this.updateHighlightStyle();

        // Register click event to clear highlights when clicking outside
        this.registerDomEvent(document, 'click', this.handleDocumentClick.bind(this));
    }

    onunload() {
        // Clean up the style element when the plugin is unloaded
        if (this.styleEl) {
            this.styleEl.remove();
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Method to update the highlight style based on settings
    updateHighlightStyle() {
        if (this.styleEl) {
            this.styleEl.remove();
        }
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = `
      .my-highlight {
        background-color: ${this.settings.highlightColor};
      }
    `;
        document.head.appendChild(this.styleEl);
    }

    // Method to clear highlights when clicking outside the editor
    private handleDocumentClick(evt: MouseEvent) {
        const target = evt.target as HTMLElement;
        if (!target.closest('.cm-content')) {
            this.clearHighlights();
        }
    }

    // Method to highlight occurrences
    private highlightOccurrences() {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const editor = view.editor;
        const selectedText = editor.getSelection().trim();

        if (!selectedText || /\s/.test(selectedText)) {
            new Notice('Please select some text without whitespace.');
            return;
        }

        // Clear existing highlights
        this.clearHighlights();

        // Create the ViewPlugin to handle the highlighting
        this.highlightPlugin = this.createHighlightPlugin(selectedText);

        // Apply the ViewPlugin
        const cmEditor = view.editor.cm as EditorView;
        cmEditor.dispatch({
            effects: EditorView.decorations.of(this.highlightPlugin.decorations),
        });

        this.isHighlightActive = true;
    }

    // Method to clear highlights
    private clearHighlights() {
        if (!this.isHighlightActive) return;

        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return;

        const cmEditor = view.editor.cm as EditorView;

        // Remove the highlight decorations
        cmEditor.dispatch({
            effects: EditorView.decorations.of(Decoration.none),
        });

        this.isHighlightActive = false;
    }

    // Method to create the highlight plugin
    private createHighlightPlugin(selectedText: string) {
        const highlightDecoration = Decoration.mark({ class: 'my-highlight' });

        return ViewPlugin.fromClass(
            class {
                decorations: DecorationSet;

                constructor(public view: EditorView) {
                    this.decorations = this.createDecorations(view.state);
                }

                update(update: ViewUpdate) {
                    if (update.docChanged || update.viewportChanged) {
                        this.decorations = this.createDecorations(update.state);
                    }
                }

                createDecorations(state) {
                    const builder = new RangeSetBuilder<Decoration>();
                    const regex = new RegExp(selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

                    for (const { from, to } of state.visibleRanges) {
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
                decorations: (v) => v.decorations,
            }
        );
    }
}

// Settings tab for the plugin
class HighlightOccurrencesSettingTab extends PluginSettingTab {
    plugin: HighlightOccurrencesPlugin;

    constructor(app: App, plugin: HighlightOccurrencesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName('Highlight Color')
            .setDesc('Set the color used to highlight occurrences.')
            .addText((text) => {
                text.inputEl.type = 'color';
                text
                    .setValue(this.plugin.settings.highlightColor)
                    .onChange(async (value) => {
                        this.plugin.settings.highlightColor = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });
    }
}
