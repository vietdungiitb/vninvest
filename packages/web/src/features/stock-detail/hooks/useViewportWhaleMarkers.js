import { useMemo } from "react";

/**
 * useViewportWhaleMarkers
 * 
 * Dynamic viewport-based hook to assign whale markers.
 * Identifies the top 10% volume candles currently visible in the chart viewport.
 * 
 * @param {Array<object>} candles - Array of all candle records (e.g. { time, volume, whaleVolume, ... })
 * @param {number} startIndex - Starting index of the visible range in the viewport (inclusive)
 * @param {number} endIndex - Ending index of the visible range in the viewport (inclusive)
 * @returns {Set<string|number>} - A Set containing the unique time/timestamp identifiers of candles that should display the whale icon.
 */
export function useViewportWhaleMarkers(candles = [], startIndex = 0, endIndex = 0) {
  return useMemo(() => {
    if (!Array.isArray(candles) || candles.length === 0) {
      return new Set();
    }

    const safeStart = Math.max(0, Math.min(startIndex, candles.length - 1));
    const safeEnd = Math.max(safeStart, Math.min(endIndex, candles.length - 1));
    
    // Slice visible candles
    const visibleCandles = candles.slice(safeStart, safeEnd + 1);
    if (visibleCandles.length === 0) {
      return new Set();
    }

    // Determine target count: top 10% of visible viewport, minimum of 1
    const targetCount = Math.max(1, Math.floor(visibleCandles.length * 0.1));

    // Sort visible candles by whaleVolume (primary) or regular volume (fallback) descending
    const sorted = [...visibleCandles].sort((a, b) => {
      const volA = a?.whaleVolume ?? a?.volume ?? 0;
      const volB = b?.whaleVolume ?? b?.volume ?? 0;
      return volB - volA;
    });

    // Take top K candle times/timestamps
    const whaleTimes = new Set();
    for (let i = 0; i < Math.min(targetCount, sorted.length); i++) {
      const candle = sorted[i];
      if (candle && candle.time != null) {
        whaleTimes.add(candle.time);
      }
    }

    return whaleTimes;
  }, [candles, startIndex, endIndex]);
}
