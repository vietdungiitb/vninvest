import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { createDrawingObject as createObject } from "./shared";
import { createTool, listDrawingTools, renderDrawingToSvg } from "./index";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel";
import { calculatePitchforkGeometry } from "./builtin/pitchfork";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern";
import { calculateFibArcGeometry, DEFAULT_FIB_ARC_LEVELS } from "./builtin/fibArc";
import { calculateFibTimeZoneGeometry, DEFAULT_FIB_TIME_ZONE_LEVELS } from "./builtin/fibTimeZone";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel";
import type { DrawingObject, Point } from "./types";

const scales = {
	xScale: (date: Date) => date.getTime(),
	xScaleInvert: (px: number) => new Date(px),
	yScale: (price: number) => price,
	yScaleInvert: (px: number) => px,
};

const options = {
	chartWidth: 800,
	chartHeight: 400,
	isSelected: false,
	plotData: [] as Array<{ date: number; open: number; high: number; low: number; close: number; volume: number }>,
} as const;

const startPoint: Point = { x: 0, y: 10 };
const midPoint: Point = { x: 100, y: 20 };
const endPoint: Point = { x: 200, y: 10 };

function createSimpleDrawing(type: DrawingObject["type"], id: string, points: Point[]) {
	return createObject(type, points, { id });
}

describe("M4 drawing tools", () => {
	it("registers the new tool names", () => {
		const names = listDrawingTools().map((tool) => tool.name);

		expect(names).toEqual(expect.arrayContaining([
			"parallelChannel",
			"pitchfork",
			"abcdPattern",
			"fibArc",
			"fibTimeZone",
			"regressionChannel",
		]));
	});

	it("builds the M4 tool drafts", () => {
		expect(createTool("parallelChannel").createDraft(startPoint).points).toHaveLength(3);
		expect(createTool("pitchfork").createDraft(startPoint).points).toHaveLength(3);
		expect(createTool("abcdPattern").createDraft(startPoint).points).toHaveLength(4);
		expect(createTool("fibArc").createDraft(startPoint).points).toHaveLength(2);
		expect(createTool("fibTimeZone").createDraft(startPoint).points).toHaveLength(2);
		expect(createTool("regressionChannel").createDraft(startPoint).points).toHaveLength(2);
	});

	it("calculates the pattern geometry helpers", () => {
		const parallel = calculateParallelChannelGeometry(createSimpleDrawing("parallelChannel", "parallel-1", [
			{ x: 0, y: 0 },
			{ x: 200, y: 0 },
			{ x: 100, y: 10 },
		]), scales);
		const pitchfork = calculatePitchforkGeometry(createSimpleDrawing("pitchfork", "pitchfork-1", [startPoint, midPoint, { x: 200, y: 0 }]), scales);
		const abcd = calculateAbcdPatternMetrics(createSimpleDrawing("abcdPattern", "abcd-1", [startPoint, midPoint, { x: 200, y: 30 }, { x: 300, y: 20 }]), scales);
		const fibArc = calculateFibArcGeometry(createSimpleDrawing("fibArc", "fib-arc-1", [startPoint, { x: 300, y: 40 }]), scales);
		const fibTimeZone = calculateFibTimeZoneGeometry(createSimpleDrawing("fibTimeZone", "fib-tz-1", [startPoint, { x: 50, y: 0 }]), scales);

		expect(parallel?.width).toBeCloseTo(10);
		expect(pitchfork?.midpoint).toEqual({ x: 150, y: 10 });
		expect(abcd?.bcToAb).toBeCloseTo(1);
		expect(abcd?.cdToBc).toBeCloseTo(1);
		expect(fibArc?.levels).toEqual(DEFAULT_FIB_ARC_LEVELS);
		expect(fibArc?.radii[1]).toBeCloseTo(fibArc?.baseRadius ? fibArc.baseRadius * 0.5 : 0);
		expect(fibTimeZone?.levels).toEqual(DEFAULT_FIB_TIME_ZONE_LEVELS);
		expect(fibTimeZone?.positions[1]).toBe(100);
	});

	it("calculates regression channel statistics", () => {
		const plotData = [0, 1, 2, 3, 4].map((date) => ({
			date,
			open: 0,
			high: 0,
			low: 0,
			close: 2 * date + 10,
			volume: 0,
		}));
		const drawing = createSimpleDrawing("regressionChannel", "regression-1", [
			{ x: 0, y: 10 },
			{ x: 4, y: 18 },
		]);
		const metrics = calculateRegressionChannelMetrics(drawing, scales, plotData);

		expect(metrics?.slope).toBeCloseTo(2);
		expect(metrics?.intercept).toBeCloseTo(10);
		expect(metrics?.stdDev).toBeCloseTo(0);
		expect(metrics?.rSquared).toBeCloseTo(1);
	});

	it("renders the M4 shapes and channels", () => {
		const parallel = createSimpleDrawing("parallelChannel", "parallel-render", [startPoint, midPoint, endPoint]);
		const pitchfork = createSimpleDrawing("pitchfork", "pitchfork-render", [startPoint, midPoint, { x: 200, y: 0 }]);
		const abcd = createSimpleDrawing("abcdPattern", "abcd-render", [startPoint, midPoint, { x: 200, y: 30 }, { x: 300, y: 20 }]);
		const fibArc = createSimpleDrawing("fibArc", "fib-arc-render", [startPoint, { x: 300, y: 40 }]);
		const fibTimeZone = createSimpleDrawing("fibTimeZone", "fib-tz-render", [startPoint, { x: 50, y: 0 }]);
		const regression = createSimpleDrawing("regressionChannel", "regression-render", [
			{ x: 0, y: 10 },
			{ x: 4, y: 18 },
		]);
		const regressionElements = renderDrawingToSvg(regression, scales, {
			...options,
			plotData: [0, 1, 2, 3, 4].map((date) => ({
				date,
				open: 0,
				high: 0,
				low: 0,
				close: 2 * date + 10,
				volume: 0,
			})),
		}) as Array<ReactElement<any>>;

		expect(renderDrawingToSvg(parallel, scales, options).filter((element) => element.type === "line")).toHaveLength(3);
		expect(renderDrawingToSvg(pitchfork, scales, options).filter((element) => element.type === "line")).toHaveLength(3);
		expect(renderDrawingToSvg(pitchfork, scales, options).filter((element) => element.type === "text")).toHaveLength(3);
		expect(renderDrawingToSvg(abcd, scales, options).filter((element) => element.type === "line")).toHaveLength(3);
		expect(renderDrawingToSvg(abcd, scales, options).filter((element) => element.type === "text")).toHaveLength(6);
		expect(renderDrawingToSvg(fibArc, scales, options).filter((element) => element.type === "path")).toHaveLength(3);
		expect(renderDrawingToSvg(fibTimeZone, scales, options).filter((element) => element.type === "line")).toHaveLength(8);
		expect(renderDrawingToSvg(fibTimeZone, scales, options).filter((element) => element.type === "text")).toHaveLength(8);
		expect(regressionElements.filter((element) => element.type === "line")).toHaveLength(3);
		expect(regressionElements.some((element) => element.type === "polygon")).toBe(true);
		expect(regressionElements.some((element) => element.type === "text" && String(element.props.children).includes("R²"))).toBe(true);
	});
});