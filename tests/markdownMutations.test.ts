import { describe, expect, it, vi } from "vitest";
import {
  planMarkdownMutation,
  runMarkdownMutationCommand,
  type MarkdownMutationKind,
  type PlannedTextChange,
} from "src/markdownMutations";

function applyChanges(text: string, changes: PlannedTextChange[]): string {
  return [...changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (current, change) =>
        current.slice(0, change.from) + change.insert + current.slice(change.to),
      text,
    );
}

function mutate(
  text: string,
  query: string,
  kind: MarkdownMutationKind,
  caseSensitive = false,
) {
  const plan = planMarkdownMutation(text, query, kind, caseSensitive);
  return { plan, text: applyChanges(text, plan.changes) };
}

describe("Markdown mutation planning", () => {
  it("protects frontmatter, code, links, embeds, HTML, tags, and highlights", () => {
    const source = [
      "---",
      "title: word",
      "---",
      "# word",
      "plain word",
      "`word` and ``word``",
      "```ts",
      "word",
      "```",
      "[word](https://example.com/word)",
      "[word][ref] and [word]",
      "[ref]: https://example.com/word",
      "[[word|word]] ![[word]]",
      "<div>",
      "word",
      "</div>",
      "#word ==word==",
    ].join("\n");

    const result = mutate(source, "word", "add-highlight");
    expect(result.plan.changes.map((change) => source.slice(0, change.from).split("\n").length)).toEqual([
      4,
      5,
      11,
    ]);
    expect(result.text).toContain("# ==word==");
    expect(result.text).toContain("plain ==word==");
    expect(result.text).toContain("title: word");
    expect(result.text).toContain("`word` and ``word``");
    expect(result.text).toContain("[word](https://example.com/word)");
    expect(result.text).toContain("[[word|word]] ![[word]]");
    expect(result.text).toContain("#word ==word==");
  });

  it("protects existing tags and uses Unicode whole-token matching", () => {
    const result = mutate("мир мирный #мир ##мир", "мир", "add-tag");
    expect(result.plan.count).toBe(1);
    expect(result.text).toBe("#мир мирный #мир ##мир");
  });

  it("preserves source case and respects case sensitivity", () => {
    expect(mutate("Word word WORD", "word", "add-highlight").text).toBe(
      "==Word== ==word== ==WORD==",
    );
    expect(mutate("Word word WORD", "word", "add-highlight", true).text).toBe(
      "Word ==word== WORD",
    );
  });

  it("does not duplicate existing highlight markup on repeated execution", () => {
    const first = mutate("word word", "word", "add-highlight");
    const second = mutate(first.text, "word", "add-highlight");
    expect(first.text).toBe("==word== ==word==");
    expect(second.plan.count).toBe(0);
    expect(second.text).toBe(first.text);
  });

  it("removes only exact matching safe highlights", () => {
    const source = "==Word== ==other== `==Word==` [==Word==](url) ====Word====";
    const result = mutate(source, "word", "remove-highlight");
    expect(result.plan.count).toBe(1);
    expect(result.text).toBe("Word ==other== `==Word==` [==Word==](url) ====Word====");
  });

  it("removes only one hash from exact tag tokens", () => {
    const source = "#word ##word # word C# #wordy #Word";
    const result = mutate(source, "word", "remove-tag");
    expect(result.plan.count).toBe(2);
    expect(result.text).toBe("word ##word # word C# #wordy Word");
  });

  it("fails closed for unclosed fences and inline code", () => {
    expect(mutate("word\n```\nword", "word", "add-highlight").text).toBe(
      "==word==\n```\nword",
    );
    expect(mutate("word `word", "word", "add-highlight").text).toBe(
      "==word== `word",
    );
  });

  it("constructs all editor changes in one transaction", () => {
    const transaction = vi.fn();
    const editor = {
      getSelection: () => "word",
      getValue: () => "word word",
      offsetToPos: (offset: number) => ({ line: 0, ch: offset }),
      transaction,
    };

    runMarkdownMutationCommand(editor as never, "add-highlight", false);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0].changes).toHaveLength(2);
  });
});
