import type OccuraPlugin from 'main';
import { MarkdownView, Notice } from 'obsidian';
import {
    buildRegex,
    getCodeMirrorEditor,
    isSelectionTextValidForNavigation,
} from 'src/highlighter';
import {
    applyReadingViewDynamicHighlights,
    getReadingViewDynamicOccurrenceQuery,
    getReadingViewDynamicOccurrenceMarks,
    getReadingViewRootFromSelection,
    selectReadingViewOccurrence,
} from 'src/readingViewDynamicOccurrences';

export type OccuraNavigationDirection = 'next' | 'previous';

type OccuraMatch = {
    from: number;
    to: number;
};

type OccuraPreviewMatch = {
    mark: HTMLElement;
    range: Range;
};

export function collectDocumentMatches(docText: string, re: RegExp): OccuraMatch[] {
    const matches: OccuraMatch[] = [];
    re.lastIndex = 0;

    let m: RegExpExecArray | null;
    while ((m = re.exec(docText))) {
        if (m[0].length === 0) {
            re.lastIndex++;
            continue;
        }

        matches.push({
            from: m.index,
            to: m.index + m[0].length,
        });
    }

    return matches;
}

export function getTargetOccurrenceIndex(
    matches: OccuraMatch[],
    selFrom: number,
    selTo: number,
    direction: OccuraNavigationDirection,
): number {
    const currentIndex = matches.findIndex(
        m => m.from === selFrom && m.to === selTo,
    );

    if (direction === 'next') {
        if (currentIndex >= 0) return (currentIndex + 1) % matches.length;

        const nextIndex = matches.findIndex(m => m.from >= selTo);
        return nextIndex >= 0 ? nextIndex : 0;
    }

    if (currentIndex >= 0) return (currentIndex - 1 + matches.length) % matches.length;

    for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i].to <= selFrom) return i;
    }

    return matches.length - 1;
}

export function navigateOccurrence(
    context: OccuraPlugin,
    direction: OccuraNavigationDirection,
): void {
    if (!context.settings.occuraPluginEnabled) {
        new Notice('Please enable Occura');
        return;
    }

    const view = context.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) {
        new Notice('No active editor');
        return;
    }

    if (view.getMode() === 'preview') {
        navigateReadingViewOccurrence(context, view, direction);
        return;
    }

    const cm = getCodeMirrorEditor(view.editor);
    if (!cm) {
        new Notice('No active editor');
        return;
    }

    const sel = cm.state.selection.main;
    if (sel.empty) {
        new Notice('Select text to navigate occurrences.');
        return;
    }

    const txt = cm.state.doc.sliceString(sel.from, sel.to).trim();
    if (!isSelectionTextValidForNavigation(txt, context.settings)) {
        new Notice('Select text to navigate occurrences.');
        return;
    }

    const re = buildRegex(txt, context.settings.occuraCaseSensitive, false);
    const docText = cm.state.doc.sliceString(0, cm.state.doc.length);
    const matches = collectDocumentMatches(docText, re);
    if (matches.length === 0) {
        new Notice('No occurrences found.');
        return;
    }

    const targetIndex = getTargetOccurrenceIndex(matches, sel.from, sel.to, direction);
    const target = matches[targetIndex];

    cm.dispatch({
        selection: { anchor: target.from, head: target.to },
        scrollIntoView: true,
        userEvent: 'select.search',
    });
    cm.focus();

    if (
        context.statusBarOccurrencesNumber &&
        context.settings.statusBarOccurrencesNumberEnabled
    ) {
        context.statusBarOccurrencesNumber.setText(
            `Occura found: ${txt} ${matches.length} times (${targetIndex + 1}/${matches.length})`,
        );
    }

    if (matches.length === 1) {
        new Notice('Only one occurrence found.');
    }
}

function navigateReadingViewOccurrence(
    context: OccuraPlugin,
    view: MarkdownView,
    direction: OccuraNavigationDirection,
): void {
    const root = view.containerEl.querySelector('.markdown-preview-view');
    if (!(root instanceof HTMLElement)) {
        new Notice('No active Reading View.');
        return;
    }

    const selection = view.containerEl.doc.getSelection();
    const hasSelection = !!selection && selection.rangeCount > 0 && !selection.isCollapsed;
    const selectionRoot = hasSelection && selection
        ? getReadingViewRootFromSelection(selection)
        : null;

    let txt: string | null = null;
    if (hasSelection && selection && selectionRoot === root) {
        const selectedText = selection.toString().trim();
        if (isSelectionTextValidForNavigation(selectedText, context.settings)) {
            txt = selectedText;
        }
    }

    if (!txt) {
        txt = getReadingViewDynamicOccurrenceQuery(root);
    }

    if (!txt) {
        new Notice('Select text in Reading View to navigate occurrences.');
        return;
    }

    let marks = getReadingViewDynamicOccurrenceMarks(root, txt);
    if (marks.length === 0) {
        applyReadingViewDynamicHighlights(root, txt, context);
        marks = getReadingViewDynamicOccurrenceMarks(root, txt);
    }

    if (marks.length === 0) {
        new Notice('No occurrences found.');
        return;
    }

    const selectionRange = hasSelection && selection
        ? selection.getRangeAt(0)
        : createMarkRange(marks[0]);
    const matches = marks.map(mark => ({
        mark,
        range: createMarkRange(mark),
    }));
    const targetIndex = getTargetPreviewOccurrenceIndex(
        matches,
        selectionRange,
        direction,
    );
    const target = matches[targetIndex];

    selectReadingViewOccurrence(target.mark);

    if (
        context.statusBarOccurrencesNumber &&
        context.settings.statusBarOccurrencesNumberEnabled
    ) {
        context.statusBarOccurrencesNumber.setText(
            `Occura found: ${txt} ${matches.length} times (${targetIndex + 1}/${matches.length})`,
        );
    }

    if (matches.length === 1) {
        new Notice('Only one occurrence found.');
    }
}

function createMarkRange(mark: HTMLElement): Range {
    const range = mark.ownerDocument.createRange();
    range.selectNodeContents(mark);
    return range;
}

function getTargetPreviewOccurrenceIndex(
    matches: OccuraPreviewMatch[],
    selectionRange: Range,
    direction: OccuraNavigationDirection,
): number {
    const currentIndex = matches.findIndex(match =>
        selectionRange.intersectsNode(match.mark),
    );

    if (direction === 'next') {
        if (currentIndex >= 0) return (currentIndex + 1) % matches.length;

        const nextIndex = matches.findIndex(match =>
            selectionRange.compareBoundaryPoints(Range.END_TO_START, match.range) <= 0,
        );
        return nextIndex >= 0 ? nextIndex : 0;
    }

    if (currentIndex >= 0) return (currentIndex - 1 + matches.length) % matches.length;

    for (let i = matches.length - 1; i >= 0; i--) {
        if (selectionRange.compareBoundaryPoints(Range.START_TO_END, matches[i].range) >= 0) {
            return i;
        }
    }

    return matches.length - 1;
}
