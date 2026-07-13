import { describe, expect, it } from "vitest";
import { findMatches, type MatchOptions } from "src/matching";

const WHOLE_WORD: MatchOptions = {
  caseSensitive: false,
  wholeWord: true,
  minimumLength: 1,
};

function matchedText(text: string, query: string, options = WHOLE_WORD): string[] {
  return findMatches(text, query, options).map((match) =>
    text.slice(match.from, match.to),
  );
}

describe("findMatches", () => {
  it("uses Unicode-aware boundaries for English and Cyrillic", () => {
    expect(matchedText("cat scatter Cat", "cat")).toEqual(["cat", "Cat"]);
    expect(matchedText("мир мирный МИР", "мир")).toEqual(["мир", "МИР"]);
  });

  it("supports letters with diacritics and combining marks", () => {
    expect(matchedText("café caféine CAFÉ", "café")).toEqual(["café", "CAFÉ"]);
    expect(matchedText("über übermut ÜBER", "über")).toEqual(["über", "ÜBER"]);
    expect(matchedText("e\u0301 e\u0301lan", "e\u0301")).toEqual(["e\u0301"]);
  });

  it("supports numeric and alphanumeric tokens", () => {
    expect(matchedText("123 1234 A123 A123x", "123")).toEqual(["123"]);
    expect(matchedText("A1 A12 xA1", "A1")).toEqual(["A1"]);
  });

  it("keeps phrases, C++, and punctuation-only queries literal", () => {
    expect(matchedText("C++ C+++ XC++", "C++")).toEqual(["C++", "C++"]);
    expect(matchedText("ice cream ice creams", "ice cream")).toEqual([
      "ice cream",
    ]);
    expect(matchedText("$ $$ $", "$", { ...WHOLE_WORD, wholeWord: true })).toEqual([
      "$",
      "$",
      "$",
      "$",
    ]);
    expect(matchedText("a+b aab a+b", "a+b", {
      ...WHOLE_WORD,
      wholeWord: false,
      caseSensitive: true,
    })).toEqual(["a+b", "a+b"]);
  });

  it("supports explicit substring and case-sensitive matching", () => {
    expect(matchedText("scatter cat", "cat", {
      ...WHOLE_WORD,
      wholeWord: false,
    })).toEqual(["cat", "cat"]);
    expect(matchedText("Word word WORD", "word", {
      ...WHOLE_WORD,
      caseSensitive: true,
    })).toEqual(["word"]);
  });

  it("enforces minimum length by Unicode code point", () => {
    expect(findMatches("$ $", "$", { ...WHOLE_WORD, minimumLength: 2 })).toEqual([]);
    expect(findMatches("😀 😀", "😀", { ...WHOLE_WORD, minimumLength: 1 })).toHaveLength(2);
    expect(findMatches("anything", "", WHOLE_WORD)).toEqual([]);
  });

  it("handles a large number of matches without changing the total", () => {
    const text = Array(20_000).fill("aa").join(" ");
    const matches = findMatches(text, "aa", WHOLE_WORD);
    expect(matches).toHaveLength(20_000);
    expect(matches[0]).toEqual({ from: 0, to: 2 });
    expect(matches[matches.length - 1].to).toBe(text.length);
  });
});
