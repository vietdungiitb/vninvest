import { describe, expect, it } from "vitest";
import { createDrawingObject } from "./shared";
import { createDrawingHistory, createTool, deserializeDrawingHistory, deserializeDrawings, drawingReducer, exportDrawingsJSON, historyReducer, importDrawingsJSON, listDrawingTools, resolvePointAnchor, serializeDrawingHistory, serializeDrawings, serializeDrawingObject, } from "./index";
const startPoint = { x: 12, y: 34 };
const nextPoint = { x: 52, y: 64 };
function createTrendLineObject() {
    const tool = createTool("trendLine");
    return tool.updateDraft(tool.createDraft(startPoint), nextPoint);
}
function createTextObject() {
    const tool = createTool("text");
    return tool.createDraft(startPoint);
}
describe("drawing registry", () => {
    it("registers the built-in tools", () => {
        const toolNames = listDrawingTools().map((tool) => tool.name).sort();
        expect(toolNames).toEqual(expect.arrayContaining([
            "arrow",
            "channel",
            "fibonacci",
            "hLine",
            "rectangle",
            "text",
            "trendLine",
            "vLine",
        ]));
    });
    it("creates trend line and text drafts", () => {
        const trendLine = createTool("trendLine").createDraft(startPoint);
        const text = createTextObject();
        const rectangle = createTool("rectangle").createDraft(startPoint);
        const arrow = createTool("arrow").createDraft(startPoint);
        expect(trendLine.type).toBe("trendLine");
        expect(trendLine.points).toHaveLength(2);
        expect(text.type).toBe("text");
        expect(text.points).toHaveLength(1);
        expect(rectangle.type).toBe("rectangle");
        expect(rectangle.points).toHaveLength(2);
        expect(arrow.type).toBe("arrow");
        expect(arrow.points).toHaveLength(2);
    });
});
describe("drawing reducer", () => {
    it("walks through idle -> drawing -> complete -> selected -> moving -> resizing -> editing -> idle", () => {
        const draft = createTrendLineObject();
        const drawingState = drawingReducer({ type: "idle" }, {
            type: "START_DRAWING",
            toolName: "trendLine",
            object: draft,
        });
        expect(drawingState).toEqual({
            type: "drawing",
            toolName: "trendLine",
            object: draft,
        });
        const updatedDraft = createTool("trendLine").updateDraft(draft, { x: 88, y: 99 });
        const updatedState = drawingReducer(drawingState, {
            type: "UPDATE_DRAWING",
            object: updatedDraft,
        });
        expect(updatedState).toMatchObject({
            type: "drawing",
            object: updatedDraft,
        });
        const completeState = drawingReducer(updatedState, {
            type: "COMPLETE_DRAWING",
            object: updatedDraft,
        });
        expect(completeState).toEqual({
            type: "complete",
            object: updatedDraft,
        });
        const selectedState = drawingReducer(completeState, {
            type: "SELECT_OBJECT",
            objectId: updatedDraft.id,
        });
        expect(selectedState).toEqual({
            type: "selected",
            objectId: updatedDraft.id,
        });
        const movingState = drawingReducer(selectedState, {
            type: "START_MOVING",
            objectId: updatedDraft.id,
            startPoint,
            currentPoint: nextPoint,
        });
        expect(movingState).toMatchObject({
            type: "moving",
            objectId: updatedDraft.id,
        });
        const resizingState = drawingReducer(movingState, {
            type: "START_RESIZING",
            objectId: updatedDraft.id,
            handle: "end",
        });
        expect(resizingState).toEqual({
            type: "resizing",
            objectId: updatedDraft.id,
            handle: "end",
        });
        const editingState = drawingReducer(resizingState, {
            type: "START_EDITING",
            objectId: updatedDraft.id,
            text: "Audit label",
        });
        expect(editingState).toEqual({
            type: "editing",
            objectId: updatedDraft.id,
            text: "Audit label",
        });
        expect(drawingReducer(editingState, { type: "CANCEL" })).toEqual({ type: "idle" });
    });
});
describe("drawing serialization", () => {
    it("round-trips drawings and history through JSON", () => {
        const drawing = createTrendLineObject();
        const serializedDrawing = serializeDrawingObject(drawing);
        const serializedDrawings = serializeDrawings([drawing]);
        const history = createDrawingHistory([drawing]);
        const serializedHistory = serializeDrawingHistory(history);
        expect(deserializeDrawings(serializedDrawings)).toEqual([drawing]);
        expect(deserializeDrawingHistory(serializedHistory)).toEqual(history);
        expect(JSON.parse(serializedDrawing)).toMatchObject({
            id: drawing.id,
            type: "trendLine",
            points: drawing.points,
        });
    });
    it("imports legacy flat-array payloads and preserves compatibility", () => {
        const drawing = createDrawingObject("trendLine", [
            { x: 100_000, y: 20 },
            { x: 160_000, y: 40 },
        ], {
            id: "legacy-array-drawing",
            style: { stroke: "#fff", strokeWidth: 1 },
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
        });
        const imported = importDrawingsJSON(JSON.stringify([drawing]));
        expect(imported).toHaveLength(1);
        expect(imported[0]).toMatchObject({
            id: "legacy-array-drawing",
            type: "trendLine",
            points: [
                { x: 100_000, y: 20 },
                { x: 160_000, y: 40 },
            ],
        });
    });
    it("round-trips schema-envelope payloads with anchor metadata", () => {
        const drawing = createDrawingObject("trendLine", [
            { x: 100_000, y: 20, timeMsHint: 100_000, yPrice: 20 },
            { x: 160_000, y: 40, timeMsHint: 160_000, yPrice: 40, xIndexFloat: 11.5 },
        ], {
            id: "schema-envelope-drawing",
            style: { stroke: "#fff", strokeWidth: 1 },
            createdAt: 1_700_000_000_000,
            updatedAt: 1_700_000_000_000,
        });
        const imported = importDrawingsJSON(exportDrawingsJSON([drawing]));
        expect(imported).toEqual([drawing]);
    });
});
describe("drawing shared helpers", () => {
    it("normalizes the default style and keeps style objects isolated", () => {
        const first = createDrawingObject("trendLine", [startPoint, nextPoint]);
        const second = createDrawingObject("trendLine", [startPoint, nextPoint]);
        expect(first.style.strokeDasharray).toBe("solid");
        expect(first.style).not.toBe(second.style);
    });
    it("resolves canonical anchors for both legacy and enriched points", () => {
        expect(resolvePointAnchor({ x: 1000, y: 20 })).toEqual({
            xIndexFloat: undefined,
            timeMsHint: 1000,
            yPrice: 20,
        });
        expect(resolvePointAnchor({
            x: 1000,
            y: 20,
            xIndexFloat: 12.5,
            timeMsHint: 1_700_000_000_000,
            yPrice: 19.75,
        })).toEqual({
            xIndexFloat: 12.5,
            timeMsHint: 1_700_000_000_000,
            yPrice: 19.75,
        });
    });
});
describe("drawing history", () => {
    it("pushes, undoes, and redoes drawings", () => {
        const drawing = createTrendLineObject();
        const initialHistory = createDrawingHistory();
        const pushedHistory = historyReducer(initialHistory, { type: "PUSH", drawing });
        expect(pushedHistory.present).toHaveLength(1);
        expect(pushedHistory.present[0]).toEqual(drawing);
        const undoneHistory = historyReducer(pushedHistory, { type: "UNDO" });
        expect(undoneHistory.present).toHaveLength(0);
        expect(undoneHistory.future).toHaveLength(1);
        const redoneHistory = historyReducer(undoneHistory, { type: "REDO" });
        expect(redoneHistory.present).toHaveLength(1);
        expect(redoneHistory.present[0]).toEqual(drawing);
    });
});
