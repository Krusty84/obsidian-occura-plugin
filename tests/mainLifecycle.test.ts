import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import OccuraPlugin from "main";

type WorkspaceEvent = "layout-change" | "active-leaf-change" | "editor-menu";

function createApp() {
  const callbacks = new Map<WorkspaceEvent, Array<(...args: any[]) => void>>();
  const workspace = {
    containerEl: { doc: document },
    getLeavesOfType: () => [],
    getActiveViewOfType: () => null,
    iterateAllLeaves: (_callback: (leaf: unknown) => void) => {},
    on(event: WorkspaceEvent, callback: (...args: any[]) => void) {
      const listeners = callbacks.get(event) ?? [];
      listeners.push(callback);
      callbacks.set(event, listeners);
      return { event, callback };
    },
  };

  return {
    app: { workspace },
    emit(event: WorkspaceEvent, ...args: any[]) {
      callbacks.get(event)?.forEach((callback) => callback(...args));
    },
  };
}

describe("Occura lifecycle and input compatibility", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "activeDocument", {
      configurable: true,
      value: document,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it("creates one status item and does not register a global keydown handler", async () => {
    const { app, emit } = createApp();
    const addWindowListener = vi.spyOn(window, "addEventListener");
    const plugin = new OccuraPlugin(app as never, {} as never) as OccuraPlugin & {
      _statusItems: HTMLElement[];
      _runCleanups(): void;
    };

    await plugin.onload();
    emit("layout-change");
    emit("layout-change");

    expect(plugin._statusItems).toHaveLength(1);
    expect(addWindowListener.mock.calls.some(([event]) => event === "keydown")).toBe(false);

    const event = new KeyboardEvent("keydown", { key: "F3", cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    plugin._runCleanups();
  });

  it("keeps all commands and clears stale status on view changes and disable", async () => {
    const { app, emit } = createApp();
    const plugin = new OccuraPlugin(app as never, {} as never) as OccuraPlugin & {
      _commands: Array<{ id: string }>;
      _runCleanups(): void;
    };
    await plugin.onload();

    expect(plugin._commands.map((command) => command.id)).toEqual([
      "toggle-highlight-occurrences",
      "toggle-keyword-highlighting",
      "go-to-next-occurrence",
      "go-to-previous-occurrence",
      "set-permanent-highlight-occurrences",
      "remove-permanent-highlight-occurrences",
      "create-tag-for-occurrences",
      "remove-tag-from-occurrences",
    ]);

    plugin.setOccurrenceStatus("word", 17, 2);
    expect(plugin.statusBarOccurrencesNumber?.textContent).toContain("(3/17)");
    emit("active-leaf-change");
    expect(plugin.statusBarOccurrencesNumber?.textContent).toBe("");

    plugin.setOccurrenceStatus("word", 17, null);
    plugin.toggleHighlighting();
    expect(plugin.statusBarOccurrencesNumber?.textContent).toBe("");
    plugin._runCleanups();
  });

  it("uses editor callbacks without clearing the selection after toolbar interaction", async () => {
    const { app } = createApp();
    const plugin = new OccuraPlugin(app as never, {} as never) as OccuraPlugin & {
      _commands: Array<{
        id: string;
        editorCallback?: (editor: unknown) => void;
      }>;
      _runCleanups(): void;
    };
    await plugin.onload();

    const transaction = vi.fn();
    const setCursor = vi.fn();
    const editor = {
      getSelection: () => "word",
      getValue: () => "word word",
      offsetToPos: (offset: number) => ({ line: 0, ch: offset }),
      transaction,
      setCursor,
    };
    const toolbarButton = document.createElement("button");
    toolbarButton.click();

    plugin._commands
      .find((command) => command.id === "set-permanent-highlight-occurrences")
      ?.editorCallback?.(editor);

    expect(editor.getSelection()).toBe("word");
    expect(setCursor).not.toHaveBeenCalled();
    expect(transaction).toHaveBeenCalledTimes(1);
    plugin._runCleanups();
  });
});
