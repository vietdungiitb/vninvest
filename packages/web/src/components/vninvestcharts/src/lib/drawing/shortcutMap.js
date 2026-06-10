export const DRAWING_SHORTCUTS = [
    { key: "L", action: { type: "tool", tool: "trendLine" } },
    { key: "F", action: { type: "tool", tool: "fibonacci" } },
    { key: "R", action: { type: "tool", tool: "rectangle" } },
    { key: "T", action: { type: "tool", tool: "text" } },
    { key: "H", action: { type: "tool", tool: "hLine" } },
    { key: "V", action: { type: "tool", tool: "vLine" } },
    { key: "A", action: { type: "tool", tool: "arrow" } },
    { key: "C", action: { type: "tool", tool: "channel" } },
    { key: "P", action: { type: "tool", tool: "polyline" } },
    { key: "M", action: { type: "command", command: "toggleMagnet" } },
    { key: "Ctrl/Cmd+L", action: { type: "command", command: "lockSelected" } },
    { key: "Ctrl/Cmd+H", action: { type: "command", command: "hideSelected" } },
    { key: "Del", action: { type: "command", command: "delete" } },
    { key: "Ctrl/Cmd+C", action: { type: "command", command: "copy" } },
    { key: "Ctrl/Cmd+V", action: { type: "command", command: "paste" } },
    { key: "Ctrl/Cmd+D", action: { type: "command", command: "clone" } },
    { key: "Ctrl/Cmd+Z", action: { type: "command", command: "undo" } },
    { key: "Ctrl/Cmd+Y", action: { type: "command", command: "redo" } },
    { key: "Esc", action: { type: "command", command: "escape" } },
];
function normalizeShortcutKey(key) {
    return key.trim().toLowerCase();
}
export function resolveDrawingShortcut(event) {
    const key = normalizeShortcutKey(event.key);
    const hasModifier = event.ctrlKey || event.metaKey;
    if (key === "escape") {
        return { type: "command", command: "escape" };
    }
    if (key === "delete" || key === "backspace") {
        return { type: "command", command: "delete" };
    }
    if (!hasModifier) {
        switch (key) {
            case "l":
                return { type: "tool", tool: "trendLine" };
            case "f":
                return { type: "tool", tool: "fibonacci" };
            case "r":
                return { type: "tool", tool: "rectangle" };
            case "t":
                return { type: "tool", tool: "text" };
            case "h":
                return { type: "tool", tool: "hLine" };
            case "v":
                return { type: "tool", tool: "vLine" };
            case "a":
                return { type: "tool", tool: "arrow" };
            case "c":
                return { type: "tool", tool: "channel" };
            case "p":
                return { type: "tool", tool: "polyline" };
            case "m":
                return { type: "command", command: "toggleMagnet" };
            default:
                return null;
        }
    }
    if (key === "l") {
        return { type: "command", command: "lockSelected" };
    }
    if (key === "h") {
        return { type: "command", command: "hideSelected" };
    }
    if (key === "c") {
        return { type: "command", command: "copy" };
    }
    if (key === "v") {
        return { type: "command", command: "paste" };
    }
    if (key === "d") {
        return { type: "command", command: "clone" };
    }
    if (key === "z" && !event.shiftKey) {
        return { type: "command", command: "undo" };
    }
    if (key === "y" || (key === "z" && event.shiftKey)) {
        return { type: "command", command: "redo" };
    }
    return null;
}
