import { describe, expect, it } from "vitest";
import { scaleLinear, scaleTime } from "d3-scale";
import { measurementPointToPixel, resolveMeasurementPoint, summarizeMeasurement } from "./measuring";

describe("measuring helpers", () => {
	it("resolves a snapped point and converts it back to pixels", () => {
		const plotData = [
			{ date: new Date("2024-01-01T00:00:00.000Z"), close: 100 },
			{ date: new Date("2024-01-02T00:00:00.000Z"), close: 110 },
			{ date: new Date("2024-01-03T00:00:00.000Z"), close: 120 },
		];
		const xScale = scaleTime()
			.domain([plotData[0].date, plotData[2].date])
			.range([0, 200]);
		const yScale = scaleLinear()
			.domain([80, 140])
			.range([200, 0]);

		const moreProps = {
			chartId: "price",
			chartConfig: {
				id: "price",
				width: 200,
				height: 200,
				yScale,
			},
			xScale,
			xAccessor: (datum: typeof plotData[number]) => datum.date,
			plotData,
			mouseXY: [100, 100],
			show: true,
		};

		const point = resolveMeasurementPoint(moreProps);
		expect(point).toMatchObject({
			index: 1,
			price: 110,
		});

		const pixelPoint = measurementPointToPixel(point!, moreProps);
		expect(pixelPoint).not.toBeUndefined();
		expect(pixelPoint?.x).toBeCloseTo(100, 6);
		expect(pixelPoint?.y).toBeCloseTo(100, 6);
	});

	it("summarizes the bar and price deltas", () => {
		const summary = summarizeMeasurement({
			start: {
				index: 3,
				date: new Date("2024-01-01T00:00:00.000Z"),
				price: 100,
			},
			end: {
				index: 8,
				date: new Date("2024-01-02T00:00:00.000Z"),
				price: 132.5,
			},
		});

		expect(summary).toEqual({
			bars: 5,
			priceDelta: 32.5,
			priceDeltaPercent: 0.325,
		});
	});
});