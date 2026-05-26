import { afterEach, describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "./clipboard";
import { clearDrawingStyleOverrides, overrideDrawingStyle } from "./drawingStyleRegistry";

afterEach(() => {
	clearDrawingStyleOverrides();
	vi.restoreAllMocks();
});

describe("drawing clipboard helpers", () => {
	it("clones snapshots without sharing mutable fields", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-1",
			locked: true,
			visible: false,
			style: { stroke: "#ff0000", strokeWidth: 2 },
			fibLevels: [0, 0.5, 1],
			riskReward: { entry: 20, stop: 16, target: 28 },
		});

		const snapshot = cloneDrawingSnapshot(drawing);

		expect(snapshot).not.toBe(drawing);
		expect(snapshot.points).not.toBe(drawing.points);
		expect(snapshot.style).not.toBe(drawing.style);
		expect(snapshot.fibLevels).not.toBe(drawing.fibLevels);
		expect(snapshot.riskReward).not.toBe(drawing.riskReward);

		snapshot.points[0] = { x: 999, y: 999 };
		snapshot.style.stroke = "#00ff00";

		expect(drawing.points).toEqual([
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		]);
		expect(drawing.style.stroke).toBe("#ff0000");
	});

	it("copies the effective style when an override is active", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-override",
			style: { stroke: "#111111", strokeWidth: 1 },
		});

		overrideDrawingStyle(drawing.id, { color: "#ff00ff", lineWidth: 4 });

		const snapshot = cloneDrawingSnapshot(drawing);
		expect(snapshot.style).toMatchObject({
			stroke: "#ff00ff",
			strokeWidth: 4,
		});
	});

	it("rebases duplicated drawings onto a target pane", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		const drawing = createDrawingObject("trendLine", [
			{ x: 100, y: 20 },
			{ x: 200, y: 40 },
		], {
			id: "drawing-3",
			paneId: "price",
			yScaleId: "right",
		});

		const offset = offsetDrawingByPixels(drawing, 12, -4, {
			paneId: "momentum",
			yScaleId: "left",
		});

		expect(offset).toMatchObject({
			id: "drawing-3-clone-1700000000000",
			clonedFrom: "drawing-3",
			paneId: "momentum",
			yScaleId: "left",
			points: [
				{ x: 112, y: 16 },
				{ x: 212, y: 36 },
			],
		});
	});

	it("offsets drawings by pixels and assigns a new id", () => {
		vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
		const drawing = createDrawingObject("rectangle", [
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
		], {
			id: "drawing-2",
			locked: true,
			visible: false,
			zIndex: 7,
		});

		const offset = offsetDrawingByPixels(drawing, 12, -4);

		expect(offset).toMatchObject({
			id: "drawing-2-clone-1700000000000",
			clonedFrom: "drawing-2",
			locked: false,
			visible: true,
			zIndex: 8,
			createdAt: 1_700_000_000_000,
			updatedAt: 1_700_000_000_000,
			points: [
				{ x: 22, y: 16 },
				{ x: 42, y: 36 },
			],
		});
		expect(drawing.points).toEqual([
			{ x: 10, y: 20 },
			{ x: 30, y: 40 },
		]);
	});
});