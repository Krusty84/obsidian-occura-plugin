export const Platform = {
  isMacOS: false,
};

export class MarkdownView {
  containerEl: HTMLElement;
  editor: any;
  previewMode?: { rerender?: (force: boolean) => void };
  private mode: string;

  constructor(
    containerEl = document.createElement("div"),
    editor: any = {},
    mode = "source",
  ) {
    this.containerEl = containerEl;
    this.editor = editor;
    this.mode = mode;
  }

  getMode(): string {
    return this.mode;
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

export class SuggestModal<T> {
  emptyStateText = "";
  constructor(_app?: unknown) {}
  setPlaceholder(_value: string): void {}
  open(): void {}
}

export class WorkspaceLeaf {
  constructor(public view: unknown) {}
}

export function setIcon(_element: HTMLElement, _icon: string): void {}
export function setTooltip(_element: HTMLElement, _tooltip: string): void {}

export class Plugin {
  app: any;
  _commands: any[] = [];
  _statusItems: HTMLElement[] = [];
  _cleanups: Array<() => void> = [];
  _data: unknown = {};

  constructor(app?: any, _manifest?: unknown) {
    this.app = app;
  }

  async loadData(): Promise<unknown> {
    return this._data;
  }

  async saveData(data: unknown): Promise<void> {
    this._data = data;
  }

  addStatusBarItem(): HTMLElement {
    const element = document.createElement("div");
    Object.assign(element, {
      setText(value: string) {
        element.textContent = value;
      },
    });
    this._statusItems.push(element);
    return element;
  }

  addSettingTab(_tab: unknown): void {}
  registerEditorExtension(_extension: unknown): void {}
  registerMarkdownPostProcessor(_processor: unknown, _order?: number): void {}

  addCommand(command: unknown): void {
    this._commands.push(command);
  }

  registerEvent(_event: unknown): void {}

  register(callback: () => void): void {
    this._cleanups.push(callback);
  }

  registerDomEvent(
    target: EventTarget,
    event: string,
    callback: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    target.addEventListener(event, callback, options);
    this._cleanups.push(() => target.removeEventListener(event, callback, options));
  }

  _runCleanups(): void {
    this._cleanups.splice(0).forEach((cleanup) => cleanup());
  }
}
