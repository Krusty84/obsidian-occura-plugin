import {
  Plugin,
  MarkdownView,
  Notice,
  WorkspaceLeaf,
  setIcon,
  setTooltip,
} from "obsidian";
import { Compartment } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import {
  OccuraPluginSettingTab,
  OccuraPluginSettings,
} from "src/settings";
import {
  highlightOccurrenceExtension,
  setPermanentHighlightOccurrences,
  removePermanentHighlightOccurrences,
  removeTagFromOccurrences,
  createTagForOccurrences,
} from "src/highlighter";
import { navigateOccurrence } from "src/occurenceNavigation";
import {
  registerReadingViewDynamicOccurrenceHighlighting,
  type ReadingViewDynamicOccurrenceController,
} from "src/readingViewDynamicOccurrences";
import { registerKeywordReadingViewPostProcessor } from "src/readingViewKeywords";
import { registerWordClassesEditorMenu } from "src/wordClasses";
import { migrateSettings } from "src/settingsMigration";

export default class OccuraPlugin extends Plugin {
  settings: OccuraPluginSettings;
  highlightCompartment: Compartment;
  readingViewDynamicOccurrences: ReadingViewDynamicOccurrenceController | null =
    null;
  statusBarOccurrencesNumber: HTMLElement | null = null;

  async onload() {
    await this.loadSettings();
    // Initialize the compartment for the highlighting extension
    this.highlightCompartment = new Compartment();
    this.readingViewDynamicOccurrences =
      registerReadingViewDynamicOccurrenceHighlighting(this);

    // Add the settings tab
    this.addSettingTab(new OccuraPluginSettingTab(this.app, this));

    // Register the editor extension with the compartment
    this.registerEditorExtension(
      this.highlightCompartment.of(highlightOccurrenceExtension(this)),
    );
    registerKeywordReadingViewPostProcessor(this);

    // Register click event to clear selection when clicking outside
    // (It has been removed based on PR- "Multiple Conflicts #8" (by BlackUdon) in 1.3.1 version)
    //this.registerDomEvent(document, 'click', this.handleDocumentClick.bind(this));

    // Add custom CSS for highlighting
    this.updateHighlightStyle();

    // Register command to toggle highlighting
    this.addCommand({
      id: "toggle-highlight-occurrences",
      name: "Toggle highlight occurrences",
      callback: () => {
        this.toggleHighlighting();
      },
    });

    this.addCommand({
      id: "toggle-keyword-highlighting",
      name: "Toggle keyword highlighting",
      callback: () => {
        this.toggleKeywordHighlighting();
      },
    });

    this.addCommand({
      id: "go-to-next-occurrence",
      name: "Go to next occurrence",
      callback: () => {
        navigateOccurrence(this, "next");
      },
    });

    this.addCommand({
      id: "go-to-previous-occurrence",
      name: "Go to previous occurrence",
      callback: () => {
        navigateOccurrence(this, "previous");
      },
    });

    this.addCommand({
      id: "set-permanent-highlight-occurrences",
      name: "Set permanently highlight for occurrences",
      callback: () => {
        if (this.settings.occuraPluginEnabled) {
          setPermanentHighlightOccurrences(this);
        } else {
          new Notice("Please enable Occura");
        }
      },
    });

    this.addCommand({
      id: "remove-permanent-highlight-occurrences",
      name: "Remove permanently highlight for occurrences",
      callback: () => {
        if (this.settings.occuraPluginEnabled) {
          removePermanentHighlightOccurrences(this);
        } else {
          new Notice("Please enable Occura");
        }
      },
    });

    this.addCommand({
      id: "create-tag-for-occurrences",
      name: "Create Tag for occurrences",
      callback: () => {
        if (this.settings.occuraPluginEnabled) {
          createTagForOccurrences(this);
        } else {
          new Notice("Please enable Occura");
        }
      },
    });

    this.addCommand({
      id: "remove-tag-from-occurrences",
      name: "Remove Tag for occurrences",
      callback: () => {
        if (this.settings.occuraPluginEnabled) {
          removeTagFromOccurrences(this);
        } else {
          new Notice("Please enable Occura");
        }
      },
    });

    registerWordClassesEditorMenu(this);

    // Add icon to the editor title bar when a new leaf is created
    this.registerEvent(
      this.app.workspace.on("layout-change", () => {
        this.addIconsToAllLeaves();
        this.updateHighlightStyle();
        this.readingViewDynamicOccurrences?.refreshDocuments();
      }),
    );

    // Initial addition of the icon to all leaves
    this.addIconsToAllLeaves();
  }

  async loadSettings() {
    const migration = migrateSettings(await this.loadData());
    this.settings = migration.settings;
    if (migration.changed) await this.saveData(this.settings);
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  // Toggle highlighting functionality
  toggleHighlighting() {
    this.settings.occuraPluginEnabled = !this.settings.occuraPluginEnabled;
    void this.saveSettings();
    // Force the editor to re-render
    this.updateEditors();
    if (!this.settings.occuraPluginEnabled) {
      this.readingViewDynamicOccurrences?.clearAll();
    }
    // Update the icon in the title bar
    this.updateAllTitleBarIcons();
    // Optional: Show a notice
    //new Notice(`Occura ${this.settings.occuraPluginEnabled ? 'enabled' : 'disabled'}`);
  }
  // Toggle keywords highlighting functionality
  toggleKeywordHighlighting() {
    this.settings.autoKeywordsHighlightEnabled =
      !this.settings.autoKeywordsHighlightEnabled;
    void this.saveSettings();
    // Force the editor to re-render
    this.updateEditors();
    // Optional: Show a notice
    //new Notice(`Keyword highlighting ${this.settings.autoKeywordsHighlightEnabled ? 'enabled' : 'disabled'}`);
  }

  // Clear selection when clicking outside the editor
  private handleDocumentClick(evt: MouseEvent) {
    const target = evt.target as HTMLElement;
    if (!target.closest(".cm-content")) {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (view) {
        view.editor.setCursor(view.editor.getCursor()); // Clear selection
      }
    }
  }

  // Method to dynamic update the highlight style based on settings
  updateHighlightStyle() {
    for (const doc of this.getWorkspaceDocuments()) {
      doc.documentElement.style.setProperty(
        "--occura-highlight-color-occurrences",
        this.settings.highlightColorOccurrences,
      );
    }
  }

  // Force all editors to update
  updateEditors() {
    const markdownViews = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .filter((view) => view instanceof MarkdownView) as MarkdownView[];
    for (const view of markdownViews) {
      // Get the CodeMirror EditorView instance
      const editorView = (view.editor as { cm?: EditorView }).cm;
      if (editorView) {
        // Reconfigure the compartment with the updated plugin
        editorView.dispatch({
          effects: this.highlightCompartment.reconfigure(
            highlightOccurrenceExtension(this),
          ),
        });
      }
    }

    this.rerenderReadingViews();
  }

  rerenderReadingViews() {
    const markdownViews = this.app.workspace
      .getLeavesOfType("markdown")
      .map((leaf) => leaf.view)
      .filter((view) => view instanceof MarkdownView) as MarkdownView[];
    for (const view of markdownViews) {
      if (view.getMode() === "preview") {
        view.previewMode?.rerender?.(true);
      }
    }
  }

  // Add icons to all Markdown views
  addIconsToAllLeaves() {
    const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of markdownLeaves) {
      this.addTitleBarIcon(leaf);
    }
  }

  // Add an icon to the editor's title bar
  addTitleBarIcon(leaf: WorkspaceLeaf) {
    if (!(leaf.view instanceof MarkdownView)) return;
    const view = leaf.view;
    // Remove existing icon if any
    const existingIcon = view.containerEl.querySelector(
      ".highlight-toggle-icon",
    );
    if (existingIcon) {
      existingIcon.remove();
    }

    // Create the icon element
    const titleBar = view.containerEl.querySelector(".view-header");
    if (titleBar) {
      const iconContainer = titleBar.querySelector(".view-actions");
      if (iconContainer) {
        const iconEl = iconContainer.createDiv({
          cls: "highlight-toggle-icon clickable-icon",
          prepend: true,
        });

        // Set the icon based on the current state
        this.updateIconElement(iconEl);

        // Add click handler
        iconEl.addEventListener("click", () => {
          this.toggleHighlighting();
        });
      }
    }
  }

  // Update all icons in the title bars
  updateAllTitleBarIcons() {
    const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of markdownLeaves) {
      if (!(leaf.view instanceof MarkdownView)) continue;
      const iconEl = leaf.view.containerEl.querySelector(
        ".highlight-toggle-icon",
      );
      if (iconEl instanceof HTMLElement) {
        this.updateIconElement(iconEl);
      }
    }
  }

  // Update the icon element based on the current state
  updateIconElement(iconEl: HTMLElement) {
    // Remove existing icon classes
    iconEl.empty();
    setIcon(iconEl, "highlighter");

    if (this.settings.occuraPluginEnabled) {
      // If we've never added the status bar item, do it now
      if (!this.statusBarOccurrencesNumber) {
        this.statusBarOccurrencesNumber = this.addStatusBarItem();
      }
      setTooltip(iconEl, "Disable highlighting");
      iconEl.removeClass("is-disabled");
    } else {
      setTooltip(iconEl, "Enable highlighting");
      iconEl.addClass("is-disabled");
    }
  }

  onunload() {
    this.readingViewDynamicOccurrences?.clearAll();
    for (const doc of this.getWorkspaceDocuments()) {
      doc.documentElement.style.removeProperty(
        "--occura-highlight-color-occurrences",
      );
    }
    // Remove the icon from all title bars
    const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of markdownLeaves) {
      if (!(leaf.view instanceof MarkdownView)) continue;
      const icon = leaf.view.containerEl.querySelector(
        ".highlight-toggle-icon",
      );
      icon?.remove();
    }
  }

  private getWorkspaceDocuments(): Document[] {
    const docs = new Set<Document>([activeDocument]);
    docs.add(this.app.workspace.containerEl.doc);

    this.app.workspace.iterateAllLeaves((leaf) => {
      docs.add(leaf.view.containerEl.doc);
    });

    return Array.from(docs);
  }
}
