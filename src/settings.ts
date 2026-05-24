import { App, Modal, PluginSettingTab, Setting, TextComponent } from "obsidian";
import type OccuraPlugin from "main";

export interface KeywordGroup {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  enabled: boolean;
  caseSensitive: boolean;
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
  allowPhraseSelectionHighlighting: boolean;
  //
  keywordGroups: KeywordGroup[];
}

export const DEFAULT_SETTINGS: OccuraPluginSettings = {
  highlightColorOccurrences: "#FFFF00",
  highlightColorKeywords: "#bdfc64",
  occuraPluginEnabled: true,
  occuraPluginEnabledHotKey: "",
  statusBarOccurrencesNumberEnabled: true,
  keywords: [],
  autoKeywordsHighlightEnabled: false,
  keywordsCaseSensitive: false,
  occuraCaseSensitive: false,
  allowPhraseSelectionHighlighting: false,
  //
  keywordGroups: [],
};

class ConfirmModal extends Modal {
  private readonly message: string;
  private readonly onSubmit: (confirmed: boolean) => void;

  constructor(app: App, message: string, onSubmit: (confirmed: boolean) => void) {
    super(app);
    this.message = message;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("p", { text: this.message });

    new Setting(contentEl)
      .addButton((btn) => {
        btn.setButtonText("Delete").setWarning().onClick(() => {
          this.close();
          this.onSubmit(true);
        });
      })
      .addButton((btn) => {
        btn.setButtonText("Cancel").onClick(() => {
          this.close();
          this.onSubmit(false);
        });
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export class OccuraPluginSettingTab extends PluginSettingTab {
  plugin: OccuraPlugin;
  // track open state of the keyword section
  private keywordSectionOpen = false;
  // keyword class sections
  private groupOpen: Record<string, boolean> = {};

  constructor(app: App, plugin: OccuraPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private confirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      new ConfirmModal(this.app, message, resolve).open();
    });
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    //
    // ── GENERAL SECTION ──
    //
    const generalDetails = containerEl.createEl("details");
    generalDetails.open = true;
    generalDetails.createEl("summary", { text: "General" });

    new Setting(generalDetails)
      .setName("Highlight color (occurrences)")
      .setDesc("Set the color used to highlight all occurrences.")
      .addText((text) => {
        text.inputEl.type = "color";
        text
          .setValue(this.plugin.settings.highlightColorOccurrences)
          .onChange(async (v) => {
            this.plugin.settings.highlightColorOccurrences = v;
            await this.plugin.saveSettings();
            this.plugin.updateHighlightStyle();
          });
      });

    new Setting(generalDetails)
      .setName("Case sensitive (occurrences)")
      .setDesc(
        "Match only exact-case when finding all selected-text occurrences.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.occuraCaseSensitive)
          .onChange(async (v) => {
            this.plugin.settings.occuraCaseSensitive = v;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          }),
      );

    new Setting(generalDetails)
      .setName("Allow phrase selection highlighting")
      .setDesc(
        "Highlight occurrences when the selection contains spaces. Multi-line selections are ignored.",
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowPhraseSelectionHighlighting)
          .onChange(async (v) => {
            this.plugin.settings.allowPhraseSelectionHighlighting = v;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          }),
      );

    new Setting(generalDetails)
      .setName("Hotkey")
      .setDesc("Click and press the desired hotkey combination.")
      .addText((text) => {
        text
          .setPlaceholder("Click and press hotkey")
          .setValue(this.plugin.settings.occuraPluginEnabledHotKey);
        text.inputEl.addEventListener("focus", () => (text.inputEl.value = ""));
        text.inputEl.addEventListener("blur", () => {
          if (!text.inputEl.value)
            text.setValue(this.plugin.settings.occuraPluginEnabledHotKey);
        });
        text.inputEl.addEventListener("keydown", (evt: KeyboardEvent) => {
          evt.preventDefault();
          evt.stopPropagation();
          const hk = this.captureHotkey(evt);
          text.setValue(hk);
          this.plugin.settings.occuraPluginEnabledHotKey = hk;
          void (async () => {
            await this.plugin.saveSettings();
            this.plugin.updateKeyHandler();
          })();
        });
      });

    new Setting(generalDetails)
      .setName("Display the number of occurrences")
      .setDesc("Show the total count of occurrences in the status bar.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.statusBarOccurrencesNumberEnabled)
          .onChange(async (v) => {
            this.plugin.settings.statusBarOccurrencesNumberEnabled = v;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          });
      });

    const keywordsDetails = containerEl.createEl("details");
    keywordsDetails.open = this.keywordSectionOpen;
    keywordsDetails.createEl("summary", { text: "Keyword Highlighting" });
    keywordsDetails.addEventListener("toggle", () => {
      this.keywordSectionOpen = keywordsDetails.open;
    });

    new Setting(keywordsDetails)
      .setName("Automatic keywords highlighting")
      .setDesc("Highlight keywords automatically as you type.")
      .addToggle((toggle) => {
        toggle
          .setValue(this.plugin.settings.autoKeywordsHighlightEnabled)
          .onChange(async (v) => {
            this.plugin.settings.autoKeywordsHighlightEnabled = v;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          });
      });

    this.renderWordClassesSettings(keywordsDetails);

    //
    // ── RESET TO DEFAULTS ──
    //
    new Setting(containerEl).setName("Reset to defaults").addButton((btn) => {
      btn
        .setButtonText("Reset")
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
    if (event.ctrlKey || event.metaKey) keys.push("Mod");
    if (event.shiftKey) keys.push("Shift");
    if (event.altKey) keys.push("Alt");
    const k = event.key.toUpperCase();
    if (!["CONTROL", "SHIFT", "ALT", "META"].includes(k)) {
      keys.push(k);
    }
    return keys.join("+");
  }

  private renderWordClassesSettings(containerEl: HTMLElement): void {
    new Setting(containerEl)
      .setName("Word classes")
      .setDesc("Each class has a color and its own word list.")
      .addButton((btn) => {
        btn
          .setButtonText("Add Class")
          .setCta()
          .onClick(async () => {
            const group: KeywordGroup = {
              id: crypto?.randomUUID?.() ?? String(Date.now()),
              name: "New class",
              color: "#66ccff",
              keywords: [],
              enabled: true,
              caseSensitive: false,
            };
            this.plugin.settings.keywordGroups.push(group);
            await this.plugin.saveSettings();
            this.display();
          });
        ["mousedown", "click"].forEach((eventName) =>
          btn.buttonEl.addEventListener(eventName, (event) => event.stopPropagation()),
        );
      });

    this.plugin.settings.keywordGroups.forEach((group, groupIndex) => {
      const groupDetails = containerEl.createEl("details");
      groupDetails.open = this.groupOpen[group.id] ?? false;

      groupDetails.addEventListener("toggle", () => {
        this.groupOpen[group.id] = groupDetails.open;
      });

      const summary = groupDetails.createEl("summary");
      const swatch = summary.createSpan({ cls: "occura-color-swatch" });
      swatch.setAttr(
        "style",
        `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`,
      );
      summary.createSpan({ text: group.name });

      new Setting(groupDetails)
        .setName("Class name")
        .addText((text) => {
          text.setValue(group.name).onChange(async (value) => {
            group.name = value || "Unnamed";
            await this.plugin.saveSettings();
            summary.empty();
            const updatedSwatch = summary.createSpan({ cls: "occura-color-swatch" });
            updatedSwatch.setAttr(
              "style",
              `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`,
            );
            summary.createSpan({ text: group.name });
          });
        })
        .addExtraButton((button) => {
          button.setIcon("trash").onClick(() => {
            void (async () => {
              const confirmed = await this.confirm(`Delete class "${group.name}"?`);
              if (!confirmed) return;
              this.plugin.settings.keywordGroups.splice(groupIndex, 1);
              delete this.groupOpen[group.id];
              await this.plugin.saveSettings();
              this.display();
            })();
          });
        });

      new Setting(groupDetails)
        .setName("Enabled")
        .setDesc("Turn this class on or off.")
        .addToggle((toggle) => {
          toggle.setValue(group.enabled).onChange(async (value) => {
            group.enabled = value;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          });
        });

      new Setting(groupDetails)
        .setName("Color")
        .setDesc("Set the color used to highlight all words occurrences.")
        .addText((text) => {
          text.inputEl.type = "color";
          text.setValue(group.color).onChange(async (value) => {
            group.color = value || "#66ccff";
            await this.plugin.saveSettings();
            swatch.setAttr(
              "style",
              `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`,
            );
            this.plugin.updateEditors();
          });
        });

      new Setting(groupDetails)
        .setName("Case sensitive")
        .setDesc("Match words with exact case.")
        .addToggle((toggle) => {
          toggle.setValue(group.caseSensitive).onChange(async (value) => {
            group.caseSensitive = value;
            await this.plugin.saveSettings();
            this.plugin.updateEditors();
          });
        });

      const importInput = groupDetails.createEl("input", {
        cls: "occura-hidden-input",
      });
      importInput.type = "file";
      importInput.accept = ".txt";
      importInput.addEventListener("change", (event) => {
        event.stopPropagation();
        void (async () => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) return;
          const text = await file.text();
          const tokens = text
            .split(/[\n,]/)
            .map((token) => token.trim())
            .filter((token) => token && !(token.startsWith('"') && token.endsWith('"')));
          group.keywords = tokens;
          await this.plugin.saveSettings();
          this.groupOpen[group.id] = true;
          this.display();
        })();
      });

      new Setting(groupDetails)
        .addButton((btn) => {
          btn.setButtonText("Import Words").onClick(() => importInput.click());
          ["mousedown", "click"].forEach((eventName) =>
            btn.buttonEl.addEventListener(eventName, (event) => event.stopPropagation()),
          );
        })
        .addButton((btn) => {
          btn.setButtonText("Export Words").onClick(() => {
            const blob = new Blob([group.keywords.join(",")], {
              type: "text/plain",
            });
            const url = URL.createObjectURL(blob);
            const anchor = groupDetails.createEl("a");
            anchor.href = url;
            anchor.download = `${group.name.replace(/\s+/g, "_")}.txt`;
            anchor.click();
            anchor.remove();
            URL.revokeObjectURL(url);
          });
          ["mousedown", "click"].forEach((eventName) =>
            btn.buttonEl.addEventListener(eventName, (event) => event.stopPropagation()),
          );
        })
        .addButton((btn) => {
          btn
            .setButtonText("Add Word")
            .setCta()
            .onClick(() => {
              group.keywords.push("");
              this.groupOpen[group.id] = true;
              this.display();
            });
          ["mousedown", "click"].forEach((eventName) =>
            btn.buttonEl.addEventListener(eventName, (event) => event.stopPropagation()),
          );
        });

      const listContainer = groupDetails.createDiv({
        cls: "occura-keywords-container",
      });
      group.keywords.forEach((keyword, keywordIndex) => {
        const row = listContainer.createDiv({
          cls: "occura-keyword-item",
        });

        const text = new TextComponent(row)
          .setPlaceholder("Enter word")
          .setValue(keyword)
          .onChange(async (value) => {
            group.keywords[keywordIndex] = value;
            await this.plugin.saveSettings();
          });
        text.inputEl.addClass("occura-keyword-input");

        const removeButton = row.createEl("button", {
          text: "✕",
          cls: "occura-remove-button",
        });
        ["mousedown", "click"].forEach((eventName) =>
          removeButton.addEventListener(eventName, (event) => event.stopPropagation()),
        );
        removeButton.addEventListener("click", () => {
          group.keywords.splice(keywordIndex, 1);
          void (async () => {
            await this.plugin.saveSettings();
            this.groupOpen[group.id] = true;
            this.display();
          })();
        });
      });
    });
  }
}
