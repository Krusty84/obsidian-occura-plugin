import {Plugin, MarkdownView, Notice, WorkspaceLeaf, setIcon, setTooltip} from 'obsidian';
import {Compartment} from '@codemirror/state';
import {EditorView} from '@codemirror/view';
import {OccuraPluginSettingTab, OccuraPluginSettings, DEFAULT_SETTINGS} from 'src/settings'
import {
    highlightOccurrenceExtension,
    setPermanentHighlightOccurrences,
    removePermanentHighlightOccurrences, removeTagFromOccurrences, createTagForOccurrences,
} from 'src/highlighter'
import {parseHotkeyString} from 'src/utils'

export default class OccuraPlugin extends Plugin {
    settings: OccuraPluginSettings;
    styleEl: HTMLStyleElement;
    highlightCompartment: Compartment;
    statusBarOccurrencesNumber: any;
    keyHandler: (evt: KeyboardEvent) => void;

    async onload() {
        await this.loadSettings();
        // Initialize the compartment for the highlighting extension
        this.highlightCompartment = new Compartment();

        // Add the settings tab
        this.addSettingTab(new OccuraPluginSettingTab(this.app, this));

        // Register the editor extension with the compartment
        this.registerEditorExtension(this.highlightCompartment.of(highlightOccurrenceExtension(this)));

        // Register click event to clear selection when clicking outside
        // (It has been removed based on PR- "Multiple Conflicts #8" (by BlackUdon) in 1.3.1 version)
        //this.registerDomEvent(document, 'click', this.handleDocumentClick.bind(this));

        // Add custom CSS for highlighting
        this.updateHighlightStyle();

        // Register command to toggle highlighting
        this.addCommand({
            id: 'toggle-highlight-occurrences',
            name: 'Toggle highlight occurrences',
            callback: () => {
                this.toggleHighlighting();
            }
        });

        this.addCommand({
            id: 'toggle-keyword-highlighting',
            name: 'Toggle keyword highlighting',
            callback: () => {
                this.toggleKeywordHighlighting();
            }
        });

        this.addCommand({
            id: 'set-permanent-highlight-occurrences',
            name: 'Set permanently highlight for occurrences',
            callback: () => {
                if(this.settings.occuraPluginEnabled ){
                    setPermanentHighlightOccurrences(this);
                } else {
                    new Notice('Please enable Occura');
                }
            },
        });

        this.addCommand({
            id: 'remove-permanent-highlight-occurrences',
            name: 'Remove permanently highlight for occurrences',
            callback: () => {
                if(this.settings.occuraPluginEnabled ){
                    removePermanentHighlightOccurrences(this);
                } else {
                    new Notice('Please enable Occura');
                }
            },
        });

        this.addCommand({
            id: 'create-tag-for-occurrences',
            name: 'Create Tag for occurrences',
            callback: () => {
                if(this.settings.occuraPluginEnabled ){
                    createTagForOccurrences(this);
                } else {
                    new Notice('Please enable Occura');
                }
            },
        });

        this.addCommand({
            id: 'remove-tag-from-occurrences',
            name: 'Remove Tag for occurrences',
            callback: () => {
                if(this.settings.occuraPluginEnabled ){
                    removeTagFromOccurrences(this);
                } else {
                    new Notice('Please enable Occura');
                }
            },
        });


        // Add icon to the editor title bar when a new leaf is created
        this.registerEvent(
            this.app.workspace.on('layout-change', () => {
                this.addIconsToAllLeaves();
            })
        );

        // Initial addition of the icon to all leaves
        this.addIconsToAllLeaves();
        // Initialize the key handler
        this.updateKeyHandler();
    }

    updateKeyHandler() {
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler, true);
        }

        const hotkey = parseHotkeyString(this.settings.occuraPluginEnabledHotKey);

        this.keyHandler = (evt: KeyboardEvent) => {
            const evtKey = evt.key.toUpperCase();

            // Normalize special keys (e.g., "ArrowUp" -> "UP")
            const normalizedKey = evtKey.replace('ARROW', '');

            const modifiersMatch =
                evt.ctrlKey === hotkey.modifiers.ctrlKey &&
                evt.shiftKey === hotkey.modifiers.shiftKey &&
                evt.altKey === hotkey.modifiers.altKey &&
                evt.metaKey === hotkey.modifiers.metaKey;

            if (modifiersMatch && normalizedKey === hotkey.key) {
                evt.preventDefault();
                evt.stopPropagation();
                this.toggleHighlighting();
                return false;
            }
        };

        window.addEventListener('keydown', this.keyHandler, true);
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Toggle highlighting functionality
    toggleHighlighting() {
        this.settings.occuraPluginEnabled = !this.settings.occuraPluginEnabled;
        this.saveSettings();
        // Force the editor to re-render
        this.updateEditors();
        // Update the icon in the title bar
        this.updateAllTitleBarIcons();
        // Optional: Show a notice
        //new Notice(`Occura ${this.settings.occuraPluginEnabled ? 'enabled' : 'disabled'}`);
    }
    // Toggle keywords highlighting functionality
    toggleKeywordHighlighting() {
        this.settings.autoKeywordsHighlightEnabled = !this.settings.autoKeywordsHighlightEnabled;
        this.saveSettings();
        // Force the editor to re-render
        this.updateEditors();
        // Optional: Show a notice
        //new Notice(`Keyword highlighting ${this.settings.autoKeywordsHighlightEnabled ? 'enabled' : 'disabled'}`);
    }

    // Clear selection when clicking outside the editor
    private handleDocumentClick(evt: MouseEvent) {
        const target = evt.target as HTMLElement;
        if (!target.closest('.cm-content')) {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view) {
                view.editor.setCursor(view.editor.getCursor()); // Clear selection
            }
        }
    }

    // Method to dynamic update the highlight style based on settings
    updateHighlightStyle() {
        if (this.styleEl) {
            this.styleEl.remove();
        }
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = `
        .found-occurrence {background-color: ${this.settings.highlightColorOccurrences};}
        .keyword-occurrence { background-color: ${this.settings.highlightColorKeywords}; }
    `;
        document.head.appendChild(this.styleEl);
    }

    // Force all editors to update
    updateEditors() {
        const markdownViews = this.app.workspace.getLeavesOfType('markdown')
            .map(leaf => leaf.view)
            .filter(view => view instanceof MarkdownView) as MarkdownView[];
        for (const view of markdownViews) {
            // Get the CodeMirror EditorView instance
            const editorView = (view.editor as any).cm as EditorView;
            if (editorView) {
                // Reconfigure the compartment with the updated plugin
                editorView.dispatch({
                    effects: this.highlightCompartment.reconfigure(highlightOccurrenceExtension(this))
                });
            }
        }
    }

    // Add icons to all Markdown views
    addIconsToAllLeaves() {
        const markdownLeaves = this.app.workspace.getLeavesOfType('markdown');
        for (const leaf of markdownLeaves) {
            this.addTitleBarIcon(leaf);
        }
    }

    // Add an icon to the editor's title bar
    addTitleBarIcon(leaf: WorkspaceLeaf) {
        if (!(leaf.view instanceof MarkdownView)) return;
        const view = leaf.view as MarkdownView;
        // Remove existing icon if any
        const existingIcon = view.containerEl.querySelector('.highlight-toggle-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        // Create the icon element
        const iconEl = document.createElement('div');
        iconEl.addClass('highlight-toggle-icon', 'clickable-icon');

        // Set the icon based on the current state
        this.updateIconElement(iconEl);

        // Add click handler
        iconEl.addEventListener('click', () => {
            this.toggleHighlighting();
        });

        // Add the icon to the title bar
        const titleBar = view.containerEl.querySelector('.view-header');
        if (titleBar) {
            // Insert the icon before the other icons
            const iconContainer = titleBar.querySelector('.view-actions');
            if (iconContainer) {
                iconContainer.insertBefore(iconEl, iconContainer.firstChild);
            }
        }
    }

    // Update all icons in the title bars
    updateAllTitleBarIcons() {
        const iconEls = document.querySelectorAll('.highlight-toggle-icon');
        iconEls.forEach(iconEl => {
            this.updateIconElement(iconEl as HTMLElement);
        });
    }

    // Update the icon element based on the current state
    updateIconElement(iconEl: HTMLElement) {
        // Remove existing icon classes
        iconEl.empty();
        setIcon(iconEl, 'highlighter');

        if (this.settings.occuraPluginEnabled) {
            // If we've never added the status bar item, do it now
            if (!this.statusBarOccurrencesNumber) {
                this.statusBarOccurrencesNumber = this.addStatusBarItem();
            }
            setTooltip(iconEl, 'Disable highlighting');
            iconEl.removeClass('is-disabled');
        } else {
            setTooltip(iconEl, 'Enable highlighting');
            iconEl.addClass('is-disabled');
        }
    }

    onunload() {
        window.removeEventListener('keydown', this.keyHandler, true);
        // Clean up the style element when the plugin is unloaded
        if (this.styleEl) {
            this.styleEl.remove();
        }
        // Remove the icon from all title bars
        const icons = document.querySelectorAll('.highlight-toggle-icon');
        icons.forEach(icon => icon.remove());
    }
}




