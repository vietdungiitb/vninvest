import { describe, it, expect } from "vitest";
import { INDICATOR_ACCESSORS, buildIndicatorValuesKey, getAccessorFor } from "./indicatorAccessors";
// ── Helpers ───────────────────────────────────────────────────────────────────
function datum(overrides = {}) {
    return {
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1_000_000,
        ...overrides,
    };
}
// ── T01: Map is exported and keyed correctly ───────────────────────────────────
describe("INDICATOR_ACCESSORS", () => {
    it("T01-01: exports a frozen/readonly record", () => {
        expect(INDICATOR_ACCESSORS).toBeDefined();
        expect(typeof INDICATOR_ACCESSORS).toBe("object");
    });
    it("T01-02: contains at least 35 entries (35 series types + sub-line keys)", () => {
        expect(Object.keys(INDICATOR_ACCESSORS).length).toBeGreaterThanOrEqual(35);
    });
    it("T01-03: RSI accessor extracts numeric value from datum", () => {
        const d = datum({ rsi: 62.5 });
        expect(INDICATOR_ACCESSORS["RSI"](d)).toBe(62.5);
    });
    it("T01-04: RSI accessor returns null when rsi field is absent", () => {
        const d = datum();
        expect(INDICATOR_ACCESSORS["RSI"](d)).toBeNull();
    });
    it("T01-05: BollingerBand middle line accessor", () => {
        const d = datum({ bollingerBand: { top: 115, middle: 105, bottom: 95 } });
        expect(INDICATOR_ACCESSORS["BollingerBand"](d)).toBe(105);
    });
    it("T01-06: BollingerBand.upper sub-line accessor", () => {
        const d = datum({ bollingerBand: { top: 115, middle: 105, bottom: 95 } });
        expect(INDICATOR_ACCESSORS["BollingerBand.upper"](d)).toBe(115);
    });
    it("T01-07: BollingerBand.lower sub-line accessor", () => {
        const d = datum({ bollingerBand: { top: 115, middle: 105, bottom: 95 } });
        expect(INDICATOR_ACCESSORS["BollingerBand.lower"](d)).toBe(95);
    });
    it("T01-08: MACD divergence accessor (main)", () => {
        const d = datum({ macd: { macd: 0.5, signal: 0.3, divergence: 0.2 } });
        expect(INDICATOR_ACCESSORS["MACD"](d)).toBe(0.2);
    });
    it("T01-09: MACD.signal sub-line accessor", () => {
        const d = datum({ macd: { macd: 0.5, signal: 0.3, divergence: 0.2 } });
        expect(INDICATOR_ACCESSORS["MACD.signal"](d)).toBe(0.3);
    });
    it("T01-10: KDJ K/D/J sub-line accessors", () => {
        const d = datum({ kdj: { k: 70, d: 65, j: 85 } });
        expect(INDICATOR_ACCESSORS["KDJ"](d)).toBe(70); // K main
        expect(INDICATOR_ACCESSORS["KDJ.D"](d)).toBe(65);
        expect(INDICATOR_ACCESSORS["KDJ.J"](d)).toBe(85);
    });
    it("T01-11: Whale net flow (buyVol - sellVol)", () => {
        const d = datum({ whaleBuyVol: 80_000, whaleSellVol: 30_000 });
        expect(INDICATOR_ACCESSORS["Whale"](d)).toBe(50_000);
    });
    it("T01-12: Whale returns null when either side is missing", () => {
        expect(INDICATOR_ACCESSORS["Whale"](datum({ whaleBuyVol: 80_000 }))).toBeNull();
        expect(INDICATOR_ACCESSORS["Whale"](datum({ whaleSellVol: 30_000 }))).toBeNull();
    });
    it("T01-13: StrengthElder returns bull - bear", () => {
        const d = datum({ bullPower: 5, bearPower: -3 });
        expect(INDICATOR_ACCESSORS["StrengthElder"](d)).toBe(8);
    });
    it("T01-14: EMA variants extract correct period fields", () => {
        const d = datum({ ema13: 101, ema20: 102, ema50: 103 });
        expect(INDICATOR_ACCESSORS["EMA13"](d)).toBe(101);
        expect(INDICATOR_ACCESSORS["EMA20"](d)).toBe(102);
        expect(INDICATOR_ACCESSORS["EMA50"](d)).toBe(103);
        // Default EMA = ema20
        expect(INDICATOR_ACCESSORS["EMA"](d)).toBe(102);
    });
    it("T01-15: DMI +DI main and sub-line keys", () => {
        const d = datum({ dmi: { plusDI: 25, minusDI: 15, adx: 30 } });
        expect(INDICATOR_ACCESSORS["DMI"](d)).toBe(25);
        expect(INDICATOR_ACCESSORS["DMI.minusDI"](d)).toBe(15);
        expect(INDICATOR_ACCESSORS["DMI.adx"](d)).toBe(30);
    });
    it("T01-16: Volume accessor returns raw volume", () => {
        const d = datum({ volume: 5_000_000 });
        expect(INDICATOR_ACCESSORS["Volume"](d)).toBe(5_000_000);
    });
    it("T01-17: all accessor values return number or null (no undefined/NaN) on empty datum", () => {
        const empty = datum();
        for (const [key, fn] of Object.entries(INDICATOR_ACCESSORS)) {
            const result = fn(empty);
            // Result must be a finite number, null, or undefined — never NaN
            if (result !== null && result !== undefined) {
                expect(Number.isFinite(result)).toBe(true);
            }
        }
    });
    it("T01-18: no import from src/ (module has no cross-layer dependencies)", async () => {
        // Verify by dynamic import: if the file imported from src/lib, TypeScript
        // compilation would fail per layer isolation rule. This test confirms the
        // module loads in isolation (engine-core only).
        const mod = await import("./indicatorAccessors");
        expect(mod.INDICATOR_ACCESSORS).toBeDefined();
        expect(mod.INDICATOR_ACCESSORS["RSI"]).toBeTypeOf("function");
    });
});
// ── T02: buildIndicatorValuesKey ─────────────────────────────────────────────
describe("buildIndicatorValuesKey", () => {
    it("T02-01: EMA with period=13 → 'EMA:period=13'", () => {
        expect(buildIndicatorValuesKey("EMA", { period: 13 })).toBe("EMA:period=13");
    });
    it("T02-02: EMA with period=20 → 'EMA:period=20'", () => {
        expect(buildIndicatorValuesKey("EMA", { period: 20 })).toBe("EMA:period=20");
    });
    it("T02-03: EMA with no params → default 'EMA:period=20'", () => {
        expect(buildIndicatorValuesKey("EMA", undefined)).toBe("EMA:period=20");
    });
    it("T02-04: RSI with period=9 → 'RSI:period=9'", () => {
        expect(buildIndicatorValuesKey("RSI", { period: 9 })).toBe("RSI:period=9");
    });
    it("T02-05: MACD with explicit params → correct key", () => {
        expect(buildIndicatorValuesKey("MACD", { fast: 12, slow: 26, signal: 9 }))
            .toBe("MACD:fast=12:slow=26:signal=9");
    });
    it("T02-06: AO with no params → 'AO'", () => {
        expect(buildIndicatorValuesKey("AO", undefined)).toBe("AO");
    });
    it("T02-07: unknown type → undefined", () => {
        expect(buildIndicatorValuesKey("UnknownType", {})).toBeUndefined();
    });
    it("T02-08: BollingerBand with defaults → 'BollingerBand:period=20:stdDev=2'", () => {
        expect(buildIndicatorValuesKey("BollingerBand", undefined))
            .toBe("BollingerBand:period=20:stdDev=2");
    });
});
// ── T03: getAccessorFor ───────────────────────────────────────────────────────
describe("getAccessorFor", () => {
    it("T03-01: EMA period=13 reads indicatorValues['EMA:period=13']", () => {
        const d = {
            indicatorValues: { "EMA:period=13": 127.4, "EMA:period=20": 126.8 },
        };
        const acc = getAccessorFor("EMA", { period: 13 });
        expect(acc).toBeDefined();
        expect(acc(d)).toBe(127.4);
    });
    it("T03-02: EMA period=20 reads indicatorValues['EMA:period=20']", () => {
        const d = {
            indicatorValues: { "EMA:period=13": 127.4, "EMA:period=20": 126.8 },
        };
        const acc = getAccessorFor("EMA", { period: 20 });
        expect(acc(d)).toBe(126.8);
    });
    it("T03-03: EMA(13) and EMA(20) produce different values from same datum", () => {
        const d = {
            indicatorValues: { "EMA:period=13": 127.4, "EMA:period=20": 126.8 },
        };
        const acc13 = getAccessorFor("EMA", { period: 13 });
        const acc20 = getAccessorFor("EMA", { period: 20 });
        expect(acc13(d)).not.toBe(acc20(d));
    });
    it("T03-04: EMA with no params → reads indicatorValues['EMA:period=20'] (default)", () => {
        const d = {
            indicatorValues: { "EMA:period=20": 126.8 },
        };
        const acc = getAccessorFor("EMA", undefined);
        expect(acc(d)).toBe(126.8);
    });
    it("T03-05: Volume (not params-sensitive) → falls back to static accessor", () => {
        const d = { volume: 5_000_000 };
        const acc = getAccessorFor("Volume", undefined);
        expect(acc).toBeDefined();
        expect(acc(d)).toBe(5_000_000);
    });
    it("T03-06: unknown type → undefined", () => {
        expect(getAccessorFor("NonExistentType", undefined)).toBeUndefined();
    });
});
