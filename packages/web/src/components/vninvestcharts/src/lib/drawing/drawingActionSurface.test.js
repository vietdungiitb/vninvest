import { describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { createDrawingContextMenuItems } from "./drawingActionSurface";
describe("createDrawingContextMenuItems", () => {
    it("builds a normalized menu with clipboard, grouping, and alert actions", () => {
        const drawing = createDrawingObject("trendLine", [
            { x: 10, y: 10 },
            { x: 20, y: 20 },
        ], { id: "drawing-1", groupId: "group-1", locked: true, visible: false, alertCondition: { direction: "either", enabled: false } });
        const callbacks = {
            copySelectedDrawing: vi.fn(),
            pasteCopiedDrawing: vi.fn(),
            bringSelectedToFront: vi.fn(),
            sendSelectedToBack: vi.fn(),
            selectGroup: vi.fn(),
            deleteGroup: vi.fn(),
        };
        const items = createDrawingContextMenuItems(drawing, false, {
            copy: "Copy",
            paste: "Paste",
            bringToFront: "Bring to front",
            sendToBack: "Send to back",
            selectGroup: "Select group",
            deleteGroup: "Delete group",
        }, callbacks);
        expect(items.map((item) => item.key)).toEqual([
            "copy",
            "paste",
            "front",
            "back",
            "selectGroup",
            "deleteGroup",
        ]);
        expect(items[1]?.disabled).toBe(true);
        expect(items[4]?.label).toBe("Select group");
    });
});
