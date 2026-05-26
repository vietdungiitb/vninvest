import { describe, expect, it } from "vitest";
import type { EnrichedDatum } from "../calculators/types";
import { buildIndicatorSeriesKey, resolveSeriesStructuredValue, resolveSeriesValue, resolveSeriesValueAccessors } from "../seriesValueResolver";
import type { SeriesConfig } from "../types/pane-descriptor";

function makeDatum(): EnrichedDatum {
	return {
		date: new Date("2024-01-01T00:00:00.000Z"),
		open: 100,
		high: 110,
		low: 90,
		close: 105,
		volume: 1_000,
		ema20: 102,
		ema50: 98,
		rsi: 57,
		macd: { macd: 1.1, signal: 0.8, divergence: 0.3 },
		bollingerBand: { top: 112, middle: 104, bottom: 96 },
		whaleBuyVol: 12,
		whaleSellVol: 7,
		indicatorValues: {
			"EMA:period=21": 201,
			"EMA:period=34": 340,
			"MA:period=21": 151,
			"RSI:period=21": 61,
			"MACD:fast=8:slow=21:signal=5": { macd: 2.2, signal: 1.7, divergence: 0.5 },
			"BollingerBand:period=10:stdDev=3": { top: 120, middle: 103, bottom: 86 },
			"Whale:threshold=75000": { whaleBuyVol: 4, whaleSellVol: 9 },
		},
	};
}

describe("seriesValueResolver", () => {
	it("buildIndicatorSeriesKey encodes runtime params exactly", () => {
		expect(buildIndicatorSeriesKey({ type: "EMA", yAxis: "right", params: { period: 21 } })).toBe("EMA:period=21");
		expect(buildIndicatorSeriesKey({ type: "MACD", yAxis: "right", params: { fast: 8, slow: 21, signal: 5 } })).toBe("MACD:fast=8:slow=21:signal=5");
	});

	it("resolveSeriesValue reads exact canonical EMA key instead of threshold fallbacks", () => {
		const datum = makeDatum();
		const ema21: SeriesConfig = { type: "EMA", yAxis: "right", params: { period: 21 } };
		const ema34: SeriesConfig = { type: "EMA", yAxis: "right", params: { period: 34 } };
		const ema50: SeriesConfig = { type: "EMA", yAxis: "right", params: { period: 50 } };

		expect(resolveSeriesValue(datum, ema21)).toBe(201);
		expect(resolveSeriesValue(datum, ema34)).toBe(340);
		expect(resolveSeriesValue(datum, ema50)).toBe(98);
	});

	it("resolveSeriesValue for MA uses canonical indicatorValues instead of close fallback", () => {
		const datum = makeDatum();
		const ma21: SeriesConfig = { type: "MA", yAxis: "right", params: { period: 21 } };

		expect(resolveSeriesValue(datum, ma21)).toBe(151);
	});

	it("resolveSeriesValueAccessors shares the same canonical Bollinger object across yExtents", () => {
		const datum = makeDatum();
		const series: SeriesConfig = { type: "BollingerBand", yAxis: "right", params: { period: 10, stdDev: 3 } };
		const accessors = resolveSeriesValueAccessors(series);

		expect(accessors).toHaveLength(3);
		expect(accessors[0]?.(datum)).toBe(120);
		expect(accessors[1]?.(datum)).toBe(103);
		expect(accessors[2]?.(datum)).toBe(86);
	});

	it("resolveSeriesStructuredValue returns the exact MACD tuple for the configured params", () => {
		const datum = makeDatum();
		const series: SeriesConfig = { type: "MACD", yAxis: "right", params: { fast: 8, slow: 21, signal: 5 } };
		const value = resolveSeriesStructuredValue(datum, series);

		expect(value).toEqual({ macd: 2.2, signal: 1.7, divergence: 0.5 });
	});
});