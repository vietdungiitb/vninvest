import { aoSeries, biasSeries, bbiSeries, bollingerSeries, brarSeries, cciSeries, crSeries, dmaSeries, dmiSeries, emaSeries, emvSeries, kdjSeries, macdSeries, mtmSeries, obvSeries, pvtSeries, psySeries, rsiSeries, rocSeries, sarSeries, smaSeries, trixSeries, vrSeries, wrSeries, } from "../../indicators/utils.js";
import { buildIndicatorSeriesKey } from "../seriesValueResolver.js";
import { calcCVDApprox } from "./calcCVDApprox.js";
import { calcStrengthElder } from "./calcStrengthElder.js";
import { calcWhaleApprox } from "./calcWhaleApprox.js";
function blankUntil(values, startIndex) {
    return values.map((value, index) => (index >= startIndex ? value : undefined));
}
function mergeBand(upper, middle, lower, startIndex) {
    return upper.map((top, index) => {
        if (index < startIndex) {
            return undefined;
        }
        return {
            top,
            middle: middle[index] ?? middle[middle.length - 1] ?? top,
            bottom: lower[index] ?? lower[lower.length - 1] ?? top,
        };
    });
}
function numberParam(series, key, fallback) {
    const value = series.params?.[key];
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function indicatorKey(series) {
    return buildIndicatorSeriesKey(series);
}
function defaultSeries(type, params = {}) {
    return { type, yAxis: "right", params };
}
export function buildIndicatorComputationPlan(series, whaleThreshold) {
    const emaPeriods = new Set([13, 20, 50]);
    const smaPeriods = new Set();
    const rsiPeriods = new Set([14]);
    const macdConfigs = new Map();
    const bollingerConfigs = new Map();
    const whaleThresholds = new Set([whaleThreshold]);
    const sarByKey = new Map();
    const wrPeriods = new Set();
    const vrPeriods = new Set();
    const kdjConfigs = new Map();
    const cciPeriods = new Set();
    const dmiPeriods = new Set();
    const biasPeriods = new Set();
    const brarPeriods = new Set();
    const mtmConfigs = new Map();
    const emvPeriods = new Set();
    const rocPeriods = new Set();
    const trixConfigs = new Map();
    const dmaConfigs = new Map();
    const psyConfigs = new Map();
    const crConfigs = new Map();
    let bbiEnabled = false;
    let obvEnabled = false;
    let aoEnabled = false;
    let pvtEnabled = false;
    const defaultMacdSeries = defaultSeries("MACD", { fast: 12, slow: 26, signal: 9 });
    const defaultBollingerSeries = defaultSeries("BollingerBand", { period: 20, stdDev: 2 });
    const defaultWhaleSeries = defaultSeries("Whale", { threshold: whaleThreshold });
    const defaultMacdKey = indicatorKey(defaultMacdSeries);
    const defaultBollingerKey = indicatorKey(defaultBollingerSeries);
    const defaultWhaleKey = indicatorKey(defaultWhaleSeries);
    macdConfigs.set(defaultMacdKey, { fast: 12, slow: 26, signal: 9 });
    bollingerConfigs.set(defaultBollingerKey, { period: 20, stdDev: 2 });
    for (const nextSeries of series) {
        switch (nextSeries.type) {
            case "EMA":
                emaPeriods.add(numberParam(nextSeries, "period", 20));
                break;
            case "MA":
                smaPeriods.add(numberParam(nextSeries, "period", 20));
                break;
            case "RSI":
                rsiPeriods.add(numberParam(nextSeries, "period", 14));
                break;
            case "MACD": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    macdConfigs.set(key, {
                        fast: numberParam(nextSeries, "fast", 12),
                        slow: numberParam(nextSeries, "slow", 26),
                        signal: numberParam(nextSeries, "signal", 9),
                    });
                }
                break;
            }
            case "BollingerBand": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    bollingerConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 20),
                        stdDev: numberParam(nextSeries, "stdDev", 2),
                    });
                }
                break;
            }
            case "Whale":
                whaleThresholds.add(numberParam(nextSeries, "threshold", whaleThreshold));
                break;
            case "BBI":
                bbiEnabled = true;
                break;
            case "SAR": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    sarByKey.set(key, {
                        afStep: numberParam(nextSeries, "afStep", 0.02),
                        afMax: numberParam(nextSeries, "afMax", 0.2),
                    });
                }
                break;
            }
            case "OBV":
                obvEnabled = true;
                break;
            case "WR":
                wrPeriods.add(numberParam(nextSeries, "period", 14));
                break;
            case "VR":
                vrPeriods.add(numberParam(nextSeries, "period", 26));
                break;
            case "KDJ": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    kdjConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 9),
                        m1: numberParam(nextSeries, "m1", 3),
                        m2: numberParam(nextSeries, "m2", 3),
                    });
                }
                break;
            }
            case "CCI":
                cciPeriods.add(numberParam(nextSeries, "period", 20));
                break;
            case "DMI":
                dmiPeriods.add(numberParam(nextSeries, "period", 14));
                break;
            case "BIAS":
                biasPeriods.add(numberParam(nextSeries, "period", 6));
                break;
            case "BRAR":
                brarPeriods.add(numberParam(nextSeries, "period", 26));
                break;
            case "MTM": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    mtmConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 6),
                        signalPeriod: numberParam(nextSeries, "signalPeriod", 6),
                    });
                }
                break;
            }
            case "EMV":
                emvPeriods.add(numberParam(nextSeries, "period", 14));
                break;
            case "AO":
                aoEnabled = true;
                break;
            case "ROC":
                rocPeriods.add(numberParam(nextSeries, "period", 12));
                break;
            case "TRIX": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    trixConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 12),
                        signalPeriod: numberParam(nextSeries, "signalPeriod", 9),
                    });
                }
                break;
            }
            case "DMA": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    dmaConfigs.set(key, {
                        fastPeriod: numberParam(nextSeries, "fastPeriod", 10),
                        slowPeriod: numberParam(nextSeries, "slowPeriod", 50),
                        signalPeriod: numberParam(nextSeries, "signalPeriod", 10),
                    });
                }
                break;
            }
            case "PVT":
                pvtEnabled = true;
                break;
            case "PSY": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    psyConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 12),
                        signalPeriod: numberParam(nextSeries, "signalPeriod", 6),
                    });
                }
                break;
            }
            case "CR": {
                const key = indicatorKey(nextSeries);
                if (key) {
                    crConfigs.set(key, {
                        period: numberParam(nextSeries, "period", 26),
                        m1: numberParam(nextSeries, "m1", 10),
                        m2: numberParam(nextSeries, "m2", 20),
                        m3: numberParam(nextSeries, "m3", 40),
                        m4: numberParam(nextSeries, "m4", 60),
                    });
                }
                break;
            }
            default:
                break;
        }
    }
    return {
        emaPeriods,
        smaPeriods,
        rsiPeriods,
        macdConfigs,
        bollingerConfigs,
        whaleThresholds,
        bbiEnabled,
        sarByKey,
        obvEnabled,
        wrPeriods,
        vrPeriods,
        kdjConfigs,
        cciPeriods,
        dmiPeriods,
        biasPeriods,
        brarPeriods,
        mtmConfigs,
        emvPeriods,
        aoEnabled,
        rocPeriods,
        trixConfigs,
        dmaConfigs,
        pvtEnabled,
        psyConfigs,
        crConfigs,
        defaultMacdKey,
        defaultBollingerKey,
        defaultWhaleKey,
    };
}
export function computeIndicatorComputationResult(raw, plan) {
    const closes = raw.map((bar) => bar.close);
    const emaByPeriod = new Map();
    for (const period of plan.emaPeriods) {
        emaByPeriod.set(period, blankUntil(emaSeries(closes, period), Math.max(period - 1, 0)));
    }
    const smaByPeriod = new Map();
    for (const period of plan.smaPeriods) {
        smaByPeriod.set(period, blankUntil(smaSeries(closes, period), Math.max(period - 1, 0)));
    }
    const rsiByPeriod = new Map();
    for (const period of plan.rsiPeriods) {
        rsiByPeriod.set(period, blankUntil(rsiSeries(closes, period), Math.max(period, 1)));
    }
    const macdByKey = new Map();
    for (const [key, config] of plan.macdConfigs) {
        const macd = macdSeries(closes, config.fast, config.slow, config.signal);
        const macdLine = blankUntil(macd.macd, Math.max(config.slow - 1, 0));
        const signalLine = blankUntil(macd.signal, Math.max(config.slow - 1, 0));
        const histogramLine = blankUntil(macd.histogram, Math.max(config.slow - 1, 0));
        macdByKey.set(key, raw.map((_, index) => {
            const macdValue = macdLine[index];
            const signalValue = signalLine[index];
            const histogramValue = histogramLine[index];
            if (macdValue === undefined || signalValue === undefined || histogramValue === undefined) {
                return undefined;
            }
            return {
                macd: macdValue,
                signal: signalValue,
                divergence: histogramValue,
            };
        }));
    }
    const bollingerByKey = new Map();
    for (const [key, config] of plan.bollingerConfigs) {
        const series = bollingerSeries(closes, config.period, config.stdDev);
        bollingerByKey.set(key, mergeBand(series.upper, series.middle, series.lower, Math.max(config.period - 1, 0)));
    }
    const cvd = calcCVDApprox(raw);
    const strength = calcStrengthElder(raw);
    // CE15 indicators
    const bbi = plan.bbiEnabled
        ? bbiSeries(raw)
        : new Array(raw.length).fill(undefined);
    const sarByKey = new Map();
    for (const [key, config] of plan.sarByKey) {
        sarByKey.set(key, blankUntil(sarSeries(raw, config.afStep, config.afMax), 1));
    }
    const obv = plan.obvEnabled
        ? obvSeries(raw)
        : new Array(raw.length).fill(undefined);
    const wrByPeriod = new Map();
    for (const period of plan.wrPeriods) {
        wrByPeriod.set(period, blankUntil(wrSeries(raw, period), Math.max(period - 1, 0)));
    }
    const vrByPeriod = new Map();
    for (const period of plan.vrPeriods) {
        vrByPeriod.set(period, blankUntil(vrSeries(raw, period), Math.max(period, 1)));
    }
    const kdjByKey = new Map();
    for (const [key, config] of plan.kdjConfigs) {
        const series = kdjSeries(raw, config.period, config.m1, config.m2);
        kdjByKey.set(key, raw.map((_, index) => {
            const k = series.k[index];
            const d = series.d[index];
            const j = series.j[index];
            if (!Number.isFinite(k) || !Number.isFinite(d) || !Number.isFinite(j)) {
                return undefined;
            }
            return { k, d, j };
        }));
    }
    const cciByPeriod = new Map();
    for (const period of plan.cciPeriods) {
        cciByPeriod.set(period, blankUntil(cciSeries(raw, period), Math.max(period - 1, 0)));
    }
    const dmiByPeriod = new Map();
    for (const period of plan.dmiPeriods) {
        const series = dmiSeries(raw, period);
        dmiByPeriod.set(period, raw.map((_, index) => {
            const plusDI = series.plusDI[index];
            const minusDI = series.minusDI[index];
            const adx = series.adx[index];
            if (!Number.isFinite(plusDI) || !Number.isFinite(minusDI) || !Number.isFinite(adx)) {
                return undefined;
            }
            return { plusDI, minusDI, adx };
        }));
    }
    const biasByPeriod = new Map();
    for (const period of plan.biasPeriods) {
        biasByPeriod.set(period, blankUntil(biasSeries(raw, period), Math.max(period - 1, 0)));
    }
    const brarByPeriod = new Map();
    for (const period of plan.brarPeriods) {
        const series = brarSeries(raw, period);
        brarByPeriod.set(period, raw.map((_, index) => {
            const ar = series.ar[index];
            const br = series.br[index];
            if (!Number.isFinite(ar) || !Number.isFinite(br)) {
                return undefined;
            }
            return { ar, br };
        }));
    }
    const mtmByKey = new Map();
    for (const [key, config] of plan.mtmConfigs) {
        const series = mtmSeries(raw, config.period, config.signalPeriod);
        mtmByKey.set(key, raw.map((_, index) => {
            const mtm = series.mtm[index];
            const signal = series.signal[index];
            if (!Number.isFinite(mtm) || !Number.isFinite(signal)) {
                return undefined;
            }
            return { mtm, signal };
        }));
    }
    const emvByPeriod = new Map();
    for (const period of plan.emvPeriods) {
        const series = emvSeries(raw, period);
        emvByPeriod.set(period, raw.map((_, index) => {
            const emv = series.emv[index];
            const signal = series.signal[index];
            if (!Number.isFinite(emv) || !Number.isFinite(signal)) {
                return undefined;
            }
            return { emv, signal };
        }));
    }
    const ao = plan.aoEnabled
        ? blankUntil(aoSeries(raw), 33)
        : new Array(raw.length).fill(undefined);
    const rocByPeriod = new Map();
    for (const period of plan.rocPeriods) {
        rocByPeriod.set(period, blankUntil(rocSeries(raw, period), Math.max(period, 0)));
    }
    const trixByKey = new Map();
    for (const [key, config] of plan.trixConfigs) {
        const series = trixSeries(raw, config.period, config.signalPeriod);
        const warmup = Math.max(config.period * 3 - 3, config.signalPeriod - 1, 0);
        const trixValues = blankUntil(series.trix, warmup);
        const signalValues = blankUntil(series.signal, warmup);
        trixByKey.set(key, raw.map((_, index) => {
            const trix = trixValues[index];
            const signal = signalValues[index];
            if (!Number.isFinite(trix ?? NaN) || !Number.isFinite(signal ?? NaN)) {
                return undefined;
            }
            return { trix: trix, signal: signal };
        }));
    }
    const dmaByKey = new Map();
    for (const [key, config] of plan.dmaConfigs) {
        const series = dmaSeries(raw, config.fastPeriod, config.slowPeriod, config.signalPeriod);
        const warmup = Math.max(config.slowPeriod - 1, 0);
        const dddValues = blankUntil(series.ddd, warmup);
        const amaValues = blankUntil(series.ama, warmup);
        dmaByKey.set(key, raw.map((_, index) => {
            const ddd = dddValues[index];
            const ama = amaValues[index];
            if (!Number.isFinite(ddd ?? NaN) || !Number.isFinite(ama ?? NaN)) {
                return undefined;
            }
            return { ddd: ddd, ama: ama };
        }));
    }
    const pvt = plan.pvtEnabled
        ? pvtSeries(raw)
        : new Array(raw.length).fill(undefined);
    const psyByKey = new Map();
    for (const [key, config] of plan.psyConfigs) {
        const series = psySeries(raw, config.period, config.signalPeriod);
        psyByKey.set(key, raw.map((_, index) => {
            const psy = series.psy[index];
            const signal = series.signal[index];
            if (!Number.isFinite(psy) || !Number.isFinite(signal)) {
                return undefined;
            }
            return { psy, signal };
        }));
    }
    const crByKey = new Map();
    for (const [key, config] of plan.crConfigs) {
        const series = crSeries(raw, config.period, config.m1, config.m2, config.m3, config.m4);
        crByKey.set(key, raw.map((_, index) => {
            const cr = series.cr[index];
            const ma1 = series.ma1[index];
            const ma2 = series.ma2[index];
            const ma3 = series.ma3[index];
            const ma4 = series.ma4[index];
            if (!Number.isFinite(cr) || !Number.isFinite(ma1) || !Number.isFinite(ma2) || !Number.isFinite(ma3) || !Number.isFinite(ma4)) {
                return undefined;
            }
            return { cr, ma1, ma2, ma3, ma4 };
        }));
    }
    const whaleByKey = new Map();
    for (const threshold of plan.whaleThresholds) {
        const key = indicatorKey(defaultSeries("Whale", { threshold }));
        if (!key) {
            continue;
        }
        whaleByKey.set(key, calcWhaleApprox(raw, threshold).map((point) => (point.whaleBuyVol === undefined && point.whaleSellVol === undefined
            ? undefined
            : { whaleBuyVol: point.whaleBuyVol, whaleSellVol: point.whaleSellVol })));
    }
    return {
        emaByPeriod,
        smaByPeriod,
        rsiByPeriod,
        macdByKey,
        bollingerByKey,
        whaleByKey,
        bbi,
        sarByKey,
        obv,
        wrByPeriod,
        vrByPeriod,
        kdjByKey,
        cciByPeriod,
        dmiByPeriod,
        biasByPeriod,
        brarByPeriod,
        mtmByKey,
        emvByPeriod,
        ao,
        rocByPeriod,
        trixByKey,
        dmaByKey,
        pvt,
        psyByKey,
        crByKey,
        cvd,
        strength,
    };
}
export function materializeIndicatorValues(index, plan, result) {
    const indicatorValues = {};
    for (const [period, values] of result.emaByPeriod) {
        const key = indicatorKey(defaultSeries("EMA", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.smaByPeriod) {
        const key = indicatorKey(defaultSeries("MA", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.rsiByPeriod) {
        const key = indicatorKey(defaultSeries("RSI", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.macdByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.bollingerByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.whaleByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    // CE15 — SAR, WR, VR go into indicatorValues map
    for (const [key, values] of result.sarByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.wrByPeriod) {
        const key = indicatorKey(defaultSeries("WR", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.vrByPeriod) {
        const key = indicatorKey(defaultSeries("VR", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.kdjByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.cciByPeriod) {
        const key = indicatorKey(defaultSeries("CCI", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.dmiByPeriod) {
        const key = indicatorKey(defaultSeries("DMI", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.biasByPeriod) {
        const key = indicatorKey(defaultSeries("BIAS", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.brarByPeriod) {
        const key = indicatorKey(defaultSeries("BRAR", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.mtmByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [period, values] of result.emvByPeriod) {
        const key = indicatorKey(defaultSeries("EMV", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    const aoKey = indicatorKey(defaultSeries("AO"));
    if (aoKey && result.ao[index] !== undefined) {
        indicatorValues[aoKey] = result.ao[index];
    }
    for (const [period, values] of result.rocByPeriod) {
        const key = indicatorKey(defaultSeries("ROC", { period }));
        const value = values[index];
        if (key && value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.trixByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.dmaByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    const pvtKey = indicatorKey(defaultSeries("PVT"));
    if (pvtKey && result.pvt[index] !== undefined) {
        indicatorValues[pvtKey] = result.pvt[index];
    }
    for (const [key, values] of result.psyByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    for (const [key, values] of result.crByKey) {
        const value = values[index];
        if (value !== undefined) {
            indicatorValues[key] = value;
        }
    }
    return indicatorValues;
}
