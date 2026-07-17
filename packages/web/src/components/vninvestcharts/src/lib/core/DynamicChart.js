import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { format as d3Format } from "d3-format";
import { utcFormat } from "d3-time-format";
import { formatWithTimezone, getCachedFormatter, getGlobalTimezone } from "../utils/timezoneFormatter.js";
import Chart from "../Chart.js";
import { PaneErrorBoundary } from "./ErrorBoundary.js";
import ChartCanvas from "../ChartCanvas.js";
import { XAxis, YAxis } from "../axes/index.js";
import { CrossHairCursor, MouseCoordinateX, MouseCoordinateY } from "../coordinates/index.js";
import { getSeries, getSeriesStyleOverride, subscribeSeriesStyleChanges } from "./registry/SeriesRegistry.js";
import "./registry/registerAll.js";
import { resolveSeriesValue, resolveSeriesValueAccessors } from "./seriesValueResolver.js";
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
    // Keep candle body within the current screen-space step to avoid overlap when zooming out.
    const targetWidth = stepPx * ratio;
    const maxSafeWidth = Math.max(1, Math.floor(stepPx));
    return Math.max(1, Math.min(maxSafeWidth, Math.floor(targetWidth)));
}
function renderSeries(series) {
    var type = series.type;
    var entry = getSeries(type);
    var params = Object.assign(Object.assign({}, entry.defaultParams), series.params);
    var styleOverride = getSeriesStyleOverrideForSeries(series);
    if (series.visible === false || (styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.visible) === false) {
        return null;
    }
    var lineColor = (_b = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.color) !== null && _b !== void 0 ? _b : (_c = series.color) !== null && _c !== void 0 ? _c : String(params.color !== null && params.color !== void 0 ? params.color : "#2962ff");
    var fillColor = (_d = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.color) !== null && _d !== void 0 ? _d : (_e = series.color) !== null && _e !== void 0 ? _e : String(params.fill !== null && params.fill !== void 0 ? params.fill : lineColor);
    var upColor = (_f = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.color) !== null && _f !== void 0 ? _f : String(params.upColor !== null && params.upColor !== void 0 ? params.upColor : "#089981");
    var downColor = (_g = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.color) !== null && _g !== void 0 ? _g : String(params.downColor !== null && params.downColor !== void 0 ? params.downColor : "#f23645");
    var lineWidth = (_h = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.lineWidth) !== null && _h !== void 0 ? _h : (typeof series.lineWidth === "number" && Number.isFinite(series.lineWidth) ? Math.max(1, series.lineWidth) : undefined)
        !== null && _h !== void 0 ? _h : (series.overlay ? 1.5 : 1.2);
    var strokeOpacity = (_l = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.opacity) !== null && _l !== void 0 ? _l : 1;
    var fillOpacity = (_m = styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.opacity) !== null && _m !== void 0 ? _m : 0.5;
    var dashArray = dashPatternToSeriesDasharray(styleOverride === null || styleOverride === void 0 ? void 0 : styleOverride.dashPattern);
    var seriesKey = series.id !== null && series.id !== void 0 ? series.id : type;
    var accessor = function (datum) { return resolveSeriesValue(datum, series); };
    var ctx = { type: type, params: params, styleOverride: styleOverride, series: series, lineColor: lineColor, fillColor: fillColor, upColor: upColor, downColor: downColor, lineWidth: lineWidth, strokeOpacity: strokeOpacity, fillOpacity: fillOpacity, dashArray: dashArray, seriesKey: seriesKey, accessor: accessor, candleBodyWidth: candleBodyWidth };
    var renderer = entry.renderer;
    return renderer(ctx);
}

var _b, _c, _d, _e, _f, _g, _h, _l, _m;

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
export function createSmartDateFormatter(data, fallbackDateFormat) {
    const visibleBarCount = Math.max(1, data.length);
    const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
    const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;
    return (date) => {
        if (!isIntraday) {
            return formatWithTimezone(date, { day: "2-digit", month: "2-digit", year: "numeric" });
        }
        if (visibleBarCount <= 50) {
            return formatWithTimezone(date, { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
        }
        if (visibleBarCount <= 120) {
            return formatWithTimezone(date, { hour: "2-digit", minute: "2-digit", hour12: false });
        }
        // For 121+ bars (including >300), use DD/MM HH:mm — consistent with X-axis ticks
        return formatWithTimezone(date, { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    };
}
/**
 * KlineChart-style X-axis tick formatter.
 * Auto-detects intraday vs. daily and shows month/day/time boundaries.
 */
export function createKlineXAxisFormatter(data) {
    if (data.length < 2)
        return () => "";
    const minimumDateDiffMs = inferMinimumPositiveDateDiffMs(data);
    const isIntraday = minimumDateDiffMs !== null && minimumDateDiffMs < ONE_DAY_MS;
    const formatParts = (tz, d) => {
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
    return (value) => {
        const d = value instanceof Date ? value : new Date(value);
        const tz = getGlobalTimezone();
        let parts;
        try {
            parts = formatParts(tz, d);
        }
        catch {
            // Invalid timezone string — fall back to UTC to avoid render crash
            parts = formatParts("UTC", d);
        }
        const dateMap = Object.fromEntries(parts.map(p => [p.type, p.value]));
        const date = parseInt(dateMap.day);
        const hour = parseInt(dateMap.hour);
        const min = parseInt(dateMap.minute);
        const pad = (num) => String(num).padStart(2, "0");
        if (isIntraday) {
            if (date === 1 && hour === 0 && min === 0)
                return `${pad(parseInt(dateMap.month))}-${dateMap.year}`;
            if (hour === 0 && min === 0)
                return `${pad(date)}-${pad(parseInt(dateMap.month))}`;
            return `${pad(hour)}:${pad(min)}`;
        }
        // Daily+
        if (date === 1)
            return `${pad(parseInt(dateMap.month))}-${dateMap.year}`;
        return `${pad(date)}-${pad(parseInt(dateMap.month))}`;
    };
}
function renderDynamicChartChildren({ panes, heights, data, xAccessor, axisStroke, axisTickFill, isDark, dateFormat = utcFormat("%Y-%m-%d"), priceFormat = d3Format(".2f"), volumeFormat = d3Format(".3s"), className, onContextMenu, }) {
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
            (_jsx(PaneErrorBoundary, { paneId: pane.id, children: _jsxs(Chart, { id: chartId++, height: paneHeight, origin: origin, paneId: pane.id, yScaleId: yScaleId, yExtents: yExtents, className: className, onContextMenu: onContextMenu, children: [slot.hasLeftAxis ? _jsx(YAxis, { axisAt: "left", orient: "left", ticks: 5, stroke: axisStroke, tickLabelFill: axisTickFill, tickStroke: axisStroke, tickFormat: yAxisFormat }) : null, slot.hasRightAxis ? _jsx(YAxis, { axisAt: "right", orient: "right", ticks: 5, stroke: axisStroke, tickLabelFill: axisTickFill, tickStroke: axisStroke, tickFormat: yAxisFormat }) : null, pane.tooltip === "ohlc"
                            ? (_jsx(PaneTooltip, { entries: buildPriceTooltipEntries(priceFormat, volumeFormat).concat(slot.tooltipEntries), xDisplayFormat: adaptiveDateFormat, origin: [8, tooltipY], labelFill: isDark ? "#d1d4dc" : "#1e2a3b", textFill: isDark ? "#f8fafc" : "#1e2a3b" }))
                            : pane.tooltip === "none"
                                ? null
                                : _jsx(PaneTooltip, { entries: slot.tooltipEntries, xDisplayFormat: adaptiveDateFormat, origin: [8, tooltipY], labelFill: isDark ? "#d1d4dc" : "#1e2a3b", textFill: isDark ? "#f8fafc" : "#1e2a3b" }), slot.series.map((series) => renderSeries(series)), hasBottomAxis && slot === chartSlots[chartSlots.length - 1]?.slot ? (_jsx(XAxis, { axisAt: "bottom", orient: "bottom", showDomain: false, innerTickSize: 0, outerTickSize: 0, tickStroke: "transparent", tickStrokeOpacity: 0, tickStrokeWidth: 0, stroke: "transparent", tickLabelFill: axisTickFill, tickFormat: isDiscontinuousScale ? undefined : xAxisDateFormat })) : null, isLastSlot ? _jsx(MouseCoordinateX, { displayFormat: adaptiveDateFormat }) : null, _jsx(MouseCoordinateY, { rectWidth: 64, displayFormat: yAxisFormat })] }) }, `${pane.id}-${index}`)),
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
