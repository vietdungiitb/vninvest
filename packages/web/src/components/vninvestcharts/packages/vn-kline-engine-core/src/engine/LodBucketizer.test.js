import { describe, expect, it } from "vitest";
import { aggregateOhlc, chooseLodBucketSize } from "./LodBucketizer";
function makeCandle(time, open, high, low, close, volume = 1000) {
    return { time, open, high, low, close, volume };
}
describe("aggregateOhlc", () => {
    it("KF12-T11-01: bucketSize=1 returns all candles with sourceCount=1", () => {
        const candles = [
            makeCandle(1, 100, 110, 90, 105),
            makeCandle(2, 105, 115, 100, 112),
        ];
        const result = aggregateOhlc(candles, 1);
        expect(result).toHaveLength(2);
        expect(result[0].sourceCount).toBe(1);
        expect(result[1].sourceCount).toBe(1);
    });
    it("KF12-T11-02: preserves OHLC extrema within bucket (open=first.open, close=last.close, high=max, low=min)", () => {
        const candles = [
            makeCandle(1, 100, 110, 90, 105, 1000), // first
            makeCandle(2, 105, 120, 85, 112, 2000), // high=120, low=85 (extrema)
            makeCandle(3, 112, 115, 95, 108, 1500), // last
        ];
        const result = aggregateOhlc(candles, 3);
        expect(result).toHaveLength(1);
        const bucket = result[0];
        expect(bucket.open).toBe(100); // first candle open
        expect(bucket.high).toBe(120); // max high
        expect(bucket.low).toBe(85); // min low
        expect(bucket.close).toBe(108); // last candle close
        expect(bucket.volume).toBe(4500); // summed
        expect(bucket.time).toBe(1); // anchor = first candle time
        expect(bucket.sourceCount).toBe(3);
    });
    it("KF12-T11-03: remainder candles form a smaller final bucket", () => {
        const candles = [
            makeCandle(1, 100, 110, 90, 105),
            makeCandle(2, 105, 120, 85, 112),
            makeCandle(3, 112, 115, 95, 108),
            makeCandle(4, 108, 111, 102, 110), // partial bucket of 1
        ];
        const result = aggregateOhlc(candles, 3);
        expect(result).toHaveLength(2);
        expect(result[0].sourceCount).toBe(3);
        expect(result[1].sourceCount).toBe(1);
        expect(result[1].open).toBe(108);
        expect(result[1].close).toBe(110);
    });
    it("KF12-T11-04: empty input returns empty output", () => {
        expect(aggregateOhlc([], 3)).toHaveLength(0);
    });
    it("KF12-T11-05: bucketSize=2 groups pairs correctly", () => {
        const candles = [
            makeCandle(1, 100, 110, 90, 105),
            makeCandle(2, 105, 115, 95, 112),
            makeCandle(3, 112, 120, 100, 118),
            makeCandle(4, 118, 122, 110, 120),
        ];
        const result = aggregateOhlc(candles, 2);
        expect(result).toHaveLength(2);
        expect(result[0]).toMatchObject({ open: 100, high: 115, low: 90, close: 112, sourceCount: 2 });
        expect(result[1]).toMatchObject({ open: 112, high: 122, low: 100, close: 120, sourceCount: 2 });
    });
});
describe("chooseLodBucketSize", () => {
    it("KF12-T11-06: returns 1 when candles per pixel < 2", () => {
        // 100 candles in 800px → 0.125 cpp
        expect(chooseLodBucketSize(800, 100)).toBe(1);
    });
    it("KF12-T11-07: returns 2 when candles per pixel in [2, 4)", () => {
        // 2000 candles in 800px → 2.5 cpp
        expect(chooseLodBucketSize(800, 2000)).toBe(2);
    });
    it("KF12-T11-08: returns 4 when candles per pixel in [4, 8)", () => {
        // 4000 candles in 800px → 5 cpp
        expect(chooseLodBucketSize(800, 4000)).toBe(4);
    });
    it("KF12-T11-09: returns a power-of-2 for moderate deep zoom (cpp=10)", () => {
        // 8000 candles in 800px → 10 cpp → need bucketSize≥20 → power-of-2 = 32
        expect(chooseLodBucketSize(800, 8000)).toBe(32);
    });
    it("KF12-T11-11: handles extreme deep zoom (76k candles on 1200px = 63 cpp)", () => {
        // 76000 candles in 1200px → 63.3 cpp → need bucketSize≥126.6 → power-of-2 = 128
        expect(chooseLodBucketSize(1200, 76000)).toBe(128);
        // After LOD: 76000/128 = 593 candles → 593/1200 ≈ 0.49 cpp ✓
    });
    it("KF12-T11-12: handles truly massive datasets (1M candles on 1200px)", () => {
        // 1000000 / 1200 = 833 cpp → need bucketSize≥1666 → power-of-2 = 2048
        expect(chooseLodBucketSize(1200, 1_000_000)).toBe(2048);
    });
    it("KF12-T11-10: returns 1 for zero/invalid inputs", () => {
        expect(chooseLodBucketSize(0, 1000)).toBe(1);
        expect(chooseLodBucketSize(800, 0)).toBe(1);
    });
});
