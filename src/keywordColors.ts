/*
 * SPDX-FileCopyrightText: Copyright (c) 2026 Alexey Sedoykin
 * SPDX-License-Identifier: MIT
 */

export const DEFAULT_KEYWORD_COLOR = "#66ccff";

export function keywordColorStyle(colorLight: string, colorDark: string): string {
  return (
    `--occura-keyword-color-light: ${colorLight}; ` +
    `--occura-keyword-color-dark: ${colorDark}; ` +
    "background-color: var(--occura-keyword-color, var(--occura-keyword-color-light));"
  );
}
