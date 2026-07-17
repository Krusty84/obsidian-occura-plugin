/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import { App, Editor, Notice, SuggestModal } from "obsidian";
import type OccuraPlugin from "main";
import type { KeywordGroup } from "src/settings";

type SubmenuCapableMenuItem = {
  setSubmenu(): {
    addItem(
      callback: (item: {
        setTitle(title: string): {
          setIcon(icon: string | null): {
            onClick(callback: () => void): unknown;
          };
        };
      }) => void,
    ): unknown;
  };
};

class KeywordGroupSuggestModal extends SuggestModal<KeywordGroup> {
  private readonly groups: KeywordGroup[];
  private readonly onChoose: (group: KeywordGroup) => void;

  constructor(
    app: App,
    groups: KeywordGroup[],
    onChoose: (group: KeywordGroup) => void,
  ) {
    super(app);
    this.groups = groups;
    this.onChoose = onChoose;
    this.setPlaceholder("Choose a word class");
    this.emptyStateText = "No matching word classes.";
  }

  getSuggestions(query: string): KeywordGroup[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return this.groups;

    return this.groups.filter((group) =>
      group.name.toLowerCase().includes(normalizedQuery),
    );
  }

  renderSuggestion(group: KeywordGroup, el: HTMLElement): void {
    const row = el.createDiv({
      cls: "occura-keyword-group-suggestion",
    });
    row.createSpan({
      attr: {
        style: `display:inline-block;width:12px;height:12px;border-radius:3px;background:${group.color};margin-right:8px;`,
      },
    });
    row.createSpan({ text: group.name });
    row.createSpan({
      text: `${group.keywords.length} word${group.keywords.length === 1 ? "" : "s"}`,
      attr: {
        style: "margin-left:8px;opacity:0.7;",
      },
    });
  }

  onChooseSuggestion(group: KeywordGroup): void {
    this.onChoose(group);
  }
}

export function registerWordClassesEditorMenu(plugin: OccuraPlugin): void {
  plugin.registerEvent(
    plugin.app.workspace.on("editor-menu", (menu, editor) => {
      const selectedWord = getSelectedWord(editor);
      if (!selectedWord) return;

      menu.addItem((item) => {
        item.setTitle("Obsidian").setIcon("highlighter");

        const submenu = (
          item as unknown as SubmenuCapableMenuItem
        ).setSubmenu();
        submenu.addItem((submenuItem) => {
          submenuItem
            .setTitle("Add selected word to class")
            .setIcon("list-plus")
            .onClick(() => {
              openKeywordGroupPicker(plugin, selectedWord);
            });
        });
      });
    }),
  );
}

async function addWordToKeywordGroup(
  plugin: OccuraPlugin,
  groupId: string,
  word: string,
): Promise<void> {
  const selectedWord = word.trim();
  if (!selectedWord || /\s/.test(selectedWord)) {
    new Notice("Select a single word first.");
    return;
  }

  const group = plugin.settings.keywordGroups.find(
    (candidate) => candidate.id === groupId,
  );
  if (!group) {
    new Notice("Word class not found.");
    return;
  }

  const normalizedWord = group.caseSensitive
    ? selectedWord
    : selectedWord.toLowerCase();
  const exists = group.keywords.some((keyword) => {
    const normalizedKeyword = group.caseSensitive
      ? keyword.trim()
      : keyword.trim().toLowerCase();
    return normalizedKeyword === normalizedWord;
  });

  if (exists) {
    new Notice(`"${selectedWord}" is already in "${group.name}".`);
    return;
  }

  group.keywords.push(selectedWord);
  await plugin.saveSettings();
  plugin.updateEditors();
  new Notice(`Added "${selectedWord}" to "${group.name}".`);
}

function getSelectedWord(editor: Editor): string | null {
  const selectedWord = editor.getSelection().trim();
  if (!selectedWord || /\s/.test(selectedWord)) return null;
  return selectedWord;
}

function openKeywordGroupPicker(plugin: OccuraPlugin, word: string): void {
  const groups = plugin.settings.keywordGroups ?? [];
  if (groups.length === 0) {
    new Notice("Create a word class in Occura settings first.");
    return;
  }

  if (groups.length === 1) {
    void addWordToKeywordGroup(plugin, groups[0].id, word);
    return;
  }

  new KeywordGroupSuggestModal(plugin.app, groups, (group) => {
    void addWordToKeywordGroup(plugin, group.id, word);
  }).open();
}
