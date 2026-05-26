import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HistoryFetchQueue } from "./historyFetchQueue.js";
import { format } from "d3-format";
import { timeFormat } from "d3-time-format";
import { PaneHeader, PaneLabel, IndicatorLegend, useDynamicPanes, DrawingLayer, DrawingContextMenu, DrawingInspector, DrawingListPanel, useDrawingInteraction, useDrawingStorage, BarReplayController, MAGNET_TOLERANCE, ChartSplitter, useChartTheme, VNStockChart, resolveDrawingShortcut, subscribeDrawingStyleChanges, subscribeSeriesStyleChanges, widgetMessagesEn, widgetMessagesVi, } from "../index.js";
import { restorePersistedStyleOverrides, saveCurrentStyleOverrides } from "./styleOverridesPersistence.js";
import { PATTokenModal, VNSymbolSearch, WhalePanel } from "./components/index.js";
import { TIMEFRAME_MAP, VNInvestClient } from "./dataSources/VNInvestClient.js";
import { VNInvestWebSocketClient } from "./dataSources/VNInvestWebSocketClient.js";
import { useDrawingAlertEvaluator } from "../lib/drawing/useDrawingAlertEvaluator.js";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "../lib/drawing/clipboard.js";
import { enrichData } from "../lib/core/calculators/enrichData.js";
import { transformHeikinAshi } from "./heikinAshi.js";
import { getOfflineDemoBars, mergeBarsByDate } from "./demoData.js";
import { canRunHistoryScheduler } from "./historySchedulerPolicy.js";
import { binanceAdapter, LocalCacheAdapter, VNStocksAdapter } from "../lib/adapters/index.js";
import { CHART_RANGE_LABEL_KEYS, CHART_RANGES, DEFAULT_CHART_RANGE, resolveChartRangeExtents, resolveChartRangeStart } from "./chartRange.js";
import DemoPageShell from "./DemoPageShell.js";
import { useDemoI18n } from "./i18n.js";
import { resolveDemoTopbarStatusBadge } from "./topbarStatusBadge.js";
import { PaneSettingsModal } from "./PaneSettingsModal.js";
import { computeLoadedWindow, computeMissingSegments, computeTargetWindow, shouldScheduleFetch } from "./historyWindowPlanner.js";
import "./demo.css";
import "../lib/styles/pane-overlays.css";
const DEMO_SETTINGS_STORAGE_KEY = "rsc-demo-settings-v1";
const DEFAULT_MAX_VISIBLE_PANES = 5;
const DEFAULT_MAX_VISIBLE_BARS = 500;
const DEFAULT_DEMO_SETTINGS = {
    maxVisiblePanes: DEFAULT_MAX_VISIBLE_PANES,
    maxVisibleBars: DEFAULT_MAX_VISIBLE_BARS,
    showNonTradingDays: false,
    showDrawingPriceMarkers: true,
    enableWhale: true,
    whaleThreshold: 1_000_000,
    enableCVD: true,
    cvdMode: "oscillator",
};
function loadDemoSettings() {
    if (typeof localStorage === "undefined") {
        return DEFAULT_DEMO_SETTINGS;
    }
    try {
        const raw = localStorage.getItem(DEMO_SETTINGS_STORAGE_KEY);
        if (!raw) {
            return DEFAULT_DEMO_SETTINGS;
        }
        const parsed = JSON.parse(raw);
        return {
            maxVisiblePanes: typeof parsed.maxVisiblePanes === "number" && Number.isFinite(parsed.maxVisiblePanes)
                ? Math.max(1, Math.floor(parsed.maxVisiblePanes))
                : DEFAULT_MAX_VISIBLE_PANES,
            maxVisibleBars: typeof parsed.maxVisibleBars === "number" && Number.isFinite(parsed.maxVisibleBars)
                ? Math.min(2000, Math.max(100, Math.floor(parsed.maxVisibleBars)))
                : DEFAULT_MAX_VISIBLE_BARS,
            showNonTradingDays: typeof parsed.showNonTradingDays === "boolean"
                ? parsed.showNonTradingDays
                : DEFAULT_DEMO_SETTINGS.showNonTradingDays,
            showDrawingPriceMarkers: typeof parsed.showDrawingPriceMarkers === "boolean"
                ? parsed.showDrawingPriceMarkers
                : DEFAULT_DEMO_SETTINGS.showDrawingPriceMarkers,
        };
    }
    catch {
        // ignore malformed settings payloads
    }
    return DEFAULT_DEMO_SETTINGS;
}
function saveDemoSettings(settings) {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(DEMO_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    }
    catch {
        // ignore storage errors
    }
}
const VNI_SYMBOL_STORAGE_KEY = "vnsc_vni_symbol";
const VNI_TIMEFRAME_STORAGE_KEY = "vnsc_vni_timeframe";
const DAY_MS = 86_400_000;
function readStoredString(key, fallback) {
    if (typeof localStorage === "undefined") {
        return fallback;
    }
    try {
        return localStorage.getItem(key) ?? fallback;
    }
    catch {
        return fallback;
    }
}
function writeStoredValue(key, value) {
    if (typeof localStorage === "undefined") {
        return;
    }
    try {
        localStorage.setItem(key, value);
    }
    catch {
        // ignore storage errors
    }
}
function resolveTimeframeMs(timeframe) {
    switch (timeframe) {
        case "1m": return 60_000;
        case "5m": return 5 * 60_000;
        case "15m": return 15 * 60_000;
        case "1H":
        case "1h": return 60 * 60_000;
        case "2H": return 2 * 60 * 60_000;
        case "4H":
        case "4h": return 4 * 60 * 60_000;
        case "D":
        case "1D":
        case "1d": return DAY_MS;
        case "W":
        case "1W":
        case "1w": return 7 * DAY_MS;
        case "M": return 30 * DAY_MS;
        case "Y": return 365 * DAY_MS;
        default: return DAY_MS;
    }
}
function normalizeVNITimeframe(value) {
    return TIMEFRAME_MAP[value] ?? value;
}
const priceFormat = format(".2f");
const volumeFormat = format(".3s");
const dateFormat = timeFormat("%d/%m/%Y %H:%M");
function klineBarToRawOHLCV(bar) {
    return { date: new Date(bar.timestamp), open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume };
}
const BINANCE_TIMEFRAMES = ["1m", "3m", "5m", "15m", "30m", "1h", "4h"];
const VNI_TIMEFRAMES = ["1m", "5m", "15m", "1H", "2H", "4H", "D", "W"];
const CHART_TYPES = ["candlestick", "hollow", "ohlc", "heikinashi", "line", "area"];
const CANDLE_TYPE_STORAGE_KEY = "vnsc_candleType";
const CHART_TYPE_TO_SERIES = {
    candlestick: "Candlestick",
    hollow: "HollowCandle",
    ohlc: "OHLC",
    heikinashi: "HeikinAshi",
    line: "Line",
    area: "Area",
};
const MAIN_PRICE_SERIES_TYPES = ["Candlestick", "HollowCandle", "OHLC", "HeikinAshi", "Line", "Area", "Bar"];
function loadChartType() {
    if (typeof localStorage === "undefined") {
        return "candlestick";
    }
    try {
        const saved = localStorage.getItem(CANDLE_TYPE_STORAGE_KEY);
        if (saved && CHART_TYPES.includes(saved)) {
            return saved;
        }
    }
    catch {
        // ignore storage errors
    }
    return "candlestick";
}
const TOOL_GROUPS = [
    { id: "lines", tools: ["cursor", "crosshair", "trendLine", "ray", "extendedLine", "hLine", "vLine", "polyline", "arrow"] },
    { id: "fibonacci", tools: ["fibonacci", "fibExtension", "fibArc", "fibTimeZone", "fibChannel", "fibSpeedResistanceFan", "trendBasedFibTime", "fibCircles", "fibSpiral", "fibSpeedResistanceArcs", "fibWedge", "pitchfan"] },
    { id: "shapes", tools: ["rectangle", "text", "dateAndPriceRange", "longPosition", "shortPosition"] },
    { id: "patterns", tools: ["abcdPattern", "xabcdPattern", "cypherPattern", "headAndShoulders", "trianglePattern", "threeDrivesPattern", "elliottImpulse", "elliottCorrection", "elliottTriangle", "elliottDoubleCombo", "elliottTripleCombo"] },
    { id: "analysis", tools: ["channel", "parallelChannel", "pitchfork", "regressionChannel", "gannFan", "gannBox", "gannSquare", "gannSquareFixed", "cyclicLines", "timeCycles", "sineLine"] },
];
const TOOL_ICON_ALIASES = {
    xabcdPattern: "abcdPattern",
    cypherPattern: "abcdPattern",
    headAndShoulders: "polyline",
    trianglePattern: "polyline",
    threeDrivesPattern: "polyline",
    elliottImpulse: "polyline",
    elliottCorrection: "polyline",
    elliottTriangle: "polyline",
    elliottDoubleCombo: "polyline",
    elliottTripleCombo: "polyline",
    fibChannel: "fibExtension",
    fibSpeedResistanceFan: "fibExtension",
    trendBasedFibTime: "fibTimeZone",
    fibCircles: "fibArc",
    fibSpiral: "fibArc",
    fibSpeedResistanceArcs: "fibArc",
    fibWedge: "fibExtension",
    pitchfan: "pitchfork",
    gannFan: "pitchfork",
    gannBox: "rectangle",
    gannSquare: "rectangle",
    gannSquareFixed: "rectangle",
    cyclicLines: "fibTimeZone",
    timeCycles: "fibTimeZone",
    sineLine: "polyline",
};
const DRAWING_PANEL_WIDTH = 360;
const DRAWING_TOOL_FLYOUT_WIDTH = 42;
const DRAWING_TOOL_FLYOUT_BUTTON_SIZE = 32;
const DRAWING_TOOL_FLYOUT_GAP = 2;
const DRAWING_TOOL_FLYOUT_PADDING = 8;
const DRAWING_TOOL_FLYOUT_MARGIN = 8;
const MOBILE_DRAWING_TOOL_BREAKPOINT = 767;
const MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE = 44;
const REPLAY_SPEEDS = [0.5, 1, 2, 5, 10, "max"];
const PERCENT_FORMAT = format(".1%");
function isYAxisSide(value) {
    return value === "left" || value === "right";
}
function resolveDrawingPlacementForPane(sourceDrawing, targetPane) {
    if (!targetPane || targetPane.id === sourceDrawing.paneId) {
        return {
            paneId: sourceDrawing.paneId,
            yScaleId: sourceDrawing.yScaleId,
        };
    }
    const targetSides = [];
    for (const series of targetPane.series) {
        if (!targetSides.includes(series.yAxis)) {
            targetSides.push(series.yAxis);
        }
    }
    const preferredSide = isYAxisSide(sourceDrawing.yScaleId) && targetSides.includes(sourceDrawing.yScaleId)
        ? sourceDrawing.yScaleId
        : targetSides.includes("right")
            ? "right"
            : targetSides[0];
    return {
        paneId: targetPane.id,
        yScaleId: preferredSide,
    };
}
function getSelectedDrawingId(drawingState) {
    switch (drawingState.type) {
        case "selected":
        case "moving":
        case "resizing":
        case "editing":
            return drawingState.objectId;
        case "complete":
            return drawingState.object?.id;
        default:
            return undefined;
    }
}
function clonePoint(point) {
    return { x: point.x, y: point.y };
}
function sortDrawings(drawings) {
    return [...drawings].sort((left, right) => {
        const leftZ = left.zIndex ?? 0;
        const rightZ = right.zIndex ?? 0;
        if (leftZ !== rightZ) {
            return leftZ - rightZ;
        }
        return left.createdAt - right.createdAt;
    });
}
function isEditableTarget(target) {
    if (!(target instanceof HTMLElement)) {
        return false;
    }
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}
function normalizeDate(value) {
    return value instanceof Date ? value : new Date(value);
}
function formatSignedPrice(value) {
    return `${value >= 0 ? "+" : ""}${priceFormat(value)}`;
}
function formatBarsHeld(barsHeld, unitLabel) {
    return `${barsHeld} ${unitLabel}`;
}
function paneTemplate(label, heightRatio, series = [{ type: "Line", yAxis: "right" }]) {
    return {
        label,
        pinned: false,
        visible: true,
        heightRatio,
        series,
        splitScale: false,
        tooltip: "value",
    };
}
// SVG tool icons
function ToolIcon({ id }) {
    switch (TOOL_ICON_ALIASES[id] ?? id) {
        case "cursor":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M3 2l10 6.8-5.5 1.2-2.8 5.3L3 2z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }));
        case "crosshair":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "8", cy: "8", r: "3", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "1", x2: "8", y2: "4.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "11.5", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "1", y1: "8", x2: "4.5", y2: "8", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "11.5", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.4" })] }));
        case "trendLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "3", cy: "13", r: "1.5", fill: "currentColor" }), _jsx("circle", { cx: "13", cy: "3", r: "1.5", fill: "currentColor" }), _jsx("line", { x1: "4", y1: "12", x2: "12", y2: "4", stroke: "currentColor", strokeWidth: "1.5" })] }));
        case "ray":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "3", y1: "12", x2: "13", y2: "4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M10.5 4H13V6.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "extendedLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "2", y1: "12", x2: "14", y2: "4", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1.2", fill: "currentColor" }), _jsx("circle", { cx: "14", cy: "4", r: "1.2", fill: "currentColor" })] }));
        case "hLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" }), _jsx("circle", { cx: "3", cy: "8", r: "1.5", fill: "currentColor" })] }));
        case "vLine":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "8", y1: "1", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" }), _jsx("circle", { cx: "8", cy: "13", r: "1.5", fill: "currentColor" })] }));
        case "fibonacci":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "4", x2: "15", y2: "4", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "1", y1: "12", x2: "15", y2: "12", stroke: "currentColor", strokeWidth: "1" })] }));
        case "fibExtension":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "5", x2: "15", y2: "5", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("line", { x1: "1", y1: "11", x2: "15", y2: "11", stroke: "currentColor", strokeWidth: "1" }), _jsx("line", { x1: "11", y1: "3", x2: "11", y2: "13", stroke: "currentColor", strokeWidth: "1.2", strokeDasharray: "2 1" })] }));
        case "parallelChannel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "2", y1: "11", x2: "13", y2: "4", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "3", y1: "13", x2: "14", y2: "6", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" }), _jsx("line", { x1: "1", y1: "9", x2: "12", y2: "2", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" })] }));
        case "pitchfork":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "8", y1: "13", x2: "8", y2: "5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("line", { x1: "8", y1: "9", x2: "3", y2: "3", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" }), _jsx("line", { x1: "8", y1: "9", x2: "13", y2: "3", stroke: "currentColor", strokeWidth: "1.1", strokeDasharray: "3 2" })] }));
        case "abcdPattern":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("polyline", { points: "2,12 5,6 9,10 13,4", stroke: "currentColor", strokeWidth: "1.4", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1", fill: "currentColor" }), _jsx("circle", { cx: "13", cy: "4", r: "1", fill: "currentColor" })] }));
        case "fibArc":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M3 11A5 5 0 0 1 13 11", stroke: "currentColor", strokeWidth: "1.3" }), _jsx("path", { d: "M4.2 11A3.8 3.8 0 0 1 11.8 11", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" })] }));
        case "fibTimeZone":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "3", y1: "2", x2: "3", y2: "14", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("line", { x1: "6", y1: "2", x2: "6", y2: "14", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("line", { x1: "10", y1: "2", x2: "10", y2: "14", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("line", { x1: "13", y1: "2", x2: "13", y2: "14", stroke: "currentColor", strokeWidth: "1.2" })] }));
        case "regressionChannel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M2 11l11-7", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M1.5 13l11-7", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" }), _jsx("path", { d: "M2.5 9l11-7", stroke: "currentColor", strokeWidth: "1", strokeDasharray: "3 2" })] }));
        case "channel":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "1", y1: "4", x2: "15", y2: "9", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "1", y1: "8", x2: "15", y2: "13", stroke: "currentColor", strokeWidth: "1.5", strokeDasharray: "3 2" })] }));
        case "text":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", children: _jsx("text", { x: "2", y: "13", fontSize: "13", fontWeight: "700", fill: "currentColor", fontFamily: "Georgia, serif", children: "T" }) }));
        case "rectangle":
            return (_jsx("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: _jsx("rect", { x: "2", y: "3", width: "12", height: "9", rx: "1.4", stroke: "currentColor", strokeWidth: "1.4" }) }));
        case "polyline":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("polyline", { points: "2,12 5,9 8,11 12,5 14,7", stroke: "currentColor", strokeWidth: "1.5", fill: "none", strokeLinecap: "round", strokeLinejoin: "round" }), _jsx("circle", { cx: "2", cy: "12", r: "1", fill: "currentColor" }), _jsx("circle", { cx: "14", cy: "7", r: "1", fill: "currentColor" })] }));
        case "arrow":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("path", { d: "M3 12L12 3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M8.5 3H12V6.5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "dateAndPriceRange":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "3", width: "12", height: "10", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M4 6.5h8M4 9.5h5", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }));
        case "longPosition":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "4", width: "12", height: "8", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M8 11V5", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M6.2 6.8L8 5l1.8 1.8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "shortPosition":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "2", y: "4", width: "12", height: "8", rx: "1.5", stroke: "currentColor", strokeWidth: "1.2" }), _jsx("path", { d: "M8 5v6", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("path", { d: "M6.2 9.2L8 11l1.8-1.8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round", strokeLinejoin: "round" })] }));
        case "settings":
            return (_jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("circle", { cx: "8", cy: "8", r: "2.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }));
        default:
            return _jsx("span", { style: { fontSize: 11 }, children: "?" });
    }
}
export default function LibraryShowcaseDemo() {
    const { language, setLanguage, t, getPaneLabel } = useDemoI18n();
    const initialDemoSettings = useMemo(() => loadDemoSettings(), []);
    const shellRef = useRef(null);
    const [chartWidth, setChartWidth] = useState(0);
    const [chartHeight, setChartHeight] = useState(0);
    const [timeframe, setTimeframe] = useState(() => {
        try {
            const stored = typeof localStorage !== "undefined" && localStorage.getItem("vnsc_timeframe");
            if (stored && BINANCE_TIMEFRAMES.includes(stored))
                return stored;
        }
        catch { /* ignore */ }
        return "1h";
    });
    const [chartRange, setChartRange] = useState(DEFAULT_CHART_RANGE);
    const [chartType, setChartType] = useState(() => loadChartType());
    const [showPanesMenu, setShowPanesMenu] = useState(false);
    const panesMenuRef = useRef(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);
    const [activeSource, setActiveSource] = useState("binance");
    const activeSourceRef = useRef(activeSource);
    const [activeTool, setActiveTool] = useState("cursor");
    const [openGroupId, setOpenGroupId] = useState(null);
    const toolbarRef = useRef(null);
    const [magnetSensitivity, setMagnetSensitivity] = useState(() => {
        try {
            return (typeof localStorage !== "undefined" && localStorage.getItem("vnsc_magnet")) || "normal";
        }
        catch {
            return "normal";
        }
    });
    const [dataAdapterName, setDataAdapterName] = useState(() => {
        try {
            return (typeof localStorage !== "undefined" && localStorage.getItem("vnsc_dataAdapter")) || "binance";
        }
        catch {
            return "binance";
        }
    });
    const [offlineBars, setOfflineBars] = useState(null);
    const [offlineSymbol, setOfflineSymbol] = useState("BTCUSDT");
    const [vniSymbol, setVniSymbol] = useState(() => readStoredString(VNI_SYMBOL_STORAGE_KEY, "VCB"));
    /** M-05: Metadata for the currently-selected VNInvest symbol (company name + exchange). */
    const [vniSymbolMeta, setVniSymbolMeta] = useState(null);
    const [vniTimeframe, setVniTimeframe] = useState(() => {
        const stored = readStoredString(VNI_TIMEFRAME_STORAGE_KEY, "D");
        return VNI_TIMEFRAMES.includes(stored) ? stored : "D";
    });
    const [patModalOpen, setPatModalOpen] = useState(false);
    const [patModalInitialTab, setPatModalInitialTab] = useState("paste");
    const [vniLoading, setVniLoading] = useState(false);
    const [vniError, setVniError] = useState(null);
    const [vniHasPAT, setVniHasPAT] = useState(() => {
        try {
            return typeof localStorage !== "undefined" && Boolean(localStorage.getItem("vni_pat"));
        }
        catch {
            return false;
        }
    });
    const [vniConfigVersion, setVniConfigVersion] = useState(0);
    const [whaleData, setWhaleData] = useState(null);
    /** H-06: Order flow data (CVD series + dark flow strength) from VNInvest API. */
    const [orderFlowData, setOrderFlowData] = useState(null);
    const vniClientRef = useRef(null);
    if (vniClientRef.current === null) {
        vniClientRef.current = new VNInvestClient();
    }
    /** WS client for live ticker updates (N-04). Created/destroyed when source/PAT changes. */
    const vniWsRef = useRef(null);
    const handleVniConfigChange = useCallback(() => {
        vniWsRef.current?.destroy();
        vniWsRef.current = null;
        setVniConfigVersion((current) => current + 1);
    }, []);
    /** Stable refs for VNI state — avoids stale closures in memoized callbacks. */
    const vniSnapshotIdRef = useRef(null);
    const vniSymbolRef = useRef(vniSymbol);
    const vniTimeframeRef = useRef(vniTimeframe);
    const [selectedPaneId, setSelectedPaneId] = useState("price");
    const [settingsSection, setSettingsSection] = useState("layout");
    const [settingsPaneId, setSettingsPaneId] = useState("price");
    const [maxVisiblePanes, setMaxVisiblePanes] = useState(initialDemoSettings.maxVisiblePanes);
    const [maxVisibleBars, setMaxVisibleBars] = useState(initialDemoSettings.maxVisibleBars);
    const [showNonTradingDays, setShowNonTradingDays] = useState(initialDemoSettings.showNonTradingDays);
    const [showDrawingPriceMarkers, setShowDrawingPriceMarkers] = useState(initialDemoSettings.showDrawingPriceMarkers);
    const [enableWhale, setEnableWhale] = useState(initialDemoSettings.enableWhale ?? true);
    const [whaleThreshold, setWhaleThreshold] = useState(initialDemoSettings.whaleThreshold ?? 1_000_000);
    const [enableCVD, setEnableCVD] = useState(initialDemoSettings.enableCVD ?? true);
    const [cvdMode, setCVDMode] = useState(initialDemoSettings.cvdMode ?? "oscillator");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showReplayBar, setShowReplayBar] = useState(false);
    const [showDrawingList, setShowDrawingList] = useState(false);
    const [drawingContextMenu, setDrawingContextMenu] = useState(null);
    const [drawingTextDraft, setDrawingTextDraft] = useState("");
    const [paperTradePosition, setPaperTradePosition] = useState(null);
    const [paperTradeHistory, setPaperTradeHistory] = useState([]);
    const chartRangeRef = useRef(chartRange);
    const paperTradePositionRef = useRef(null);
    const lastPaperTradeClickRef = useRef(null);
    const lastPaperTradeSignatureRef = useRef(null);
    const drawingInteraction = useDrawingInteraction();
    const { undo, redo, deleteSelected, cancelDrawing, selectObject, replaceDrawings, updateDrawing } = drawingInteraction;
    const drawingClipboardRef = useRef(null);
    const importInputRef = useRef(null);
    const openPATModal = useCallback((initialTab = "paste") => {
        setPatModalInitialTab(initialTab);
        setPatModalOpen(true);
    }, []);
    const handleLoadDrawings = useCallback((drawings) => {
        drawingInteraction.dispatch({ type: "REPLACE", drawings });
    }, [drawingInteraction.dispatch]);
    const chartTimeframe = activeSource === "vninvest" ? vniTimeframe : timeframe;
    const selectedSymbol = useMemo(() => {
        if (activeSource === "vninvest") {
            return vniSymbol;
        }
        if (activeSource === "offline") {
            return offlineSymbol;
        }
        return "BTCUSDT";
    }, [activeSource, offlineSymbol, vniSymbol]);
    const drawingStorage = useDrawingStorage(selectedSymbol, chartTimeframe, drawingInteraction.allDrawings, handleLoadDrawings);
    const { theme, toggleTheme, isDark } = useChartTheme("light");
    const canvasBg = "var(--gc-surface)";
    const closeDrawingContextMenu = useCallback(() => setDrawingContextMenu(null), []);
    // Live Binance data state
    const [liveData, setLiveData] = useState([]);
    const [dataStatus, setDataStatus] = useState("loading");
    const [dataError, setDataError] = useState("");
    const [historyStatus, setHistoryStatus] = useState("idle");
    const topbarStatusBadge = resolveDemoTopbarStatusBadge({
        activeSource,
        dataStatus,
        dataError,
        vniError,
        t,
    });
    const [visibleDomain, setVisibleDomain] = useState(null);
    const liveDataRef = useRef([]);
    const backfillInFlightRef = useRef(false);
    const warmupInFlightRef = useRef(false);
    const initialWarmupRequestedRef = useRef(false);
    const backfillDebounceRef = useRef(null);
    const mountedRef = useRef(true);
    const visibleDomainRef = useRef(null);
    const lastViewportMissingRef = useRef(null);
    const queueRef = useRef(new HistoryFetchQueue());
    const schedulerGenerationRef = useRef(0);
    const vniRequestIdRef = useRef(0);
    const BACKFILL_PAGE_LIMIT = 1000;
    const BACKFILL_MAX_PAGES = 20;
    const INITIAL_HISTORY_TARGET_BARS = 5000;
    const INITIAL_HISTORY_MAX_PAGES = 8;
    const SCHEDULER_TICK_MS = 250;
    const localCacheAdapter = useMemo(() => {
        const adapter = new LocalCacheAdapter();
        if (offlineBars && offlineBars.length > 0) {
            adapter.loadBars(offlineSymbol, timeframe, offlineBars);
        }
        else {
            const bars = getOfflineDemoBars().map((b) => ({
                timestamp: b.date.valueOf(), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
            }));
            adapter.loadBars("BTCUSDT", timeframe, bars);
        }
        return adapter;
    }, [timeframe, offlineBars, offlineSymbol]);
    const dataAdapter = useMemo(() => {
        if (activeSource === "offline")
            return localCacheAdapter;
        if (dataAdapterName === "vnstocks")
            return new VNStocksAdapter();
        return binanceAdapter;
    }, [activeSource, dataAdapterName, localCacheAdapter]);
    useEffect(() => {
        liveDataRef.current = liveData;
    }, [liveData]);
    useEffect(() => {
        chartRangeRef.current = chartRange;
    }, [chartRange]);
    useEffect(() => {
        if (typeof localStorage === "undefined") {
            return;
        }
        try {
            localStorage.setItem(CANDLE_TYPE_STORAGE_KEY, chartType);
        }
        catch {
            // ignore storage errors
        }
    }, [chartType]);
    useEffect(() => {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("vnsc_timeframe", timeframe);
            }
        }
        catch {
            // ignore storage errors
        }
    }, [timeframe]);
    useEffect(() => () => {
        mountedRef.current = false;
        if (backfillDebounceRef.current !== null) {
            clearTimeout(backfillDebounceRef.current);
            backfillDebounceRef.current = null;
        }
    }, []);
    const paneState = useDynamicPanes(chartHeight, { maxVisiblePanes });
    const visiblePanes = paneState.visiblePanes;
    const paneHeights = paneState.heights;
    const [widgetPaneSnapshots, setWidgetPaneSnapshots] = useState([]);
    const [widgetRuntimeCapabilities, setWidgetRuntimeCapabilities] = useState(null);
    const available = paneState.available;
    const addPane = paneState.addPane;
    const applyDelta = paneState.applyDelta;
    const resetToDefault = paneState.resetToDefault;
    const handleExportDrawings = useCallback(() => {
        drawingStorage.exportJSON();
    }, [drawingStorage]);
    const handleImportButtonClick = useCallback(() => {
        importInputRef.current?.click();
    }, []);
    const handleClearDrawings = useCallback(() => {
        drawingStorage.clearAll();
    }, [drawingStorage]);
    const handleImportFileChange = useCallback(async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        await drawingStorage.importJSON(file);
        event.target.value = "";
    }, [drawingStorage]);
    const drawingInspectorLabels = useMemo(() => ({
        title: t("drawing.inspectorTitle"),
        stroke: t("drawing.stroke"),
        fill: t("drawing.fill"),
        strokeWidth: t("drawing.strokeWidth"),
        lineStyle: t("drawing.lineStyle"),
        opacity: t("drawing.opacity"),
        solid: t("drawing.solid"),
        dashed: t("drawing.dashed"),
        dotted: t("drawing.dotted"),
        lock: t("drawing.lock"),
        unlock: t("drawing.unlock"),
        clone: t("drawing.clone"),
        hide: t("drawing.hide"),
        show: t("drawing.show"),
        bringToFront: t("drawing.bringToFront"),
        sendToBack: t("drawing.sendToBack"),
        delete: t("drawing.delete"),
        close: t("drawing.close"),
        lineTypeLabel: t("drawing.lineType.label"),
        lineTypeTrendLine: t("drawing.lineType.trendLine"),
        lineTypeRay: t("drawing.lineType.ray"),
        lineTypeExtendedLine: t("drawing.lineType.extendedLine"),
        saveStyle: t("drawing.inspector.saveStyle"),
        fibLevelsTitle: t("drawing.fib.levelsTitle"),
        fibAddLevel: t("drawing.fib.addLevel"),
        fibRemoveLevel: t("drawing.fib.removeLevel"),
        alertTitle: t("drawing.alert.title"),
        alertEnabled: t("drawing.alert.enabled"),
        alertDirection: t("drawing.alert.direction"),
        alertCooldown: t("drawing.alert.cooldown"),
        alertCrossAbove: t("drawing.alert.crossAbove"),
        alertCrossBelow: t("drawing.alert.crossBelow"),
        alertEither: t("drawing.alert.either"),
    }), [t]);
    const liveMeasurementLabels = useMemo(() => ({
        priceDeltaPrefix: t("drawing.measure.priceDeltaPrefix"),
        barsLabel: t("drawing.measure.barsLabel"),
    }), [t]);
    const drawingListPanelLabels = useMemo(() => ({
        title: t("drawing.drawingsList"),
        empty: t("drawing.drawingsListEmpty"),
        visible: t("drawing.visible"),
        hidden: t("drawing.hidden"),
        locked: t("drawing.locked"),
        unlocked: t("drawing.unlocked"),
        selected: t("drawing.selected"),
        delete: t("drawing.delete"),
    }), [t]);
    const handleAddPane = useCallback(() => {
        addPane({
            label: t("library.genericPaneLabel", { index: paneState.panes.length + 1 }),
            pinned: false,
            visible: true,
            heightRatio: 0.2,
            splitScale: false,
            tooltip: "value",
            series: [],
        });
    }, [addPane, paneState.panes.length, t]);
    const selectDrawingById = useCallback((id) => {
        selectObject(id);
        setActiveTool("cursor");
    }, [selectObject]);
    const toggleDrawingVisibleById = useCallback((id) => {
        const target = drawingInteraction.allDrawings.find((drawing) => drawing.id === id);
        if (!target) {
            return;
        }
        updateDrawing(id, { visible: target.visible === false });
    }, [drawingInteraction.allDrawings, updateDrawing]);
    const toggleDrawingLockedById = useCallback((id) => {
        const target = drawingInteraction.allDrawings.find((drawing) => drawing.id === id);
        if (!target) {
            return;
        }
        updateDrawing(id, { locked: !target.locked });
    }, [drawingInteraction.allDrawings, updateDrawing]);
    const deleteDrawingById = useCallback((id) => {
        const nextDrawings = drawingInteraction.allDrawings.filter((drawing) => drawing.id !== id);
        replaceDrawings(nextDrawings);
        if (getSelectedDrawingId(drawingInteraction.drawingState) === id) {
            cancelDrawing();
        }
    }, [cancelDrawing, drawingInteraction.allDrawings, drawingInteraction.drawingState, replaceDrawings]);
    useEffect(() => {
        restorePersistedStyleOverrides();
    }, []);
    useEffect(() => {
        const persistStyleOverrides = () => {
            saveCurrentStyleOverrides();
        };
        persistStyleOverrides();
        const unsubscribeSeries = subscribeSeriesStyleChanges(persistStyleOverrides);
        const unsubscribeDrawings = subscribeDrawingStyleChanges(persistStyleOverrides);
        return () => {
            unsubscribeSeries();
            unsubscribeDrawings();
        };
    }, []);
    useEffect(() => {
        saveDemoSettings({
            maxVisiblePanes,
            maxVisibleBars,
            showNonTradingDays,
            showDrawingPriceMarkers,
            enableWhale,
            whaleThreshold,
            enableCVD,
            cvdMode,
        });
    }, [maxVisibleBars, maxVisiblePanes, showNonTradingDays, showDrawingPriceMarkers, enableWhale, whaleThreshold, enableCVD, cvdMode]);
    useEffect(() => {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("vnsc_magnet", magnetSensitivity);
            }
        }
        catch {
            // ignore storage errors
        }
    }, [magnetSensitivity]);
    useEffect(() => {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("vnsc_dataAdapter", dataAdapterName);
            }
        }
        catch {
            // ignore storage errors
        }
    }, [dataAdapterName]);
    useEffect(() => {
        writeStoredValue(VNI_SYMBOL_STORAGE_KEY, vniSymbol);
        vniSymbolRef.current = vniSymbol;
    }, [vniSymbol]);
    useEffect(() => {
        writeStoredValue(VNI_TIMEFRAME_STORAGE_KEY, vniTimeframe);
        vniTimeframeRef.current = vniTimeframe;
    }, [vniTimeframe]);
    useEffect(() => {
        activeSourceRef.current = activeSource;
    }, [activeSource]);
    const normalizeDomain = useCallback((domain) => {
        return [normalizeDate(domain[0]), normalizeDate(domain[1])];
    }, []);
    const handleSourceSwitch = useCallback((source) => {
        setActiveSource(source);
        if (source === "vninvest" && !vniHasPAT) {
            openPATModal("login");
            return;
        }
        if (source === "offline") {
            // always open modal so user can load a file
            openPATModal("paste");
            return;
        }
        if (source === "binance") {
            setVniError(null);
            setWhaleData(null);
            setPatModalOpen(false);
            return;
        }
        setPatModalOpen(false);
    }, [openPATModal, vniHasPAT]);
    const handleTimeframeChange = useCallback((nextTimeframe) => {
        if (activeSourceRef.current === "vninvest") {
            setVniTimeframe(nextTimeframe);
            return;
        }
        setTimeframe(nextTimeframe);
    }, []);
    const handleFileLoaded = useCallback((bars, filename) => {
        const sym = filename.replace(/\.[^.]+$/, "").toUpperCase().slice(0, 10) || "LOCAL";
        setOfflineBars(bars);
        setOfflineSymbol(sym);
        setPatModalOpen(false);
    }, []);
    const handleVniSymbolChange = useCallback((nextSymbol) => {
        setVniSymbol(nextSymbol.trim().toUpperCase());
        setVniError(null);
    }, []);
    const handlePATSaved = useCallback((hasToken) => {
        setVniHasPAT(hasToken);
        setPatModalOpen(false);
        if (!hasToken) {
            setWhaleData(null);
            setVniError(null);
            if (activeSourceRef.current === "vninvest") {
                setLiveData([]);
                setVisibleDomain(null);
            }
        }
    }, []);
    /** N-04: Update the last bar's close/high/low with the live WS price (no re-fetch). */
    const handleTickerUpdate = useCallback((event) => {
        if (!mountedRef.current || activeSourceRef.current !== "vninvest") {
            return;
        }
        const newPrice = event.price;
        if (!Number.isFinite(newPrice) || newPrice <= 0) {
            return;
        }
        setLiveData((current) => {
            if (current.length === 0) {
                return current;
            }
            const last = current[current.length - 1];
            const newHigh = Math.max(last.high, newPrice);
            const newLow = Math.min(last.low, newPrice);
            // Skip re-render if nothing changed
            if (last.close === newPrice && last.high === newHigh && last.low === newLow) {
                return current;
            }
            return [...current.slice(0, -1), { ...last, close: newPrice, high: newHigh, low: newLow }];
        });
    }, []);
    /** N-04: Manage WS lifecycle — connect when VNI+PAT active, destroy on switch. */
    useEffect(() => {
        if (activeSource !== "vninvest" || !vniHasPAT) {
            vniWsRef.current?.destroy();
            vniWsRef.current = null;
            return;
        }
        const pat = vniClientRef.current?.getPAT?.() ?? "";
        if (!pat) {
            return;
        }
        // Destroy stale client if PAT changed
        const existing = vniWsRef.current;
        if (existing && !existing.destroyed) {
            existing.setOnTickerUpdate(handleTickerUpdate);
            existing.subscribe([vniSymbol]);
            return;
        }
        const ws = new VNInvestWebSocketClient(pat, vniClientRef.current?.getBase());
        ws.setOnTickerUpdate(handleTickerUpdate);
        ws.connect();
        ws.subscribe([vniSymbol]);
        vniWsRef.current = ws;
        return () => {
            ws.destroy();
            vniWsRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSource, handleTickerUpdate, vniConfigVersion, vniHasPAT, vniSymbol]);
    /** N-04: Subscribe to the current symbol when it changes while WS is open. */
    useEffect(() => {
        const ws = vniWsRef.current;
        if (ws && !ws.destroyed && activeSource === "vninvest") {
            ws.subscribe([vniSymbol]);
        }
    }, [vniSymbol, activeSource]);
    /** N-04: Destroy WS on component unmount. */
    useEffect(() => {
        return () => {
            vniWsRef.current?.destroy();
            vniWsRef.current = null;
        };
    }, []);
    /** H-06: Poll order-flow API every 60 s while VNI source is active with valid PAT. */
    useEffect(() => {
        if (activeSource !== "vninvest" || !vniHasPAT) {
            setOrderFlowData(null);
            return;
        }
        const client = vniClientRef.current;
        if (!client)
            return;
        let cancelled = false;
        const fetchOrderFlow = async () => {
            try {
                const symbol = vniSymbolRef.current.trim().toUpperCase();
                if (!symbol)
                    return;
                const data = await client.getOrderFlow(symbol, "30m");
                if (!cancelled && data)
                    setOrderFlowData(data);
            }
            catch { /* non-fatal — order flow is supplementary data */ }
        };
        void fetchOrderFlow();
        const intervalId = setInterval(() => { void fetchOrderFlow(); }, 60_000);
        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSource, vniHasPAT, vniSymbol]);
    const handleLoadVNIChart = useCallback(async (overrideSymbol) => {
        const client = vniClientRef.current;
        if (!client) {
            return;
        }
        const requestId = vniRequestIdRef.current + 1;
        vniRequestIdRef.current = requestId;
        const symbol = (overrideSymbol ?? vniSymbol).trim().toUpperCase();
        if (!symbol) {
            const message = t("vninvest.error.noData");
            setLiveData([]);
            setVisibleDomain(null);
            setVniError(message);
            setDataError(message);
            setWhaleData(null);
            setDataStatus("error");
            return;
        }
        if (!client.hasPAT()) {
            const message = t("vninvest.error.noPAT");
            setVniHasPAT(false);
            setLiveData([]);
            setVisibleDomain(null);
            setVniError(message);
            setDataError(message);
            setWhaleData(null);
            setDataStatus("error");
            return;
        }
        setVniLoading(true);
        setVniError(null);
        setWhaleData(null);
        setDataError("");
        setHistoryStatus("idle");
        setDataStatus("loading");
        setLiveData([]);
        setVisibleDomain(null);
        queueRef.current.clearAll();
        schedulerGenerationRef.current += 1;
        backfillInFlightRef.current = false;
        vniSnapshotIdRef.current = null;
        try {
            const to = Date.now();
            const from = resolveChartRangeStart(new Date(to), chartRangeRef.current).valueOf();
            const page = await client.getBarsPage({
                type: "init",
                symbol,
                timeframe: normalizeVNITimeframe(vniTimeframe),
                from,
                to,
                limit: BACKFILL_PAGE_LIMIT,
            });
            if (!mountedRef.current || activeSourceRef.current !== "vninvest" || vniRequestIdRef.current !== requestId) {
                return;
            }
            if (page.bars.length === 0) {
                throw new Error("NO_DATA");
            }
            vniSnapshotIdRef.current = page.snapshotId;
            setLiveData(page.bars);
            setVisibleDomain(resolveChartRangeExtents(page.bars, chartRangeRef.current));
            setDataStatus("live");
            setDataError("");
            const nextWhaleData = await client.getWhaleFeed(symbol).catch(() => null);
            if (!mountedRef.current || activeSourceRef.current !== "vninvest" || vniRequestIdRef.current !== requestId) {
                return;
            }
            setWhaleData(nextWhaleData);
            setVniHasPAT(client.hasPAT());
        }
        catch (err) {
            if (!mountedRef.current || activeSourceRef.current !== "vninvest" || vniRequestIdRef.current !== requestId) {
                return;
            }
            const message = err instanceof Error ? err.message : String(err);
            const localizedMessage = message === "TOKEN_EXPIRED"
                ? t("vninvest.error.tokenExpired")
                : message === "SYMBOL_NOT_FOUND"
                    ? t("vninvest.error.noData")
                    : message === "NO_DATA"
                        ? t("vninvest.error.authenticatedNoData")
                        : t("vninvest.status.error");
            setVniError(localizedMessage);
            setDataError(localizedMessage);
            setWhaleData(null);
            setDataStatus("error");
        }
        finally {
            if (mountedRef.current && vniRequestIdRef.current === requestId) {
                setVniLoading(false);
            }
        }
    }, [t, vniSymbol, vniTimeframe]);
    const requestOlderHistoryPage = useCallback(async () => {
        // ── VNInvest path (N-03) — cursor-paged /bars/ endpoint ──────────────
        if (activeSourceRef.current === "vninvest") {
            const currentBars = liveDataRef.current;
            if (backfillInFlightRef.current || currentBars.length === 0) {
                return;
            }
            const client = vniClientRef.current;
            if (!client?.hasPAT()) {
                return;
            }
            backfillInFlightRef.current = true;
            setHistoryStatus("backfilling");
            try {
                const page = await client.getBarsPage({
                    type: "backward",
                    symbol: vniSymbolRef.current.trim().toUpperCase(),
                    timeframe: normalizeVNITimeframe(vniTimeframeRef.current),
                    before: normalizeDate(currentBars[0].date).valueOf(),
                    limit: BACKFILL_PAGE_LIMIT,
                    snapshotId: vniSnapshotIdRef.current ?? undefined,
                });
                if (!mountedRef.current || activeSourceRef.current !== "vninvest") {
                    return;
                }
                if (page.snapshotId)
                    vniSnapshotIdRef.current = page.snapshotId;
                if (page.bars.length > 0) {
                    setLiveData((previous) => mergeBarsByDate(page.bars, previous));
                }
            }
            catch {
                // swallow — backfill failures are non-fatal
            }
            finally {
                backfillInFlightRef.current = false;
                lastViewportMissingRef.current = null;
                if (mountedRef.current) {
                    setHistoryStatus("idle");
                }
            }
            return;
        }
        // ── Binance / offline path ────────────────────────────────────────────
        if (!canRunHistoryScheduler({
            activeSource: activeSourceRef.current,
            warmupInFlight: warmupInFlightRef.current,
            backfillInFlight: backfillInFlightRef.current,
            liveBarsLength: liveDataRef.current.length,
        })) {
            return;
        }
        const earliestBar = liveDataRef.current[0];
        if (!earliestBar) {
            return;
        }
        backfillInFlightRef.current = true;
        setHistoryStatus("backfilling");
        try {
            const { bars: olderBarRaw } = await dataAdapter.getBars({
                type: "backward",
                symbol: "BTCUSDT",
                interval: timeframe,
                limit: BACKFILL_PAGE_LIMIT,
                timestamp: earliestBar.date.valueOf(),
            });
            const olderBars = olderBarRaw.map(klineBarToRawOHLCV);
            if (!mountedRef.current || olderBars.length === 0) {
                return;
            }
            setLiveData((current) => mergeBarsByDate(olderBars, current));
        }
        catch (err) {
            if (!mountedRef.current) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            setDataError(msg);
        }
        finally {
            backfillInFlightRef.current = false;
            lastViewportMissingRef.current = null;
            if (mountedRef.current) {
                setHistoryStatus("idle");
            }
        }
    }, [dataAdapter, timeframe]);
    const triggerBackfillDebounced = useCallback(() => {
        if (!canRunHistoryScheduler({
            activeSource: activeSourceRef.current,
            warmupInFlight: warmupInFlightRef.current,
            backfillInFlight: backfillInFlightRef.current,
            liveBarsLength: liveDataRef.current.length,
        })) {
            return;
        }
        if (backfillDebounceRef.current !== null) {
            return; // already pending
        }
        backfillDebounceRef.current = setTimeout(() => {
            backfillDebounceRef.current = null;
            void requestOlderHistoryPage();
        }, 200);
    }, [requestOlderHistoryPage]);
    const ensureRangeHistory = useCallback(async (range) => {
        if (!canRunHistoryScheduler({
            activeSource: activeSourceRef.current,
            warmupInFlight: warmupInFlightRef.current,
            backfillInFlight: backfillInFlightRef.current,
            liveBarsLength: liveDataRef.current.length,
        })) {
            return;
        }
        backfillInFlightRef.current = true;
        setHistoryStatus("backfilling");
        try {
            let currentBars = liveDataRef.current;
            let pagesLoaded = 0;
            const targetStart = resolveChartRangeStart(currentBars[currentBars.length - 1].date, range);
            while (currentBars[0].date.valueOf() > targetStart.valueOf() && pagesLoaded < BACKFILL_MAX_PAGES) {
                const { bars: olderBarRaw } = await dataAdapter.getBars({
                    type: "backward",
                    symbol: "BTCUSDT",
                    interval: timeframe,
                    limit: BACKFILL_PAGE_LIMIT,
                    timestamp: currentBars[0].date.valueOf(),
                });
                const olderBars = olderBarRaw.map(klineBarToRawOHLCV);
                if (!mountedRef.current || olderBars.length === 0) {
                    break;
                }
                currentBars = mergeBarsByDate(olderBars, currentBars);
                pagesLoaded += 1;
                setLiveData(currentBars);
            }
            if (mountedRef.current && currentBars.length > 0) {
                setVisibleDomain(resolveChartRangeExtents(currentBars, range));
            }
        }
        catch (err) {
            if (!mountedRef.current) {
                return;
            }
            const msg = err instanceof Error ? err.message : String(err);
            setDataError(msg);
        }
        finally {
            backfillInFlightRef.current = false;
            lastViewportMissingRef.current = null;
            if (mountedRef.current) {
                setHistoryStatus("idle");
            }
        }
    }, [dataAdapter, timeframe]);
    const handleVisibleDomainChange = useCallback((domain) => {
        // CRITICAL: Do NOT call setVisibleDomain here.
        // Changing xExtents prop triggers ChartCanvas.CANDIDATES_FOR_RESET → blank chart.
        // Only update the ref for sync reads (scheduler, backfill trigger).
        lastViewportMissingRef.current = null;
        const normalizedDomain = normalizeDomain(domain);
        visibleDomainRef.current = normalizedDomain;
        const shouldEvaluateViewportBackfill = visibleDomain === null;
        setVisibleDomain((current) => (current ? null : current));
        // VNInvest backfill must react to user pan/zoom updates only.
        // Skip the one-shot controlled-domain sync right after initial/range load,
        // otherwise it can trigger immediate backfill and produce loading flicker.
        if (!shouldEvaluateViewportBackfill) {
            return;
        }
        if (activeSourceRef.current !== "vninvest" || backfillInFlightRef.current) {
            return;
        }
        const currentBars = liveDataRef.current;
        if (currentBars.length === 0) {
            return;
        }
        const earliestBar = currentBars[0];
        const latestBar = currentBars[currentBars.length - 1];
        if (!earliestBar || !latestBar) {
            return;
        }
        const timeframeMs = resolveTimeframeMs(vniTimeframeRef.current);
        const leftBufferMs = timeframeMs * 5;
        const viewportStart = normalizedDomain[0];
        const isNearOldestEdge = viewportStart.valueOf() <= earliestBar.date.valueOf() + leftBufferMs;
        if (isNearOldestEdge) {
            triggerBackfillDebounced();
        }
    }, [normalizeDomain, triggerBackfillDebounced, visibleDomain]);
    const handleChartRangeChange = useCallback((range) => {
        lastViewportMissingRef.current = null;
        setChartRange(range);
        // ── VNInvest path (N-05) ──────────────────────────────────────────────
        // ── VNInvest path (N-05) ──────────────────────────────────────────────
        // If the requested range requires more history, trigger cursor-based backfill.
        // Backfill continues page-by-page as the user pans to the left edge.
        if (activeSourceRef.current === "vninvest") {
            const currentBars = liveDataRef.current;
            if (currentBars.length > 0 && range !== "All") {
                const neededStart = resolveChartRangeStart(normalizeDate(currentBars[currentBars.length - 1].date), range);
                const oldestBar = normalizeDate(currentBars[0].date);
                if (neededStart.valueOf() < oldestBar.valueOf()) {
                    // Need more historical data — trigger cursor backfill, show current domain
                    setVisibleDomain(resolveChartRangeExtents(currentBars, range));
                    triggerBackfillDebounced();
                    return;
                }
                setVisibleDomain(resolveChartRangeExtents(currentBars, range));
                return;
            }
            if (currentBars.length === 0) {
                void handleLoadVNIChart();
                return;
            }
            // "All" range: show everything already loaded
            setVisibleDomain(resolveChartRangeExtents(currentBars, range));
            return;
        }
        // ── Binance / offline path ────────────────────────────────────────────
        const currentBars = liveDataRef.current;
        if (currentBars.length > 0) {
            setVisibleDomain(resolveChartRangeExtents(currentBars, range));
        }
        void ensureRangeHistory(range);
    }, [ensureRangeHistory, handleLoadVNIChart, triggerBackfillDebounced]);
    /** Pre-fetch backward from seed bars until INITIAL_HISTORY_TARGET_BARS are loaded. */
    const warmupInitialBinanceHistory = useCallback(async (seedBars) => {
        if (activeSourceRef.current !== "binance" || warmupInFlightRef.current || seedBars.length >= INITIAL_HISTORY_TARGET_BARS) {
            return;
        }
        warmupInFlightRef.current = true;
        try {
            let currentBars = seedBars;
            let pagesLoaded = 0;
            while (currentBars.length < INITIAL_HISTORY_TARGET_BARS &&
                pagesLoaded < INITIAL_HISTORY_MAX_PAGES &&
                mountedRef.current) {
                const earliestBar = currentBars[0];
                if (!earliestBar)
                    break;
                const { bars: olderRaw } = await dataAdapter.getBars({
                    type: "backward",
                    symbol: "BTCUSDT",
                    interval: timeframe,
                    limit: BACKFILL_PAGE_LIMIT,
                    timestamp: earliestBar.date.valueOf(),
                });
                const olderBars = olderRaw.map(klineBarToRawOHLCV);
                if (olderBars.length === 0)
                    break;
                currentBars = mergeBarsByDate(olderBars, currentBars);
                pagesLoaded += 1;
                if (mountedRef.current) {
                    setLiveData(currentBars);
                }
            }
        }
        catch {
            // warmup failure is non-fatal
        }
        finally {
            warmupInFlightRef.current = false;
        }
    }, [dataAdapter, timeframe]);
    /** Scheduler: check visible range and enqueue backfill if needed. */
    const scheduleForViewport = useCallback(() => {
        if (!canRunHistoryScheduler({
            activeSource: activeSourceRef.current,
            warmupInFlight: warmupInFlightRef.current,
            backfillInFlight: backfillInFlightRef.current,
            liveBarsLength: liveDataRef.current.length,
        })) {
            return;
        }
        const domain = visibleDomainRef.current;
        const currentBars = liveDataRef.current;
        if (!domain || currentBars.length === 0)
            return;
        const viewport = { startMs: domain[0].valueOf(), endMs: domain[1].valueOf() };
        const target = computeTargetWindow(viewport, { leftPrefetchRatio: 2.0, rightPrefetchRatio: 0.5 });
        const loaded = computeLoadedWindow(currentBars);
        if (!loaded)
            return;
        const missing = computeMissingSegments(target, loaded);
        if (!shouldScheduleFetch(lastViewportMissingRef.current, missing)) {
            return;
        }
        lastViewportMissingRef.current = missing;
        if (missing.leftMissing) {
            queueRef.current.enqueue({
                key: `binance:BTCUSDT:${timeframe}`,
                side: "left",
                targetTs: missing.leftTargetMs,
                priority: 10,
                generation: schedulerGenerationRef.current,
            });
        }
    }, [timeframe]);
    // Fetch history on mount and on timeframe/adapter change.
    lastViewportMissingRef.current = null;
    useEffect(() => {
        mountedRef.current = true; // Must be first — guards against StrictMode double-invoke
        schedulerGenerationRef.current += 1;
        queueRef.current.clearAll();
        lastViewportMissingRef.current = null;
        initialWarmupRequestedRef.current = false;
        warmupInFlightRef.current = false;
        if (activeSource !== "binance") {
            lastViewportMissingRef.current = null;
            setHistoryStatus("idle");
            return () => {
                lastViewportMissingRef.current = null;
                queueRef.current.clearAll();
            };
        }
        const abortController = new AbortController();
        setDataStatus("loading");
        setDataError("");
        setHistoryStatus("idle");
        setVisibleDomain(null);
        dataAdapter.getBars({ type: "init", symbol: "BTCUSDT", interval: timeframe, limit: BACKFILL_PAGE_LIMIT, timestamp: null, signal: abortController.signal })
            .then((result) => {
            if (abortController.signal.aborted || !mountedRef.current)
                return;
            const bars = result.bars.map(klineBarToRawOHLCV);
            setLiveData(bars);
            setVisibleDomain(resolveChartRangeExtents(bars, chartRangeRef.current));
            setDataStatus("live");
            // Kick off warmup after initial load — deferred so state settles first
            if (!initialWarmupRequestedRef.current) {
                initialWarmupRequestedRef.current = true;
                setTimeout(() => {
                    if (mountedRef.current) {
                        void warmupInitialBinanceHistory(bars);
                    }
                }, 0);
            }
        })
            .catch((err) => {
            if (abortController.signal.aborted || !mountedRef.current)
                return;
            const msg = err instanceof Error ? err.message : String(err);
            setDataError(msg);
            // Fallback to offline data
            const offlineBars = getOfflineDemoBars();
            setLiveData(offlineBars);
            setVisibleDomain(resolveChartRangeExtents(offlineBars, chartRangeRef.current));
            setDataStatus("offline");
        });
        return () => {
            abortController.abort();
            schedulerGenerationRef.current += 1; // invalidate pending jobs on cleanup
            queueRef.current.clearAll();
        };
    }, [activeSource, dataAdapter, timeframe, warmupInitialBinanceHistory]);
    useEffect(() => {
        if (activeSource !== "vninvest") {
            return;
        }
        if (!vniHasPAT) {
            const message = t("vninvest.error.noPAT");
            setLiveData([]);
            setVisibleDomain(null);
            setVniError(message);
            setDataError(message);
            setDataStatus("error");
            setWhaleData(null);
            return;
        }
        void handleLoadVNIChart();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSource, t, vniConfigVersion, vniHasPAT, vniTimeframe]);
    // Scheduler interval: dequeue and execute pending backfill jobs
    useEffect(() => {
        if (activeSource !== "binance") {
            return;
        }
        const generation = schedulerGenerationRef.current;
        const timer = window.setInterval(() => {
            if (!mountedRef.current || warmupInFlightRef.current)
                return;
            scheduleForViewport();
            const job = queueRef.current.dequeue(generation);
            if (!job)
                return;
            if (backfillInFlightRef.current) {
                queueRef.current.complete(job.id);
                return;
            }
            backfillInFlightRef.current = true;
            setHistoryStatus("backfilling");
            void (async () => {
                try {
                    let currentBars = liveDataRef.current;
                    if (currentBars.length === 0)
                        return;
                    const { bars: olderRaw } = await dataAdapter.getBars({
                        type: "backward",
                        symbol: "BTCUSDT",
                        interval: timeframe,
                        limit: BACKFILL_PAGE_LIMIT,
                        timestamp: currentBars[0].date.valueOf(),
                    });
                    if (!mountedRef.current || olderRaw.length === 0)
                        return;
                    currentBars = mergeBarsByDate(olderRaw.map(klineBarToRawOHLCV), currentBars);
                    setLiveData(currentBars);
                }
                catch {
                    // scheduler fetch failure is non-fatal
                }
                finally {
                    backfillInFlightRef.current = false;
                    lastViewportMissingRef.current = null;
                    queueRef.current.complete(job.id);
                    if (mountedRef.current)
                        setHistoryStatus("idle");
                }
            })();
        }, SCHEDULER_TICK_MS);
        return () => window.clearInterval(timer);
    }, [activeSource, dataAdapter, timeframe, scheduleForViewport]);
    const data = useMemo(() => {
        if (activeSource === "vninvest") {
            return liveData;
        }
        return liveData.length > 0 ? liveData : getOfflineDemoBars();
    }, [activeSource, liveData]);
    useEffect(() => {
        if (activeSource !== "binance" || dataStatus !== "live") {
            return;
        }
        const timer = window.setInterval(() => {
            if (backfillInFlightRef.current || warmupInFlightRef.current || !mountedRef.current) {
                return;
            }
            void dataAdapter.getBars({ type: "forward", symbol: "BTCUSDT", interval: timeframe, limit: BACKFILL_PAGE_LIMIT, timestamp: null })
                .then((result) => {
                const latestBars = result.bars.map(klineBarToRawOHLCV);
                if (!mountedRef.current || latestBars.length === 0) {
                    return;
                }
                setLiveData((current) => mergeBarsByDate(current, latestBars));
            })
                .catch((err) => {
                if (!mountedRef.current) {
                    return;
                }
                const msg = err instanceof Error ? err.message : String(err);
                setDataError(msg);
            });
        }, 30000);
        return () => window.clearInterval(timer);
    }, [activeSource, dataAdapter, dataStatus, timeframe]);
    useEffect(() => {
        const currentVisibleDomain = visibleDomainRef.current;
        if (activeSource === "offline" || dataStatus !== "live" || historyStatus === "backfilling" || warmupInFlightRef.current || currentVisibleDomain === null || liveData.length === 0) {
            return;
        }
        const earliestBar = liveData[0];
        const latestBar = liveData[liveData.length - 1];
        if (!earliestBar) {
            return;
        }
        if (!latestBar) {
            return;
        }
        if (activeSource === "vninvest") {
            const timeframeMs = resolveTimeframeMs(vniTimeframe);
            const leftBufferMs = timeframeMs * 5;
            const viewportStart = normalizeDate(currentVisibleDomain[0]);
            const isNearOldestEdge = viewportStart.valueOf() <= earliestBar.date.valueOf() + leftBufferMs;
            if (isNearOldestEdge && !backfillInFlightRef.current) {
                triggerBackfillDebounced();
            }
            return;
        }
        // Scheduler handles pan-based backfill via visibleDomainRef.
        // This effect covers the case where visibleDomain state is set (e.g. on chartRange change)
        // and data hasn't been loaded yet for that range.
        if (!backfillInFlightRef.current && normalizeDate(currentVisibleDomain[0]).valueOf() <= earliestBar.date.valueOf()) {
            triggerBackfillDebounced();
        }
    }, [activeSource, dataStatus, historyStatus, liveData, triggerBackfillDebounced, vniTimeframe]);
    const replayControllerRef = useRef(null);
    if (replayControllerRef.current === null) {
        replayControllerRef.current = new BarReplayController({
            allData: data,
            startIndex: data.length,
        });
    }
    const [replayState, setReplayState] = useState(() => replayControllerRef.current.getState());
    const [replayContextMenu, setReplayContextMenu] = useState(null);
    useEffect(() => {
        const controller = replayControllerRef.current;
        if (!controller) {
            return;
        }
        return controller.subscribe(setReplayState);
    }, []);
    useEffect(() => {
        replayControllerRef.current?.setData(data, data.length);
    }, [data]);
    useEffect(() => {
        setPaperTradePosition(null);
        setPaperTradeHistory([]);
        paperTradePositionRef.current = null;
        lastPaperTradeSignatureRef.current = null;
    }, [chartTimeframe, selectedSymbol]);
    const indicatorSeries = useMemo(() => paneState.panes.flatMap((pane) => pane.series), [paneState.panes]);
    const replayVisibleData = useMemo(() => {
        if (replayState.visibleData.length > 1) {
            return replayState.visibleData;
        }
        if (replayState.currentIndex <= 0 || data.length <= 1) {
            return data;
        }
        return data.slice(0, Math.min(2, data.length));
    }, [data, replayState.currentIndex, replayState.visibleData]);
    const plotData = useMemo(() => {
        const enrichedData = enrichData(replayVisibleData, { series: indicatorSeries });
        if (chartType !== "heikinashi" || enrichedData.length === 0)
            return enrichedData;
        const transformed = transformHeikinAshi(replayVisibleData);
        return transformed.map((bar, i) => ({
            ...enrichedData[i],
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
        }));
    }, [chartType, indicatorSeries, replayVisibleData]);
    const chartData = useMemo(() => plotData.filter((bar) => Boolean(bar && bar.date)), [plotData]);
    const widgetData = useMemo(() => replayVisibleData.map((bar, index) => ({
        ...bar,
        index,
        dataIndex: index,
    })), [replayVisibleData]);
    const hasWidgetData = widgetData.length > 0;
    // scaleTime + default candlestick width can collapse to near-zero body width.
    // Use distance between adjacent bars in screen space for stable candle bodies.
    const candleWidth = useMemo(() => {
        return (props, moreProps) => {
            const { xScale, xAccessor, plotData } = moreProps;
            const ratio = props.widthRatio ?? 0.8;
            if (plotData.length < 2)
                return 6;
            const first = xAccessor(plotData[0]);
            const second = xAccessor(plotData[1]);
            const stepPx = Math.abs(xScale(second) - xScale(first));
            if (!Number.isFinite(stepPx) || stepPx <= 0)
                return 6;
            return Math.max(3, stepPx * ratio);
        };
    }, []);
    const xExtents = useMemo(() => {
        if (visibleDomain) {
            return visibleDomain;
        }
        return undefined;
    }, [visibleDomain]);
    const lastBar = chartData[chartData.length - 1];
    const selectedDrawingId = useMemo(() => getSelectedDrawingId(drawingInteraction.drawingState), [drawingInteraction.drawingState]);
    const sortedDrawings = useMemo(() => sortDrawings(drawingInteraction.allDrawings), [drawingInteraction.allDrawings]);
    // DT-10-T09: Evaluate drawing alerts on each price update
    useDrawingAlertEvaluator({
        drawings: drawingInteraction.allDrawings,
        plotData,
        updateDrawing,
        onDrawingAlert: useCallback((drawing, condition, price) => {
            console.info("[DrawingAlert]", drawing.type, drawing.id, condition.direction, "@ price", price);
        }, []),
    });
    const selectedDrawing = useMemo(() => sortedDrawings.find((drawing) => drawing.id === selectedDrawingId) ?? null, [selectedDrawingId, sortedDrawings]);
    const isEditingText = drawingInteraction.drawingState.type === "editing"
        && selectedDrawing?.type === "text"
        && drawingInteraction.drawingState.objectId === selectedDrawing.id;
    const drawingContextMenuDrawing = useMemo(() => {
        if (!drawingContextMenu) {
            return null;
        }
        return sortedDrawings.find((drawing) => drawing.id === drawingContextMenu.drawingId) ?? selectedDrawing;
    }, [drawingContextMenu, selectedDrawing, sortedDrawings]);
    const drawingPanelX = useMemo(() => Math.max(16, chartWidth - DRAWING_PANEL_WIDTH - 16), [chartWidth]);
    const drawingInspectorPosition = useMemo(() => ({ x: drawingPanelX, y: 16 }), [drawingPanelX]);
    const drawingListPosition = useMemo(() => ({ x: drawingPanelX, y: 286 }), [drawingPanelX]);
    const storageToolbarPosition = useMemo(() => ({ x: 16, y: 16 }), []);
    const drawingTextEditorLabels = useMemo(() => ({
        title: t("drawing.textEditorTitle"),
        label: t("drawing.textEditorLabel"),
        placeholder: t("drawing.textEditorPlaceholder"),
        edit: t("drawing.textEditorEdit"),
        save: t("drawing.textEditorSave"),
        cancel: t("drawing.textEditorCancel"),
        empty: t("drawing.textEditorEmpty"),
    }), [t]);
    const replayFinished = replayState.allData.length > 0 && replayState.currentIndex >= replayState.allData.length && !replayState.isPlaying;
    const paperTradePanelVisible = showReplayBar || paperTradePosition !== null || paperTradeHistory.length > 0;
    const paperTradeReportVisible = replayFinished || paperTradeHistory.length > 0;
    const paperTradeRealizedPnl = useMemo(() => paperTradeHistory.reduce((sum, trade) => sum + trade.pnl, 0), [paperTradeHistory]);
    const paperTradeUnrealizedPnl = useMemo(() => (paperTradePosition && lastBar ? lastBar.close - paperTradePosition.entryPrice : 0), [lastBar, paperTradePosition]);
    const paperTradeSummary = useMemo(() => {
        const totalTrades = paperTradeHistory.length;
        const wins = paperTradeHistory.filter((trade) => trade.pnl > 0).length;
        const losses = paperTradeHistory.filter((trade) => trade.pnl < 0).length;
        const realizedPnl = paperTradeRealizedPnl;
        const averagePnl = totalTrades > 0 ? realizedPnl / totalTrades : 0;
        const averageBarsHeld = totalTrades > 0
            ? paperTradeHistory.reduce((sum, trade) => sum + trade.barsHeld, 0) / totalTrades
            : 0;
        const bestTrade = totalTrades > 0
            ? paperTradeHistory.reduce((best, trade) => (trade.pnl > best.pnl ? trade : best), paperTradeHistory[0])
            : null;
        const worstTrade = totalTrades > 0
            ? paperTradeHistory.reduce((worst, trade) => (trade.pnl < worst.pnl ? trade : worst), paperTradeHistory[0])
            : null;
        return {
            totalTrades,
            wins,
            losses,
            winRate: totalTrades > 0 ? wins / totalTrades : 0,
            realizedPnl,
            averagePnl,
            averageBarsHeld,
            bestTrade,
            worstTrade,
        };
    }, [paperTradeHistory, paperTradeRealizedPnl]);
    const paperTradeJournal = useMemo(() => [...paperTradeHistory].reverse(), [paperTradeHistory]);
    const replayProgressLabel = t("replay.progress", {
        current: replayState.currentIndex,
        total: replayState.allData.length,
    });
    const replayToggleTitle = replayState.isPlaying ? t("replay.pause") : t("replay.play");
    const replayController = replayControllerRef.current;
    const handleReplayToggle = useCallback(() => {
        if (!replayController) {
            return;
        }
        if (replayController.isPlayingNow()) {
            replayController.pause();
            return;
        }
        if (replayController.getCurrentIndex() >= replayController.getState().allData.length) {
            replayController.rewind();
        }
        replayController.play();
    }, [replayController]);
    const handleReplayRewind = useCallback(() => {
        replayController?.rewind();
    }, [replayController]);
    const handleReplayStepBack = useCallback(() => {
        replayController?.stepBack();
    }, [replayController]);
    const handleReplayStepForward = useCallback(() => {
        replayController?.stepForward();
    }, [replayController]);
    const handleReplayJumpLatest = useCallback(() => {
        replayController?.jumpToLatest();
    }, [replayController]);
    const handleReplaySpeedChange = useCallback((speed) => {
        replayController?.setSpeed(speed);
    }, [replayController]);
    const closeReplayContextMenu = useCallback(() => {
        setReplayContextMenu(null);
    }, []);
    const closePaperTradePosition = useCallback((exitBar, exitIndex) => {
        const currentPosition = paperTradePositionRef.current;
        if (!currentPosition) {
            return;
        }
        const closedTrade = {
            ...currentPosition,
            exitDate: exitBar.date,
            exitPrice: exitBar.close,
            exitIndex,
            pnl: exitBar.close - currentPosition.entryPrice,
            barsHeld: Math.max(0, exitIndex - currentPosition.entryIndex),
        };
        const signature = [
            normalizeDate(closedTrade.entryDate).getTime(),
            normalizeDate(closedTrade.exitDate).getTime(),
            closedTrade.entryPrice.toFixed(2),
            closedTrade.exitPrice.toFixed(2),
            closedTrade.barsHeld,
        ].join(":");
        if (lastPaperTradeSignatureRef.current === signature) {
            return;
        }
        lastPaperTradeSignatureRef.current = signature;
        paperTradePositionRef.current = null;
        setPaperTradePosition(null);
        setPaperTradeHistory((history) => [...history, closedTrade]);
    }, []);
    const handleReplayFromHere = useCallback(() => {
        if (!replayController || !replayContextMenu) {
            return;
        }
        replayController.jumpToDate(replayContextMenu.date);
        replayController.play();
        setReplayContextMenu(null);
    }, [replayContextMenu, replayController]);
    const handleReplayContextMenu = useCallback((moreProps, event) => {
        const currentItem = moreProps.currentItem;
        if (!currentItem?.date) {
            return;
        }
        const shellNode = shellRef.current;
        if (!shellNode) {
            return;
        }
        const nativeEvent = event;
        const rect = shellNode.getBoundingClientRect();
        const x = Math.min(Math.max(12, (nativeEvent?.clientX ?? rect.left) - rect.left + 8), Math.max(12, rect.width - 198));
        const y = Math.min(Math.max(12, (nativeEvent?.clientY ?? rect.top) - rect.top + 8), Math.max(12, rect.height - 92));
        setReplayContextMenu({
            x,
            y,
            date: currentItem.date,
            label: dateFormat(normalizeDate(currentItem.date)),
        });
    }, [dateFormat]);
    const handlePaperTradeReset = useCallback(() => {
        setPaperTradePosition(null);
        setPaperTradeHistory([]);
        paperTradePositionRef.current = null;
        lastPaperTradeSignatureRef.current = null;
    }, []);
    const handlePaperTradeClick = useCallback((moreProps) => {
        if (!replayState.isPlaying) {
            return;
        }
        const currentItem = moreProps.currentItem ?? replayState.currentBar;
        if (!currentItem) {
            return;
        }
        const now = Date.now();
        const lastClick = lastPaperTradeClickRef.current;
        if (lastClick && lastClick.index === replayState.currentIndex && now - lastClick.timestamp < 100) {
            return;
        }
        lastPaperTradeClickRef.current = {
            timestamp: now,
            index: replayState.currentIndex,
        };
        if (paperTradePositionRef.current) {
            closePaperTradePosition(currentItem, replayState.currentIndex);
            return;
        }
        const nextPosition = {
            entryDate: currentItem.date,
            entryPrice: currentItem.close,
            entryIndex: replayState.currentIndex,
        };
        paperTradePositionRef.current = nextPosition;
        setPaperTradePosition(nextPosition);
        lastPaperTradeSignatureRef.current = null;
    }, [closePaperTradePosition, replayState.currentBar, replayState.currentIndex, replayState.isPlaying]);
    useEffect(() => {
        if (!replayFinished || !paperTradePositionRef.current || !lastBar) {
            return;
        }
        closePaperTradePosition(lastBar, replayState.currentIndex);
    }, [closePaperTradePosition, lastBar, replayFinished, replayState.currentIndex]);
    useEffect(() => {
        if (!replayContextMenu) {
            return;
        }
        const handleEscape = (event) => {
            if (event.key === "Escape") {
                setReplayContextMenu(null);
            }
        };
        window.addEventListener("keydown", handleEscape);
        return () => window.removeEventListener("keydown", handleEscape);
    }, [replayContextMenu]);
    const selectedPane = useMemo(() => paneState.panes.find((pane) => pane.id === selectedPaneId) ?? paneState.visiblePanes[0] ?? paneState.panes[0], [paneState.panes, paneState.visiblePanes, selectedPaneId]);
    const paneLabel = useCallback((pane) => getPaneLabel(pane.id, pane.label), [getPaneLabel]);
    const localizePane = useCallback((pane) => {
        const nextLabel = paneLabel(pane);
        return nextLabel === pane.label ? pane : { ...pane, label: nextLabel };
    }, [paneLabel]);
    const candleTypeLabel = useCallback((type) => t(`candleType.${type}`), [t]);
    const toolLabel = useCallback((toolId) => t(`tool.${toolId}`), [t]);
    useEffect(() => {
        if (!selectedPane && paneState.panes.length > 0) {
            setSelectedPaneId(paneState.visiblePanes[0]?.id ?? paneState.panes[0].id);
        }
    }, [paneState.panes, paneState.visiblePanes, selectedPane]);
    // Switch the primary price series and chartType atomically in one callback.
    // By calling both pane dispatches and setChartType inside the same synchronous
    // event handler, React 18 batches all updates into a single render, preventing
    // the intermediate frame where chartType="candlestick" but pane.series still
    // contains "Bar" (which forced y-domain [0..80k] and made bars fill the pane).
    const handleChartTypeChange = useCallback((nextType) => {
        const desiredType = CHART_TYPE_TO_SERIES[nextType];
        const pricePane = paneState.panes.find((pane) => pane.id === "price");
        if (pricePane) {
            pricePane.series.forEach((series) => {
                if (MAIN_PRICE_SERIES_TYPES.includes(series.type) && series.type !== desiredType) {
                    paneState.removeSeries(pricePane.id, series.type);
                }
            });
            if (!pricePane.series.some((series) => series.type === desiredType)) {
                paneState.addSeries(pricePane.id, { type: desiredType, yAxis: "right" });
            }
        }
        setChartType(nextType);
    }, [paneState.panes, paneState.addSeries, paneState.removeSeries]);
    // Safety-net: if panes are reset externally (e.g. resetToDefault) while a
    // non-default chartType is active, re-sync the primary series to match.
    useEffect(() => {
        const pricePane = paneState.panes.find((pane) => pane.id === "price");
        if (!pricePane)
            return;
        const desiredType = CHART_TYPE_TO_SERIES[chartType];
        const primary = pricePane.series.find((s) => MAIN_PRICE_SERIES_TYPES.includes(s.type));
        // Already in sync — nothing to do
        if (primary?.type === desiredType && pricePane.series.filter((s) => MAIN_PRICE_SERIES_TYPES.includes(s.type)).length === 1) {
            return;
        }
        pricePane.series.forEach((s) => {
            if (MAIN_PRICE_SERIES_TYPES.includes(s.type) && s.type !== desiredType) {
                paneState.removeSeries(pricePane.id, s.type);
            }
        });
        if (!pricePane.series.some((s) => s.type === desiredType)) {
            paneState.addSeries(pricePane.id, { type: desiredType, yAxis: "right" });
        }
    }, [chartType, paneState.panes, paneState.addSeries, paneState.removeSeries]);
    useEffect(() => {
        const node = shellRef.current;
        if (!node)
            return;
        const readSize = () => {
            // getBoundingClientRect forces a synchronous layout and always returns
            // accurate post-resize dimensions regardless of how the resize was triggered.
            const rect = node.getBoundingClientRect();
            const w = Math.floor(rect.width);
            const h = Math.floor(rect.height);
            if (w > 0 && h > 0) {
                setChartWidth(w);
                setChartHeight(h);
            }
        };
        // Initial measurement
        readSize();
        // ResizeObserver covers CSS/layout-driven resizes (e.g., pane splitter)
        const observer = new ResizeObserver(readSize);
        observer.observe(node);
        // window resize listener guarantees detection of browser-window resizes,
        // which is the primary scenario where ResizeObserver may fire late or not at all.
        window.addEventListener("resize", readSize);
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", readSize);
        };
    }, []);
    const chartReady = dataStatus !== "loading" && chartWidth > 0 && chartHeight > 0 && chartData.length > 0 && paneState.visiblePanes.length > 0;
    const paneOverlayLayout = useMemo(() => {
        const snapshotMap = new Map(widgetPaneSnapshots.map((snapshot) => [snapshot.paneId, snapshot]));
        let fallbackTop = 8;
        return visiblePanes.map((pane, index) => {
            const fallbackHeight = paneHeights[index] ?? 0;
            const snapshot = snapshotMap.get(pane.id);
            const layout = {
                pane,
                wrapTop: snapshot?.headerAnchor.top ?? fallbackTop,
                labelTop: snapshot?.labelAnchor.top ?? fallbackTop,
                labelHeight: snapshot?.labelAnchor.height ?? fallbackHeight,
                splitterTop: snapshot ? snapshot.bounds.top + snapshot.bounds.height : fallbackTop + fallbackHeight,
            };
            fallbackTop += fallbackHeight;
            return layout;
        });
    }, [paneHeights, visiblePanes, widgetPaneSnapshots]);
    const supportsInteractiveChartOverlays = widgetRuntimeCapabilities?.chartCanvasOverlays ?? false;
    const supportsMeasurementOverlay = widgetRuntimeCapabilities?.measurementOverlay ?? false;
    const supportsDrawingOverlays = widgetRuntimeCapabilities?.drawingOverlays ?? false;
    const chartAdapter = useMemo(() => ({
        async fetchBars(_symbol, _timeframe, _from, _to) {
            return widgetData.map((bar) => ({ ...bar, date: new Date(bar.date) }));
        },
        async fetchMoreBars(_symbol, _timeframe, before, limit = 300) {
            return widgetData
                .filter((bar) => bar.date < before)
                .slice(-limit)
                .map((bar) => ({ ...bar, date: new Date(bar.date) }));
        },
        subscribeToBar() {
            return () => undefined;
        },
        subscribeToTrades() {
            return () => undefined;
        },
        subscribeToOrderbook() {
            return () => undefined;
        },
        async searchSymbols() {
            return [{ symbol: selectedSymbol, name: selectedSymbol, exchange: activeSource === "vninvest" ? "VNINVEST" : "BINANCE" }];
        },
    }), [activeSource, selectedSymbol, widgetData]);
    const widgetMessages = language === "vi" ? widgetMessagesVi : widgetMessagesEn;
    // Close panes menu when clicking outside
    useEffect(() => {
        if (!showPanesMenu)
            return;
        const handler = (e) => {
            if (panesMenuRef.current && !panesMenuRef.current.contains(e.target)) {
                setShowPanesMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showPanesMenu]);
    useEffect(() => {
        if (!showProfileMenu)
            return;
        const handler = (e) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
                setShowProfileMenu(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [showProfileMenu]);
    // Close drawing tool flyout when clicking outside toolbar
    useEffect(() => {
        if (!openGroupId)
            return;
        const handler = (e) => {
            const target = e.target;
            const inToolbar = toolbarRef.current?.contains(target);
            const inFlyout = document.querySelector(".gc-tools-flyout")?.contains(target);
            if (!inToolbar && !inFlyout)
                setOpenGroupId(null);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [openGroupId]);
    const ratio = window.devicePixelRatio || 1;
    const isCompactDrawingToolbarViewport = window.innerWidth <= MOBILE_DRAWING_TOOL_BREAKPOINT;
    const priceIsUp = (lastBar?.close ?? 0) >= (lastBar?.open ?? 0);
    const showOhlcMetrics = Boolean(lastBar) && (activeSource === "vninvest" ? dataStatus === "live" : dataStatus !== "loading");
    const ohlcStatusLabel = activeSource === "vninvest"
        ? (dataStatus === "error" ? (vniError ?? t("vninvest.status.error")) : t("vninvest.loading"))
        : t("library.loadingPriceData");
    const handleDrawingToolUsed = useCallback(() => setActiveTool("cursor"), []);
    const updateSelectedDrawing = useCallback((patch) => {
        if (!selectedDrawing) {
            return;
        }
        updateDrawing(selectedDrawing.id, patch);
    }, [selectedDrawing, updateDrawing]);
    const toggleSelectedLock = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        updateSelectedDrawing({ locked: !selectedDrawing.locked });
    }, [selectedDrawing, updateSelectedDrawing]);
    const toggleSelectedVisible = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        updateSelectedDrawing({ visible: selectedDrawing.visible === false });
    }, [selectedDrawing, updateSelectedDrawing]);
    const bringSelectedToFront = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        const maxZ = drawingInteraction.allDrawings.reduce((currentMax, drawing) => Math.max(currentMax, drawing.zIndex ?? 0), 0);
        updateDrawing(selectedDrawing.id, { zIndex: maxZ + 1 });
    }, [drawingInteraction.allDrawings, selectedDrawing, updateDrawing]);
    const sendSelectedToBack = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        const minZ = drawingInteraction.allDrawings.reduce((currentMin, drawing) => Math.min(currentMin, drawing.zIndex ?? 0), 0);
        updateDrawing(selectedDrawing.id, { zIndex: minZ - 1 });
    }, [drawingInteraction.allDrawings, selectedDrawing, updateDrawing]);
    const cloneSelectedDrawing = useCallback(() => {
        if (!selectedDrawing || chartWidth <= 0 || chartHeight <= 0 || plotData.length < 2) {
            return;
        }
        const firstBar = plotData[0];
        const lastVisibleBar = plotData[plotData.length - 1];
        const allPrices = plotData.flatMap((bar) => [bar.open, bar.high, bar.low, bar.close]);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const innerWidth = Math.max(1, chartWidth - 128);
        const innerHeight = Math.max(1, chartHeight - 56);
        const timeOffset = ((new Date(lastVisibleBar.date).getTime() - new Date(firstBar.date).getTime()) / innerWidth) * 20;
        const priceOffset = -((maxPrice - minPrice) / innerHeight) * 20;
        const nextClone = offsetDrawingByPixels(selectedDrawing, timeOffset, priceOffset, resolveDrawingPlacementForPane(selectedDrawing, selectedPane));
        replaceDrawings([...drawingInteraction.allDrawings, nextClone]);
        selectObject(nextClone.id);
        setActiveTool("cursor");
    }, [chartHeight, chartWidth, drawingInteraction.allDrawings, plotData, replaceDrawings, selectObject, selectedDrawing, selectedPane]);
    const copySelectedDrawing = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        drawingClipboardRef.current = cloneDrawingSnapshot(selectedDrawing);
    }, [selectedDrawing]);
    const pasteCopiedDrawing = useCallback(() => {
        const clipboardDrawing = drawingClipboardRef.current;
        if (!clipboardDrawing || chartWidth <= 0 || chartHeight <= 0 || plotData.length < 2) {
            return;
        }
        const firstBar = plotData[0];
        const lastVisibleBar = plotData[plotData.length - 1];
        const allPrices = plotData.flatMap((bar) => [bar.open, bar.high, bar.low, bar.close]);
        const minPrice = Math.min(...allPrices);
        const maxPrice = Math.max(...allPrices);
        const innerWidth = Math.max(1, chartWidth - 128);
        const innerHeight = Math.max(1, chartHeight - 56);
        const timeOffset = ((new Date(lastVisibleBar.date).getTime() - new Date(firstBar.date).getTime()) / innerWidth) * 20;
        const priceOffset = -((maxPrice - minPrice) / innerHeight) * 20;
        const nextPaste = offsetDrawingByPixels(clipboardDrawing, timeOffset, priceOffset, resolveDrawingPlacementForPane(clipboardDrawing, selectedPane));
        replaceDrawings([...drawingInteraction.allDrawings, nextPaste]);
        selectObject(nextPaste.id);
        setActiveTool("cursor");
    }, [chartHeight, chartWidth, drawingInteraction.allDrawings, plotData, replaceDrawings, selectObject, selectedPane]);
    const handleDrawingContextMenu = useCallback((moreProps, event) => {
        const targetDrawing = moreProps.hitDrawing;
        if (!targetDrawing) {
            closeDrawingContextMenu();
            return;
        }
        const shellNode = shellRef.current;
        if (!shellNode) {
            return;
        }
        const nativeEvent = event;
        const rect = shellNode.getBoundingClientRect();
        const x = Math.min(Math.max(12, (nativeEvent?.clientX ?? rect.left) - rect.left + 8), Math.max(12, rect.width - 260));
        const y = Math.min(Math.max(12, (nativeEvent?.clientY ?? rect.top) - rect.top + 8), Math.max(12, rect.height - 320));
        selectObject(targetDrawing.id);
        setDrawingContextMenu({ x, y, drawingId: targetDrawing.id });
    }, [closeDrawingContextMenu, selectObject]);
    useEffect(() => {
        if (drawingInteraction.drawingState.type === "editing") {
            setDrawingTextDraft(drawingInteraction.drawingState.text);
            return;
        }
        setDrawingTextDraft("");
    }, [drawingInteraction.drawingState]);
    const handleStartTextEdit = useCallback(() => {
        if (!selectedDrawing || selectedDrawing.type !== "text") {
            return;
        }
        drawingInteraction.startEditing(selectedDrawing.id, selectedDrawing.text ?? "");
        setDrawingTextDraft(selectedDrawing.text ?? "");
    }, [drawingInteraction, selectedDrawing]);
    const handleCommitTextEdit = useCallback(() => {
        if (!selectedDrawing || selectedDrawing.type !== "text") {
            return;
        }
        updateDrawing(selectedDrawing.id, { text: drawingTextDraft });
        cancelDrawing();
        selectObject(selectedDrawing.id);
        setActiveTool("cursor");
    }, [cancelDrawing, drawingTextDraft, selectObject, selectedDrawing, updateDrawing]);
    const handleCancelTextEdit = useCallback(() => {
        if (selectedDrawing && selectedDrawing.type === "text") {
            setDrawingTextDraft(selectedDrawing.text ?? "");
        }
        cancelDrawing();
        if (selectedDrawing) {
            selectObject(selectedDrawing.id);
        }
        setActiveTool("cursor");
    }, [cancelDrawing, selectObject, selectedDrawing]);
    useEffect(() => {
        const handleDrawingShortcuts = (event) => {
            if (isEditableTarget(event.target)) {
                return;
            }
            const shortcut = resolveDrawingShortcut(event);
            if (!shortcut) {
                return;
            }
            event.preventDefault();
            closeDrawingContextMenu();
            if (shortcut.type === "tool") {
                cancelDrawing();
                setActiveTool(shortcut.tool);
                return;
            }
            switch (shortcut.command) {
                case "delete":
                    deleteSelected();
                    return;
                case "copy":
                    copySelectedDrawing();
                    return;
                case "paste":
                    pasteCopiedDrawing();
                    return;
                case "clone":
                    cloneSelectedDrawing();
                    return;
                case "undo":
                    undo();
                    return;
                case "redo":
                    redo();
                    return;
                case "escape":
                    cancelDrawing();
                    setActiveTool("cursor");
                    return;
            }
        };
        window.addEventListener("keydown", handleDrawingShortcuts);
        return () => window.removeEventListener("keydown", handleDrawingShortcuts);
    }, [cancelDrawing, closeDrawingContextMenu, cloneSelectedDrawing, copySelectedDrawing, deleteSelected, pasteCopiedDrawing, redo, undo]);
    const handleCloseDrawingInspector = useCallback(() => {
        closeDrawingContextMenu();
        cancelDrawing();
        setActiveTool("cursor");
    }, [cancelDrawing, closeDrawingContextMenu]);
    const paneHeaderLabels = useMemo(() => ({
        dragAriaLabel: (label) => t("library.dragPane", { pane: label }),
        dragTitle: (pane) => pane.pinned ? t("library.dragDisabled") : t("library.dragTitle"),
        addSeriesAriaLabel: (label) => t("library.addSeriesToPane", { pane: label }),
        addSeriesTitle: t("library.addSeries"),
        toggleVisibleAriaLabel: (label, visible) => t(visible ? "library.hidePaneAria" : "library.showPaneAria", { pane: label }),
        toggleVisibleTitle: (pane) => pane.pinned ? t("library.primaryPaneLocked") : t(pane.visible ? "library.hidePane" : "library.restorePane"),
        removeAriaLabel: (label) => t("library.hidePaneAria", { pane: label }),
        removeTitle: t("library.removePaneHint"),
    }), [t]);
    const indicatorLegendLabels = useMemo(() => ({
        showIndicatorTitle: t("library.showIndicator"),
        hideIndicatorTitle: t("library.hideIndicator"),
        removeIndicatorTitle: t("library.removeIndicator"),
        showIndicatorAriaLabel: (label) => t("library.showIndicatorAria", { series: label }),
        hideIndicatorAriaLabel: (label) => t("library.hideIndicatorAria", { series: label }),
        removeIndicatorAriaLabel: (label) => t("library.removeIndicatorAria", { series: label }),
    }), [t]);
    const openSettings = useCallback((section, paneId) => {
        setSettingsSection(section);
        if (paneId) {
            setSettingsPaneId(paneId);
        }
        setSettingsOpen(true);
    }, []);
    const handlePaneAddSeriesRequest = useCallback((paneId) => {
        setSelectedPaneId(paneId);
        openSettings("indicators", paneId);
    }, [openSettings]);
    const renderWidgetPaneToolbar = useCallback(({ pane, actions }) => {
        const localizedPane = localizePane(pane);
        return (_jsx(PaneHeader, { pane: localizedPane, onToggleVisible: actions.toggleVisibility, onRemove: actions.removePane, onAddSeries: actions.addSeries, addButtonRef: undefined, labels: paneHeaderLabels, children: _jsx(IndicatorLegend, { pane: localizedPane, onToggleSeries: actions.toggleSeries, onRemoveSeries: actions.removeSeries, className: "rsc-pane-header__legend", labels: indicatorLegendLabels }) }));
    }, [indicatorLegendLabels, localizePane, paneHeaderLabels]);
    const renderWidgetPaneSplitter = useCallback(({ pane, splitterIndex, top }) => {
        return (_jsx(ChartSplitter, { splitterIndex: splitterIndex, available: available, onCommitDelta: applyDelta, onDoubleClick: resetToDefault, title: t("library.splitterHint"), style: { top } }, `${pane.id}-splitter`));
    }, [available, applyDelta, resetToDefault, t]);
    const closeSettings = useCallback(() => {
        setSettingsOpen(false);
    }, []);
    const handleResetSettings = useCallback(() => {
        paneState.resetToDefault();
        setMaxVisiblePanes(DEFAULT_MAX_VISIBLE_PANES);
        setMaxVisibleBars(DEFAULT_MAX_VISIBLE_BARS);
        setShowNonTradingDays(DEFAULT_DEMO_SETTINGS.showNonTradingDays);
        setShowDrawingPriceMarkers(DEFAULT_DEMO_SETTINGS.showDrawingPriceMarkers);
        setSettingsSection("layout");
        setSettingsPaneId("price");
        setSettingsOpen(false);
    }, [paneState]);
    return (_jsx(DemoPageShell, { className: "demo-page--terminal", frameClassName: "demo-frame--terminal", children: _jsxs("div", { className: `gc-terminal gc-terminal--embedded${showReplayBar ? " gc-terminal--replay-bar" : ""}`, "data-chart-theme": theme, children: [_jsxs("header", { className: "gc-topbar", children: [_jsxs("div", { className: "gc-topbar__left", children: [_jsx("div", { className: "gc-logo", "aria-label": t("library.topbarAria"), children: "BT" }), _jsx("div", { className: "gc-symbol-block", children: activeSource === "vninvest" ? (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", className: "gc-source-label-btn", onClick: () => openPATModal("login"), title: t("dataSource.switchHint"), children: ["VNInvest", _jsx("span", { className: "gc-symbol-exchange__caret", children: "\u25BE" })] }), _jsx(VNSymbolSearch, { client: vniClientRef.current, value: vniSymbol, onChange: (sym) => {
                                                    handleVniSymbolChange(sym);
                                                    void handleLoadVNIChart(sym);
                                                }, onItemSelect: (item) => {
                                                    if (item.company_name || item.exchange) {
                                                        setVniSymbolMeta({ company_name: item.company_name ?? "", exchange: item.exchange ?? "" });
                                                    }
                                                }, onFocusGuard: !vniHasPAT ? () => openPATModal("login") : undefined }), vniSymbolMeta && (_jsxs("div", { className: "gc-symbol-breadcrumb", children: [vniSymbolMeta.exchange && (_jsx("span", { className: `gc-symbol-ex-badge gc-symbol-ex-badge--${vniSymbolMeta.exchange.toLowerCase()}`, children: vniSymbolMeta.exchange })), vniSymbolMeta.company_name && (_jsx("span", { className: "gc-symbol-company-name", children: vniSymbolMeta.company_name }))] }))] })) : (_jsxs("button", { type: "button", className: "gc-symbol-name gc-symbol-name--btn", onClick: () => openPATModal("login"), title: t("dataSource.switchHint"), children: [selectedSymbol, _jsx("span", { className: "gc-symbol-exchange__caret", children: "\u25BE" })] })) }), _jsx("div", { className: "gc-topbar-sep" }), _jsx("select", { className: "vnsc-candle-type-select vnsc-candle-type-select--tf", "aria-label": t("library.timeframes"), value: chartTimeframe, onChange: (e) => handleTimeframeChange(e.target.value), children: (activeSource === "vninvest" ? VNI_TIMEFRAMES : BINANCE_TIMEFRAMES).map((tf) => (_jsx("option", { value: tf, children: tf }, tf))) }), _jsx("div", { className: "gc-topbar-sep" }), _jsx("select", { className: "vnsc-candle-type-select", "aria-label": t("toolbar.candleType"), value: chartType, onChange: (event) => handleChartTypeChange(event.target.value), children: CHART_TYPES.map((id) => (_jsx("option", { value: id, children: candleTypeLabel(id) }, id))) }), _jsx("button", { type: "button", className: "gc-topbar-btn", children: t("library.compare") }), _jsxs("button", { type: "button", className: `gc-topbar-btn${showReplayBar ? " gc-topbar-btn--active" : ""}`, onClick: () => setShowReplayBar((v) => !v), title: t("replay.controls"), "aria-pressed": showReplayBar, children: [_jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", style: { marginRight: 4 }, children: _jsx("polygon", { points: "4,2 14,8 4,14", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round", fill: showReplayBar ? "currentColor" : "none" }) }), t("library.replay")] }), _jsx("div", { className: "gc-topbar-sep" }), _jsxs("div", { className: "gc-chart-type-wrap", ref: panesMenuRef, children: [_jsxs("button", { type: "button", className: `gc-topbar-btn${showPanesMenu ? " gc-topbar-btn--active" : ""}`, onClick: () => setShowPanesMenu((v) => !v), title: t("library.managePanes"), children: [_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", style: { marginRight: 4 }, children: [_jsx("rect", { x: "1", y: "1", width: "14", height: "5", rx: "1", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("rect", { x: "1", y: "9", width: "14", height: "5", rx: "1", stroke: "currentColor", strokeWidth: "1.4" })] }), t("common.panes"), _jsx("svg", { width: "10", height: "10", viewBox: "0 0 10 10", fill: "none", style: { marginLeft: 4 }, children: _jsx("path", { d: "M2 4l3 3 3-3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) })] }), showPanesMenu && (_jsx("div", { className: "gc-chart-type-menu", children: paneState.panes.map((pane) => (_jsxs("button", { type: "button", className: `gc-chart-type-item${pane.visible ? " gc-chart-type-item--active" : ""}`, onClick: () => {
                                                    if (!pane.pinned) {
                                                        paneState.toggleVisible(pane.id);
                                                    }
                                                }, disabled: pane.pinned, title: pane.pinned ? t("library.primaryPaneLocked") : pane.visible ? t("library.hidePane") : t("library.showPane"), children: [pane.visible ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", style: { marginRight: 6, flexShrink: 0 }, children: _jsx("path", { d: "M2 6l3 3 5-5", stroke: "#2962ff", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }) })) : (_jsx("span", { style: { display: "inline-block", width: 18, flexShrink: 0 } })), paneLabel(pane), pane.pinned && _jsx("span", { style: { marginLeft: 4, fontSize: 10, opacity: 0.5 }, children: "\uD83D\uDD12" })] }, pane.id))) }))] })] }), _jsxs("div", { className: "gc-topbar__right", children: [topbarStatusBadge && _jsx("span", { className: topbarStatusBadge.className, title: topbarStatusBadge.title, children: topbarStatusBadge.label }), historyStatus === "backfilling" && activeSource === "binance" && _jsx("span", { className: "gc-loading-badge", children: t("library.backfillingHistory") }), _jsxs("div", { className: "gc-chart-type-wrap", ref: profileMenuRef, children: [_jsx("button", { type: "button", className: `gc-topbar-btn${showProfileMenu ? " gc-topbar-btn--active" : ""}`, onClick: () => setShowProfileMenu((v) => !v), title: t("profile.menu"), "aria-label": t("profile.menu"), "aria-haspopup": "menu", "aria-expanded": showProfileMenu, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "5.2", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M3.2 13.2c.8-2.4 2.8-3.8 4.8-3.8s4 1.4 4.8 3.8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }) }), showProfileMenu ? (_jsxs("div", { className: "gc-chart-type-menu gc-chart-type-menu--right gc-profile-menu", role: "menu", "aria-label": t("profile.menu"), children: [_jsxs("div", { className: "gc-profile-menu__section-label", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "6.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1.5C8 1.5 5.5 4.5 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4.5 10.5 8S8 14.5 8 14.5M1.5 8h13", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }), t("language.label")] }), _jsxs("div", { className: "gc-profile-menu__lang-row", role: "group", "aria-label": t("language.label"), children: [_jsxs("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${language === "vi" ? " gc-chart-type-item--active" : ""}`, onClick: () => setLanguage("vi"), role: "menuitem", children: ["\uD83C\uDDFB\uD83C\uDDF3 ", t("language.vi")] }), _jsxs("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${language === "en" ? " gc-chart-type-item--active" : ""}`, onClick: () => setLanguage("en"), role: "menuitem", children: ["\uD83C\uDDFA\uD83C\uDDF8 ", t("language.en")] })] }), _jsx("div", { className: "gc-profile-menu__divider" }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); toggleTheme(); }, role: "menuitem", children: [isDark ? (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "3.5", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "8", y1: "1", x2: "8", y2: "3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "8", y1: "13", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "1", y1: "8", x2: "3", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "13", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "3.05", y1: "3.05", x2: "4.46", y2: "4.46", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "11.54", y1: "11.54", x2: "12.95", y2: "12.95", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "11.54", y1: "4.46", x2: "12.95", y2: "3.05", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "3.05", y1: "12.95", x2: "4.46", y2: "11.54", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] })) : (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) })), isDark ? t("library.switchToLight") : t("library.switchToDark")] }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openSettings("layout", selectedPane?.id ?? "price"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l1.41-1.41M3.05 12.95l1.41-1.41", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("settings.open")] }), _jsx("div", { className: "gc-profile-menu__divider" }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openPATModal("login"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "5.2", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M3.2 13.2c.8-2.4 2.8-3.8 4.8-3.8s4 1.4 4.8 3.8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("profile.login")] }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openPATModal("paste"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M10 2H6a1 1 0 0 0-1 1v1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1z", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round" }), _jsx("path", { d: "M6 3h4v2H6z", stroke: "currentColor", strokeWidth: "1.1" }), _jsx("path", { d: "M8 8v4M6 10h4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("profile.register")] })] })) : null] })] })] }), showReplayBar && (_jsxs("div", { className: "gc-replay-bar", role: "group", "aria-label": t("replay.controls"), children: [_jsx("button", { type: "button", className: "gc-replay-bar__btn", onClick: handleReplayRewind, title: t("replay.rewind"), "aria-label": t("replay.rewind"), children: _jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M13 2v12M4 8l7-5v10L4 8z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }) }), _jsx("button", { type: "button", className: "gc-replay-bar__btn", onClick: handleReplayStepBack, title: t("replay.stepBack"), "aria-label": t("replay.stepBack"), children: _jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M11 3L5 8l6 5V3z", fill: "currentColor" }) }) }), _jsxs("button", { type: "button", className: `gc-replay-bar__btn${replayState.isPlaying ? " gc-replay-bar__btn--active" : ""}`, onClick: handleReplayToggle, title: replayToggleTitle, "aria-pressed": replayState.isPlaying, children: [replayState.isPlaying ? (_jsxs("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: [_jsx("rect", { x: "3", y: "3", width: "4", height: "10", fill: "currentColor", rx: "1" }), _jsx("rect", { x: "9", y: "3", width: "4", height: "10", fill: "currentColor", rx: "1" })] })) : (_jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: _jsx("polygon", { points: "3,2 14,8 3,14", fill: "currentColor" }) })), _jsx("span", { style: { fontSize: 11 }, children: replayToggleTitle })] }), _jsx("button", { type: "button", className: "gc-replay-bar__btn", onClick: handleReplayStepForward, title: t("replay.stepForward"), "aria-label": t("replay.stepForward"), children: _jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M5 3l6 5-6 5V3z", fill: "currentColor" }) }) }), _jsx("button", { type: "button", className: "gc-replay-bar__btn", onClick: handleReplayJumpLatest, title: t("replay.jumpLatest"), "aria-label": t("replay.jumpLatest"), children: _jsx("svg", { width: "13", height: "13", viewBox: "0 0 16 16", fill: "none", children: _jsx("path", { d: "M3 2v12M13 8L6 3v10l7-5z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) }) }), _jsx("div", { className: "gc-replay-bar__sep", "aria-hidden": "true" }), _jsx("div", { className: "gc-replay-bar__speeds", role: "group", "aria-label": t("replay.speed"), children: REPLAY_SPEEDS.map((speed) => (_jsx("button", { type: "button", className: `gc-replay-bar__btn${replayState.speed === speed ? " gc-replay-bar__btn--active" : ""}`, onClick: () => handleReplaySpeedChange(speed), "aria-pressed": replayState.speed === speed, title: t("replay.speed"), children: speed === "max" ? "MAX" : `${speed}x` }, speed))) }), _jsx("div", { className: "gc-replay-bar__sep", "aria-hidden": "true" }), _jsx("span", { className: "gc-replay-bar__status", children: replayProgressLabel }), _jsx("div", { className: "gc-replay-bar__spacer" }), _jsx("button", { type: "button", className: "gc-replay-bar__btn gc-replay-bar__close", onClick: () => { replayController?.pause(); setShowReplayBar(false); }, title: t("replay.closeBar"), "aria-label": t("replay.closeBar"), children: _jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", children: _jsx("path", { d: "M2 2l8 8M10 2l-8 8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }) })] })), _jsxs("div", { className: "gc-main", children: [_jsxs("div", { ref: toolbarRef, className: "gc-tools-shell", children: [_jsx("span", { className: "gc-tools-handle", "aria-hidden": "true" }), _jsxs("aside", { className: "gc-tools", "aria-label": t("library.drawingTools"), children: [TOOL_GROUPS.map((group, groupIndex) => {
                                            const isOpen = openGroupId?.id === group.id;
                                            const activeInGroup = group.tools.find((id) => id === activeTool) ?? null;
                                            const iconId = activeInGroup ?? group.tools[0];
                                            const flyoutStyle = { left: openGroupId?.x ?? 0, top: openGroupId?.y ?? 0 };
                                            return (_jsxs(Fragment, { children: [_jsxs("div", { className: "gc-tools-group-container", children: [_jsxs("button", { type: "button", title: t(`tool.group.${group.id}`), "aria-expanded": isOpen, "aria-haspopup": "true", className: `gc-tool-btn gc-tool-btn--group${activeInGroup ? " gc-tool-btn--active" : ""}`, onClick: (e) => {
                                                                    if (isOpen) {
                                                                        setOpenGroupId(null);
                                                                        return;
                                                                    }
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    if (isCompactDrawingToolbarViewport) {
                                                                        const compactFlyoutButtonSize = MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE;
                                                                        const estimatedFlyoutWidth = Math.min(window.innerWidth - DRAWING_TOOL_FLYOUT_MARGIN * 2, group.tools.length * compactFlyoutButtonSize
                                                                            + Math.max(group.tools.length - 1, 0) * DRAWING_TOOL_FLYOUT_GAP
                                                                            + DRAWING_TOOL_FLYOUT_PADDING);
                                                                        const nextLeft = Math.max(DRAWING_TOOL_FLYOUT_MARGIN, Math.min(rect.left, window.innerWidth - estimatedFlyoutWidth - DRAWING_TOOL_FLYOUT_MARGIN));
                                                                        const nextTop = Math.max(DRAWING_TOOL_FLYOUT_MARGIN, Math.min(rect.bottom + 6, window.innerHeight - compactFlyoutButtonSize - DRAWING_TOOL_FLYOUT_MARGIN));
                                                                        setOpenGroupId({ id: group.id, x: nextLeft, y: nextTop });
                                                                        return;
                                                                    }
                                                                    const estimatedFlyoutHeight = Math.min(window.innerHeight - DRAWING_TOOL_FLYOUT_MARGIN * 2, group.tools.length * DRAWING_TOOL_FLYOUT_BUTTON_SIZE
                                                                        + Math.max(group.tools.length - 1, 0) * DRAWING_TOOL_FLYOUT_GAP
                                                                        + DRAWING_TOOL_FLYOUT_PADDING);
                                                                    const nextLeft = rect.right + 6 + DRAWING_TOOL_FLYOUT_WIDTH <= window.innerWidth - DRAWING_TOOL_FLYOUT_MARGIN
                                                                        ? rect.right + 6
                                                                        : Math.max(DRAWING_TOOL_FLYOUT_MARGIN, rect.left - DRAWING_TOOL_FLYOUT_WIDTH - 6);
                                                                    const nextTop = Math.max(DRAWING_TOOL_FLYOUT_MARGIN, Math.min(rect.top, window.innerHeight - estimatedFlyoutHeight - DRAWING_TOOL_FLYOUT_MARGIN));
                                                                    setOpenGroupId({ id: group.id, x: nextLeft, y: nextTop });
                                                                }, children: [_jsx(ToolIcon, { id: iconId }), _jsx("span", { className: "gc-tools-chevron", children: "\u25BE" })] }), isOpen && (_jsx("div", { className: "gc-tools-flyout", role: "menu", style: flyoutStyle, children: group.tools.map((toolId) => (_jsx("button", { type: "button", role: "menuitem", title: toolLabel(toolId), "aria-pressed": activeTool === toolId, className: `gc-tool-btn${activeTool === toolId ? " gc-tool-btn--active" : ""}`, onClick: () => { setActiveTool(toolId); setOpenGroupId(null); }, children: _jsx(ToolIcon, { id: toolId }) }, toolId))) }))] }), groupIndex < TOOL_GROUPS.length - 1 && _jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" })] }, group.id));
                                        }), _jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" }), _jsx("button", { type: "button", title: t("drawing.toggleList"), "aria-pressed": showDrawingList, className: `gc-tool-btn${showDrawingList ? " gc-tool-btn--active" : ""}`, onClick: () => setShowDrawingList((v) => !v), children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "5", y1: "4", x2: "14", y2: "4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("line", { x1: "5", y1: "8", x2: "14", y2: "8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("line", { x1: "5", y1: "12", x2: "14", y2: "12", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("circle", { cx: "2.5", cy: "4", r: "1.3", fill: "currentColor" }), _jsx("circle", { cx: "2.5", cy: "8", r: "1.3", fill: "currentColor" }), _jsx("circle", { cx: "2.5", cy: "12", r: "1.3", fill: "currentColor" })] }) }), activeTool !== "cursor" && activeTool !== "crosshair" && (_jsxs(_Fragment, { children: [_jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" }), _jsx("div", { className: "gc-tools-group", title: t("drawing.magnetSensitivity"), children: ["weak", "normal", "strong"].map((level) => (_jsx("button", { type: "button", title: t(`drawing.magnet.${level}`), "aria-pressed": magnetSensitivity === level, className: `gc-tool-btn gc-tool-btn--magnet${magnetSensitivity === level ? " gc-tool-btn--active" : ""}`, onClick: () => setMagnetSensitivity(level), children: MAGNET_TOLERANCE[level] }, level))) })] }))] })] }), _jsxs("section", { className: "gc-chart-area", children: [_jsxs("div", { className: "gc-ohlc-strip", children: [_jsxs("span", { className: "gc-ohlc-pair", children: [selectedSymbol, " ", _jsxs("span", { className: "gc-ohlc-tf", children: ["\u00B7 ", chartTimeframe] })] }), showOhlcMetrics ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "gc-ohlc-item", children: ["O ", _jsx("b", { children: priceFormat(lastBar.open) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["H ", _jsx("b", { className: "gc-col-up", children: priceFormat(lastBar.high) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["L ", _jsx("b", { className: "gc-col-dn", children: priceFormat(lastBar.low) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["C ", _jsx("b", { className: priceIsUp ? "gc-col-up" : "gc-col-dn", children: priceFormat(lastBar.close) })] }), _jsxs("span", { className: "gc-ohlc-item gc-ohlc-vol", children: [t("library.volumeShort"), " ", _jsx("b", { children: volumeFormat(lastBar.volume) })] }), _jsx("span", { className: "gc-ohlc-item gc-ohlc-bars", children: t("library.pairBars", { count: data.length }) })] })) : (_jsx("span", { className: "gc-ohlc-loading", children: ohlcStatusLabel }))] }), activeSource === "vninvest" && (vniError || whaleData) ? (_jsxs("div", { className: "gc-vni-panel", children: [vniError ? _jsx("div", { className: "gc-vni-panel__error", children: vniError }) : null, _jsx(WhalePanel, { data: whaleData })] })) : null, _jsxs("div", { className: "gc-chart-shell", ref: shellRef, style: { background: canvasBg }, children: [showDrawingList && (_jsxs("div", { className: "rsc-drawing-storage-toolbar", style: { left: storageToolbarPosition.x, top: storageToolbarPosition.y }, children: [_jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleExportDrawings, children: t("drawing.exportJson") }), _jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleImportButtonClick, children: t("drawing.importJson") }), _jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleClearDrawings, children: t("drawing.clearAll") }), _jsx("input", { ref: importInputRef, type: "file", accept: "application/json", hidden: true, onChange: handleImportFileChange })] })), dataStatus === "loading" && !hasWidgetData ? (_jsxs("div", { className: "gc-chart-placeholder gc-chart-loading", children: [_jsx("div", { className: "gc-spinner" }), _jsx("span", { children: activeSource === "vninvest" ? t("vninvest.loading") : t("library.loadingRealData") })] })) : dataStatus === "error" && activeSource === "vninvest" && !hasWidgetData ? (_jsx("div", { className: "gc-chart-placeholder gc-chart-error", children: _jsx("span", { children: vniError ?? t("vninvest.status.error") }) })) : (_jsx(VNStockChart, { adapter: chartAdapter, data: widgetData, panes: paneState.panes, engineRuntime: "legacy", locale: language, messages: widgetMessages, theme: theme, xExtents: xExtents, measurementEnabled: supportsMeasurementOverlay && activeTool === "crosshair", selectedDrawing: selectedDrawing, showDrawingPriceMarkers: showDrawingPriceMarkers, enableWhale: enableWhale, whaleThreshold: whaleThreshold, whaleOrders: activeSource === "vninvest" ? (whaleData?.whale_orders ?? undefined) : undefined, enableCVD: enableCVD, cvdMode: cvdMode, externalCvdSeries: activeSource === "vninvest" ? (orderFlowData?.cvd_series ?? undefined) : undefined, darkFlowStrength: activeSource === "vninvest" ? (orderFlowData?.dark_flow?.strength ?? null) : null, darkFlowSignalType: activeSource === "vninvest" ? (orderFlowData?.dark_flow?.signal_type ?? undefined) : undefined, onClick: handlePaperTradeClick, onContextMenu: handleReplayContextMenu, onVisibleDomainChange: handleVisibleDomainChange, onPaneSnapshotsChange: setWidgetPaneSnapshots, onPaneToggleVisibleRequest: paneState.toggleVisible, onPaneRemoveRequest: paneState.removePane, onPaneAddSeriesRequest: handlePaneAddSeriesRequest, onPaneToggleSeriesRequest: paneState.toggleSeriesVisible, onPaneRemoveSeriesRequest: paneState.removeSeries, onRuntimeCapabilitiesChange: setWidgetRuntimeCapabilities, renderPaneToolbar: renderWidgetPaneToolbar, renderPaneSplitter: chartReady ? renderWidgetPaneSplitter : undefined, children: supportsDrawingOverlays ? (_jsx(DrawingLayer, { activeTool: activeTool, interaction: drawingInteraction, magnetSensitivity: magnetSensitivity, onToolUsed: handleDrawingToolUsed, onContextMenu: handleDrawingContextMenu, liveMeasurementLabels: liveMeasurementLabels })) : null })), activeSource === "vninvest" && vniLoading && hasWidgetData && (_jsxs("div", { className: "gc-vni-backfill-overlay", "aria-live": "polite", "aria-label": t("vninvest.loading"), children: [_jsx("div", { className: "gc-spinner gc-spinner--sm" }), _jsx("span", { children: t("vninvest.loading") })] })), replayContextMenu && (_jsxs(_Fragment, { children: [_jsx("div", { className: "gc-replay-menu-backdrop", "aria-hidden": "true", onClick: closeReplayContextMenu }), _jsxs("div", { className: "gc-replay-menu", style: { left: replayContextMenu.x, top: replayContextMenu.y }, children: [_jsx("div", { className: "gc-replay-menu__meta", children: replayContextMenu.label }), _jsx("button", { type: "button", className: "gc-replay-menu__action", onClick: handleReplayFromHere, children: t("replay.fromHere") })] })] })), drawingContextMenu && drawingContextMenuDrawing && (_jsx(DrawingContextMenu, { ariaLabel: t("drawing.contextMenuTitle"), title: t("drawing.contextMenuTitle"), isDark: isDark, position: { x: drawingContextMenu.x, y: drawingContextMenu.y }, onClose: closeDrawingContextMenu, items: [
                                                { key: "copy", label: t("drawing.copy"), onSelect: copySelectedDrawing },
                                                { key: "paste", label: t("drawing.paste"), onSelect: pasteCopiedDrawing, disabled: drawingClipboardRef.current === null },
                                                { key: "clone", label: t("drawing.clone"), onSelect: cloneSelectedDrawing },
                                                {
                                                    key: "lock",
                                                    label: t(drawingContextMenuDrawing.locked ? "drawing.unlock" : "drawing.lock"),
                                                    onSelect: toggleSelectedLock,
                                                },
                                                {
                                                    key: "visibility",
                                                    label: t(drawingContextMenuDrawing.visible === false ? "drawing.show" : "drawing.hide"),
                                                    onSelect: toggleSelectedVisible,
                                                },
                                                { key: "front", label: t("drawing.bringToFront"), onSelect: bringSelectedToFront },
                                                { key: "back", label: t("drawing.sendToBack"), onSelect: sendSelectedToBack },
                                                ...(drawingContextMenuDrawing.groupId
                                                    ? [
                                                        {
                                                            key: "selectGroup",
                                                            label: t("drawing.selectGroup"),
                                                            onSelect: () => {
                                                                drawingInteraction.selectGroup(drawingContextMenuDrawing.groupId);
                                                                closeDrawingContextMenu();
                                                            },
                                                        },
                                                        {
                                                            key: "deleteGroup",
                                                            label: t("drawing.deleteGroup"),
                                                            onSelect: () => {
                                                                drawingInteraction.deleteGroup(drawingContextMenuDrawing.groupId);
                                                                closeDrawingContextMenu();
                                                            },
                                                            danger: true,
                                                        },
                                                    ]
                                                    : []),
                                                { key: "delete", label: t("drawing.delete"), onSelect: deleteSelected, danger: true },
                                                {
                                                    key: "addAlert",
                                                    label: t("drawing.alert.title"),
                                                    onSelect: () => {
                                                        const target = drawingContextMenuDrawing;
                                                        if (!target)
                                                            return;
                                                        updateDrawing(target.id, {
                                                            alertCondition: target.alertCondition
                                                                ? { ...target.alertCondition, enabled: !target.alertCondition.enabled }
                                                                : { direction: "either", enabled: true },
                                                        });
                                                        closeDrawingContextMenu();
                                                    },
                                                },
                                            ] })), _jsx(DrawingInspector, { drawing: selectedDrawing, labels: drawingInspectorLabels, textEditor: selectedDrawing?.type === "text" ? {
                                                active: isEditingText,
                                                value: drawingTextDraft,
                                                labels: drawingTextEditorLabels,
                                                onChange: setDrawingTextDraft,
                                                onStartEdit: handleStartTextEdit,
                                                onCommit: handleCommitTextEdit,
                                                onCancel: handleCancelTextEdit,
                                            } : undefined, position: drawingInspectorPosition, onUpdate: updateSelectedDrawing, onDelete: deleteSelected, onClone: cloneSelectedDrawing, onToggleLock: toggleSelectedLock, onToggleVisible: toggleSelectedVisible, onBringToFront: bringSelectedToFront, onSendToBack: sendSelectedToBack, onClose: handleCloseDrawingInspector }), showDrawingList && (_jsx(DrawingListPanel, { drawings: sortedDrawings, selectedId: selectedDrawingId ?? null, labels: drawingListPanelLabels, position: drawingListPosition, onSelect: selectDrawingById, onToggleVisible: toggleDrawingVisibleById, onToggleLocked: toggleDrawingLockedById, onDelete: deleteDrawingById })), paperTradePanelVisible && (_jsxs("div", { className: "gc-paper-trade-panel", children: [_jsxs("div", { className: "gc-paper-trade-panel__header", children: [_jsx("strong", { children: t("paperTrading.title") }), _jsxs("div", { className: "gc-paper-trade-panel__header-actions", children: [replayFinished && _jsx("span", { className: "gc-paper-trade-panel__chip", children: t("paperTrading.finalized") }), _jsx("button", { type: "button", className: "gc-paper-trade-panel__reset", onClick: handlePaperTradeReset, children: t("paperTrading.reset") })] })] }), _jsx("div", { className: "gc-paper-trade-panel__hint", children: t("paperTrading.hint") }), _jsxs("div", { className: "gc-paper-trade-panel__stats", children: [_jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.total") }), _jsx("strong", { className: "gc-paper-trade-panel__value", children: paperTradeHistory.length })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.wins") }), _jsx("strong", { className: "gc-paper-trade-panel__value gc-col-up", children: paperTradeSummary.wins })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.losses") }), _jsx("strong", { className: "gc-paper-trade-panel__value gc-col-dn", children: paperTradeSummary.losses })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.winRate") }), _jsx("strong", { className: "gc-paper-trade-panel__value", children: PERCENT_FORMAT(paperTradeSummary.winRate) })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.realized") }), _jsx("strong", { className: `gc-paper-trade-panel__value${paperTradeRealizedPnl >= 0 ? " gc-col-up" : " gc-col-dn"}`, children: formatSignedPrice(paperTradeRealizedPnl) })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.avgPnl") }), _jsx("strong", { className: `gc-paper-trade-panel__value${paperTradeSummary.averagePnl >= 0 ? " gc-col-up" : " gc-col-dn"}`, children: formatSignedPrice(paperTradeSummary.averagePnl) })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.unrealized") }), _jsx("strong", { className: `gc-paper-trade-panel__value${paperTradeUnrealizedPnl >= 0 ? " gc-col-up" : " gc-col-dn"}`, children: formatSignedPrice(paperTradeUnrealizedPnl) })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.avgBarsHeld") }), _jsx("strong", { className: "gc-paper-trade-panel__value", children: formatBarsHeld(Math.round(paperTradeSummary.averageBarsHeld), t("paperTrading.barsUnit")) })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.bestTrade") }), _jsx("strong", { className: "gc-paper-trade-panel__value gc-col-up", children: paperTradeSummary.bestTrade
                                                                        ? `${formatSignedPrice(paperTradeSummary.bestTrade.pnl)} · ${formatBarsHeld(paperTradeSummary.bestTrade.barsHeld, t("paperTrading.barsUnit"))}`
                                                                        : "—" })] }), _jsxs("div", { className: "gc-paper-trade-panel__stat", children: [_jsx("span", { className: "gc-paper-trade-panel__label", children: t("paperTrading.worstTrade") }), _jsx("strong", { className: "gc-paper-trade-panel__value gc-col-dn", children: paperTradeSummary.worstTrade
                                                                        ? `${formatSignedPrice(paperTradeSummary.worstTrade.pnl)} · ${formatBarsHeld(paperTradeSummary.worstTrade.barsHeld, t("paperTrading.barsUnit"))}`
                                                                        : "—" })] })] }), paperTradeReportVisible && (_jsxs("div", { className: "gc-paper-trade-panel__report", children: [_jsx("div", { className: "gc-paper-trade-panel__section-title", children: t("paperTrading.report") }), _jsx("div", { className: "gc-paper-trade-panel__journal-list", children: paperTradeJournal.length > 0 ? paperTradeJournal.map((trade, index) => (_jsxs("div", { className: `gc-paper-trade-panel__journal-item${trade.pnl >= 0 ? " gc-paper-trade-panel__journal-item--positive" : " gc-paper-trade-panel__journal-item--negative"}`, children: [_jsxs("div", { className: "gc-paper-trade-panel__journal-top", children: [_jsxs("strong", { children: ["#", paperTradeJournal.length - index] }), _jsx("span", { className: trade.pnl >= 0 ? "gc-col-up" : "gc-col-dn", children: formatSignedPrice(trade.pnl) })] }), _jsxs("div", { className: "gc-paper-trade-panel__journal-meta", children: [_jsx("span", { children: dateFormat(normalizeDate(trade.entryDate)) }), _jsx("span", { children: "\u2192" }), _jsx("span", { children: dateFormat(normalizeDate(trade.exitDate)) })] }), _jsxs("div", { className: "gc-paper-trade-panel__journal-meta", children: [_jsxs("span", { children: [priceFormat(trade.entryPrice), " \u2192 ", priceFormat(trade.exitPrice)] }), _jsx("span", { children: formatBarsHeld(trade.barsHeld, t("paperTrading.barsUnit")) })] })] }, `${trade.entryIndex}-${trade.exitIndex}-${index}`))) : (_jsx("div", { className: "gc-paper-trade-panel__journal-empty", children: t("paperTrading.empty") })) })] })), paperTradePosition ? (_jsxs("div", { className: "gc-paper-trade-panel__position", children: [_jsx("span", { className: "gc-paper-trade-panel__position-label", children: t("paperTrading.position") }), _jsx("strong", { children: t("paperTrading.open") }), _jsxs("div", { className: "gc-paper-trade-panel__position-meta", children: [_jsx("span", { children: t("paperTrading.entry") }), _jsx("span", { children: dateFormat(normalizeDate(paperTradePosition.entryDate)) }), _jsx("span", { children: priceFormat(paperTradePosition.entryPrice) })] })] })) : paperTradeHistory.length > 0 ? (_jsx("div", { className: "gc-paper-trade-panel__position gc-paper-trade-panel__position--idle", children: t("paperTrading.closed") })) : (_jsx("div", { className: "gc-paper-trade-panel__position gc-paper-trade-panel__position--idle", children: t("paperTrading.empty") }))] })), paneOverlayLayout.map(({ pane, labelTop, labelHeight }) => {
                                            return (_jsx(Fragment, { children: _jsx(PaneLabel, { label: paneLabel(pane), top: labelTop, height: labelHeight }) }, pane.id));
                                        })] })] }), settingsOpen ? (_jsx(PaneSettingsModal, { open: settingsOpen, section: settingsSection, onSectionChange: setSettingsSection, selectedPaneId: settingsPaneId, onSelectedPaneIdChange: setSettingsPaneId, paneState: paneState, maxVisiblePanes: maxVisiblePanes, onMaxVisiblePanesChange: setMaxVisiblePanes, maxVisibleBars: maxVisibleBars, onMaxVisibleBarsChange: setMaxVisibleBars, showNonTradingDays: showNonTradingDays, onShowNonTradingDaysChange: setShowNonTradingDays, showDrawingPriceMarkers: showDrawingPriceMarkers, onShowDrawingPriceMarkersChange: setShowDrawingPriceMarkers, enableWhale: enableWhale, onEnableWhaleChange: setEnableWhale, whaleThreshold: whaleThreshold, onWhaleThresholdChange: setWhaleThreshold, enableCVD: enableCVD, onEnableCVDChange: setEnableCVD, cvdMode: cvdMode, onCVDModeChange: setCVDMode, onAddPane: handleAddPane, onReset: handleResetSettings, isDark: isDark, toggleTheme: toggleTheme, onClose: closeSettings })) : null] }), _jsxs("footer", { className: "gc-bottombar", children: [CHART_RANGES.map((range) => (_jsx("button", { type: "button", className: `gc-bottom-btn${chartRange === range ? " gc-bottom-btn--active" : ""}`, "aria-pressed": chartRange === range, onClick: () => handleChartRangeChange(range), children: t(CHART_RANGE_LABEL_KEYS[range]) }, range))), _jsx("div", { className: "gc-bottombar-sep" }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.script") }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.alert") }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.trade") }), _jsx("div", { className: "gc-grow" }), _jsx("button", { type: "button", className: "gc-publish-btn", children: t("common.publish") })] }), _jsx(PATTokenModal, { isOpen: patModalOpen, initialTab: patModalInitialTab, client: vniClientRef.current, activeSource: activeSource, onSourceChange: handleSourceSwitch, onClose: () => setPatModalOpen(false), onConfigChange: handleVniConfigChange, onSaved: handlePATSaved, onFileLoaded: handleFileLoaded })] }) }));
}
