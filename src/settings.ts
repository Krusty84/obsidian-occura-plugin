import {App, ButtonComponent, PluginSettingTab, Setting, TextComponent} from 'obsidian';
import type OccuraPlugin from 'main';

// Define the settings interface
export interface OccuraPluginSettings {
    highlightColorOccurrences: string;
    highlightColorKeywords: string;
    occuraPluginEnabled: boolean;
    occuraPluginEnabledHotKey:string;
    statusBarOccurrencesNumberEnabled: boolean;
    keywords: string[],
    autoKeywordsHighlightEnabled:boolean,
    keywordsCaseSensitive: boolean;
}

// Set default settings
export const DEFAULT_SETTINGS: OccuraPluginSettings = {
    highlightColorOccurrences: '#FFFF00', // Default highlight color (yellow)
    highlightColorKeywords: '#bdfc64',
    occuraPluginEnabled: true,
    occuraPluginEnabledHotKey:'',
    statusBarOccurrencesNumberEnabled: true,
    keywords: [],
    autoKeywordsHighlightEnabled:false,
    keywordsCaseSensitive: false,
};

// Settings tab for the plugin
export class OccuraPluginSettingTab extends PluginSettingTab {
    plugin: OccuraPlugin;
    keywordComponents: TextComponent[] = [];
    constructor(app: App, plugin: OccuraPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();
        containerEl.createEl('h2', { text: 'General' });
        new Setting(containerEl)
            .setName('Highlight color')
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

        containerEl.createEl('h2', { text: 'Keyword highlighting' });
        //Enable/Disable auto keywords highlight
        new Setting(containerEl)
            .setName('Automatic keywords highlighting')
            .setDesc('Automatic keywords highlighting')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.autoKeywordsHighlightEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.autoKeywordsHighlightEnabled = value;
                        await this.plugin.saveSettings();
                        // Force the editor to re-render
                        this.plugin.updateEditors();
                    });
            })
        new Setting(containerEl)
            .setName('Keyword highlight color')
            .setDesc('Set the color used to highlight keywords.')
            .addText(text => {
                text.inputEl.type = 'color';
                text
                    .setValue(this.plugin.settings.highlightColorKeywords)
                    .onChange(async (value) => {
                        this.plugin.settings.highlightColorKeywords = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });
        new Setting(containerEl)
            .setName('Keywords case sensitive')
            .setDesc('Enable or disable case sensitivity for keyword highlighting.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.keywordsCaseSensitive)
                    .onChange(async (value) => {
                        this.plugin.settings.keywordsCaseSensitive = value;
                        await this.plugin.saveSettings();
                        // Force the editor to re-render
                        this.plugin.updateEditors();
                    });
            });

        //for future feature
        // new Setting(containerEl)
        //     .setName('Enable phrase highlighting')
        //     .setDesc('Allow multi-word phrases (e.g., "climate variability")')
        //     .addToggle(toggle => {
        //         toggle
        //             .setValue(this.plugin.settings.highlightPhrases)
        //             .onChange(async (value) => {
        //                 this.plugin.settings.highlightPhrases = value;
        //                 await this.plugin.saveSettings();
        //                 this.plugin.updateEditors();
        //             });
        //     });

        //for future feature
        // new Setting(containerEl)
        //     .setName('Case sensitive matching')
        //     .setDesc('Match only if the case is identical')
        //     .addToggle(toggle => {
        //         toggle
        //             .setValue(this.plugin.settings.caseSensitive)
        //             .onChange(async (value) => {
        //                 this.plugin.settings.caseSensitive = value;
        //                 await this.plugin.saveSettings();
        //                 this.plugin.updateEditors();
        //             });
        //     });

        // Add a setting for adding new keywords
        new Setting(containerEl)
            .setName('Add Keyword')
            .addButton((button: ButtonComponent) => {
                button.setButtonText('Add Keyword')
                    .setCta()
                    .onClick(() => {
                        this.plugin.settings.keywords.push('');

                        this.display(); // Refresh the settings tab
                    });
            });

        // Create a container for the keyword inputs
        const keywordsContainer = containerEl.createEl('div', { cls: 'occura-keywords-container' });

        // Apply CSS to the container via class
        // The styles will be defined in the CSS section below

        // Display existing keywords
        this.keywordComponents = [];
        this.plugin.settings.keywords.forEach((keyword, index) => {
            const keywordItem = keywordsContainer.createEl('div', { cls: 'occura-keyword-item' });

            const textComponent = new TextComponent(keywordItem);
            textComponent
                .setPlaceholder('Enter keyword')
                .setValue(keyword)
                .onChange(async (value) => {
                    this.plugin.settings.keywords[index] = value;
                    await this.plugin.saveSettings();
                    // Optionally, update the highlights
                    //this.plugin.updateKeywordHighlights();
                });
            this.keywordComponents.push(textComponent);

            // Adjust input styles
            textComponent.inputEl.addClass('occura-keyword-input');

            const removeButton = keywordItem.createEl('button', { text: '✕', cls: 'occura-remove-button' });
            removeButton.onclick = async () => {
                this.plugin.settings.keywords.splice(index, 1);
                await this.plugin.saveSettings();
                this.display(); // Refresh the settings tab
                //this.plugin.updateKeywordHighlights();
            };
        });

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
