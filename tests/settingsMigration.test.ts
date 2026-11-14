/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import { describe, expect, it } from "vitest";
import { migrateSettings } from "src/settingsMigration";

describe("migrateSettings", () => {
  it("copies the legacy occurrence color to both schemes", () => {
    const { settings, changed } = migrateSettings({
      highlightColorOccurrences: "#123456",
    });

    expect(settings.highlightColorOccurrencesLight).toBe("#123456");
    expect(settings.highlightColorOccurrencesDark).toBe("#123456");
    expect(settings).not.toHaveProperty("highlightColorOccurrences");
    expect(changed).toBe(true);
  });

  it("preserves scheme colors and fills only missing colors", () => {
    const { settings } = migrateSettings({
      highlightColorOccurrences: "#123456",
      highlightColorOccurrencesDark: "#abcdef",
    });

    expect(settings.highlightColorOccurrencesLight).toBe("#123456");
    expect(settings.highlightColorOccurrencesDark).toBe("#abcdef");
    expect(migrateSettings(settings)).toEqual({ settings, changed: false });
  });

  it("uses yellow for both schemes on a new install", () => {
    const { settings } = migrateSettings(null);

    expect(settings.highlightColorOccurrencesLight).toBe("#FFFF00");
    expect(settings.highlightColorOccurrencesDark).toBe("#FFFF00");
  });

  it("migrates each keyword class color and preserves saved scheme colors", () => {
    const { settings, changed } = migrateSettings({
      keywordGroups: [
        { color: "#123456" },
        { color: "#abcdef", colorLight: "#ff0000" },
        { colorDark: "#0000ff" },
        {},
      ],
    });

    expect(
      settings.keywordGroups.map(({ colorLight, colorDark }) => [
        colorLight,
        colorDark,
      ]),
    ).toEqual([
      ["#123456", "#123456"],
      ["#ff0000", "#abcdef"],
      ["#66ccff", "#0000ff"],
      ["#66ccff", "#66ccff"],
    ]);
    expect(settings.keywordGroups[0]).not.toHaveProperty("color");
    expect(changed).toBe(true);
    expect(migrateSettings(JSON.parse(JSON.stringify(settings)))).toEqual({
      settings,
      changed: false,
    });
  });

  it("removes obsolete hotkeys and preserves keyword groups", () => {
    const keywordGroups = [
      {
        id: "group-1",
        name: "Terms",
        colorLight: "#123456",
        colorDark: "#654321",
        keywords: ["alpha", "beta"],
        enabled: true,
        caseSensitive: true,
      },
    ];

    const result = migrateSettings({
      occuraPluginEnabledHotKey: "Mod+E",
      nextOccurrenceHotkeys: "F3",
      previousOccurrenceHotkeys: "Shift+F3",
      keywordGroups,
    });

    expect(result.settings.keywordGroups).toEqual(keywordGroups);
    expect(result.settings.keywordGroups).not.toBe(keywordGroups);
    expect(result.settings).not.toHaveProperty("occuraPluginEnabledHotKey");
    expect(result.settings).not.toHaveProperty("nextOccurrenceHotkeys");
    expect(result.changed).toBe(true);
  });

  it("normalizes invalid minimum lengths and keeps valid integers", () => {
    expect(
      migrateSettings({ minimumSelectionLength: 0 }).settings
        .minimumSelectionLength,
    ).toBe(2);
    expect(
      migrateSettings({ minimumSelectionLength: Number.NaN }).settings
        .minimumSelectionLength,
    ).toBe(2);
    expect(
      migrateSettings({ minimumSelectionLength: 4.8 }).settings
        .minimumSelectionLength,
    ).toBe(4);
  });
});
