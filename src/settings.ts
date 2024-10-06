// settings.ts

import { App, PluginSettingTab, Setting } from 'obsidian';
import type OccuraPlugin from 'main';

// Define the settings interface
export interface OccuraPluginSettings {
    highlightColorOccurrences: string;
    occuraPluginEnabled: boolean;
    occuraPluginEnabledHotKey:string;
    statusBarOccurrencesNumberEnabled: boolean;
}

// Set default settings
export const DEFAULT_SETTINGS: OccuraPluginSettings = {
    highlightColorOccurrences: '#FFFF00', // Default highlight color (yellow)
    occuraPluginEnabled: true,
    occuraPluginEnabledHotKey:'',
    statusBarOccurrencesNumberEnabled: true,
};

// Settings tab for the plugin
export class OccuraPluginSettingTab extends PluginSettingTab {
    plugin: OccuraPlugin;

    constructor(app: App, plugin: OccuraPlugin) {
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
                    .setValue(this.plugin.settings.highlightColorOccurrences)
                    .onChange(async (value) => {
                        this.plugin.settings.highlightColorOccurrences = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });

    /*    new Setting(containerEl)
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
            });*/
        new Setting(containerEl)
            .setName('Hotkey')
            .setDesc('Set the hotkey for Toggle Highlight Occurrences')
            .addText(text => {
                text
                    .setPlaceholder('Mod+Shift+H')
                    .setValue(this.plugin.settings.occuraPluginEnabledHotKey)
                    .onChange(async (value) => {
                        this.plugin.settings.occuraPluginEnabledHotKey = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateKeyHandler();
                    });
            });

        new Setting(containerEl)
            .setName('Display the number of occurrences')
            .setDesc('Display the number of occurrences found in the Status bar')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.statusBarOccurrencesNumberEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.statusBarOccurrencesNumberEnabled = value;
                        await this.plugin.saveSettings();
                        // Force the editor to re-render
                        this.plugin.updateEditors();
                    });
            })
    }
}
