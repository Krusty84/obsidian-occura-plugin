/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

import {
  DEFAULT_SETTINGS,
  type KeywordGroup,
  type OccuraPluginSettings,
} from "src/settings";

export interface SettingsMigrationResult {
  settings: OccuraPluginSettings;
  changed: boolean;
}

const OBSOLETE_HOTKEY_KEYS = [
  "occuraPluginEnabledHotKey",
  "nextOccurrenceHotkeys",
  "previousOccurrenceHotkeys",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function migrateKeywordGroups(value: unknown): KeywordGroup[] {
  if (!Array.isArray(value)) return [];

  const groups: KeywordGroup[] = [];
  value.forEach((candidate, index) => {
    if (!isRecord(candidate)) return;

    const keywords = Array.isArray(candidate.keywords)
      ? candidate.keywords.filter(
          (keyword): keyword is string => typeof keyword === "string",
        )
      : [];

    groups.push({
      id: stringValue(candidate.id, `legacy-${index}`),
      name: stringValue(candidate.name, "Unnamed"),
      color: stringValue(candidate.color, "#66ccff"),
      keywords: [...keywords],
      enabled: booleanValue(candidate.enabled, true),
      caseSensitive: booleanValue(candidate.caseSensitive, false),
    });
  });

  return groups;
}

function migrateMinimumSelectionLength(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return DEFAULT_SETTINGS.minimumSelectionLength;
  }

  return Math.floor(value);
}

export function migrateSettings(raw: unknown): SettingsMigrationResult {
  const source = isRecord(raw) ? raw : {};
  const settings: OccuraPluginSettings = {
    highlightColorOccurrences: stringValue(
      source.highlightColorOccurrences,
      DEFAULT_SETTINGS.highlightColorOccurrences,
    ),
    highlightColorKeywords: stringValue(
      source.highlightColorKeywords,
      DEFAULT_SETTINGS.highlightColorKeywords,
    ),
    occuraPluginEnabled: booleanValue(
      source.occuraPluginEnabled,
      DEFAULT_SETTINGS.occuraPluginEnabled,
    ),
    statusBarOccurrencesNumberEnabled: booleanValue(
      source.statusBarOccurrencesNumberEnabled,
      DEFAULT_SETTINGS.statusBarOccurrencesNumberEnabled,
    ),
    keywords: Array.isArray(source.keywords)
      ? source.keywords.filter(
          (keyword): keyword is string => typeof keyword === "string",
        )
      : [],
    autoKeywordsHighlightEnabled: booleanValue(
      source.autoKeywordsHighlightEnabled,
      DEFAULT_SETTINGS.autoKeywordsHighlightEnabled,
    ),
    keywordsCaseSensitive: booleanValue(
      source.keywordsCaseSensitive,
      DEFAULT_SETTINGS.keywordsCaseSensitive,
    ),
    occuraCaseSensitive: booleanValue(
      source.occuraCaseSensitive,
      DEFAULT_SETTINGS.occuraCaseSensitive,
    ),
    allowPhraseSelectionHighlighting: booleanValue(
      source.allowPhraseSelectionHighlighting,
      DEFAULT_SETTINGS.allowPhraseSelectionHighlighting,
    ),
    minimumSelectionLength: migrateMinimumSelectionLength(
      source.minimumSelectionLength,
    ),
    keywordGroups: migrateKeywordGroups(source.keywordGroups),
  };

  const sourceWithoutHotkeys = { ...source };
  for (const key of OBSOLETE_HOTKEY_KEYS) delete sourceWithoutHotkeys[key];

  return {
    settings,
    changed: JSON.stringify(sourceWithoutHotkeys) !== JSON.stringify(settings),
  };
}
