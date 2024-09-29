import {App, PluginSettingTab, Setting} from "obsidian";
import OccuraPlugin from "../main";

export interface OccuraPluginSettings {
    highlightColor: string;
}

// @ts-ignore
export const DEFAULT_SETTINGS: OccuraPluginSettings = {
    highlightColor: '#FFFF00',
}

export class OccuraPluginSettingTab
    extends PluginSettingTab {
    plugin: OccuraPlugin;

    constructor(app: App, plugin: OccuraPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const {containerEl} = this;
        containerEl.empty();
        new Setting(containerEl)
            .setName('Highlight Color')
            .setDesc('Set the color used to highlight occurrences.')
            .addText(text => {
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