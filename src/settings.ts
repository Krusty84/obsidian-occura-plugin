import { App, ButtonComponent, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';
import type OccuraPlugin from 'main';

// Interface defining plugin settings
export interface OccuraPluginSettings {
    highlightColorOccurrences: string;
    highlightColorKeywords: string;
    occuraPluginEnabled: boolean;
    occuraPluginEnabledHotKey: string;
    statusBarOccurrencesNumberEnabled: boolean;
    keywords: string[];
    autoKeywordsHighlightEnabled: boolean;
    keywordsCaseSensitive: boolean;
    occuraCaseSensitive: boolean;
}

export const DEFAULT_SETTINGS: OccuraPluginSettings = {
    highlightColorOccurrences: '#FFFF00',
    highlightColorKeywords: '#bdfc64',
    occuraPluginEnabled: true,
    occuraPluginEnabledHotKey: '',
    statusBarOccurrencesNumberEnabled: true,
    keywords: [],
    autoKeywordsHighlightEnabled: false,
    keywordsCaseSensitive: false,
    occuraCaseSensitive: false,
};

export class OccuraPluginSettingTab extends PluginSettingTab {
    plugin: OccuraPlugin;
    keywordComponents: TextComponent[] = [];
    // track open state of the keyword section
    private keywordSectionOpen = false;

    constructor(app: App, plugin: OccuraPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        //
        // ── GENERAL SECTION ──
        //
        const generalDetails = containerEl.createEl('details');
        generalDetails.open = true;
        generalDetails.createEl('summary', { text: 'General' });

        new Setting(generalDetails)
            .setName('Highlight color (occurrences)')
            .setDesc('Set the color used to highlight all occurrences.')
            .addText(text => {
                text.inputEl.type = 'color';
                text
                    .setValue(this.plugin.settings.highlightColorOccurrences)
                    .onChange(async v => {
                        this.plugin.settings.highlightColorOccurrences = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });

        new Setting(generalDetails)
            .setName('Case sensitive (occurrences)')
            .setDesc('Match only exact-case when finding all selected-text occurrences.')
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.occuraCaseSensitive)
                    .onChange(async v => {
                        this.plugin.settings.occuraCaseSensitive = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    })
            );

        new Setting(generalDetails)
            .setName('Hotkey')
            .setDesc('Click and press the desired hotkey combination.')
            .addText(text => {
                text
                    .setPlaceholder('Click and press hotkey')
                    .setValue(this.plugin.settings.occuraPluginEnabledHotKey);
                text.inputEl.addEventListener('focus', () => text.inputEl.value = '');
                text.inputEl.addEventListener('blur', () => {
                    if (!text.inputEl.value)
                        text.setValue(this.plugin.settings.occuraPluginEnabledHotKey);
                });
                text.inputEl.addEventListener('keydown', async (evt: KeyboardEvent) => {
                    evt.preventDefault();
                    evt.stopPropagation();
                    const hk = this.captureHotkey(evt);
                    text.setValue(hk);
                    this.plugin.settings.occuraPluginEnabledHotKey = hk;
                    await this.plugin.saveSettings();
                    this.plugin.updateKeyHandler();
                });
            });

        new Setting(generalDetails)
            .setName('Display the number of occurrences')
            .setDesc('Show the total count of occurrences in the status bar.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.statusBarOccurrencesNumberEnabled)
                    .onChange(async v => {
                        this.plugin.settings.statusBarOccurrencesNumberEnabled = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
            });

        //
        // ── KEYWORD SECTION ──
        //
        const keywordsDetails = containerEl.createEl('details');
        keywordsDetails.open = this.keywordSectionOpen;
        keywordsDetails.createEl('summary', { text: 'Keyword Highlighting' });
        keywordsDetails.addEventListener('toggle', () => {
            this.keywordSectionOpen = keywordsDetails.open;
        });

        new Setting(keywordsDetails)
            .setName('Automatic keywords highlighting')
            .setDesc('Highlight keywords automatically as you type.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.autoKeywordsHighlightEnabled)
                    .onChange(async v => {
                        this.plugin.settings.autoKeywordsHighlightEnabled = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
            });

        new Setting(keywordsDetails)
            .setName('Keyword highlight color')
            .setDesc('Set the color used to highlight keywords.')
            .addText(text => {
                text.inputEl.type = 'color';
                text
                    .setValue(this.plugin.settings.highlightColorKeywords)
                    .onChange(async v => {
                        this.plugin.settings.highlightColorKeywords = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateHighlightStyle();
                    });
            });

        new Setting(keywordsDetails)
            .setName('Keywords case sensitive')
            .setDesc('Match keywords only when letter case exactly matches.')
            .addToggle(toggle => {
                toggle
                    .setValue(this.plugin.settings.keywordsCaseSensitive)
                    .onChange(async v => {
                        this.plugin.settings.keywordsCaseSensitive = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
            });

        //
        // ── IMPORT / EXPORT / ADD KEYWORD ──
        //
        const importInput = document.createElement('input');
        importInput.type = 'file';
        importInput.accept = '.txt';
        importInput.style.display = 'none';
        importInput.addEventListener('change', async e => {
            e.stopPropagation();
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;
            const text = await file.text();
            const tokens = text
                .split(/[\n,]/)
                .map(t => t.trim())
                .filter(t => t && !(t.startsWith('"') && t.endsWith('"')));
            this.plugin.settings.keywords = tokens;
            await this.plugin.saveSettings();
            this.display();
        });
        keywordsDetails.appendChild(importInput);

        new Setting(keywordsDetails)
            .addButton(btn => {
                btn
                    .setButtonText('Import Keywords')
                    .onClick(() => importInput.click());
                ['mousedown', 'click'].forEach(evt =>
                    btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                );
            })
            .addButton(btn => {
                btn
                    .setButtonText('Export Keywords')
                    .onClick(() => {
                        const blob = new Blob(
                            [this.plugin.settings.keywords.join(',')],
                            { type: 'text/plain' }
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'keywords.txt';
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                ['mousedown', 'click'].forEach(evt =>
                    btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                );
            })
            .addButton(btn => {
                btn
                    .setButtonText('Add Keyword')
                    .setCta()
                    .onClick(() => {
                        this.plugin.settings.keywords.push('');
                        this.display();
                    });
                ['mousedown', 'click'].forEach(evt =>
                    btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                );
            });

        //
        // ── LIST EXISTING KEYWORDS ──
        //
        const listContainer = keywordsDetails.createEl('div', {
            cls: 'occura-keywords-container',
        });
        this.keywordComponents = [];
        this.plugin.settings.keywords.forEach((kw, idx) => {
            const row = listContainer.createEl('div', { cls: 'occura-keyword-item' });
            const txt = new TextComponent(row)
                .setPlaceholder('Enter keyword')
                .setValue(kw)
                .onChange(async v => {
                    this.plugin.settings.keywords[idx] = v;
                    await this.plugin.saveSettings();
                });
            txt.inputEl.addClass('occura-keyword-input');
            this.keywordComponents.push(txt);

            const rem = row.createEl('button', {
                text: '✕',
                cls: 'occura-remove-button',
            });
            ['mousedown', 'click'].forEach(evt =>
                rem.addEventListener(evt, e => e.stopPropagation())
            );
            rem.addEventListener('click', async () => {
                this.plugin.settings.keywords.splice(idx, 1);
                await this.plugin.saveSettings();
                this.display();
            });
        });

        //
        // ── RESET TO DEFAULTS ──
        //
        new Setting(containerEl)
            .setName('Reset to defaults')
            .addButton(btn => {
                btn
                    .setButtonText('Reset')
                    .setWarning()
                    .onClick(async () => {
                        Object.assign(this.plugin.settings, DEFAULT_SETTINGS);
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });
    }

    captureHotkey(event: KeyboardEvent): string {
        const keys: string[] = [];
        if (event.ctrlKey || event.metaKey) keys.push('Mod');
        if (event.shiftKey) keys.push('Shift');
        if (event.altKey) keys.push('Alt');
        const k = event.key.toUpperCase();
        if (!['CONTROL', 'SHIFT', 'ALT', 'META'].includes(k)) {
            keys.push(k);
        }
        return keys.join('+');
    }
}