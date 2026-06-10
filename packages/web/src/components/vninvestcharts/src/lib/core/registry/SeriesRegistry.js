import { format } from "d3-format";
import AreaSeries from "../../series/AreaSeries.js";
import BarSeries from "../../series/BarSeries.js";
import BollingerSeries from "../../series/BollingerSeries.js";
import CandlestickSeries from "../../series/CandlestickSeries.js";
import ElderRaySeries from "../../series/ElderRaySeries.js";
import LineSeries from "../../series/LineSeries.js";
import MACDSeries from "../../series/MACDSeries.js";
import OHLCSeries from "../../series/OHLCSeries.js";
import RSISeries from "../../series/RSISeries.js";
import SARSeries from "../../series/SARSeries.js";
import { resolveSeriesValue } from "../seriesValueResolver.js";
const registry = new Map();
const seriesStyleOverrides = new Map();
const seriesStyleListeners = new Map();
const seriesStyleChangeListeners = new Set();
function periodFromConfig(config, fallback) {
    const period = config.params?.period;
    return typeof period === "number" && Number.isFinite(period) ? period : fallback;
}
function colorFromConfig(config, fallback) {
    return typeof config.color === "string" && config.color.length > 0 ? config.color : fallback;
}
function normalizeSeriesStyleOverride(partialStyle) {
    const normalized = {};
    if (typeof partialStyle.color === "string" && partialStyle.color.length > 0) {
        normalized.color = partialStyle.color;
    }
    if (typeof partialStyle.lineWidth === "number" && Number.isFinite(partialStyle.lineWidth)) {
        normalized.lineWidth = partialStyle.lineWidth;
    }
    if (typeof partialStyle.visible === "boolean") {
        normalized.visible = partialStyle.visible;
    }
    if (typeof partialStyle.opacity === "number" && Number.isFinite(partialStyle.opacity)) {
        normalized.opacity = Math.min(1, Math.max(0, partialStyle.opacity));
    }
    if (Array.isArray(partialStyle.dashPattern)) {
        const dashPattern = partialStyle.dashPattern.filter((value) => typeof value === "number" && Number.isFinite(value) && value > 0);
        if (dashPattern.length > 0) {
            normalized.dashPattern = dashPattern;
        }
    }
    return normalized;
}
function cloneSeriesStyleOverride(style) {
    if (!style) {
        return undefined;
    }
    return {
        ...style,
        dashPattern: style.dashPattern ? [...style.dashPattern] : undefined,
    };
}
function notifySeriesStyleChange(instanceId) {
    seriesStyleListeners.get(instanceId)?.forEach((callback) => callback());
    seriesStyleChangeListeners.forEach((callback) => callback());
}
function notifyAllSeriesStyleChanges() {
    for (const [instanceId, listeners] of seriesStyleListeners) {
        listeners.forEach((callback) => callback());
    }
    seriesStyleChangeListeners.forEach((callback) => callback());
}
function dashPatternToStrokeDasharray(dashPattern) {
    if (!dashPattern || dashPattern.length === 0) {
        return "Solid";
    }
    if (dashPattern.length === 1) {
        return dashPattern[0] <= 2 ? "Dot" : "Dash";
    }
    return dashPattern[0] <= 2 ? "Dot" : "Dash";
}
function registerLineSeries(type, options) {
    registerSeries(type, {
        component: options.component,
        defaultParams: options.defaultParams ?? {},
        defaultYAxis: options.defaultYAxis ?? "right",
        tooltipEntry: options.tooltipEntry,
        settingsFields: options.settingsFields,
    });
}
export function clearRegistry() {
    registry.clear();
}
export function clearSeriesStyleOverrides() {
    seriesStyleOverrides.clear();
    notifyAllSeriesStyleChanges();
}
export function listSeriesStyleOverrides() {
    return Object.fromEntries([...seriesStyleOverrides.entries()].map(([instanceId, style]) => [instanceId, cloneSeriesStyleOverride(style) ?? {}]));
}
export function overrideSeriesStyle(instanceId, partialStyle) {
    const normalized = normalizeSeriesStyleOverride(partialStyle);
    const current = seriesStyleOverrides.get(instanceId) ?? {};
    const next = { ...current, ...normalized };
    seriesStyleOverrides.set(instanceId, next);
    notifySeriesStyleChange(instanceId);
}
export function getSeriesStyleOverride(instanceId) {
    return cloneSeriesStyleOverride(seriesStyleOverrides.get(instanceId));
}
export function clearSeriesStyleOverride(instanceId) {
    seriesStyleOverrides.delete(instanceId);
    notifySeriesStyleChange(instanceId);
}
export function subscribeSeriesStyle(instanceId, callback) {
    if (!seriesStyleListeners.has(instanceId)) {
        seriesStyleListeners.set(instanceId, new Set());
    }
    seriesStyleListeners.get(instanceId).add(callback);
    return () => {
        const listeners = seriesStyleListeners.get(instanceId);
        if (!listeners) {
            return;
        }
        listeners.delete(callback);
        if (listeners.size === 0) {
            seriesStyleListeners.delete(instanceId);
        }
    };
}
export function subscribeSeriesStyleChanges(callback) {
    seriesStyleChangeListeners.add(callback);
    return () => {
        seriesStyleChangeListeners.delete(callback);
    };
}
export function registerSeries(type, entry) {
    registry.set(type, entry);
}
export function getSeries(type) {
    const entry = registry.get(type);
    if (!entry) {
        throw new Error(`SeriesRegistry: unknown type "${type}"`);
    }
    return entry;
}
export function listRegistered() {
    return [...registry.keys()];
}
export function registerPhaseOneSeries() {
    clearRegistry();
    registerSeries("Candlestick", {
        component: CandlestickSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: () => ({
            label: "Price",
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerSeries("HollowCandle", {
        component: CandlestickSeries,
        defaultParams: { hollow: true },
        defaultYAxis: "right",
        tooltipEntry: () => ({
            label: "Hollow",
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerSeries("OHLC", {
        component: OHLCSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: () => ({
            label: "OHLC",
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerSeries("HeikinAshi", {
        component: CandlestickSeries,
        defaultParams: { transformed: "heikinashi" },
        defaultYAxis: "right",
        tooltipEntry: () => ({
            label: "HA",
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerLineSeries("Line", {
        component: LineSeries,
        tooltipEntry: (config) => ({
            label: String(config.params?.label ?? "Line"),
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerLineSeries("Area", {
        component: AreaSeries,
        tooltipEntry: (config) => ({
            label: String(config.params?.label ?? "Area"),
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerSeries("Bar", {
        component: BarSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: String(config.params?.label ?? "Bar"),
            format: format(".2f"),
            accessor: (d) => d.close,
        }),
    });
    registerSeries("Volume", {
        component: BarSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: () => ({
            label: "Volume",
            format: format(".3s"),
            accessor: (d) => d.volume,
        }),
    });
    registerLineSeries("EMA", {
        component: LineSeries,
        defaultParams: { period: 20 },
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `EMA(${periodFromConfig(config, 20)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("BollingerBand", {
        component: BollingerSeries,
        defaultParams: { period: 20, stdDev: 2 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 5, step: 1 },
            { key: "stdDev", labelKey: "settings.stdDev", type: "number", defaultValue: 2, min: 0.5, step: 0.5 },
        ],
        tooltipEntry: (config) => ({
            label: `BB(${periodFromConfig(config, 20)},${config.params?.stdDev ?? 2})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("RSI", {
        component: RSISeries,
        defaultParams: { period: 14 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `RSI(${periodFromConfig(config, 14)})`,
            format: format(".1f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("MACD", {
        component: MACDSeries,
        defaultParams: { fast: 12, slow: 26, signal: 9 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "fast", labelKey: "settings.fast", type: "number", defaultValue: 12, min: 1, step: 1 },
            { key: "slow", labelKey: "settings.slow", type: "number", defaultValue: 26, min: 1, step: 1 },
            { key: "signal", labelKey: "settings.signal", type: "number", defaultValue: 9, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: "MACD",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("CVDApprox", {
        component: LineSeries,
        defaultYAxis: "right",
        defaultParams: {},
        tooltipEntry: (config) => ({
            label: "CVD",
            format: format(".0f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("CVDRealtime", {
        component: LineSeries,
        defaultYAxis: "right",
        defaultParams: {},
        tooltipEntry: (config) => ({
            label: "CVD RT",
            format: format(".0f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("StrengthElder", {
        component: ElderRaySeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: "Strength",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("StrengthRelative", {
        component: LineSeries,
        defaultYAxis: "right",
        defaultParams: {},
        tooltipEntry: (config) => ({
            label: "RS",
            format: format(".3f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("Whale", {
        component: BarSeries,
        defaultParams: { threshold: 50_000 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "threshold", labelKey: "settings.thresholdUsd", type: "number", defaultValue: 50_000, min: 1000, step: 1000 },
        ],
        tooltipEntry: (config) => ({
            label: "Whale",
            format: format(".3s"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    // ── CE15 indicators ───────────────────────────────────────────────────────
    registerLineSeries("MA", {
        component: LineSeries,
        defaultParams: { period: 20 },
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `MA(${periodFromConfig(config, 20)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("BBI", {
        component: LineSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: "BBI",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("SAR", {
        component: SARSeries,
        defaultParams: { afStep: 0.02, afMax: 0.2 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "afStep", labelKey: "settings.afStep", type: "number", defaultValue: 0.02, min: 0.001, step: 0.001 },
            { key: "afMax", labelKey: "settings.afMax", type: "number", defaultValue: 0.2, min: 0.01, step: 0.01 },
        ],
        tooltipEntry: (config) => ({
            label: "SAR",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("OBV", {
        component: LineSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: "OBV",
            format: format(".3s"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("WR", {
        component: LineSeries,
        defaultParams: { period: 14 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `WR(${periodFromConfig(config, 14)})`,
            format: format(".1f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("VR", {
        component: LineSeries,
        defaultParams: { period: 26 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 26, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `VR(${periodFromConfig(config, 26)})`,
            format: format(".1f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    // ── CE16 indicators ───────────────────────────────────────────────────────
    registerLineSeries("KDJ", {
        component: LineSeries,
        defaultParams: { period: 9, m1: 3, m2: 3 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 9, min: 2, step: 1 },
            { key: "m1", labelKey: "settings.m1", type: "number", defaultValue: 3, min: 1, step: 1 },
            { key: "m2", labelKey: "settings.m2", type: "number", defaultValue: 3, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `KDJ(${periodFromConfig(config, 9)},${typeof config.params?.m1 === "number" ? config.params.m1 : 3},${typeof config.params?.m2 === "number" ? config.params.m2 : 3})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("CCI", {
        component: LineSeries,
        defaultParams: { period: 20 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `CCI(${periodFromConfig(config, 20)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("DMI", {
        component: LineSeries,
        defaultParams: { period: 14 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `DMI(${periodFromConfig(config, 14)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("BIAS", {
        component: LineSeries,
        defaultParams: { period: 6 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 6, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `BIAS(${periodFromConfig(config, 6)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("BRAR", {
        component: LineSeries,
        defaultParams: { period: 26 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 26, min: 2, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `BRAR(${periodFromConfig(config, 26)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("MTM", {
        component: LineSeries,
        defaultParams: { period: 6, signalPeriod: 6 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 6, min: 1, step: 1 },
            { key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 6, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `MTM(${periodFromConfig(config, 6)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("EMV", {
        component: LineSeries,
        defaultParams: { period: 14 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `EMV(${periodFromConfig(config, 14)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerSeries("AO", {
        component: BarSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: "AO",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("ROC", {
        component: LineSeries,
        defaultParams: { period: 12 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `ROC(${periodFromConfig(config, 12)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("TRIX", {
        component: LineSeries,
        defaultParams: { period: 12, signalPeriod: 9 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
            { key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 9, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `TRIX(${periodFromConfig(config, 12)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("DMA", {
        component: LineSeries,
        defaultParams: { fastPeriod: 10, slowPeriod: 50, signalPeriod: 10 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "fastPeriod", labelKey: "settings.fastPeriod", type: "number", defaultValue: 10, min: 1, step: 1 },
            { key: "slowPeriod", labelKey: "settings.slowPeriod", type: "number", defaultValue: 50, min: 1, step: 1 },
            { key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 10, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: "DMA",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("PVT", {
        component: LineSeries,
        defaultParams: {},
        defaultYAxis: "right",
        tooltipEntry: (config) => ({
            label: "PVT",
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("PSY", {
        component: LineSeries,
        defaultParams: { period: 12, signalPeriod: 6 },
        defaultYAxis: "left",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
            { key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 6, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `PSY(${periodFromConfig(config, 12)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
    registerLineSeries("CR", {
        component: LineSeries,
        defaultParams: { period: 26, m1: 10, m2: 20, m3: 40, m4: 60 },
        defaultYAxis: "right",
        settingsFields: [
            { key: "period", labelKey: "settings.period", type: "number", defaultValue: 26, min: 1, step: 1 },
            { key: "m1", labelKey: "settings.m1", type: "number", defaultValue: 10, min: 1, step: 1 },
            { key: "m2", labelKey: "settings.m2", type: "number", defaultValue: 20, min: 1, step: 1 },
            { key: "m3", labelKey: "settings.m3", type: "number", defaultValue: 40, min: 1, step: 1 },
            { key: "m4", labelKey: "settings.m4", type: "number", defaultValue: 60, min: 1, step: 1 },
        ],
        tooltipEntry: (config) => ({
            label: `CR(${periodFromConfig(config, 26)})`,
            format: format(".2f"),
            accessor: (d) => resolveSeriesValue(d, config),
        }),
    });
}
