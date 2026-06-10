/**
 * KF-12-T11: LOD Bucketizer — OHLC-preserving aggregation for Level-of-Detail rendering.
 *
 * Aggregates a sorted array of OHLC candles into larger time buckets while
 * preserving extrema (true high/low) and terminal values (open of first, close of last).
 *
 * Invariants guaranteed:
 *  - output[i].open  = input[bucketStart].open
 *  - output[i].high  = Math.max(...input[bucketStart..bucketEnd].high)
 *  - output[i].low   = Math.min(...input[bucketStart..bucketEnd].low)
 *  - output[i].close = input[bucketEnd].close
 *  - output[i].volume = sum(input[bucketStart..bucketEnd].volume)
 *  - output[i].time   = input[bucketStart].time  (bucket anchor is first candle)
 */
/**
 * Aggregate `candles` into buckets of `bucketSize` candles each.
 * The last bucket may contain fewer candles if length is not a multiple.
 *
 * O(n) time, O(ceil(n/bucketSize)) space.
 */
export function aggregateOhlc(candles, bucketSize) {
    if (bucketSize <= 1 || candles.length === 0) {
        return candles.map((c) => ({ ...c, sourceCount: 1 }));
    }
    const result = [];
    let i = 0;
    while (i < candles.length) {
        const first = candles[i];
        let high = first.high;
        let low = first.low;
        let volume = first.volume;
        const end = Math.min(i + bucketSize, candles.length);
        for (let j = i + 1; j < end; j++) {
            const c = candles[j];
            if (c.high > high)
                high = c.high;
            if (c.low < low)
                low = c.low;
            volume += c.volume;
        }
        const last = candles[end - 1];
        result.push({
            time: first.time,
            open: first.open,
            high,
            low,
            close: last.close,
            volume,
            sourceCount: end - i,
        });
        i = end;
    }
    return result;
}
/**
 * Choose the appropriate LOD level for the given viewport width in pixels
 * and the number of source candles that would be visible.
 *
 * Returns a bucket size (1 = no aggregation).
 *
 * Policy (dynamic power-of-2, targeting ≤ 0.5 candles/pixel after aggregation):
 *   cpp < 2  → bucketSize 1
 *   cpp < 4  → bucketSize 2
 *   cpp < 8  → bucketSize 4
 *   cpp ≥ 8  → smallest power-of-2 such that (cpp / bucketSize) ≤ 0.5
 *
 * Example: 63 cpp → need bucketSize ≥ 126 → round up to power-of-2 → 128
 */
export function chooseLodBucketSize(viewportWidthPx, visibleCandleCount) {
    if (visibleCandleCount <= 0 || viewportWidthPx <= 0)
        return 1;
    const candlesPerPixel = visibleCandleCount / viewportWidthPx;
    if (candlesPerPixel < 2)
        return 1;
    if (candlesPerPixel < 4)
        return 2;
    if (candlesPerPixel < 8)
        return 4;
    // For extreme zoom-out: find smallest power-of-2 so post-LOD cpp ≤ 0.5
    // i.e. bucketSize ≥ candlesPerPixel / 0.5 = candlesPerPixel * 2
    const minBucketSize = candlesPerPixel * 2;
    let bucketSize = 8;
    while (bucketSize < minBucketSize) {
        bucketSize *= 2;
    }
    return bucketSize;
}
