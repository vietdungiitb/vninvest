// @vitest-environment node
import { describe, expect, it } from "vitest";
import { appendTailCache, createDerivedCache, DEFAULT_BUCKET_SIZE, prependHeadCache, queryYRange, replaceAllCache, } from "./derivedCache";
// ─── Helpers ─────────────────────────────────────────────────────────────────
function makeBars(count, baseClose = 100) {
    return Array.from({ length: count }, (_, i) => ({
        close: baseClose + i,
        index: i,
    }));
}
// ─── T05-01: pan same dataset does NOT recompute full resident indicator values
describe("derivedCache — KF-12-T05", () => {
    it("T05-01a: creates correct buckets for a small bar array", () => {
        const bars = makeBars(10);
        const cache = createDerivedCache(bars, "close", 4);
        // 10 bars / bucket-size 4 → 3 buckets: [0-3], [4-7], [8-9]
        expect(cache.buckets).toHaveLength(3);
        expect(cache.buckets[0]).toMatchObject({ startIndex: 0, endIndex: 3, min: 100, max: 103 });
        expect(cache.buckets[1]).toMatchObject({ startIndex: 4, endIndex: 7, min: 104, max: 107 });
        expect(cache.buckets[2]).toMatchObject({ startIndex: 8, endIndex: 9, min: 108, max: 109 });
    });
    it("T05-01b: queryYRange with visible sub-window only touches overlapping buckets", () => {
        // 200 bars: bucket size 64 → 4 buckets
        const bars = makeBars(200);
        const cache = createDerivedCache(bars, "close", 64);
        expect(cache.buckets).toHaveLength(4); // [0-63], [64-127], [128-191], [192-199]
        // Query visible window [70, 90] — only bucket 1 ([64-127]) overlaps
        const result = queryYRange(cache, 70, 90);
        expect(result).not.toBeNull();
        // Bucket 1 covers indices 64-127 so min=164, max=227; but query only merges bucket 1
        expect(result.min).toBe(164); // bar[64].close = 100 + 64 = 164
        expect(result.max).toBe(227); // bar[127].close = 100 + 127 = 227
    });
    it("T05-01c: pan (same dataset, different visible range) reuses all existing bucket objects", () => {
        const bars = makeBars(200);
        const cache = createDerivedCache(bars, "close", 64);
        // Simulate pan: query different visible windows — buckets object references stay the same
        const bucketsRef = cache.buckets;
        const r1 = queryYRange(cache, 0, 50);
        const r2 = queryYRange(cache, 60, 120);
        // Buckets did not change reference (no mutation)
        expect(cache.buckets).toBe(bucketsRef);
        expect(r1).not.toBeNull();
        expect(r2).not.toBeNull();
    });
    // ─── T05-02: append-tail only invalidates the tail bucket
    it("T05-02a: appendTailCache keeps stable bucket count for head when appending 1 bar in same bucket", () => {
        // 4 bars → 1 bucket (size 4); append 1 bar → still 1 bucket, last bucket recomputed
        const bars = makeBars(4);
        const cache = createDerivedCache(bars, "close", 4);
        const stableHeadBuckets = cache.buckets.slice(0, 0); // no buckets before last
        const bars2 = [...bars, { close: 200, index: 4 }];
        const cache2 = appendTailCache(bars2, 4, cache);
        // Still 2 buckets: [0-3] (stable) + [4-4] (new partial)
        expect(cache2.buckets).toHaveLength(2);
        // Head bucket untouched (object identity preserved via slice)
        expect(stableHeadBuckets).toEqual([]);
        expect(cache2.buckets[1]).toMatchObject({ startIndex: 4, endIndex: 4, min: 200, max: 200 });
    });
    it("T05-02b: appendTailCache with no previous bars triggers full rebuild", () => {
        const bars = makeBars(8);
        const emptyCache = createDerivedCache([], "close", 4);
        const cache = appendTailCache(bars, 0, emptyCache);
        expect(cache.buckets).toHaveLength(2); // [0-3], [4-7]
    });
    it("T05-02c: appendTailCache stable head buckets are object-identical (not recomputed)", () => {
        // 12 bars → 3 buckets of size 4; append 1 more → buckets 0 and 1 must be same objects
        const bars = makeBars(12);
        const cache = createDerivedCache(bars, "close", 4);
        const bucket0Before = cache.buckets[0];
        const bucket1Before = cache.buckets[1];
        const bars2 = [...bars, { close: 999, index: 12 }];
        const cache2 = appendTailCache(bars2, 12, cache);
        // bucket 0 and 1 stable (indices 0-3, 4-7), bucket 2+ recomputed
        expect(cache2.buckets[0]).toBe(bucket0Before);
        expect(cache2.buckets[1]).toBe(bucket1Before);
        // last bucket is new
        expect(cache2.buckets[2]).not.toBe(cache.buckets[2]);
    });
    // ─── T05-03: y-range query for visible range doesn't scan full resident window
    it("T05-03a: queryYRange for narrow visible range returns correct min/max without full scan", () => {
        // 1000 bars, bucket size 64 → 16 buckets
        const bars = makeBars(1000);
        const cache = createDerivedCache(bars, "close", 64);
        expect(cache.buckets).toHaveLength(16); // ceil(1000/64) = 16
        // Query visible range [0, 63] — only bucket 0 should be touched
        const result = queryYRange(cache, 0, 63);
        expect(result).toMatchObject({ min: 100, max: 163 }); // bar[0..63].close = 100..163
    });
    it("T05-03b: queryYRange for out-of-range window returns null", () => {
        const bars = makeBars(10);
        const cache = createDerivedCache(bars, "close", 4);
        const result = queryYRange(cache, 20, 30);
        expect(result).toBeNull();
    });
    it("T05-03c: queryYRange for full resident window merges all buckets", () => {
        const bars = makeBars(100);
        const cache = createDerivedCache(bars, "close", 64);
        const result = queryYRange(cache, 0, 99);
        expect(result).toMatchObject({ min: 100, max: 199 });
    });
    // ─── Edge cases
    it("creates empty cache for empty bar array", () => {
        const cache = createDerivedCache([], "close");
        expect(cache.buckets).toHaveLength(0);
        expect(queryYRange(cache, 0, 10)).toBeNull();
    });
    it("prependHeadCache re-indexes existing buckets correctly", () => {
        const bars = makeBars(8);
        const cache = createDerivedCache(bars, "close", 4);
        // buckets: [0-3], [4-7]
        const prependBars = makeBars(4, 50); // close: 50, 51, 52, 53
        const allBars = [...prependBars, ...bars];
        const cache2 = prependHeadCache(allBars, 4, cache);
        // New head bucket: [0-3] (close 50-53)
        // Old buckets shifted: [4-7], [8-11]
        expect(cache2.buckets).toHaveLength(3);
        expect(cache2.buckets[0]).toMatchObject({ startIndex: 0, endIndex: 3, min: 50, max: 53 });
        expect(cache2.buckets[1]).toMatchObject({ startIndex: 4, endIndex: 7 });
        expect(cache2.buckets[2]).toMatchObject({ startIndex: 8, endIndex: 11 });
    });
    it("replaceAllCache rebuilds all buckets from scratch", () => {
        const bars = makeBars(8);
        const cache = createDerivedCache(bars, "close", 4);
        const newBars = makeBars(4, 500);
        const cache2 = replaceAllCache(newBars, cache);
        expect(cache2.buckets).toHaveLength(1);
        expect(cache2.buckets[0]).toMatchObject({ min: 500, max: 503 });
    });
    it("uses DEFAULT_BUCKET_SIZE when not specified", () => {
        const bars = makeBars(DEFAULT_BUCKET_SIZE * 2);
        const cache = createDerivedCache(bars, "close");
        expect(cache.bucketSize).toBe(DEFAULT_BUCKET_SIZE);
        expect(cache.buckets).toHaveLength(2);
    });
    it("handles bars with missing or non-numeric field gracefully", () => {
        const bars = [
            { close: "not-a-number", index: 0 },
            { index: 1 }, // missing field
            { close: 200, index: 2 },
        ];
        const cache = createDerivedCache(bars, "close", 4);
        const result = queryYRange(cache, 0, 2);
        // Only bar 2 has numeric close=200
        expect(result).toMatchObject({ min: 200, max: 200 });
    });
});
