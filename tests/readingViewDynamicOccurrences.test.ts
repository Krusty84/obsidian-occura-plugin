import { beforeEach, describe, expect, it } from "vitest";
import { MarkdownView } from "obsidian";
import {
  applyReadingViewDynamicHighlights,
  getReadingViewDynamicOccurrenceMarks,
  getReadingViewDynamicOccurrenceQuery,
} from "src/readingViewDynamicOccurrences";

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
    settings: { occuraCaseSensitive: caseSensitive },
    app: {
      workspace: {
        getLeavesOfType: () => leaves,
      },
    },
  };
}

describe("Reading View dynamic occurrences", () => {
  beforeEach(() => {
    document.body.replaceChildren();
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
});
