import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_RANGE, resolveChartRangeExtents } from "../chartRange";

function buildBars(startDate: Date, count: number) {
	return Array.from({ length: count }, (_, index) => ({
		date: new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + index, 12, 0, 0),
	}));
}

describe("resolveChartRangeExtents", () => {
	it("uses the recent five-day window by default", () => {
		const data = buildBars(new Date(2026, 4, 1), 10);
		const [start, end] = resolveChartRangeExtents(data, DEFAULT_CHART_RANGE);

		expect(start.getFullYear()).toBe(2026);
		expect(start.getMonth()).toBe(4);
		expect(start.getDate()).toBe(5);
		expect(end.getFullYear()).toBe(2026);
		expect(end.getMonth()).toBe(4);
		expect(end.getDate()).toBe(10);
	});

	it("clamps the YTD range to the first available bar", () => {
		const data = buildBars(new Date(2025, 10, 20), 20);
		const [start, end] = resolveChartRangeExtents(data, "YTD");

		expect(start.getFullYear()).toBe(2025);
		expect(start.getMonth()).toBe(10);
		expect(start.getDate()).toBe(20);
		expect(end.getFullYear()).toBe(2025);
		expect(end.getMonth()).toBe(11);
		expect(end.getDate()).toBe(9);
	});

	it("returns the full dataset for All", () => {
		const data = buildBars(new Date(2026, 0, 1), 3);
		const [start, end] = resolveChartRangeExtents(data, "All");

		expect(start.getDate()).toBe(1);
		expect(end.getDate()).toBe(3);
	});
});