/**
 * DT-2: Rubber-band selection and group drag tests
 */

import { describe, it, expect } from "vitest";
import { isDrawingInRect } from "./hitTest";
import { drawingReducer, type DrawingState, type DrawingAction } from "./stateMachine";
import type { DrawingObject } from "./types";
import type { ChartScales } from "./coordinateUtils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScales(): ChartScales {
	return {
		xScale: (d: Date) => d.getTime() / 1_000_000,
		yScale: (v: number) => v,
		plotData: [],
		xAccessor: (d: any) => d.date,
	} as unknown as ChartScales;
}

function makeTrendLine(overrides: Partial<DrawingObject> = {}): DrawingObject {
	return {
		id: "dl-1",
		type: "trendLine",
		pane: "main",
		points: [
			{ x: 1_000_000_000_000, y: 100 },
			{ x: 2_000_000_000_000, y: 200 },
		],
		visible: true,
		locked: false,
		...overrides,
	} as DrawingObject;
}

// ---------------------------------------------------------------------------
// isDrawingInRect
// ---------------------------------------------------------------------------

describe("isDrawingInRect", () => {
	const scales = makeScales();

	// bbox for makeTrendLine: { minX:1_000_000, maxX:2_000_000, minY:100, maxY:200 }
	// xScale: (d: Date) => d.getTime() / 1_000_000
	// xScale(new Date(1_000_000_000_000)) = 1_000_000_000_000 / 1_000_000 = 1_000_000

	it("DT2-01: drawing fully inside rect → true", () => {
		const drawing = makeTrendLine();
		const rect = { minX: 900_000, maxX: 2_100_000, minY: 90, maxY: 210 };
		expect(isDrawingInRect(drawing, rect, scales)).toBe(true);
	});

	it("DT2-02: drawing fully outside rect (to the right) → false", () => {
		const drawing = makeTrendLine();
		const rect = { minX: 5_000_000, maxX: 9_000_000, minY: 0, maxY: 500 };
		expect(isDrawingInRect(drawing, rect, scales)).toBe(false);
	});

	it("DT2-03: drawing bounding box intersects rect → true", () => {
		const drawing = makeTrendLine();
		// rect starts at x=1_500_000 — partially overlaps [1_000_000, 2_000_000]
		const rect = { minX: 1_500_000, maxX: 3_000_000, minY: 0, maxY: 500 };
		expect(isDrawingInRect(drawing, rect, scales)).toBe(true);
	});

	it("DT2-04: drawing fully below rect → false", () => {
		const drawing = makeTrendLine();
		// drawing y values 100-200; rect y above 300
		const rect = { minX: 900_000, maxX: 2_100_000, minY: 300, maxY: 500 };
		expect(isDrawingInRect(drawing, rect, scales)).toBe(false);
	});

	it("DT2-05: drawing with no computable bbox → false", () => {
		// A drawing type the helper cannot compute bbox for defaults gracefully
		const drawing = {
			id: "dl-unknown",
			type: "unknownType" as any,
			pane: "main",
			points: [],
			visible: true,
			locked: false,
		} as unknown as DrawingObject;
		const rect = { minX: 0, maxX: 9999, minY: 0, maxY: 9999 };
		// Should not throw; returns false when bbox is null
		expect(isDrawingInRect(drawing, rect, scales)).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// State machine: rubberBand + movingGroup states
// ---------------------------------------------------------------------------

describe("drawingReducer – DT-2 states", () => {
	const idle: DrawingState = { type: "idle" };

	it("DT2-06: START_RUBBER_BAND transitions to rubberBand", () => {
		const action: DrawingAction = { type: "START_RUBBER_BAND" };
		const next = drawingReducer(idle, action);
		expect(next.type).toBe("rubberBand");
	});

	it("DT2-07: COMMIT_RUBBER_BAND with multiple ids → selectedMultiple", () => {
		const rubberBandState: DrawingState = { type: "rubberBand" };
		const action: DrawingAction = { type: "COMMIT_RUBBER_BAND", objectIds: ["a", "b", "c"] };
		const next = drawingReducer(rubberBandState, action);
		expect(next.type).toBe("selectedMultiple");
		if (next.type === "selectedMultiple") {
			expect(next.objectIds).toEqual(["a", "b", "c"]);
		}
	});

	it("DT2-07b: COMMIT_RUBBER_BAND with single id → selected", () => {
		const rubberBandState: DrawingState = { type: "rubberBand" };
		const action: DrawingAction = { type: "COMMIT_RUBBER_BAND", objectIds: ["a"] };
		const next = drawingReducer(rubberBandState, action);
		expect(next.type).toBe("selected");
	});

	it("DT2-07c: COMMIT_RUBBER_BAND with empty ids → idle", () => {
		const rubberBandState: DrawingState = { type: "rubberBand" };
		const action: DrawingAction = { type: "COMMIT_RUBBER_BAND", objectIds: [] };
		const next = drawingReducer(rubberBandState, action);
		expect(next.type).toBe("idle");
	});

	it("DT2-08: START_MOVING_GROUP transitions to movingGroup with ids", () => {
		const selectedMultiple: DrawingState = { type: "selectedMultiple", objectIds: ["a", "b"] };
		const action: DrawingAction = { type: "START_MOVING_GROUP", objectIds: ["a", "b"] };
		const next = drawingReducer(selectedMultiple, action);
		expect(next.type).toBe("movingGroup");
		if (next.type === "movingGroup") {
			expect(next.objectIds).toEqual(["a", "b"]);
		}
	});
});
