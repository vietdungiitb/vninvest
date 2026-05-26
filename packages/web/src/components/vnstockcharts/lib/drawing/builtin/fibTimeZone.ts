import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

export const DEFAULT_FIB_TIME_ZONE_LEVELS = [1, 2, 3, 5, 8, 13, 21, 34];

export interface FibTimeZoneGeometry {
	start: { x: number; y: number };
	end: { x: number; y: number };
	stepX: number;
	levels: number[];
	positions: number[];
}

export function calculateFibTimeZoneGeometry(drawing: DrawingObject, scales: ChartScales): FibTimeZoneGeometry | null {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return null;
	}

	const start = chartPointToPixel(startPoint, scales);
	const end = chartPointToPixel(endPoint, scales);
	const stepX = end.x - start.x;
	const levels = drawing.fibLevels ?? DEFAULT_FIB_TIME_ZONE_LEVELS;

	return {
		start,
		end,
		stepX,
		levels,
		positions: levels.map((level) => start.x + stepX * level),
	};
}

const FibTimeZone: DrawingToolDefinition = {
	name: "fibTimeZone",
	createDraft: (startPoint) => createDrawingObject("fibTimeZone", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default FibTimeZone;