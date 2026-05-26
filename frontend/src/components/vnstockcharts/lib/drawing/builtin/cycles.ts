import type { DrawingObject, DrawingToolDefinition, Point } from "../types";
import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import { createDrawingObject, replaceLastPoint } from "../shared";

export type CycleToolType = "cyclicLines" | "timeCycles" | "sineLine";

export interface CycleGeometry {
	type: CycleToolType;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
	count: number;
	amplitude: number;
}

export function calculateCycleGeometry(
	drawing: DrawingObject,
	scales: ChartScales,
): CycleGeometry | null {
	const pts = drawing.points;
	if (pts.length < 2) return null;
	const p1 = chartPointToPixel(pts[0], scales);
	const p2 = chartPointToPixel(pts[1], scales);
	const count = drawing.cycleParams?.count ?? 8;
	const rawAmp = drawing.cycleParams?.amplitude;
	const amplitude = rawAmp ?? (Math.abs(p2.y - p1.y) / 2 || 40);
	return { type: drawing.type as CycleToolType, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, count, amplitude };
}

// ── Tool definitions ──────────────────────────────────────────────────────────

export const CyclicLines: DrawingToolDefinition = {
	name: "cyclicLines",
	createDraft: (startPoint: Point): DrawingObject => ({
		...createDrawingObject("cyclicLines", [{ ...startPoint }, { ...startPoint }]),
		cycleParams: { count: 8 },
	}),
	updateDraft: (draft: DrawingObject, nextPoint: Point): DrawingObject =>
		replaceLastPoint(draft, nextPoint),
};

export const TimeCycles: DrawingToolDefinition = {
	name: "timeCycles",
	createDraft: (startPoint: Point): DrawingObject => ({
		...createDrawingObject("timeCycles", [{ ...startPoint }, { ...startPoint }]),
		cycleParams: { count: 8 },
	}),
	updateDraft: (draft: DrawingObject, nextPoint: Point): DrawingObject =>
		replaceLastPoint(draft, nextPoint),
};

export const SineLine: DrawingToolDefinition = {
	name: "sineLine",
	createDraft: (startPoint: Point): DrawingObject => ({
		...createDrawingObject("sineLine", [{ ...startPoint }, { ...startPoint }]),
		cycleParams: { count: 3, amplitude: 40 },
	}),
	updateDraft: (draft: DrawingObject, nextPoint: Point): DrawingObject =>
		replaceLastPoint(draft, nextPoint),
};
