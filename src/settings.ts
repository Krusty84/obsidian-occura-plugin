// settings.ts

import { App, PluginSettingTab, Setting } from 'obsidian';
import type HighlightOccurrencesPlugin from './main';

// Define the settings interface
export interface HighlightOccurrencesSettings {
    highlightColor: string;
    highlightEnabled: boolean;
}

// Set default settings
export const DEFAULT_SETTINGS: HighlightOccurrencesSettings = {
    highlightColor: '#FFFF00', // Default highlight color (yellow)
    highlightEnabled: true,     // Highlighting is enabled by default
};

// Settings tab for the plugin
export class HighlightOccurrencesSettingTab extends PluginSettingTab {
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

        new Setting(containerEl)
            .setName('Enable Highlighting')
            .setDesc('Enable or disable highlighting of occurrences.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.highlightEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.highlightEnabled = value;
                        await this.plugin.saveSettings();
                        // Force the editor to re-render
                        this.plugin.updateEditors();
                    });
            });
    }
}
