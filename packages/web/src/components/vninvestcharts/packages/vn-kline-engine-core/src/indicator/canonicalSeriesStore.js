/**
 * KF-03-T03 — Canonical series store.
 *
 * Implements the "compute once, read many" principle from the SSOT indicator
 * policy.  All consumers that need the data series for a given
 * `IndicatorSeriesKeyInput` must read from the same store instance; no
 * consumer may recompute the series independently.
 *
 * The store is intentionally generic (`T`) so it can hold computed series
 * arrays, pre-computed extents, or any other derived value keyed by a
 * canonical indicator identity.
 */
import { buildIndicatorSeriesKeyString, indicatorSeriesKeyToString, } from "./indicatorSeriesKey.js";
// ── CanonicalSeriesStore ──────────────────────────────────────────────────────
/**
 * A `Map`-backed store keyed by canonical `IndicatorSeriesKey` strings.
 *
 * The same store instance should be shared across all panes / renderers so
 * that an indicator series is computed exactly once per unique key.
 */
export class CanonicalSeriesStore {
    _cache = new Map();
    /**
     * Retrieve the cached series value for `input`, or `undefined` if not yet
     * computed.
     */
    get(input) {
        return this._cache.get(this._toKey(input));
    }
    /**
     * Store a computed series value under the canonical key derived from
     * `input`.  Subsequent `get` calls with an equivalent `input` will return
     * this value.
     */
    set(input, value) {
        this._cache.set(this._toKey(input), value);
    }
    /**
     * Return `true` when a cached entry exists for `input`.
     */
    has(input) {
        return this._cache.has(this._toKey(input));
    }
    /**
     * Remove the cached entry for `input`.  The next `get` will return
     * `undefined`, forcing the caller to recompute.
     */
    invalidate(input) {
        this._cache.delete(this._toKey(input));
    }
    /**
     * Remove all cached entries.
     */
    clear() {
        this._cache.clear();
    }
    /**
     * Return the number of cached entries.
     */
    get size() {
        return this._cache.size;
    }
    /**
     * Iterate over all cached entries as `[canonicalKeyString, value]` pairs.
     */
    entries() {
        return this._cache.entries();
    }
    /**
     * Return the canonical key string for an `IndicatorSeriesKeyInput` or a
     * structured `IndicatorSeriesKey`.
     */
    canonicalKey(input) {
        return this._toKey(input);
    }
    // ── Internal ────────────────────────────────────────────────────────────
    _toKey(input) {
        if (this._isStructuredKey(input)) {
            return indicatorSeriesKeyToString(input);
        }
        return buildIndicatorSeriesKeyString(input);
    }
    _isStructuredKey(input) {
        return "normalizedParams" in input;
    }
}
// ── Singleton convenience store ───────────────────────────────────────────────
/**
 * A module-level singleton store for indicator data series.
 *
 * In production each `VNInvestCharts` widget should own its own store instance
 * (created via `createCanonicalSeriesStore`) so that different chart surfaces
 * do not share cache entries.  The singleton is provided for convenience in
 * environments where a single global store is appropriate.
 */
export const globalCanonicalSeriesStore = new CanonicalSeriesStore();
/**
 * Factory helper.  Use this to create per-widget store instances.
 */
export function createCanonicalSeriesStore() {
    return new CanonicalSeriesStore();
}
