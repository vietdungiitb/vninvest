import { describe, expect, it } from "vitest";
import {
	calculateElliottWaveGeometry,
	ElliottCorrection,
	ELLIOTT_LABELS,
	ElliottImpulse,
	ELLIOTT_POINT_COUNT,
} from "./elliottWaves";
import type { DrawingObject } from "../types";

// Minimal mock scales
const scales = {
	xScale: (date: Date) => date.getTime() / 1000,
	xScaleInvert: (px: number) => new Date(px * 1000),
	yScale: (price: number) => price * 10,
	yScaleInvert: (px: number) => px / 10,
};

function makePoint(x: number, y: number) {
	return { x, y };
}

function makeDrawing(type: DrawingObject["type"], points: Array<{ x: number; y: number }>): DrawingObject {
	return {
		id: "test",
		type,
		points,
		style: { stroke: "#ff0000", strokeWidth: 1, fill: "none" },
		createdAt: 0,
		updatedAt: 0,
	};
}

describe("ELLIOTT_POINT_COUNT", () => {
	it("has correct counts for all 5 types", () => {
		expect(ELLIOTT_POINT_COUNT.elliottImpulse).toBe(6);
		expect(ELLIOTT_POINT_COUNT.elliottCorrection).toBe(4);
		expect(ELLIOTT_POINT_COUNT.elliottTriangle).toBe(6);
		expect(ELLIOTT_POINT_COUNT.elliottDoubleCombo).toBe(4);
		expect(ELLIOTT_POINT_COUNT.elliottTripleCombo).toBe(6);
	});
});

describe("ELLIOTT_LABELS", () => {
	it("impulse labels are (0)..(5)", () => {
		expect(ELLIOTT_LABELS.elliottImpulse).toEqual(["(0)", "(1)", "(2)", "(3)", "(4)", "(5)"]);
	});

	it("correction labels are (0),(A),(B),(C)", () => {
		expect(ELLIOTT_LABELS.elliottCorrection).toEqual(["(0)", "(A)", "(B)", "(C)"]);
	});

	it("triangle labels are (0),(A),(B),(C),(D),(E)", () => {
		expect(ELLIOTT_LABELS.elliottTriangle).toEqual(["(0)", "(A)", "(B)", "(C)", "(D)", "(E)"]);
	});

	it("doubleCombo labels are (0),(W),(X),(Y)", () => {
		expect(ELLIOTT_LABELS.elliottDoubleCombo).toEqual(["(0)", "(W)", "(X)", "(Y)"]);
	});

	it("tripleCombo labels are (0),(W),(X),(Y),(XX),(Z)", () => {
		expect(ELLIOTT_LABELS.elliottTripleCombo).toEqual(["(0)", "(W)", "(X)", "(Y)", "(XX)", "(Z)"]);
	});
});

describe("calculateElliottWaveGeometry", () => {
	it("returns null when fewer than 2 points", () => {
		const drawing = makeDrawing("elliottImpulse", [makePoint(0, 0)]);
		expect(calculateElliottWaveGeometry(drawing, scales)).toBeNull();
	});

	it("returns correct pixel count for impulse (6 points)", () => {
		const points = Array.from({ length: 6 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("elliottImpulse", points);
		const geo = calculateElliottWaveGeometry(drawing, scales);
		expect(geo).not.toBeNull();
		expect(geo!.pixels).toHaveLength(6);
	});

	it("returns correct pixel count for correction (4 points)", () => {
		const points = Array.from({ length: 4 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("elliottCorrection", points);
		const geo = calculateElliottWaveGeometry(drawing, scales);
		expect(geo!.pixels).toHaveLength(4);
	});

	it("uses waveLabels override when set", () => {
		const points = Array.from({ length: 4 }, (_, i) => makePoint(i, i));
		const drawing = { ...makeDrawing("elliottCorrection", points), waveLabels: ["A", "B", "C", "D"] };
		const geo = calculateElliottWaveGeometry(drawing, scales);
		expect(geo!.labels).toEqual(["A", "B", "C", "D"]);
	});

	it("uses default labels when waveLabels not set", () => {
		const points = Array.from({ length: 4 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("elliottCorrection", points);
		const geo = calculateElliottWaveGeometry(drawing, scales);
		expect(geo!.labels).toEqual(ELLIOTT_LABELS.elliottCorrection);
	});
});

describe("ElliottImpulse tool", () => {
	it("createDraft creates 6 points all equal to startPoint", () => {
		const start = makePoint(5, 10);
		const draft = ElliottImpulse.createDraft(start);
		expect(draft.points).toHaveLength(6);
		for (const point of draft.points) {
			expect(point).toEqual(start);
		}
	});

	it("updateDraft replaces next placeholder", () => {
		const start = makePoint(0, 0);
		const draft = ElliottImpulse.createDraft(start);
		const next = makePoint(1, 1);
		const updated = ElliottImpulse.updateDraft(draft, next);
		// First non-anchor point replaced
		expect(updated.points[1]).toEqual(next);
		// Remaining placeholders still equal startPoint
		expect(updated.points[2]).toEqual(start);
	});
});

describe("ElliottCorrection tool", () => {
	it("createDraft creates 4 points", () => {
		const start = makePoint(3, 7);
		const draft = ElliottCorrection.createDraft(start);
		expect(draft.points).toHaveLength(4);
	});
});
