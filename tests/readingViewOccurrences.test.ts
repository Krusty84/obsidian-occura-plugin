import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MarkdownView } from "obsidian";
import {
  applyReadingViewDynamicHighlights,
  getReadingViewDynamicOccurrenceMarks,
  getReadingViewDynamicOccurrenceQuery,
  registerReadingViewOccurrenceHighlighting,
} from "src/readingViewOccurrences";
import { DEFAULT_SETTINGS } from "src/settings";

let eventCleanups: Array<() => void> = [];

function createRoot(html: string): HTMLElement {
  const root = document.createElement("div");
  root.className = "markdown-preview-view";
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function createPlugin(roots: HTMLElement[], caseSensitive = false): any {
  const leaves = roots.map((root) => {
    const container = document.createElement("div");
    container.appendChild(root);
    return { view: new MarkdownView(container) };
  });

  return {
    settings: {
      ...DEFAULT_SETTINGS,
      occuraCaseSensitive: caseSensitive,
    },
    app: {
      workspace: {
        getLeavesOfType: () => leaves,
      },
    },
  };
}

function createControllerPlugin(root: HTMLElement): any {
  const container = document.createElement("div");
  container.appendChild(root);
  document.body.appendChild(container);
  Object.defineProperty(container, "doc", { value: document });
  const leaves = [{ view: new MarkdownView(container) }];

  return {
    settings: { ...DEFAULT_SETTINGS },
    clearOccurrenceStatus: vi.fn(),
    setOccurrenceStatus: vi.fn(),
    register: vi.fn(),
    registerDomEvent(target: Document, event: string, callback: EventListener) {
      target.addEventListener(event, callback);
      eventCleanups.push(() => target.removeEventListener(event, callback));
    },
    app: {
      workspace: {
        containerEl: { doc: document },
        getLeavesOfType: () => leaves,
        iterateAllLeaves(callback: (leaf: (typeof leaves)[number]) => void) {
          leaves.forEach(callback);
        },
      },
    },
  };
}

function selectText(node: Text, from: number, to: number): Selection {
  const selection = document.getSelection();
  if (!selection) throw new Error("Selection is unavailable");
  const range = document.createRange();
  range.setStart(node, from);
  range.setEnd(node, to);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

describe("Reading View occurrences", () => {
  beforeEach(() => {
    document.body.replaceChildren();
    eventCleanups = [];
    Object.defineProperty(globalThis, "activeDocument", {
      configurable: true,
      value: document,
    });
  });

  afterEach(() => {
    eventCleanups.forEach((cleanup) => cleanup());
    vi.useRealTimers();
  });

  it("wraps matches with query metadata and reports their count", () => {
    const root = createRoot("<p>Word word WORD</p>");
    const plugin = createPlugin([root]);

    expect(applyReadingViewDynamicHighlights(root, "word", plugin)).toBe(3);

    const marks = getReadingViewDynamicOccurrenceMarks(root, "word");
    expect(marks.map((mark) => mark.textContent)).toEqual(["Word", "word", "WORD"]);
    expect(marks.every((mark) => mark.classList.contains("found-occurrence"))).toBe(true);
    expect(getReadingViewDynamicOccurrenceQuery(root)).toBe("word");
  });

  it("honors case-sensitive matching", () => {
    const root = createRoot("<p>Word word WORD</p>");

    expect(applyReadingViewDynamicHighlights(root, "word", createPlugin([root], true))).toBe(1);
    expect(getReadingViewDynamicOccurrenceMarks(root, "word")[0].textContent).toBe("word");
  });

  it("clears previous highlights before applying a new query", () => {
    const root = createRoot("<p>alpha beta alpha</p>");
    const plugin = createPlugin([root]);

    applyReadingViewDynamicHighlights(root, "alpha", plugin);
    applyReadingViewDynamicHighlights(root, "beta", plugin);

    expect(getReadingViewDynamicOccurrenceMarks(root, "alpha")).toEqual([]);
    expect(getReadingViewDynamicOccurrenceMarks(root, "beta")).toHaveLength(1);
    expect(root.textContent).toBe("alpha beta alpha");
  });

  it("clears highlights in other Reading Views", () => {
    const first = createRoot("<p>alpha</p>");
    const second = createRoot("<p>beta</p>");
    const plugin = createPlugin([first, second]);

    applyReadingViewDynamicHighlights(first, "alpha", plugin);
    applyReadingViewDynamicHighlights(second, "beta", plugin);

    expect(getReadingViewDynamicOccurrenceMarks(first, "alpha")).toEqual([]);
    expect(getReadingViewDynamicOccurrenceMarks(second, "beta")).toHaveLength(1);
  });

  it("skips excluded Reading View elements", () => {
    const root = createRoot(`
      <p>word</p><code>word</code><a>word</a><div class="metadata-container">word</div>
      <input value="word"><textarea>word</textarea><button>word</button><select><option>word</option></select>
      <div class="math">word</div><div class="cm-editor">word</div>
    `);

    expect(applyReadingViewDynamicHighlights(root, "word", createPlugin([root]))).toBe(1);
    expect(getReadingViewDynamicOccurrenceMarks(root, "word")).toHaveLength(1);
  });

  it("waits for pointer completion before changing mobile selections", () => {
    vi.useFakeTimers();
    const root = createRoot("<p>word word</p>");
    const plugin = createControllerPlugin(root);
    registerReadingViewOccurrenceHighlighting(plugin);
    const text = root.querySelector("p")?.firstChild as Text;

    document.dispatchEvent(new Event("pointerdown"));
    selectText(text, 0, 4);
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(500);
    expect(getReadingViewDynamicOccurrenceMarks(root, "word")).toHaveLength(0);

    document.dispatchEvent(new Event("pointerup"));
    vi.advanceTimersByTime(120);
    expect(getReadingViewDynamicOccurrenceMarks(root, "word")).toHaveLength(2);
    expect(document.getSelection()?.toString()).toBe("word");
  });

  it("cancels pending work when a pointer gesture is cancelled", () => {
    vi.useFakeTimers();
    const root = createRoot("<p>word word</p>");
    const plugin = createControllerPlugin(root);
    registerReadingViewOccurrenceHighlighting(plugin);
    const text = root.querySelector("p")?.firstChild as Text;

    document.dispatchEvent(new Event("pointerdown"));
    selectText(text, 0, 4);
    document.dispatchEvent(new Event("selectionchange"));
    document.dispatchEvent(new Event("pointercancel"));
    vi.advanceTimersByTime(500);

    expect(getReadingViewDynamicOccurrenceMarks(root, "word")).toHaveLength(0);
    expect(document.getSelection()?.toString()).toBe("word");
  });

  it("replaces rapid Reading View selection work with the final query", () => {
    vi.useFakeTimers();
    const root = createRoot("<p>alpha beta alpha beta</p>");
    const plugin = createControllerPlugin(root);
    registerReadingViewOccurrenceHighlighting(plugin);
    const text = root.querySelector("p")?.firstChild as Text;

    selectText(text, 0, 5);
    document.dispatchEvent(new Event("selectionchange"));
    selectText(text, 6, 10);
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(120);

    expect(getReadingViewDynamicOccurrenceMarks(root, "alpha")).toHaveLength(0);
    expect(getReadingViewDynamicOccurrenceMarks(root, "beta")).toHaveLength(2);
    expect(document.getSelection()?.toString()).toBe("beta");
  });

  it("does not match a selected Unicode word inside a longer word", () => {
    const root = createRoot("<p>мир мирный МИР</p>");
    expect(applyReadingViewDynamicHighlights(root, "мир", createPlugin([root]))).toBe(2);
  });
});
