import { Notice, type Editor } from "obsidian";
import { findMatches, type TextMatch } from "src/matching";

export type MarkdownMutationKind =
  | "add-highlight"
  | "remove-highlight"
  | "add-tag"
  | "remove-tag";

export interface PlannedTextChange {
  from: number;
  to: number;
  insert: string;
}

export interface MarkdownMutationPlan {
  changes: PlannedTextChange[];
  count: number;
}

type SourceRange = TextMatch;

const HTML_BLOCK_TAGS = new Set([
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul",
]);

const RAW_HTML_TAGS = new Set(["pre", "script", "style", "textarea"]);
const TAG_TOKEN = /#+[\p{L}\p{M}\p{N}\p{Pc}][\p{L}\p{M}\p{N}\p{Pc}/-]*/gu;

interface SourceLine {
  from: number;
  contentTo: number;
  to: number;
  text: string;
}

function getLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  let from = 0;

  while (from < text.length) {
    const newline = text.indexOf("\n", from);
    const to = newline < 0 ? text.length : newline + 1;
    const contentTo = newline < 0 ? text.length : newline;
    const carriageReturn =
      contentTo > from && text.charAt(contentTo - 1) === "\r" ? 1 : 0;
    lines.push({
      from,
      contentTo: contentTo - carriageReturn,
      to,
      text: text.slice(from, contentTo - carriageReturn),
    });
    from = to;
  }

  return lines;
}

function mergeRanges(ranges: SourceRange[]): SourceRange[] {
  if (ranges.length === 0) return [];
  const sorted = [...ranges].sort((left, right) => left.from - right.from || left.to - right.to);
  const merged: SourceRange[] = [{ ...sorted[0] }];

  for (let index = 1; index < sorted.length; index++) {
    const current = sorted[index];
    const previous = merged[merged.length - 1];
    if (current.from <= previous.to) previous.to = Math.max(previous.to, current.to);
    else merged.push({ ...current });
  }

  return merged;
}

function overlapsProtected(range: SourceRange, protectedRanges: SourceRange[]): boolean {
  return protectedRanges.some(
    (protectedRange) =>
      range.from < protectedRange.to && range.to > protectedRange.from,
  );
}

function isEscaped(text: string, index: number): boolean {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text.charAt(cursor) === "\\"; cursor--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function findLineEnd(text: string, from: number): number {
  const newline = text.indexOf("\n", from);
  return newline < 0 ? text.length : newline + 1;
}

function addFrontmatterAndFences(text: string, ranges: SourceRange[]): void {
  const lines = getLines(text);
  let index = 0;

  if (lines[0]?.text === "---") {
    let closing = 1;
    while (closing < lines.length && !/^(---|\.\.\.)\s*$/.test(lines[closing].text)) {
      closing++;
    }
    ranges.push({
      from: lines[0].from,
      to: closing < lines.length ? lines[closing].to : text.length,
    });
    index = closing < lines.length ? closing + 1 : lines.length;
  }

  while (index < lines.length) {
    const opener = /^( {0,3})(`{3,}|~{3,})/.exec(lines[index].text);
    if (!opener) {
      index++;
      continue;
    }

    const marker = opener[2].charAt(0);
    const minimumLength = opener[2].length;
    const closingPattern = new RegExp(
      `^ {0,3}${marker === "`" ? "`" : "~"}{${minimumLength},}\\s*$`,
    );
    let closing = index + 1;
    while (closing < lines.length && !closingPattern.test(lines[closing].text)) {
      closing++;
    }

    ranges.push({
      from: lines[index].from,
      to: closing < lines.length ? lines[closing].to : text.length,
    });
    index = closing < lines.length ? closing + 1 : lines.length;
  }
}

function addHtmlBlocks(text: string, ranges: SourceRange[]): void {
  const commentPattern = /<!--[\s\S]*?(?:-->|$)/g;
  let comment: RegExpExecArray | null;
  while ((comment = commentPattern.exec(text))) {
    ranges.push({ from: comment.index, to: comment.index + comment[0].length });
  }

  const lines = getLines(text);
  for (let index = 0; index < lines.length; index++) {
    const opener = /^ {0,3}<([A-Za-z][\w-]*)(?:\s|>|\/)/.exec(lines[index].text);
    if (!opener) continue;
    const tag = opener[1].toLowerCase();
    if (!HTML_BLOCK_TAGS.has(tag) && !RAW_HTML_TAGS.has(tag)) continue;

    const closingPattern = new RegExp(`</${tag}\\s*>`, "i");
    let closing = index;
    while (closing < lines.length && !closingPattern.test(lines[closing].text)) {
      if (
        closing > index &&
        !RAW_HTML_TAGS.has(tag) &&
        lines[closing].text.trim() === ""
      ) {
        break;
      }
      closing++;
    }

    ranges.push({
      from: lines[index].from,
      to: closing < lines.length ? lines[closing].to : text.length,
    });
    index = closing;
  }
}

function addInlineCode(text: string, ranges: SourceRange[]): void {
  const baseRanges = mergeRanges(ranges);
  for (let index = 0; index < text.length; index++) {
    if (text.charAt(index) !== "`" || isEscaped(text, index)) continue;
    if (overlapsProtected({ from: index, to: index + 1 }, baseRanges)) continue;

    let runLength = 1;
    while (text.charAt(index + runLength) === "`") runLength++;
    const marker = "`".repeat(runLength);
    const closing = text.indexOf(marker, index + runLength);
    const to = closing < 0 ? findLineEnd(text, index) : closing + runLength;
    ranges.push({ from: index, to });
    index = to - 1;
  }
}

function addWikiLinks(text: string, ranges: SourceRange[]): void {
  let protectedRanges = mergeRanges(ranges);
  for (let index = 0; index < text.length - 1; index++) {
    const isEmbed = text.startsWith("![[", index);
    const isLink = text.startsWith("[[", index);
    if ((!isEmbed && !isLink) || isEscaped(text, index)) continue;
    const from = isEmbed ? index : index;
    if (overlapsProtected({ from, to: from + (isEmbed ? 3 : 2) }, protectedRanges)) continue;

    const closing = text.indexOf("]]", index + (isEmbed ? 3 : 2));
    const to = closing < 0 ? findLineEnd(text, index) : closing + 2;
    ranges.push({ from, to });
    protectedRanges = mergeRanges(ranges);
    index = to - 1;
  }
}

function findClosingBracket(text: string, from: number): number {
  let depth = 1;
  for (let index = from + 1; index < text.length; index++) {
    if (isEscaped(text, index)) continue;
    const character = text.charAt(index);
    if (character === "[") depth++;
    if (character === "]" && --depth === 0) return index;
    if (character === "\n") return -1;
  }
  return -1;
}

function findClosingDestination(text: string, from: number): number {
  let depth = 1;
  for (let index = from + 1; index < text.length; index++) {
    if (isEscaped(text, index)) continue;
    const character = text.charAt(index);
    if (character === "(") depth++;
    if (character === ")" && --depth === 0) return index;
    if (character === "\n") return -1;
  }
  return -1;
}

function normalizeReference(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function addMarkdownLinks(text: string, ranges: SourceRange[]): void {
  const referenceIds = new Set<string>();
  const definitionPattern = /^ {0,3}\[([^\]]+)\]:[^\n]*(?:\n|$)/gm;
  let definition: RegExpExecArray | null;
  while ((definition = definitionPattern.exec(text))) {
    referenceIds.add(normalizeReference(definition[1]));
    ranges.push({ from: definition.index, to: definition.index + definition[0].length });
  }

  let protectedRanges = mergeRanges(ranges);
  for (let index = 0; index < text.length; index++) {
    if (text.charAt(index) !== "[" || isEscaped(text, index)) continue;
    const from = index > 0 && text.charAt(index - 1) === "!" ? index - 1 : index;
    if (overlapsProtected({ from, to: index + 1 }, protectedRanges)) continue;

    const labelEnd = findClosingBracket(text, index);
    if (labelEnd < 0) continue;
    const next = text.charAt(labelEnd + 1);
    let to = -1;

    if (next === "(") {
      const destinationEnd = findClosingDestination(text, labelEnd + 1);
      to = destinationEnd < 0 ? findLineEnd(text, from) : destinationEnd + 1;
    } else if (next === "[") {
      const referenceEnd = findClosingBracket(text, labelEnd + 1);
      to = referenceEnd < 0 ? findLineEnd(text, from) : referenceEnd + 1;
    } else {
      const label = normalizeReference(text.slice(index + 1, labelEnd));
      if (referenceIds.has(label)) to = labelEnd + 1;
    }

    if (to < 0) continue;
    ranges.push({ from, to });
    protectedRanges = mergeRanges(ranges);
    index = to - 1;
  }
}

function addHtmlTags(text: string, ranges: SourceRange[]): void {
  const protectedRanges = mergeRanges(ranges);
  const tagPattern = /<(?:!DOCTYPE\s+[^>]*|\?[^>]*\?|\/?[A-Za-z][^>\n]*)>/gi;
  let tag: RegExpExecArray | null;
  while ((tag = tagPattern.exec(text))) {
    const range = { from: tag.index, to: tag.index + tag[0].length };
    if (!overlapsProtected(range, protectedRanges)) ranges.push(range);
  }
}

function addExistingHighlights(text: string, ranges: SourceRange[]): void {
  let protectedRanges = mergeRanges(ranges);
  for (let index = 0; index < text.length - 1; index++) {
    if (!text.startsWith("==", index) || isEscaped(text, index)) continue;
    if (overlapsProtected({ from: index, to: index + 2 }, protectedRanges)) continue;
    const closing = text.indexOf("==", index + 2);
    const to = closing < 0 ? findLineEnd(text, index) : closing + 2;
    ranges.push({ from: index, to });
    protectedRanges = mergeRanges(ranges);
    index = to - 1;
  }
}

function addExistingTags(text: string, ranges: SourceRange[]): void {
  const protectedRanges = mergeRanges(ranges);
  TAG_TOKEN.lastIndex = 0;
  let token: RegExpExecArray | null;
  while ((token = TAG_TOKEN.exec(text))) {
    const range = { from: token.index, to: token.index + token[0].length };
    if (!isEscaped(text, token.index) && !overlapsProtected(range, protectedRanges)) {
      ranges.push(range);
    }
  }
}

function getBaseProtectedRanges(text: string): SourceRange[] {
  const ranges: SourceRange[] = [];
  addFrontmatterAndFences(text, ranges);
  addHtmlBlocks(text, ranges);
  addInlineCode(text, ranges);
  addWikiLinks(text, ranges);
  addMarkdownLinks(text, ranges);
  addHtmlTags(text, ranges);
  return mergeRanges(ranges);
}

function exactLiteralMatch(
  text: string,
  query: string,
  caseSensitive: boolean,
  wholeWord: boolean,
): boolean {
  const matches = findMatches(text, query, {
    caseSensitive,
    wholeWord,
    minimumLength: 1,
  });
  return matches.length === 1 && matches[0].from === 0 && matches[0].to === text.length;
}

function planAdditions(
  text: string,
  query: string,
  kind: "add-highlight" | "add-tag",
  caseSensitive: boolean,
): MarkdownMutationPlan {
  const protectedRanges = getBaseProtectedRanges(text);
  addExistingHighlights(text, protectedRanges);
  addExistingTags(text, protectedRanges);
  const merged = mergeRanges(protectedRanges);

  const matches = findMatches(text, query, {
    caseSensitive,
    wholeWord: kind === "add-tag",
    minimumLength: 1,
  }).filter((match) => !overlapsProtected(match, merged));

  const changes = matches.map((match) => ({
    from: match.from,
    to: match.to,
    insert:
      kind === "add-highlight"
        ? `==${text.slice(match.from, match.to)}==`
        : `#${text.slice(match.from, match.to)}`,
  }));
  return { changes, count: changes.length };
}

function planHighlightRemoval(
  text: string,
  query: string,
  caseSensitive: boolean,
): MarkdownMutationPlan {
  const protectedRanges = getBaseProtectedRanges(text);
  const changes: PlannedTextChange[] = [];

  for (let index = 0; index < text.length - 1; index++) {
    if (!text.startsWith("==", index) || isEscaped(text, index)) continue;
    if (overlapsProtected({ from: index, to: index + 2 }, protectedRanges)) continue;
    const closing = text.indexOf("==", index + 2);
    if (closing < 0) break;
    const content = text.slice(index + 2, closing);
    if (exactLiteralMatch(content, query, caseSensitive, false)) {
      changes.push({ from: index, to: closing + 2, insert: content });
    }
    index = closing + 1;
  }

  return { changes, count: changes.length };
}

function planTagRemoval(
  text: string,
  query: string,
  caseSensitive: boolean,
): MarkdownMutationPlan {
  const protectedRanges = getBaseProtectedRanges(text);
  const changes: PlannedTextChange[] = [];
  TAG_TOKEN.lastIndex = 0;

  let token: RegExpExecArray | null;
  while ((token = TAG_TOKEN.exec(text))) {
    if (token[0].startsWith("##")) continue;
    const range = { from: token.index, to: token.index + token[0].length };
    if (isEscaped(text, token.index) || overlapsProtected(range, protectedRanges)) continue;
    const content = token[0].slice(1);
    if (exactLiteralMatch(content, query, caseSensitive, true)) {
      changes.push({ from: token.index, to: token.index + 1, insert: "" });
    }
  }

  return { changes, count: changes.length };
}

export function planMarkdownMutation(
  text: string,
  query: string,
  kind: MarkdownMutationKind,
  caseSensitive: boolean,
): MarkdownMutationPlan {
  if (!query) return { changes: [], count: 0 };
  if (kind === "add-highlight" || kind === "add-tag") {
    return planAdditions(text, query, kind, caseSensitive);
  }
  if (kind === "remove-highlight") {
    return planHighlightRemoval(text, query, caseSensitive);
  }
  return planTagRemoval(text, query, caseSensitive);
}

const COMMAND_LABELS: Record<MarkdownMutationKind, string> = {
  "add-highlight": "Permanently highlighted",
  "remove-highlight": "Removed highlighting from",
  "add-tag": "Tagged",
  "remove-tag": "Removed tags from",
};

export function runMarkdownMutationCommand(
  editor: Editor,
  kind: MarkdownMutationKind,
  caseSensitive: boolean,
): void {
  const query = editor.getSelection().trim();
  if (!query || /\s/.test(query)) {
    new Notice("Select one word first.");
    return;
  }

  const plan = planMarkdownMutation(editor.getValue(), query, kind, caseSensitive);
  if (plan.count === 0) {
    new Notice("No occurrences can be safely changed.");
    return;
  }

  editor.transaction({
    changes: plan.changes.map((change) => ({
      from: editor.offsetToPos(change.from),
      to: editor.offsetToPos(change.to),
      text: change.insert,
    })),
  });
  new Notice(`${COMMAND_LABELS[kind]} ${plan.count} occurrences.`);
}
