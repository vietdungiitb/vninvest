import { describe, expect, it } from "vitest";
import { scaleLinear, scaleTime } from "d3-scale";
import { measurementPointToPixelFromScales, resolveMeasurementPointFromValues, summarizeMeasurement } from "./canvasMeasurement";
describe("canvasMeasurement", () => {
    it("resolves a measurement point from values and converts it back to pixels", () => {
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
        const point = resolveMeasurementPointFromValues({
            plotData,
            xAccessor: (datum) => datum.date,
            dateValue: new Date("2024-01-02T00:00:00.000Z"),
            priceValue: 110,
        });
        expect(point).toMatchObject({ index: 1, price: 110 });
        const pixelPoint = measurementPointToPixelFromScales({
            point: point,
            xScale,
            yScale,
        });
        expect(pixelPoint).not.toBeUndefined();
        expect(pixelPoint?.x).toBeCloseTo(100, 6);
        expect(pixelPoint?.y).toBeCloseTo(100, 6);
    });
    it("summarizes the bar and price deltas", () => {
        expect(summarizeMeasurement({
            start: { index: 3, date: new Date("2024-01-01T00:00:00.000Z"), price: 100 },
            end: { index: 8, date: new Date("2024-01-02T00:00:00.000Z"), price: 132.5 },
        })).toEqual({
            bars: 5,
            priceDelta: 32.5,
            priceDeltaPercent: 0.325,
        });
    });
});
