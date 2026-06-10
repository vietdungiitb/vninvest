import { describe, expect, it, beforeEach } from "vitest";
import { buildIndicatorSeriesKey, buildIndicatorSeriesKeyString, indicatorSeriesKeysEqual, indicatorSeriesKeyToString, normalizeIndicatorParams, } from "./indicatorSeriesKey";
import { getDefaultIndicatorParams, listIndicators, lookupIndicator, registerIndicator, resolveIndicatorParams, } from "./indicatorCatalog";
import { createCanonicalSeriesStore } from "./canonicalSeriesStore";
// ── T01 — IndicatorSeriesKey normalization ────────────────────────────────────
describe("indicatorSeriesKey", () => {
    describe("normalizeIndicatorParams", () => {
        it("returns '{}' for undefined params", () => {
            expect(normalizeIndicatorParams(undefined)).toBe("{}");
        });
        it("returns '{}' for empty params", () => {
            expect(normalizeIndicatorParams({})).toBe("{}");
        });
        it("sorts keys alphabetically", () => {
            const a = normalizeIndicatorParams({ period: 20, stdDev: 2 });
            const b = normalizeIndicatorParams({ stdDev: 2, period: 20 });
            expect(a).toBe(b);
            expect(a).toBe('{"period":20,"stdDev":2}');
        });
        it("omits undefined values", () => {
            const result = normalizeIndicatorParams({ period: 14, color: undefined });
            expect(result).toBe('{"period":14}');
        });
        it("replaces non-finite numbers with null", () => {
            const result = normalizeIndicatorParams({ period: NaN, limit: Infinity });
            expect(result).toBe('{"limit":null,"period":null}');
        });
    });
    describe("buildIndicatorSeriesKeyString", () => {
        it("generates identical keys for equivalent inputs regardless of param order", () => {
            const input1 = {
                sourceId: "BTCUSDT-BINANCE",
                timeframe: "1h",
                indicatorType: "BollingerBand",
                params: { stdDev: 2, period: 20 },
            };
            const input2 = {
                sourceId: "BTCUSDT-BINANCE",
                timeframe: "1h",
                indicatorType: "BollingerBand",
                params: { period: 20, stdDev: 2 },
            };
            expect(buildIndicatorSeriesKeyString(input1)).toBe(buildIndicatorSeriesKeyString(input2));
        });
        it("defaults transformKey to 'raw' when absent", () => {
            const key = buildIndicatorSeriesKeyString({
                sourceId: "VNINDEX",
                timeframe: "1D",
                indicatorType: "EMA",
                params: { period: 50 },
            });
            expect(key).toContain("|raw|");
        });
        it("produces different keys for different indicator types", () => {
            const base = { sourceId: "X", timeframe: "1h", indicatorType: "EMA", params: { period: 20 } };
            const other = { ...base, indicatorType: "MA" };
            expect(buildIndicatorSeriesKeyString(base)).not.toBe(buildIndicatorSeriesKeyString(other));
        });
        it("produces different keys for different params", () => {
            const a = { sourceId: "X", timeframe: "1h", indicatorType: "EMA", params: { period: 20 } };
            const b = { ...a, params: { period: 50 } };
            expect(buildIndicatorSeriesKeyString(a)).not.toBe(buildIndicatorSeriesKeyString(b));
        });
        it("produces different keys for different timeframes", () => {
            const a = { sourceId: "X", timeframe: "1h", indicatorType: "RSI" };
            const b = { ...a, timeframe: "4h" };
            expect(buildIndicatorSeriesKeyString(a)).not.toBe(buildIndicatorSeriesKeyString(b));
        });
        it("produces different keys for different transforms", () => {
            const a = { sourceId: "X", timeframe: "1h", transformKey: "raw", indicatorType: "EMA" };
            const b = { ...a, transformKey: "heikinashi" };
            expect(buildIndicatorSeriesKeyString(a)).not.toBe(buildIndicatorSeriesKeyString(b));
        });
    });
    describe("buildIndicatorSeriesKey + indicatorSeriesKeyToString", () => {
        it("round-trips to the same string as buildIndicatorSeriesKeyString", () => {
            const input = {
                sourceId: "VNINDEX",
                timeframe: "1D",
                indicatorType: "MACD",
                params: { fast: 12, slow: 26, signal: 9 },
            };
            const structured = buildIndicatorSeriesKey(input);
            expect(indicatorSeriesKeyToString(structured)).toBe(buildIndicatorSeriesKeyString(input));
        });
    });
    describe("indicatorSeriesKeysEqual", () => {
        it("returns true for structurally equal keys", () => {
            const a = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } });
            const b = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } });
            expect(indicatorSeriesKeysEqual(a, b)).toBe(true);
        });
        it("returns false when any component differs", () => {
            const base = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } });
            const diffPeriod = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 21 } });
            const diffType = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "EMA", params: { period: 14 } });
            expect(indicatorSeriesKeysEqual(base, diffPeriod)).toBe(false);
            expect(indicatorSeriesKeysEqual(base, diffType)).toBe(false);
        });
    });
});
// ── T02 — IndicatorCatalog ────────────────────────────────────────────────────
describe("indicatorCatalog", () => {
    it("lists built-in indicators covering all key series types", () => {
        const ids = listIndicators().map((e) => e.id);
        expect(ids).toContain("EMA");
        expect(ids).toContain("RSI");
        expect(ids).toContain("MACD");
        expect(ids).toContain("BollingerBand");
        expect(ids).toContain("CVDApprox");
        expect(ids).toContain("Whale");
        expect(ids).toContain("StrengthElder");
    });
    it("looks up a specific entry", () => {
        const entry = lookupIndicator("MACD");
        expect(entry).toBeDefined();
        expect(entry?.category).toBe("momentum");
        expect(entry?.outputSchema?.type).toBe("macd");
    });
    it("returns undefined for unknown indicator", () => {
        expect(lookupIndicator("UNKNOWN_INDICATOR_XYZ")).toBeUndefined();
    });
    it("getDefaultIndicatorParams returns empty object for indicators with no defaults", () => {
        const defaults = getDefaultIndicatorParams("Candlestick");
        expect(defaults).toEqual({});
    });
    it("getDefaultIndicatorParams returns catalog defaults for parameterised indicators", () => {
        const defaults = getDefaultIndicatorParams("RSI");
        expect(defaults).toEqual({ period: 14 });
    });
    it("resolveIndicatorParams merges overrides over catalog defaults", () => {
        const resolved = resolveIndicatorParams("MACD", { fast: 8 });
        expect(resolved).toEqual({ fast: 8, slow: 26, signal: 9 });
    });
    it("resolveIndicatorParams returns defaults when no overrides", () => {
        const resolved = resolveIndicatorParams("BollingerBand");
        expect(resolved).toEqual({ period: 20, stdDev: 2 });
    });
    describe("registerIndicator", () => {
        beforeEach(() => {
            // Each test in this group starts with the built-in registrations intact;
            // only the custom entries registered here will be verified.
        });
        it("allows registering a custom indicator", () => {
            registerIndicator({
                id: "CustomTestIndicator",
                category: "trend",
                panePolicy: "overlay",
                scalePolicy: "price",
                repaintPolicy: "no-repaint",
                defaultParams: { period: 10 },
            });
            expect(lookupIndicator("CustomTestIndicator")).toBeDefined();
            expect(getDefaultIndicatorParams("CustomTestIndicator")).toEqual({ period: 10 });
        });
        it("overwrites a previously registered entry (last-write wins)", () => {
            registerIndicator({ id: "CustomTestIndicator", category: "volume" });
            const entry = lookupIndicator("CustomTestIndicator");
            expect(entry?.category).toBe("volume");
        });
    });
});
// ── T03 & T04 — CanonicalSeriesStore parity ───────────────────────────────────
describe("canonicalSeriesStore", () => {
    describe("CanonicalSeriesStore", () => {
        it("stores and retrieves a value by IndicatorSeriesKeyInput", () => {
            const store = createCanonicalSeriesStore();
            const key = { sourceId: "X", timeframe: "1h", indicatorType: "EMA", params: { period: 20 } };
            const series = [1, 2, 3];
            store.set(key, series);
            expect(store.get(key)).toBe(series);
        });
        it("returns undefined for a key not yet stored", () => {
            const store = createCanonicalSeriesStore();
            const key = { sourceId: "X", timeframe: "1h", indicatorType: "RSI" };
            expect(store.get(key)).toBeUndefined();
        });
        it("same canonical key regardless of params insertion order (parity invariant)", () => {
            const store = createCanonicalSeriesStore();
            const pane1Input = {
                sourceId: "BTCUSDT-BINANCE",
                timeframe: "1h",
                indicatorType: "BollingerBand",
                params: { stdDev: 2, period: 20 },
            };
            const pane2Input = {
                sourceId: "BTCUSDT-BINANCE",
                timeframe: "1h",
                indicatorType: "BollingerBand",
                params: { period: 20, stdDev: 2 },
            };
            store.set(pane1Input, "computed-series");
            // pane2 (different pane, same indicator) must find the same cached entry
            expect(store.get(pane2Input)).toBe("computed-series");
        });
        it("pane reorder / axis side change does not affect key identity", () => {
            // The store key does NOT include pane id or axis side — per SSOT policy
            const store = createCanonicalSeriesStore();
            const key = { sourceId: "X", timeframe: "4h", indicatorType: "RSI", params: { period: 14 } };
            store.set(key, "rsi-series");
            // Even if the consumer is on a different pane, the key is the same
            expect(store.get({ ...key })).toBe("rsi-series");
        });
        it("invalidate removes the cached entry", () => {
            const store = createCanonicalSeriesStore();
            const key = { sourceId: "X", timeframe: "1h", indicatorType: "MA", params: { period: 10 } };
            store.set(key, 42);
            store.invalidate(key);
            expect(store.get(key)).toBeUndefined();
        });
        it("clear removes all entries", () => {
            const store = createCanonicalSeriesStore();
            store.set({ sourceId: "X", timeframe: "1h", indicatorType: "EMA", params: { period: 20 } }, 1);
            store.set({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } }, 2);
            expect(store.size).toBe(2);
            store.clear();
            expect(store.size).toBe(0);
        });
        it("has() returns correct boolean", () => {
            const store = createCanonicalSeriesStore();
            const key = { sourceId: "X", timeframe: "1h", indicatorType: "MACD" };
            expect(store.has(key)).toBe(false);
            store.set(key, null);
            expect(store.has(key)).toBe(true);
        });
        it("accepts structured IndicatorSeriesKey as input", () => {
            const store = createCanonicalSeriesStore();
            const structured = buildIndicatorSeriesKey({ sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } });
            store.set(structured, "from-structured-key");
            // Retrieval via an equivalent IndicatorSeriesKeyInput should also work
            const viaInput = { sourceId: "X", timeframe: "1h", indicatorType: "RSI", params: { period: 14 } };
            expect(store.get(viaInput)).toBe("from-structured-key");
        });
    });
});
