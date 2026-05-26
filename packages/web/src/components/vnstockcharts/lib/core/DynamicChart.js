import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { format as d3Format } from "d3-format";
import { timeFormat } from "d3-time-format";
import Chart from "../Chart.js";
import ChartCanvas from "../ChartCanvas.js";
import { XAxis, YAxis } from "../axes/index.js";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY } from "../coordinates/index.js";
import AreaSeries from "../series/AreaSeries.js";
import BarSeries from "../series/BarSeries.js";
import BollingerSeries from "../series/BollingerSeries.js";
import CandlestickSeries from "../series/CandlestickSeries.js";
import ElderRaySeries from "../series/ElderRaySeries.js";
import LineSeries from "../series/LineSeries.js";
import MACDSeries from "../series/MACDSeries.js";
import OHLCSeries from "../series/OHLCSeries.js";
import RSISeries from "../series/RSISeries.js";
import StraightLine from "../series/StraightLine.js";
import { getSeries, getSeriesStyleOverride, subscribeSeriesStyleChanges } from "./registry/SeriesRegistry.js";
import "./registry/registerAll.js";
import { resolveSeriesStructuredValue, resolveSeriesValue, resolveSeriesValueAccessors } from "./seriesValueResolver.js";
import { PaneTooltip } from "./PaneTooltip.js";
function createChartSlot(series, tooltipMode) {
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
function finiteExtent(values) {
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
const PRICE_SERIES = ["Candlestick", "HollowCandle", "OHLC", "HeikinAshi", "Line", "Area", "Bar"];
const VOLUME_SERIES = ["Volume", "Whale", "CVDApprox", "CVDRealtime", "PVT"];
const OSCILLATOR_SERIES = [
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
function axisFormatForSeriesTypes(types) {
    if (types.some((t) => VOLUME_SERIES.includes(t)))
        return d3Format(".3s");
    if (types.some((t) => OSCILLATOR_SERIES.includes(t)))
        return d3Format(".1f");
    if (types.some((t) => t === "MACD" || t === "StrengthElder"))
        return d3Format(".1f");
    if (types.some((t) => PRICE_SERIES.includes(t)))
        return d3Format(",.0f");
    return d3Format(".4s");
}
function dashPatternToSeriesDasharray(dashPattern) {
    if (!dashPattern || dashPattern.length === 0) {
        return "Solid";
    }
    if (dashPattern[0] <= 2) {
        return "Dot";
    }
    return "Dash";
}
function getSeriesStyleOverrideForSeries(series) {
    return series.id ? getSeriesStyleOverride(series.id) : undefined;
}
/**
 * Resolves the display color for a series in the same priority order as renderSeries:
 * runtime styleOverride → user-set series.color → params.color → undefined (falls back to textFill in tooltip).
 */
function resolveSeriesDisplayColor(item) {
    const styleOverride = getSeriesStyleOverrideForSeries(item);
    if (styleOverride?.color)
        return styleOverride.color;
    if (item.color)
        return item.color;
    const entry = getSeries(item.type);
    const params = { ...entry.defaultParams, ...item.params };
    const paramColor = params.color;
    return typeof paramColor === "string" && paramColor.length > 0 ? paramColor : undefined;
}
function buildTooltipEntriesForSeries(series) {
    return series.flatMap((item) => {
        const entry = getSeries(item.type);
        const tooltip = entry.tooltipEntry(item);
        return {
            label: tooltip.label,
            color: resolveSeriesDisplayColor(item) ?? tooltip.color,
            format: tooltip.format,
            value: (datum) => resolveSeriesValue(datum, item),
        };
    });
}
function resolveScaleSlotIdForSeries(paneId, series, groupingMode) {
    if (groupingMode === "explicit") {
        return series.scaleSlotId ?? `${paneId}-${series.yAxis}`;
    }
    if (groupingMode === "split") {
        return `${paneId}-${series.yAxis}`;
    }
    return `${paneId}-single`;
}
function buildPriceTooltipEntries(priceFormat, volumeFormat) {
    return [
        { label: "O", format: priceFormat, value: (d) => d.open },
        { label: "H", format: priceFormat, value: (d) => d.high },
        { label: "L", format: priceFormat, value: (d) => d.low },
        { label: "C", format: priceFormat, value: (d) => d.close },
        { label: "Vol", format: volumeFormat, value: (d) => d.volume },
    ];
}
function computeExtentsForIndex(index, align, currentBarCount, fullData) {
    if (fullData.length === 0 || index < 0) {
        return null;
    }
    const clampedIndex = Math.min(index, fullData.length - 1);
    const half = Math.floor(currentBarCount / 2);
    let start;
    let end;
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
export function buildChartSlots(pane) {
    // Only render series that are not explicitly hidden (visible !== false)
    const activeSeries = pane.series.filter((s) => {
        const styleOverride = getSeriesStyleOverrideForSeries(s);
        return s.visible !== false && styleOverride?.visible !== false;
    });
    const hasExplicitScaleSlotIds = activeSeries.length > 0 && activeSeries.every((series) => series.scaleSlotId);
    const groupingMode = hasExplicitScaleSlotIds
        ? "explicit"
        : pane.splitScale
            ? "split"
            : "single";
    const slotsByScaleSlotId = new Map();
    const orderedScaleSlotIds = [];
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
const BAR_SERIES_TYPES = ["Volume", "Whale", "AO"];
function buildYExtents(slot) {
    const accessors = slot.accessors.length > 0 ? slot.accessors : [(_) => _.close];
    // Bar series draw from y=0 upward — yExtents must include 0 so the baseline anchors correctly
    if (slot.seriesTypes.some((t) => BAR_SERIES_TYPES.includes(t))) {
        return [(_) => 0, ...accessors];
    }
    return accessors;
}
function candleBodyWidth(props, moreProps) {
    const ratio = props.widthRatio ?? 0.8;
    if (moreProps.plotData.length < 2)
        return 6;
    const first = moreProps.xAccessor(moreProps.plotData[0]);
    const second = moreProps.xAccessor(moreProps.plotData[1]);
    const stepPx = Math.abs(moreProps.xScale(second) - moreProps.xScale(first));
    if (!Number.isFinite(stepPx) || stepPx <= 0)
        return 6;
    return Math.max(3, stepPx * ratio);
}
function renderSeries(series) {
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
    const accessor = (datum) => resolveSeriesValue(datum, series);
    const structured = (datum) => resolveSeriesStructuredValue(datum, series);
    const fieldAccessor = (field) => (datum) => structured(datum)?.[field];
    /** Resolve a per-component sub-color, falling back to fallback color */
    const sc = (key, fallback) => series.subColors?.[key] ?? fallback;
    switch (type) {
        case "Candlestick":
        case "HeikinAshi":
            return (_jsx(CandlestickSeries, { width: candleBodyWidth, yAccessor: (datum) => datum, fill: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)), stroke: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)), wickStroke: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)), candleStrokeWidth: styleOverride?.lineWidth ?? 0.5, opacity: styleOverride?.opacity ?? 0.5 }, seriesKey));
        case "HollowCandle":
            return (_jsx(CandlestickSeries, { width: candleBodyWidth, yAccessor: (datum) => datum, fill: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? "transparent" : downColor)), stroke: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)), wickStroke: ((datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor)), candleStrokeWidth: styleOverride?.lineWidth ?? 0.5, opacity: styleOverride?.opacity ?? 0.5 }, seriesKey));
        case "OHLC":
            return _jsx(OHLCSeries, { stroke: (datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor) }, seriesKey);
        case "Line":
        case "EMA":
        case "CVDApprox":
        case "CVDRealtime":
        case "StrengthRelative":
            return (_jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: lineWidth, strokeOpacity: strokeOpacity, strokeDasharray: dashArray }, seriesKey));
        case "Area":
            return (_jsx(AreaSeries, { yAccessor: accessor, stroke: lineColor, fill: fillColor, strokeWidth: lineWidth, strokeOpacity: strokeOpacity, opacity: fillOpacity, strokeDasharray: dashArray }, seriesKey));
        case "Bar":
        case "Volume":
        case "Whale":
            return (_jsx(BarSeries, { width: candleBodyWidth, yAccessor: (datum) => {
                    if (type === "Whale") {
                        const whale = resolveSeriesStructuredValue(datum, series);
                        return whale?.whaleBuyVol ?? (whale?.whaleSellVol ? -whale.whaleSellVol : undefined);
                    }
                    return accessor(datum);
                }, fill: (datum) => (styleOverride?.color ? lineColor : datum.close >= datum.open ? upColor : downColor), opacity: styleOverride?.opacity ?? (type === "Volume" ? 0.75 : 0.6) }, seriesKey));
        case "BollingerBand": {
            // Sub-colors: middle, top, bottom — apply 53% alpha to band lines for visual clarity
            const bbMidColor = sc("middle", lineColor);
            const bbTopRaw = sc("top", lineColor);
            const bbBotRaw = sc("bottom", lineColor);
            const withAlpha = (c) => c.match(/^#[0-9a-fA-F]{6}$/) ? c + "88" : c;
            return (_jsx(BollingerSeries, { yAccessor: (datum) => resolveSeriesStructuredValue(datum, series), stroke: { top: withAlpha(bbTopRaw), middle: bbMidColor, bottom: withAlpha(bbBotRaw) }, fill: fillColor, opacity: styleOverride?.opacity ?? 0.12 }, seriesKey));
        }
        case "RSI": {
            const rsiLine = sc("line", lineColor);
            const rsiOB = sc("overbought", "#f23645");
            const rsiMid = sc("middle", "#9ca3af");
            const rsiOS = sc("oversold", "#089981");
            return (_jsx(RSISeries, { yAccessor: (datum) => resolveSeriesValue(datum, series), stroke: {
                    top: rsiOB,
                    middle: rsiMid,
                    bottom: rsiOS,
                    outsideThreshold: rsiLine,
                    insideThreshold: rsiLine,
                }, opacity: { top: 0.5, middle: 0.4, bottom: 0.5 }, strokeDasharray: { line: dashArray, top: "ShortDash", middle: "ShortDash", bottom: "ShortDash" }, strokeWidth: {
                    outsideThreshold: lineWidth,
                    insideThreshold: lineWidth,
                    top: 1,
                    middle: 1,
                    bottom: 1,
                } }, seriesKey));
        }
        case "MACD": {
            const macdColor = sc("macd", lineColor);
            const signalColor = sc("signal", "#ff6d00");
            const divergeColor = sc("diverge", "#26a69a");
            return _jsx(MACDSeries, { yAccessor: (datum) => resolveSeriesStructuredValue(datum, series), stroke: { macd: macdColor, signal: signalColor }, fill: { divergence: divergeColor }, opacity: strokeOpacity }, seriesKey);
        }
        case "KDJ": {
            const kColor = sc("k", lineColor);
            const dColor = sc("d", "#ff6d00");
            const jColor = sc("j", "#26a69a");
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("k"), stroke: kColor, strokeWidth: 1.2 }, `${type}-k`), _jsx(LineSeries, { yAccessor: fieldAccessor("d"), stroke: dColor, strokeWidth: 1.2 }, `${type}-d`), _jsx(LineSeries, { yAccessor: fieldAccessor("j"), stroke: jColor, strokeWidth: 1.2 }, `${type}-j`), _jsx(StraightLine, { stroke: kColor, opacity: 0.35, yValue: 80, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: kColor, opacity: 0.35, yValue: 50, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: kColor, opacity: 0.35, yValue: 20, strokeDasharray: "ShortDash" })] }, seriesKey));
        }
        case "CCI":
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: 1.2 }, `${type}-line`), _jsx(StraightLine, { stroke: lineColor, opacity: 0.35, yValue: 100, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: lineColor, opacity: 0.35, yValue: 0, strokeDasharray: "ShortDash" }), _jsx(StraightLine, { stroke: lineColor, opacity: 0.35, yValue: -100, strokeDasharray: "ShortDash" })] }, seriesKey));
        case "DMI": {
            const plusColor = sc("plusDI", "#089981");
            const minusColor = sc("minusDI", "#f23645");
            const adxColor = sc("adx", lineColor);
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("plusDI"), stroke: plusColor, strokeWidth: 1.2 }, `${type}-plus`), _jsx(LineSeries, { yAccessor: fieldAccessor("minusDI"), stroke: minusColor, strokeWidth: 1.2 }, `${type}-minus`), _jsx(LineSeries, { yAccessor: fieldAccessor("adx"), stroke: adxColor, strokeWidth: 1.2 }, `${type}-adx`)] }, seriesKey));
        }
        case "BIAS":
            return _jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: 1.2 }, type);
        case "BRAR": {
            const arColor = sc("ar", lineColor);
            const brColor = sc("br", "#ff6d00");
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("ar"), stroke: arColor, strokeWidth: 1.2 }, `${type}-ar`), _jsx(LineSeries, { yAccessor: fieldAccessor("br"), stroke: brColor, strokeWidth: 1.2 }, `${type}-br`)] }, seriesKey));
        }
        case "MTM": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("mtm"), stroke: sc("mtm", lineColor), strokeWidth: 1.2 }, `${type}-mtm`), _jsx(LineSeries, { yAccessor: fieldAccessor("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: 1.2 }, `${type}-signal`)] }, seriesKey));
        }
        case "EMV": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("emv"), stroke: sc("emv", lineColor), strokeWidth: 1.2 }, `${type}-emv`), _jsx(LineSeries, { yAccessor: fieldAccessor("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: 1.2 }, `${type}-signal`)] }, seriesKey));
        }
        case "AO":
            return (_jsx(BarSeries, { width: candleBodyWidth, yAccessor: accessor, fill: (datum) => datum.aoColor ?? lineColor, opacity: 0.85 }, seriesKey));
        case "ROC":
            return _jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: 1.2 }, type);
        case "TRIX": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("trix"), stroke: sc("trix", lineColor), strokeWidth: 1.2 }, `${type}-trix`), _jsx(LineSeries, { yAccessor: fieldAccessor("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: 1.2 }, `${type}-signal`)] }, seriesKey));
        }
        case "DMA": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("ddd"), stroke: sc("ddd", lineColor), strokeWidth: 1.2 }, `${type}-ddd`), _jsx(LineSeries, { yAccessor: fieldAccessor("ama"), stroke: sc("ama", "#ff6d00"), strokeWidth: 1.2 }, `${type}-ama`)] }, seriesKey));
        }
        case "PVT":
            return _jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: 1.2 }, type);
        case "PSY": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("psy"), stroke: sc("psy", lineColor), strokeWidth: 1.2 }, `${type}-psy`), _jsx(LineSeries, { yAccessor: fieldAccessor("signal"), stroke: sc("signal", "#ff6d00"), strokeWidth: 1.2 }, `${type}-signal`)] }, seriesKey));
        }
        case "CR": {
            return (_jsxs("g", { children: [_jsx(LineSeries, { yAccessor: fieldAccessor("cr"), stroke: sc("cr", lineColor), strokeWidth: 1.2 }, `${type}-cr`), _jsx(LineSeries, { yAccessor: fieldAccessor("ma1"), stroke: sc("ma1", "#ff6d00"), strokeWidth: 1.1 }, `${type}-ma1`), _jsx(LineSeries, { yAccessor: fieldAccessor("ma2"), stroke: sc("ma2", "#26a69a"), strokeWidth: 1.1 }, `${type}-ma2`), _jsx(LineSeries, { yAccessor: fieldAccessor("ma3"), stroke: sc("ma3", "#f23645"), strokeWidth: 1.1 }, `${type}-ma3`), _jsx(LineSeries, { yAccessor: fieldAccessor("ma4"), stroke: sc("ma4", "#9ca3af"), strokeWidth: 1.1 }, `${type}-ma4`)] }, seriesKey));
        }
        case "StrengthElder": {
            return (_jsx(ElderRaySeries, { yAccessor: (datum) => resolveSeriesStructuredValue(datum, series), bullPowerFill: sc("bull", "#089981"), bearPowerFill: sc("bear", "#f23645"), straightLineStroke: lineColor, straightLineOpacity: strokeOpacity, opacity: fillOpacity }, seriesKey));
        }
        default:
            return _jsx(LineSeries, { yAccessor: accessor, stroke: lineColor, strokeWidth: lineWidth, strokeOpacity: strokeOpacity, strokeDasharray: dashArray }, seriesKey);
    }
}
/** Adaptive tooltip date format based on visible bar count. */
function inferMinimumPositiveDateDiffMs(data) {
    if (data.length < 2) {
        return null;
    }
    let minDiff = Number.POSITIVE_INFINITY;
    for (let index = 1; index < Math.min(data.length, 30); index += 1) {
        const previousBar = data[index - 1];
        const currentBar = data[index];
        const previousMs = previousBar.date instanceof Date ? previousBar.date.valueOf() : previousBar.date;
        const currentMs = currentBar.date instanceof Date ? currentBar.date.valueOf() : currentBar.date;
        const diff = currentMs - previousMs;
        if (diff > 0 && diff < minDiff) {
            minDiff = diff;
        }
    }
    return Number.isFinite(minDiff) ? minDiff : null;
}
function createSmartDateFormatter(data, fallbackDateFormat) {
    const visibleBarCount = Math.max(1, data.length);
    const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
    const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;
    if (!isIntraday) {
        return timeFormat("%d/%m/%Y");
    }
    if (visibleBarCount <= 50)
        return timeFormat("%H:%M:%S");
    if (visibleBarCount <= 120)
        return timeFormat("%H:%M");
    if (visibleBarCount <= 300)
        return timeFormat("%m-%d %H:%M");
    return fallbackDateFormat;
}
/**
 * KlineChart-style X-axis tick formatter.
 * Auto-detects intraday vs. daily and shows month/day/time boundaries.
 */
function createKlineXAxisFormatter(data) {
    if (data.length < 2)
        return () => "";
    const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
    const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;
    const monthYearFmt = timeFormat("%m-%Y");
    const dayMonthFmt = timeFormat("%d-%m");
    const hourMinFmt = timeFormat("%H:%M");
    return (value) => {
        const d = value instanceof Date ? value : new Date(value);
        const date = d.getDate();
        const hour = d.getHours();
        const min = d.getMinutes();
        if (isIntraday) {
            if (date === 1 && hour === 0 && min === 0)
                return monthYearFmt(d);
            if (hour === 0 && min === 0)
                return dayMonthFmt(d);
            return hourMinFmt(d);
        }
        // Daily+
        if (date === 1)
            return monthYearFmt(d);
        return dayMonthFmt(d);
    };
}
function renderDynamicChartChildren({ panes, heights, data, xAccessor, axisStroke, axisTickFill, isDark, dateFormat = timeFormat("%Y-%m-%d"), priceFormat = d3Format(".2f"), volumeFormat = d3Format(".3s"), className, onContextMenu, }) {
    // Compute adaptive formatters based on current data size
    const adaptiveDateFormat = createSmartDateFormatter(data, dateFormat);
    const xAxisDateFormat = createKlineXAxisFormatter(data);
    // Detect discontinuous scale (index-based) vs. time scale
    const sampleXValue = data.length > 0 ? xAccessor(data[0]) : undefined;
    const isDiscontinuousScale = typeof sampleXValue === "number";
    const chartSlots = panes.flatMap((pane) => buildChartSlots(pane).map((slot) => ({ pane, slot })));
    let chartId = 1;
    // Track how many slots have been rendered per pane (for tooltip y-stagger in splitScale panes)
    const paneSlotCounter = new Map();
    return chartSlots.flatMap(({ pane, slot }, index) => {
        const paneIndex = panes.findIndex((item) => item.id === pane.id);
        const slotInPane = paneSlotCounter.get(pane.id) ?? 0;
        paneSlotCounter.set(pane.id, slotInPane + 1);
        const isInnerPane = paneIndex > 0;
        // Inner panes get a small top gap so charts don't visually merge at splitter lines
        const gap = isInnerPane ? INNER_PANE_GAP : 0;
        const origin = (_w, h) => [
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
            (_jsxs(Chart, { id: chartId++, height: paneHeight, origin: origin, paneId: pane.id, yScaleId: yScaleId, yExtents: yExtents, className: className, onContextMenu: onContextMenu, children: [slot.hasLeftAxis ? _jsx(YAxis, { axisAt: "left", orient: "left", ticks: 5, stroke: axisStroke, tickLabelFill: axisTickFill, tickStroke: axisStroke, tickFormat: yAxisFormat }) : null, slot.hasRightAxis ? _jsx(YAxis, { axisAt: "right", orient: "right", ticks: 5, stroke: axisStroke, tickLabelFill: axisTickFill, tickStroke: axisStroke, tickFormat: yAxisFormat }) : null, pane.tooltip === "ohlc"
                        ? (_jsx(PaneTooltip, { entries: buildPriceTooltipEntries(priceFormat, volumeFormat).concat(slot.tooltipEntries), xDisplayFormat: adaptiveDateFormat, origin: [8, tooltipY], labelFill: isDark ? "#d1d4dc" : "#1e2a3b", textFill: isDark ? "#f8fafc" : "#1e2a3b" }))
                        : pane.tooltip === "none"
                            ? null
                            : _jsx(PaneTooltip, { entries: slot.tooltipEntries, xDisplayFormat: adaptiveDateFormat, origin: [8, tooltipY], labelFill: isDark ? "#d1d4dc" : "#1e2a3b", textFill: isDark ? "#f8fafc" : "#1e2a3b" }), slot.series.map((series) => renderSeries(series)), hasBottomAxis && slot === chartSlots[chartSlots.length - 1]?.slot ? (_jsx(XAxis, { axisAt: "bottom", orient: "bottom", showDomain: false, innerTickSize: 0, outerTickSize: 0, tickStroke: "transparent", tickStrokeOpacity: 0, tickStrokeWidth: 0, stroke: "transparent", tickLabelFill: axisTickFill, tickFormat: isDiscontinuousScale ? undefined : xAxisDateFormat })) : null, isLastSlot ? _jsx(MouseCoordinateX, { displayFormat: adaptiveDateFormat }) : null, _jsx(MouseCoordinateY, { rectWidth: 64, displayFormat: yAxisFormat })] }, `${pane.id}-${index}`)),
        ];
    }).concat(_jsx(CrossHairCursor, {}, "crosshair-cursor"));
}
const DynamicChartComponent = forwardRef(function DynamicChart(props, ref) {
    const { onVisibleRangeChange, ...rest } = props;
    const chartCanvasRef = useRef(null);
    const [, setStyleRevision] = useState(0);
    useEffect(() => subscribeSeriesStyleChanges(() => {
        setStyleRevision((value) => value + 1);
    }), []);
    const chartChildren = renderDynamicChartChildren(props);
    useImperativeHandle(ref, () => ({
        scrollToIndex(index, align = "center") {
            const canvas = chartCanvasRef.current;
            if (!canvas)
                return;
            const fullData = canvas.getFullData();
            const barCount = canvas.getCurrentViewportBarCount();
            const extents = computeExtentsForIndex(index, align, barCount, fullData);
            if (extents) {
                canvas.setXExtents(extents);
            }
        },
        zoomToRange(startIndex, endIndex) {
            const canvas = chartCanvasRef.current;
            if (!canvas || startIndex < 0 || endIndex < 0 || startIndex > endIndex)
                return;
            const fullData = canvas.getFullData();
            if (endIndex >= fullData.length)
                return;
            const startDate = fullData[startIndex]?.date;
            const endDate = fullData[endIndex]?.date;
            if (startDate && endDate) {
                canvas.setXExtents([startDate, endDate]);
            }
        },
        scrollToDate(date, align = "center") {
            const canvas = chartCanvasRef.current;
            if (!canvas)
                return;
            const fullData = canvas.getFullData();
            const index = fullData.findIndex((datum) => datum.date.getTime() >= date.getTime());
            if (index < 0)
                return;
            const barCount = canvas.getCurrentViewportBarCount();
            const extents = computeExtentsForIndex(index, align, barCount, fullData);
            if (extents) {
                canvas.setXExtents(extents);
            }
        },
    }), []);
    const handleVisibleRangeChange = useCallback((range) => {
        onVisibleRangeChange?.(range);
    }, [onVisibleRangeChange]);
    return (_jsxs(ChartCanvas, { ref: chartCanvasRef, height: props.height, width: props.width, margin: props.margin, type: props.type ?? "hybrid", seriesName: props.seriesName, data: props.data, xScale: props.xScale, xAccessor: props.xAccessor, displayXAccessor: props.displayXAccessor ?? props.xAccessor, xExtents: props.xExtents, ratio: props.ratio, mouseMoveEvent: props.mouseMoveEvent, panEvent: props.panEvent, zoomEvent: props.zoomEvent, useCrossHairStyleCursor: props.useCrossHairStyleCursor, defaultFocus: props.defaultFocus, disableInteraction: props.disableInteraction, className: props.className, onClick: props.onClick, onContextMenu: props.onContextMenu, onVisibleDomainChange: props.onVisibleDomainChange, onVisibleRangeChange: handleVisibleRangeChange, children: [chartChildren, props.children] }));
});
DynamicChartComponent.displayName = "DynamicChart";
export { DynamicChartComponent as DynamicChart };
