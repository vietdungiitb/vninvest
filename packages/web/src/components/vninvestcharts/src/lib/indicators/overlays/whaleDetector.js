/**
 * Whale order detection and classification
 * Detects large institutional orders (buy/sell imbalance > threshold)
 */
/**
 * Detect whale events (large orders) in enriched data
 *
 * @param enrichedData - Array of bar data with whaleBuyVol, whaleSellVol
 * @param threshold - Minimum order size in VND (default: 1,000,000)
 * @returns Array of detected whale events
 *
 * @example
 * const events = detectWhaleEvents(data, 1_000_000);
 * // events with netDelta >= 1M appear
 */
export function detectWhaleEvents(enrichedData, threshold) {
    return enrichedData
        .map((bar, index) => {
        const buyVol = bar["whaleBuyVol"] ?? 0;
        const sellVol = bar["whaleSellVol"] ?? 0;
        const netDelta = buyVol - sellVol;
        // Must exceed threshold on either side
        if (Math.abs(netDelta) < threshold)
            return null;
        // Categorize by relative magnitude
        const abs = Math.abs(netDelta);
        const sizeCategory = abs >= threshold * 5 ? "mega" : abs >= threshold * 2.5 ? "xlarge" : "large";
        return {
            index,
            date: bar["date"] ?? new Date(),
            buyVol,
            sellVol,
            netDelta,
            dominance: buyVol > sellVol ? "buy" : "sell",
            sizeCategory,
        };
    })
        .filter((e) => e !== null);
}
/**
 * Format volume for display
 * @param vol - Volume in VND
 * @returns Formatted string (e.g., "1.5M", "500K")
 */
export function formatVolume(vol) {
    if (vol >= 1_000_000)
        return `${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000)
        return `${(vol / 1_000).toFixed(0)}K`;
    return vol.toString();
}
/**
 * Format whale event for tooltip/label
 * @param event - Whale event to format
 * @returns Human-readable string
 *
 * @example
 * formatWhaleEvent(event) // "BUY 1.5M"
 */
export function formatWhaleEvent(event) {
    const side = event.dominance === "buy" ? "BUY" : "SELL";
    return `${side} ${formatVolume(Math.abs(event.netDelta))}`;
}
/**
 * Get bubble radius for rendering
 * @param category - Size category
 * @returns Radius in pixels
 */
export function getBubbleRadius(category) {
    const radiusMap = {
        large: 10,
        xlarge: 14,
        mega: 18,
    };
    return radiusMap[category] ?? 10;
}
/**
 * Get bubble color for rendering
 * @param dominance - Buy or sell side
 * @param alpha - Opacity (0-1)
 * @returns RGBA color string
 */
export function getBubbleColor(dominance, alpha = 0.4) {
    return dominance === "buy" ? `rgba(34,139,34,${alpha})` : `rgba(178,34,34,${alpha})`;
}
/**
 * Get bubble stroke color
 * @param dominance - Buy or sell side
 * @returns Hex color string
 */
export function getBubbleStrokeColor(dominance) {
    return dominance === "buy" ? "#22AA44" : "#CC4444";
}
