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
