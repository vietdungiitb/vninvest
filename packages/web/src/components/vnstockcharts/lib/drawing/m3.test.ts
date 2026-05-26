import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { appendPoint } from "./shared";
import { createDrawingInteractionState, deleteSelectedInteractionState, drawingInteractionReducer, createTool, listDrawingTools, renderDrawingToSvg } from "./index";
import { createDrawingObject as createObject } from "./shared";
import type { DrawingObject, Point } from "./types";

const scales = {
	xScale: (date: Date) => date.getTime() / 1000,
	xScaleInvert: (px: number) => new Date(px * 1000),
	yScale: (price: number) => price * 4,
	yScaleInvert: (px: number) => px / 4,
};

const options = {
	chartWidth: 640,
	chartHeight: 360,
	isSelected: false,
} as const;

const startPoint: Point = { x: 100_000, y: 20 };
const endPoint: Point = { x: 160_000, y: 40 };
const flatPoint: Point = { x: 160_000, y: 20 };

function createSimpleDrawing(type: DrawingObject["type"], id: string, points: Point[]) {
	return createObject(type, points, { id });
}

describe("M3 drawing tools", () => {
	it("registers the new tool names", () => {
		const names = listDrawingTools().map((tool) => tool.name);

		expect(names).toEqual(expect.arrayContaining([
			"ray",
			"extendedLine",
			"polyline",
			"dateAndPriceRange",
			"longPosition",
			"shortPosition",
			"fibExtension",
		]));
	});

	it("builds the new tool drafts and geometry metadata", () => {
		const ray = createTool("ray").createDraft(startPoint);
		const extendedLine = createTool("extendedLine").createDraft(startPoint);
		const polyline = createTool("polyline").createDraft(startPoint);
		const dateAndPriceRange = createTool("dateAndPriceRange").createDraft(startPoint);
		const longPosition = createTool("longPosition").createDraft(startPoint);
		const shortPosition = createTool("shortPosition").createDraft(startPoint);
		const fibExtension = createTool("fibExtension").createDraft(startPoint);

		expect(ray.points).toHaveLength(2);
		expect(extendedLine.extendLeft).toBe(true);
		expect(extendedLine.extendRight).toBe(true);
		expect(polyline.points).toHaveLength(2);
		expect(dateAndPriceRange.type).toBe("dateAndPriceRange");
		expect(longPosition.riskReward).toEqual({ entry: 20, stop: 20, target: 20 });
		expect(shortPosition.riskReward).toEqual({ entry: 20, stop: 20, target: 20 });
		expect(fibExtension.fibLevelConfigs).toHaveLength(5);
		expect(fibExtension.fibLevelConfigs![0].ratio).toBe(1.272);
		expect(fibExtension.fibLevelConfigs!.every((c) => c.visible)).toBe(true);
	});

	it("appends polyline points through the shared helper", () => {
		const polyline = createTool("polyline");
		const draft = polyline.createDraft(startPoint);
		const preview = polyline.updateDraft(draft, endPoint);
		const completed = appendPoint(preview, flatPoint);

		expect(preview.points).toEqual([startPoint, endPoint]);
		expect(completed.points).toEqual([startPoint, endPoint, flatPoint]);
	});

	it("supports multi-select deletion through the reducer", () => {
		const first = createSimpleDrawing("trendLine", "drawing-1", [startPoint, endPoint]);
		const second = createSimpleDrawing("trendLine", "drawing-2", [startPoint, flatPoint]);
		const initial = createDrawingInteractionState([first, second]);
		const selected = drawingInteractionReducer(initial, {
			type: "SET_SELECTED_OBJECTS",
			objectIds: [first.id, second.id],
		});

		expect(selected.drawingState).toEqual({
			type: "selectedMultiple",
			objectIds: [first.id, second.id],
		});

		const deleted = deleteSelectedInteractionState(selected);
		expect(deleted.drawingState).toEqual({ type: "idle" });
		expect(deleted.history.present).toHaveLength(0);
	});

	it("renders the extended tool family", () => {
		const ray = createSimpleDrawing("ray", "ray-1", [startPoint, flatPoint]);
		const extendedLine = createSimpleDrawing("extendedLine", "extended-line-1", [startPoint, flatPoint]);
		const polyline = createSimpleDrawing("polyline", "polyline-1", [startPoint, endPoint, flatPoint]);
		const dateAndPriceRange = createSimpleDrawing("dateAndPriceRange", "range-1", [startPoint, endPoint]);
		const longPosition = createSimpleDrawing("longPosition", "long-1", [startPoint, endPoint]);
		const shortPosition = createSimpleDrawing("shortPosition", "short-1", [startPoint, endPoint]);
		const fibExtension = createSimpleDrawing("fibExtension", "fib-ext-1", [startPoint, endPoint]);
		const extendedLineElements = renderDrawingToSvg(extendedLine, scales, options) as Array<ReactElement<any>>;

		expect(renderDrawingToSvg(ray, scales, options).some((element) => element.type === "line")).toBe(true);
		expect(extendedLineElements[0]?.props.x1).toBe(0);
		expect(renderDrawingToSvg(polyline, scales, options).some((element) => element.type === "polyline")).toBe(true);
		expect(renderDrawingToSvg(dateAndPriceRange, scales, options).some((element) => element.type === "text")).toBe(true);
		expect(renderDrawingToSvg(longPosition, scales, options).filter((element) => element.type === "rect")).toHaveLength(2);
		expect(renderDrawingToSvg(shortPosition, scales, options).filter((element) => element.type === "line")).toHaveLength(3);
		expect(renderDrawingToSvg(fibExtension, scales, options).filter((element) => element.type === "text")).toHaveLength(5);
	});
});
