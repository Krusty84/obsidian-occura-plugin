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

        new Setting(containerEl)
            .setName('Hotkey')
            .setDesc('Click and press the desired hotkey combination')
            .addText(text => {
                text
                    .setPlaceholder('Click and press hotkey')
                    .setValue(this.plugin.settings.occuraPluginEnabledHotKey);

                // Add focus event listener to clear the input when focused
                text.inputEl.addEventListener('focus', () => {
                    text.inputEl.value = '';
                });

                // Add blur event listener to restore the hotkey if input is empty
                text.inputEl.addEventListener('blur', () => {
                    if (!text.inputEl.value) {
                        text.setValue(this.plugin.settings.occuraPluginEnabledHotKey);
                    }
                });

                // Add keydown listener to capture hotkey
                text.inputEl.addEventListener('keydown', async (event: KeyboardEvent) => {
                    event.preventDefault();
                    event.stopPropagation();

                    const hotkey = this.captureHotkey(event);
                    text.setValue(hotkey);

                    // Update plugin settings
                    this.plugin.settings.occuraPluginEnabledHotKey = hotkey;
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

    // Helper method to capture hotkey from event
    captureHotkey(event: KeyboardEvent): string {
        const keys = [];

        if (event.ctrlKey || event.metaKey) keys.push('Mod');
        if (event.shiftKey) keys.push('Shift');
        if (event.altKey) keys.push('Alt');

        const key = event.key.toUpperCase();

        // Exclude modifier keys themselves
        if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
            keys.push(key);
        }

        return keys.join('+');
    }
}
