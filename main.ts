import { App, Plugin, MarkdownView, Notice, WorkspaceLeaf, setIcon } from 'obsidian';
import { Compartment } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {HighlightOccurrencesSettingTab, HighlightOccurrencesSettings, DEFAULT_SETTINGS} from 'src/settings'
import {createHighlightPlugin} from 'src/highlighter'


export default class HighlightOccurrencesPlugin extends Plugin {
    settings: HighlightOccurrencesSettings;
    styleEl: HTMLStyleElement;
    highlightCompartment: Compartment;

    async onload() {
        await this.loadSettings();

        // Initialize the compartment for the highlighting extension
        this.highlightCompartment = new Compartment();

        // Add the settings tab
        this.addSettingTab(new HighlightOccurrencesSettingTab(this.app, this));

        // Register the editor extension with the compartment
        this.registerEditorExtension(this.highlightCompartment.of(createHighlightPlugin(this)));

        // Register click event to clear selection when clicking outside
        this.registerDomEvent(document, 'click', this.handleDocumentClick.bind(this));

        // Add custom CSS for highlighting
        this.updateHighlightStyle();

        // Register command to toggle highlighting
        this.addCommand({
            id: 'toggle-highlight-occurrences',
            name: 'Toggle Highlight Occurrences',
            callback: () => {
                this.toggleHighlighting();
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

    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    // Toggle highlighting functionality
    toggleHighlighting() {
        this.settings.highlightEnabled = !this.settings.highlightEnabled;
        this.saveSettings();
        // Force the editor to re-render
        this.updateEditors();
        // Update the icon in the title bar
        this.updateAllTitleBarIcons();
        // Optional: Show a notice
        new Notice(`Highlighting ${this.settings.highlightEnabled ? 'enabled' : 'disabled'}`);
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

    // Method to update the highlight style based on settings
    updateHighlightStyle() {
        if (this.styleEl) {
            this.styleEl.remove();
        }
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = `.found-highlight {background-color: ${this.settings.highlightColor};}
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
                    effects: this.highlightCompartment.reconfigure(createHighlightPlugin(this))
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
        // Add appropriate icon
        if (this.settings.highlightEnabled) {
            iconEl.setAttribute('aria-label', 'Disable Highlighting');
            setIcon(iconEl, 'highlighter');
        } else {
            iconEl.setAttribute('aria-label', 'Enable Highlighting');
            setIcon(iconEl, 'highlighter');
            // Apply a disabled style
            iconEl.style.opacity = '0.5';
        }
    }

    onunload() {
        // Clean up the style element when the plugin is unloaded
        if (this.styleEl) {
            this.styleEl.remove();
        }

        // Remove the icon from all title bars
        const icons = document.querySelectorAll('.highlight-toggle-icon');
        icons.forEach(icon => icon.remove());
    }
}




