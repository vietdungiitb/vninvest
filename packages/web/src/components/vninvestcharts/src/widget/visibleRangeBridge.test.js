import { describe, expect, it } from "vitest";
import { normalizeEngineVisibleRange, normalizeForkVisibleRange, normalizeVisibleRangeForEngine, resolveForkVisibleRangeFromDateExtents, } from "./visibleRangeBridge";
const data = [
    { date: new Date("2026-01-01T00:00:00.000Z") },
    { date: new Date("2026-01-02T00:00:00.000Z") },
    { date: new Date("2026-01-03T00:00:00.000Z") },
    { date: new Date("2026-01-04T00:00:00.000Z") },
];
describe("visibleRangeBridge", () => {
    it("normalizes engine visible range into an inclusive widget visible range", () => {
        const normalized = normalizeForkVisibleRange({ from: 1, to: 3 }, data);
        expect(normalized).toEqual({
            startIndex: 1,
            endIndex: 2,
            startDate: data[1].date,
            endDate: data[2].date,
            barCount: 2,
        });
    });
    it("clamps fractional and out-of-bounds engine ranges before exposing widget values", () => {
        const normalized = normalizeForkVisibleRange({ from: -2.4, to: 2.2 }, data);
        expect(normalized).toEqual({
            startIndex: 0,
            endIndex: 2,
            startDate: data[0].date,
            endDate: data[2].date,
            barCount: 3,
        });
    });
    it("resolves date extents into an engine range with an exclusive upper bound", () => {
        const range = resolveForkVisibleRangeFromDateExtents([
            data[1].date,
            data[2].date,
        ], data);
        expect(range).toEqual({ from: 1, to: 3 });
    });
    it("resolves reversed date extents using the nearest available bars", () => {
        const range = resolveForkVisibleRangeFromDateExtents([
            new Date("2026-01-03T12:00:00.000Z"),
            new Date("2025-12-31T12:00:00.000Z"),
        ], data);
        expect(range).toEqual({ from: 0, to: 3 });
    });
    it("normalizes engine-visible input into an in-bounds exclusive range", () => {
        const range = normalizeEngineVisibleRange({ from: 3.7, to: -2.2 }, data.length);
        expect(range).toEqual({ from: 0, to: 4 });
    });
    it("normalizes inclusive widget visible ranges into exclusive engine ranges", () => {
        const range = normalizeVisibleRangeForEngine({
            startIndex: 1,
            endIndex: 2,
            startDate: data[1].date,
            endDate: data[2].date,
            barCount: 2,
        }, data.length);
        expect(range).toEqual({ from: 1, to: 3 });
    });
});
