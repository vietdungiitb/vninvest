export type DrawingShortcutTool = "trendLine" | "fibonacci" | "rectangle" | "text";

export type DrawingShortcutCommand = "delete" | "copy" | "paste" | "clone" | "undo" | "redo" | "escape";

export interface DrawingShortcutToolAction {
	type: "tool";
	tool: DrawingShortcutTool;
}

export interface DrawingShortcutCommandAction {
	type: "command";
	command: DrawingShortcutCommand;
}

export type DrawingShortcutAction = DrawingShortcutToolAction | DrawingShortcutCommandAction;

export interface DrawingShortcutDefinition {
	key: string;
	action: DrawingShortcutAction;
}

export const DRAWING_SHORTCUTS: readonly DrawingShortcutDefinition[] = [
	{ key: "L", action: { type: "tool", tool: "trendLine" } },
	{ key: "F", action: { type: "tool", tool: "fibonacci" } },
	{ key: "R", action: { type: "tool", tool: "rectangle" } },
	{ key: "T", action: { type: "tool", tool: "text" } },
	{ key: "Del", action: { type: "command", command: "delete" } },
	{ key: "Ctrl/Cmd+C", action: { type: "command", command: "copy" } },
	{ key: "Ctrl/Cmd+V", action: { type: "command", command: "paste" } },
	{ key: "Ctrl/Cmd+D", action: { type: "command", command: "clone" } },
	{ key: "Ctrl/Cmd+Z", action: { type: "command", command: "undo" } },
	{ key: "Ctrl/Cmd+Y", action: { type: "command", command: "redo" } },
	{ key: "Esc", action: { type: "command", command: "escape" } },
] as const;

function normalizeShortcutKey(key: string) {
	return key.trim().toLowerCase();
}

export function resolveDrawingShortcut(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "shiftKey">): DrawingShortcutAction | null {
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
			default:
				return null;
		}
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