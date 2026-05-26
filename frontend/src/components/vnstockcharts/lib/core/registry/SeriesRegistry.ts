import type { ComponentType } from "react";
import { format } from "d3-format";
import AreaSeries from "../../series/AreaSeries";
import BarSeries from "../../series/BarSeries";
import BollingerSeries from "../../series/BollingerSeries";
import CandlestickSeries from "../../series/CandlestickSeries";
import ElderRaySeries from "../../series/ElderRaySeries";
import LineSeries from "../../series/LineSeries";
import MACDSeries from "../../series/MACDSeries";
import OHLCSeries from "../../series/OHLCSeries";
import RSISeries from "../../series/RSISeries";
import SARSeries from "../../series/SARSeries";
import type { EnrichedDatum } from "../calculators/types";
import type { SeriesSettingField } from "../types/indicator-catalog";
import type { SeriesConfig, SeriesTypeId, YAxisSide } from "../types/pane-descriptor";

export interface SeriesStyleOverride {
	color?: string;
	lineWidth?: number;
	visible?: boolean;
	opacity?: number;
	dashPattern?: number[];
}

export interface TooltipEntryDef {
	label: string;
	color?: string;
	format: (value: number) => string;
	accessor: (datum: EnrichedDatum) => number | undefined;
}

export interface RegistryEntry {
	component: ComponentType<any>;
	defaultParams: Record<string, unknown>;
	defaultYAxis: YAxisSide;
	yExtentsAccessors: Array<(datum: EnrichedDatum) => number | undefined>;
	tooltipEntry: (config: SeriesConfig) => TooltipEntryDef;
	settingsFields?: readonly SeriesSettingField[];
}

const registry = new Map<SeriesTypeId, RegistryEntry>();
const seriesStyleOverrides = new Map<string, Partial<SeriesStyleOverride>>();
const seriesStyleListeners = new Map<string, Set<() => void>>();
const seriesStyleChangeListeners = new Set<() => void>();

function periodFromConfig(config: SeriesConfig, fallback: number) {
	const period = config.params?.period;
	return typeof period === "number" && Number.isFinite(period) ? period : fallback;
}

function colorFromConfig(config: SeriesConfig, fallback: string) {
	return typeof config.color === "string" && config.color.length > 0 ? config.color : fallback;
}

function normalizeSeriesStyleOverride(partialStyle: Partial<SeriesStyleOverride>): Partial<SeriesStyleOverride> {
	const normalized: Partial<SeriesStyleOverride> = {};
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

function cloneSeriesStyleOverride(style?: Partial<SeriesStyleOverride>): Partial<SeriesStyleOverride> | undefined {
	if (!style) {
		return undefined;
	}
	return {
		...style,
		dashPattern: style.dashPattern ? [...style.dashPattern] : undefined,
	};
}

function notifySeriesStyleChange(instanceId: string) {
	seriesStyleListeners.get(instanceId)?.forEach((callback) => callback());
	seriesStyleChangeListeners.forEach((callback) => callback());
}

function notifyAllSeriesStyleChanges() {
	for (const [instanceId, listeners] of seriesStyleListeners) {
		listeners.forEach((callback) => callback());
	}
	seriesStyleChangeListeners.forEach((callback) => callback());
}

function dashPatternToStrokeDasharray(dashPattern?: number[]) {
	if (!dashPattern || dashPattern.length === 0) {
		return "Solid";
	}
	if (dashPattern.length === 1) {
		return dashPattern[0] <= 2 ? "Dot" : "Dash";
	}
	return dashPattern[0] <= 2 ? "Dot" : "Dash";
}

function registerLineSeries(type: SeriesTypeId, options: Omit<RegistryEntry, "component" | "defaultParams" | "defaultYAxis" | "yExtentsAccessors" | "tooltipEntry"> & {
	component: ComponentType<any>;
	defaultYAxis?: YAxisSide;
	defaultParams?: Record<string, unknown>;
	yExtentsAccessors: Array<(datum: EnrichedDatum) => number | undefined>;
	tooltipEntry: (config: SeriesConfig) => TooltipEntryDef;
	settingsFields?: readonly SeriesSettingField[];
}) {
	registerSeries(type, {
		component: options.component,
		defaultParams: options.defaultParams ?? {},
		defaultYAxis: options.defaultYAxis ?? "right",
		yExtentsAccessors: options.yExtentsAccessors,
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

export function listSeriesStyleOverrides(): Record<string, Partial<SeriesStyleOverride>> {
	return Object.fromEntries([...seriesStyleOverrides.entries()].map(([instanceId, style]) => [instanceId, cloneSeriesStyleOverride(style) ?? {}]));
}

export function overrideSeriesStyle(instanceId: string, partialStyle: Partial<SeriesStyleOverride>): void {
	const normalized = normalizeSeriesStyleOverride(partialStyle);
	const current = seriesStyleOverrides.get(instanceId) ?? {};
	const next = { ...current, ...normalized };
	seriesStyleOverrides.set(instanceId, next);
	notifySeriesStyleChange(instanceId);
}

export function getSeriesStyleOverride(instanceId: string): Partial<SeriesStyleOverride> | undefined {
	return cloneSeriesStyleOverride(seriesStyleOverrides.get(instanceId));
}

export function clearSeriesStyleOverride(instanceId: string): void {
	seriesStyleOverrides.delete(instanceId);
	notifySeriesStyleChange(instanceId);
}

export function subscribeSeriesStyle(instanceId: string, callback: () => void): () => void {
	if (!seriesStyleListeners.has(instanceId)) {
		seriesStyleListeners.set(instanceId, new Set());
	}
	seriesStyleListeners.get(instanceId)!.add(callback);
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

export function subscribeSeriesStyleChanges(callback: () => void): () => void {
	seriesStyleChangeListeners.add(callback);
	return () => {
		seriesStyleChangeListeners.delete(callback);
	};
}

export function registerSeries(type: SeriesTypeId, entry: RegistryEntry): void {
	registry.set(type, entry);
}

export function getSeries(type: SeriesTypeId): RegistryEntry {
	const entry = registry.get(type);
	if (!entry) {
		throw new Error(`SeriesRegistry: unknown type "${type}"`);
	}
	return entry;
}

export function listRegistered(): SeriesTypeId[] {
	return [...registry.keys()];
}

export function registerPhaseOneSeries() {
	clearRegistry();

	registerSeries("Candlestick", {
		component: CandlestickSeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.low,
			(d) => d.high,
		],
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
		yExtentsAccessors: [
			(d) => d.low,
			(d) => d.high,
		],
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
		yExtentsAccessors: [
			(d) => d.low,
			(d) => d.high,
		],
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
		yExtentsAccessors: [
			(d) => d.low,
			(d) => d.high,
		],
		tooltipEntry: () => ({
			label: "HA",
			format: format(".2f"),
			accessor: (d) => d.close,
		}),
	});

	registerLineSeries("Line", {
		component: LineSeries,
		yExtentsAccessors: [(d) => d.close],
		tooltipEntry: (config) => ({
			label: String(config.params?.label ?? "Line"),
			format: format(".2f"),
			accessor: (d) => d.close,
		}),
	});

	registerLineSeries("Area", {
		component: AreaSeries,
		yExtentsAccessors: [(d) => d.close],
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
		yExtentsAccessors: [(d) => d.close],
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
		yExtentsAccessors: [(d) => d.volume],
		tooltipEntry: () => ({
			label: "Volume",
			format: format(".3s"),
			accessor: (d) => d.volume,
		}),
	});

	registerLineSeries("EMA", {
		component: LineSeries,
		defaultParams: { period: 20 },
		yExtentsAccessors: [(d) => d.ema20, (d) => d.ema50],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `EMA(${periodFromConfig(config, 20)})`,
			format: format(".2f"),
			accessor: (d) => d.ema20 ?? d.ema50 ?? d.close,
		}),
	});

	registerSeries("BollingerBand", {
		component: BollingerSeries,
		defaultParams: { period: 20, stdDev: 2 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.bollingerBand?.top,
			(d) => d.bollingerBand?.middle,
			(d) => d.bollingerBand?.bottom,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 5, step: 1 },
			{ key: "stdDev", labelKey: "settings.stdDev", type: "number", defaultValue: 2, min: 0.5, step: 0.5 },
		],
		tooltipEntry: (config) => ({
			label: `BB(${periodFromConfig(config, 20)},${config.params?.stdDev ?? 2})`,
			format: format(".2f"),
			accessor: (d) => d.bollingerBand?.middle ?? d.close,
		}),
	});

	registerSeries("RSI", {
		component: RSISeries,
		defaultParams: { period: 14 },
		defaultYAxis: "left",
		yExtentsAccessors: [(d) => d.rsi],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `RSI(${periodFromConfig(config, 14)})`,
			format: format(".1f"),
			accessor: (d) => d.rsi,
		}),
	});

	registerSeries("MACD", {
		component: MACDSeries,
		defaultParams: { fast: 12, slow: 26, signal: 9 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.macd?.macd,
			(d) => d.macd?.signal,
			(d) => d.macd?.divergence,
		],
		settingsFields: [
			{ key: "fast", labelKey: "settings.fast", type: "number", defaultValue: 12, min: 1, step: 1 },
			{ key: "slow", labelKey: "settings.slow", type: "number", defaultValue: 26, min: 1, step: 1 },
			{ key: "signal", labelKey: "settings.signal", type: "number", defaultValue: 9, min: 1, step: 1 },
		],
		tooltipEntry: () => ({
			label: "MACD",
			format: format(".2f"),
			accessor: (d) => d.macd?.macd,
		}),
	});

	registerLineSeries("CVDApprox", {
		component: LineSeries,
		defaultYAxis: "right",
		defaultParams: {},
		yExtentsAccessors: [(d) => d.cvdApprox],
		tooltipEntry: () => ({
			label: "CVD",
			format: format(".0f"),
			accessor: (d) => d.cvdApprox,
		}),
	});

	registerLineSeries("CVDRealtime", {
		component: LineSeries,
		defaultYAxis: "right",
		defaultParams: {},
		yExtentsAccessors: [(d) => d.cvdRealtime],
		tooltipEntry: () => ({
			label: "CVD RT",
			format: format(".0f"),
			accessor: (d) => d.cvdRealtime,
		}),
	});

	registerSeries("StrengthElder", {
		component: ElderRaySeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.bullPower,
			(d) => d.bearPower,
		],
		tooltipEntry: () => ({
			label: "Strength",
			format: format(".2f"),
			accessor: (d) => d.bullPower,
		}),
	});

	registerLineSeries("StrengthRelative", {
		component: LineSeries,
		defaultYAxis: "right",
		defaultParams: {},
		yExtentsAccessors: [(d) => d.strengthRelative],
		tooltipEntry: () => ({
			label: "RS",
			format: format(".3f"),
			accessor: (d) => d.strengthRelative,
		}),
	});

	registerSeries("Whale", {
		component: BarSeries,
		defaultParams: { threshold: 50_000 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.whaleBuyVol,
			(d) => d.whaleSellVol,
		],
		settingsFields: [
			{ key: "threshold", labelKey: "settings.thresholdUsd", type: "number", defaultValue: 50_000, min: 1000, step: 1000 },
		],
		tooltipEntry: () => ({
			label: "Whale",
			format: format(".3s"),
			accessor: (d) => d.whaleBuyVol ?? d.whaleSellVol,
		}),
	});

	// ── CE15 indicators ───────────────────────────────────────────────────────

	registerLineSeries("MA", {
		component: LineSeries,
		defaultParams: { period: 20 },
		yExtentsAccessors: [(d) => d.close],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `MA(${periodFromConfig(config, 20)})`,
			format: format(".2f"),
			accessor: (d) => d.close,
		}),
	});

	registerLineSeries("BBI", {
		component: LineSeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.bbi],
		tooltipEntry: () => ({
			label: "BBI",
			format: format(".2f"),
			accessor: (d) => d.bbi,
		}),
	});

	registerSeries("SAR", {
		component: SARSeries,
		defaultParams: { afStep: 0.02, afMax: 0.2 },
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.sar],
		settingsFields: [
			{ key: "afStep", labelKey: "settings.afStep", type: "number", defaultValue: 0.02, min: 0.001, step: 0.001 },
			{ key: "afMax", labelKey: "settings.afMax", type: "number", defaultValue: 0.2, min: 0.01, step: 0.01 },
		],
		tooltipEntry: () => ({
			label: "SAR",
			format: format(".2f"),
			accessor: (d) => d.sar,
		}),
	});

	registerLineSeries("OBV", {
		component: LineSeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.obv],
		tooltipEntry: () => ({
			label: "OBV",
			format: format(".3s"),
			accessor: (d) => d.obv,
		}),
	});

	registerLineSeries("WR", {
		component: LineSeries,
		defaultParams: { period: 14 },
		defaultYAxis: "left",
		yExtentsAccessors: [(d) => d.wr],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `WR(${periodFromConfig(config, 14)})`,
			format: format(".1f"),
			accessor: (d) => d.wr,
		}),
	});

	registerLineSeries("VR", {
		component: LineSeries,
		defaultParams: { period: 26 },
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.vr],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 26, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `VR(${periodFromConfig(config, 26)})`,
			format: format(".1f"),
			accessor: (d) => d.vr,
		}),
	});

	// ── CE16 indicators ───────────────────────────────────────────────────────

	registerLineSeries("KDJ", {
		component: LineSeries,
		defaultParams: { period: 9, m1: 3, m2: 3 },
		defaultYAxis: "left",
		yExtentsAccessors: [
			(d) => d.kdj?.k,
			(d) => d.kdj?.d,
			(d) => d.kdj?.j,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 9, min: 2, step: 1 },
			{ key: "m1", labelKey: "settings.m1", type: "number", defaultValue: 3, min: 1, step: 1 },
			{ key: "m2", labelKey: "settings.m2", type: "number", defaultValue: 3, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `KDJ(${periodFromConfig(config, 9)},${typeof config.params?.m1 === "number" ? config.params.m1 : 3},${typeof config.params?.m2 === "number" ? config.params.m2 : 3})`,
			format: format(".2f"),
			accessor: (d) => d.kdj?.j,
		}),
	});

	registerLineSeries("CCI", {
		component: LineSeries,
		defaultParams: { period: 20 },
		defaultYAxis: "left",
		yExtentsAccessors: [(d) => d.cci],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 20, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `CCI(${periodFromConfig(config, 20)})`,
			format: format(".2f"),
			accessor: (d) => d.cci,
		}),
	});

	registerLineSeries("DMI", {
		component: LineSeries,
		defaultParams: { period: 14 },
		defaultYAxis: "left",
		yExtentsAccessors: [
			(d) => d.dmi?.plusDI,
			(d) => d.dmi?.minusDI,
			(d) => d.dmi?.adx,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `DMI(${periodFromConfig(config, 14)})`,
			format: format(".2f"),
			accessor: (d) => d.dmi?.adx,
		}),
	});

	registerLineSeries("BIAS", {
		component: LineSeries,
		defaultParams: { period: 6 },
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.bias],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 6, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `BIAS(${periodFromConfig(config, 6)})`,
			format: format(".2f"),
			accessor: (d) => d.bias,
		}),
	});

	registerLineSeries("BRAR", {
		component: LineSeries,
		defaultParams: { period: 26 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.brar?.ar,
			(d) => d.brar?.br,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 26, min: 2, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `BRAR(${periodFromConfig(config, 26)})`,
			format: format(".2f"),
			accessor: (d) => d.brar?.br,
		}),
	});

	registerLineSeries("MTM", {
		component: LineSeries,
		defaultParams: { period: 6, signalPeriod: 6 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.mtm?.mtm,
			(d) => d.mtm?.signal,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 6, min: 1, step: 1 },
			{ key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 6, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `MTM(${periodFromConfig(config, 6)})`,
			format: format(".2f"),
			accessor: (d) => d.mtm?.mtm,
		}),
	});

	registerLineSeries("EMV", {
		component: LineSeries,
		defaultParams: { period: 14 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.emv?.emv,
			(d) => d.emv?.signal,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 14, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `EMV(${periodFromConfig(config, 14)})`,
			format: format(".2f"),
			accessor: (d) => d.emv?.emv,
		}),
	});

	registerSeries("AO", {
		component: BarSeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.ao],
		tooltipEntry: () => ({
			label: "AO",
			format: format(".2f"),
			accessor: (d) => d.ao,
		}),
	});

	registerLineSeries("ROC", {
		component: LineSeries,
		defaultParams: { period: 12 },
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.roc],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `ROC(${periodFromConfig(config, 12)})`,
			format: format(".2f"),
			accessor: (d) => d.roc,
		}),
	});

	registerLineSeries("TRIX", {
		component: LineSeries,
		defaultParams: { period: 12, signalPeriod: 9 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.trix?.trix,
			(d) => d.trix?.signal,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
			{ key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 9, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `TRIX(${periodFromConfig(config, 12)})`,
			format: format(".2f"),
			accessor: (d) => d.trix?.trix,
		}),
	});

	registerLineSeries("DMA", {
		component: LineSeries,
		defaultParams: { fastPeriod: 10, slowPeriod: 50, signalPeriod: 10 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.dma?.ddd,
			(d) => d.dma?.ama,
		],
		settingsFields: [
			{ key: "fastPeriod", labelKey: "settings.fastPeriod", type: "number", defaultValue: 10, min: 1, step: 1 },
			{ key: "slowPeriod", labelKey: "settings.slowPeriod", type: "number", defaultValue: 50, min: 1, step: 1 },
			{ key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 10, min: 1, step: 1 },
		],
		tooltipEntry: () => ({
			label: "DMA",
			format: format(".2f"),
			accessor: (d) => d.dma?.ddd,
		}),
	});

	registerLineSeries("PVT", {
		component: LineSeries,
		defaultParams: {},
		defaultYAxis: "right",
		yExtentsAccessors: [(d) => d.pvt],
		tooltipEntry: () => ({
			label: "PVT",
			format: format(".2f"),
			accessor: (d) => d.pvt,
		}),
	});

	registerLineSeries("PSY", {
		component: LineSeries,
		defaultParams: { period: 12, signalPeriod: 6 },
		defaultYAxis: "left",
		yExtentsAccessors: [
			(d) => d.psy?.psy,
			(d) => d.psy?.signal,
		],
		settingsFields: [
			{ key: "period", labelKey: "settings.period", type: "number", defaultValue: 12, min: 1, step: 1 },
			{ key: "signalPeriod", labelKey: "settings.signalPeriod", type: "number", defaultValue: 6, min: 1, step: 1 },
		],
		tooltipEntry: (config) => ({
			label: `PSY(${periodFromConfig(config, 12)})`,
			format: format(".2f"),
			accessor: (d) => d.psy?.psy,
		}),
	});

	registerLineSeries("CR", {
		component: LineSeries,
		defaultParams: { period: 26, m1: 10, m2: 20, m3: 40, m4: 60 },
		defaultYAxis: "right",
		yExtentsAccessors: [
			(d) => d.cr?.cr,
			(d) => d.cr?.ma1,
			(d) => d.cr?.ma2,
			(d) => d.cr?.ma3,
			(d) => d.cr?.ma4,
		],
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
			accessor: (d) => d.cr?.cr,
		}),
	});
}
