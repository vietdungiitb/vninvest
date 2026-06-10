import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HistoryFetchQueue } from "./historyFetchQueue.js";
import { format } from "d3-format";
import { PaneHeader, PaneLabel, IndicatorLegend, useDynamicPanes, DrawingLayer, DrawingContextMenu, DrawingDock, ReplayControlBar, PaperTradePanel, FloatingSelectionToolbar, DrawingInspector, DrawingListPanel, useDrawingInteraction, useDrawingStorage, createDrawingUiStyleVars, createDrawingSelectionToolbarModel, DRAWING_UI_TOKENS, resolveDrawingSelectionToolbarPosition, BarReplayController, MAGNET_TOLERANCE, ChartSplitter, useChartTheme, VNInvestCharts, resolveDrawingShortcut, subscribeDrawingStyleChanges, subscribeSeriesStyleChanges, widgetMessagesEn, widgetMessagesVi, AlertNotificationToast, DRAWING_SHORTCUTS, DrawingSemanticPointLegend, } from "../index.js";
import { restorePersistedStyleOverrides, saveCurrentStyleOverrides } from "./styleOverridesPersistence.js";
import { isCleanSmokeModeEnabled } from "./runtimeQueryParams.js";
import { PATTokenModal, VNSymbolSearch, WhalePanel } from "./components/index.js";
import { VNInvestClient } from "./dataSources/VNInvestClient.js";
import { VNInvestWebSocketClient } from "./dataSources/VNInvestWebSocketClient.js";
import { useDrawingAlertEvaluator } from "../lib/drawing/useDrawingAlertEvaluator.js";
import { drawingToolIcons } from "../lib/drawing/drawingToolIcons.js";
import { createDrawingContextMenuItems } from "../lib/drawing/drawingActionSurface.js";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "../lib/drawing/clipboard.js";
import { resolveSemanticPointLabels } from "../lib/drawing/renderCanvas.js";
import { getSelectedObjectIds } from "../lib/drawing/stateMachine.js";
import { applyBatchDelete, applyBatchLock, applyBatchVisible, applyBatchColor } from "../lib/drawing/multiSelectBatch.js";
import { enrichData } from "../lib/core/calculators/enrichData.js";
import { transformHeikinAshi } from "./heikinAshi.js";
import { getOfflineDemoBars, isBackfillGapExcessive, mergeBarsByDate } from "./demoData.js";
import { canRunHistoryScheduler } from "./historySchedulerPolicy.js";
import { binanceAdapter, LocalCacheAdapter, VNStocksAdapter } from "../lib/adapters/index.js";
import { VNInvestDataAdapter } from "../widget/adapters/VNInvestDataAdapter.js";
import { CHART_RANGE_LABEL_KEYS, CHART_RANGES, DEFAULT_CHART_RANGE, isChartRangeSatisfied, resolveChartRangeExtents, resolveChartRangeFetchStart, resolveChartRangeStart, } from "./chartRange.js";
import DemoPageShell from "./DemoPageShell.js";
import { DEFAULT_DEMO_SETTINGS, loadDemoSettings, saveDemoSettings } from "./demoSettings.js";
import { formatSeriesDisplayName, useDemoI18n } from "./i18n.js";
import { resolveDemoRuntimePolicy } from "./runtimePolicy.js";
import { resolveDemoRuntimeStatusBadge, resolveDemoTopbarStatusBadge } from "./topbarStatusBadge.js";
import { PaneSettingsModal } from "./PaneSettingsModal.js";
import { resolvePendingChartRangeSync, shouldReleaseDemoVisibleDomainControl, shouldRetainDemoVisibleDomainControl, shouldUseWidgetOwnedHistory } from "./widgetVisibleDomainAuthority.js";
import { computeLoadedWindow, computeMissingSegments, computeTargetWindow, shouldScheduleFetch } from "./historyWindowPlanner.js";
import { useStockChartAdapter } from "./useStockChartAdapter.js";
import { resolveReplayStartIndexOnDataSync, shouldOpenReplayContextMenu } from "./replayHelpers.js";
import { useViewportMetrics } from "./useViewportMetrics.js";
import { resolveFlyoutPosition } from "./flyoutPosition.js";
import { TOOL_LONG_PRESS_DELAY_MS, TOOL_TOOLTIP_AUTO_HIDE_MS, triggerTooltipHapticFeedback } from "./mobileToolLongPress.js";
import { applyResidentWindowPolicy } from "./residentWindowPolicy.js";
import { useWidgetRuntimeInvalidationBatch } from "./useWidgetRuntimeInvalidationBatch.js";
import { VNI_SYMBOL_STORAGE_KEY, VNI_TIMEFRAME_STORAGE_KEY, readStoredString, writeStoredValue, resolveTimeframeMs, normalizeVNITimeframe, priceFormat, volumeFormat, dateFormat, klineBarToRawOHLCV, BINANCE_TIMEFRAMES, VNI_TIMEFRAMES, CHART_TYPES, CANDLE_TYPE_STORAGE_KEY, CHART_TYPE_TO_SERIES, MAIN_PRICE_SERIES_TYPES, loadChartType, } from "./libraryShowcaseDomain.js";
import "./demo.css";
import "../lib/styles/pane-overlays.css";
// Widget CSS: loaded here so CSS variables cascade correctly (--gc-* → --vnsc-*)
import "../widget/styles/widget.css";
import "../widget/styles/paper-trade.css";
import "../widget/styles/replay.css";
import "../widget/styles/overlays.css";
import "../widget/styles/drawing.css";
import "../widget/styles/toolbar.css";
import "../widget/styles/header.css";
import "../widget/styles/footer.css";
import "../widget/styles/settings.css";
import { TOOL_GROUPS_V2 } from "./config/toolGroups.js";
import { useRecentTools } from "../lib/drawing/hooks/useRecentTools.js";
import { useFavoriteTools } from "../lib/drawing/hooks/useFavoriteTools.js";
const TOOL_GROUPS = TOOL_GROUPS_V2;
const MORE_TOOLS_FLYOUT_ID = "__more-tools";
const ALL_DRAWING_TOOL_IDS = TOOL_GROUPS.flatMap((group) => group.tools);
const ALL_DRAWING_TOOL_SET = new Set(ALL_DRAWING_TOOL_IDS);
const DRAWING_PANEL_WIDTH = 360;
const DRAWING_TOOL_FLYOUT_WIDTH = DRAWING_UI_TOKENS.railWidth;
const DRAWING_TOOL_FLYOUT_BUTTON_SIZE = DRAWING_UI_TOKENS.flyoutButtonSize;
const DRAWING_TOOL_FLYOUT_GAP = DRAWING_UI_TOKENS.railButtonGap;
const DRAWING_TOOL_FLYOUT_PADDING = DRAWING_UI_TOKENS.flyoutPadding;
const DRAWING_TOOL_FLYOUT_MARGIN = DRAWING_UI_TOKENS.flyoutMargin;
const MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE = DRAWING_UI_TOKENS.flyoutButtonSizeCompact;
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
function areDrawingSnapshotsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        const leftDrawing = left[index];
        const rightDrawing = right[index];
        if (leftDrawing.id !== rightDrawing.id
            || leftDrawing.type !== rightDrawing.type
            || leftDrawing.paneId !== rightDrawing.paneId
            || leftDrawing.yScaleId !== rightDrawing.yScaleId
            || leftDrawing.text !== rightDrawing.text
            || leftDrawing.zIndex !== rightDrawing.zIndex
            || leftDrawing.locked !== rightDrawing.locked
            || leftDrawing.visible !== rightDrawing.visible
            || JSON.stringify(leftDrawing.points) !== JSON.stringify(rightDrawing.points)
            || JSON.stringify(leftDrawing.style) !== JSON.stringify(rightDrawing.style)
            || JSON.stringify(leftDrawing.fibLevels ?? null) !== JSON.stringify(rightDrawing.fibLevels ?? null)
            || JSON.stringify(leftDrawing.fibLevelConfigs ?? null) !== JSON.stringify(rightDrawing.fibLevelConfigs ?? null)
            || JSON.stringify(leftDrawing.riskReward ?? null) !== JSON.stringify(rightDrawing.riskReward ?? null)
            || JSON.stringify(leftDrawing.segmentStyles ?? null) !== JSON.stringify(rightDrawing.segmentStyles ?? null)
            || JSON.stringify(leftDrawing.segmentVisible ?? null) !== JSON.stringify(rightDrawing.segmentVisible ?? null)
            || leftDrawing.clonedFrom !== rightDrawing.clonedFrom
            || leftDrawing.groupId !== rightDrawing.groupId
            || leftDrawing.symbol !== rightDrawing.symbol
            || leftDrawing.timeframe !== rightDrawing.timeframe
            || leftDrawing.extendLeft !== rightDrawing.extendLeft
            || leftDrawing.extendRight !== rightDrawing.extendRight
            || leftDrawing.showMeasurement !== rightDrawing.showMeasurement
            || JSON.stringify(leftDrawing.alertCondition ?? null) !== JSON.stringify(rightDrawing.alertCondition ?? null)
            || JSON.stringify(leftDrawing.alertConditions ?? null) !== JSON.stringify(rightDrawing.alertConditions ?? null)
            || JSON.stringify(leftDrawing.waveLabels ?? null) !== JSON.stringify(rightDrawing.waveLabels ?? null)
            || JSON.stringify(leftDrawing.harmonicRatios ?? null) !== JSON.stringify(rightDrawing.harmonicRatios ?? null)
            || leftDrawing.gannSquareSize !== rightDrawing.gannSquareSize
            || JSON.stringify(leftDrawing.cycleParams ?? null) !== JSON.stringify(rightDrawing.cycleParams ?? null)
            || leftDrawing.createdAt !== rightDrawing.createdAt) {
            return false;
        }
    }
    return true;
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
// GAP-17: build-time map of tool id → shortcut key for badge display
const TOOL_SHORTCUT_BADGE = Object.fromEntries(DRAWING_SHORTCUTS
    .filter((s) => s.action.type === "tool")
    .map((s) => [s.action.tool, s.key]));
// SVG tool icons
function ToolIcon({ id }) {
    const customIcon = drawingToolIcons[id];
    if (customIcon) {
        return _jsx(_Fragment, { children: customIcon });
    }
    switch (id) {
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
    const viewportMetrics = useViewportMetrics();
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
    const [chartResetKey, setChartResetKey] = useState(0);
    const [chartType, setChartType] = useState(() => loadChartType());
    const [showPanesMenu, setShowPanesMenu] = useState(false);
    const panesMenuRef = useRef(null);
    const [showProfileMenu, setShowProfileMenu] = useState(false);
    const profileMenuRef = useRef(null);
    const [activeSource, setActiveSource] = useState("binance");
    const activeSourceRef = useRef(activeSource);
    const [activeTool, setActiveTool] = useState("cursor");
    const { recentTools, pushRecent } = useRecentTools();
    const { favoriteTools, toggleFavorite, isFavorite } = useFavoriteTools();
    const [drawingWorkspace, setDrawingWorkspace] = useState(null);
    const [pendingDrawingDockTab, setPendingDrawingDockTab] = useState(null);
    const [openGroupId, setOpenGroupId] = useState(null);
    const [openFavoriteFlyout, setOpenFavoriteFlyout] = useState(null);
    const [mobileToolTooltip, setMobileToolTooltip] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [styleRevision, setStyleRevision] = useState(0);
    const toolbarRef = useRef(null);
    const toolLongPressTimerRef = useRef(null);
    const toolTooltipAutoHideTimerRef = useRef(null);
    const suppressToolTapRef = useRef(false);
    const altShortcutPressedRef = useRef(false);
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
    /** I-01: AI advisory state. */
    const [advisoryResult, setAdvisoryResult] = useState(null);
    const [advisoryLoading, setAdvisoryLoading] = useState(false);
    const [showAdvisory, setShowAdvisory] = useState(false);
    /** O-01: Tape (time-and-sales) state. */
    const [tapeEntries, setTapeEntries] = useState([]);
    const [tapeLoading, setTapeLoading] = useState(false);
    const [showTape, setShowTape] = useState(false);
    const [tapeFilterBillions, setTapeFilterBillions] = useState(0);
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
    const [enableWhale, setEnableWhale] = useState(initialDemoSettings.enableWhale ?? DEFAULT_DEMO_SETTINGS.enableWhale ?? true);
    const [whaleThreshold, setWhaleThreshold] = useState(initialDemoSettings.whaleThreshold ?? 1_000_000);
    const [enableCVD, setEnableCVD] = useState(initialDemoSettings.enableCVD ?? DEFAULT_DEMO_SETTINGS.enableCVD ?? false);
    const [cvdMode, setCVDMode] = useState(initialDemoSettings.cvdMode ?? DEFAULT_DEMO_SETTINGS.cvdMode ?? "oscillator");
    const [timezone, setTimezone] = useState(initialDemoSettings.timezone ?? "Asia/Ho_Chi_Minh");
    const [alertAudioEnabled, setAlertAudioEnabled] = useState(initialDemoSettings.alertAudioEnabled ?? false);
    const [runtimeLane, setRuntimeLane] = useState(initialDemoSettings.runtimeLane ?? "fork");
    const [alertToasts, setAlertToasts] = useState([]);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [showReplayBar, setShowReplayBar] = useState(false);
    const [drawingContextMenu, setDrawingContextMenu] = useState(null);
    const [drawingTextDraft, setDrawingTextDraft] = useState("");
    const [focusedSemanticPointIndex, setFocusedSemanticPointIndex] = useState(null);
    const [paperTradePosition, setPaperTradePosition] = useState(null);
    const [paperTradeHistory, setPaperTradeHistory] = useState([]);
    const previousSelectedDrawingIdRef = useRef(null);
    const chartRangeRef = useRef(chartRange);
    const paperTradePositionRef = useRef(null);
    const lastPaperTradeClickRef = useRef(null);
    const lastPaperTradeSignatureRef = useRef(null);
    const drawingInteraction = useDrawingInteraction();
    const { undo, redo, deleteSelected, cancelDrawing, selectObject, replaceDrawings, updateDrawing } = drawingInteraction;
    const drawingClipboardRef = useRef(null);
    const drawingCountRef = useRef(drawingInteraction.allDrawings.length);
    const drawingSnapshotsRef = useRef(drawingInteraction.allDrawings);
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
    const cleanSmokeMode = useMemo(() => isCleanSmokeModeEnabled(typeof window !== "undefined" ? window.location.search : ""), []);
    const drawingStorage = useDrawingStorage(selectedSymbol, chartTimeframe, drawingInteraction.allDrawings, handleLoadDrawings, undefined, { enabled: !cleanSmokeMode });
    const { theme, toggleTheme, isDark } = useChartTheme("light");
    const canvasBg = "var(--gc-surface)";
    const closeDrawingContextMenu = useCallback(() => setDrawingContextMenu(null), []);
    const widgetDrawingDockOpen = drawingWorkspace?.state.dock.isOpen ?? false;
    const runtimeSelectedDrawingType = drawingWorkspace?.state.selectedDrawing?.type ?? null;
    const demoRuntimePolicy = useMemo(() => resolveDemoRuntimePolicy({
        runtimeLane,
        activeTool,
        drawingCount: drawingInteraction.allDrawings.length,
        drawingDockRequested: pendingDrawingDockTab !== null || widgetDrawingDockOpen,
        selectedDrawingType: runtimeSelectedDrawingType,
    }), [activeTool, drawingInteraction.allDrawings.length, pendingDrawingDockTab, runtimeLane, runtimeSelectedDrawingType, widgetDrawingDockOpen]);
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
    useEffect(() => {
        drawingCountRef.current = drawingInteraction.allDrawings.length;
        drawingSnapshotsRef.current = drawingInteraction.allDrawings;
    }, [drawingInteraction.allDrawings.length]);
    const [visibleDomain, setVisibleDomain] = useState(null);
    const liveDataRef = useRef([]);
    const backfillInFlightRef = useRef(false);
    const warmupInFlightRef = useRef(false);
    const initialWarmupRequestedRef = useRef(false);
    const backfillDebounceRef = useRef(null);
    const mountedRef = useRef(true);
    const visibleDomainRef = useRef(null);
    const releaseWidgetVisibleDomainControlRef = useRef(false);
    const updateVisibleDomain = useCallback((nextVisibleDomain) => {
        const currentVisibleDomain = visibleDomainRef.current;
        if ((currentVisibleDomain === null && nextVisibleDomain === null) || (currentVisibleDomain !== null
            && nextVisibleDomain !== null
            && currentVisibleDomain[0].valueOf() === nextVisibleDomain[0].valueOf()
            && currentVisibleDomain[1].valueOf() === nextVisibleDomain[1].valueOf())) {
            return;
        }
        visibleDomainRef.current = nextVisibleDomain;
        setVisibleDomain(nextVisibleDomain);
    }, []);
    const pendingChartRangeSyncRef = useRef(false);
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
        if (dataAdapterName === "vninvest") {
            const pat = vniClientRef.current?.getPAT() ?? "";
            const apiBase = vniClientRef.current?.getBase();
            return new VNInvestDataAdapter({ patToken: pat, apiBase });
        }
        return binanceAdapter;
    }, [activeSource, dataAdapterName, localCacheAdapter]);
    const effectiveRuntimeLane = runtimeLane;
    const useWidgetOwnedHistory = shouldUseWidgetOwnedHistory({ activeSource, dataAdapterName });
    const applyResidentWindow = useCallback((bars) => {
        if (useWidgetOwnedHistory || activeSourceRef.current === "offline") {
            return bars;
        }
        return applyResidentWindowPolicy(bars, visibleDomainRef.current);
    }, [useWidgetOwnedHistory]);
    useEffect(() => {
        liveDataRef.current = liveData;
    }, [liveData]);
    useEffect(() => {
        chartRangeRef.current = chartRange;
    }, [chartRange]);
    useEffect(() => {
        if (!pendingChartRangeSyncRef.current || liveData.length === 0) {
            return;
        }
        updateVisibleDomain(resolveChartRangeExtents(liveData, chartRangeRef.current));
        pendingChartRangeSyncRef.current = resolvePendingChartRangeSync({ useWidgetOwnedHistory, rangeSatisfied: isChartRangeSatisfied(liveData, chartRangeRef.current) });
    }, [liveData, useWidgetOwnedHistory]);
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
    const { handleWidgetPaneSnapshotsChange, handleWidgetRuntimeCapabilitiesChange } = useWidgetRuntimeInvalidationBatch({
        runtimeLane: effectiveRuntimeLane,
        setWidgetPaneSnapshots,
        setWidgetRuntimeCapabilities,
    });
    const resolvedRuntimeForBadge = widgetRuntimeCapabilities?.engineRuntime ?? demoRuntimePolicy.predictedRuntime;
    const effectiveRuntimeCapabilities = useMemo(() => {
        if (widgetRuntimeCapabilities) {
            return widgetRuntimeCapabilities;
        }
        return {
            engineRuntime: demoRuntimePolicy.predictedRuntime,
            paneToolbar: true,
            paneSplitters: true,
            chartCanvasOverlays: true,
            measurementOverlay: true,
            drawingOverlays: demoRuntimePolicy.predictedRuntime === "legacy",
        };
    }, [demoRuntimePolicy.predictedRuntime, widgetRuntimeCapabilities]);
    const runtimeStatusBadge = resolveDemoRuntimeStatusBadge({
        requestedLane: runtimeLane,
        resolvedRuntime: resolvedRuntimeForBadge,
        chartCanvasOverlays: effectiveRuntimeCapabilities.chartCanvasOverlays,
        drawingOverlays: effectiveRuntimeCapabilities.drawingOverlays,
        t,
    });
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
        rrTitle: t("drawing.inspector.rrTitle"),
        rrEntry: t("drawing.inspector.rrEntry"),
        rrStop: t("drawing.inspector.rrStop"),
        rrTarget: t("drawing.inspector.rrTarget"),
        segmentsTitle: t("drawing.inspector.segmentsTitle"),
        alertTitle: t("drawing.alert.title"),
        alertEnabled: t("drawing.alert.enabled"),
        alertDirection: t("drawing.alert.direction"),
        alertCooldown: t("drawing.alert.cooldown"),
        alertCrossAbove: t("drawing.alert.crossAbove"),
        alertCrossBelow: t("drawing.alert.crossBelow"),
        alertEither: t("drawing.alert.either"),
        templatesTitle: t("drawing.template.title"),
        templatesSave: t("drawing.template.save"),
        templatesDelete: t("drawing.template.delete"),
        templatesLoad: t("drawing.template.load"),
        templatesNamePlaceholder: t("drawing.template.placeholder"),
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
    const drawingDockLabels = useMemo(() => ({
        title: t("drawing.dockTitle"),
        close: t("drawing.close"),
        properties: t("drawing.dockProperties"),
        objects: t("drawing.dockObjects"),
        templates: t("drawing.dockTemplates"),
        emptyProperties: t("drawing.dockPropertiesEmpty"),
        emptyObjects: t("drawing.dockObjectsEmpty"),
        emptyTemplates: t("drawing.dockTemplatesEmpty"),
    }), [t]);
    const drawingSelectionToolbarLabels = useMemo(() => ({
        clone: t("drawing.clone"),
        lock: t("drawing.lock"),
        unlock: t("drawing.unlock"),
        hide: t("drawing.hide"),
        show: t("drawing.show"),
        edit: t("drawing.textEditorEdit"),
        bringToFront: t("drawing.bringToFront"),
        sendToBack: t("drawing.sendToBack"),
        delete: t("drawing.delete"),
        openProperties: t("drawing.openProperties"),
    }), [t]);
    const drawingSemanticPointLegendLabels = useMemo(() => ({
        title: t("drawing.pointLegendTitle"),
        empty: t("drawing.pointLegendEmpty"),
        hint: t("drawing.pointLegendHint"),
        clear: t("drawing.pointLegendClear"),
    }), [t]);
    const handleSemanticPointFocusChange = useCallback((index) => {
        setFocusedSemanticPointIndex(index);
    }, []);
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
        drawingWorkspace?.setActiveTool("cursor");
    }, [drawingWorkspace, selectObject]);
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
            timezone,
            alertAudioEnabled,
            runtimeLane,
        });
    }, [maxVisibleBars, maxVisiblePanes, showNonTradingDays, showDrawingPriceMarkers, enableWhale, whaleThreshold, enableCVD, cvdMode, timezone, alertAudioEnabled, runtimeLane]);
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
        if (source === "vninvest") {
            setDataAdapterName("vninvest");
            if (!vniHasPAT) {
                openPATModal("login");
                return;
            }
        }
        if (source === "offline") {
            setDataAdapterName("local");
            // always open modal so user can load a file
            openPATModal("paste");
            return;
        }
        if (source === "binance") {
            setDataAdapterName("binance");
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
                updateVisibleDomain(null);
            }
        }
    }, []);
    /** N-04: Update the last bar's close/high/low with the live WS price (no re-fetch). */
    const handleTickerUpdate = useCallback((event) => {
        if (!mountedRef.current || activeSourceRef.current !== "vninvest" || useWidgetOwnedHistory) {
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
    }, [useWidgetOwnedHistory]);
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
        ws.setOnWhaleAlert((evt) => {
            // O-01: Pipe whale alerts into tape as synthetic entries
            const entry = {
                id: `ws-${Date.now()}-${Math.random()}`,
                ts: evt.ts ?? new Date().toISOString(),
                price: evt.price ?? 0,
                volume: 0,
                value: evt.value ?? 0,
                side: evt.side ?? "unknown",
                is_whale: true,
            };
            setTapeEntries((prev) => [...prev, entry].slice(-500));
        });
        ws.connect();
        ws.subscribe([vniSymbol]);
        vniWsRef.current = ws;
        return () => {
            ws.destroy();
            vniWsRef.current = null;
        };
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
    }, [activeSource, vniHasPAT, vniSymbol]);
    /** I-01: Debounce advisory fetch 3 s after symbol changes while showAdvisory is active. */
    useEffect(() => {
        if (!showAdvisory || activeSource !== "vninvest" || !vniHasPAT)
            return;
        const client = vniClientRef.current;
        if (!client)
            return;
        const timer = setTimeout(async () => {
            const symbol = vniSymbolRef.current.trim().toUpperCase();
            if (!symbol)
                return;
            setAdvisoryLoading(true);
            try {
                const resp = await client.getAdvisorySession(symbol);
                setAdvisoryResult(resp?.result ?? null);
            }
            catch { /* non-fatal */ }
            finally {
                setAdvisoryLoading(false);
            }
        }, 3_000);
        return () => clearTimeout(timer);
    }, [showAdvisory, activeSource, vniHasPAT, vniSymbol]);
    /** O-01: Poll tape every 5 s while showTape is active with VNI source + PAT. */
    useEffect(() => {
        if (!showTape || activeSource !== "vninvest" || !vniHasPAT)
            return;
        const client = vniClientRef.current;
        if (!client)
            return;
        let cancelled = false;
        const fetchTape = async () => {
            setTapeLoading(true);
            try {
                const symbol = vniSymbolRef.current.trim().toUpperCase();
                if (!symbol)
                    return;
                const data = await client.getTapeEntries(symbol);
                if (!cancelled && data?.entries) {
                    setTapeEntries((prev) => {
                        const known = new Set(prev.map((e) => e.id));
                        const fresh = data.entries.filter((e) => !known.has(e.id));
                        if (fresh.length === 0)
                            return prev;
                        return [...prev, ...fresh].slice(-500);
                    });
                }
            }
            catch { /* non-fatal */ }
            finally {
                if (!cancelled)
                    setTapeLoading(false);
            }
        };
        void fetchTape();
        const intervalId = setInterval(() => { void fetchTape(); }, 5_000);
        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
    }, [showTape, activeSource, vniHasPAT, vniSymbol]);
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
            updateVisibleDomain(null);
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
            updateVisibleDomain(null);
            pendingChartRangeSyncRef.current = false;
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
        updateVisibleDomain(null);
        pendingChartRangeSyncRef.current = false;
        queueRef.current.clearAll();
        schedulerGenerationRef.current += 1;
        backfillInFlightRef.current = false;
        vniSnapshotIdRef.current = null;
        try {
            const to = Date.now();
            const from = resolveChartRangeFetchStart(new Date(to), chartRangeRef.current).valueOf();
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
            const nextBars = applyResidentWindow(page.bars);
            vniSnapshotIdRef.current = page.snapshotId;
            setLiveData(nextBars);
            pendingChartRangeSyncRef.current = !isChartRangeSatisfied(nextBars, chartRangeRef.current);
            updateVisibleDomain(resolveChartRangeExtents(nextBars, chartRangeRef.current));
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
    }, [applyResidentWindow, t, vniSymbol, vniTimeframe]);
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
                    setLiveData((previous) => applyResidentWindow(mergeBarsByDate(page.bars, previous)));
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
            // Gap guard: reject backward page if time gap is excessive
            if (isBackfillGapExcessive(olderBars, liveDataRef.current, timeframe)) {
                console.warn("[data-gap-guard] requestOlderHistoryPage: rejected page with excessive time gap");
                return;
            }
            setLiveData((current) => applyResidentWindow(mergeBarsByDate(olderBars, current)));
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
    }, [applyResidentWindow, dataAdapter, timeframe]);
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
                // Gap guard: reject backward page if time gap is excessive
                if (isBackfillGapExcessive(olderBars, currentBars, timeframe)) {
                    console.warn("[data-gap-guard] ensureRangeHistory: rejected page with excessive time gap");
                    break;
                }
                currentBars = applyResidentWindow(mergeBarsByDate(olderBars, currentBars));
                pagesLoaded += 1;
                setLiveData(currentBars);
            }
            if (mountedRef.current && currentBars.length > 0) {
                updateVisibleDomain(resolveChartRangeExtents(currentBars, range));
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
    }, [applyResidentWindow, dataAdapter, timeframe]);
    const handleVisibleDomainChange = useCallback((domain) => {
        // Do not drive setVisibleDomain from viewport callbacks; that re-controls xExtents and can reset the chart.
        lastViewportMissingRef.current = null;
        const normalizedDomain = normalizeDomain(domain);
        const previousVisibleDomain = visibleDomainRef.current;
        visibleDomainRef.current = normalizedDomain;
        if (previousVisibleDomain !== null && releaseWidgetVisibleDomainControlRef.current && shouldReleaseDemoVisibleDomainControl({ useWidgetOwnedHistory, range: chartRangeRef.current, pendingChartRangeSync: pendingChartRangeSyncRef.current })) {
            releaseWidgetVisibleDomainControlRef.current = false;
            setVisibleDomain(null);
        }
        const shouldEvaluateViewportBackfill = previousVisibleDomain === null;
        // VNInvest backfill should only react to user pan/zoom, not the one-shot controlled-domain sync.
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
        if (!earliestBar) {
            return;
        }
        const timeframeMs = resolveTimeframeMs(vniTimeframeRef.current);
        const leftBufferMs = timeframeMs * 5;
        const viewportStart = normalizedDomain[0];
        const isNearOldestEdge = viewportStart.valueOf() <= earliestBar.date.valueOf() + leftBufferMs;
        if (isNearOldestEdge) {
            triggerBackfillDebounced();
        }
    }, [normalizeDomain, triggerBackfillDebounced, useWidgetOwnedHistory]);
    const handleChartRangeChange = useCallback((range) => {
        lastViewportMissingRef.current = null;
        releaseWidgetVisibleDomainControlRef.current = false;
        chartRangeRef.current = range;
        setChartRange(range);
        setChartResetKey((k) => k + 1);
        if (activeSourceRef.current === "vninvest") {
            const currentBars = liveDataRef.current;
            if (currentBars.length > 0 && range !== "All") {
                const neededStart = resolveChartRangeStart(normalizeDate(currentBars[currentBars.length - 1].date), range);
                const oldestBar = normalizeDate(currentBars[0].date);
                if (neededStart.valueOf() < oldestBar.valueOf()) {
                    pendingChartRangeSyncRef.current = true;
                    updateVisibleDomain(resolveChartRangeExtents(currentBars, range));
                    triggerBackfillDebounced();
                    return;
                }
                pendingChartRangeSyncRef.current = false;
                updateVisibleDomain(resolveChartRangeExtents(currentBars, range));
                return;
            }
            if (currentBars.length === 0) {
                void handleLoadVNIChart();
                return;
            }
            pendingChartRangeSyncRef.current = false;
            updateVisibleDomain(resolveChartRangeExtents(currentBars, range));
            return;
        }
        const currentBars = liveDataRef.current;
        if (currentBars.length > 0) {
            pendingChartRangeSyncRef.current = resolvePendingChartRangeSync({ useWidgetOwnedHistory, rangeSatisfied: isChartRangeSatisfied(currentBars, range) });
            releaseWidgetVisibleDomainControlRef.current = shouldReleaseDemoVisibleDomainControl({ useWidgetOwnedHistory, range, pendingChartRangeSync: pendingChartRangeSyncRef.current });
            updateVisibleDomain(resolveChartRangeExtents(currentBars, range));
        }
        if (useWidgetOwnedHistory) {
            return;
        }
        void ensureRangeHistory(range);
    }, [ensureRangeHistory, handleLoadVNIChart, triggerBackfillDebounced, useWidgetOwnedHistory]);
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
                // Gap guard: reject backward page if time gap is excessive
                if (isBackfillGapExcessive(olderBars, currentBars, timeframe)) {
                    console.warn("[data-gap-guard] warmupInitialBinanceHistory: rejected page with excessive time gap");
                    break;
                }
                currentBars = applyResidentWindow(mergeBarsByDate(olderBars, currentBars));
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
    }, [applyResidentWindow, dataAdapter, timeframe]);
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
        const loaded = computeLoadedWindow(currentBars);
        if (!loaded)
            return;
        // Capped viewport.endMs at loaded.endMs to prevent future space triggering massive backfill
        const adjustedViewport = {
            startMs: viewport.startMs,
            endMs: Math.min(viewport.endMs, loaded.endMs),
        };
        // If the viewport is completely in the future, don't schedule backfill
        if (adjustedViewport.startMs >= adjustedViewport.endMs) {
            return;
        }
        const target = computeTargetWindow(adjustedViewport, { leftPrefetchRatio: 2.0, rightPrefetchRatio: 0.5 });
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
        if (useWidgetOwnedHistory) {
            setDataStatus("loading");
            setDataError("");
            setHistoryStatus("idle");
            setLiveData([]);
            updateVisibleDomain(null);
            pendingChartRangeSyncRef.current = false;
            return () => {
                queueRef.current.clearAll();
            };
        }
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
        updateVisibleDomain(null);
        pendingChartRangeSyncRef.current = false;
        dataAdapter.getBars({ type: "init", symbol: "BTCUSDT", interval: timeframe, limit: BACKFILL_PAGE_LIMIT, timestamp: null, signal: abortController.signal })
            .then((result) => {
            if (abortController.signal.aborted || !mountedRef.current)
                return;
            const bars = result.bars.map(klineBarToRawOHLCV);
            const nextBars = applyResidentWindow(bars);
            setLiveData(nextBars);
            pendingChartRangeSyncRef.current = !isChartRangeSatisfied(nextBars, chartRangeRef.current);
            updateVisibleDomain(resolveChartRangeExtents(nextBars, chartRangeRef.current));
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
            const nextBars = applyResidentWindow(offlineBars);
            setLiveData(nextBars);
            pendingChartRangeSyncRef.current = !isChartRangeSatisfied(nextBars, chartRangeRef.current);
            updateVisibleDomain(resolveChartRangeExtents(nextBars, chartRangeRef.current));
            setDataStatus("offline");
        });
        return () => {
            abortController.abort();
            schedulerGenerationRef.current += 1; // invalidate pending jobs on cleanup
            queueRef.current.clearAll();
        };
    }, [activeSource, applyResidentWindow, dataAdapter, timeframe, useWidgetOwnedHistory, warmupInitialBinanceHistory]);
    useEffect(() => {
        if (activeSource !== "vninvest" || useWidgetOwnedHistory) {
            return;
        }
        if (!vniHasPAT) {
            const message = t("vninvest.error.noPAT");
            setLiveData([]);
            updateVisibleDomain(null);
            pendingChartRangeSyncRef.current = false;
            setVniError(message);
            setDataError(message);
            setDataStatus("error");
            setWhaleData(null);
            return;
        }
        void handleLoadVNIChart();
    }, [activeSource, handleLoadVNIChart, t, vniConfigVersion, vniHasPAT, vniTimeframe, useWidgetOwnedHistory]);
    // Fetch whale feed when using widget owned history and symbol changes
    useEffect(() => {
        if (!useWidgetOwnedHistory || activeSource !== "vninvest" || !vniHasPAT) {
            return;
        }
        const client = vniClientRef.current;
        if (!client)
            return;
        let active = true;
        void client.getWhaleFeed(vniSymbol)
            .then((feed) => {
            if (active) {
                setWhaleData(feed);
            }
        })
            .catch(() => {
            if (active) {
                setWhaleData(null);
            }
        });
        return () => {
            active = false;
        };
    }, [activeSource, useWidgetOwnedHistory, vniHasPAT, vniSymbol]);
    // Scheduler interval: dequeue and execute pending backfill jobs
    useEffect(() => {
        if (activeSource !== "binance" || useWidgetOwnedHistory) {
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
                    currentBars = applyResidentWindow(mergeBarsByDate(olderRaw.map(klineBarToRawOHLCV), currentBars));
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
    }, [activeSource, applyResidentWindow, dataAdapter, timeframe, scheduleForViewport, useWidgetOwnedHistory]);
    const data = useMemo(() => {
        if (activeSource === "vninvest") {
            return liveData;
        }
        if (useWidgetOwnedHistory) {
            return liveData;
        }
        return liveData.length > 0 ? liveData : getOfflineDemoBars();
    }, [activeSource, liveData, useWidgetOwnedHistory]);
    useEffect(() => {
        if (activeSource !== "binance" || dataStatus !== "live" || useWidgetOwnedHistory) {
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
                setLiveData((current) => applyResidentWindow(mergeBarsByDate(current, latestBars)));
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
    }, [activeSource, applyResidentWindow, dataAdapter, dataStatus, timeframe, useWidgetOwnedHistory]);
    useEffect(() => {
        if (useWidgetOwnedHistory && activeSource === "binance") {
            return;
        }
        const currentVisibleDomain = visibleDomainRef.current;
        const currentLiveData = liveDataRef.current;
        if (activeSource === "offline" || dataStatus !== "live" || historyStatus === "backfilling" || warmupInFlightRef.current || currentVisibleDomain === null || currentLiveData.length === 0) {
            return;
        }
        const earliestBar = currentLiveData[0];
        const latestBar = currentLiveData[currentLiveData.length - 1];
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
    }, [activeSource, dataStatus, historyStatus, triggerBackfillDebounced, useWidgetOwnedHistory, vniTimeframe]);
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
        const handleKeyDown = (event) => {
            if (event.key === "Alt") {
                altShortcutPressedRef.current = true;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
                const activeEl = document.activeElement;
                const isInput = activeEl && (activeEl.tagName === "INPUT"
                    || activeEl.tagName === "TEXTAREA"
                    || activeEl.getAttribute("contenteditable") === "true");
                if (!isInput) {
                    event.preventDefault();
                }
            }
        };
        const handleKeyUp = (event) => {
            if (event.key === "Alt") {
                altShortcutPressedRef.current = false;
            }
        };
        const handleWindowBlur = () => {
            altShortcutPressedRef.current = false;
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener("blur", handleWindowBlur);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
            window.removeEventListener("blur", handleWindowBlur);
        };
    }, []);
    useEffect(() => {
        const controller = replayControllerRef.current;
        if (!controller) {
            return;
        }
        const unsubscribe = controller.subscribe(setReplayState);
        return () => {
            unsubscribe();
            controller.dispose();
        };
    }, []);
    useEffect(() => {
        const controller = replayControllerRef.current;
        if (!controller) {
            return;
        }
        const currentState = controller.getState();
        const nextStartIndex = resolveReplayStartIndexOnDataSync({
            currentIndex: currentState.currentIndex,
            previousTotal: currentState.allData.length,
            nextTotal: data.length,
        });
        controller.setData(data, nextStartIndex);
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
    const xExtents = useMemo(() => visibleDomain ?? undefined, [visibleDomain]);
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
            let toolLabel = drawing.type;
            try {
                toolLabel = t(`tool.${drawing.type}`);
            }
            catch {
                // fallback
            }
            const dirLabel = condition.direction === "crossAbove"
                ? t("alert.crossAbove")
                : condition.direction === "crossBelow"
                    ? t("alert.crossBelow")
                    : t("alert.at");
            setAlertToasts((prev) => {
                const nextToast = {
                    id: `${drawing.id}-${Date.now()}-${Math.random()}`,
                    drawingType: toolLabel,
                    direction: condition.direction === "either" ? "crossAbove" : condition.direction,
                    price,
                    timestamp: Date.now(),
                    directionLabel: dirLabel,
                };
                return [nextToast, ...prev].slice(0, 5);
            });
        }, [t]),
    });
    const selectedDrawing = useMemo(() => sortedDrawings.find((drawing) => drawing.id === selectedDrawingId) ?? null, [selectedDrawingId, sortedDrawings]);
    const resolvedSelectedDrawing = drawingWorkspace?.state.selectedDrawing ?? selectedDrawing;
    const shouldControlWidgetSelection = effectiveRuntimeCapabilities.engineRuntime !== "fork";
    const widgetSelectedDrawing = shouldControlWidgetSelection ? resolvedSelectedDrawing : undefined;
    const workspaceSelectedIds = drawingWorkspace?.state.selectedIds ?? [];
    const isMultiSelect = workspaceSelectedIds.length > 1
        || (!drawingWorkspace && drawingInteraction.drawingState.type === "selectedMultiple");
    const hasDrawingSelection = Boolean(resolvedSelectedDrawing) || isMultiSelect;
    const multiSelectedDrawings = useMemo(() => {
        if (!isMultiSelect)
            return [];
        const selectedIds = workspaceSelectedIds.length > 0
            ? workspaceSelectedIds
            : getSelectedObjectIds(drawingInteraction.drawingState);
        return drawingInteraction.allDrawings.filter((d) => selectedIds.includes(d.id));
    }, [isMultiSelect, workspaceSelectedIds, drawingInteraction.drawingState, drawingInteraction.allDrawings]);
    const multiAllLocked = useMemo(() => multiSelectedDrawings.every((d) => d.locked), [multiSelectedDrawings]);
    const multiAllHidden = useMemo(() => multiSelectedDrawings.every((d) => d.visible === false), [multiSelectedDrawings]);
    const resolvedActiveTool = drawingWorkspace?.state.activeTool ?? activeTool;
    const isEditingText = drawingInteraction.drawingState.type === "editing"
        && resolvedSelectedDrawing?.type === "text"
        && drawingInteraction.drawingState.objectId === resolvedSelectedDrawing.id;
    const drawingContextMenuDrawing = useMemo(() => {
        if (!drawingContextMenu) {
            return null;
        }
        return sortedDrawings.find((drawing) => drawing.id === drawingContextMenu.drawingId) ?? resolvedSelectedDrawing;
    }, [drawingContextMenu, resolvedSelectedDrawing, sortedDrawings]);
    const drawingPanelX = useMemo(() => Math.max(16, chartWidth - DRAWING_PANEL_WIDTH - 16), [chartWidth]);
    const drawingDockPosition = useMemo(() => ({ x: drawingPanelX, y: Math.max(16, viewportMetrics.offsetTop + 16) }), [drawingPanelX, viewportMetrics.offsetTop]);
    const storageToolbarPosition = useMemo(() => ({
        x: Math.max(16, viewportMetrics.offsetLeft + 16),
        y: Math.max(16, viewportMetrics.offsetTop + 16),
    }), [viewportMetrics.offsetLeft, viewportMetrics.offsetTop]);
    const drawingDockState = drawingWorkspace?.state.dock ?? { isOpen: false, activeTab: "properties" };
    const isDrawingDockOpen = drawingDockState.isOpen;
    const isObjectsDockActive = drawingDockState.isOpen && drawingDockState.activeTab === "objects";
    const drawingSelectionToolbarModel = useMemo(() => createDrawingSelectionToolbarModel(resolvedSelectedDrawing, drawingSelectionToolbarLabels), [drawingSelectionToolbarLabels, resolvedSelectedDrawing]);
    const drawingSelectionToolbarPosition = useMemo(() => resolveDrawingSelectionToolbarPosition({
        drawing: resolvedSelectedDrawing,
        paneSnapshots: widgetPaneSnapshots,
        plotData: chartData,
        visibleDomain,
        shellSize: { width: chartWidth, height: chartHeight },
    }), [chartData, chartHeight, chartWidth, resolvedSelectedDrawing, visibleDomain, widgetPaneSnapshots]);
    // Semantic point selector (A/B/C/D etc.) for Elliott and harmonic pattern drawings
    const drawingSelectionSemanticPoints = useMemo(() => {
        if (!resolvedSelectedDrawing)
            return null;
        const labels = resolveSemanticPointLabels(resolvedSelectedDrawing);
        if (!labels || labels.length === 0)
            return null;
        const prices = resolvedSelectedDrawing.points.map((p) => p.y);
        return { labels, activeIndex: focusedSemanticPointIndex, prices };
    }, [resolvedSelectedDrawing, focusedSemanticPointIndex]);
    const drawingTextEditorLabels = useMemo(() => ({
        title: t("drawing.textEditorTitle"),
        label: t("drawing.textEditorLabel"),
        placeholder: t("drawing.textEditorPlaceholder"),
        edit: t("drawing.textEditorEdit"),
        save: t("drawing.textEditorSave"),
        cancel: t("drawing.textEditorCancel"),
        empty: t("drawing.textEditorEmpty"),
    }), [t]);
    useEffect(() => {
        if (!drawingWorkspace) {
            return;
        }
        // Track previous selected ID only — dock opens explicitly via settings button
        const selectedDrawingId = resolvedSelectedDrawing?.id ?? null;
        previousSelectedDrawingIdRef.current = selectedDrawingId;
    }, [drawingWorkspace, resolvedSelectedDrawing?.id]);
    useEffect(() => {
        setFocusedSemanticPointIndex(null);
    }, [resolvedSelectedDrawing?.id]);
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
        const targetReplayDate = moreProps.currentItem?.date ?? replayState.currentBar?.date;
        const shellNode = shellRef.current;
        const nativeEvent = event;
        const sourceEvent = nativeEvent?.sourceEvent;
        const hasAltModifier = Boolean(nativeEvent?.altKey || sourceEvent?.altKey || altShortcutPressedRef.current);
        const isTouchPointerContext = nativeEvent?.pointerType === "touch" || nativeEvent?.pointerType === "pen";
        const isCoarsePointerContext = typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0);
        const isContextTrigger = Boolean(nativeEvent?.button === 2
            || sourceEvent?.button === 2
            || nativeEvent?.type === "contextmenu"
            || sourceEvent?.type === "contextmenu");
        const isAltRightClick = hasAltModifier && isContextTrigger;
        const isTouchLongPress = isTouchPointerContext || (isCoarsePointerContext && isContextTrigger && !hasAltModifier);
        if (!shouldOpenReplayContextMenu({
            showReplayBar,
            hasCurrentItemDate: Boolean(targetReplayDate),
            hasShellNode: Boolean(shellNode),
            hasDrawingContextMenu: Boolean(drawingContextMenu),
            isAltRightClick,
            isTouchLongPress,
        })) {
            return;
        }
        if (!targetReplayDate || !shellNode)
            return;
        nativeEvent?.preventDefault();
        sourceEvent?.preventDefault();
        const rect = shellNode.getBoundingClientRect();
        const x = Math.min(Math.max(12, (nativeEvent?.clientX ?? rect.left) - rect.left + 8), Math.max(12, rect.width - 198));
        const y = Math.min(Math.max(12, (nativeEvent?.clientY ?? rect.top) - rect.top + 8), Math.max(12, rect.height - 92));
        setReplayContextMenu({
            x,
            y,
            date: targetReplayDate,
            label: dateFormat(normalizeDate(targetReplayDate)),
        });
    }, [dateFormat, drawingContextMenu, replayState.currentBar?.date, showReplayBar]);
    const handlePaperTradeReset = useCallback(() => {
        setPaperTradePosition(null);
        setPaperTradeHistory([]);
        paperTradePositionRef.current = null;
        lastPaperTradeSignatureRef.current = null;
    }, []);
    const handlePaperTradeClose = useCallback(() => {
        replayController?.pause();
        setShowReplayBar(false);
        handlePaperTradeReset();
    }, [replayController, handlePaperTradeReset]);
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
    const [openRecentFlyout, setOpenRecentFlyout] = useState(null);
    const railFavoriteTools = useMemo(() => favoriteTools.filter((toolId) => ALL_DRAWING_TOOL_SET.has(toolId)), [favoriteTools]);
    useEffect(() => {
        setOpenRecentFlyout(null);
        setOpenFavoriteFlyout(null);
        setMobileToolTooltip(null);
    }, [resolvedActiveTool]);
    useEffect(() => () => {
        if (toolLongPressTimerRef.current)
            clearTimeout(toolLongPressTimerRef.current);
        if (toolTooltipAutoHideTimerRef.current)
            clearTimeout(toolTooltipAutoHideTimerRef.current);
    }, []);
    useEffect(() => {
        if (!selectedPane && paneState.panes.length > 0) {
            setSelectedPaneId(paneState.visiblePanes[0]?.id ?? paneState.panes[0].id);
        }
    }, [paneState.panes, paneState.visiblePanes, selectedPane]);
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
    useEffect(() => {
        const pricePane = paneState.panes.find((pane) => pane.id === "price");
        if (!pricePane)
            return;
        const desiredType = CHART_TYPE_TO_SERIES[chartType];
        const primary = pricePane.series.find((s) => MAIN_PRICE_SERIES_TYPES.includes(s.type));
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
            const rect = node.getBoundingClientRect();
            const w = Math.floor(rect.width);
            const h = Math.floor(rect.height);
            if (w > 0 && h > 0) {
                setChartWidth(w);
                setChartHeight(h);
            }
        };
        readSize();
        const observer = new ResizeObserver(readSize);
        observer.observe(node);
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
    const supportsInteractiveChartOverlays = effectiveRuntimeCapabilities.chartCanvasOverlays;
    const supportsMeasurementOverlay = effectiveRuntimeCapabilities.measurementOverlay;
    const supportsDrawingOverlays = effectiveRuntimeCapabilities.drawingOverlays;
    const widgetDrawingUiEnabled = demoRuntimePolicy.drawingUiEnabled;
    const chartAdapter = useStockChartAdapter({
        activeSource,
        dataAdapter,
        selectedSymbol,
        useWidgetOwnedHistory,
        widgetData,
        backfillPageLimit: BACKFILL_PAGE_LIMIT,
    });
    const widgetMessages = language === "vi" ? widgetMessagesVi : widgetMessagesEn;
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
    useEffect(() => {
        if (!openGroupId)
            return;
        const handler = (e) => {
            const target = e.target;
            const inToolbar = toolbarRef.current?.contains(target);
            const inFlyout = Array.from(document.querySelectorAll(".gc-tools-flyout")).some((flyout) => flyout.contains(target));
            if (!inToolbar && !inFlyout) {
                setOpenGroupId(null);
                setOpenRecentFlyout(null);
                setOpenFavoriteFlyout(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [openGroupId]);
    const ratio = window.devicePixelRatio || 1;
    const isCompactDrawingToolbarViewport = typeof window !== "undefined"
        ? (window.matchMedia("(max-width: 1024px)").matches && (window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0))
        : false;
    const resolveToolFlyoutPosition = useCallback((rect, itemCount) => resolveFlyoutPosition({
        rect,
        itemCount,
        isCompactViewport: isCompactDrawingToolbarViewport,
        viewportMetrics,
        flyoutMargin: DRAWING_TOOL_FLYOUT_MARGIN,
        flyoutPadding: DRAWING_TOOL_FLYOUT_PADDING,
        flyoutGap: DRAWING_TOOL_FLYOUT_GAP,
        flyoutButtonSize: DRAWING_TOOL_FLYOUT_BUTTON_SIZE,
        compactFlyoutButtonSize: MOBILE_DRAWING_TOOL_FLYOUT_BUTTON_SIZE,
        flyoutWidth: DRAWING_TOOL_FLYOUT_WIDTH,
    }), [isCompactDrawingToolbarViewport, viewportMetrics]);
    const priceIsUp = (lastBar?.close ?? 0) >= (lastBar?.open ?? 0);
    const showOhlcMetrics = Boolean(lastBar) && (activeSource === "vninvest" ? dataStatus === "live" : dataStatus !== "loading");
    const ohlcStatusLabel = activeSource === "vninvest"
        ? (dataStatus === "error" ? (vniError ?? t("vninvest.status.error")) : t("vninvest.loading"))
        : t("library.loadingPriceData");
    const drawingUiStyleVars = useMemo(() => createDrawingUiStyleVars(), []);
    const handleDrawingWorkspaceChange = useCallback((workspace) => { setDrawingWorkspace(workspace); }, []);
    useEffect(() => {
        if (!drawingWorkspace) {
            return;
        }
        if (drawingWorkspace.state.activeTool !== activeTool) {
            drawingWorkspace.setActiveTool(activeTool);
        }
    }, [activeTool, drawingWorkspace]);
    useEffect(() => {
        if (!drawingWorkspace || !pendingDrawingDockTab) {
            return;
        }
        drawingWorkspace.openDock(pendingDrawingDockTab);
        setPendingDrawingDockTab(null);
    }, [drawingWorkspace, pendingDrawingDockTab]);
    useEffect(() => {
        if (runtimeLane === "fork" && pendingDrawingDockTab !== null) {
            setPendingDrawingDockTab(null);
        }
    }, [pendingDrawingDockTab, runtimeLane]);
    const handleWidgetBarsChange = useCallback((bars) => {
        if (!useWidgetOwnedHistory) {
            return;
        }
        const normalizedBars = bars.map((bar) => ({
            date: bar.date instanceof Date ? bar.date : new Date(bar.date),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
        }));
        setLiveData(normalizedBars);
        if (normalizedBars.length > 0) {
            setDataStatus("live");
            setDataError("");
            if (pendingChartRangeSyncRef.current) {
                updateVisibleDomain(resolveChartRangeExtents(normalizedBars, chartRangeRef.current));
                pendingChartRangeSyncRef.current = resolvePendingChartRangeSync({ useWidgetOwnedHistory, rangeSatisfied: isChartRangeSatisfied(normalizedBars, chartRangeRef.current) });
                releaseWidgetVisibleDomainControlRef.current = shouldReleaseDemoVisibleDomainControl({ useWidgetOwnedHistory, range: chartRangeRef.current, pendingChartRangeSync: pendingChartRangeSyncRef.current });
            }
            else if (shouldRetainDemoVisibleDomainControl({ useWidgetOwnedHistory, range: chartRangeRef.current, pendingChartRangeSync: pendingChartRangeSyncRef.current })) {
                updateVisibleDomain(visibleDomainRef.current ?? resolveChartRangeExtents(normalizedBars, chartRangeRef.current));
            }
        }
    }, [useWidgetOwnedHistory]);
    const handleWidgetError = useCallback((error) => {
        if (!useWidgetOwnedHistory) {
            return;
        }
        setDataStatus("error");
        setDataError(error.message);
    }, [useWidgetOwnedHistory]);
    const applyActiveTool = useCallback((tool) => {
        setActiveTool(tool);
        if (tool !== "cursor")
            pushRecent(tool);
        drawingWorkspace?.setActiveTool(tool);
    }, [drawingWorkspace]);
    const handleDrawingToolUsed = useCallback(() => applyActiveTool("cursor"), [applyActiveTool]);
    const handleToolbarToolPressStart = useCallback((toolId) => {
        suppressToolTapRef.current = false;
        if (toolLongPressTimerRef.current)
            clearTimeout(toolLongPressTimerRef.current);
        if (toolTooltipAutoHideTimerRef.current)
            clearTimeout(toolTooltipAutoHideTimerRef.current);
        toolLongPressTimerRef.current = setTimeout(() => { suppressToolTapRef.current = true; setMobileToolTooltip(toolLabel(toolId)); triggerTooltipHapticFeedback(); toolTooltipAutoHideTimerRef.current = setTimeout(() => setMobileToolTooltip(null), TOOL_TOOLTIP_AUTO_HIDE_MS); }, TOOL_LONG_PRESS_DELAY_MS);
    }, [toolLabel]);
    const handleToolbarToolPressEnd = useCallback(() => { if (toolLongPressTimerRef.current) {
        clearTimeout(toolLongPressTimerRef.current);
        toolLongPressTimerRef.current = null;
    } }, []);
    const getToolTouchHandlers = useCallback((toolId) => ({ onPointerDown: () => handleToolbarToolPressStart(toolId), onPointerUp: handleToolbarToolPressEnd, onPointerCancel: handleToolbarToolPressEnd, onPointerLeave: handleToolbarToolPressEnd, onTouchStart: () => handleToolbarToolPressStart(toolId), onTouchEnd: handleToolbarToolPressEnd, onTouchCancel: handleToolbarToolPressEnd, onContextMenu: (event) => event.preventDefault() }), [handleToolbarToolPressEnd, handleToolbarToolPressStart]);
    const handleToolbarToolTap = useCallback((toolId, closeRecentFlyout) => {
        if (suppressToolTapRef.current) {
            suppressToolTapRef.current = false;
            return;
        }
        if (toolTooltipAutoHideTimerRef.current) {
            clearTimeout(toolTooltipAutoHideTimerRef.current);
            toolTooltipAutoHideTimerRef.current = null;
        }
        setMobileToolTooltip(null);
        applyActiveTool(toolId);
        setOpenGroupId(null);
        setOpenFavoriteFlyout(null);
        if (closeRecentFlyout)
            setOpenRecentFlyout(null);
        setSearchQuery("");
    }, [applyActiveTool]);
    const handleWidgetDrawingsChange = useCallback((nextDrawings) => {
        if (areDrawingSnapshotsEqual(drawingSnapshotsRef.current, nextDrawings)) {
            return;
        }
        const previousCount = drawingCountRef.current;
        replaceDrawings([...nextDrawings]);
        if (resolvedActiveTool !== "cursor" && resolvedActiveTool !== "crosshair" && nextDrawings.length > previousCount) {
            if (toolTooltipAutoHideTimerRef.current) {
                clearTimeout(toolTooltipAutoHideTimerRef.current);
                toolTooltipAutoHideTimerRef.current = null;
            }
            setMobileToolTooltip(null);
            applyActiveTool("cursor");
        }
    }, [applyActiveTool, replaceDrawings, resolvedActiveTool]);
    const handleCloseDrawingDock = useCallback(() => {
        setPendingDrawingDockTab(null);
        drawingWorkspace?.closeDock();
        closeDrawingContextMenu();
        cancelDrawing();
        applyActiveTool("cursor");
    }, [applyActiveTool, cancelDrawing, closeDrawingContextMenu, drawingWorkspace]);
    const handleToggleDrawingDock = useCallback((tab) => {
        if (!drawingWorkspace) {
            if (runtimeLane === "auto") {
                setPendingDrawingDockTab((current) => current === tab ? null : tab);
            }
            return;
        }
        if (drawingWorkspace.state.dock.isOpen && drawingWorkspace.state.dock.activeTab === tab) {
            setPendingDrawingDockTab(null);
            drawingWorkspace.closeDock();
            return;
        }
        setPendingDrawingDockTab(null);
        drawingWorkspace.openDock(tab);
    }, [drawingWorkspace, runtimeLane]);
    const handleWidgetSelectedDrawingChange = useCallback((drawing) => {
        if (!drawing) {
            if ((drawingWorkspace?.state.selectedIds.length ?? 0) > 1) {
                return;
            }
            cancelDrawing();
            return;
        }
        selectObject(drawing.id);
    }, [cancelDrawing, drawingWorkspace?.state.selectedIds.length, selectObject]);
    const updateSelectedDrawing = useCallback((patch) => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        updateDrawing(resolvedSelectedDrawing.id, patch);
    }, [resolvedSelectedDrawing, updateDrawing]);
    const toggleSelectedLock = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        updateSelectedDrawing({ locked: !resolvedSelectedDrawing.locked });
    }, [resolvedSelectedDrawing, updateSelectedDrawing]);
    const toggleSelectedVisible = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        updateSelectedDrawing({ visible: resolvedSelectedDrawing.visible === false });
    }, [resolvedSelectedDrawing, updateSelectedDrawing]);
    const bringSelectedToFront = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        const maxZ = drawingInteraction.allDrawings.reduce((currentMax, drawing) => Math.max(currentMax, drawing.zIndex ?? 0), 0);
        updateDrawing(resolvedSelectedDrawing.id, { zIndex: maxZ + 1 });
    }, [drawingInteraction.allDrawings, resolvedSelectedDrawing, updateDrawing]);
    const sendSelectedToBack = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        const minZ = drawingInteraction.allDrawings.reduce((currentMin, drawing) => Math.min(currentMin, drawing.zIndex ?? 0), 0);
        updateDrawing(resolvedSelectedDrawing.id, { zIndex: minZ - 1 });
    }, [drawingInteraction.allDrawings, resolvedSelectedDrawing, updateDrawing]);
    const cloneSelectedDrawing = useCallback(() => {
        if (!resolvedSelectedDrawing || chartWidth <= 0 || chartHeight <= 0 || plotData.length < 2) {
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
        const nextClone = offsetDrawingByPixels(resolvedSelectedDrawing, timeOffset, priceOffset, resolveDrawingPlacementForPane(resolvedSelectedDrawing, selectedPane));
        replaceDrawings([...drawingInteraction.allDrawings, nextClone]);
        selectObject(nextClone.id);
        applyActiveTool("cursor");
    }, [applyActiveTool, chartHeight, chartWidth, drawingInteraction.allDrawings, plotData, replaceDrawings, selectObject, resolvedSelectedDrawing, selectedPane]);
    const copySelectedDrawing = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        drawingClipboardRef.current = cloneDrawingSnapshot(resolvedSelectedDrawing);
    }, [resolvedSelectedDrawing]);
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
        applyActiveTool("cursor");
    }, [applyActiveTool, chartHeight, chartWidth, drawingInteraction.allDrawings, plotData, replaceDrawings, selectObject, selectedPane]);
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
        if (!resolvedSelectedDrawing || !["text", "callout", "priceLabel"].includes(resolvedSelectedDrawing.type)) {
            return;
        }
        drawingInteraction.startEditing(resolvedSelectedDrawing.id, resolvedSelectedDrawing.text ?? "");
        setDrawingTextDraft(resolvedSelectedDrawing.text ?? "");
    }, [drawingInteraction, resolvedSelectedDrawing]);
    const handleCommitTextEdit = useCallback(() => {
        if (!resolvedSelectedDrawing || !["text", "callout", "priceLabel"].includes(resolvedSelectedDrawing.type)) {
            return;
        }
        updateDrawing(resolvedSelectedDrawing.id, { text: drawingTextDraft });
        cancelDrawing();
        selectObject(resolvedSelectedDrawing.id);
        applyActiveTool("cursor");
    }, [applyActiveTool, cancelDrawing, drawingTextDraft, selectObject, resolvedSelectedDrawing, updateDrawing]);
    const handleCancelTextEdit = useCallback(() => {
        if (resolvedSelectedDrawing && ["text", "callout", "priceLabel"].includes(resolvedSelectedDrawing.type)) {
            setDrawingTextDraft(resolvedSelectedDrawing.text ?? "");
        }
        cancelDrawing();
        if (resolvedSelectedDrawing) {
            selectObject(resolvedSelectedDrawing.id);
        }
        applyActiveTool("cursor");
    }, [applyActiveTool, cancelDrawing, selectObject, resolvedSelectedDrawing]);
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
                applyActiveTool(shortcut.tool);
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
                    applyActiveTool("cursor");
                    return;
                case "toggleMagnet":
                    setMagnetSensitivity((prev) => {
                        if (prev === "off")
                            return "weak";
                        if (prev === "weak")
                            return "normal";
                        if (prev === "normal")
                            return "strong";
                        return "off";
                    });
                    return;
                case "lockSelected":
                    toggleSelectedLock();
                    return;
                case "hideSelected":
                    toggleSelectedVisible();
                    return;
            }
        };
        window.addEventListener("keydown", handleDrawingShortcuts);
        return () => window.removeEventListener("keydown", handleDrawingShortcuts);
    }, [applyActiveTool, cancelDrawing, closeDrawingContextMenu, cloneSelectedDrawing, copySelectedDrawing, deleteSelected, pasteCopiedDrawing, redo, undo, toggleSelectedLock, toggleSelectedVisible]);
    const handleSelectionToolbarAction = useCallback((actionId) => {
        switch (actionId) {
            case "clone":
                cloneSelectedDrawing();
                return;
            case "toggleLock":
                toggleSelectedLock();
                return;
            case "toggleVisibility":
                toggleSelectedVisible();
                return;
            case "editText":
                handleStartTextEdit();
                return;
            case "bringToFront":
                bringSelectedToFront();
                return;
            case "sendToBack":
                sendSelectedToBack();
                return;
            case "delete":
                {
                    const fallbackSelectedId = drawingWorkspace?.state.selectedIds[0] ?? getSelectedDrawingId(drawingInteraction.drawingState);
                    const targetId = resolvedSelectedDrawing?.id ?? fallbackSelectedId;
                    if (targetId) {
                        deleteDrawingById(targetId);
                        return;
                    }
                }
                if (resolvedSelectedDrawing) {
                    deleteDrawingById(resolvedSelectedDrawing.id);
                    return;
                }
                deleteSelected();
                return;
            case "openProperties":
                handleToggleDrawingDock("properties");
                return;
        }
    }, [bringSelectedToFront, cloneSelectedDrawing, deleteDrawingById, deleteSelected, drawingInteraction.drawingState, drawingWorkspace, handleStartTextEdit, handleToggleDrawingDock, resolvedSelectedDrawing, sendSelectedToBack, toggleSelectedLock, toggleSelectedVisible]);
    const templatesContent = useMemo(() => {
        const toolType = resolvedSelectedDrawing?.type || resolvedActiveTool;
        if (toolType === "cursor" || toolType === "crosshair") {
            return (_jsx("div", { className: "rsc-drawing-dock__empty", children: "Kh\u00F4ng h\u1ED7 tr\u1EE3 l\u01B0u m\u1EABu cho Cursor / Crosshair" }));
        }
        let hasTemplate = false;
        let styleData = null;
        let segData = null;
        try {
            const rawStyle = localStorage.getItem(`rsc-drawing-template-${toolType}`);
            if (rawStyle) {
                styleData = JSON.parse(rawStyle);
                hasTemplate = true;
            }
            const rawSegs = localStorage.getItem(`rsc-drawing-template-segs-${toolType}`);
            if (rawSegs) {
                segData = JSON.parse(rawSegs);
            }
        }
        catch { /* ignore */ }
        const handleApplyTemplate = () => {
            if (!hasTemplate)
                return;
            if (resolvedSelectedDrawing) {
                const patch = { style: { ...resolvedSelectedDrawing.style, ...styleData } };
                if (segData) {
                    patch.segmentStyles = { ...resolvedSelectedDrawing.segmentStyles, ...segData };
                }
                updateSelectedDrawing(patch);
                setStyleRevision(v => v + 1);
            }
        };
        const handleClearTemplate = () => {
            try {
                localStorage.removeItem(`rsc-drawing-template-${toolType}`);
                localStorage.removeItem(`rsc-drawing-template-segs-${toolType}`);
                setStyleRevision(v => v + 1);
            }
            catch { /* ignore */ }
        };
        if (!hasTemplate) {
            return (_jsxs("div", { className: "rsc-drawing-dock__empty", style: { padding: "20px 12px", textAlign: "center", color: "#888", fontSize: "11px" }, children: ["Ch\u01B0a l\u01B0u m\u1EABu m\u1EB7c \u0111\u1ECBnh cho lo\u1EA1i c\u00F4ng c\u1EE5 v\u1EBD n\u00E0y.", _jsx("br", {}), "H\u00E3y v\u1EBD n\u00E9t v\u1EBD, tinh ch\u1EC9nh m\u00E0u s\u1EAFc, r\u1ED3i ch\u1ECDn \"L\u01B0u l\u00E0m m\u1EB7c \u0111\u1ECBnh\" \u1EDF tab thu\u1ED9c t\u00EDnh."] }));
        }
        return (_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "12px", padding: "12px" }, children: [_jsxs("div", { style: {
                        background: "rgba(255, 255, 255, 0.03)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        borderRadius: "8px",
                        padding: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                    }, children: [_jsxs("strong", { style: { fontSize: "12px", color: "#fff" }, children: ["M\u1EB7c \u0111\u1ECBnh cho ", toolLabel(toolType)] }), _jsxs("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }, children: [styleData.stroke && (_jsxs("span", { style: { display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", color: "#888" }, children: [_jsx("span", { style: { width: "12px", height: "12px", borderRadius: "50%", background: styleData.stroke, border: "1px solid rgba(255,255,255,0.2)" } }), "M\u00E0u n\u00E9t"] })), styleData.strokeWidth && (_jsxs("span", { style: { fontSize: "10px", color: "#888" }, children: ["\u00B7 \u0110\u1ED9 d\u00E0y: ", styleData.strokeWidth, "px"] })), styleData.strokeDasharray && (_jsxs("span", { style: { fontSize: "10px", color: "#888" }, children: ["\u00B7 N\u00E9t: ", styleData.strokeDasharray] }))] }), segData && (_jsxs("div", { style: { borderTop: "1px solid rgba(255, 255, 255, 0.06)", paddingTop: "6px" }, children: [_jsx("span", { style: { fontSize: "10px", fontWeight: "bold", color: "#aaa", display: "block", marginBottom: "4px" }, children: "M\u00E0u ph\u00E2n \u0111o\u1EA1n:" }), _jsx("div", { style: { display: "flex", gap: "6px", flexWrap: "wrap" }, children: Object.entries(segData).map(([key, value]) => (_jsxs("span", { style: { display: "flex", alignItems: "center", gap: "3px", fontSize: "9px", color: "#888" }, children: [_jsx("span", { style: { width: "10px", height: "10px", borderRadius: "2px", background: value.stroke || "#fff" } }), key] }, key))) })] }))] }), _jsxs("div", { style: { display: "flex", gap: "8px" }, children: [_jsx("button", { type: "button", className: "rsc-drawing-inspector__button", style: { flex: 1, fontSize: "11px" }, disabled: !resolvedSelectedDrawing, onClick: handleApplyTemplate, children: "\u00C1p d\u1EE5ng cho n\u00E9t v\u1EBD hi\u1EC7n t\u1EA1i" }), _jsx("button", { type: "button", className: "rsc-drawing-inspector__button rsc-drawing-inspector__button--danger", style: { flex: 0.6, fontSize: "11px" }, onClick: handleClearTemplate, children: "X\u00F3a m\u1EABu" })] })] }));
    }, [resolvedSelectedDrawing, resolvedActiveTool, updateSelectedDrawing, styleRevision]);
    const drawingChrome = (_jsxs(_Fragment, { children: [(resolvedSelectedDrawing || isMultiSelect) && !drawingContextMenu ? (_jsx(FloatingSelectionToolbar, { model: isMultiSelect ? null : drawingSelectionToolbarModel, position: drawingSelectionToolbarPosition, ariaLabel: t("drawing.inspectorTitle"), isDark: isDark, onAction: handleSelectionToolbarAction, semanticPoints: isMultiSelect ? null : drawingSelectionSemanticPoints, onSemanticPointFocus: isMultiSelect ? undefined : setFocusedSemanticPointIndex, drawing: isMultiSelect ? null : resolvedSelectedDrawing, onUpdate: isMultiSelect ? undefined : updateSelectedDrawing, selectedCount: isMultiSelect ? multiSelectedDrawings.length : undefined, allLocked: isMultiSelect ? multiAllLocked : undefined, allHidden: isMultiSelect ? multiAllHidden : undefined, onDeleteAll: isMultiSelect ? () => {
                    const selectedIds = getSelectedObjectIds(drawingInteraction.drawingState);
                    replaceDrawings(applyBatchDelete(drawingInteraction.allDrawings, selectedIds));
                    cancelDrawing();
                } : undefined, onLockAll: isMultiSelect ? (locked) => {
                    const selectedIds = getSelectedObjectIds(drawingInteraction.drawingState);
                    replaceDrawings(applyBatchLock(drawingInteraction.allDrawings, selectedIds, locked));
                } : undefined, onSetVisibleAll: isMultiSelect ? (visible) => {
                    const selectedIds = getSelectedObjectIds(drawingInteraction.drawingState);
                    replaceDrawings(applyBatchVisible(drawingInteraction.allDrawings, selectedIds, visible));
                } : undefined, onBatchColor: isMultiSelect ? (color) => {
                    const selectedIds = getSelectedObjectIds(drawingInteraction.drawingState);
                    replaceDrawings(applyBatchColor(drawingInteraction.allDrawings, selectedIds, color));
                } : undefined }, isMultiSelect ? "multi-select-toolbar" : resolvedSelectedDrawing.id)) : null, drawingContextMenu && drawingContextMenuDrawing && (_jsx(DrawingContextMenu, { ariaLabel: t("drawing.contextMenuTitle"), title: t("drawing.contextMenuTitle"), isDark: isDark, position: { x: drawingContextMenu.x, y: drawingContextMenu.y }, onClose: closeDrawingContextMenu, items: createDrawingContextMenuItems(drawingContextMenuDrawing, drawingClipboardRef.current !== null, {
                    copy: t("drawing.copy"),
                    paste: t("drawing.paste"),
                    bringToFront: t("drawing.bringToFront"),
                    sendToBack: t("drawing.sendToBack"),
                    selectGroup: t("drawing.selectGroup"),
                    deleteGroup: t("drawing.deleteGroup"),
                }, {
                    copySelectedDrawing,
                    pasteCopiedDrawing,
                    bringSelectedToFront,
                    sendSelectedToBack,
                    selectGroup: (groupId) => {
                        drawingInteraction.selectGroup(groupId);
                        closeDrawingContextMenu();
                    },
                    deleteGroup: (groupId) => {
                        drawingInteraction.deleteGroup(groupId);
                        closeDrawingContextMenu();
                    },
                }) })), _jsx(AlertNotificationToast, { items: alertToasts, onDismiss: (id) => setAlertToasts((prev) => prev.filter((t) => t.id !== id)), audioEnabled: alertAudioEnabled })] }));
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
        seriesLabel: (seriesType, params) => formatSeriesDisplayName(seriesType, params, t),
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
    const renderWidgetPaneSplitter = useCallback(({ pane, splitterIndex, top, left, right }) => {
        return (_jsx(ChartSplitter, { splitterIndex: splitterIndex, available: available, onCommitDelta: applyDelta, onDoubleClick: resetToDefault, title: t("library.splitterHint"), style: { top, left, right } }, `${pane.id}-splitter`));
    }, [available, applyDelta, resetToDefault, t]);
    const closeSettings = useCallback(() => {
        setSettingsOpen(false);
    }, []);
    const handleResetSettings = useCallback(() => {
        paneState.resetToDefault();
        setMaxVisiblePanes(DEFAULT_DEMO_SETTINGS.maxVisiblePanes);
        setMaxVisibleBars(DEFAULT_DEMO_SETTINGS.maxVisibleBars);
        setShowNonTradingDays(DEFAULT_DEMO_SETTINGS.showNonTradingDays);
        setShowDrawingPriceMarkers(DEFAULT_DEMO_SETTINGS.showDrawingPriceMarkers);
        setEnableWhale(DEFAULT_DEMO_SETTINGS.enableWhale ?? true);
        setWhaleThreshold(DEFAULT_DEMO_SETTINGS.whaleThreshold ?? 1_000_000);
        setEnableCVD(DEFAULT_DEMO_SETTINGS.enableCVD ?? false);
        setCVDMode(DEFAULT_DEMO_SETTINGS.cvdMode ?? "oscillator");
        setTimezone(DEFAULT_DEMO_SETTINGS.timezone ?? "Asia/Ho_Chi_Minh");
        setAlertAudioEnabled(DEFAULT_DEMO_SETTINGS.alertAudioEnabled ?? false);
        setRuntimeLane(DEFAULT_DEMO_SETTINGS.runtimeLane ?? "fork");
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
                                                }, disabled: pane.pinned, title: pane.pinned ? t("library.primaryPaneLocked") : pane.visible ? t("library.hidePane") : t("library.showPane"), children: [pane.visible ? (_jsx("svg", { width: "12", height: "12", viewBox: "0 0 12 12", fill: "none", style: { marginRight: 6, flexShrink: 0 }, children: _jsx("path", { d: "M2 6l3 3 5-5", stroke: "#2962ff", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }) })) : (_jsx("span", { style: { display: "inline-block", width: 18, flexShrink: 0 } })), paneLabel(pane), pane.pinned && _jsx("span", { style: { marginLeft: 4, fontSize: 10, opacity: 0.5 }, children: "\uD83D\uDD12" })] }, pane.id))) }))] })] }), _jsxs("div", { className: "gc-topbar__right", children: [topbarStatusBadge && _jsx("span", { className: topbarStatusBadge.className, title: topbarStatusBadge.title, children: topbarStatusBadge.label }), runtimeStatusBadge && _jsx("span", { className: runtimeStatusBadge.className, title: runtimeStatusBadge.title, children: runtimeStatusBadge.label }), historyStatus === "backfilling" && activeSource === "binance" && _jsx("span", { className: "gc-loading-badge", children: t("library.backfillingHistory") }), _jsxs("div", { className: "gc-chart-type-wrap", ref: profileMenuRef, children: [_jsx("button", { type: "button", className: `gc-topbar-btn${showProfileMenu ? " gc-topbar-btn--active" : ""}`, onClick: () => setShowProfileMenu((v) => !v), title: t("profile.menu"), "aria-label": t("profile.menu"), "aria-haspopup": "menu", "aria-expanded": showProfileMenu, children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "5.2", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M3.2 13.2c.8-2.4 2.8-3.8 4.8-3.8s4 1.4 4.8 3.8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }) }), showProfileMenu ? (_jsxs("div", { className: "gc-chart-type-menu gc-chart-type-menu--right gc-profile-menu", role: "menu", "aria-label": t("profile.menu"), children: [_jsxs("div", { className: "gc-profile-menu__section-label", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "6.5", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1.5C8 1.5 5.5 4.5 5.5 8s2.5 6.5 2.5 6.5M8 1.5C8 1.5 10.5 4.5 10.5 8S8 14.5 8 14.5M1.5 8h13", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round" })] }), t("language.label")] }), _jsxs("div", { className: "gc-profile-menu__lang-row", role: "group", "aria-label": t("language.label"), children: [_jsxs("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${language === "vi" ? " gc-chart-type-item--active" : ""}`, onClick: () => setLanguage("vi"), role: "menuitem", children: ["\uD83C\uDDFB\uD83C\uDDF3 ", t("language.vi")] }), _jsxs("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${language === "en" ? " gc-chart-type-item--active" : ""}`, onClick: () => setLanguage("en"), role: "menuitem", children: ["\uD83C\uDDFA\uD83C\uDDF8 ", t("language.en")] })] }), _jsx("div", { className: "gc-profile-menu__divider" }), _jsxs("div", { className: "gc-profile-menu__section-label", children: [_jsxs("svg", { width: "12", height: "12", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M3 3.5h10M3 8h10M3 12.5h10", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("circle", { cx: "5", cy: "3.5", r: "1.1", fill: "currentColor" }), _jsx("circle", { cx: "8", cy: "8", r: "1.1", fill: "currentColor" }), _jsx("circle", { cx: "11", cy: "12.5", r: "1.1", fill: "currentColor" })] }), t("library.runtimeLane.label")] }), _jsxs("div", { className: "gc-profile-menu__lang-row", role: "group", "aria-label": t("library.runtimeLane.label"), children: [_jsx("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${runtimeLane === "legacy" ? " gc-chart-type-item--active" : ""}`, onClick: () => setRuntimeLane("legacy"), role: "menuitemradio", "aria-checked": runtimeLane === "legacy", children: t("library.runtimeLane.optionLegacy") }), _jsx("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${runtimeLane === "auto" ? " gc-chart-type-item--active" : ""}`, onClick: () => {
                                                                window.location.search = "?standalone=true";
                                                            }, role: "menuitemradio", "aria-checked": runtimeLane === "auto", children: t("library.runtimeLane.optionAuto") }), _jsx("button", { type: "button", className: `gc-chart-type-item gc-chart-type-item--inline${runtimeLane === "fork" ? " gc-chart-type-item--active" : ""}`, onClick: () => setRuntimeLane("fork"), role: "menuitemradio", "aria-checked": runtimeLane === "fork", children: t("library.runtimeLane.optionFork") })] }), _jsx("div", { className: "gc-profile-menu__divider" }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); toggleTheme(); }, role: "menuitem", children: [isDark ? (_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "3.5", stroke: "currentColor", strokeWidth: "1.5" }), _jsx("line", { x1: "8", y1: "1", x2: "8", y2: "3", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "8", y1: "13", x2: "8", y2: "15", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "1", y1: "8", x2: "3", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "13", y1: "8", x2: "15", y2: "8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "3.05", y1: "3.05", x2: "4.46", y2: "4.46", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "11.54", y1: "11.54", x2: "12.95", y2: "12.95", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "11.54", y1: "4.46", x2: "12.95", y2: "3.05", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }), _jsx("line", { x1: "3.05", y1: "12.95", x2: "4.46", y2: "11.54", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" })] })) : (_jsx("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: _jsx("path", { d: "M13.5 10.5A6 6 0 0 1 5.5 2.5a6 6 0 1 0 8 8z", stroke: "currentColor", strokeWidth: "1.5", strokeLinejoin: "round" }) })), isDark ? t("library.switchToLight") : t("library.switchToDark")] }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openSettings("layout", selectedPane?.id ?? "price"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "8", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l1.41-1.41M3.05 12.95l1.41-1.41", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("settings.open")] }), _jsx("div", { className: "gc-profile-menu__divider" }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openPATModal("login"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("circle", { cx: "8", cy: "5.2", r: "2.2", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M3.2 13.2c.8-2.4 2.8-3.8 4.8-3.8s4 1.4 4.8 3.8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("profile.login")] }), _jsxs("button", { type: "button", className: "gc-chart-type-item", onClick: () => { setShowProfileMenu(false); openPATModal("paste"); }, role: "menuitem", children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M10 2H6a1 1 0 0 0-1 1v1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1z", stroke: "currentColor", strokeWidth: "1.3", strokeLinejoin: "round" }), _jsx("path", { d: "M6 3h4v2H6z", stroke: "currentColor", strokeWidth: "1.1" }), _jsx("path", { d: "M8 8v4M6 10h4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }), t("profile.register")] })] })) : null] })] })] }), _jsxs("div", { className: "gc-main", style: drawingUiStyleVars, children: [_jsxs("div", { ref: toolbarRef, className: "gc-tools-shell", children: [_jsx("span", { className: "gc-tools-handle", "aria-hidden": "true" }), _jsxs("aside", { className: `gc-tools${hasDrawingSelection ? " gc-tools--selection-focus" : ""}`, "aria-label": t("library.drawingTools"), children: [recentTools.length > 0 && (_jsxs(_Fragment, { children: [_jsxs("button", { type: "button", title: t("toolbar.recent"), "aria-haspopup": "true", "aria-expanded": Boolean(openRecentFlyout), className: "gc-tool-btn gc-tool-btn--group", onClick: (e) => {
                                                        if (openRecentFlyout) {
                                                            setOpenRecentFlyout(null);
                                                            return;
                                                        }
                                                        const rect = e.currentTarget.getBoundingClientRect();
                                                        const nextPosition = resolveToolFlyoutPosition(rect, recentTools.length);
                                                        setOpenRecentFlyout({ x: nextPosition.x, y: nextPosition.y });
                                                    }, children: [_jsxs("svg", { width: "14", height: "14", viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", children: [_jsx("path", { d: "M8 3a5 5 0 1 1-4.24 2.34", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("path", { d: "M4 2v4h4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round", strokeLinejoin: "round" })] }), _jsx("span", { style: { position: "absolute", top: 2, right: 14, fontSize: 7, fontWeight: 700, background: "var(--gc-accent)", color: "#fff", borderRadius: "6px", padding: "0 3px", lineHeight: "10px", pointerEvents: "none" }, children: recentTools.length }), _jsx("span", { className: "gc-tools-chevron", children: "\u25BE" })] }), _jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" })] })), TOOL_GROUPS.map((group, groupIndex) => {
                                            const isOpen = openGroupId?.id === group.id;
                                            const activeInGroup = group.tools.find((id) => id === resolvedActiveTool) ?? null;
                                            const iconId = activeInGroup ?? group.tools[0];
                                            const getGroupMenuKey = (groupId) => {
                                                switch (groupId) {
                                                    case "lines": return "drawing.menuLinesMeasures";
                                                    case "fibonacci": return "drawing.menuSacredGeometry";
                                                    case "shapes": return "drawing.menuShapesText";
                                                    case "patterns": return "drawing.menuPatterns";
                                                    case "analysis": return "drawing.menuSacredGeometry";
                                                    default: return `tool.group.${groupId}`;
                                                }
                                            };
                                            const flyoutStyle = {
                                                left: openGroupId?.x ?? 0,
                                                top: openGroupId?.y ?? 0,
                                                position: "fixed",
                                                zIndex: 10000,
                                                background: "var(--gc-surface)",
                                                backdropFilter: "blur(16px)",
                                                WebkitBackdropFilter: "blur(16px)",
                                                border: "1px solid var(--gc-border-mid)",
                                                borderRadius: "var(--gc-radius)",
                                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
                                                display: "flex",
                                                flexDirection: "column",
                                                width: "220px",
                                                overflow: "hidden"
                                            };
                                            return (_jsxs(Fragment, { children: [_jsxs("div", { className: "gc-tools-group-container", children: [_jsxs("button", { type: "button", title: t(`tool.group.${group.id}`), "aria-expanded": isOpen, "aria-haspopup": "true", className: `gc-tool-btn gc-tool-btn--group${activeInGroup ? " gc-tool-btn--active" : ""}`, onClick: (e) => {
                                                                    if (isOpen) {
                                                                        setOpenGroupId(null);
                                                                        return;
                                                                    }
                                                                    const rect = e.currentTarget.getBoundingClientRect();
                                                                    const nextPosition = resolveToolFlyoutPosition(rect, group.tools.length);
                                                                    setOpenGroupId({ id: group.id, x: nextPosition.x, y: nextPosition.y });
                                                                }, children: [_jsx(ToolIcon, { id: iconId }), favoriteTools.filter((id) => group.tools.includes(id)).length > 0 && (_jsx("span", { style: {
                                                                            position: "absolute", top: 2, right: 14, fontSize: 7, fontWeight: 700,
                                                                            background: "var(--gc-accent)", color: "#fff", borderRadius: "6px",
                                                                            padding: "0 3px", lineHeight: "10px", pointerEvents: "none",
                                                                        }, children: favoriteTools.filter((id) => group.tools.includes(id)).length })), _jsx("span", { className: "gc-tools-chevron", children: "\u25BE" })] }), isOpen && (_jsxs("div", { className: "gc-tools-flyout", role: "menu", style: flyoutStyle, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--gc-border)" }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }, children: [_jsxs("span", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--gc-text-muted)", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }, children: [_jsx("span", { style: { background: "var(--gc-accent)", color: "#fff", fontSize: "9px", padding: "1px 5px", borderRadius: "8px", fontWeight: "normal" }, children: group.tools.length }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t(getGroupMenuKey(group.id)) })] }), favoriteTools.length > 0 && (_jsxs("button", { type: "button", title: t("toolbar.favoriteTools"), "aria-haspopup": "true", "aria-expanded": Boolean(openFavoriteFlyout), className: "gc-pane-btn", onClick: (e) => {
                                                                                            if (openFavoriteFlyout) {
                                                                                                setOpenFavoriteFlyout(null);
                                                                                                return;
                                                                                            }
                                                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                                                            const nextPosition = resolveToolFlyoutPosition(rect, railFavoriteTools.length);
                                                                                            setOpenFavoriteFlyout({ x: nextPosition.x, y: nextPosition.y });
                                                                                        }, style: { display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 6px" }, children: [_jsx("span", { "aria-hidden": "true", children: "\u2605" }), _jsx("span", { style: { fontSize: "10px", fontWeight: 700, minWidth: 14, textAlign: "center" }, children: railFavoriteTools.length })] }))] }), _jsxs("div", { style: { position: "relative", display: "flex", alignItems: "center" }, children: [_jsx("input", { type: "text", placeholder: t("drawing.searchPlaceholder"), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onClick: (e) => e.stopPropagation(), style: {
                                                                                            width: "100%",
                                                                                            padding: "5px 8px 5px 24px",
                                                                                            fontSize: "11px",
                                                                                            background: "var(--gc-bg)",
                                                                                            border: "1px solid var(--gc-border)",
                                                                                            borderRadius: "var(--gc-radius)",
                                                                                            color: "var(--gc-text)",
                                                                                            outline: "none"
                                                                                        } }), _jsx("svg", { width: "10", height: "10", viewBox: "0 0 16 16", fill: "none", style: { position: "absolute", left: '8px', color: 'var(--gc-text-muted)' }, children: _jsx("path", { d: "M11.5 11.5L15 15M13 7C13 10.3137 10.3137 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7Z", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) })] })] }), mobileToolTooltip ? _jsx("div", { style: { padding: "6px 12px 0", fontSize: "10px", fontWeight: 600, color: "var(--gc-text-muted)" }, children: mobileToolTooltip }) : null, _jsxs("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "10px 12px", maxHeight: "180px", overflowY: "auto" }, children: [group.tools
                                                                                .filter(toolId => toolLabel(toolId).toLowerCase().includes(searchQuery.toLowerCase()))
                                                                                .map((toolId) => (_jsxs("button", { type: "button", role: "menuitem", title: toolLabel(toolId), "aria-pressed": resolvedActiveTool === toolId, className: `gc-tool-btn${resolvedActiveTool === toolId ? " gc-tool-btn--active" : ""}`, style: { width: "36px", height: "36px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", position: "relative" }, ...getToolTouchHandlers(toolId), onClick: () => handleToolbarToolTap(toolId, false), children: [_jsx(ToolIcon, { id: toolId }), TOOL_SHORTCUT_BADGE[toolId] && (_jsx("span", { style: {
                                                                                            position: "absolute",
                                                                                            bottom: 1,
                                                                                            right: 2,
                                                                                            fontSize: 8,
                                                                                            fontWeight: 700,
                                                                                            lineHeight: 1,
                                                                                            color: "var(--gc-text-muted)",
                                                                                            pointerEvents: "none",
                                                                                            userSelect: "none",
                                                                                        }, children: TOOL_SHORTCUT_BADGE[toolId] })), _jsx("span", { role: "button", tabIndex: 0, title: isFavorite(toolId) ? t("toolbar.unfavorite") : t("toolbar.favorite"), "aria-pressed": isFavorite(toolId), style: {
                                                                                            position: "absolute",
                                                                                            top: 1,
                                                                                            left: 2,
                                                                                            fontSize: 8,
                                                                                            lineHeight: 1,
                                                                                            opacity: isFavorite(toolId) ? 1 : 0,
                                                                                            color: isFavorite(toolId) ? "var(--gc-accent)" : "var(--gc-text-muted)",
                                                                                            cursor: "pointer",
                                                                                            transition: "opacity 0.15s",
                                                                                        }, className: "rsc-tool-fav-btn", onClick: (e) => { e.stopPropagation(); toggleFavorite(toolId); }, onKeyDown: (e) => { if (e.key === "Enter" || e.key === " ") {
                                                                                            e.preventDefault();
                                                                                            e.stopPropagation();
                                                                                            toggleFavorite(toolId);
                                                                                        } }, children: "\u2605" })] }, toolId))), group.tools.filter(toolId => toolLabel(toolId).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (_jsx("div", { style: { gridColumn: "span 4", textAlign: "center", color: "var(--gc-text-muted)", fontSize: "11px", padding: "10px 0" }, children: t("common.na") }))] })] }))] }), groupIndex < TOOL_GROUPS.length - 1 && _jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" })] }, group.id));
                                        }), openFavoriteFlyout && railFavoriteTools.length > 0 && (_jsxs("div", { className: "gc-tools-flyout", role: "menu", style: {
                                                left: openFavoriteFlyout.x,
                                                top: openFavoriteFlyout.y,
                                                position: "fixed",
                                                zIndex: 10001,
                                                background: "var(--gc-surface)",
                                                backdropFilter: "blur(16px)",
                                                WebkitBackdropFilter: "blur(16px)",
                                                border: "1px solid var(--gc-border-mid)",
                                                borderRadius: "var(--gc-radius)",
                                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
                                                display: "flex",
                                                flexDirection: "column",
                                                width: "184px",
                                                overflow: "hidden",
                                            }, children: [_jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--gc-border)" }, children: [_jsxs("span", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--gc-text-muted)", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }, children: [_jsx("span", { style: { background: "var(--gc-accent)", color: "#fff", fontSize: "9px", padding: "1px 5px", borderRadius: "8px", fontWeight: "normal" }, children: railFavoriteTools.length }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t("toolbar.favoriteTools") })] }), _jsx("button", { type: "button", className: "gc-pane-btn", title: t("common.close"), onClick: () => setOpenFavoriteFlyout(null), children: "\u00D7" })] }), mobileToolTooltip ? _jsx("div", { style: { padding: "6px 12px 0", fontSize: "10px", fontWeight: 600, color: "var(--gc-text-muted)" }, children: mobileToolTooltip }) : null, _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "10px 12px", maxHeight: "180px", overflowY: "auto" }, children: railFavoriteTools.map((toolId) => (_jsxs("button", { type: "button", role: "menuitem", title: toolLabel(toolId), "aria-pressed": resolvedActiveTool === toolId, className: `gc-tool-btn${resolvedActiveTool === toolId ? " gc-tool-btn--active" : ""}`, style: { width: "36px", height: "36px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", position: "relative" }, ...getToolTouchHandlers(toolId), onClick: () => handleToolbarToolTap(toolId, false), children: [_jsx(ToolIcon, { id: toolId }), TOOL_SHORTCUT_BADGE[toolId] && (_jsx("span", { style: {
                                                                    position: "absolute",
                                                                    bottom: 1,
                                                                    right: 2,
                                                                    fontSize: 8,
                                                                    fontWeight: 700,
                                                                    lineHeight: 1,
                                                                    color: "var(--gc-text-muted)",
                                                                    pointerEvents: "none",
                                                                    userSelect: "none",
                                                                }, children: TOOL_SHORTCUT_BADGE[toolId] }))] }, toolId))) })] })), openRecentFlyout && recentTools.length > 0 && (_jsxs("div", { className: "gc-tools-flyout", role: "menu", style: {
                                                left: openRecentFlyout.x,
                                                top: openRecentFlyout.y,
                                                position: "fixed",
                                                zIndex: 10001,
                                                background: "var(--gc-surface)",
                                                backdropFilter: "blur(16px)",
                                                WebkitBackdropFilter: "blur(16px)",
                                                border: "1px solid var(--gc-border-mid)",
                                                borderRadius: "var(--gc-radius)",
                                                boxShadow: "0 8px 32px rgba(0, 0, 0, 0.15)",
                                                display: "flex",
                                                flexDirection: "column",
                                                width: "220px",
                                                overflow: "hidden",
                                            }, children: [_jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "8px", padding: "10px 12px", borderBottom: "1px solid var(--gc-border)" }, children: [_jsxs("span", { style: { fontSize: "11px", fontWeight: "bold", color: "var(--gc-text-muted)", display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }, children: [_jsx("span", { style: { background: "var(--gc-accent)", color: "#fff", fontSize: "9px", padding: "1px 5px", borderRadius: "8px", fontWeight: "normal" }, children: recentTools.length }), _jsx("span", { style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, children: t("toolbar.recent") })] }), _jsxs("div", { style: { position: "relative", display: "flex", alignItems: "center" }, children: [_jsx("input", { type: "text", placeholder: t("drawing.searchPlaceholder"), value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onClick: (e) => e.stopPropagation(), style: {
                                                                        width: "100%",
                                                                        padding: "5px 8px 5px 24px",
                                                                        fontSize: "11px",
                                                                        background: "var(--gc-bg)",
                                                                        border: "1px solid var(--gc-border)",
                                                                        borderRadius: "var(--gc-radius)",
                                                                        color: "var(--gc-text)",
                                                                        outline: "none"
                                                                    } }), _jsx("svg", { width: "10", height: "10", viewBox: "0 0 16 16", fill: "none", style: { position: "absolute", left: "8px", color: "var(--gc-text-muted)" }, children: _jsx("path", { d: "M11.5 11.5L15 15M13 7C13 10.3137 10.3137 13 7 13C3.68629 13 1 10.3137 1 7C1 3.68629 3.68629 1 7 1C10.3137 1 13 3.68629 13 7Z", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" }) })] })] }), mobileToolTooltip ? _jsx("div", { style: { padding: "6px 12px 0", fontSize: "10px", fontWeight: 600, color: "var(--gc-text-muted)" }, children: mobileToolTooltip }) : null, _jsx("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", padding: "10px 12px", maxHeight: "180px", overflowY: "auto" }, children: recentTools.map((toolId) => (_jsx("button", { type: "button", role: "menuitem", title: `${t("toolbar.recent")}: ${toolLabel(toolId)}`, "aria-pressed": resolvedActiveTool === toolId, className: `gc-tool-btn${resolvedActiveTool === toolId ? " gc-tool-btn--active" : ""}`, style: { width: "36px", height: "36px", padding: "0", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "6px", position: "relative" }, ...getToolTouchHandlers(toolId), onClick: () => handleToolbarToolTap(toolId, true), children: _jsx(ToolIcon, { id: toolId }) }, `recent-${toolId}`))) })] })), _jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" }), _jsx("button", { type: "button", title: t("drawing.toggleList"), "aria-pressed": isObjectsDockActive, className: `gc-tool-btn${isObjectsDockActive ? " gc-tool-btn--active" : ""}`, onClick: () => handleToggleDrawingDock("objects"), children: _jsxs("svg", { width: "15", height: "15", viewBox: "0 0 16 16", fill: "none", children: [_jsx("line", { x1: "5", y1: "4", x2: "14", y2: "4", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("line", { x1: "5", y1: "8", x2: "14", y2: "8", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("line", { x1: "5", y1: "12", x2: "14", y2: "12", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" }), _jsx("circle", { cx: "2.5", cy: "4", r: "1.3", fill: "currentColor" }), _jsx("circle", { cx: "2.5", cy: "8", r: "1.3", fill: "currentColor" }), _jsx("circle", { cx: "2.5", cy: "12", r: "1.3", fill: "currentColor" })] }) }), !hasDrawingSelection && activeTool !== "cursor" && activeTool !== "crosshair" && (_jsxs(_Fragment, { children: [_jsx("span", { className: "rsc-toolbar-divider", "aria-hidden": "true" }), _jsx("div", { className: "gc-tools-group", title: t("drawing.magnetSensitivity"), children: ["weak", "normal", "strong"].map((level) => (_jsx("button", { type: "button", title: t(`drawing.magnet.${level}`), "aria-pressed": magnetSensitivity === level, className: `gc-tool-btn gc-tool-btn--magnet${magnetSensitivity === level ? " gc-tool-btn--active" : ""}`, onClick: () => setMagnetSensitivity((prev) => (prev === level ? "off" : level)), children: MAGNET_TOLERANCE[level] }, level))) })] }))] })] }), _jsxs("section", { className: "gc-chart-area", children: [_jsxs("div", { className: "gc-ohlc-strip", children: [_jsxs("span", { className: "gc-ohlc-pair", children: [selectedSymbol, " ", _jsxs("span", { className: "gc-ohlc-tf", children: ["\u00B7 ", chartTimeframe] })] }), showOhlcMetrics ? (_jsxs(_Fragment, { children: [_jsxs("span", { className: "gc-ohlc-item", children: ["O ", _jsx("b", { children: priceFormat(lastBar.open) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["H ", _jsx("b", { className: "gc-col-up", children: priceFormat(lastBar.high) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["L ", _jsx("b", { className: "gc-col-dn", children: priceFormat(lastBar.low) })] }), _jsxs("span", { className: "gc-ohlc-item", children: ["C ", _jsx("b", { className: priceIsUp ? "gc-col-up" : "gc-col-dn", children: priceFormat(lastBar.close) })] }), _jsxs("span", { className: "gc-ohlc-item gc-ohlc-vol", children: [t("library.volumeShort"), " ", _jsx("b", { children: volumeFormat(lastBar.volume) })] }), _jsx("span", { className: "gc-ohlc-item gc-ohlc-bars", children: t("library.pairBars", { count: data.length }) })] })) : (_jsx("span", { className: "gc-ohlc-loading", children: ohlcStatusLabel }))] }), activeSource === "vninvest" && (vniError || whaleData) ? (_jsxs("div", { className: "gc-vni-panel", children: [vniError ? _jsx("div", { className: "gc-vni-panel__error", children: vniError }) : null, _jsx(WhalePanel, { data: whaleData }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", fontSize: "12px", cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: showAdvisory, onChange: (e) => setShowAdvisory(e.target.checked) }), "T\u01B0 v\u1EA5n AI"] }), _jsxs("label", { style: { display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", fontSize: "12px", cursor: "pointer" }, children: [_jsx("input", { type: "checkbox", checked: showTape, onChange: (e) => {
                                                        setShowTape(e.target.checked);
                                                        if (!e.target.checked)
                                                            setTapeEntries([]);
                                                    } }), "B\u0103ng th\u00F4ng"] })] })) : null, _jsxs("div", { className: "gc-chart-shell", ref: shellRef, style: { background: canvasBg }, children: [isObjectsDockActive && (_jsxs("div", { className: "rsc-drawing-storage-toolbar", style: { left: storageToolbarPosition.x, top: storageToolbarPosition.y }, children: [_jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleExportDrawings, children: t("drawing.exportJson") }), _jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleImportButtonClick, children: t("drawing.importJson") }), _jsx("button", { type: "button", className: "rsc-drawing-storage-toolbar__button", onClick: handleClearDrawings, children: t("drawing.clearAll") }), _jsx("input", { ref: importInputRef, type: "file", accept: "application/json", hidden: true, onChange: handleImportFileChange })] })), !useWidgetOwnedHistory && dataStatus === "loading" && !hasWidgetData ? (_jsxs("div", { className: "gc-chart-placeholder gc-chart-loading", children: [_jsx("div", { className: "gc-spinner" }), _jsx("span", { children: activeSource === "vninvest" ? t("vninvest.loading") : t("library.loadingRealData") })] })) : !useWidgetOwnedHistory && dataStatus === "error" && activeSource === "vninvest" && !hasWidgetData ? (_jsx("div", { className: "gc-chart-placeholder gc-chart-error", children: _jsx("span", { children: vniError ?? t("vninvest.status.error") }) })) : (_jsx(VNInvestCharts, { adapter: chartAdapter, data: useWidgetOwnedHistory ? undefined : widgetData, symbol: selectedSymbol, timeframe: chartTimeframe, panes: paneState.panes, engineRuntime: effectiveRuntimeLane, locale: language, messages: widgetMessages, theme: theme, timezone: timezone, xExtents: xExtents, maxVisibleBars: maxVisibleBars, resetKey: chartResetKey, drawings: drawingInteraction.allDrawings, drawingUiEnabled: widgetDrawingUiEnabled, drawingActiveTool: activeTool, measurementEnabled: supportsMeasurementOverlay && resolvedActiveTool === "crosshair", selectedDrawing: widgetSelectedDrawing, showDrawingPriceMarkers: showDrawingPriceMarkers, showNonTradingDays: showNonTradingDays, suppressForkCanvasFallback: cleanSmokeMode, enableWhale: enableWhale, whaleThreshold: whaleThreshold, whaleOrders: activeSource === "vninvest" ? (whaleData?.whale_orders ?? undefined) : undefined, enableCVD: enableCVD, cvdMode: cvdMode, externalCvdSeries: activeSource === "vninvest" ? (orderFlowData?.cvd_series ?? undefined) : undefined, darkFlowStrength: activeSource === "vninvest" ? (orderFlowData?.dark_flow?.strength ?? null) : null, darkFlowSignalType: activeSource === "vninvest" ? (orderFlowData?.dark_flow?.signal_type ?? undefined) : undefined, showAdvisoryPanel: showAdvisory && activeSource === "vninvest", advisoryResult: advisoryResult, isAdvisoryLoading: advisoryLoading, onAdvisoryRefresh: () => {
                                                const client = vniClientRef.current;
                                                const symbol = vniSymbolRef.current.trim().toUpperCase();
                                                if (!client || !symbol)
                                                    return;
                                                setAdvisoryLoading(true);
                                                client.getAdvisorySession(symbol)
                                                    .then((resp) => { setAdvisoryResult(resp?.result ?? null); })
                                                    .catch(() => { })
                                                    .finally(() => { setAdvisoryLoading(false); });
                                            }, showTapePanel: showTape && activeSource === "vninvest", tapeEntries: tapeEntries, isTapeLoading: tapeLoading, tapeFilterBillions: tapeFilterBillions, onTapeFilterChange: setTapeFilterBillions, onPaperTradePanelClose: handlePaperTradeClose, onClick: handlePaperTradeClick, onContextMenu: handleReplayContextMenu, onDrawingsChange: handleWidgetDrawingsChange, onSelectedDrawingChange: handleWidgetSelectedDrawingChange, onDrawingWorkspaceChange: handleDrawingWorkspaceChange, onBarsChange: handleWidgetBarsChange, onError: handleWidgetError, onVisibleDomainChange: handleVisibleDomainChange, onPaneSnapshotsChange: handleWidgetPaneSnapshotsChange, onPaneToggleVisibleRequest: paneState.toggleVisible, onPaneRemoveRequest: paneState.removePane, onPaneAddSeriesRequest: handlePaneAddSeriesRequest, onPaneToggleSeriesRequest: paneState.toggleSeriesVisible, onPaneRemoveSeriesRequest: paneState.removeSeries, onRuntimeCapabilitiesChange: handleWidgetRuntimeCapabilitiesChange, renderPaneToolbar: renderWidgetPaneToolbar, renderPaneSplitter: chartReady ? renderWidgetPaneSplitter : undefined, renderDrawingChrome: () => drawingChrome, showDrawingDock: isDrawingDockOpen, settingsOpen: settingsOpen, onSettingsClose: closeSettings, renderDrawingDock: (dockProps) => (_jsx(DrawingDock, { isOpen: isDrawingDockOpen, activeTab: dockProps.activeTab, labels: drawingDockLabels, position: drawingDockPosition, onClose: handleCloseDrawingDock, onTabChange: (tab) => drawingWorkspace?.setDockTab(tab), propertiesContent: (_jsxs("div", { className: "rsc-drawing-dock__stack", children: [_jsx(DrawingInspector, { drawing: resolvedSelectedDrawing, labels: drawingInspectorLabels, plotData: data, embedded: true, textEditor: resolvedSelectedDrawing && ["text", "callout", "priceLabel"].includes(resolvedSelectedDrawing.type) ? {
                                                                active: isEditingText,
                                                                value: drawingTextDraft,
                                                                labels: drawingTextEditorLabels,
                                                                onChange: setDrawingTextDraft,
                                                                onStartEdit: handleStartTextEdit,
                                                                onCommit: handleCommitTextEdit,
                                                                onCancel: handleCancelTextEdit,
                                                            } : undefined, onUpdate: updateSelectedDrawing, onDelete: deleteSelected, onClone: cloneSelectedDrawing, onToggleLock: toggleSelectedLock, onToggleVisible: toggleSelectedVisible, onBringToFront: bringSelectedToFront, onSendToBack: sendSelectedToBack, onClose: handleCloseDrawingDock }), _jsx(DrawingSemanticPointLegend, { drawing: resolvedSelectedDrawing, labels: drawingSemanticPointLegendLabels, activePointIndex: focusedSemanticPointIndex, onPointFocusChange: handleSemanticPointFocusChange })] })), objectsContent: (_jsx(DrawingListPanel, { drawings: sortedDrawings, selectedId: resolvedSelectedDrawing?.id ?? null, labels: drawingListPanelLabels, embedded: true, onSelect: selectDrawingById, onToggleVisible: toggleDrawingVisibleById, onToggleLocked: toggleDrawingLockedById, onDelete: deleteDrawingById })), templatesContent: templatesContent })), renderSettings: () => (_jsx(PaneSettingsModal, { open: settingsOpen, section: settingsSection, onSectionChange: setSettingsSection, selectedPaneId: settingsPaneId, onSelectedPaneIdChange: setSettingsPaneId, paneState: paneState, maxVisiblePanes: maxVisiblePanes, onMaxVisiblePanesChange: setMaxVisiblePanes, maxVisibleBars: maxVisibleBars, onMaxVisibleBarsChange: setMaxVisibleBars, showNonTradingDays: showNonTradingDays, onShowNonTradingDaysChange: setShowNonTradingDays, showDrawingPriceMarkers: showDrawingPriceMarkers, onShowDrawingPriceMarkersChange: setShowDrawingPriceMarkers, enableWhale: enableWhale, onEnableWhaleChange: setEnableWhale, whaleThreshold: whaleThreshold, onWhaleThresholdChange: setWhaleThreshold, enableCVD: enableCVD, onEnableCVDChange: setEnableCVD, cvdMode: cvdMode, onCVDModeChange: setCVDMode, onAddPane: handleAddPane, onReset: handleResetSettings, isDark: isDark, toggleTheme: toggleTheme, onClose: closeSettings, timezone: timezone, onTimezoneChange: setTimezone, alertAudioEnabled: alertAudioEnabled, onAlertAudioEnabledChange: setAlertAudioEnabled })), renderReplayBar: showReplayBar ? () => (_jsx(ReplayControlBar, { playing: replayState.isPlaying, speed: typeof replayState.speed === "number" ? replayState.speed : 1, currentBar: replayState.currentIndex, totalBars: replayState.allData.length, onPlay: handleReplayToggle, onPause: handleReplayToggle, onRewind: handleReplayRewind, onStepBack: handleReplayStepBack, onStepForward: handleReplayStepForward, onSpeedChange: (speed) => handleReplaySpeedChange(speed), onClose: () => { replayController?.pause(); setShowReplayBar(false); }, onJumpToLatest: handleReplayJumpLatest })) : undefined, renderPaperTradePanel: paperTradePanelVisible ? (panelProps) => (_jsx(PaperTradePanel, { positions: paperTradePosition ? [{
                                                        id: "1",
                                                        side: "long",
                                                        entryPrice: paperTradePosition.entryPrice,
                                                        currentPrice: replayState.currentBar?.close ?? paperTradePosition.entryPrice,
                                                        quantity: 1,
                                                        entryBar: paperTradePosition.entryIndex,
                                                    }] : [], journal: paperTradeHistory.map((item, index) => ({
                                                    id: String(index),
                                                    side: "long",
                                                    entryPrice: item.entryPrice,
                                                    exitPrice: item.exitPrice,
                                                    quantity: 1,
                                                    pnl: item.pnl,
                                                    barsHeld: item.barsHeld,
                                                })), onReset: handlePaperTradeReset, onClose: panelProps.onClose })) : undefined, children: supportsDrawingOverlays ? (_jsx(DrawingLayer, { activeTool: resolvedActiveTool, interaction: drawingInteraction, magnetSensitivity: magnetSensitivity, focusedPointIndex: focusedSemanticPointIndex, onToolUsed: handleDrawingToolUsed, onContextMenu: handleDrawingContextMenu, liveMeasurementLabels: liveMeasurementLabels, onSemanticPointClick: setFocusedSemanticPointIndex })) : null })), activeSource === "vninvest" && vniLoading && hasWidgetData && (_jsxs("div", { className: "gc-vni-backfill-overlay", "aria-live": "polite", "aria-label": t("vninvest.loading"), children: [_jsx("div", { className: "gc-spinner gc-spinner--sm" }), _jsx("span", { children: t("vninvest.loading") })] })), replayContextMenu && (_jsxs(_Fragment, { children: [_jsx("div", { className: "gc-replay-menu-backdrop", "aria-hidden": "true", onClick: closeReplayContextMenu }), _jsxs("div", { className: "gc-replay-menu", style: { left: replayContextMenu.x, top: replayContextMenu.y }, children: [_jsx("div", { className: "gc-replay-menu__meta", children: replayContextMenu.label }), _jsx("button", { type: "button", className: "gc-replay-menu__action", onClick: handleReplayFromHere, children: t("replay.fromHere") })] })] })), paneOverlayLayout.map(({ pane, labelTop, labelHeight }) => {
                                            return (_jsx(Fragment, { children: _jsx(PaneLabel, { label: paneLabel(pane), top: labelTop, height: labelHeight }) }, pane.id));
                                        })] })] })] }), _jsxs("footer", { className: "gc-bottombar", children: [CHART_RANGES.map((range) => (_jsx("button", { type: "button", className: `gc-bottom-btn${chartRange === range ? " gc-bottom-btn--active" : ""}`, "aria-pressed": chartRange === range, onClick: () => handleChartRangeChange(range), children: t(CHART_RANGE_LABEL_KEYS[range]) }, range))), _jsx("div", { className: "gc-bottombar-sep" }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.script") }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.alert") }), _jsx("button", { type: "button", className: "gc-bottom-btn", children: t("common.trade") }), _jsx("div", { className: "gc-grow" }), _jsx("button", { type: "button", className: "gc-publish-btn", children: t("common.publish") })] }), _jsx(PATTokenModal, { isOpen: patModalOpen, initialTab: patModalInitialTab, client: vniClientRef.current, activeSource: activeSource, onSourceChange: handleSourceSwitch, onClose: () => setPatModalOpen(false), onConfigChange: handleVniConfigChange, onSaved: handlePATSaved, onFileLoaded: handleFileLoaded })] }) }));
}
