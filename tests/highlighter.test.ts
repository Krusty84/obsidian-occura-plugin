import { describe, expect, it } from "vitest";
import {
  buildRegex,
  isSelectionTextValidForNavigation,
} from "src/highlighter";

function matches(text: string, re: RegExp): string[] {
  return Array.from(text.matchAll(re), (match) => match[0]);
}

describe("buildRegex", () => {
  it("escapes regular-expression metacharacters", () => {
    expect(matches("a+b aab a+b", buildRegex("a+b", true, false))).toEqual([
      "a+b",
      "a+b",
    ]);
  });

  it("supports case-sensitive and case-insensitive global matching", () => {
    expect(matches("Word word WORD", buildRegex("word", true))).toEqual(["word"]);
    expect(matches("Word word WORD", buildRegex("word", false))).toEqual([
      "Word",
      "word",
      "WORD",
    ]);
  });

  it("adds whole-word boundaries only for simple words", () => {
    expect(matches("cat scatter cat_ cat", buildRegex("cat", true))).toEqual([
      "cat",
      "cat",
    ]);
    expect(matches("C++ C+++", buildRegex("C++", true))).toEqual(["C++", "C++"]);
    expect(matches("ice cream ice cream", buildRegex("ice cream", true))).toEqual([
      "ice cream",
      "ice cream",
    ]);
  });
});

describe("isSelectionTextValidForNavigation", () => {
  const settings = { allowPhraseSelectionHighlighting: false } as never;

  it("rejects empty, multiline, and disallowed whitespace selections", () => {
    expect(isSelectionTextValidForNavigation("", settings)).toBe(false);
    expect(isSelectionTextValidForNavigation("two words", settings)).toBe(false);
    expect(isSelectionTextValidForNavigation("two\nwords", settings)).toBe(false);
  });

  it("accepts a word and optionally accepts a single-line phrase", () => {
    expect(isSelectionTextValidForNavigation("word", settings)).toBe(true);
    expect(
      isSelectionTextValidForNavigation(
        "two words",
        { allowPhraseSelectionHighlighting: true } as never,
      ),
    ).toBe(true);
  });
});
