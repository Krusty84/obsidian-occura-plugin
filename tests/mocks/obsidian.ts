export const Platform = {
  isMacOS: false,
};

export class MarkdownView {
  containerEl: HTMLElement;

  constructor(containerEl = document.createElement("div")) {
    this.containerEl = containerEl;
  }
}

export class Notice {
  constructor(_message: string) {}
}

export class Modal {
  contentEl = document.createElement("div");

  constructor(_app?: unknown) {}

  open(): void {}
  close(): void {}
}

export class PluginSettingTab {
  app: unknown;
  containerEl = document.createElement("div");

  constructor(app?: unknown, _plugin?: unknown) {
    this.app = app;
  }
}

export class Setting {}
export class TextComponent {}
