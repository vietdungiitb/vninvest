import { describe, expect, it } from "vitest";
import { resolveDrawingShortcut } from "./shortcutMap";

describe("resolveDrawingShortcut", () => {
	it("maps drawing tool shortcuts", () => {
		expect(resolveDrawingShortcut({ key: "l", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "tool", tool: "trendLine" });
		expect(resolveDrawingShortcut({ key: "F", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "tool", tool: "fibonacci" });
		expect(resolveDrawingShortcut({ key: "r", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "tool", tool: "rectangle" });
		expect(resolveDrawingShortcut({ key: "t", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "tool", tool: "text" });
	});

	it("maps command shortcuts and undo redo variants", () => {
		expect(resolveDrawingShortcut({ key: "Delete", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "delete" });
		expect(resolveDrawingShortcut({ key: "Backspace", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "delete" });
		expect(resolveDrawingShortcut({ key: "c", ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "copy" });
		expect(resolveDrawingShortcut({ key: "v", ctrlKey: false, metaKey: true, shiftKey: false })).toEqual({ type: "command", command: "paste" });
		expect(resolveDrawingShortcut({ key: "d", ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "clone" });
		expect(resolveDrawingShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "undo" });
		expect(resolveDrawingShortcut({ key: "z", ctrlKey: true, metaKey: false, shiftKey: true })).toEqual({ type: "command", command: "redo" });
		expect(resolveDrawingShortcut({ key: "y", ctrlKey: false, metaKey: true, shiftKey: false })).toEqual({ type: "command", command: "redo" });
		expect(resolveDrawingShortcut({ key: "Escape", ctrlKey: false, metaKey: false, shiftKey: false })).toEqual({ type: "command", command: "escape" });
	});

	it("ignores unrelated shortcuts", () => {
		expect(resolveDrawingShortcut({ key: "x", ctrlKey: false, metaKey: false, shiftKey: false })).toBeNull();
		expect(resolveDrawingShortcut({ key: "p", ctrlKey: true, metaKey: false, shiftKey: false })).toBeNull();
	});
});