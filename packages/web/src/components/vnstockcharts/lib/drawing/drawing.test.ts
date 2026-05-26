import { describe, expect, it } from "vitest";
import { createDrawingObject } from "./shared";
import type { DrawingObject, Point } from "./types";
import {
	createDrawingHistory,
	createTool,
	deserializeDrawingHistory,
	deserializeDrawings,
	drawingReducer,
	historyReducer,
	listDrawingTools,
	serializeDrawingHistory,
	serializeDrawings,
	serializeDrawingObject,
} from "./index";

const startPoint: Point = { x: 12, y: 34 };
const nextPoint: Point = { x: 52, y: 64 };

function createTrendLineObject() {
	const tool = createTool("trendLine");
	return tool.updateDraft(tool.createDraft(startPoint), nextPoint);
}

function createTextObject(): DrawingObject {
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
});

describe("drawing shared helpers", () => {
	it("normalizes the default style and keeps style objects isolated", () => {
		const first = createDrawingObject("trendLine", [startPoint, nextPoint]);
		const second = createDrawingObject("trendLine", [startPoint, nextPoint]);

		expect(first.style.strokeDasharray).toBe("solid");
		expect(first.style).not.toBe(second.style);
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
