/**
 * indicatorAccessors.ts
 *
 * Accessor map: series.type → function that extracts a scalar number
 * from a type-erased enriched datum (Record<string, unknown>).
 *
 * Design constraints:
 *  - NO imports from src/lib/**, src/widget/**, src/demo/**
 *  - Type-erased: EnrichedDatumLike = Record<string, unknown>
 *    avoids cross-layer coupling between engine-core and EnrichedDatum
 *  - Sub-line keys (e.g. "BollingerBand.upper") are flat entries for
 *    expandSeriesIntoSubLines to resolve independently
 */
/** Helper: extract finite number or null */
function num(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}
/** Helper: safely get nested value */
function get(v, key) {
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
        return v[key];
    }
    return undefined;
}
/**
 * INDICATOR_ACCESSORS
 *
 * Flat map of 35 series types + sub-line keys → accessor.
 * CandleStick/OHLC is intentionally absent — handled by CandlestickRenderer directly.
 */
export const INDICATOR_ACCESSORS = {
    // ── Trend ─────────────────────────────────────────────────────────────────
    /** Exponential Moving Average (default period=20) */
    EMA: (d) => num(d["ema20"]),
    /** EMA period 13 */
    EMA13: (d) => num(d["ema13"]),
    /** EMA period 20 */
    EMA20: (d) => num(d["ema20"]),
    /** EMA period 50 */
    EMA50: (d) => num(d["ema50"]),
    /** Simple Moving Average — from indicatorValues map */
    MA: (d) => num(get(d["indicatorValues"], "MA")),
    /** Bull and Bear Index (BBI) */
    BBI: (d) => num(d["bbi"]),
    /** Stop-and-Reverse (SAR/Parabolic SAR) */
    SAR: (d) => num(d["sar"]),
    // ── Momentum ──────────────────────────────────────────────────────────────
    /** Relative Strength Index */
    RSI: (d) => num(d["rsi"]),
    /** MACD — main: divergence/histogram bars */
    MACD: (d) => num(get(d["macd"], "divergence")),
    /** KDJ — main: K line */
    KDJ: (d) => num(get(d["kdj"], "k")),
    /** Commodity Channel Index */
    CCI: (d) => num(d["cci"]),
    /** Williams %R */
    WR: (d) => num(d["wr"]),
    /** Bias Ratio */
    BIAS: (d) => num(d["bias"]),
    /** Momentum (MTM main value) */
    MTM: (d) => num(get(d["mtm"], "mtm")),
    /** Rate of Change */
    ROC: (d) => num(d["roc"]),
    /** Awesome Oscillator */
    AO: (d) => num(d["ao"]),
    // ── Volatility / Band ─────────────────────────────────────────────────────
    /** Bollinger Band — main: middle line */
    BollingerBand: (d) => num(get(d["bollingerBand"], "middle")),
    // ── Volume / Order Flow ───────────────────────────────────────────────────
    /** Raw volume bar */
    Volume: (d) => num(d["volume"]),
    /** On-Balance Volume */
    OBV: (d) => num(d["obv"]),
    /** Volume Ratio */
    VR: (d) => num(d["vr"]),
    /** Cumulative Volume Delta (approximate) */
    CVDApprox: (d) => {
        const delta = num(d["cvdDelta"]);
        return delta ?? num(d["cvdApprox"]);
    },
    /** Cumulative Volume Delta (realtime, optional extended field) */
    CVDRealtime: (d) => {
        const rt = d["cvdRealtime"];
        return num(get(rt, "value")) ?? num(rt);
    },
    /** Whale net flow (buyVol − sellVol) */
    Whale: (d) => {
        const b = num(d["whaleBuyVol"]);
        const s = num(d["whaleSellVol"]);
        return b != null && s != null ? b - s : null;
    },
    /** Elder's Force Index / Strength (bull - bear) */
    StrengthElder: (d) => {
        const bull = num(d["bullPower"]);
        const bear = num(d["bearPower"]);
        return bull != null && bear != null ? bull - bear : null;
    },
    /** Relative strength from indicatorValues map */
    StrengthRelative: (d) => num(get(d["indicatorValues"], "StrengthRelative")),
    // ── DMI ───────────────────────────────────────────────────────────────────
    /** Directional Movement Index — main: +DI line */
    DMI: (d) => num(get(d["dmi"], "plusDI")),
    // ── Multi-output indicators (main field only) ─────────────────────────────
    // Sub-lines are resolved via the "Type.subLine" keys below
    /** Bull/Bear Ratio — AR line (main) */
    BRAR: (d) => num(get(d["brar"], "ar")),
    /** Ease of Movement — EMV main value */
    EMV: (d) => num(get(d["emv"], "emv")),
    /** Triple Exponential Average — TRIX main value */
    TRIX: (d) => num(get(d["trix"], "trix")),
    /** Parallel MA Difference — DDD field */
    DMA: (d) => num(get(d["dma"], "ddd")),
    /** Price-Volume Trend */
    PVT: (d) => num(d["pvt"]),
    /** Psychological Line */
    PSY: (d) => num(get(d["psy"], "psy")),
    /** CR Indicator */
    CR: (d) => num(get(d["cr"], "cr")),
    // ── Sub-line keys (used by expandSeriesIntoSubLines) ─────────────────────
    /** Bollinger Band upper band */
    "BollingerBand.upper": (d) => num(get(d["bollingerBand"], "top")),
    /** Bollinger Band lower band */
    "BollingerBand.lower": (d) => num(get(d["bollingerBand"], "bottom")),
    /** MACD signal line */
    "MACD.signal": (d) => num(get(d["macd"], "signal")),
    /** MACD line (slow EMA minus fast EMA) */
    "MACD.macd": (d) => num(get(d["macd"], "macd")),
    /** KDJ D line */
    "KDJ.D": (d) => num(get(d["kdj"], "d")),
    /** KDJ J line */
    "KDJ.J": (d) => num(get(d["kdj"], "j")),
    /** DMI −DI line */
    "DMI.minusDI": (d) => num(get(d["dmi"], "minusDI")),
    /** DMI ADX line */
    "DMI.adx": (d) => num(get(d["dmi"], "adx")),
    /** BRAR BR line */
    "BRAR.br": (d) => num(get(d["brar"], "br")),
    /** MTM signal line */
    "MTM.signal": (d) => num(get(d["mtm"], "signal")),
    /** EMV signal line */
    "EMV.signal": (d) => num(get(d["emv"], "signal")),
    /** TRIX signal line */
    "TRIX.signal": (d) => num(get(d["trix"], "signal")),
    /** PSY PSYMA / signal */
    "PSY.signal": (d) => num(get(d["psy"], "psyma")),
};
// ── Params-keyed accessor builder (KF-10) ─────────────────────────────────────
/**
 * Helper: extract a numeric param with a fallback.
 * Accepts the params object (or undefined) and a key.
 */
function numParam(params, key, fallback) {
    const v = params?.[key];
    return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}
/**
 * Build the canonical `indicatorValues` lookup key for (type, params).
 *
 * Format must match `seriesValueResolver.buildIndicatorSeriesKey` in src/lib/core/
 * (engine-core re-implements to avoid cross-layer import).
 *
 * Returns `undefined` for types that are not params-sensitive (caller falls
 * back to INDICATOR_ACCESSORS[type]).
 */
export function buildIndicatorValuesKey(type, params) {
    switch (type) {
        // ── Single-period indicators ──────────────────────────────────────────
        case "EMA": return `EMA:period=${numParam(params, "period", 20)}`;
        case "MA": return `MA:period=${numParam(params, "period", 20)}`;
        case "RSI": return `RSI:period=${numParam(params, "period", 14)}`;
        case "CCI": return `CCI:period=${numParam(params, "period", 20)}`;
        case "WR": return `WR:period=${numParam(params, "period", 14)}`;
        case "BIAS": return `BIAS:period=${numParam(params, "period", 6)}`;
        case "VR": return `VR:period=${numParam(params, "period", 26)}`;
        case "BRAR": return `BRAR:period=${numParam(params, "period", 26)}`;
        case "EMV": return `EMV:period=${numParam(params, "period", 14)}`;
        case "ROC": return `ROC:period=${numParam(params, "period", 12)}`;
        case "DMI": return `DMI:period=${numParam(params, "period", 14)}`;
        // ── Multi-param indicators ────────────────────────────────────────────
        case "BollingerBand": {
            const p = numParam(params, "period", 20);
            const sd = numParam(params, "stdDev", 2);
            return `BollingerBand:period=${p}:stdDev=${sd}`;
        }
        case "MACD": {
            const f = numParam(params, "fast", 12);
            const sl = numParam(params, "slow", 26);
            const sg = numParam(params, "signal", 9);
            return `MACD:fast=${f}:slow=${sl}:signal=${sg}`;
        }
        case "KDJ": {
            const p = numParam(params, "period", 9);
            const m1 = numParam(params, "m1", 3);
            const m2 = numParam(params, "m2", 3);
            return `KDJ:period=${p}:m1=${m1}:m2=${m2}`;
        }
        case "MTM": {
            const p = numParam(params, "period", 6);
            const sp = numParam(params, "signalPeriod", 6);
            return `MTM:period=${p}:signalPeriod=${sp}`;
        }
        case "TRIX": {
            const p = numParam(params, "period", 12);
            const sp = numParam(params, "signalPeriod", 9);
            return `TRIX:period=${p}:signalPeriod=${sp}`;
        }
        case "DMA": {
            const fp = numParam(params, "fastPeriod", 10);
            const sl = numParam(params, "slowPeriod", 50);
            const sp = numParam(params, "signalPeriod", 10);
            return `DMA:fastPeriod=${fp}:slowPeriod=${sl}:signalPeriod=${sp}`;
        }
        case "SAR": {
            const af = numParam(params, "afStep", 0.02);
            const max = numParam(params, "afMax", 0.2);
            return `SAR:afStep=${af}:afMax=${max}`;
        }
        case "Whale": {
            const t = numParam(params, "threshold", 50000);
            return `Whale:threshold=${t}`;
        }
        // ── No-param indicator ────────────────────────────────────────────────
        case "AO": return "AO";
        case "BBI": return "BBI";
        case "OBV": return "OBV";
        case "CVDApprox": return "CVDApprox";
        case "CVDRealtime": return "CVDRealtime";
        case "StrengthElder": return "StrengthElder";
        default: return undefined;
    }
}
/**
 * Get a SeriesValueAccessor for (type, params).
 *
 * - When params provided and type is params-sensitive: returns an accessor that
 *   reads `datum.indicatorValues[buildIndicatorValuesKey(type, params)]`.
 * - Otherwise: returns `INDICATOR_ACCESSORS[type]` (static fallback).
 * - Returns `undefined` for completely unknown types.
 */
export function getAccessorFor(type, params) {
    let baseType = type;
    let subField = undefined;
    const dotIndex = type.indexOf(".");
    if (dotIndex > 0) {
        baseType = type.substring(0, dotIndex);
        subField = type.substring(dotIndex + 1);
    }
    const key = buildIndicatorValuesKey(baseType, params);
    if (key !== undefined) {
        return (d) => {
            const obj = get(d["indicatorValues"], key);
            if (obj == null) {
                return undefined;
            }
            if (typeof obj === "number") {
                return num(obj);
            }
            // Sub-line extraction
            if (subField !== undefined) {
                if (baseType === "MACD" && subField === "macd")
                    return num(get(obj, "macd"));
                if (baseType === "MACD" && subField === "signal")
                    return num(get(obj, "signal"));
                if (baseType === "BollingerBand" && subField === "upper")
                    return num(get(obj, "top"));
                if (baseType === "BollingerBand" && subField === "lower")
                    return num(get(obj, "bottom"));
                if (baseType === "KDJ" && subField === "D")
                    return num(get(obj, "d"));
                if (baseType === "KDJ" && subField === "J")
                    return num(get(obj, "j"));
                if (baseType === "DMI" && subField === "minusDI")
                    return num(get(obj, "minusDI"));
                if (baseType === "DMI" && subField === "adx")
                    return num(get(obj, "adx"));
                if (baseType === "BRAR" && subField === "br")
                    return num(get(obj, "br"));
                if (baseType === "MTM" && subField === "signal")
                    return num(get(obj, "signal"));
                if (baseType === "EMV" && subField === "signal")
                    return num(get(obj, "signal"));
                if (baseType === "TRIX" && subField === "signal")
                    return num(get(obj, "signal"));
                if (baseType === "PSY" && subField === "signal")
                    return num(get(obj, "psyma") ?? get(obj, "signal"));
                return num(get(obj, subField));
            }
            // Main line of multi-output indicators
            if (baseType === "BollingerBand")
                return num(get(obj, "middle"));
            if (baseType === "MACD")
                return num(get(obj, "divergence"));
            if (baseType === "KDJ")
                return num(get(obj, "k"));
            if (baseType === "DMI")
                return num(get(obj, "plusDI"));
            if (baseType === "BRAR")
                return num(get(obj, "ar"));
            if (baseType === "MTM")
                return num(get(obj, "mtm"));
            if (baseType === "EMV")
                return num(get(obj, "emv"));
            if (baseType === "TRIX")
                return num(get(obj, "trix"));
            if (baseType === "DMA")
                return num(get(obj, "ddd"));
            if (baseType === "PSY")
                return num(get(obj, "psy"));
            if (baseType === "CR")
                return num(get(obj, "cr"));
            if (baseType === "Whale") {
                const b = num(get(obj, "whaleBuyVol"));
                const s = num(get(obj, "whaleSellVol"));
                return b != null && s != null ? b - s : null;
            }
            if (baseType === "StrengthElder") {
                const bull = num(get(obj, "bullPower"));
                const bear = num(get(obj, "bearPower"));
                return bull != null && bear != null ? bull - bear : null;
            }
            return undefined;
        };
    }
    return INDICATOR_ACCESSORS[type];
}
