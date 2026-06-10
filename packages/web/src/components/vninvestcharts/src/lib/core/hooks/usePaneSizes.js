/**
 * usePaneSizes
 * Generic N-pane height manager for resizable chart panes.
 *
 * Heights are tracked as ratios (sum = 1) so they scale with the container.
 * Ratios are persisted to localStorage when a storageKey is provided.
 *
 * @example
 * const { heights, applyDelta, reset, available } = usePaneSizes(chartHeight, {
 *   initialRatios: [0.5, 0.27, 0.23],
 *   minHeights:    [100, 36, 36],
 *   storageKey:    "my-chart-panes-v1",
 * });
 * const [priceH, volumeH, momentumH] = heights;
 */
import { useCallback, useEffect, useRef, useState } from "react";
// ── Helpers ──────────────────────────────────────────────────────────────────
function normalise(ratios) {
    const sum = ratios.reduce((a, b) => a + b, 0);
    if (sum <= 0)
        return ratios.map(() => 1 / ratios.length);
    return ratios.map((r) => r / sum);
}
function sanitize(raw, count, defaults) {
    if (Array.isArray(raw) &&
        raw.length === count &&
        raw.every((v) => typeof v === "number" && v > 0)) {
        const sum = raw.reduce((a, b) => a + b, 0);
        if (sum > 0.9 && sum < 1.1)
            return normalise(raw);
    }
    return [...defaults];
}
function loadRatios(key, count, defaults) {
    if (!key)
        return [...defaults];
    try {
        const stored = localStorage.getItem(key);
        if (stored)
            return sanitize(JSON.parse(stored), count, defaults);
    }
    catch {
        // ignore quota / security errors
    }
    return [...defaults];
}
function saveRatios(key, ratios) {
    if (!key)
        return;
    try {
        localStorage.setItem(key, JSON.stringify(ratios));
    }
    catch {
        // ignore
    }
}
/**
 * Convert ratios → pixel heights, clamping each pane to its minimum.
 * The first pane (index 0) absorbs any remaining space after minimums are satisfied.
 */
function ratiosToPx(ratios, available, minH) {
    const n = ratios.length;
    const result = ratios.map((r) => Math.round(r * available));
    // Enforce minimums bottom-up; pane[0] (price) absorbs the remainder.
    let consumed = 0;
    for (let i = n - 1; i >= 1; i--) {
        result[i] = Math.max(result[i], minH[i] ?? 40);
        consumed += result[i];
    }
    result[0] = Math.max(available - consumed, minH[0] ?? 40);
    return result;
}
function pxToRatios(heights) {
    const total = heights.reduce((a, b) => a + b, 0);
    if (total <= 0)
        return heights.map(() => 1 / heights.length);
    return heights.map((h) => h / total);
}
/**
 * Apply a drag delta between adjacent panes, clamping to minimums.
 * Only pane[splitterIndex] and pane[splitterIndex + 1] are affected.
 */
function applyDeltaBetween(heights, splitterIndex, deltaY, minH) {
    const result = [...heights];
    const a = splitterIndex;
    const b = splitterIndex + 1;
    if (b >= heights.length)
        return result;
    let newA = heights[a] + deltaY;
    let newB = heights[b] - deltaY;
    const minA = minH[a] ?? 40;
    const minB = minH[b] ?? 40;
    if (newA < minA) {
        newB -= (minA - newA);
        newA = minA;
    }
    if (newB < minB) {
        newA -= (minB - newB);
        newB = minB;
    }
    result[a] = Math.max(Math.round(newA), minA);
    result[b] = Math.max(Math.round(newB), minB);
    return result;
}
// ── Hook ─────────────────────────────────────────────────────────────────────
export function usePaneSizes(totalHeight, options = {}) {
    const { initialRatios: _initRatios, minHeights: _minH, storageKey, marginV = 36, } = options;
    const count = _initRatios?.length ?? 2;
    const defaultRatios = normalise(_initRatios ?? Array(count).fill(1 / count));
    const minH = _minH ?? Array(count).fill(40);
    const minTotal = minH.reduce((a, b) => a + b, 0);
    const available = Math.max(totalHeight - marginV, minTotal);
    // Mutable refs so callbacks always have latest values without causing re-renders.
    const defaultRatiosRef = useRef(defaultRatios);
    const minHRef = useRef(minH);
    // Sync refs every render (cheap assignment, correct if options are stable).
    defaultRatiosRef.current = defaultRatios;
    minHRef.current = minH;
    const [ratios, setRatios] = useState(() => loadRatios(storageKey, count, defaultRatios));
    useEffect(() => {
        saveRatios(storageKey, ratios);
    }, [storageKey, ratios]);
    const reset = useCallback(() => {
        setRatios([...defaultRatiosRef.current]);
    }, []);
    const applyDelta = useCallback((splitterIndex, deltaY, currentAvailable) => {
        setRatios((prev) => {
            const px = ratiosToPx(prev, currentAvailable, minHRef.current);
            const updated = applyDeltaBetween(px, splitterIndex, deltaY, minHRef.current);
            return pxToRatios(updated);
        });
    }, []);
    const heights = ratiosToPx(ratios, available, minH);
    return { heights, available, applyDelta, reset };
}
