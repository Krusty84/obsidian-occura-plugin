import {
     MarkdownView, Plugin
} from 'obsidian';
import {OccuraPluginSettingTab, OccuraPluginSettings, DEFAULT_SETTINGS} from 'src/settings'
import {highlightOccurrencesExtension} from 'src/highlighter'


export default class OccuraPlugin extends Plugin {
    settings: OccuraPluginSettings;
    styleEl: HTMLStyleElement;

    async onload() {
        await this.loadSettings();
        console.log("Hi, This is Occura Plugin!");
        //Register the view plugin
        this.registerEditorExtension(highlightOccurrencesExtension);
        this.addSettingTab(new OccuraPluginSettingTab
        (this.app, this));
        //Event to clear selection when clicking outside
        this.registerDomEvent(document, 'click', this.handleDocumentClick.bind(this));
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

    onunload() {
        console.log("Good Bye!");
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    updateHighlightStyle() {
        if (this.styleEl) {
            this.styleEl.remove();
        }
        this.styleEl = document.createElement('style');
        this.styleEl.textContent = `.my-highlight88 {background-color: ${this.settings.highlightColor};}`;
        document.head.appendChild(this.styleEl);
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}



