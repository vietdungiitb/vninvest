import { describe, it, expect } from "vitest";
import { computeLiveMeasurement } from "./measuring";
import type { ChartScales } from "./coordinateUtils";
import type { Point } from "./types";

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const T0 = new Date("2024-01-01T09:00:00Z").getTime();
const T1 = new Date("2024-01-01T10:00:00Z").getTime();
const T2 = new Date("2024-01-01T11:00:00Z").getTime();
const T3 = new Date("2024-01-01T12:00:00Z").getTime();
const T4 = new Date("2024-01-01T13:00:00Z").getTime();
const T5 = new Date("2024-01-01T14:00:00Z").getTime();

/** Simple linear x/y scales: x maps time → pixel index offset, y maps price → inverted pixel */
function makeScales(overrides?: Partial<ChartScales>): ChartScales {
	const dates = [T0, T1, T2, T3, T4, T5];
	const plotData = dates.map((t) => ({ date: new Date(t), close: 100 }));
	const scales: ChartScales = {
		xScale: (d: Date) => (d.getTime() - T0) / (T1 - T0) * 100,
		xScaleInvert: (px: number) => new Date(T0 + (px / 100) * (T1 - T0)),
		yScale: (price: number) => 600 - price * 2, // higher price → smaller pixel y (inverted)
		yScaleInvert: (px: number) => (600 - px) / 2,
		xAccessor: (d: any) => d.date as Date,
		plotData: plotData as any,
		...overrides,
	};
	return scales;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeLiveMeasurement – DT6", () => {
	it("DT6-01: returns null when scales are invalid", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T1, y: 105 };
		const badScales = {} as ChartScales;
		expect(computeLiveMeasurement(p0, p1, badScales)).toBeNull();
	});

	it("DT6-02: priceDelta is correct for an upward move", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T1, y: 110 };
		const result = computeLiveMeasurement(p0, p1, makeScales());
		expect(result).not.toBeNull();
		expect(result!.priceDelta).toBeCloseTo(10, 5);
	});

	it("DT6-03: priceDelta is negative for a downward move", () => {
		const p0: Point = { x: T0, y: 110 };
		const p1: Point = { x: T1, y: 90 };
		const result = computeLiveMeasurement(p0, p1, makeScales());
		expect(result!.priceDelta).toBeCloseTo(-20, 5);
	});

	it("DT6-04: pricePct is correct (positive case)", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T1, y: 105 };
		const result = computeLiveMeasurement(p0, p1, makeScales());
		expect(result!.pricePct).toBeCloseTo(0.05, 5);
	});

	it("DT6-05: pricePct is 0 when start price is 0 (division guard)", () => {
		const p0: Point = { x: T0, y: 0 };
		const p1: Point = { x: T1, y: 10 };
		const result = computeLiveMeasurement(p0, p1, makeScales());
		expect(result!.pricePct).toBe(0);
	});

	it("DT6-06: barCount counts bars between timestamps using plotData", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T3, y: 110 }; // T0→T3 = 3 intervals = 3 bars (T1, T2, T3 inclusive minus start = 3)
		const result = computeLiveMeasurement(p0, p1, makeScales());
		// bars between T0 and T3: T0, T1, T2, T3 → 4 dates → 3 intervals
		expect(result!.barCount).toBe(3);
	});

	it("DT6-07: px0 and px1 are computed from scale projections", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T1, y: 100 };
		const scales = makeScales();
		const result = computeLiveMeasurement(p0, p1, scales);
		expect(result!.px0.x).toBeCloseTo(scales.xScale(new Date(T0)), 3);
		expect(result!.px0.y).toBeCloseTo(scales.yScale(100), 3);
		expect(result!.px1.x).toBeCloseTo(scales.xScale(new Date(T1)), 3);
		expect(result!.px1.y).toBeCloseTo(scales.yScale(100), 3);
	});

	it("DT6-08: timeDeltaMs equals p1.x - p0.x", () => {
		const p0: Point = { x: T0, y: 100 };
		const p1: Point = { x: T2, y: 100 };
		const result = computeLiveMeasurement(p0, p1, makeScales());
		expect(result!.timeDeltaMs).toBe(T2 - T0);
	});
});
