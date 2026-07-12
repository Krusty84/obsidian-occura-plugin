import { beforeEach, describe, expect, it } from "vitest";
import { registerKeywordReadingViewPostProcessor } from "src/readingViewKeywords";

type Group = {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  enabled: boolean;
  caseSensitive: boolean;
};

function highlight(html: string, groups: Group[], enabled = true): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.appendChild(root);

  let processor: ((el: HTMLElement) => void) | undefined;
  const plugin = {
    settings: {
      occuraPluginEnabled: enabled,
      autoKeywordsHighlightEnabled: true,
      keywordGroups: groups,
    },
    registerMarkdownPostProcessor(callback: (el: HTMLElement) => void) {
      processor = callback;
    },
  };

  registerKeywordReadingViewPostProcessor(plugin as never);
  processor?.(root);
  return root;
}

function group(overrides: Partial<Group> = {}): Group {
  return {
    id: "first",
    name: "First",
    color: "#ff0000",
    keywords: ["word"],
    enabled: true,
    caseSensitive: false,
    ...overrides,
  };
}

describe("Reading View keyword classes", () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it("uses enabled, non-blank keywords and whole-word matching", () => {
    const root = highlight("<p>Word sword word</p>", [
      group({ keywords: [" word ", "  "] }),
      group({ id: "disabled", keywords: ["sword"], enabled: false }),
    ]);
    const marks = Array.from(root.querySelectorAll("mark"));

    expect(marks.map((mark) => mark.textContent)).toEqual(["Word", "word"]);
    expect(marks[0].getAttribute("data-occura-group-id")).toBe("first");
    expect((marks[0] as HTMLElement).style.backgroundColor).toBe("rgb(255, 0, 0)");
  });

  it("honors case sensitivity and the master enabled setting", () => {
    const caseSensitive = highlight("<p>Word word</p>", [group({ caseSensitive: true })]);
    expect(Array.from(caseSensitive.querySelectorAll("mark"), (mark) => mark.textContent)).toEqual([
      "word",
    ]);

    const disabled = highlight("<p>word</p>", [group()], false);
    expect(disabled.querySelectorAll("mark")).toHaveLength(0);
  });

  it("selects the longest overlapping punctuation match", () => {
    const root = highlight("<p>C++</p>", [
      group({ keywords: ["C+", "C++"], caseSensitive: true }),
    ]);

    expect(root.querySelector("mark")?.textContent).toBe("C++");
    expect(root.querySelectorAll("mark")).toHaveLength(1);
  });

  it("uses earlier group precedence for identical matches", () => {
    const root = highlight("<p>word</p>", [
      group(),
      group({ id: "second", name: "Second", color: "#0000ff" }),
    ]);
    const mark = root.querySelector("mark") as HTMLElement;

    expect(mark.dataset.occuraGroupId).toBe("first");
    expect(mark.dataset.occuraGroupName).toBe("First");
  });

  it("skips excluded elements and existing keyword marks", () => {
    const root = highlight(`
      <p>word</p><code>word</code><a>word</a><div class="metadata-container">word</div>
      <textarea>word</textarea><button>word</button><div class="math-block">word</div>
      <mark class="occura-keyword-reading-occurrence">word</mark>
    `, [group()]);

    expect(root.querySelectorAll("mark.occura-keyword-reading-occurrence")).toHaveLength(2);
    expect(root.querySelectorAll("code mark, a mark, .metadata-container mark, textarea mark, button mark, .math-block mark")).toHaveLength(0);
  });
});
