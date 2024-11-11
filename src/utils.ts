import {Platform} from "obsidian";

export function parseHotkeyString(hotkeyString: string): {
    key: string;
    modifiers: { ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean };
} {
    const modifiers = {
        ctrlKey: false,
        shiftKey: false,
        altKey: false,
        metaKey: false,
    };

    const parts = hotkeyString.split('+');
    const key = parts.pop()?.toUpperCase() || '';

    for (const part of parts) {
        switch (part.toLowerCase()) {
            case 'mod':
                if (Platform.isMacOS) {
                    modifiers.metaKey = true;
                } else {
                    modifiers.ctrlKey = true;
                }
                break;
            case 'ctrl':
                modifiers.ctrlKey = true;
                break;
            case 'cmd':
            case 'meta':
                modifiers.metaKey = true;
                break;
            case 'shift':
                modifiers.shiftKey = true;
                break;
            case 'alt':
            case 'option':
                modifiers.altKey = true;
                break;
            default:
                // Unknown modifier
                break;
        }
    }

    return {key, modifiers};
}
