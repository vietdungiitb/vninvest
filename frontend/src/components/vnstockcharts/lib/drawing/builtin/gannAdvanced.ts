/**
 * DT-14: Gann Advanced drawing tools
 * gannBox | gannSquareFixed | gannSquare
 */
import type { DrawingObject, DrawingToolDefinition, Point } from "../types";
import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import { createDrawingObject, replaceNextPoint } from "../shared";

export type GannAdvancedToolType = "gannBox" | "gannSquareFixed" | "gannSquare";

// Fractional grid lines at 1/8 intervals
export const GANN_FRACTIONS = [1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8];

export interface GannAdvancedGeometry {
	type: GannAdvancedToolType;
	x1: number;
	y1: number;
	x2: number;
	y2: number;
}

export function calculateGannAdvancedGeometry(
	drawing: DrawingObject,
	scales: ChartScales,
): GannAdvancedGeometry | null {
	const { points, type } = drawing;
	if (type === "gannSquareFixed") {
		if (points.length < 1) return null;
		const p1 = chartPointToPixel(points[0], scales);
		const size = drawing.gannSquareSize ?? 50;
		// size is in price units — convert to pixels
		const sizeInPx = Math.abs(scales.yScale(0) - scales.yScale(size));
		return { type: type as GannAdvancedToolType, x1: p1.x, y1: p1.y, x2: p1.x + sizeInPx, y2: p1.y + sizeInPx };
	}
	if (points.length < 2) return null;
	const p1 = chartPointToPixel(points[0], scales);
	const p2 = chartPointToPixel(points[1], scales);
	let x2 = p2.x;
	let y2 = p2.y;
	if (type === "gannSquare") {
		// Force equal pixel dimensions
		const side = Math.min(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
		x2 = p1.x + (p2.x >= p1.x ? side : -side);
		y2 = p1.y + (p2.y >= p1.y ? side : -side);
	}
	return { type: type as GannAdvancedToolType, x1: p1.x, y1: p1.y, x2, y2 };
}

// ───── tool definitions ──────────────────────────────────────────────────────

export const GannBox: DrawingToolDefinition = {
	name: "gannBox",
	createDraft: (startPoint: Point): DrawingObject =>
		createDrawingObject("gannBox", [{ ...startPoint }, { ...startPoint }]),
	updateDraft: (draft: DrawingObject, nextPoint: Point): DrawingObject =>
		replaceNextPoint(draft, nextPoint),
};

export const GannSquare: DrawingToolDefinition = {
	name: "gannSquare",
	createDraft: (startPoint: Point): DrawingObject =>
		createDrawingObject("gannSquare", [{ ...startPoint }, { ...startPoint }]),
	updateDraft: (draft: DrawingObject, nextPoint: Point): DrawingObject =>
		replaceNextPoint(draft, nextPoint),
};

export const GannSquareFixed: DrawingToolDefinition = {
	name: "gannSquareFixed",
	createDraft: (startPoint: Point): DrawingObject => ({
		...createDrawingObject("gannSquareFixed", [{ ...startPoint }]),
		gannSquareSize: 100,
	}),
	updateDraft: (draft: DrawingObject, _nextPoint: Point): DrawingObject => draft,
};
