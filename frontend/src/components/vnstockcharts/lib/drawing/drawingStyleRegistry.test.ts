import { afterEach, describe, expect, it, vi } from "vitest";
import { createDrawingObject } from "./shared";
import { clearDrawingStyleOverride, clearDrawingStyleOverrides, getDrawingStyleOverride, listDrawingStyleOverrides, overrideDrawingStyle, resolveDrawingStyle, subscribeDrawingStyle, subscribeDrawingStyleChanges } from "./drawingStyleRegistry";

afterEach(() => {
	clearDrawingStyleOverrides();
	vi.restoreAllMocks();
});

describe("drawing style override registry", () => {
	it("sets and merges overrides per drawing", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 10, y: 20 },
			{ x: 20, y: 30 },
		], { id: "drawing-1" });

		overrideDrawingStyle(drawing.id, { color: "#ff0000" });
		overrideDrawingStyle(drawing.id, { lineWidth: 3, dashPattern: [6, 4] });

		expect(getDrawingStyleOverride(drawing.id)).toEqual({ color: "#ff0000", lineWidth: 3, dashPattern: [6, 4] });
		expect(listDrawingStyleOverrides()).toEqual({
			"drawing-1": { color: "#ff0000", lineWidth: 3, dashPattern: [6, 4] },
		});
		expect(resolveDrawingStyle(drawing)).toMatchObject({
			stroke: "#ff0000",
			strokeWidth: 3,
			strokeDasharray: "dashed",
		});
	});

	it("notifies subscribers and clears overrides", () => {
		const drawing = createDrawingObject("trendLine", [
			{ x: 10, y: 20 },
			{ x: 20, y: 30 },
		], { id: "drawing-2" });
		const perDrawing = vi.fn();
		const global = vi.fn();
		const unsubscribeInstance = subscribeDrawingStyle(drawing.id, perDrawing);
		const unsubscribeGlobal = subscribeDrawingStyleChanges(global);

		overrideDrawingStyle(drawing.id, { opacity: 0.4 });
		clearDrawingStyleOverride(drawing.id);

		expect(perDrawing).toHaveBeenCalledTimes(2);
		expect(global).toHaveBeenCalledTimes(2);
		expect(getDrawingStyleOverride(drawing.id)).toBeUndefined();

		unsubscribeInstance();
		unsubscribeGlobal();
	});
});