import { App, ButtonComponent, PluginSettingTab, Setting, TextComponent, ToggleComponent } from 'obsidian';
import type OccuraPlugin from 'main';

export interface KeywordGroup {
    id: string;              // stable id, not the name
    name: string;            // e.g., "Dirty words"
    color: string;           // e.g., "#ff0000"
    keywords: string[];      // words in this class
    enabled: boolean;        // allow turning a class on/off
    caseSensitive: boolean;  // per-class matching
}

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
    //
    keywordGroups: KeywordGroup[];
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
    //
    keywordGroups: [],
};

export class OccuraPluginSettingTab extends PluginSettingTab {
    plugin: OccuraPlugin;
    keywordComponents: TextComponent[] = [];
    // track open state of the keyword section
    private keywordSectionOpen = false;
    // keyword class sections
    private groupOpen: Record<string, boolean> = {};

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

// Header with "Add Class"
        new Setting(keywordsDetails)
            .setName('Word classes')
            .setDesc('Each class has a color and its own word list.')
            .addButton(btn => {
                btn.setButtonText('Add Class')
                    .setCta()
                    .onClick(async () => {
                        const g: KeywordGroup = {
                            id: crypto?.randomUUID?.() ?? String(Date.now()),
                            name: 'New class',
                            color: '#66ccff',
                            keywords: [],
                            enabled: true,
                            caseSensitive: false,
                        };
                        this.plugin.settings.keywordGroups.push(g);
                        await this.plugin.saveSettings();
                        this.display();
                    });
                ['mousedown', 'click'].forEach(evt =>
                    btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                );
            });

// Render each class
        this.plugin.settings.keywordGroups.forEach((group, gi) => {
            const groupDetails = keywordsDetails.createEl('details');
            groupDetails.open = this.groupOpen[group.id] ?? false;

            // keep it updated
            groupDetails.addEventListener('toggle', () => {
                this.groupOpen[group.id] = groupDetails.open;
            });

            // Summary: swatch + name
            const summary = groupDetails.createEl('summary');
            const swatch = summary.createEl('span', { cls: 'occura-color-swatch' });
            swatch.setAttr('style', `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`);
            summary.createSpan({ text: group.name });


            // Row: name + delete
            new Setting(groupDetails)
                .setName('Class name')
                .addText(t => {
                    t.setValue(group.name).onChange(async v => {
                        group.name = v || 'Unnamed';
                        await this.plugin.saveSettings();
                        summary.empty();
                        const sw = summary.createEl('span', { cls: 'occura-color-swatch' });
                        sw.setAttr('style', `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`);
                        summary.createSpan({ text: group.name });
                    });
                })
                .addExtraButton(b => {
                    b.setIcon('trash').onClick(async () => {
                        if (!confirm(`Delete class "${group.name}"?`)) return;
                        this.plugin.settings.keywordGroups.splice(gi, 1);
                        delete this.groupOpen[group.id];
                        await this.plugin.saveSettings();
                        this.display();
                    });
                });

            // Row: enabled words class
            new Setting(groupDetails)
                .setName('Enabled')
                .setDesc('Turn this class on or off.')
                .addToggle(tg => {
                    tg.setValue(group.enabled).onChange(async v => {
                        group.enabled = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
                });

            // Row: color
            new Setting(groupDetails)
                .setName('Color')
                .setDesc('Set the color used to highlight all words occurrences.')
                .addText(text => {
                    text.inputEl.type = 'color';
                    text.setValue(group.color).onChange(async v => {
                        group.color = v || '#66ccff';
                        await this.plugin.saveSettings();
                        swatch.setAttr('style', `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`);
                        this.plugin.updateHighlightStyle();
                    });
                })

            // Row: case sensitive
            new Setting(groupDetails)
                .setName('Case sensitive')
                .setDesc('Match words with exact case.')
                .addToggle(t => {
                    t.setValue(group.caseSensitive).onChange(async v => {
                        group.caseSensitive = v;
                        await this.plugin.saveSettings();
                        this.plugin.updateEditors();
                    });
                });

            // Import / Export / Add Word (per class)
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
                group.keywords = tokens;
                await this.plugin.saveSettings();
                this.groupOpen[group.id] = true;     // keep it open
                this.display();
            });
            groupDetails.appendChild(importInput);

            new Setting(groupDetails)
                .addButton(btn => {
                    btn.setButtonText('Import Words').onClick(() => importInput.click());
                    ['mousedown', 'click'].forEach(evt =>
                        btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                    );
                })
                .addButton(btn => {
                    btn.setButtonText('Export Words').onClick(() => {
                        const blob = new Blob([group.keywords.join(',')], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${group.name.replace(/\s+/g,'_')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                    });
                    ['mousedown', 'click'].forEach(evt =>
                        btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                    );
                })
                .addButton(btn => {
                    btn.setButtonText('Add Word').setCta().onClick(() => {
                        group.keywords.push('');
                        this.groupOpen[group.id] = true;   // keep it open
                        this.display();
                    });
                    ['mousedown','click'].forEach(evt =>
                        btn.buttonEl.addEventListener(evt, e => e.stopPropagation())
                    );
                });

            // Word list
            const listContainer = groupDetails.createEl('div', { cls: 'occura-keywords-container' });
            group.keywords.forEach((kw, idx) => {
                const row = listContainer.createEl('div', { cls: 'occura-keyword-item' });

                const txt = new TextComponent(row)
                    .setPlaceholder('Enter word')
                    .setValue(kw)
                    .onChange(async v => {
                        group.keywords[idx] = v;
                        await this.plugin.saveSettings();
                    });
                txt.inputEl.addClass('occura-keyword-input');

                const rem = row.createEl('button', { text: '✕', cls: 'occura-remove-button' });
                ['mousedown', 'click'].forEach(evt =>
                    rem.addEventListener(evt, e => e.stopPropagation())
                );
                rem.addEventListener('click', async () => {
                    group.keywords.splice(idx, 1);
                    await this.plugin.saveSettings();
                    this.groupOpen[group.id] = true;
                    this.display();
                });
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