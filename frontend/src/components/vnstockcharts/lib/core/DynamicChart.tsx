import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { format as d3Format } from "d3-format";
import { timeFormat } from "d3-time-format";
import { formatWithTimezone, getCachedFormatter, getGlobalTimezone } from "../utils/timezoneFormatter";
import Chart from "../Chart";
import ChartCanvas from "../ChartCanvas";
import { XAxis, YAxis } from "../axes";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY } from "../coordinates";
import AreaSeries from "../series/AreaSeries";
import BarSeries from "../series/BarSeries";
import BollingerSeries from "../series/BollingerSeries";
import CandlestickSeries from "../series/CandlestickSeries";
import ElderRaySeries from "../series/ElderRaySeries";
import LineSeries from "../series/LineSeries";
import MACDSeries from "../series/MACDSeries";
import OHLCSeries from "../series/OHLCSeries";
import RSISeries from "../series/RSISeries";
import StraightLine from "../series/StraightLine";
import type { EnrichedDatum, IndicatorBandValue, IndicatorMacdValue, IndicatorWhaleValue } from "./calculators/types";
import { getSeries, getSeriesStyleOverride, subscribeSeriesStyleChanges } from "./registry/SeriesRegistry";
import "./registry/registerAll";
import { resolveSeriesStructuredValue, resolveSeriesValue, resolveSeriesValueAccessors } from "./seriesValueResolver";
import { PaneTooltip, type PaneTooltipEntry } from "./PaneTooltip";
import type { PaneDescriptor, SeriesConfig, SeriesTypeId } from "./types/pane-descriptor";
import type { ChartHandle, VisibleRange } from "./types/chart";

type ChartCanvasHandle = InstanceType<typeof ChartCanvas>;

export interface DynamicChartProps {
	panes: readonly PaneDescriptor[];
	heights: readonly number[];
	data: readonly EnrichedDatum[];
	width: number;
	height: number;
	margin: { left: number; right: number; top: number; bottom: number };
	type?: "svg" | "hybrid";
	seriesName: string;
	xScale: any;
	xAccessor: (datum: EnrichedDatum) => Date | number;
	displayXAccessor?: (datum: EnrichedDatum) => Date | number;
	xExtents?: readonly [Date | number, Date | number] | ((data: readonly EnrichedDatum[]) => readonly [Date | number, Date | number]);
	ratio: number;
	mouseMoveEvent?: boolean;
	panEvent?: boolean;
	zoomEvent?: boolean;
	useCrossHairStyleCursor?: boolean;
	defaultFocus?: boolean;
	disableInteraction?: boolean;
	axisStroke: string;
	axisTickFill: string;
	isDark: boolean;
	dateFormat?: (date: Date) => string;
	priceFormat?: (value: number) => string;
	volumeFormat?: (value: number) => string;
	className?: string;
	children?: ReactNode;
	onClick?: (moreProps: { currentItem?: EnrichedDatum; currentCharts?: number[]; mouseXY?: [number, number] }, e: unknown) => void;
	onContextMenu?: (moreProps: { currentItem?: EnrichedDatum; currentCharts?: number[]; mouseXY?: [number, number] }, e: unknown) => void;
	onVisibleDomainChange?: (domain: [Date | number, Date | number]) => void;
	onVisibleRangeChange?: (range: VisibleRange) => void;
}

interface ChartSlot {
	series: SeriesConfig[];
	accessors: Array<(datum: EnrichedDatum) => number | undefined>;
	tooltipEntries: PaneTooltipEntry[];
	hasLeftAxis: boolean;
	hasRightAxis: boolean;
	tooltipMode: PaneDescriptor["tooltip"];
	axisFormat: (value: number) => string;
	seriesTypes: SeriesTypeId[];
}

function createChartSlot(series: SeriesConfig[], tooltipMode: PaneDescriptor["tooltip"]): ChartSlot {
	const seriesTypes = series.map((item) => item.type);
	return {
		series,
		accessors: series.flatMap((item) => resolveSeriesValueAccessors(item)),
		tooltipEntries: buildTooltipEntriesForSeries(series),
		hasLeftAxis: series.some((item) => item.yAxis === "left"),
		hasRightAxis: series.some((item) => item.yAxis === "right"),
		tooltipMode,
		axisFormat: axisFormatForSeriesTypes(seriesTypes),
		seriesTypes,
	};
}

function finiteExtent(values: readonly number[]): [number, number] {
	const finiteValues = values.filter((value) => Number.isFinite(value));
	if (finiteValues.length === 0) {
		return [0, 1];
	}
	const minValue = Math.min(...finiteValues);
	const maxValue = Math.max(...finiteValues);
	if (minValue === maxValue) {
		return [minValue - 1, maxValue + 1];
	}
	return [minValue, maxValue];
}

/** Gap (px) added at the top of each non-first pane to visually separate charts. */
const INNER_PANE_GAP = 10;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const PRICE_SERIES: SeriesTypeId[] = ["Candlestick", "HollowCandle", "OHLC", "HeikinAshi", "Line", "Area", "Bar"];
const VOLUME_SERIES: SeriesTypeId[] = ["Volume", "Whale", "CVDApprox", "CVDRealtime", "PVT"];
const OSCILLATOR_SERIES: SeriesTypeId[] = [
	"RSI",
	"StrengthRelative",
	"KDJ",
	"CCI",
	"DMI",
	"BIAS",
	"BRAR",
	"MTM",
	"EMV",
	"AO",
	"ROC",
	"TRIX",
	"DMA",
	"PSY",
	"CR",
];

function axisFormatForSeriesTypes(types: SeriesTypeId[]): (v: number) => string {
	if (types.some((t) => VOLUME_SERIES.includes(t))) return d3Format(".3s");
	if (types.some((t) => OSCILLATOR_SERIES.includes(t))) return d3Format(".1f");
	if (types.some((t) => t === "MACD" || t === "StrengthElder")) return d3Format(".1f");
	if (types.some((t) => PRICE_SERIES.includes(t))) return d3Format(",.0f");
	return d3Format(".4s");
}

function dashPatternToSeriesDasharray(dashPattern?: number[]) {
	if (!dashPattern || dashPattern.length === 0) {
		return "Solid";
	}
	if (dashPattern[0] <= 2) {
		return "Dot";
	}
	return "Dash";
}

function getSeriesStyleOverrideForSeries(series: SeriesConfig) {
	return series.id ? getSeriesStyleOverride(series.id) : undefined;
}

/**
 * Resolves the display color for a series in the same priority order as renderSeries:
 * runtime styleOverride → user-set series.color → params.color → undefined (falls back to textFill in tooltip).
 */
function resolveSeriesDisplayColor(item: SeriesConfig): string | undefined {
	const styleOverride = getSeriesStyleOverrideForSeries(item);
	if (styleOverride?.color) return styleOverride.color;
	if (item.color) return item.color;
	const entry = getSeries(item.type);
	const params: Record<string, unknown> = { ...entry.defaultParams, ...item.params };
	const paramColor = params.color;
	return typeof paramColor === "string" && paramColor.length > 0 ? paramColor : undefined;
}

function buildTooltipEntriesForSeries(series: SeriesConfig[]): PaneTooltipEntry[] {
	return series.flatMap((item) => {
		const entry = getSeries(item.type);
		const tooltip = entry.tooltipEntry(item);
		return {
			label: tooltip.label,
			color: resolveSeriesDisplayColor(item) ?? tooltip.color,
			format: tooltip.format,
			value: (datum) => resolveSeriesValue(datum, item),
		} satisfies PaneTooltipEntry;
	});
}

function resolveScaleSlotIdForSeries(
	paneId: string,
	series: SeriesConfig,
	groupingMode: "explicit" | "split" | "single",
): string {
	if (groupingMode === "explicit") {
		return series.scaleSlotId ?? `${paneId}-${series.yAxis}`;
	}

	if (groupingMode === "split") {
		return `${paneId}-${series.yAxis}`;
	}

	return `${paneId}-single`;
}

function buildPriceTooltipEntries(priceFormat: (value: number) => string, volumeFormat: (value: number) => string): PaneTooltipEntry[] {
	return [
		{ label: "O", format: priceFormat, value: (d) => d.open },
		{ label: "H", format: priceFormat, value: (d) => d.high },
		{ label: "L", format: priceFormat, value: (d) => d.low },
		{ label: "C", format: priceFormat, value: (d) => d.close },
		{ label: "Vol", format: volumeFormat, value: (d) => d.volume },
	];
}

function computeExtentsForIndex(
	index: number,
	align: "left" | "center" | "right",
	currentBarCount: number,
	fullData: readonly EnrichedDatum[],
): [Date, Date] | null {
	if (fullData.length === 0 || index < 0) {
		return null;
	}

	const clampedIndex = Math.min(index, fullData.length - 1);
	const half = Math.floor(currentBarCount / 2);
	let start: number;
	let end: number;

	switch (align) {
		case "left":
			start = clampedIndex;
			end = Math.min(clampedIndex + currentBarCount - 1, fullData.length - 1);
			break;
		case "right":
			end = clampedIndex;
			start = Math.max(clampedIndex - currentBarCount + 1, 0);
			break;
		case "center":
		default:
			start = Math.max(clampedIndex - half, 0);
			end = Math.min(clampedIndex + half, fullData.length - 1);
			break;
	}

	const startDate = fullData[start]?.date;
	const endDate = fullData[end]?.date;
	if (!startDate || !endDate) {
		return null;
	}

	return [startDate, endDate];
}

export function buildChartSlots(pane: PaneDescriptor): ChartSlot[] {
	// Only render series that are not explicitly hidden (visible !== false)
	const activeSeries = pane.series.filter((s) => {
		const styleOverride = getSeriesStyleOverrideForSeries(s);
		return s.visible !== false && styleOverride?.visible !== false;
	});

	const hasExplicitScaleSlotIds = activeSeries.length > 0 && activeSeries.every((series) => series.scaleSlotId);
	const groupingMode: "explicit" | "split" | "single" = hasExplicitScaleSlotIds
		? "explicit"
		: pane.splitScale
			? "split"
			: "single"
	;
	const slotsByScaleSlotId = new Map<string, SeriesConfig[]>();
	const orderedScaleSlotIds: string[] = [];

	activeSeries.forEach((series) => {
		const scaleSlotId = resolveScaleSlotIdForSeries(pane.id, series, groupingMode);

		const slotSeries = slotsByScaleSlotId.get(scaleSlotId);
		if (slotSeries) {
			slotSeries.push(series);
			return;
		}

		slotsByScaleSlotId.set(scaleSlotId, [series]);
		orderedScaleSlotIds.push(scaleSlotId);
	});

	// Always emit at least one empty slot so XAxis/axes render even for empty panes
	if (orderedScaleSlotIds.length === 0) {
		return [createChartSlot([], pane.tooltip)];
	}
	return orderedScaleSlotIds.map((scaleSlotId) => createChartSlot(slotsByScaleSlotId.get(scaleSlotId) ?? [], pane.tooltip));
}

// Only true histogram-from-zero series need 0 anchored in the y-domain.
// "Bar" (price bar chart) uses close price and must NOT be included here —
// anchoring to 0 causes y-axis 0→80k and full-height bars on the price pane.
const BAR_SERIES_TYPES: SeriesTypeId[] = ["Volume", "Whale", "AO"];

function buildYExtents(slot: ChartSlot) {
	const accessors = slot.accessors.length > 0 ? slot.accessors : [(_: EnrichedDatum) => _.close as number | undefined];
	// Bar series draw from y=0 upward — yExtents must include 0 so the baseline anchors correctly
	if (slot.seriesTypes.some((t) => BAR_SERIES_TYPES.includes(t))) {
		return [(_: EnrichedDatum) => 0 as number | undefined, ...accessors];
	}
	return accessors;
}

function candleBodyWidth(
	props: { widthRatio?: number },
	moreProps: {
		xScale: (value: Date) => number;
		xAccessor: (datum: EnrichedDatum) => Date;
		plotData: EnrichedDatum[];
	},
) {
	const ratio = props.widthRatio ?? 0.8;
	if (moreProps.plotData.length < 2) return 6;

	const first = moreProps.xAccessor(moreProps.plotData[0]);
	const second = moreProps.xAccessor(moreProps.plotData[1]);
	const stepPx = Math.abs(moreProps.xScale(second) - moreProps.xScale(first));

	if (!Number.isFinite(stepPx) || stepPx <= 0) return 6;

	// Keep candle body within the current screen-space step to avoid overlap when zooming out.
	const targetWidth = stepPx * ratio;
	const maxSafeWidth = Math.max(1, Math.floor(stepPx));
	return Math.max(1, Math.min(maxSafeWidth, Math.floor(targetWidth)));
}

function renderSeries(series: SeriesConfig) {
	const type = series.type;
	const entry = getSeries(type);
	const params = { ...entry.defaultParams, ...series.params };
	const styleOverride = getSeriesStyleOverrideForSeries(series);
	if (series.visible === false || styleOverride?.visible === false) {
		return null;
	}

	const lineColor = styleOverride?.color ?? series.color ?? String(params.color ?? "#2962ff");
	const fillColor = styleOverride?.color ?? series.color ?? String(params.fill ?? lineColor);
	const upColor = styleOverride?.color ?? String(params.upColor ?? "#089981");
	const downColor = styleOverride?.color ?? String(params.downColor ?? "#f23645");
	const lineWidth = styleOverride?.lineWidth ?? (series.overlay ? 1.5 : 1.2);
	const strokeOpacity = styleOverride?.opacity ?? 1;
	const fillOpacity = styleOverride?.opacity ?? 0.5;
	const dashArray = dashPatternToSeriesDasharray(styleOverride?.dashPattern);
	const seriesKey = series.id ?? type;

	const accessor = (datum: EnrichedDatum) => resolveSeriesValue(datum, series);
	const structured = (datum: EnrichedDatum) => resolveSeriesStructuredValue(datum, series) as Record<string, number | undefined> | number | undefined;
	const fieldAccessor = (field: string) => (datum: EnrichedDatum) => (structured(datum) as Record<string, number | undefined> | undefined)?.[field];
	/** Resolve a per-component sub-color, falling back to fallback color */
	const sc = (key: string, fallback: string) => series.subColors?.[key] ?? fallback;

	switch (type) {
		case "Candlestick":
		case "HeikinAshi":
			return (
				<CandlestickSeries
					key={seriesKey}
					width={candleBodyWidth}
					yAccessor={(datum: EnrichedDatum) => datum as any}
					fill={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)) as any}
					stroke={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)) as any}
					wickStroke={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)) as any}
					candleStrokeWidth={styleOverride?.lineWidth ?? 0.5}
					opacity={styleOverride?.opacity ?? 0.5}
				/>
			);
			case "HollowCandle":
				return (
					<CandlestickSeries
						key={seriesKey}
						width={candleBodyWidth}
						yAccessor={(datum: EnrichedDatum) => datum as any}
						fill={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? "transparent" : downColor)) as any}
						stroke={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)) as any}
						wickStroke={((datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)) as any}
						candleStrokeWidth={styleOverride?.lineWidth ?? 0.5}
						opacity={styleOverride?.opacity ?? 0.5}
					/>
				);
		case "OHLC":
				return <OHLCSeries key={seriesKey} stroke={(datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)} />;
		case "Line":
		case "EMA":
		case "CVDApprox":
		case "CVDRealtime":
		case "StrengthRelative":
			return (
				<LineSeries
					key={seriesKey}
					yAccessor={accessor as any}
					stroke={lineColor}
					strokeWidth={lineWidth}
					strokeOpacity={strokeOpacity}
					strokeDasharray={dashArray}
				/>
			);
		case "Area":
			return (
				<AreaSeries
					key={seriesKey}
					yAccessor={accessor as any}
					stroke={lineColor}
					fill={fillColor}
					strokeWidth={lineWidth}
					strokeOpacity={strokeOpacity}
					opacity={fillOpacity}
					strokeDasharray={dashArray}
				/>
			);
		case "Bar":
		case "Volume":
		case "Whale":
			return (
				<BarSeries
					key={seriesKey}
					width={candleBodyWidth}
					yAccessor={(datum: EnrichedDatum) => {
						if (type === "Whale") {
							const whale = resolveSeriesStructuredValue(datum, series) as IndicatorWhaleValue | undefined;
							return whale?.whaleBuyVol ?? (whale?.whaleSellVol ? -whale.whaleSellVol : undefined);
						}
						return accessor(datum) as number | undefined;
					}}
					fill={(datum: EnrichedDatum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)}
					opacity={styleOverride?.opacity ?? (type === "Volume" ? 0.75 : 0.6)}
				/>
			);
		case "BollingerBand": {
			// Sub-colors: middle, top, bottom — apply 53% alpha to band lines for visual clarity
			const bbMidColor = sc("middle", lineColor);
			const bbTopRaw   = sc("top",    lineColor);
			const bbBotRaw   = sc("bottom", lineColor);
			const withAlpha  = (c: string) => c.match(/^#[0-9a-fA-F]{6}$/) ? c + "88" : c;
			return (
				<BollingerSeries
					key={seriesKey}
					yAccessor={(datum: EnrichedDatum) => resolveSeriesStructuredValue(datum, series) as IndicatorBandValue | undefined}
					stroke={{ top: withAlpha(bbTopRaw), middle: bbMidColor, bottom: withAlpha(bbBotRaw) }}
					fill={fillColor}
					opacity={styleOverride?.opacity ?? 0.15}
				/>
			);
		}
		case "RSI": {
			const rsiLine  = sc("line",       lineColor);
			const rsiOB    = sc("overbought", "#f23645");
			const rsiMid   = sc("middle",     "#9ca3af");
			const rsiOS    = sc("oversold",   "#089981");
			return (
				<RSISeries
					key={seriesKey}
					yAccessor={(datum: EnrichedDatum) => resolveSeriesValue(datum, series)}
					stroke={{
						top: rsiOB,
						middle: rsiMid,
						bottom: rsiOS,
						outsideThreshold: rsiLine,
						insideThreshold: rsiLine,
					}}
					opacity={{ top: 0.5, middle: 0.4, bottom: 0.5 }}
					strokeDasharray={{ line: dashArray, top: "ShortDash", middle: "ShortDash", bottom: "ShortDash" }}
					strokeWidth={{
						outsideThreshold: lineWidth,
						insideThreshold: lineWidth,
						top: 1,
						middle: 1,
						bottom: 1,
					}}
				/>
			);
		}
		case "MACD": {
			const macdColor   = sc("macd",    lineColor);
			const signalColor = sc("signal",  "#ff6d00");
			const divergeColor = sc("diverge", "#26a69a");
			return <MACDSeries key={seriesKey} yAccessor={(datum: EnrichedDatum) => resolveSeriesStructuredValue(datum, series) as IndicatorMacdValue | undefined} stroke={{ macd: macdColor, signal: signalColor }} fill={{ divergence: divergeColor }} opacity={strokeOpacity} />;
		}
		case "KDJ": {
			const kColor = sc("k", lineColor);
			const dColor = sc("d", "#ff6d00");
			const jColor = sc("j", "#26a69a");
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-k`} yAccessor={fieldAccessor("k") as any} stroke={kColor} strokeWidth={1.2} />
					<LineSeries key={`${type}-d`} yAccessor={fieldAccessor("d") as any} stroke={dColor} strokeWidth={1.2} />
					<LineSeries key={`${type}-j`} yAccessor={fieldAccessor("j") as any} stroke={jColor} strokeWidth={1.2} />
					<StraightLine stroke={kColor} opacity={0.35} yValue={80} strokeDasharray="ShortDash" />
					<StraightLine stroke={kColor} opacity={0.35} yValue={50} strokeDasharray="ShortDash" />
					<StraightLine stroke={kColor} opacity={0.35} yValue={20} strokeDasharray="ShortDash" />
				</g>
			);
		}
		case "CCI":
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-line`} yAccessor={accessor as any} stroke={lineColor} strokeWidth={1.2} />
					<StraightLine stroke={lineColor} opacity={0.35} yValue={100} strokeDasharray="ShortDash" />
					<StraightLine stroke={lineColor} opacity={0.35} yValue={0} strokeDasharray="ShortDash" />
					<StraightLine stroke={lineColor} opacity={0.35} yValue={-100} strokeDasharray="ShortDash" />
				</g>
			);
		case "DMI": {
			const plusColor  = sc("plusDI",  "#089981");
			const minusColor = sc("minusDI", "#f23645");
			const adxColor   = sc("adx",     lineColor);
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-plus`}  yAccessor={fieldAccessor("plusDI") as any}  stroke={plusColor}  strokeWidth={1.2} />
					<LineSeries key={`${type}-minus`} yAccessor={fieldAccessor("minusDI") as any} stroke={minusColor} strokeWidth={1.2} />
					<LineSeries key={`${type}-adx`}   yAccessor={fieldAccessor("adx") as any}     stroke={adxColor}   strokeWidth={1.2} />
				</g>
			);
		}
		case "BIAS":
			return <LineSeries key={type} yAccessor={accessor as any} stroke={lineColor} strokeWidth={1.2} />;
		case "BRAR": {
			const arColor = sc("ar", lineColor);
			const brColor = sc("br", "#ff6d00");
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-ar`} yAccessor={fieldAccessor("ar") as any} stroke={arColor} strokeWidth={1.2} />
					<LineSeries key={`${type}-br`} yAccessor={fieldAccessor("br") as any} stroke={brColor} strokeWidth={1.2} />
				</g>
			);
		}
		case "MTM": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-mtm`}    yAccessor={fieldAccessor("mtm") as any}    stroke={sc("mtm",    lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-signal`} yAccessor={fieldAccessor("signal") as any} stroke={sc("signal", "#ff6d00")} strokeWidth={1.2} />
				</g>
			);
		}
		case "EMV": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-emv`}    yAccessor={fieldAccessor("emv") as any}    stroke={sc("emv",    lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-signal`} yAccessor={fieldAccessor("signal") as any} stroke={sc("signal", "#ff6d00")} strokeWidth={1.2} />
				</g>
			);
		}
		case "AO":
			return (
				<BarSeries
					key={seriesKey}
					width={candleBodyWidth}
					yAccessor={accessor as any}
					fill={(datum: EnrichedDatum) => datum.aoColor ?? lineColor}
					opacity={0.85}
				/>
			);
		case "ROC":
			return <LineSeries key={type} yAccessor={accessor as any} stroke={lineColor} strokeWidth={1.2} />;
		case "TRIX": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-trix`}   yAccessor={fieldAccessor("trix") as any}   stroke={sc("trix",   lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-signal`} yAccessor={fieldAccessor("signal") as any} stroke={sc("signal", "#ff6d00")} strokeWidth={1.2} />
				</g>
			);
		}
		case "DMA": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-ddd`} yAccessor={fieldAccessor("ddd") as any} stroke={sc("ddd", lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-ama`} yAccessor={fieldAccessor("ama") as any} stroke={sc("ama", "#ff6d00")} strokeWidth={1.2} />
				</g>
			);
		}
		case "PVT":
			return <LineSeries key={type} yAccessor={accessor as any} stroke={lineColor} strokeWidth={1.2} />;
		case "PSY": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-psy`}    yAccessor={fieldAccessor("psy") as any}    stroke={sc("psy",    lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-signal`} yAccessor={fieldAccessor("signal") as any} stroke={sc("signal", "#ff6d00")} strokeWidth={1.2} />
				</g>
			);
		}
		case "CR": {
			return (
				<g key={seriesKey}>
					<LineSeries key={`${type}-cr`}  yAccessor={fieldAccessor("cr") as any}  stroke={sc("cr",  lineColor)}  strokeWidth={1.2} />
					<LineSeries key={`${type}-ma1`} yAccessor={fieldAccessor("ma1") as any} stroke={sc("ma1", "#ff6d00")} strokeWidth={1.1} />
					<LineSeries key={`${type}-ma2`} yAccessor={fieldAccessor("ma2") as any} stroke={sc("ma2", "#26a69a")} strokeWidth={1.1} />
					<LineSeries key={`${type}-ma3`} yAccessor={fieldAccessor("ma3") as any} stroke={sc("ma3", "#f23645")} strokeWidth={1.1} />
					<LineSeries key={`${type}-ma4`} yAccessor={fieldAccessor("ma4") as any} stroke={sc("ma4", "#9ca3af")} strokeWidth={1.1} />
				</g>
			);
		}
		case "StrengthElder": {
			return (
				<ElderRaySeries
					key={seriesKey}
					yAccessor={(datum: EnrichedDatum) => resolveSeriesStructuredValue(datum, series) as { bullPower?: number; bearPower?: number }}
					bullPowerFill={sc("bull", "#089981")}
					bearPowerFill={sc("bear", "#f23645")}
					straightLineStroke={lineColor}
					straightLineOpacity={strokeOpacity}
					opacity={fillOpacity}
				/>
			);
		}
		default:
			return <LineSeries key={seriesKey} yAccessor={accessor as any} stroke={lineColor} strokeWidth={lineWidth} strokeOpacity={strokeOpacity} strokeDasharray={dashArray} />;
	}
}

/** Adaptive tooltip date format based on visible bar count. */
function inferMinimumPositiveDateDiffMs(data: readonly EnrichedDatum[]): number | null {
	if (data.length < 2) {
		return null;
	}

	let minDiff = Number.POSITIVE_INFINITY;
	for (let index = 1; index < Math.min(data.length, 30); index += 1) {
		const previousBar = data[index - 1];
		const currentBar = data[index];
		const previousMs = previousBar.date instanceof Date ? previousBar.date.valueOf() : (previousBar.date as unknown as number);
		const currentMs = currentBar.date instanceof Date ? currentBar.date.valueOf() : (currentBar.date as unknown as number);
		const diff = currentMs - previousMs;
		if (diff > 0 && diff < minDiff) {
			minDiff = diff;
		}
	}

	return Number.isFinite(minDiff) ? minDiff : null;
}

export function createSmartDateFormatter(
	data: readonly EnrichedDatum[],
	fallbackDateFormat: (date: Date) => string,
): (date: Date) => string {
	const visibleBarCount = Math.max(1, data.length);
	const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
	const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;

	return (date: Date) => {
		if (!isIntraday) {
			return formatWithTimezone(date, { day: "2-digit", month: "2-digit", year: "numeric" });
		}

		if (visibleBarCount <= 50) {
			return formatWithTimezone(date, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
		}
		if (visibleBarCount <= 120) {
			return formatWithTimezone(date, { hour: "2-digit", minute: "2-digit", hour12: false });
		}
		if (visibleBarCount <= 300) {
			return formatWithTimezone(date, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
		}
		
		return fallbackDateFormat(date);
	};
}

/**
 * KlineChart-style X-axis tick formatter.
 * Auto-detects intraday vs. daily and shows month/day/time boundaries.
 */
export function createKlineXAxisFormatter(
	data: readonly EnrichedDatum[],
): (value: Date | number) => string {
	if (data.length < 2) return () => "";

	const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
	const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;

	const formatParts = (tz: string, d: Date) => {
		const formatter = getCachedFormatter("en-US", {
			timeZone: tz,
			day: "numeric",
			month: "numeric",
			year: "numeric",
			hour: "numeric",
			minute: "numeric",
			hour12: false,
		});
		return formatter.formatToParts(d);
	};

	return (value: Date | number) => {
		const d = value instanceof Date ? value : new Date(value as number);
		const tz = getGlobalTimezone();

		let parts: Intl.DateTimeFormatPart[];
		try {
			parts = formatParts(tz, d);
		} catch {
			// Invalid timezone string — fall back to UTC to avoid render crash
			parts = formatParts("UTC", d);
		}

		const dateMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
		const date = parseInt(dateMap.day);
		const hour = parseInt(dateMap.hour);
		const min = parseInt(dateMap.minute);

		const pad = (num: number) => String(num).padStart(2, "0");

		if (isIntraday) {
			if (date === 1 && hour === 0 && min === 0) return `${pad(parseInt(dateMap.month))}-${dateMap.year}`;
			if (hour === 0 && min === 0) return `${pad(date)}-${pad(parseInt(dateMap.month))}`;
			return `${pad(hour)}:${pad(min)}`;
		}

		// Daily+
		if (date === 1) return `${pad(parseInt(dateMap.month))}-${dateMap.year}`;
		return `${pad(date)}-${pad(parseInt(dateMap.month))}`;
	};
}

function renderDynamicChartChildren({
	panes,
	heights,
	data,
	xAccessor,
	axisStroke,
	axisTickFill,
	isDark,
	dateFormat = timeFormat("%Y-%m-%d"),
	priceFormat = d3Format(".2f"),
	volumeFormat = d3Format(".3s"),
	className,
	onContextMenu,
}: DynamicChartProps) {
	// Compute adaptive formatters based on current data size
	const adaptiveDateFormat = createSmartDateFormatter(data, dateFormat);
	const xAxisDateFormat = createKlineXAxisFormatter(data);
	// Detect discontinuous scale (index-based) vs. time scale
	const sampleXValue = data.length > 0 ? xAccessor(data[0]) : undefined;
	const isDiscontinuousScale = typeof sampleXValue === "number";

	const chartSlots = panes.flatMap((pane) => buildChartSlots(pane).map((slot) => ({ pane, slot })));
	let chartId = 1;
	// Track how many slots have been rendered per pane (for tooltip y-stagger in splitScale panes)
	const paneSlotCounter = new Map<string, number>();

	return chartSlots.flatMap(({ pane, slot }, index) => {
		const paneIndex = panes.findIndex((item) => item.id === pane.id);
		const slotInPane = paneSlotCounter.get(pane.id) ?? 0;
		paneSlotCounter.set(pane.id, slotInPane + 1);

		const isInnerPane = paneIndex > 0;
		// Inner panes get a small top gap so charts don't visually merge at splitter lines
		const gap = isInnerPane ? INNER_PANE_GAP : 0;
		const origin = (_w: number, h: number) => [
			0,
			h - heights.slice(paneIndex).reduce((sum, value) => sum + value, 0) + gap,
		];
		const paneHeight = (heights[paneIndex] ?? 0) - gap;
		const hasBottomAxis = paneIndex === panes.length - 1 && index >= 0;
		const isLastSlot = index === chartSlots.length - 1;
		const yExtents = buildYExtents(slot);
		const yAxisFormat = slot.axisFormat;
		const yScaleId = slot.hasLeftAxis && !slot.hasRightAxis
			? "left"
			: slot.hasRightAxis && !slot.hasLeftAxis
				? "right"
				: undefined;
		// Tooltip: first slot of each pane sits just below the gap/splitter (y=4).
		// Subsequent slots in the same pane (splitScale) are staggered down 20px each
		// so their labels don't overlap.
		const tooltipY = 4 + slotInPane * 20;

		return [
			(
				<Chart
					key={`${pane.id}-${index}`}
					id={chartId++}
					height={paneHeight}
					origin={origin}
					paneId={pane.id}
					yScaleId={yScaleId}
					yExtents={yExtents}
					className={className}
					onContextMenu={onContextMenu}
				>
					{slot.hasLeftAxis ? <YAxis axisAt="left" orient="left" ticks={5} stroke={axisStroke} tickLabelFill={axisTickFill} tickStroke={axisStroke} tickFormat={yAxisFormat as any} /> : null}
					{slot.hasRightAxis ? <YAxis axisAt="right" orient="right" ticks={5} stroke={axisStroke} tickLabelFill={axisTickFill} tickStroke={axisStroke} tickFormat={yAxisFormat as any} /> : null}
					{pane.tooltip === "ohlc"
						? (
							<PaneTooltip
								entries={buildPriceTooltipEntries(priceFormat, volumeFormat).concat(slot.tooltipEntries)}
								xDisplayFormat={adaptiveDateFormat}
								origin={[8, tooltipY]}
								labelFill={isDark ? "#d1d4dc" : "#1e2a3b"}
								textFill={isDark ? "#f8fafc" : "#1e2a3b"}
							/>
						)
						: pane.tooltip === "none"
							? null
							: <PaneTooltip entries={slot.tooltipEntries} xDisplayFormat={adaptiveDateFormat} origin={[8, tooltipY]} labelFill={isDark ? "#d1d4dc" : "#1e2a3b"} textFill={isDark ? "#f8fafc" : "#1e2a3b"} />}
					{slot.series.map((series) => renderSeries(series))}
					{hasBottomAxis && slot === chartSlots[chartSlots.length - 1]?.slot ? (
					<XAxis
						axisAt="bottom"
						orient="bottom"
						showDomain={false}
						innerTickSize={0}
						outerTickSize={0}
						tickStroke="transparent"
						tickStrokeOpacity={0}
						tickStrokeWidth={0}
						stroke="transparent"
						tickLabelFill={axisTickFill}
						tickFormat={isDiscontinuousScale ? undefined : (xAxisDateFormat as any)}
					/>
					) : null}
					{/* MouseCoordinateX only on the last slot (bottom pane) — adaptive format based on bar count */}
					{isLastSlot ? <MouseCoordinateX displayFormat={adaptiveDateFormat} /> : null}
					<MouseCoordinateY rectWidth={64} displayFormat={yAxisFormat as any} />
				</Chart>
			),
		];
	}).concat(<CrossHairCursor key="crosshair-cursor" />);
}

const DynamicChartComponent = forwardRef<ChartHandle, DynamicChartProps>(function DynamicChart(props, ref) {
	const { onVisibleRangeChange, ...rest } = props;
	const chartCanvasRef = useRef<ChartCanvasHandle | null>(null);
	const [, setStyleRevision] = useState(0);
	useEffect(() => subscribeSeriesStyleChanges(() => {
		setStyleRevision((value) => value + 1);
	}), []);
	const chartChildren = renderDynamicChartChildren(props);

	useImperativeHandle(ref, () => ({
		scrollToIndex(index: number, align: "left" | "center" | "right" = "center") {
			const canvas = chartCanvasRef.current;
			if (!canvas) return;
			const fullData = canvas.getFullData() as readonly EnrichedDatum[];
			const barCount = canvas.getCurrentViewportBarCount();
			const extents = computeExtentsForIndex(index, align, barCount, fullData);
			if (extents) {
				canvas.setXExtents(extents);
			}
		},
		zoomToRange(startIndex: number, endIndex: number) {
			const canvas = chartCanvasRef.current;
			if (!canvas || startIndex < 0 || endIndex < 0 || startIndex > endIndex) return;
			const fullData = canvas.getFullData() as readonly EnrichedDatum[];
			if (endIndex >= fullData.length) return;
			const startDate = fullData[startIndex]?.date;
			const endDate = fullData[endIndex]?.date;
			if (startDate && endDate) {
				canvas.setXExtents([startDate, endDate]);
			}
		},
		scrollToDate(date: Date, align: "left" | "center" | "right" = "center") {
			const canvas = chartCanvasRef.current;
			if (!canvas) return;
			const fullData = canvas.getFullData() as readonly EnrichedDatum[];
			const index = fullData.findIndex((datum) => datum.date.getTime() >= date.getTime());
			if (index < 0) return;
			const barCount = canvas.getCurrentViewportBarCount();
			const extents = computeExtentsForIndex(index, align, barCount, fullData);
			if (extents) {
				canvas.setXExtents(extents);
			}
		},
	}), []);

	const handleVisibleRangeChange = useCallback((range: VisibleRange) => {
		onVisibleRangeChange?.(range);
	}, [onVisibleRangeChange]);

	return (
		<ChartCanvas
			ref={chartCanvasRef}
			height={props.height}
			width={props.width}
			margin={props.margin}
			type={props.type ?? "hybrid"}
			seriesName={props.seriesName}
			data={props.data}
			xScale={props.xScale}
			xAccessor={props.xAccessor}
			displayXAccessor={props.displayXAccessor ?? props.xAccessor}
			xExtents={props.xExtents}
			ratio={props.ratio}
			mouseMoveEvent={props.mouseMoveEvent}
			panEvent={props.panEvent}
			zoomEvent={props.zoomEvent}
			useCrossHairStyleCursor={props.useCrossHairStyleCursor}
			defaultFocus={props.defaultFocus}
			disableInteraction={props.disableInteraction}
			className={props.className}
			onClick={props.onClick}
			onContextMenu={props.onContextMenu}
			onVisibleDomainChange={props.onVisibleDomainChange}
			onVisibleRangeChange={handleVisibleRangeChange}
		>
			{chartChildren}
			{props.children}
		</ChartCanvas>
	);
});

DynamicChartComponent.displayName = "DynamicChart";

export { DynamicChartComponent as DynamicChart };
