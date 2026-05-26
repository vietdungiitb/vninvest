import { describe, expect, it } from "vitest";

import { findSnapPoint, MAGNET_TOLERANCE } from "./snap";
import type { ChartScales } from "./coordinateUtils";
import type { DrawingObject } from "./types";

function makeScales(): ChartScales {
	const xScale = Object.assign((value: number) => value * 10, { invert: (pixel: number) => pixel / 10 }) as any;
	const yScale = Object.assign((value: number) => 400 - value * 4, { invert: (pixel: number) => (400 - pixel) / 4 }) as any;
	return {
		xScale,
		xScaleInvert: xScale.invert,
		yScale,
		yScaleInvert: yScale.invert,
		xAccessor: (datum: any) => datum.date,
		plotData: [],
	};
}

function makeTrendLine(): DrawingObject {
	return {
		id: "snap-trend",
		type: "trendLine",
		points: [
			{ x: 5, y: 50 },
			{ x: 6, y: 51 },
		],
		style: {
			stroke: "#2962ff",
			strokeWidth: 2,
		},
		visible: true,
	} as unknown as DrawingObject;
}

describe("drawing snap bridge", () => {
	it("keeps magnet tolerance levels in sync with core exports", () => {
		expect(MAGNET_TOLERANCE.weak).toBe(5);
		expect(MAGNET_TOLERANCE.normal).toBe(10);
		expect(MAGNET_TOLERANCE.strong).toBe(20);
	});

	it("findSnapPoint resolves endpoint snaps without needing OHLC data", () => {
		const scales = makeScales();
		const drawing = makeTrendLine();
		const snap = findSnapPoint(50, 200, scales, [], [drawing], 8);

		expect(snap).toMatchObject({
			chartPoint: { x: 5, y: 50 },
			snapType: "endpoint",
		});
	});
});
