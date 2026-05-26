import { describe, expect, it } from "vitest";
import { createDrawingObject } from "./shared";
import { resizeDrawingsByIds, translateDrawingsByIds } from "./DrawingLayer";

describe("translateDrawingsByIds", () => {
	it("moves only the selected drawing by the provided chart delta", () => {
		const moved = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], { id: "drawing-1" });
		const untouched = createDrawingObject("rectangle", [
			{ x: 300, y: 60 },
			{ x: 380, y: 120 },
		], { id: "drawing-2" });

		const nextDrawings = translateDrawingsByIds([moved, untouched], [moved.id], 15, -8);

		expect(nextDrawings[0]).toMatchObject({
			id: "drawing-1",
			points: [
				{ x: 115, y: 12 },
				{ x: 215, y: 32 },
			],
		});
		expect(nextDrawings[1]).toBe(untouched);
		expect(moved.points).toEqual([
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		]);
		expect(nextDrawings[0]).not.toBe(moved);
	});
});

describe("resizeDrawingsByIds", () => {
	it("keeps hLine horizontal when a handle is resized", () => {
		const line = createDrawingObject("hLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 20 },
		], { id: "drawing-3" });

		const nextDrawings = resizeDrawingsByIds([line], [line.id], 1, { x: 260, y: 120 });

		expect(nextDrawings[0]).toMatchObject({
			id: "drawing-3",
			points: [
				{ x: 100, y: 20 },
				{ x: 260, y: 20 },
			],
		});
		expect(line.points).toEqual([
			{ x: 100, y: 20 },
			{ x: 200, y: 20 },
		]);
	});

	it("recomputes longPosition riskReward when a handle moves", () => {
		const position = createDrawingObject("longPosition", [
			{ x: 100, y: 30 },
			{ x: 200, y: 50 },
		], { id: "drawing-4", riskReward: { entry: 30, stop: 30, target: 50 } });

		const nextDrawings = resizeDrawingsByIds([position], [position.id], 1, { x: 240, y: 70 });

		expect(nextDrawings[0]).toMatchObject({
			points: [
				{ x: 100, y: 30 },
				{ x: 240, y: 70 },
			],
			riskReward: {
				entry: 30,
				stop: 30,
				target: 70,
			},
		});
		expect(position.riskReward).toEqual({
			entry: 30,
			stop: 30,
			target: 50,
		});
	});
});