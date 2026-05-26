import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replaceNextPoint } from "../shared";

export interface PitchforkGeometry {
	pivot: { x: number; y: number };
	leftSwing: { x: number; y: number };
	rightSwing: { x: number; y: number };
	midpoint: { x: number; y: number };
	direction: { x: number; y: number };
}

export function calculatePitchforkGeometry(drawing: DrawingObject, scales: ChartScales): PitchforkGeometry | null {
	const [pivotPoint, leftPoint, rightPoint] = drawing.points;
	if (!pivotPoint || !leftPoint || !rightPoint) {
		return null;
	}

	const pivot = chartPointToPixel(pivotPoint, scales);
	const leftSwing = chartPointToPixel(leftPoint, scales);
	const rightSwing = chartPointToPixel(rightPoint, scales);
	const midpoint = {
		x: (leftSwing.x + rightSwing.x) / 2,
		y: (leftSwing.y + rightSwing.y) / 2,
	};

	return {
		pivot,
		leftSwing,
		rightSwing,
		midpoint,
		direction: {
			x: midpoint.x - pivot.x,
			y: midpoint.y - pivot.y,
		},
	};
}

const Pitchfork: DrawingToolDefinition = {
	name: "pitchfork",
	createDraft: (startPoint) => createDrawingObject("pitchfork", [startPoint, startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
	render: () => undefined,
};

export default Pitchfork;