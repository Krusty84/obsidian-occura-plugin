import { App, ButtonComponent, PluginSettingTab, Setting, TextComponent } from 'obsidian';
import type OccuraPlugin from 'main';

// Interface defining the shape of our plugin settings
export interface OccuraPluginSettings {
    // Color for highlighting all occurrences
    highlightColorOccurrences: string;
    // Color for highlighting keywords specifically
    highlightColorKeywords: string;
    // Enable or disable the plugin globally
    occuraPluginEnabled: boolean;
    // Hotkey string to toggle the plugin on/off
    occuraPluginEnabledHotKey: string;
    // Show number of occurrences in status bar
    statusBarOccurrencesNumberEnabled: boolean;
    // List of user-defined keywords to highlight
    keywords: string[];
    // Automatically highlight keywords as they are typed
    autoKeywordsHighlightEnabled: boolean;
    // Treat keywords as case sensitive when matching
    keywordsCaseSensitive: boolean;
}

// Default values for settings when the plugin is first installed
export const DEFAULT_SETTINGS: OccuraPluginSettings = {
    highlightColorOccurrences: '#FFFF00',     // Yellow
    highlightColorKeywords: '#bdfc64',        // Light green
    occuraPluginEnabled: true,               // Plugin is on by default
    occuraPluginEnabledHotKey: '',           // No hotkey set initially
    statusBarOccurrencesNumberEnabled: true, // Show count in status bar
    keywords: [],                            // Start with no keywords
    autoKeywordsHighlightEnabled: false,     // Manual keyword highlighting by default
    keywordsCaseSensitive: false,            // Case-insensitive matching by default
};

// Settings tab shown in Obsidian's Settings → Community Plugins
export class OccuraPluginSettingTab extends PluginSettingTab {
    plugin: OccuraPlugin;
    // Keep references to keyword text inputs so we can refresh them
    keywordComponents: TextComponent[] = [];

    constructor(app: App, plugin: OccuraPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    // Called whenever the settings tab is displayed or refreshed
    display(): void {
        const { containerEl } = this;

        // Clear old content
        containerEl.empty();
        // Section header
        containerEl.createEl('h2', { text: 'General' });

        // Setting: highlight color for occurrences
        new Setting(containerEl)
            .setName('Highlight color')
            .setDesc('Set the color used to highlight occurrences.')
            .addText(text => {
                text.inputEl.type = 'color';
                text
                    .setValue(this.plugin.settings.highlightColorOccurrences)
                    .onChange(async (value) => {
                        // Save new value and update highlights
                        this.plugin.settings.highlightColorOccurrences = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });

        // Setting: hotkey to enable/disable plugin
        new Setting(containerEl)
            .setName('Hotkey')
            .setDesc('Click and press the desired hotkey combination')
            .addText(text => {
                text
                    .setPlaceholder('Click and press hotkey')
                    .setValue(this.plugin.settings.occuraPluginEnabledHotKey);

                // Clear input when focused, to capture new hotkey
                text.inputEl.addEventListener('focus', () => {
                    text.inputEl.value = '';
                });

                // Restore previous hotkey if user leaves field empty
                text.inputEl.addEventListener('blur', () => {
                    if (!text.inputEl.value) {
                        text.setValue(this.plugin.settings.occuraPluginEnabledHotKey);
                    }
                });

                // Capture key combinations and prevent normal typing
                text.inputEl.addEventListener('keydown', async (event: KeyboardEvent) => {
                    event.preventDefault();
                    event.stopPropagation();

                    // Convert event to human-readable string
                    const hotkey = this.captureHotkey(event);
                    text.setValue(hotkey);

                    // Save hotkey and update handler
                    this.plugin.settings.occuraPluginEnabledHotKey = hotkey;
                    await this.plugin.saveSettings();
                    this.plugin.updateKeyHandler();
                });
            });

        // Toggle: show number of occurrences in status bar
        new Setting(containerEl)
            .setName('Display the number of occurrences')
            .setDesc('Display the number of occurrences found in the Status bar')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.statusBarOccurrencesNumberEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.statusBarOccurrencesNumberEnabled = value;
                        await this.plugin.saveSettings();
                        // Re-render editor to update status bar
                        this.plugin.updateEditors();
                    });
            });

        // Section header for keyword settings
        containerEl.createEl('h2', { text: 'Keyword highlighting' });

        // Toggle: auto highlight keywords
        new Setting(containerEl)
            .setName('Automatic keywords highlighting')
            .setDesc('Highlight keywords automatically')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.autoKeywordsHighlightEnabled)
                    .onChange(async (value) => {
                        this.plugin.settings.autoKeywordsHighlightEnabled = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors(); // Refresh highlights
                    });
            });

        // Setting: keyword highlight color
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

        // Toggle: case sensitivity for keywords
        new Setting(containerEl)
            .setName('Keywords case sensitive')
            .setDesc('Enable or disable case sensitivity for keyword highlighting.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.keywordsCaseSensitive)
                    .onChange(async (value) => {
                        this.plugin.settings.keywordsCaseSensitive = value;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
            });

        // Button: add a new keyword slot
        new Setting(containerEl)
            .setName('Add Keyword')
            .addButton((button: ButtonComponent) => {
                button.setButtonText('Add Keyword')
                    .setCta()
                    .onClick(() => {
                        // Append empty keyword and refresh UI
                        this.plugin.settings.keywords.push('');
                        this.display();
                    });
            });

        // Container to group keyword input fields
        const keywordsContainer = containerEl.createEl('div', { cls: 'occura-keywords-container' });

        // Reset list of TextComponents
        this.keywordComponents = [];
        // For each existing keyword, create an input and remove button
        this.plugin.settings.keywords.forEach((keyword, index) => {
            const keywordItem = keywordsContainer.createEl('div', { cls: 'occura-keyword-item' });

            const textComponent = new TextComponent(keywordItem);
            textComponent
                .setPlaceholder('Enter keyword')
                .setValue(keyword)
                .onChange(async (value) => {
                    this.plugin.settings.keywords[index] = value;
                    await this.plugin.saveSettings();
                    // could refresh highlights here if desired
                });

            // Add CSS class for styling
            textComponent.inputEl.addClass('occura-keyword-input');
            this.keywordComponents.push(textComponent);

            // Button to remove this keyword
            const removeButton = keywordItem.createEl('button', { text: '✕', cls: 'occura-remove-button' });
            removeButton.onclick = async () => {
                this.plugin.settings.keywords.splice(index, 1);
                await this.plugin.saveSettings();
                this.display();
            };
        });
    }

    /**
     * Convert a KeyboardEvent into a displayable hotkey string
     */
    captureHotkey(event: KeyboardEvent): string {
        const keys: string[] = [];

        if (event.ctrlKey || event.metaKey) keys.push('Mod');
        if (event.shiftKey) keys.push('Shift');
        if (event.altKey) keys.push('Alt');

        const key = event.key.toUpperCase();
        // Skip when user only presses modifier
        if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(key)) {
            keys.push(key);
        }

        // Join parts with '+' (e.g. 'Mod+Shift+K')
        return keys.join('+');
    }
}