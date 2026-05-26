// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { createDrawingObject } from "./shared";
import { createDrawingInteractionState, deleteSelectedInteractionState, drawingInteractionReducer, useDrawingInteraction } from "./useDrawingInteraction";

const startPoint = { x: 12, y: 34 };
const nextPoint = { x: 52, y: 64 };
const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;
let currentInteraction: ReturnType<typeof useDrawingInteraction> | null = null;

function createTrendLineDrawing() {
	return createDrawingObject("trendLine", [startPoint, nextPoint], { id: "drawing-1" });
}

function DrawingInteractionProbe() {
	currentInteraction = useDrawingInteraction([createTrendLineDrawing()]);
	return null;
}

function renderInteractionProbe() {
	const currentRoot = root;
	if (!currentRoot) {
		throw new Error("interaction probe root is not available");
	}

	act(() => {
		currentRoot.render(createElement(DrawingInteractionProbe));
	});

	if (!currentInteraction) {
		throw new Error("interaction probe did not mount");
	}

	return currentInteraction;
}

beforeEach(() => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	currentInteraction = null;
});

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	root = null;
	container?.remove();
	container = null;
	currentInteraction = null;
});

describe("useDrawingInteraction foundation", () => {
	it("creates an idle interaction snapshot with empty history", () => {
		const snapshot = createDrawingInteractionState();

		expect(snapshot.drawingState).toEqual({ type: "idle" });
		expect(snapshot.history.present).toHaveLength(0);
		expect(snapshot.history.past).toHaveLength(0);
		expect(snapshot.history.future).toHaveLength(0);
	});

	it("routes drawing and history actions through the shared reducer", () => {
		const drawing = createTrendLineDrawing();
		const drawingState = drawingInteractionReducer(createDrawingInteractionState(), {
			type: "START_DRAWING",
			toolName: "trendLine",
			object: drawing,
		});

		expect(drawingState.drawingState).toEqual({
			type: "drawing",
			toolName: "trendLine",
			object: drawing,
		});

		const completeState = drawingInteractionReducer(drawingState, {
			type: "COMPLETE_DRAWING",
			object: drawing,
		});

		expect(completeState.drawingState).toEqual({
			type: "complete",
			object: drawing,
		});

		const pushedState = drawingInteractionReducer(completeState, {
			type: "PUSH",
			drawing,
		});

		expect(pushedState.history.present).toEqual([drawing]);
		expect(pushedState.history.past).toHaveLength(1);

		const selectedState = drawingInteractionReducer(pushedState, {
			type: "SELECT_OBJECT",
			objectId: drawing.id,
		});

		expect(selectedState.drawingState).toEqual({
			type: "selected",
			objectId: drawing.id,
		});
	});

	it("clears the selected drawing from the interaction snapshot", () => {
		const drawing = createTrendLineDrawing();
		const selectedSnapshot = {
			drawingState: { type: "selected", objectId: drawing.id } as const,
			history: {
				past: [],
				present: [drawing],
				future: [],
			},
		};

		const deletedSnapshot = deleteSelectedInteractionState(selectedSnapshot);

		expect(deletedSnapshot.drawingState).toEqual({ type: "idle" });
		expect(deletedSnapshot.history.present).toHaveLength(0);
		expect(deletedSnapshot.history.past).toHaveLength(1);
	});

	it("exposes a command surface for selection and editing transitions", () => {
		renderInteractionProbe();

		act(() => {
			currentInteraction?.selectObject("drawing-1");
		});
		expect(currentInteraction?.drawingState).toEqual({ type: "selected", objectId: "drawing-1" });

		act(() => {
			currentInteraction?.setSelectedObjects(["drawing-1", "drawing-2"]);
		});
		expect(currentInteraction?.drawingState).toEqual({ type: "selectedMultiple", objectIds: ["drawing-1", "drawing-2"] });

		act(() => {
			currentInteraction?.startMoving("drawing-1", startPoint, nextPoint);
		});
		expect(currentInteraction?.drawingState).toMatchObject({ type: "moving", objectId: "drawing-1" });

		act(() => {
			currentInteraction?.startResizing("drawing-1", "end");
		});
		expect(currentInteraction?.drawingState).toEqual({ type: "resizing", objectId: "drawing-1", handle: "end" });

		act(() => {
			currentInteraction?.startEditing("drawing-1", "note");
		});
		expect(currentInteraction?.drawingState).toEqual({ type: "editing", objectId: "drawing-1", text: "note" });
	});

	it("updates drawings through the command surface without mutating history in place", () => {
		const drawing = createTrendLineDrawing();
		renderInteractionProbe();

		act(() => {
			currentInteraction?.updateDrawing(drawing.id, {
				locked: true,
				style: { stroke: "#ff0000", strokeWidth: 3 },
				points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
			});
		});

		expect(currentInteraction?.allDrawings[0]).toMatchObject({
			locked: true,
			style: { stroke: "#ff0000", strokeWidth: 3 },
			points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
		});

		const snapshotPoints = currentInteraction?.allDrawings[0]?.points;
		expect(snapshotPoints).not.toBe(drawing.points);
	});
});

describe("CE19-02: groupId bulk operations", () => {
	function makeDrawings() {
		const d1 = createDrawingObject("trendLine", [startPoint, nextPoint], { id: "g1-a", groupId: "group-1" });
		const d2 = createDrawingObject("hLine", [startPoint], { id: "g1-b", groupId: "group-1" });
		const d3 = createDrawingObject("vLine", [startPoint], { id: "solo", groupId: undefined });
		return [d1, d2, d3];
	}

	function DrawingGroupProbe() {
		currentInteraction = useDrawingInteraction(makeDrawings());
		return null;
	}

	function renderGroupProbe() {
		const currentRoot = root;
		if (!currentRoot) {
			throw new Error("group probe root is not available");
		}
		act(() => {
			currentRoot.render(createElement(DrawingGroupProbe));
		});
		if (!currentInteraction) {
			throw new Error("group probe did not mount");
		}
		return currentInteraction;
	}

	it("selectGroup selects all drawings sharing the groupId", () => {
		renderGroupProbe();
		act(() => {
			currentInteraction?.selectGroup("group-1");
		});
		expect(currentInteraction?.drawingState).toMatchObject({
			type: "selectedMultiple",
			objectIds: expect.arrayContaining(["g1-a", "g1-b"]),
		});
	});

	it("deleteGroup removes all drawings with the groupId and leaves others intact", () => {
		renderGroupProbe();
		act(() => {
			currentInteraction?.deleteGroup("group-1");
		});
		expect(currentInteraction?.allDrawings).toHaveLength(1);
		expect(currentInteraction?.allDrawings[0].id).toBe("solo");
	});
});