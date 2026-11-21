# ADR-0001: Light and Dark highlight colors

**Status:** Accepted
**Date:** 2026-11-15
**Record Type:** Retrospective
**Evidence:** Mixed

## Context

Occura used one color for selected-text occurrences and one color per word class. Each color applied in both base color schemes.

## Decision

Store a Light color and a Dark color for selected-text occurrences and for each word class. Use CSS to select the color for the active Obsidian scheme. **Adapt to system** uses the color for the current system scheme.

## Rationale

CSS applies the color to existing highlights when the scheme changes.

## Alternatives

A separate color for **Adapt to system** would apply in both system schemes.

## Consequences

When Occura loads old settings, it copies the old color to each missing color field.

## Implementation

Occura sets CSS variables in each workspace document from `highlightColorOccurrencesLight` and `highlightColorOccurrencesDark`. Keyword marks and class color swatches use CSS variables from `colorLight` and `colorDark`. Each color setting has two controls in one row.

## Related Symbols

| Symbol | File | Type | Lines |
|---|---|---|---|
| `OccuraPluginSettings.highlightColorOccurrencesLight` | `src/settings.ts` | property | [src/settings.ts:22](../../src/settings.ts#L22) |
| `OccuraPluginSettings.highlightColorOccurrencesDark` | `src/settings.ts` | property | [src/settings.ts:23](../../src/settings.ts#L23) |
| `KeywordGroup.colorLight` | `src/settings.ts` | property | [src/settings.ts:13](../../src/settings.ts#L13) |
| `KeywordGroup.colorDark` | `src/settings.ts` | property | [src/settings.ts:14](../../src/settings.ts#L14) |
| `OccuraPlugin.updateHighlightStyle` | `main.ts` | method | [main.ts:233](../../main.ts#L233) |
| `keywordColorStyle` | `src/keywordColors.ts` | function | [src/keywordColors.ts:8](../../src/keywordColors.ts#L8) |
| `OccuraPluginSettingTab.addLabeledColorInput` | `src/settings.ts` | method | [src/settings.ts:255](../../src/settings.ts#L255) |

## Implementation Commit

- https://github.com/Krusty84/obsidian-occura-plugin/commit/d5a139a3e5e32eeed30e36c2c4fbf385d170fac6
- https://github.com/Krusty84/obsidian-occura-plugin/commit/88ef4897d22838bc4823c9868d6fe3c26460de56
