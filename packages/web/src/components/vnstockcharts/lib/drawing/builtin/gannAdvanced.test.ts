import { describe, expect, it } from "vitest";
import {
	calculateGannAdvancedGeometry,
	GANN_FRACTIONS,
	GannBox,
	GannSquare,
	GannSquareFixed,
} from "./gannAdvanced";
import type { DrawingObject } from "../types";

const scales = {
	xScale: (date: Date) => date.getTime() / 1000,
	xScaleInvert: (px: number) => new Date(px * 1000),
	yScale: (price: number) => price * 10,
	yScaleInvert: (px: number) => px / 10,
};

function makeDrawing(type: DrawingObject["type"], nPoints: number, extra?: Partial<DrawingObject>): DrawingObject {
	const points = Array.from({ length: nPoints }, (_, i) => ({ x: i * 1000, y: i * 10 }));
	return {
		id: "test",
		type,
		points,
		style: { stroke: "#faad14", strokeWidth: 1 },
		createdAt: 0,
		updatedAt: 0,
		...extra,
	};
}

describe("GANN_FRACTIONS", () => {
	it("has 7 fractions from 1/8 to 7/8", () => {
		expect(GANN_FRACTIONS).toHaveLength(7);
		expect(GANN_FRACTIONS[0]).toBeCloseTo(0.125);
		expect(GANN_FRACTIONS[6]).toBeCloseTo(0.875);
	});
});

describe("calculateGannAdvancedGeometry", () => {
	it("returns null for gannBox with fewer than 2 points", () => {
		const d = makeDrawing("gannBox", 1);
		expect(calculateGannAdvancedGeometry(d, scales as never)).toBeNull();
	});

	it("returns correct x1/y1/x2/y2 for gannBox", () => {
		const d = makeDrawing("gannBox", 2);
		const geo = calculateGannAdvancedGeometry(d, scales as never);
		expect(geo).not.toBeNull();
		expect(geo!.x1).toBeDefined();
		expect(geo!.x2).toBeDefined();
	});

	it("gannSquare forces equal width and height", () => {
		const d: DrawingObject = {
			id: "t",
			type: "gannSquare",
			points: [{ x: 0, y: 0 }, { x: 5000, y: 30 }],
			style: { stroke: "#fff", strokeWidth: 1 },
			createdAt: 0,
			updatedAt: 0,
		};
		const geo = calculateGannAdvancedGeometry(d, scales as never);
		expect(geo).not.toBeNull();
		const w = Math.abs(geo!.x2 - geo!.x1);
		const h = Math.abs(geo!.y2 - geo!.y1);
		expect(w).toBeCloseTo(h, 0);
	});

	it("gannSquareFixed uses gannSquareSize", () => {
		const d = makeDrawing("gannSquareFixed", 1, { gannSquareSize: 100 });
		const geo = calculateGannAdvancedGeometry(d, scales as never);
		expect(geo).not.toBeNull();
	});
});

describe("GannBox tool", () => {
	it("createDraft creates 2 points", () => {
		expect(GannBox.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
	});

	it("updateDraft replaces next placeholder", () => {
		const draft = GannBox.createDraft({ x: 0, y: 0 });
		const updated = GannBox.updateDraft(draft, { x: 10, y: 10 });
		expect(updated.points[1]).toEqual({ x: 10, y: 10 });
	});
});

describe("GannSquare tool", () => {
	it("createDraft creates 2 points", () => {
		expect(GannSquare.createDraft({ x: 0, y: 0 }).points).toHaveLength(2);
	});
});

describe("GannSquareFixed tool", () => {
	it("createDraft creates 1 point with gannSquareSize=100", () => {
		const draft = GannSquareFixed.createDraft({ x: 0, y: 0 });
		expect(draft.points).toHaveLength(1);
		expect(draft.gannSquareSize).toBe(100);
	});
});
