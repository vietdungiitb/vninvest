/**
 * KF-03-T02 — Engine-core indicator catalog.
 *
 * A renderer-agnostic registry of indicator metadata.  This module MUST NOT
 * import React components or anything from `src/lib/**` or `src/demo/**`.
 * The React bindings (series components, tooltip entries) belong in the widget
 * layer or `vn-kline-engine-react`.
 *
 * The catalog is intentionally modelled after — and compatible with —
 * `src/lib/core/types/indicator-catalog.ts`, but lives in the engine package
 * so that kernel consumers can rely on it without the legacy app layer.
 */
// ── Registry ─────────────────────────────────────────────────────────────────
const _catalog = new Map();
/**
 * Register an indicator entry.  Overwrites any previously registered entry
 * with the same `id` (last-write wins; safe for hot-reload scenarios).
 */
export function registerIndicator(entry) {
    _catalog.set(entry.id, entry);
}
/**
 * Register multiple entries at once.
 */
export function registerIndicators(entries) {
    for (const entry of entries) {
        registerIndicator(entry);
    }
}
/**
 * Look up a catalog entry by indicator type id.
 * Returns `undefined` when no entry is registered for the given id.
 */
export function lookupIndicator(id) {
    return _catalog.get(id);
}
/**
 * Return a snapshot of all registered entries.
 */
export function listIndicators() {
    return [..._catalog.values()];
}
/**
 * Retrieve the default params defined in the catalog for a given indicator
 * type, or an empty object if none are registered.
 */
export function getDefaultIndicatorParams(indicatorType) {
    return _catalog.get(indicatorType)?.defaultParams ?? {};
}
/**
 * Return the merged params for a key-building call.
 *
 * If a param key exists in `overrides`, the override wins.
 * Params not present in `overrides` fall back to the catalog default.
 * This ensures the canonical key is built against a full, consistent param set.
 */
export function resolveIndicatorParams(indicatorType, overrides) {
    const defaults = getDefaultIndicatorParams(indicatorType);
    if (!overrides || Object.keys(overrides).length === 0) {
        return defaults;
    }
    return { ...defaults, ...overrides };
}
/**
 * Clear all registered entries.  Useful only in test environments.
 * @internal
 */
export function _clearCatalogForTests() {
    _catalog.clear();
}
// ── Built-in registrations ───────────────────────────────────────────────────
registerIndicators([
    { id: "Candlestick", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "HollowCandle", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "OHLC", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "HeikinAshi", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "Line", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "Area", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "Bar", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    {
        id: "EMA",
        category: "trend",
        panePolicy: "overlay",
        scalePolicy: "price",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "scalar" },
        inputSchema: [{ key: "period", labelKey: "indicator.ema.period", type: "number", defaultValue: 20, min: 1, max: 500, step: 1 }],
        defaultParams: { period: 20 },
    },
    {
        id: "MA",
        category: "trend",
        panePolicy: "overlay",
        scalePolicy: "price",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "scalar" },
        inputSchema: [{ key: "period", labelKey: "indicator.ma.period", type: "number", defaultValue: 20, min: 1, max: 500, step: 1 }],
        defaultParams: { period: 20 },
    },
    {
        id: "BBI",
        category: "trend",
        panePolicy: "overlay",
        scalePolicy: "price",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "scalar" },
    },
    {
        id: "BollingerBand",
        category: "volatility",
        panePolicy: "overlay",
        scalePolicy: "price",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "band", fields: ["upper", "middle", "lower"] },
        inputSchema: [
            { key: "period", labelKey: "indicator.bollinger.period", type: "number", defaultValue: 20, min: 2, max: 200, step: 1 },
            { key: "stdDev", labelKey: "indicator.bollinger.stdDev", type: "number", defaultValue: 2, min: 0.5, max: 5, step: 0.5 },
        ],
        defaultParams: { period: 20, stdDev: 2 },
    },
    {
        id: "RSI",
        category: "momentum",
        panePolicy: "separate",
        scalePolicy: "normalized",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "scalar" },
        inputSchema: [{ key: "period", labelKey: "indicator.rsi.period", type: "number", defaultValue: 14, min: 2, max: 200, step: 1 }],
        defaultParams: { period: 14 },
    },
    {
        id: "MACD",
        category: "momentum",
        panePolicy: "separate",
        scalePolicy: "normalized",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "macd", fields: ["macd", "signal", "divergence"] },
        inputSchema: [
            { key: "fast", labelKey: "indicator.macd.fast", type: "number", defaultValue: 12, min: 1, max: 200, step: 1 },
            { key: "slow", labelKey: "indicator.macd.slow", type: "number", defaultValue: 26, min: 1, max: 200, step: 1 },
            { key: "signal", labelKey: "indicator.macd.signal", type: "number", defaultValue: 9, min: 1, max: 100, step: 1 },
        ],
        defaultParams: { fast: 12, slow: 26, signal: 9 },
    },
    {
        id: "KDJ",
        category: "momentum",
        panePolicy: "separate",
        scalePolicy: "normalized",
        repaintPolicy: "no-repaint",
        outputSchema: { type: "stochastic", fields: ["k", "d", "j"] },
        inputSchema: [
            { key: "period", labelKey: "indicator.kdj.period", type: "number", defaultValue: 9, min: 1, max: 100, step: 1 },
        ],
        defaultParams: { period: 9 },
    },
    { id: "CCI", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 20 } },
    { id: "WR", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 14 } },
    { id: "SAR", category: "trend", panePolicy: "overlay", scalePolicy: "price", repaintPolicy: "repaint-on-close", outputSchema: { type: "scalar" } },
    { id: "Volume", category: "volume", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "histogram" } },
    { id: "OBV", category: "volume", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "VR", category: "volume", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "CVDApprox", category: "orderflow", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "CVDRealtime", category: "orderflow", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "Whale", category: "orderflow", panePolicy: "overlay", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "histogram" }, defaultParams: { threshold: 50000 } },
    { id: "StrengthElder", category: "strength", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "histogram" } },
    { id: "StrengthRelative", category: "strength", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "DMI", category: "trend", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar", fields: ["plusDI", "minusDI", "adx"] } },
    { id: "BIAS", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 6 } },
    { id: "BRAR", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar", fields: ["ar", "br"] }, defaultParams: { period: 26 } },
    { id: "MTM", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 12 } },
    { id: "EMV", category: "volume", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 14 } },
    { id: "AO", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "histogram" } },
    { id: "ROC", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 12 } },
    { id: "TRIX", category: "trend", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 12 } },
    { id: "DMA", category: "trend", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "PVT", category: "volume", panePolicy: "separate", scalePolicy: "volume", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" } },
    { id: "PSY", category: "momentum", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 12 } },
    { id: "CR", category: "strength", panePolicy: "separate", scalePolicy: "normalized", repaintPolicy: "no-repaint", outputSchema: { type: "scalar" }, defaultParams: { period: 26 } },
]);
