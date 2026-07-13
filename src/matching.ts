export interface MatchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  minimumLength: number;
}

export interface TextMatch {
  from: number;
  to: number;
}

const UNICODE_WORD_CHARACTER = /^[\p{L}\p{M}\p{N}\p{Pc}]$/u;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function codePointAt(text: string, index: number): string | null {
  if (index < 0 || index >= text.length) return null;
  const value = text.codePointAt(index);
  return value === undefined ? null : String.fromCodePoint(value);
}

function codePointBefore(text: string, index: number): string | null {
  if (index <= 0 || index > text.length) return null;

  let start = index - 1;
  const codeUnit = text.charCodeAt(start);
  if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff && start > 0) {
    const previous = text.charCodeAt(start - 1);
    if (previous >= 0xd800 && previous <= 0xdbff) start--;
  }

  return text.slice(start, index);
}

function firstCodePoint(text: string): string | null {
  return codePointAt(text, 0);
}

function lastCodePoint(text: string): string | null {
  return codePointBefore(text, text.length);
}

function isUnicodeWordCharacter(value: string | null): boolean {
  return value !== null && UNICODE_WORD_CHARACTER.test(value);
}

function hasWholeWordBoundaries(
  text: string,
  query: string,
  from: number,
  to: number,
): boolean {
  const needsStartBoundary = isUnicodeWordCharacter(firstCodePoint(query));
  const needsEndBoundary = isUnicodeWordCharacter(lastCodePoint(query));

  if (
    needsStartBoundary &&
    isUnicodeWordCharacter(codePointBefore(text, from))
  ) {
    return false;
  }

  if (needsEndBoundary && isUnicodeWordCharacter(codePointAt(text, to))) {
    return false;
  }

  return true;
}

export function findMatches(
  text: string,
  query: string,
  options: MatchOptions,
): TextMatch[] {
  if (!query) return [];

  const minimumLength = Math.max(0, Math.floor(options.minimumLength));
  if (Array.from(query).length < minimumLength) return [];

  const flags = options.caseSensitive ? "gu" : "giu";
  const expression = new RegExp(escapeRegex(query), flags);
  const matches: TextMatch[] = [];

  let match: RegExpExecArray | null;
  while ((match = expression.exec(text))) {
    const matchedText = match[0];
    if (matchedText.length === 0) {
      expression.lastIndex++;
      continue;
    }

    const from = match.index;
    const to = from + matchedText.length;
    if (
      options.wholeWord &&
      !hasWholeWordBoundaries(text, query, from, to)
    ) {
      continue;
    }

    matches.push({ from, to });
  }

  return matches;
}
