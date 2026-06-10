/**
 * KF-12-T05: Derived cache + y-range cache
 *
 * Purpose: Prevent full recompute of y-range (min/max) on pan/zoom by caching
 * computed range values per logical chunk of the resident bar array.
 *
 * Design:
 * - Bars are grouped into fixed-size "buckets" (default: BUCKET_SIZE).
 * - For each bucket the cache stores { min, max } over one or more numeric fields.
 * - On append-tail, only the last bucket is invalidated.
 * - On prepend-head, the new head bucket is computed; existing buckets are stable.
 * - On replace-all, the cache is cleared entirely.
 * - A y-range query over a visible window merges only the buckets that overlap the
 *   visible index range — avoiding a full O(n) scan on camera-only pan/zoom.
 *
 * This module is intentionally engine-agnostic: it operates on arrays of
 * `Record<string, unknown>` just like KernelEngine's `enrichedData`.
 */
export const DEFAULT_BUCKET_SIZE = 64;
function computeBucket(bars, startIndex, endIndex, fieldKey) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = startIndex; i <= endIndex; i++) {
        const v = bars[i]?.[fieldKey];
        if (typeof v === "number" && isFinite(v)) {
            if (v < min)
                min = v;
            if (v > max)
                max = v;
        }
    }
    if (!isFinite(min)) {
        min = 0;
        max = 0;
    }
    return { startIndex, endIndex, min, max };
}
function buildBuckets(bars, bucketSize, fieldKey) {
    if (bars.length === 0)
        return [];
    const buckets = [];
    for (let start = 0; start < bars.length; start += bucketSize) {
        const end = Math.min(start + bucketSize - 1, bars.length - 1);
        buckets.push(computeBucket(bars, start, end, fieldKey));
    }
    return buckets;
}
/**
 * Create a fresh DerivedCache from a full bar array.
 * O(n) initial build.
 */
export function createDerivedCache(bars, fieldKey, bucketSize = DEFAULT_BUCKET_SIZE) {
    return {
        buckets: buildBuckets(bars, bucketSize, fieldKey),
        bucketSize,
        fieldKey,
    };
}
/**
 * Replace all bars — clears all buckets and rebuilds.
 * O(n) — expected only on replaceAll patch.
 */
export function replaceAllCache(bars, cache) {
    return {
        ...cache,
        buckets: buildBuckets(bars, cache.bucketSize, cache.fieldKey),
    };
}
/**
 * Append new tail bars — only the tail bucket containing the previously-last bar
 * and any new buckets need to be recomputed.  All other buckets remain stable.
 * O(tail_length) — much less than O(n) for large resident windows.
 */
export function appendTailCache(bars, prevLength, cache) {
    if (bars.length === 0)
        return { ...cache, buckets: [] };
    if (prevLength === 0)
        return replaceAllCache(bars, cache);
    const { bucketSize, fieldKey, buckets } = cache;
    // The bucket that contained the last bar before append may have grown
    const lastBucketIndex = Math.floor((prevLength - 1) / bucketSize);
    // Recompute from the last bucket onward
    const stableBuckets = buckets.slice(0, lastBucketIndex);
    const recomputedBuckets = buildBuckets(bars.slice(lastBucketIndex * bucketSize), bucketSize, fieldKey).map((b) => ({
        ...b,
        startIndex: b.startIndex + lastBucketIndex * bucketSize,
        endIndex: b.endIndex + lastBucketIndex * bucketSize,
    }));
    return { ...cache, buckets: [...stableBuckets, ...recomputedBuckets] };
}
/**
 * Prepend new head bars — compute buckets for the new head portion;
 * existing buckets shift indices but their values stay valid.
 * The existing buckets are re-indexed by `prependedCount`.
 * O(prepended_length) — much less than O(n).
 */
export function prependHeadCache(bars, prependedCount, cache) {
    if (bars.length === 0)
        return { ...cache, buckets: [] };
    if (prependedCount <= 0)
        return cache;
    const { bucketSize, fieldKey, buckets } = cache;
    // Build buckets for the prepended head portion
    const headBuckets = buildBuckets(bars.slice(0, prependedCount), bucketSize, fieldKey);
    // Re-index existing buckets by prependedCount
    const shiftedTail = buckets.map((b) => ({
        ...b,
        startIndex: b.startIndex + prependedCount,
        endIndex: b.endIndex + prependedCount,
    }));
    return { ...cache, buckets: [...headBuckets, ...shiftedTail] };
}
/**
 * Query the y-range (min, max) for a visible index window [fromIndex, toIndex].
 * Only buckets that overlap the window are merged — O(k) where k = overlapping buckets.
 * k << n for typical visible spans, making pan/zoom O(k) rather than O(n).
 *
 * Returns `null` if no data in range.
 */
export function queryYRange(cache, fromIndex, toIndex) {
    const { buckets } = cache;
    if (buckets.length === 0)
        return null;
    let min = Infinity;
    let max = -Infinity;
    let found = false;
    for (const bucket of buckets) {
        // Overlap check: bucket overlaps [fromIndex, toIndex]
        if (bucket.endIndex < fromIndex || bucket.startIndex > toIndex) {
            continue;
        }
        if (bucket.min < min)
            min = bucket.min;
        if (bucket.max > max)
            max = bucket.max;
        found = true;
    }
    return found ? { min, max } : null;
}
