import { Platform } from "obsidian";

export function parseHotkeyString(hotkeyString: string): {
  key: string;
  modifiers: {
    ctrlKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
  };
} {
  const modifiers = {
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
  };

  const parts = hotkeyString
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);
  const key = parts.pop()?.toUpperCase() || "";

  for (const part of parts) {
    switch (part.toLowerCase()) {
      case "mod":
        if (Platform.isMacOS) {
          modifiers.metaKey = true;
        } else {
          modifiers.ctrlKey = true;
        }
        break;
      case "ctrl":
        modifiers.ctrlKey = true;
        break;
      case "cmd":
      case "meta":
        modifiers.metaKey = true;
        break;
      case "shift":
        modifiers.shiftKey = true;
        break;
      case "alt":
      case "option":
        modifiers.altKey = true;
        break;
      default:
        // Unknown modifier
        break;
    }
  }

  return { key, modifiers };
}

export function hotkeyMatchesEvent(
  evt: KeyboardEvent,
  hotkeyString: string,
): boolean {
  const evtKey = evt.key.toUpperCase();
  const normalizedKey = evtKey.replace("ARROW", "");
  const parsed = parseHotkeyString(hotkeyString);

  return (
    normalizedKey === parsed.key &&
    evt.ctrlKey === parsed.modifiers.ctrlKey &&
    evt.shiftKey === parsed.modifiers.shiftKey &&
    evt.altKey === parsed.modifiers.altKey &&
    evt.metaKey === parsed.modifiers.metaKey
  );
}

export function getDefaultNextOccurrenceHotkey(): string {
  return Platform.isMacOS ? "Mod+Shift+D" : "F3";
}

export function getDefaultPreviousOccurrenceHotkey(): string {
  return Platform.isMacOS ? "Mod+Shift+R" : "Shift+F3";
}

export function normalizeNavigationHotkey(
  hotkeyString: string,
  fallback: string,
): string {
  const hotkeys = hotkeyString
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (hotkeys.length === 0) return fallback;
  if (hotkeys.length === 1) return hotkeys[0];

  const platformHotkey = Platform.isMacOS
    ? hotkeys.find((hotkey) => /\b(mod|cmd|meta)\b/i.test(hotkey))
    : hotkeys.find((hotkey) => !/\b(mod|cmd|meta)\b/i.test(hotkey));

  return platformHotkey ?? hotkeys[0];
}
