import { describe, expect, it } from "vitest";
import { calcCVDApprox } from "../calcCVDApprox";
import { enrichData } from "../enrichData";
import { mockOHLCV300 } from "../fixtures/mockData";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../../seriesValueResolver";
import type { RawOHLCV } from "../types";

describe("enrichData", () => {
	it("returns same number of items", () => {
		const enriched = enrichData(mockOHLCV300);
		expect(enriched).toHaveLength(mockOHLCV300.length);
	});

	it("ema20 is undefined for the first 19 bars", () => {
		const enriched = enrichData(mockOHLCV300);
		for (let index = 0; index < 19; index += 1) {
			expect(enriched[index]?.ema20).toBeUndefined();
		}
		expect(enriched[19]?.ema20).toBeDefined();
	});

	it("cvdApprox is cumulative and matches running delta sum", () => {
		const enriched = enrichData(mockOHLCV300);
		let cumulative = 0;
		enriched.forEach((bar) => {
			cumulative += bar.cvdDelta ?? 0;
			if (bar.cvdApprox !== undefined) {
				expect(Math.abs(bar.cvdApprox - cumulative)).toBeLessThan(0.01);
			}
		});
	});

	it("bullPower equals high - ema13 when ema13 is available", () => {
		const enriched = enrichData(mockOHLCV300);
		for (let index = 12; index < 30; index += 1) {
			const bar = enriched[index];
			if (bar?.ema13 !== undefined && bar.bullPower !== undefined) {
				expect(bar.bullPower).toBeCloseTo(bar.high - bar.ema13, 6);
				expect(bar.bearPower).toBeCloseTo(bar.low - bar.ema13, 6);
			}
		}
	});

	it("whale buy/sell volumes are never negative", () => {
		const enriched = enrichData(mockOHLCV300);
		enriched.forEach((bar) => {
			if (bar.whaleBuyVol !== undefined) {
				expect(bar.whaleBuyVol).toBeGreaterThanOrEqual(0);
			}
			if (bar.whaleSellVol !== undefined) {
				expect(bar.whaleSellVol).toBeGreaterThanOrEqual(0);
			}
		});
	});

	it("handles doji edge case with High === Low", () => {
		const singleBar: RawOHLCV[] = [{
			date: new Date(),
			open: 100,
			high: 100,
			low: 100,
			close: 100,
			volume: 1_000,
		}];
		const result = calcCVDApprox(singleBar);
		expect(result[0]?.cvdDelta).toBeCloseTo(0, 6);
		expect(result[0]?.cvdApprox).toBeCloseTo(0, 6);
	});

	it("performance: 1000 bars under 50ms", () => {
		const bigData = Array.from({ length: 1000 }, (_, index): RawOHLCV => ({
			date: new Date(Date.UTC(2024, 0, index + 1)),
			open: 100,
			high: 105,
			low: 98,
			close: 103,
			volume: 10_000,
		}));
		const startedAt = performance.now();
		enrichData(bigData);
		expect(performance.now() - startedAt).toBeLessThan(50);
	});

	it("materializes canonical indicator values for requested runtime params", () => {
		const series = [
			{ type: "EMA", yAxis: "right", params: { period: 21 } },
			{ type: "RSI", yAxis: "left", params: { period: 21 } },
			{ type: "BollingerBand", yAxis: "right", params: { period: 10, stdDev: 3 } },
			{ type: "MACD", yAxis: "right", params: { fast: 8, slow: 21, signal: 5 } },
			{ type: "Whale", yAxis: "right", params: { threshold: 75_000 } },
		] as const;
		const enriched = enrichData(mockOHLCV300, { series });
		const bar = enriched[80];

		expect(resolveSeriesValue(bar!, series[0])).toBeTypeOf("number");
		expect(resolveSeriesValue(bar!, series[1])).toBeTypeOf("number");
		expect(resolveSeriesStructuredValue(bar!, series[2])).toEqual(
			expect.objectContaining({ top: expect.any(Number), middle: expect.any(Number), bottom: expect.any(Number) }),
		);
		expect(resolveSeriesStructuredValue(bar!, series[3])).toEqual(
			expect.objectContaining({ macd: expect.any(Number), signal: expect.any(Number), divergence: expect.any(Number) }),
		);
		expect(bar?.indicatorValues?.["EMA:period=21"]).toBeDefined();
		expect(bar?.indicatorValues?.["RSI:period=21"]).toBeDefined();
	});

	it("materializes the default canonical demo indicator keys", () => {
		const enriched = enrichData(mockOHLCV300);
		const bar = enriched[80];

		expect(bar?.indicatorValues?.["EMA:period=20"]).toBeDefined();
		expect(bar?.indicatorValues?.["EMA:period=50"]).toBeDefined();
		expect(bar?.indicatorValues?.["RSI:period=14"]).toBeDefined();
		expect(bar?.indicatorValues?.["MACD:fast=12:slow=26:signal=9"]).toBeDefined();
		expect(bar?.indicatorValues?.["BollingerBand:period=20:stdDev=2"]).toBeDefined();
	});

	it("KF10-T03-01: materializes both EMA:period=13 and EMA:period=20 when both series are requested", () => {
		const series = [
			{ type: "EMA", yAxis: "right", params: { period: 13 } },
			{ type: "EMA", yAxis: "right", params: { period: 20 } },
		] as const;
		const enriched = enrichData(mockOHLCV300, { series });
		const bar = enriched[80];

		expect(bar?.indicatorValues?.["EMA:period=13"]).toBeDefined();
		expect(bar?.indicatorValues?.["EMA:period=20"]).toBeDefined();
	});

	it("KF10-T03-02: EMA period-specific values remain independent", () => {
		const ema13Only = enrichData(mockOHLCV300, {
			series: [{ type: "EMA", yAxis: "right", params: { period: 13 } }],
		});
		const ema20Only = enrichData(mockOHLCV300, {
			series: [{ type: "EMA", yAxis: "right", params: { period: 20 } }],
		});

		const bar13 = ema13Only[80];
		const bar20 = ema20Only[80];

		expect(bar13?.indicatorValues?.["EMA:period=13"]).toBeDefined();
		expect(bar13?.indicatorValues?.["EMA:period=20"]).toBeDefined();
		expect(bar20?.indicatorValues?.["EMA:period=20"]).toBeDefined();
		expect(bar20?.indicatorValues?.["EMA:period=13"]).toBeDefined();

		// Default EMA periods are always computed, but period-specific values must stay distinct.
		expect(bar13?.indicatorValues?.["EMA:period=13"]).not.toBe(bar13?.indicatorValues?.["EMA:period=20"]);
		expect(bar20?.indicatorValues?.["EMA:period=13"]).not.toBe(bar20?.indicatorValues?.["EMA:period=20"]);
	});
});
