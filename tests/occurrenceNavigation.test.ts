import { describe, expect, it } from "vitest";
import {
  collectDocumentMatches,
  getTargetOccurrenceIndex,
} from "src/occurenceNavigation";

describe("collectDocumentMatches", () => {
  it("collects ranges and resets a reused regex", () => {
    const re = /one/g;
    re.lastIndex = 4;

    expect(collectDocumentMatches("one two one", re)).toEqual([
      { from: 0, to: 3 },
      { from: 8, to: 11 },
    ]);
  });

  it("skips zero-length matches without looping forever", () => {
    expect(collectDocumentMatches("abc", /(?:)/g)).toEqual([]);
  });
});

describe("getTargetOccurrenceIndex", () => {
  const matches = [
    { from: 0, to: 3 },
    { from: 5, to: 8 },
    { from: 10, to: 13 },
  ];

  it("moves from the current match and wraps in both directions", () => {
    expect(getTargetOccurrenceIndex(matches, 5, 8, "next")).toBe(2);
    expect(getTargetOccurrenceIndex(matches, 10, 13, "next")).toBe(0);
    expect(getTargetOccurrenceIndex(matches, 5, 8, "previous")).toBe(0);
    expect(getTargetOccurrenceIndex(matches, 0, 3, "previous")).toBe(2);
  });

  it("chooses the nearest match from a non-matching selection", () => {
    expect(getTargetOccurrenceIndex(matches, 3, 4, "next")).toBe(1);
    expect(getTargetOccurrenceIndex(matches, 8, 9, "previous")).toBe(1);
    expect(getTargetOccurrenceIndex(matches, 20, 20, "next")).toBe(0);
    expect(getTargetOccurrenceIndex(matches, 0, 0, "previous")).toBe(2);
  });
});
