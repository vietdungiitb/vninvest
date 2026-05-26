import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replaceLastPoint } from "../shared";
import type { ChartScales } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";

export type ElliottWaveToolType =
	| "elliottImpulse"
	| "elliottCorrection"
	| "elliottTriangle"
	| "elliottDoubleCombo"
	| "elliottTripleCombo";

export const ELLIOTT_POINT_COUNT: Record<ElliottWaveToolType, number> = {
	elliottImpulse: 6,      // (0)(1)(2)(3)(4)(5)
	elliottCorrection: 4,   // (0)(A)(B)(C)
	elliottTriangle: 6,     // (0)(A)(B)(C)(D)(E)
	elliottDoubleCombo: 4,  // (0)(W)(X)(Y)
	elliottTripleCombo: 6,  // (0)(W)(X)(Y)(XX)(Z)
};

export const ELLIOTT_LABELS: Record<ElliottWaveToolType, readonly string[]> = {
	elliottImpulse: ["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"],
	elliottCorrection: ["(0)", "(A)", "(B)", "(C)"],
	elliottTriangle: ["(0)", "(A)", "(B)", "(C)", "(D)", "(E)"],
	elliottDoubleCombo: ["(0)", "(W)", "(X)", "(Y)"],
	elliottTripleCombo: ["(0)", "(W)", "(X)", "(Y)", "(XX)", "(Z)"],
};

export interface ElliottWaveGeometry {
	pixels: Array<{ x: number; y: number }>;
	labels: readonly string[];
}

export function calculateElliottWaveGeometry(
	drawing: DrawingObject,
	scales: ChartScales,
): ElliottWaveGeometry | null {
	if (drawing.points.length < 2) {
		return null;
	}
	const waveType = drawing.type as ElliottWaveToolType;
	const pointCount = ELLIOTT_POINT_COUNT[waveType] ?? drawing.points.length;
	const pixels = drawing.points
		.slice(0, pointCount)
		.map((p) => chartPointToPixel(p, scales));
	const labels: readonly string[] = drawing.waveLabels ?? ELLIOTT_LABELS[waveType] ?? [];
	return { pixels, labels };
}

function makeElliottTool(type: ElliottWaveToolType): DrawingToolDefinition {
	const pointCount = ELLIOTT_POINT_COUNT[type];
	return {
		name: type,
		createDraft: (startPoint) =>
			createDrawingObject(type, Array.from({ length: pointCount }, () => startPoint)),
		updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
		render: () => undefined,
	};
}

export const ElliottImpulse: DrawingToolDefinition = makeElliottTool("elliottImpulse");
export const ElliottCorrection: DrawingToolDefinition = makeElliottTool("elliottCorrection");
export const ElliottTriangle: DrawingToolDefinition = makeElliottTool("elliottTriangle");
export const ElliottDoubleCombo: DrawingToolDefinition = makeElliottTool("elliottDoubleCombo");
export const ElliottTripleCombo: DrawingToolDefinition = makeElliottTool("elliottTripleCombo");
