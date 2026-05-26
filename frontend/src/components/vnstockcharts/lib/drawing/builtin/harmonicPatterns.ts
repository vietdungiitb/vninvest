import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replaceNextPoint } from "../shared";
import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";

export type HarmonicPatternType =
	| "xabcdPattern"
	| "cypherPattern"
	| "headAndShoulders"
	| "trianglePattern"
	| "threeDrivesPattern";

export const PATTERN_POINT_COUNT: Record<HarmonicPatternType, number> = {
	xabcdPattern: 5,       // X·A·B·C·D
	cypherPattern: 5,      // X·A·B·C·D
	headAndShoulders: 7,   // LS·LV·H·RV·RS·NL·NR
	trianglePattern: 5,    // H1·L1·H2·L2·apex
	threeDrivesPattern: 7, // S·1·A·2·B·3·E
};

export const PATTERN_POINT_LABELS: Record<HarmonicPatternType, readonly string[]> = {
	xabcdPattern: ["X", "A", "B", "C", "D"],
	cypherPattern: ["X", "A", "B", "C", "D"],
	headAndShoulders: ["LS", "LV", "H", "RV", "RS", "NL", "NR"],
	trianglePattern: ["H1", "L1", "H2", "L2", "apex"],
	threeDrivesPattern: ["S", "1", "A", "2", "B", "3", "E"],
};

/** Whether the pattern has a dashed closing line from first to last point */
export const PATTERN_HAS_CLOSING_LINE: Record<HarmonicPatternType, boolean> = {
	xabcdPattern: true,
	cypherPattern: true,
	headAndShoulders: false, // neckline is the closing element
	trianglePattern: true,
	threeDrivesPattern: false,
};

export interface HarmonicPatternGeometry {
	pixels: Array<{ x: number; y: number }>;
	labels: readonly string[];
	hasClosingLine: boolean;
	isHeadAndShoulders: boolean;
}

export function calculateHarmonicPatternGeometry(
	drawing: DrawingObject,
	scales: ChartScales,
): HarmonicPatternGeometry | null {
	if (drawing.points.length < 2) {
		return null;
	}
	const patternType = drawing.type as HarmonicPatternType;
	const pointCount = PATTERN_POINT_COUNT[patternType] ?? drawing.points.length;
	const pixels = drawing.points.slice(0, pointCount).map((p) => chartPointToPixel(p, scales));
	const labels: readonly string[] = PATTERN_POINT_LABELS[patternType] ?? [];
	const hasClosingLine = PATTERN_HAS_CLOSING_LINE[patternType] ?? false;
	return {
		pixels,
		labels,
		hasClosingLine,
		isHeadAndShoulders: patternType === "headAndShoulders",
	};
}

function makeHarmonicTool(type: HarmonicPatternType): DrawingToolDefinition {
	const pointCount = PATTERN_POINT_COUNT[type];
	return {
		name: type,
		createDraft: (startPoint) =>
			createDrawingObject(type, Array.from({ length: pointCount }, () => startPoint)),
		updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
		render: () => undefined,
	};
}

export const XabcdPattern: DrawingToolDefinition = makeHarmonicTool("xabcdPattern");
export const CypherPattern: DrawingToolDefinition = makeHarmonicTool("cypherPattern");
export const HeadAndShoulders: DrawingToolDefinition = makeHarmonicTool("headAndShoulders");
export const TrianglePattern: DrawingToolDefinition = makeHarmonicTool("trianglePattern");
export const ThreeDrivesPattern: DrawingToolDefinition = makeHarmonicTool("threeDrivesPattern");
