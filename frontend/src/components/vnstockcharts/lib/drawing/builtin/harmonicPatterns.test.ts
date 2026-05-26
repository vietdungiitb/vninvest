import { describe, expect, it } from "vitest";
import {
	calculateHarmonicPatternGeometry,
	CypherPattern,
	PATTERN_HAS_CLOSING_LINE,
	PATTERN_POINT_COUNT,
	PATTERN_POINT_LABELS,
	XabcdPattern,
	HeadAndShoulders,
	TrianglePattern,
	ThreeDrivesPattern,
} from "./harmonicPatterns";
import type { DrawingObject } from "../types";

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
		style: { stroke: "#00bcd4", strokeWidth: 1 },
		createdAt: 0,
		updatedAt: 0,
	};
}

describe("PATTERN_POINT_COUNT", () => {
	it("has correct counts for all 5 patterns", () => {
		expect(PATTERN_POINT_COUNT.xabcdPattern).toBe(5);
		expect(PATTERN_POINT_COUNT.cypherPattern).toBe(5);
		expect(PATTERN_POINT_COUNT.headAndShoulders).toBe(7);
		expect(PATTERN_POINT_COUNT.trianglePattern).toBe(5);
		expect(PATTERN_POINT_COUNT.threeDrivesPattern).toBe(7);
	});
});

describe("PATTERN_POINT_LABELS", () => {
	it("xabcdPattern labels are X,A,B,C,D", () => {
		expect(PATTERN_POINT_LABELS.xabcdPattern).toEqual(["X", "A", "B", "C", "D"]);
	});

	it("cypherPattern labels are X,A,B,C,D", () => {
		expect(PATTERN_POINT_LABELS.cypherPattern).toEqual(["X", "A", "B", "C", "D"]);
	});

	it("headAndShoulders labels are LS,LV,H,RV,RS,NL,NR", () => {
		expect(PATTERN_POINT_LABELS.headAndShoulders).toEqual(["LS", "LV", "H", "RV", "RS", "NL", "NR"]);
	});

	it("trianglePattern labels are H1,L1,H2,L2,apex", () => {
		expect(PATTERN_POINT_LABELS.trianglePattern).toEqual(["H1", "L1", "H2", "L2", "apex"]);
	});

	it("threeDrivesPattern labels are S,1,A,2,B,3,E", () => {
		expect(PATTERN_POINT_LABELS.threeDrivesPattern).toEqual(["S", "1", "A", "2", "B", "3", "E"]);
	});
});

describe("PATTERN_HAS_CLOSING_LINE", () => {
	it("xabcdPattern and cypherPattern have closing line", () => {
		expect(PATTERN_HAS_CLOSING_LINE.xabcdPattern).toBe(true);
		expect(PATTERN_HAS_CLOSING_LINE.cypherPattern).toBe(true);
	});

	it("headAndShoulders and threeDrivesPattern do not have closing line", () => {
		expect(PATTERN_HAS_CLOSING_LINE.headAndShoulders).toBe(false);
		expect(PATTERN_HAS_CLOSING_LINE.threeDrivesPattern).toBe(false);
	});
});

describe("calculateHarmonicPatternGeometry", () => {
	it("returns null when fewer than 2 points", () => {
		const drawing = makeDrawing("xabcdPattern", [makePoint(0, 0)]);
		expect(calculateHarmonicPatternGeometry(drawing, scales as never)).toBeNull();
	});

	it("returns correct pixel count for xabcdPattern (5 points)", () => {
		const points = Array.from({ length: 5 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("xabcdPattern", points);
		const geo = calculateHarmonicPatternGeometry(drawing, scales as never);
		expect(geo).not.toBeNull();
		expect(geo!.pixels).toHaveLength(5);
	});

	it("returns correct pixel count for headAndShoulders (7 points)", () => {
		const points = Array.from({ length: 7 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("headAndShoulders", points);
		const geo = calculateHarmonicPatternGeometry(drawing, scales as never);
		expect(geo!.pixels).toHaveLength(7);
	});

	it("sets isHeadAndShoulders=true for headAndShoulders type", () => {
		const points = Array.from({ length: 7 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("headAndShoulders", points);
		const geo = calculateHarmonicPatternGeometry(drawing, scales as never);
		expect(geo!.isHeadAndShoulders).toBe(true);
	});

	it("sets isHeadAndShoulders=false for other types", () => {
		const points = Array.from({ length: 5 }, (_, i) => makePoint(i, i));
		const drawing = makeDrawing("xabcdPattern", points);
		const geo = calculateHarmonicPatternGeometry(drawing, scales as never);
		expect(geo!.isHeadAndShoulders).toBe(false);
	});
});

describe("XabcdPattern tool", () => {
	it("createDraft creates 5 points all equal to startPoint", () => {
		const start = makePoint(10, 20);
		const draft = XabcdPattern.createDraft(start);
		expect(draft.points).toHaveLength(5);
		for (const point of draft.points) {
			expect(point).toEqual(start);
		}
	});

	it("updateDraft replaces next placeholder", () => {
		const start = makePoint(0, 0);
		const draft = XabcdPattern.createDraft(start);
		const next = makePoint(5, 5);
		const updated = XabcdPattern.updateDraft(draft, next);
		expect(updated.points[1]).toEqual(next);
		expect(updated.points[2]).toEqual(start);
	});
});

describe("CypherPattern tool", () => {
	it("createDraft creates 5 points", () => {
		const draft = CypherPattern.createDraft(makePoint(1, 1));
		expect(draft.points).toHaveLength(5);
	});
});

describe("HeadAndShoulders tool", () => {
	it("createDraft creates 7 points", () => {
		const draft = HeadAndShoulders.createDraft(makePoint(1, 1));
		expect(draft.points).toHaveLength(7);
	});
});

describe("TrianglePattern tool", () => {
	it("createDraft creates 5 points", () => {
		const draft = TrianglePattern.createDraft(makePoint(1, 1));
		expect(draft.points).toHaveLength(5);
	});
});

describe("ThreeDrivesPattern tool", () => {
	it("createDraft creates 7 points", () => {
		const draft = ThreeDrivesPattern.createDraft(makePoint(1, 1));
		expect(draft.points).toHaveLength(7);
	});
});
