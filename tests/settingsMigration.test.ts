import { describe, expect, it } from "vitest";
import { migrateSettings } from "src/settingsMigration";

describe("migrateSettings", () => {
  it("removes obsolete hotkeys and preserves keyword groups", () => {
    const keywordGroups = [
      {
        id: "group-1",
        name: "Terms",
        color: "#123456",
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
    expect(migrateSettings({ minimumSelectionLength: 0 }).settings.minimumSelectionLength).toBe(2);
    expect(migrateSettings({ minimumSelectionLength: Number.NaN }).settings.minimumSelectionLength).toBe(2);
    expect(migrateSettings({ minimumSelectionLength: 4.8 }).settings.minimumSelectionLength).toBe(4);
  });
});
