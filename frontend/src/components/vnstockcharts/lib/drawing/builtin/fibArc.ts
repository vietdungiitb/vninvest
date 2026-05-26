import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

export const DEFAULT_FIB_ARC_LEVELS = [0.382, 0.5, 0.618];

export interface FibArcGeometry {
	center: { x: number; y: number };
	reference: { x: number; y: number };
	baseRadius: number;
	radii: number[];
	levels: number[];
}

export function calculateFibArcGeometry(drawing: DrawingObject, scales: ChartScales): FibArcGeometry | null {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return null;
	}

	const center = chartPointToPixel(startPoint, scales);
	const reference = chartPointToPixel(endPoint, scales);
	const baseRadius = Math.hypot(reference.x - center.x, reference.y - center.y);
	const levels = drawing.fibLevels ?? DEFAULT_FIB_ARC_LEVELS;

	return {
		center,
		reference,
		baseRadius,
		levels,
		radii: levels.map((level) => baseRadius * level),
	};
}

const FibArc: DrawingToolDefinition = {
	name: "fibArc",
	createDraft: (startPoint) => createDrawingObject("fibArc", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default FibArc;