import { beforeEach, describe, expect, it } from "vitest";
import { Platform } from "obsidian";
import {
  getDefaultNextOccurrenceHotkey,
  getDefaultPreviousOccurrenceHotkey,
  hotkeyMatchesEvent,
  normalizeNavigationHotkey,
  parseHotkeyString,
} from "src/helpers";

describe("hotkey helpers", () => {
  beforeEach(() => {
    Platform.isMacOS = false;
  });

  it("parses modifier aliases, casing, and whitespace", () => {
    expect(parseHotkeyString(" ctrl + SHIFT + option + k ")).toEqual({
      key: "K",
      modifiers: {
        ctrlKey: true,
        shiftKey: true,
        altKey: true,
        metaKey: false,
      },
    });
    expect(parseHotkeyString("Cmd+Meta+X").modifiers.metaKey).toBe(true);
  });

  it("ignores unknown modifiers and handles an empty hotkey", () => {
    expect(parseHotkeyString("Unknown+F3")).toEqual({
      key: "F3",
      modifiers: {
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
      },
    });
    expect(parseHotkeyString("  ").key).toBe("");
  });

  it("maps Mod to the current platform", () => {
    expect(parseHotkeyString("Mod+G").modifiers.ctrlKey).toBe(true);

    Platform.isMacOS = true;
    expect(parseHotkeyString("Mod+G").modifiers).toEqual({
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: true,
    });
  });

  it("matches normalized arrow keys and requires exact modifiers", () => {
    expect(
      hotkeyMatchesEvent(
        new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true }),
        "Shift+Down",
      ),
    ).toBe(true);
    expect(
      hotkeyMatchesEvent(
        new KeyboardEvent("keydown", { key: "F3", ctrlKey: true }),
        "F3",
      ),
    ).toBe(false);
  });

  it("returns platform-specific defaults", () => {
    expect(getDefaultNextOccurrenceHotkey()).toBe("F3");
    expect(getDefaultPreviousOccurrenceHotkey()).toBe("Shift+F3");

    Platform.isMacOS = true;
    expect(getDefaultNextOccurrenceHotkey()).toBe("Mod+Shift+D");
    expect(getDefaultPreviousOccurrenceHotkey()).toBe("Mod+Shift+R");
  });

  it("normalizes comma-separated platform alternatives and fallbacks", () => {
    expect(normalizeNavigationHotkey(" Mod+G, F3 ", "fallback")).toBe("F3");
    expect(normalizeNavigationHotkey("", "fallback")).toBe("fallback");
    expect(normalizeNavigationHotkey("Shift+F3", "fallback")).toBe("Shift+F3");

    Platform.isMacOS = true;
    expect(normalizeNavigationHotkey("F3, Cmd+G", "fallback")).toBe("Cmd+G");
    expect(normalizeNavigationHotkey("F3, Shift+F3", "fallback")).toBe("F3");
  });
});
