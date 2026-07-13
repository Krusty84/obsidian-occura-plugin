import type OccuraPlugin from "main";
import { findMatches } from "src/matching";

type PreparedKeyword = {
  keyword: string;
  color: string;
  groupId: string;
  groupName: string;
  caseSensitive: boolean;
  groupIndex: number;
  keywordIndex: number;
};

type TextMatch = {
  from: number;
  to: number;
  color: string;
  groupId: string;
  groupName: string;
  groupIndex: number;
  keywordIndex: number;
};

const EXCLUDED_READING_VIEW_SELECTOR = [
  "code",
  "pre",
  "a",
  "script",
  "style",
  "textarea",
  "input",
  "button",
  "select",
  "svg",
  "canvas",
  "mark.occura-keyword-reading-occurrence",
  ".metadata-container",
  ".frontmatter",
  ".math",
  ".math-block",
  ".mjx-container",
].join(",");

export function registerKeywordReadingViewPostProcessor(
  plugin: OccuraPlugin,
): void {
  plugin.registerMarkdownPostProcessor(
    (el) => {
      highlightReadingViewKeywordClasses(el, plugin);
    },
    1000,
  );
}

function getPreparedKeywords(plugin: OccuraPlugin): PreparedKeyword[] {
  if (!plugin.settings.occuraPluginEnabled) return [];
  if (!plugin.settings.autoKeywordsHighlightEnabled) return [];
  if (!Array.isArray(plugin.settings.keywordGroups)) return [];

  const prepared: PreparedKeyword[] = [];

  plugin.settings.keywordGroups.forEach((group, groupIndex) => {
    if (!group?.enabled) return;

    const keywords = (group.keywords ?? [])
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    keywords.forEach((keyword, keywordIndex) => {
      prepared.push({
        keyword,
        color: group.color,
        groupId: group.id,
        groupName: group.name,
        caseSensitive: !!group.caseSensitive,
        groupIndex,
        keywordIndex,
      });
    });
  });

  return prepared;
}

function highlightReadingViewKeywordClasses(
  el: HTMLElement,
  plugin: OccuraPlugin,
): void {
  const keywords = getPreparedKeywords(plugin);
  if (keywords.length === 0) return;

  const textNodes = collectEligibleTextNodes(el);

  for (const textNode of textNodes) {
    wrapKeywordMatchesInTextNode(textNode, keywords);
  }
}

function collectEligibleTextNodes(root: HTMLElement): Text[] {
  const doc = root.ownerDocument;
  const win = doc.defaultView ?? window;
  const textNodes: Text[] = [];

  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof win.Text)) {
        return win.NodeFilter.FILTER_REJECT;
      }

      if (!node.nodeValue?.trim()) {
        return win.NodeFilter.FILTER_REJECT;
      }

      const parent = node.parentElement;
      if (!parent) {
        return win.NodeFilter.FILTER_REJECT;
      }

      if (shouldSkipElement(parent)) {
        return win.NodeFilter.FILTER_REJECT;
      }

      return win.NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    const currentNode = walker.currentNode;
    if (currentNode instanceof win.Text) {
      textNodes.push(currentNode);
    }
  }

  return textNodes;
}

function shouldSkipElement(element: Element): boolean {
  return !!element.closest(EXCLUDED_READING_VIEW_SELECTOR);
}

function collectMatchesForText(
  text: string,
  keywords: PreparedKeyword[],
): TextMatch[] {
  const candidates: TextMatch[] = [];

  for (const item of keywords) {
    for (const match of findMatches(text, item.keyword, {
      caseSensitive: item.caseSensitive,
      wholeWord: true,
      minimumLength: 1,
    })) {
      candidates.push({
        from: match.from,
        to: match.to,
        color: item.color,
        groupId: item.groupId,
        groupName: item.groupName,
        groupIndex: item.groupIndex,
        keywordIndex: item.keywordIndex,
      });
    }
  }

  candidates.sort(
    (a, b) =>
      a.from - b.from ||
      (b.to - b.from) - (a.to - a.from) ||
      a.groupIndex - b.groupIndex ||
      a.keywordIndex - b.keywordIndex,
  );

  const selected: TextMatch[] = [];
  let lastEnd = -1;

  for (const candidate of candidates) {
    if (candidate.from < lastEnd) continue;

    selected.push(candidate);
    lastEnd = candidate.to;
  }

  return selected;
}

function wrapKeywordMatchesInTextNode(
  textNode: Text,
  keywords: PreparedKeyword[],
): void {
  const text = textNode.nodeValue ?? "";
  const matches = collectMatchesForText(text, keywords);

  if (matches.length === 0) return;

  const doc = textNode.ownerDocument;
  const fragment = doc.createDocumentFragment();

  let cursor = 0;

  for (const match of matches) {
    if (match.from > cursor) {
      fragment.appendChild(doc.createTextNode(text.slice(cursor, match.from)));
    }

    const mark = doc.createElement("mark");
    mark.classList.add(
      "keyword-occurrence",
      "occura-keyword-reading-occurrence",
    );
    mark.style.backgroundColor = match.color;
    mark.dataset.occuraGroupId = match.groupId;
    mark.dataset.occuraGroupName = match.groupName;
    mark.textContent = text.slice(match.from, match.to);

    fragment.appendChild(mark);
    cursor = match.to;
  }

  if (cursor < text.length) {
    fragment.appendChild(doc.createTextNode(text.slice(cursor)));
  }

  textNode.parentNode?.replaceChild(fragment, textNode);
}
