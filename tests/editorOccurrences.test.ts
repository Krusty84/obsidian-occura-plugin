import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getEditorOccurrenceSnapshot,
  getVisibleMatches,
  highlightOccurrenceExtension,
} from "src/editorOccurrences";
import { DEFAULT_SETTINGS } from "src/settings";

function settings(overrides = {}) {
  return {
    ...DEFAULT_SETTINGS,
    keywordGroups: [],
    ...overrides,
  };
}

function createHost(overrides = {}) {
  return {
    settings: settings(overrides),
    clearOccurrenceStatus: vi.fn(),
    isEditorViewActive: () => true,
    setOccurrenceStatus: vi.fn(),
  };
}

function createView(doc: string, selection: { anchor: number; head: number }, host: ReturnType<typeof createHost>) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection,
      extensions: [highlightOccurrenceExtension(host)],
    }),
  });
}

describe("editor occurrences", () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it("uses complete-document matches while filtering decorations to viewports", () => {
    const state = EditorState.create({
      doc: "word hidden word visible word",
      selection: { anchor: 0, head: 4 },
    });
    const view = { state } as EditorView;
    const snapshot = getEditorOccurrenceSnapshot(view, settings());

    expect(snapshot?.matches).toHaveLength(3);
    expect(getVisibleMatches(snapshot?.matches ?? [], [{ from: 10, to: 27 }])).toEqual([
      { from: 12, to: 16 },
      { from: 25, to: 29 },
    ]);
  });

  it("reuses the full-document match list for an unchanged document and query", () => {
    const state = EditorState.create({
      doc: "alpha alpha",
      selection: { anchor: 0, head: 5 },
    });
    const view = { state } as EditorView;

    const first = getEditorOccurrenceSnapshot(view, settings());
    const second = getEditorOccurrenceSnapshot(view, settings());
    expect(second?.matches).toBe(first?.matches);
  });

  it("does not process a one-character selection at the safe default", () => {
    vi.useFakeTimers();
    const host = createHost();
    const view = createView("$ $ $", { anchor: 0, head: 1 }, host);

    vi.advanceTimersByTime(500);
    expect(host.setOccurrenceStatus).not.toHaveBeenCalled();
    view.destroy();
  });

  it("replaces rapid pending selection work and keeps the final query", () => {
    vi.useFakeTimers();
    const host = createHost();
    const view = createView("alpha beta alpha beta", { anchor: 0, head: 5 }, host);

    view.dispatch({ selection: { anchor: 6, head: 10 } });
    vi.advanceTimersByTime(119);
    expect(host.setOccurrenceStatus).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);

    expect(host.setOccurrenceStatus).toHaveBeenCalledTimes(1);
    expect(host.setOccurrenceStatus).toHaveBeenCalledWith("beta", 2, 0);
    view.destroy();
  });

  it("cancels pending work when the editor extension is destroyed", () => {
    vi.useFakeTimers();
    const host = createHost();
    const view = createView("alpha alpha", { anchor: 0, head: 5 }, host);

    view.destroy();
    vi.advanceTimersByTime(500);
    expect(host.setOccurrenceStatus).not.toHaveBeenCalled();
  });
});
