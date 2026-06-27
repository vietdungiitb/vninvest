import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { forwardRef, useImperativeHandle, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocalStorageState } from "./hooks/useLocalStorageState.js";
import { formatSeriesSuffix, formatSeriesDisplayName, seriesLabelKeys, seriesAbbreviations } from "./utils/seriesLabelUtils.js";
import { buildPaneToolbarWrapperProps, buildPaneSplitterWrapperProps, buildDrawingChromeWrapperProps, buildDrawingChromeContent } from "./VNInvestChartsChrome.js";
import { scaleUtc } from "d3-scale";
import { discontinuousTimeScaleProviderBuilder } from "../lib/scale/index.js";
import { createPaneSpecsFromDescriptors, createDateTimeIndexMap, } from "@vninvestcharts/vn-kline-engine-core";
import { EngineHost } from "@vninvestcharts/vn-kline-engine-react";
import { DynamicChart, ChartRenderContext, useChartTheme, PaneHeader, IndicatorLegend, ChartSplitter, useDynamicPanes } from "../lib/core/index.js";
import { StockChartProvider } from "../lib/StockChartContext.js";
import { useCanvasResize } from "../lib/core/hooks/useCanvasResize.js";
import { computePaneScaleSlotDomains } from "../lib/core/paneScaleSlotDomains.js";
import { WhaleMarketBubbleOverlay } from "../lib/indicators/overlays/WhaleMarketBubbleOverlay.js";
import { CVDIndicator } from "../lib/indicators/overlays/CVDIndicator.js";
import { ExternalCVDOverlay } from "../lib/indicators/overlays/ExternalCVDOverlay.js";
import { DarkFlowBadge } from "../lib/indicators/overlays/DarkFlowBadge.js";
import { AdvisoryPanel } from "../lib/advisory/AdvisoryPanel.js";
import { TapePanel } from "../lib/tape/TapePanel.js";
import { resolveDrawingShortcut } from "../lib/drawing/index.js";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "../lib/drawing/clipboard.js";
import { createDrawingContextMenuItems } from "../lib/drawing/drawingActionSurface.js";
import { isDrawingToolName } from "../lib/drawing/registry.js";
import { DrawingContextMenu } from "../lib/drawing/contextMenu.js";
import { resolveHoveredPaneId } from "./paneInteractionUtils.js";
import { areEngineVisibleRangesEqual, areVisibleDomainsEqual, isForkRangeTraceEnabled, traceForkRange, } from "./visibleRangeDiagnostics.js";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.js";
import { WidgetEmptyState } from "./WidgetEmptyState.js";
import DrawingPriceLabelsOverlay from "./DrawingPriceLabelsOverlay.js";
import { useWidgetData } from "./hooks/useWidgetData.js";
import { useWidgetDrawings } from "./hooks/useWidgetDrawings.js";
import { useWidgetInteractionActions } from "./hooks/useWidgetInteractionActions.js";
import { useWidgetForkInteraction } from "./hooks/useWidgetForkInteraction.js";
import { createForkDrawingPrimitiveInputs, } from "./ForkDrawingsOverlay.js";
import { reconcileForkDrawingIndexAnchors } from "./forkAnchorReconciliation.js";
import { clampIndex, } from "./visibleRangeBridge.js";
import { createSelectedPriceLabelsInput } from "./drawingPriceLabelInputs.js";
import { isForkSupportedDrawingAuthoringTool, isForkSupportedDrawingManipulationType } from "./forkDrawingSupport.js";
import { evaluateRuntimePolicy, } from "./runtimePolicy.js";
import MeasurementOverlay from "./MeasurementOverlay.js";
import { useWidgetI18n } from "./context/WidgetI18nContext.js";
import { setGlobalTimezone } from "../lib/utils/timezoneFormatter.js";
import { VNInvestChartsProvider, useVNInvestChartsState } from "./context/VNInvestChartsContext.js";
// WE2: Compound shell components
import { DrawingToolbar } from "./components/toolbar/DrawingToolbar.js";
import { OHLCHeader } from "./components/header/OHLCHeader.js";
import { TimeframeFooter } from "./components/footer/TimeframeFooter.js";
import DrawingDock from "./components/drawing/DrawingDock.js";
import DrawingInspector from "./components/drawing/DrawingInspector.js";
import DrawingListPanel from "./components/drawing/DrawingListPanel.js";
import { SettingsModal } from "./components/settings/SettingsModal.js";
import { SnapshotPreviewModal } from "./components/settings/SnapshotPreviewModal.js";
import { VNSymbolSearch } from "./components/search/VNSymbolSearch.js";
import { resolveChartRangeExtents } from "./utils/chartRange.js";
import SaveChartAsImage from "../lib/helper/SaveChartAsImage.js";
import { priceFormat, volumeFormat, dateFormat, CHART_MARGIN, FORK_DEGRADE_PIXEL_CHECK_DELAY_MS, FORK_DEGRADE_PIXEL_RECHECK_DELAY_MS, FORK_DEGRADE_REQUIRED_BLANK_CHECKS, FALLBACK_ADAPTER, formatForkXAxisLabel, resolveDiscontinuousXExtents, resolveDateDomainFromDiscontinuous, resolveEngineSeriesValueForRuntime, buildLegacyPaneSnapshots, resolveVisiblePanes, mergePaneSnapshotDomains, arePaneSnapshotsEqual, areRuntimeCapabilitiesEqual, } from "./utils/widgetHelpers.js";
export { normalizePaneDescriptorsForExplicitScaleSlots } from "./utils/widgetHelpers.js";
import { createWidgetCoordinateBridge, createForkChartRenderContextValue, createForkStockChartContextValue, } from "./utils/coordinateBridge.js";
import { ForkPaneTooltips } from "./components/ForkPaneTooltips.js";
import { ForkXAxisOverlay } from "./components/ForkXAxisOverlay.js";
const VNInvestChartsContent = forwardRef(({ adapter, data, symbol, onSymbolChange, timeframe, drawingUiEnabled = false, drawings, defaultDrawings, drawingStorageKey, drawingStorageAdapter, defaultDrawingDockTab, engineRuntime = "fork", useWebGL = false, locale, theme, panes, xExtents: controlledXExtents, children, className, style, measurementEnabled, selectedDrawing, showDrawingPriceMarkers, showNonTradingDays = false, enableWhale, whaleThreshold = 1_000_000, whaleOrders, enableCVD, cvdMode = "oscillator", externalCvdSeries, darkFlowStrength, darkFlowSignalType, showAdvisoryPanel, advisoryResult, isAdvisoryLoading, onAdvisoryRefresh, showTapePanel, tapeEntries, isTapeLoading, tapeFilterBillions, onTapeFilterChange, 
// WE2: Compound shell flags
showToolbar, showHeader, showFooter, renderToolbar, renderHeader, renderFooter, showDrawingDock, settingsOpen, onSettingsClose, onPaperTradePanelClose, renderReplayBar, renderPaperTradePanel, renderSettings, renderDrawingDock, onClick, onContextMenu, onDrawingsChange, onSelectedDrawingChange, onDrawingWorkspaceChange, onVisibleDomainChange, onVisibleRangeChange, onHistorySyncBusyChange, onBarsChange, onPaneSnapshotsChange, onPaneHover, onPaneToggleVisibleRequest, onPaneRemoveRequest, onPaneAddSeriesRequest, onPaneToggleSeriesRequest, onPaneRemoveSeriesRequest, onRuntimeCapabilitiesChange, onCoordinateBridgeChange, renderPaneToolbar, renderPaneSplitter, renderDrawingChrome, onError, onRuntimeDegraded, historyMinResidentBars, maxVisibleBars, maxVisiblePanes, timezone, onTimezoneChange, localCacheRoot, resetKey = 0, backfillWorkerFlags, canaryLevel, onCanaryGateDecision, onCanaryRollbackEvent, dataAdapterName, onDataAdapterChange, range, onRangeChange, onTimeframeChange, supportedTimeframes, }, forwardedRef) => {
    const { ref, size } = useCanvasResize();
    const [previewImageDataUrl, setPreviewImageDataUrl] = useState(null);
    const [localTimeframe, setLocalTimeframe] = useState(timeframe || "1h");
    useEffect(() => {
        if (timeframe) {
            setLocalTimeframe(timeframe);
        }
    }, [timeframe]);
    const [localRange, setLocalRange] = useState(range);
    useEffect(() => {
        if (range) {
            setLocalRange(range);
        }
    }, [range]);
    const [internalXExtents, setInternalXExtents] = useState(undefined);
    const activeXExtents = controlledXExtents !== undefined ? controlledXExtents : internalXExtents;
    const hoveredPaneIdRef = useRef(null);
    const forkDegradeNotifiedRef = useRef(false);
    const forkPaneSnapshotsRef = useRef([]);
    const forkVisibleRangeRef = useRef(null);
    const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
    const onVisibleDomainChangeRef = useRef(onVisibleDomainChange);
    const lastStableForkSpanRef = useRef(null);
    const pendingForkVisibleRangeRef = useRef(null);
    const pendingForkVisibleRangeRafRef = useRef(null);
    const lastEmittedPaneSnapshotsRef = useRef([]);
    const lastPaneSnapshotsSubscriberRef = useRef(undefined);
    const lastRuntimeCapabilitiesRef = useRef(null);
    const lastRuntimeCapabilitiesSubscriberRef = useRef(undefined);
    /** Ref to the fork engine instance — used to call setEnrichedData on data change */
    const engineInstanceRef = useRef(null);
    /** State mirror of engineInstanceRef — changing this re-triggers data-push effects when a new engine becomes ready */
    const [forkEngineInstance, setForkEngineInstance] = useState(null);
    const [paneSnapshots, setPaneSnapshots] = useState([]);
    const [hoveredPaneId, setHoveredPaneId] = useState(null);
    const [forkOverlayState, setForkOverlayState] = useState(null);
    const [forkVisibleRange, setForkVisibleRange] = useState(null);
    const [snapshotRevision, setSnapshotRevision] = useState(0);
    const incrementSnapshotRevision = useCallback(() => {
        setSnapshotRevision((prev) => prev + 1);
    }, []);
    const [legacyVisibleRange, setLegacyVisibleRange] = useState(null);
    const hasExternalData = Array.isArray(data);
    // ── WE2 Local Settings & Fallbacks ──────────────────────────────────
    const [localSelectedPaneId, setLocalSelectedPaneId] = useState("price");
    const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
    const [localMaxVisiblePanes, setLocalMaxVisiblePanes] = useLocalStorageState("vnsc_maxVisiblePanes", 6, { parse: parseInt });
    const activeMaxVisiblePanes = maxVisiblePanes !== undefined ? maxVisiblePanes : localMaxVisiblePanes;
    const [localMaxVisibleBars, setLocalMaxVisibleBars] = useLocalStorageState("vnsc_maxVisibleBars", 40000, { parse: parseInt });
    const activeMaxVisibleBars = maxVisibleBars !== undefined ? maxVisibleBars : localMaxVisibleBars;
    const [localShowNonTradingDays, setLocalShowNonTradingDays] = useLocalStorageState("vnsc_showNonTradingDays", false, { parse: (v) => v === "true" });
    const activeShowNonTradingDays = showNonTradingDays !== undefined ? showNonTradingDays : localShowNonTradingDays;
    const [localShowDrawingPriceMarkers, setLocalShowDrawingPriceMarkers] = useLocalStorageState("vnsc_showDrawingPriceMarkers", true, { parse: (v) => v === "true" });
    const activeShowDrawingPriceMarkers = showDrawingPriceMarkers !== undefined ? showDrawingPriceMarkers : localShowDrawingPriceMarkers;
    const [localEnableWhale, setLocalEnableWhale] = useLocalStorageState("vnsc_enableWhale", true, { parse: (v) => v === "true" });
    const activeEnableWhale = enableWhale !== undefined ? enableWhale : localEnableWhale;
    const [localWhaleThreshold, setLocalWhaleThreshold] = useLocalStorageState("vnsc_whaleThreshold", 1000000, { parse: parseInt });
    const activeWhaleThreshold = whaleThreshold !== undefined ? whaleThreshold : localWhaleThreshold;
    const [localEnableCVD, setLocalEnableCVD] = useLocalStorageState("vnsc_enableCVD", false, { parse: (v) => v === "true" });
    const activeEnableCVD = enableCVD !== undefined ? enableCVD : localEnableCVD;
    const [localCvdMode, setLocalCvdMode] = useLocalStorageState("vnsc_cvdMode", "oscillator");
    const activeCvdMode = cvdMode !== undefined ? cvdMode : localCvdMode;
    const [localTimezone, setLocalTimezone] = useState("Asia/Ho_Chi_Minh");
    const activeTimezone = timezone || localTimezone;
    const [localAlertAudioEnabled, setLocalAlertAudioEnabled] = useState(false);
    const activeAlertAudioEnabled = localAlertAudioEnabled;
    const [localSettingsOpen, setLocalSettingsOpen] = useState(false);
    const activeSettingsOpen = settingsOpen !== undefined ? settingsOpen : localSettingsOpen;
    const themeState = useChartTheme("light");
    const resolvedTheme = theme ?? themeState.theme;
    const isDark = resolvedTheme === "dark";
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    useEffect(() => {
        if (typeof document === "undefined")
            return;
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement === ref.current);
        };
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => {
            document.removeEventListener("fullscreenchange", handleFullscreenChange);
        };
    }, [ref]);
    const handleFullscreenToggle = useCallback(() => {
        if (!ref.current)
            return;
        if (!document.fullscreenElement) {
            ref.current.requestFullscreen().catch((err) => {
                console.error(`Error entering fullscreen: ${err.message}`);
            });
        }
        else {
            document.exitFullscreen();
        }
    }, [ref]);
    useEffect(() => {
        if (typeof document === "undefined")
            return;
        if ((activeSettingsOpen || !!previewImageDataUrl) && document.fullscreenElement) {
            document.exitFullscreen().catch((err) => {
                console.error(`Error exiting fullscreen: ${err.message}`);
            });
        }
    }, [activeSettingsOpen, previewImageDataUrl]);
    const handleSnapshot = useCallback(() => {
        if (ref.current) {
            const bg = isDark ? "#0a0e14" : "#ffffff";
            SaveChartAsImage.save(document, ref.current, bg, isDark, (dataUrl) => {
                setPreviewImageDataUrl(dataUrl);
            });
        }
    }, [ref, isDark]);
    const activeOnSettingsClose = useCallback(() => {
        if (onSettingsClose) {
            onSettingsClose();
        }
        else {
            setLocalSettingsOpen(false);
        }
    }, [onSettingsClose]);
    // Text edit state
    const [isEditingText, setIsEditingText] = useState(false);
    const [drawingTextDraft, setDrawingTextDraft] = useState("");
    // Consuming context paneState to synchronize settings/toolbar actions
    const { paneState } = useVNInvestChartsState();
    // Local panes state fallback
    const { panes: localPanes, visiblePanes: localVisiblePanes, heights: localHeights, available: localAvailable, toggleVisible: localToggleVisible, addPane: localAddPane, removePane: localRemovePane, addSeries: localAddSeries, removeSeries: localRemoveSeries, toggleSeriesVisible: localToggleSeriesVisible, applyDelta: localApplyDelta, replaceLayout: localReplaceLayout, resetToDefault: localResetToDefault, } = useDynamicPanes(size.height, {
        maxVisiblePanes: activeMaxVisiblePanes,
        panesOverride: paneState.panes,
        dispatchOverride: paneState.dispatch,
    });
    const activePanes = localPanes;
    useEffect(() => {
        if (panes) {
            localReplaceLayout(panes);
        }
    }, [panes, localReplaceLayout]);
    const sharedPlotDataRef = useRef([]);
    const resolvedLegacyVisibleRangeRef = useRef(null);
    useEffect(() => {
        onVisibleRangeChangeRef.current = onVisibleRangeChange;
    }, [onVisibleRangeChange]);
    useEffect(() => {
        onVisibleDomainChangeRef.current = onVisibleDomainChange;
    }, [onVisibleDomainChange]);
    useEffect(() => {
        if (typeof document === "undefined") {
            return undefined;
        }
        const root = document.documentElement;
        const previousTheme = root.getAttribute("data-chart-theme");
        root.setAttribute("data-chart-theme", resolvedTheme);
        return () => {
            if (previousTheme === null) {
                if (root.getAttribute("data-chart-theme") === resolvedTheme) {
                    root.removeAttribute("data-chart-theme");
                }
                return;
            }
            if (root.getAttribute("data-chart-theme") === resolvedTheme) {
                root.setAttribute("data-chart-theme", previousTheme);
            }
        };
    }, [resolvedTheme]);
    const useForkRuntime = engineRuntime === "fork";
    const emitCoordinateBridge = useCallback((nextPaneSnapshots, nextVisibleRange) => {
        onCoordinateBridgeChange?.(createWidgetCoordinateBridge({
            paneSnapshots: nextPaneSnapshots,
            visibleRange: useForkRuntime ? nextVisibleRange : resolvedLegacyVisibleRangeRef.current,
            plotData: sharedPlotDataRef.current,
            engineRuntime: useForkRuntime ? "fork" : "legacy",
        }));
    }, [onCoordinateBridgeChange, useForkRuntime]);
    const { bars, setBars, loading, setLoading, error, setError, canaryFilteredBars, resolvedCanaryLevel, enrichedData, plotData, plotDataRef, plotDataLengthRef, whaleEvents, activeSymbol, activeTimeframe, activeCacheKey, activeCacheSemanticScope, activeSourceSemantics, activeSourceRevisionKey, activeHistoryRequestKey, isControlledHistorySession, requestVisibleHistoryWindowSync, reconcileVisibleHistoryWindow, totalBarsFetchedRef, consecutiveEmptyBackfillRef, historyBackfillBeforeRef, historyForwardAfterRef, pendingHistoryPatchRef, visibleDomainRef, pendingVisibleDomainRef, lastQueuedVisibleDomainRef, resetHistorySessionControllerRefs, liveEdgeMsRef, historySessionRef, forkCameraEnvelopeMode, setForkCameraEnvelopeMode, handleForkVisibleRangeChange, } = useWidgetData({
        data,
        symbol,
        timeframe: localTimeframe,
        canaryLevel,
        backfillWorkerFlags,
        localCacheRoot,
        onBarsChange,
        onHistorySyncBusyChange,
        onCanaryGateDecision,
        onCanaryRollbackEvent,
        enableWhale,
        whaleOrders,
        historyMinResidentBars,
        useForkRuntime,
        engineInstanceRef,
        forkVisibleRangeRef,
        forkVisibleRange,
        setForkVisibleRange,
        incrementSnapshotRevision,
        emitCoordinateBridge,
        forkPaneSnapshotsRef,
        paneSnapshots,
        panes: activePanes,
        forkEngineInstance,
        adapter,
        onVisibleRangeChange,
        onVisibleDomainChange,
        controlledXExtents: activeXExtents,
        sharedPlotDataRef,
    });
    useEffect(() => {
        if (localRange && plotData.length > 0 && controlledXExtents === undefined) {
            const [start, end] = resolveChartRangeExtents(plotData, localRange);
            setInternalXExtents([start, end]);
        }
    }, [localRange, plotData, controlledXExtents]);
    useEffect(() => {
        if (controlledXExtents !== undefined) {
            setInternalXExtents(undefined);
        }
    }, [controlledXExtents]);
    const handleTimeframeChange = useCallback((tf) => {
        onTimeframeChange?.(tf);
        if (!timeframe) {
            setLocalTimeframe(tf);
        }
    }, [timeframe, onTimeframeChange]);
    const handleRangeChange = useCallback((r) => {
        onRangeChange?.(r);
        if (!range) {
            setLocalRange(r);
        }
    }, [range, onRangeChange]);
    const { drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing, hasMultipleDrawingsSelected, resolvedForkSingleSelection, } = useWidgetDrawings({
        defaultDrawings,
        drawings,
        drawingStorageKey,
        drawingStorageAdapter,
        defaultDrawingDockTab,
        onDrawingsChange,
        drawingUiEnabled,
        selectedDrawing,
        onSelectedDrawingChange,
        onDrawingWorkspaceChange,
        plotData,
        useForkRuntime,
        symbol: activeSymbol,
        timeframe: activeTimeframe,
    });
    const { forkSelectionModifierPressed, forkDrawingContextMenu, setForkDrawingContextMenu, forkAltShortcutPressedRef, copySelectedDrawing, pasteCopiedDrawing, bringSelectedToFront, sendSelectedToBack, toggleSelectedLock, cloneSelectedDrawing, updateForkReadonlySelection, updateForkReadonlySelectionByIds, closeForkDrawingContextMenu, } = useWidgetInteractionActions({
        useForkRuntime,
        drawingUiEnabled,
        drawingWorkspace,
        resolvedDrawings,
        resolvedSelectedDrawing,
        onSelectedDrawingChange,
    });
    // GAP-6: Widget-level keyboard shortcuts for magnet/lock/hide
    const [magnetSensitivity, setMagnetSensitivity] = useState("normal");
    const { t } = useWidgetI18n();
    // Text editing handlers
    const handleStartTextEdit = useCallback(() => {
        if (resolvedSelectedDrawing) {
            setDrawingTextDraft(resolvedSelectedDrawing.text ?? "");
            setIsEditingText(true);
        }
    }, [resolvedSelectedDrawing]);
    const handleCommitTextEdit = useCallback(() => {
        if (resolvedSelectedDrawing && drawingWorkspace) {
            drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { text: drawingTextDraft });
            setIsEditingText(false);
        }
    }, [resolvedSelectedDrawing, drawingTextDraft, drawingWorkspace]);
    const handleCancelTextEdit = useCallback(() => {
        setIsEditingText(false);
    }, []);
    // Series Display Translation Helper
    const getPaneLabel = useCallback((id, label) => {
        if (id === "price")
            return t("pane.price") || label;
        if (id === "volume")
            return t("pane.volume") || label;
        const val = t(`pane.${id}`);
        return val === `pane.${id}` ? label : val;
    }, [t]);
    const localizePane = useCallback((pane) => {
        const nextLabel = getPaneLabel(pane.id, pane.label);
        return nextLabel === pane.label ? pane : { ...pane, label: nextLabel };
    }, [getPaneLabel]);
    const handlePaneToggleVisible = useCallback((paneId) => {
        if (onPaneToggleVisibleRequest) {
            onPaneToggleVisibleRequest(paneId);
        }
        else {
            localToggleVisible(paneId);
        }
    }, [onPaneToggleVisibleRequest, localToggleVisible]);
    const handlePaneRemove = useCallback((paneId) => {
        if (onPaneRemoveRequest) {
            onPaneRemoveRequest(paneId);
        }
        else {
            localRemovePane(paneId);
        }
    }, [onPaneRemoveRequest, localRemovePane]);
    const handlePaneAddSeries = useCallback((paneId) => {
        if (onPaneAddSeriesRequest) {
            onPaneAddSeriesRequest(paneId);
        }
        else {
            setLocalSelectedPaneId(paneId);
            setLocalSettingsOpen(true);
        }
    }, [onPaneAddSeriesRequest]);
    const handlePaneToggleSeries = useCallback((paneId, seriesType, seriesIndex) => {
        if (onPaneToggleSeriesRequest) {
            onPaneToggleSeriesRequest(paneId, seriesType, seriesIndex);
        }
        else {
            localToggleSeriesVisible(paneId, seriesType, seriesIndex);
        }
    }, [onPaneToggleSeriesRequest, localToggleSeriesVisible]);
    const handlePaneRemoveSeries = useCallback((paneId, seriesType, seriesIndex) => {
        if (onPaneRemoveSeriesRequest) {
            onPaneRemoveSeriesRequest(paneId, seriesType, seriesIndex);
        }
        else {
            localRemoveSeries(paneId, seriesType, seriesIndex);
        }
    }, [onPaneRemoveSeriesRequest, localRemoveSeries]);
    const visiblePanes = useMemo(() => resolveVisiblePanes(activePanes), [activePanes]);
    const enginePanes = useMemo(() => createPaneSpecsFromDescriptors(visiblePanes), [visiblePanes]);
    const engineOptions = useMemo(() => ({ useWebGL }), [useWebGL]);
    const activeForkDrawingTool = useMemo(() => {
        const activeTool = drawingWorkspace.state.activeTool;
        return isDrawingToolName(activeTool) && isForkSupportedDrawingAuthoringTool(activeTool) ? activeTool : null;
    }, [drawingWorkspace.state.activeTool]);
    const activeForkManipulationDrawing = useMemo(() => {
        if (!useForkRuntime || !drawingUiEnabled || drawingWorkspace.state.activeTool !== "cursor" || !resolvedForkSingleSelection) {
            return null;
        }
        return isForkSupportedDrawingManipulationType(resolvedForkSingleSelection.type) && resolvedForkSingleSelection.locked !== true
            ? resolvedForkSingleSelection
            : null;
    }, [drawingUiEnabled, drawingWorkspace.state.activeTool, resolvedForkSingleSelection, useForkRuntime]);
    const forkMovableSelectionIds = useMemo(() => {
        if (!useForkRuntime || !drawingUiEnabled || drawingWorkspace.state.activeTool !== "cursor") {
            return [];
        }
        const selectedIdSet = new Set(drawingWorkspace.state.selectedIds);
        if (selectedIdSet.size === 0) {
            return [];
        }
        return resolvedDrawings
            .filter((drawing) => selectedIdSet.has(drawing.id))
            .filter((drawing) => drawing.visible !== false)
            .filter((drawing) => drawing.locked !== true)
            .filter((drawing) => isForkSupportedDrawingManipulationType(drawing.type))
            .map((drawing) => drawing.id);
    }, [drawingUiEnabled, drawingWorkspace.state.activeTool, drawingWorkspace.state.selectedIds, resolvedDrawings, useForkRuntime]);
    const { forkSurfaceCursor, forkPreviewRevision, forkManipulationActive, forkRubberBandSelection, forkRenderableDrawings, forkPointerOwnerRef, claimForkPointerOwner, releaseForkPointerOwner, handleForkPointerDown, handleForkPointerMove, handleForkPointerUp, handleForkPointerLeave, handleForkClick, handleForkContextMenu, handleForkHostContextMenu, handleForkDrawingClick, cancelForkInteraction, } = useWidgetForkInteraction({
        useForkRuntime,
        drawingUiEnabled,
        activeForkDrawingTool,
        drawingWorkspace,
        resolvedDrawings,
        resolvedSelectedDrawing,
        resolvedForkSingleSelection,
        onSelectedDrawingChange,
        magnetSensitivity,
        paneSnapshots,
        plotData,
        forkMovableSelectionIds,
        activeForkManipulationDrawing,
        forkSelectionModifierPressed,
        closeForkDrawingContextMenu,
        setForkDrawingContextMenu,
        size,
        engineInstanceRef,
        visiblePanes,
        onContextMenu,
        onClick,
        forkAltShortcutPressedRef,
        cloneSelectedDrawing,
        toggleSelectedLock,
        updateForkReadonlySelection,
        updateForkReadonlySelectionByIds,
        forkVisibleRangeRef,
        forkPaneSnapshotsRef,
    });
    useEffect(() => {
        if (!drawingUiEnabled) {
            return undefined;
        }
        const handleKeyDown = (e) => {
            if (e.key === "Escape") {
                cancelForkInteraction();
                return;
            }
            // Skip when focus is inside an input / textarea / contenteditable
            const target = e.target;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
                return;
            }
            const action = resolveDrawingShortcut({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey });
            if (!action || action.type !== "command") {
                return;
            }
            switch (action.command) {
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
                default:
                    break;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [drawingUiEnabled, cancelForkInteraction]);
    useImperativeHandle(forwardedRef, () => ({
        exportDrawings: () => {
            return [...drawingWorkspace.state.drawings];
        },
        importDrawings: (drawingsToImport) => {
            drawingWorkspace.interaction.replaceDrawings(drawingsToImport);
        },
    }), [drawingWorkspace]);
    const isSelectedDrawingControlled = selectedDrawing !== undefined;
    const drawingDockLabels = {
        title: t("drawing.dock.title") || "Drawing Manager",
        close: t("drawing.dock.close") || "Close",
        properties: t("drawing.dock.properties") || "Properties",
        objects: t("drawing.dock.objects") || "Objects List",
        templates: t("drawing.dock.templates") || "Templates",
        emptyProperties: t("drawing.dock.emptyProperties") || "No object selected",
        emptyObjects: t("drawing.dock.emptyObjects") || "No drawings on the chart yet",
        emptyTemplates: t("drawing.dock.emptyTemplates") || "No templates for this tool yet",
    };
    const propertiesContent = resolvedSelectedDrawing ? (_jsx(DrawingInspector, { drawing: resolvedSelectedDrawing, embedded: true, labels: {
            title: t("drawing.inspector.title") || "Drawing Properties",
            stroke: t("drawing.inspector.stroke") || "Border",
            fill: t("drawing.inspector.fill") || "Background",
            strokeWidth: t("drawing.inspector.strokeWidth") || "Thickness",
            lineStyle: t("drawing.inspector.lineStyle") || "Line Style",
            opacity: t("drawing.inspector.opacity") || "Opacity",
            solid: t("drawing.inspector.solid") || "Solid",
            dashed: t("drawing.inspector.dashed") || "Dashed",
            dotted: t("drawing.inspector.dotted") || "Dotted",
            lock: t("drawing.inspector.lock") || "Lock",
            unlock: t("drawing.inspector.unlock") || "Unlock",
            clone: t("drawing.inspector.clone") || "Clone",
            hide: t("drawing.inspector.hide") || "Hide",
            show: t("drawing.inspector.show") || "Show",
            bringToFront: t("drawing.inspector.bringToFront") || "Bring to Front",
            sendToBack: t("drawing.inspector.sendToBack") || "Send to Back",
            delete: t("drawing.inspector.delete") || "Delete",
            close: t("drawing.inspector.close") || "Close",
        }, textEditor: resolvedSelectedDrawing && ["text", "callout", "priceLabel"].includes(resolvedSelectedDrawing.type) ? {
            active: isEditingText,
            value: drawingTextDraft,
            labels: {
                title: t("drawing.textEditorTitle") || "Edit Text",
                label: t("drawing.textEditorLabel") || "Text",
                placeholder: t("drawing.textEditorPlaceholder") || "Enter text...",
                edit: t("drawing.textEditorEdit") || "Edit Text",
                save: t("drawing.textEditorSave") || "Save",
                cancel: t("drawing.textEditorCancel") || "Cancel",
                empty: t("drawing.textEditorEmpty") || "Empty",
            },
            onChange: setDrawingTextDraft,
            onStartEdit: handleStartTextEdit,
            onCommit: handleCommitTextEdit,
            onCancel: handleCancelTextEdit,
        } : undefined, onUpdate: (patch) => drawingWorkspace?.interaction.updateDrawing(resolvedSelectedDrawing.id, patch), onDelete: () => {
            if (drawingWorkspace) {
                const nextDrawings = drawingWorkspace.interaction.allDrawings.filter((d) => d.id !== resolvedSelectedDrawing.id);
                drawingWorkspace.interaction.replaceDrawings(nextDrawings);
                drawingWorkspace.selectDrawing(null);
            }
        }, onClone: () => {
            const cloned = cloneDrawingSnapshot(resolvedSelectedDrawing);
            if (cloned) {
                offsetDrawingByPixels(cloned, 15, 15);
                drawingWorkspace?.interaction.dispatch({ type: "PUSH", drawing: cloned });
            }
        }, onToggleLock: () => drawingWorkspace?.interaction.updateDrawing(resolvedSelectedDrawing.id, { locked: !resolvedSelectedDrawing.locked }), onToggleVisible: () => drawingWorkspace?.interaction.updateDrawing(resolvedSelectedDrawing.id, { visible: resolvedSelectedDrawing.visible === false ? true : false }), onBringToFront: () => {
            if (drawingWorkspace) {
                const maxZ = drawingWorkspace.interaction.allDrawings.reduce((currentMax, d) => Math.max(currentMax, d.zIndex ?? 0), 0);
                drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { zIndex: maxZ + 1 });
            }
        }, onSendToBack: () => {
            if (drawingWorkspace) {
                const minZ = drawingWorkspace.interaction.allDrawings.reduce((currentMin, d) => Math.min(currentMin, d.zIndex ?? 0), 0);
                drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { zIndex: minZ - 1 });
            }
        }, onClose: () => drawingWorkspace?.selectDrawing(null) })) : (_jsx("div", { className: "vnsc-drawing-dock__empty", children: t("drawing.dock.emptyProperties") || "No object selected" }));
    const objectsContent = drawingWorkspace ? (_jsx(DrawingListPanel, { drawings: [...resolvedDrawings], selectedId: resolvedSelectedDrawing?.id ?? null, embedded: true, labels: {
            title: t("drawing.list.title") || "Current Drawings",
            empty: t("drawing.list.empty") || "No drawings",
            visible: t("drawing.list.visible") || "Show",
            hidden: t("drawing.list.hidden") || "Hide",
            locked: t("drawing.list.locked") || "Lock",
            unlocked: t("drawing.list.unlocked") || "Unlock",
            selected: t("drawing.list.selected") || "Selected",
            delete: t("drawing.list.delete") || "Delete",
        }, onSelect: (id) => drawingWorkspace.selectDrawing(id), onToggleVisible: (id) => {
            const d = resolvedDrawings.find((x) => x.id === id);
            if (d) {
                drawingWorkspace.interaction.updateDrawing(id, { visible: d.visible === false });
            }
        }, onToggleLocked: (id) => {
            const d = resolvedDrawings.find((x) => x.id === id);
            if (d) {
                drawingWorkspace.interaction.updateDrawing(id, { locked: !d.locked });
            }
        }, onDelete: (id) => {
            const nextDrawings = drawingWorkspace.interaction.allDrawings.filter((d) => d.id !== id);
            drawingWorkspace.interaction.replaceDrawings(nextDrawings);
            if (resolvedSelectedDrawing?.id === id) {
                drawingWorkspace.selectDrawing(null);
            }
        } })) : null;
    const drawingDockNode = showDrawingDock && drawingWorkspace && drawingWorkspace.state.dock.isOpen ? (renderDrawingDock ? renderDrawingDock({ isOpen: drawingWorkspace.state.dock.isOpen, activeTab: drawingWorkspace.state.dock.activeTab, labels: drawingDockLabels, onClose: () => drawingWorkspace.closeDock(), onTabChange: (tab) => drawingWorkspace.setDockTab(tab), propertiesContent, objectsContent }) : _jsx(DrawingDock, { isOpen: drawingWorkspace.state.dock.isOpen, activeTab: drawingWorkspace.state.dock.activeTab, labels: drawingDockLabels, onClose: () => drawingWorkspace.closeDock(), onTabChange: (tab) => drawingWorkspace.setDockTab(tab), propertiesContent: propertiesContent, objectsContent: objectsContent })) : null;
    const settingsModalNode = activeSettingsOpen ? (renderSettings ? renderSettings({ open: activeSettingsOpen, onClose: activeOnSettingsClose }) : (_jsx(SettingsModal, { open: activeSettingsOpen, onClose: activeOnSettingsClose, dataAdapterName: dataAdapterName, onDataAdapterChange: onDataAdapterChange, selectedPaneId: localSelectedPaneId, onSelectedPaneIdChange: setLocalSelectedPaneId, maxVisiblePanes: activeMaxVisiblePanes, onMaxVisiblePanesChange: setLocalMaxVisiblePanes, maxVisibleBars: activeMaxVisibleBars, onMaxVisibleBarsChange: setLocalMaxVisibleBars, showNonTradingDays: activeShowNonTradingDays, onShowNonTradingDaysChange: setLocalShowNonTradingDays, showDrawingPriceMarkers: activeShowDrawingPriceMarkers, onShowDrawingPriceMarkersChange: setLocalShowDrawingPriceMarkers, enableWhale: activeEnableWhale, onEnableWhaleChange: setLocalEnableWhale, whaleThreshold: activeWhaleThreshold, onWhaleThresholdChange: setLocalWhaleThreshold, enableCVD: activeEnableCVD, onEnableCVDChange: setLocalEnableCVD, cvdMode: activeCvdMode, onCVDModeChange: setLocalCvdMode, isDark: isDark, toggleTheme: themeState.toggleTheme, timezone: activeTimezone, onTimezoneChange: (next) => {
            setLocalTimezone(next);
            if (onTimezoneChange) {
                onTimezoneChange(next);
            }
        }, alertAudioEnabled: activeAlertAudioEnabled, onAlertAudioEnabledChange: setLocalAlertAudioEnabled, onReset: () => {
            localResetToDefault();
            setLocalMaxVisiblePanes(6);
            setLocalMaxVisibleBars(40000);
            setLocalShowNonTradingDays(false);
            setLocalShowDrawingPriceMarkers(true);
            setLocalEnableWhale(true);
            setLocalWhaleThreshold(1000000);
            setLocalEnableCVD(false);
            setLocalCvdMode("oscillator");
            setLocalTimezone("Asia/Ho_Chi_Minh");
            setLocalAlertAudioEnabled(false);
        } }))) : null;
    const snapshotPreviewModalNode = previewImageDataUrl ? (_jsx(SnapshotPreviewModal, { isOpen: !!previewImageDataUrl, imageDataUrl: previewImageDataUrl, isDark: isDark, onClose: () => setPreviewImageDataUrl(null), onSave: () => {
            if (previewImageDataUrl) {
                const a = document.createElement("a");
                a.setAttribute("href", previewImageDataUrl);
                a.setAttribute("download", "Chart-Viewport.png");
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setPreviewImageDataUrl(null);
            }
        } })) : null;
    const hasRightSidebar = !!((showDrawingDock && drawingWorkspace && drawingWorkspace.state.dock.isOpen) || renderPaperTradePanel || showAdvisoryPanel || showTapePanel);
    const resolvedForkPriceMarkerSelection = useMemo(() => {
        if (!showDrawingPriceMarkers) {
            return null;
        }
        if (drawingWorkspace.state.selectedIds.length !== 1) {
            return null;
        }
        const selectedId = drawingWorkspace.state.selectedIds[0];
        if (!selectedId) {
            return null;
        }
        const selectedDrawingFromWorkspace = resolvedDrawings.find((drawing) => drawing.id === selectedId) ?? null;
        if (selectedDrawingFromWorkspace) {
            return selectedDrawingFromWorkspace;
        }
        return resolvedForkSingleSelection?.id === selectedId ? resolvedForkSingleSelection : null;
    }, [drawingWorkspace.state.selectedIds, resolvedDrawings, resolvedForkSingleSelection, showDrawingPriceMarkers]);
    const resolvedForkPrimitiveSelection = useMemo(() => {
        if (!resolvedForkSingleSelection) {
            return null;
        }
        return resolvedDrawings.find((drawing) => drawing.id === resolvedForkSingleSelection.id) ?? resolvedForkSingleSelection;
    }, [resolvedDrawings, resolvedForkSingleSelection]);
    const activeLocale = locale ?? "vi";
    const [sidebarWidth, setSidebarWidth] = useState(280);
    const [isResizingSidebar, setIsResizingSidebar] = useState(false);
    const handleSidebarPointerDown = useCallback((e) => {
        e.preventDefault();
        setIsResizingSidebar(true);
        const startX = e.clientX;
        const startWidth = sidebarWidth;
        const handlePointerMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const newWidth = Math.max(150, Math.min(600, startWidth - deltaX));
            setSidebarWidth(newWidth);
        };
        const handlePointerUp = () => {
            setIsResizingSidebar(false);
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
        };
        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    }, [sidebarWidth]);
    const adapterLabel = useMemo(() => {
        const candidate = adapter.label;
        return typeof candidate === "string" && candidate.length > 0 ? candidate : "widget-adapter";
    }, [adapter]);
    useEffect(() => {
        if (!forkDrawingContextMenu) {
            return;
        }
        const exists = resolvedDrawings.some((drawing) => drawing.id === forkDrawingContextMenu.drawingId);
        if (!exists) {
            setForkDrawingContextMenu(null);
        }
    }, [forkDrawingContextMenu, resolvedDrawings]);
    const cvdData = useMemo(() => (enableCVD ? plotData : []), [enableCVD, plotData]);
    const scaleSlotDomains = useMemo(() => computePaneScaleSlotDomains(visiblePanes, plotData), [plotData, visiblePanes]);
    const chartInnerHeight = Math.max(1, size.height - CHART_MARGIN.top - CHART_MARGIN.bottom);
    const activeHeights = localHeights;
    const legacyPaneSnapshots = useMemo(() => buildLegacyPaneSnapshots(visiblePanes, activeHeights, { width: size.width, height: size.height }, scaleSlotDomains), [activeHeights, scaleSlotDomains, size.height, size.width, visiblePanes]);
    const defaultLegacyVisibleRange = useMemo(() => {
        if (plotData.length === 0) {
            return null;
        }
        return {
            startIndex: 0,
            endIndex: plotData.length - 1,
            startDate: plotData[0].date,
            endDate: plotData[plotData.length - 1].date,
            barCount: plotData.length,
        };
    }, [plotData]);
    const resolvedLegacyVisibleRange = legacyVisibleRange ?? defaultLegacyVisibleRange;
    resolvedLegacyVisibleRangeRef.current = resolvedLegacyVisibleRange;
    const legacyCoordinateBridge = useMemo(() => createWidgetCoordinateBridge({
        paneSnapshots: legacyPaneSnapshots,
        visibleRange: resolvedLegacyVisibleRange,
        plotData,
        engineRuntime: "legacy",
    }), [legacyPaneSnapshots, plotData, resolvedLegacyVisibleRange]);
    const forkChartRenderContextValue = useMemo(() => createForkChartRenderContextValue({
        paneSnapshots: (() => {
            const engine = engineInstanceRef.current;
            if (!engine)
                return null;
            const sn = engine.getPaneSnapshots();
            if (!sn || sn.length === 0)
                return null;
            return sn;
        })() ?? paneSnapshots,
        visibleRange: (() => {
            const engine = engineInstanceRef.current;
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? forkVisibleRangeRef.current,
        plotData,
        width: size.width,
        height: size.height,
    }), [paneSnapshots, plotData, size.height, size.width, snapshotRevision]);
    useEffect(() => {
        if (!isForkRangeTraceEnabled()) {
            return;
        }
        window.__VN_FORK_PANES__ = paneSnapshots;
        window.__VN_FORK_VISIBLE_RANGE__ = forkVisibleRangeRef.current;
        window.__VN_SCALE_SLOT_DOMAINS__ = scaleSlotDomains;
        window.__VN_DOMAIN_PREF__ = useForkRuntime;
        const firstBar = bars[0];
        const lastBar = bars[bars.length - 1];
        window.__VN_BAR_FIELD_TYPES__ = {
            first: firstBar ? {
                open: typeof firstBar.open,
                high: typeof firstBar.high,
                low: typeof firstBar.low,
                close: typeof firstBar.close,
                volume: typeof firstBar.volume,
            } : null,
            last: lastBar ? {
                open: typeof lastBar.open,
                high: typeof lastBar.high,
                low: typeof lastBar.low,
                close: typeof lastBar.close,
                volume: typeof lastBar.volume,
            } : null,
        };
    }, [bars, paneSnapshots, scaleSlotDomains, useForkRuntime, snapshotRevision]);
    const forkSubscriptionIdRef = useRef(0);
    const forkStockChartContextValue = useMemo(() => createForkStockChartContextValue({
        paneSnapshots,
        plotData,
        chartRenderContextValue: forkChartRenderContextValue,
        width: size.width,
        height: size.height,
        generateSubscriptionId: () => {
            forkSubscriptionIdRef.current += 1;
            return forkSubscriptionIdRef.current;
        },
    }), [forkChartRenderContextValue, paneSnapshots, plotData, size.height, size.width]);
    const runtimeCapabilities = useMemo(() => ({
        engineRuntime: useForkRuntime ? "fork" : "legacy",
        paneToolbar: true,
        paneSplitters: true,
        chartCanvasOverlays: useForkRuntime ? forkChartRenderContextValue !== null : true,
        measurementOverlay: true,
        drawingOverlays: true,
    }), [forkChartRenderContextValue, useForkRuntime]);
    const paneSnapshotMap = useMemo(() => new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot])), [paneSnapshots]);
    const computedXExtents = useMemo(() => {
        if (enrichedData.length === 0) {
            return undefined;
        }
        const firstBar = enrichedData[0];
        const lastBar = enrichedData[enrichedData.length - 1];
        if (firstBar.date.getTime() === lastBar.date.getTime()) {
            return [firstBar.date, new Date(lastBar.date.getTime() + 60_000)];
        }
        return [firstBar.date, lastBar.date];
    }, [enrichedData]);
    const resolvedXExtents = controlledXExtents ?? computedXExtents;
    const safeXAccessor = useCallback((datum) => datum?.date ?? new Date(0), []);
    const legacyChartScale = useMemo(() => {
        if (showNonTradingDays || plotData.length === 0) {
            return {
                data: plotData,
                xScale: scaleUtc(),
                xAccessor: safeXAccessor,
                displayXAccessor: safeXAccessor,
                xExtents: resolvedXExtents,
                usesDiscontinuousScale: false,
            };
        }
        const scaleProvider = discontinuousTimeScaleProviderBuilder().inputDateAccessor((datum) => datum.date);
        const scaled = scaleProvider(plotData);
        const scaledData = scaled.data;
        const scaledXAccessor = scaled.xAccessor;
        return {
            data: scaledData,
            xScale: scaled.xScale,
            xAccessor: scaledXAccessor,
            displayXAccessor: scaled.displayXAccessor,
            xExtents: resolveDiscontinuousXExtents(resolvedXExtents, scaledData, scaledXAccessor),
            usesDiscontinuousScale: true,
        };
    }, [plotData, resolvedXExtents, safeXAccessor, showNonTradingDays]);
    const chartSurfaceReady = size.width > 0 && size.height > 0 && (!(loading && !hasExternalData)) && plotData.length > 0;
    useEffect(() => {
        const subscriberChanged = lastRuntimeCapabilitiesSubscriberRef.current !== onRuntimeCapabilitiesChange;
        if (!subscriberChanged && areRuntimeCapabilitiesEqual(lastRuntimeCapabilitiesRef.current, runtimeCapabilities)) {
            return;
        }
        lastRuntimeCapabilitiesRef.current = runtimeCapabilities;
        lastRuntimeCapabilitiesSubscriberRef.current = onRuntimeCapabilitiesChange;
        onRuntimeCapabilitiesChange?.(runtimeCapabilities);
    }, [onRuntimeCapabilitiesChange, runtimeCapabilities]);
    const emitPaneSnapshots = useCallback((nextSnapshots) => {
        const preferSnapshotPriceDomains = useForkRuntime;
        if (isForkRangeTraceEnabled() && useForkRuntime) {
            const firstSnapshot = nextSnapshots[0];
            const sampleSlotId = "price-right";
            window.__VN_RAW_PRICE_DOMAIN__ = firstSnapshot?.scaleSlotStates?.[sampleSlotId]?.domain ?? null;
            traceForkRange("pane-domain-merge", {
                preferSnapshotPriceDomains,
                snapshotDomain: firstSnapshot?.scaleSlotStates?.[sampleSlotId]?.domain ?? null,
                fallbackDomain: scaleSlotDomains[sampleSlotId] ?? null,
            });
        }
        const mergedSnapshots = mergePaneSnapshotDomains(nextSnapshots, scaleSlotDomains, {
            preferSnapshotPriceDomains,
        });
        const subscriberChanged = lastPaneSnapshotsSubscriberRef.current !== onPaneSnapshotsChange;
        const snapshotsChanged = !arePaneSnapshotsEqual(lastEmittedPaneSnapshotsRef.current, mergedSnapshots);
        if (useForkRuntime) {
            forkPaneSnapshotsRef.current = mergedSnapshots;
        }
        setPaneSnapshots((currentSnapshots) => {
            if (arePaneSnapshotsEqual(currentSnapshots, mergedSnapshots)) {
                return currentSnapshots;
            }
            return mergedSnapshots;
        });
        if (snapshotsChanged || subscriberChanged) {
            lastEmittedPaneSnapshotsRef.current = mergedSnapshots;
            lastPaneSnapshotsSubscriberRef.current = onPaneSnapshotsChange;
            onPaneSnapshotsChange?.(mergedSnapshots);
        }
        if (useForkRuntime) {
            const pendingRange = pendingForkVisibleRangeRef.current;
            if (pendingRange) {
                pendingForkVisibleRangeRef.current = null;
                if (pendingForkVisibleRangeRafRef.current !== null && typeof cancelAnimationFrame === "function") {
                    cancelAnimationFrame(pendingForkVisibleRangeRafRef.current);
                }
                pendingForkVisibleRangeRafRef.current = null;
                forkVisibleRangeRef.current = pendingRange;
                setForkVisibleRange((currentRange) => (areEngineVisibleRangesEqual(currentRange, pendingRange) ? currentRange : pendingRange));
                incrementSnapshotRevision();
                emitCoordinateBridge(mergedSnapshots, pendingRange);
                return;
            }
            emitCoordinateBridge(mergedSnapshots, forkVisibleRangeRef.current);
            return;
        }
        emitCoordinateBridge(mergedSnapshots, null);
    }, [emitCoordinateBridge, incrementSnapshotRevision, onPaneSnapshotsChange, scaleSlotDomains, useForkRuntime]);
    useEffect(() => {
        if (!useForkRuntime) {
            return;
        }
        const currentForkSnapshots = forkPaneSnapshotsRef.current;
        if (currentForkSnapshots.length === 0) {
            return;
        }
        const preferSnapshotPriceDomains = true;
        const mergedSnapshots = mergePaneSnapshotDomains(currentForkSnapshots, scaleSlotDomains, {
            preferSnapshotPriceDomains,
        });
        if (arePaneSnapshotsEqual(currentForkSnapshots, mergedSnapshots)) {
            return;
        }
        forkPaneSnapshotsRef.current = mergedSnapshots;
        setPaneSnapshots((currentSnapshots) => (arePaneSnapshotsEqual(currentSnapshots, mergedSnapshots)
            ? currentSnapshots
            : mergedSnapshots));
        const subscriberChanged = lastPaneSnapshotsSubscriberRef.current !== onPaneSnapshotsChange;
        const snapshotsChanged = !arePaneSnapshotsEqual(lastEmittedPaneSnapshotsRef.current, mergedSnapshots);
        if (snapshotsChanged || subscriberChanged) {
            lastEmittedPaneSnapshotsRef.current = mergedSnapshots;
            lastPaneSnapshotsSubscriberRef.current = onPaneSnapshotsChange;
            onPaneSnapshotsChange?.(mergedSnapshots);
        }
        emitCoordinateBridge(mergedSnapshots, forkVisibleRangeRef.current);
    }, [emitCoordinateBridge, onPaneSnapshotsChange, scaleSlotDomains, useForkRuntime]);
    useEffect(() => {
        if (!chartSurfaceReady) {
            forkPaneSnapshotsRef.current = [];
            forkVisibleRangeRef.current = null;
            lastStableForkSpanRef.current = null;
            pendingForkVisibleRangeRef.current = null;
            pendingHistoryPatchRef.current = null;
            if (pendingForkVisibleRangeRafRef.current !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(pendingForkVisibleRangeRafRef.current);
            }
            pendingForkVisibleRangeRafRef.current = null;
            onCoordinateBridgeChange?.(null);
            setPaneSnapshots((currentSnapshots) => (currentSnapshots.length === 0 ? currentSnapshots : []));
            incrementSnapshotRevision();
            return;
        }
        if (useForkRuntime) {
            if (forkPaneSnapshotsRef.current.length === 0) {
                onCoordinateBridgeChange?.(null);
                setPaneSnapshots((currentSnapshots) => (currentSnapshots.length === 0 ? currentSnapshots : []));
            }
            return;
        }
        forkPaneSnapshotsRef.current = [];
        forkVisibleRangeRef.current = null;
        lastStableForkSpanRef.current = null;
        pendingForkVisibleRangeRef.current = null;
        pendingHistoryPatchRef.current = null;
        if (pendingForkVisibleRangeRafRef.current !== null && typeof cancelAnimationFrame === "function") {
            cancelAnimationFrame(pendingForkVisibleRangeRafRef.current);
        }
        pendingForkVisibleRangeRafRef.current = null;
        emitPaneSnapshots(legacyPaneSnapshots);
        incrementSnapshotRevision();
    }, [chartSurfaceReady, emitPaneSnapshots, legacyPaneSnapshots, onCoordinateBridgeChange, useForkRuntime, incrementSnapshotRevision]);
    // ── KF-SSOT-T03: Wire enrichedData → fork engine ─────────────────────────
    const handleEngineReady = useCallback((engine) => {
        engineInstanceRef.current = engine;
        if (typeof window !== "undefined") {
            window.__VN_ENGINE__ = engine;
        }
        if (isForkRangeTraceEnabled()) {
            window.__VN_ENGINE__ = engine;
        }
        setForkCameraEnvelopeMode(engine.getCameraState().envelopeMode ?? "shared");
        // Immediately set a full-range default so the engine has a valid visible
        // range on first render. This prevents blank canvas caused by
        // forkVisibleRangeRef being null at render time.
        const defaultRange = { from: 0, to: Math.max(1, bars.length) };
        forkVisibleRangeRef.current = defaultRange;
        const initialVisibleRange = engine.getVisibleRange();
        const initialRangeSpan = initialVisibleRange ? Math.abs(initialVisibleRange.to - initialVisibleRange.from) : 0;
        const shouldUseInitialVisibleRange = Boolean(initialVisibleRange)
            && !(plotData.length > 2 && initialRangeSpan <= 1);
        if (shouldUseInitialVisibleRange && initialVisibleRange) {
            forkVisibleRangeRef.current = initialVisibleRange;
            setForkVisibleRange((currentRange) => (areEngineVisibleRangesEqual(currentRange, initialVisibleRange)
                ? currentRange
                : initialVisibleRange));
        }
        else {
            // Fall back to default full range — triggers re-render with valid context.
            setForkVisibleRange((currentRange) => (areEngineVisibleRangesEqual(currentRange, defaultRange)
                ? currentRange
                : defaultRange));
        }
        incrementSnapshotRevision();
        // Updating state (not just a ref) ensures data-push effects re-run when a new
        // engine instance becomes ready — fixes initial-load blank canvas on first mount.
        setForkEngineInstance(engine);
    }, [bars.length, plotData.length, incrementSnapshotRevision]);
    const handleLegacyVisibleRangeChange = useCallback((range) => {
        setLegacyVisibleRange((currentRange) => {
            if (currentRange?.startIndex === range.startIndex && currentRange?.endIndex === range.endIndex) {
                return currentRange;
            }
            return range;
        });
        onVisibleRangeChangeRef.current?.(range);
    }, []);
    const handleLegacyVisibleDomainChange = useCallback((domain) => {
        const resolvedDomain = !legacyChartScale.usesDiscontinuousScale
            ? [domain[0] instanceof Date ? domain[0] : new Date(domain[0]), domain[1] instanceof Date ? domain[1] : new Date(domain[1])]
            : resolveDateDomainFromDiscontinuous(domain, legacyChartScale.data, legacyChartScale.xAccessor);
        const currentVisibleDomain = visibleDomainRef.current;
        if (currentVisibleDomain && areVisibleDomainsEqual(currentVisibleDomain, resolvedDomain)) {
            return;
        }
        onVisibleDomainChangeRef.current?.(resolvedDomain);
        requestVisibleHistoryWindowSync(resolvedDomain, { updateVisibleDomainRef: true });
    }, [legacyChartScale, requestVisibleHistoryWindowSync]);
    const emitHoveredPaneId = useCallback((paneId) => {
        if (hoveredPaneIdRef.current === paneId) {
            return;
        }
        hoveredPaneIdRef.current = paneId;
        setHoveredPaneId(paneId);
        onPaneHover?.(paneId);
    }, [onPaneHover]);
    const handleWidgetPointerMove = useCallback((event) => {
        if (useForkRuntime && forkPointerOwnerRef.current !== null) {
            return;
        }
        const activeSnapshots = useForkRuntime ? paneSnapshots : legacyPaneSnapshots;
        const resolvedId = resolveHoveredPaneId(event, activeSnapshots);
        emitHoveredPaneId(resolvedId);
    }, [emitHoveredPaneId, legacyPaneSnapshots, paneSnapshots, useForkRuntime]);
    const handleWidgetPointerLeave = useCallback(() => {
        if (useForkRuntime && forkPointerOwnerRef.current !== null) {
            return;
        }
        emitHoveredPaneId(null);
    }, [emitHoveredPaneId, useForkRuntime]);
    const handleForkOverlayStateChange = useCallback((overlayState) => {
        setForkOverlayState(overlayState);
    }, []);
    const engineTheme = useMemo(() => ({ mode: resolvedTheme }), [resolvedTheme]);
    const forkHoveredDatum = useMemo(() => {
        const hoveredDataIndex = forkOverlayState?.hoveredDataIndex ?? null;
        if (hoveredDataIndex === null || plotData.length === 0) {
            return undefined;
        }
        return plotData[clampIndex(hoveredDataIndex, plotData.length)];
    }, [forkOverlayState, plotData]);
    const effectiveForkVisibleRange = useMemo(() => {
        const vr = (() => {
            const engine = engineInstanceRef.current;
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? forkVisibleRangeRef.current;
        if (vr) {
            return vr;
        }
        if (plotData.length === 0) {
            return null;
        }
        return {
            from: 0,
            to: Math.max(1, plotData.length),
        };
    }, [snapshotRevision, plotData.length]);
    const forkXAxisTicks = useMemo(() => {
        if (!useForkRuntime || !forkOverlayState || plotData.length === 0) {
            return [];
        }
        const engine = engineInstanceRef.current;
        const activeVisibleRange = (() => {
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? effectiveForkVisibleRange ?? { from: 0, to: Math.max(1, plotData.length) };
        const fromIndex = clampIndex(activeVisibleRange.from, plotData.length);
        const toIndexExclusive = Math.min(plotData.length, Math.max(fromIndex + 1, Math.ceil(activeVisibleRange.to)));
        const visibleBarCount = Math.max(1, toIndexExclusive - fromIndex);
        return forkOverlayState.xAxisTicks.flatMap((tick) => {
            const datum = plotData[clampIndex(tick.dataIndex, plotData.length)];
            if (!datum) {
                return [];
            }
            return [{
                    key: tick.key,
                    x: tick.x,
                    label: formatForkXAxisLabel(datum.date, activeTimeframe, visibleBarCount),
                }];
        });
    }, [activeTimeframe, effectiveForkVisibleRange, forkOverlayState, plotData, useForkRuntime, snapshotRevision]);
    const forkXAxisHoverLabel = useMemo(() => {
        if (!useForkRuntime || !forkOverlayState?.crosshair || plotData.length === 0) {
            return undefined;
        }
        const hoveredIndex = forkOverlayState.crosshair.dataIndex;
        if (hoveredIndex === null) {
            return undefined;
        }
        const datum = plotData[clampIndex(hoveredIndex, plotData.length)];
        if (!datum) {
            return undefined;
        }
        return {
            x: forkOverlayState.crosshair.x,
            label: dateFormat(datum.date),
        };
    }, [forkOverlayState, plotData, useForkRuntime]);
    const engineSeriesData = useMemo(() => {
        const seriesValuesById = {};
        for (const pane of visiblePanes) {
            for (let index = 0; index < pane.series.length; index += 1) {
                const series = pane.series[index];
                if (series.visible === false) {
                    continue;
                }
                const seriesId = series.id ?? `${pane.id}-series-${index}`;
                const values = enrichedData.map((datum) => {
                    const value = resolveEngineSeriesValueForRuntime(datum, series);
                    return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
                });
                seriesValuesById[seriesId] = values;
            }
        }
        return seriesValuesById;
    }, [enrichedData, visiblePanes]);
    const forkDrawingPrimitiveInputs = useMemo(() => {
        const engine = engineInstanceRef.current;
        const activeVisibleRange = (() => {
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? effectiveForkVisibleRange;
        const activePaneSnapshots = (() => {
            if (!engine)
                return null;
            const sn = engine.getPaneSnapshots();
            if (!sn || sn.length === 0)
                return null;
            return sn;
        })() ?? paneSnapshots;
        const timeIndexMap = createDateTimeIndexMap(plotData);
        const reconciled = reconcileForkDrawingIndexAnchors(forkRenderableDrawings, timeIndexMap);
        return createForkDrawingPrimitiveInputs({
            drawings: reconciled.drawings,
            selectedDrawing: resolvedForkPrimitiveSelection,
            selectedDrawingIds: drawingWorkspace.state.selectedIds,
            paneSnapshots: activePaneSnapshots,
            visibleRange: activeVisibleRange,
            plotData,
        });
    }, [effectiveForkVisibleRange, forkRenderableDrawings, paneSnapshots, plotData, resolvedForkPrimitiveSelection, drawingWorkspace.state.selectedIds, snapshotRevision]);
    const shouldLockForkPan = useMemo(() => useForkRuntime
        && drawingUiEnabled
        && (activeForkDrawingTool !== null
            || forkManipulationActive
            || (drawingWorkspace.state.activeTool === "cursor" && forkSelectionModifierPressed)
            || drawingWorkspace.interaction.drawingState.type === "drawing"), [activeForkDrawingTool, drawingUiEnabled, drawingWorkspace.interaction.drawingState.type, drawingWorkspace.state.activeTool, forkManipulationActive, forkSelectionModifierPressed, useForkRuntime]);
    const forkOverlayInputs = useMemo(() => ({
        measurementEnabled: Boolean((measurementEnabled ?? false) || shouldLockForkPan),
        selectedPriceLabels: createSelectedPriceLabelsInput(resolvedForkPriceMarkerSelection, Boolean(showDrawingPriceMarkers), visiblePanes[0]?.id ?? null),
        drawingPrimitives: forkDrawingPrimitiveInputs.length > 0 ? forkDrawingPrimitiveInputs : null,
    }), [forkDrawingPrimitiveInputs, measurementEnabled, resolvedForkPriceMarkerSelection, shouldLockForkPan, showDrawingPriceMarkers, visiblePanes]);
    const engineDataSource = useMemo(() => ({
        sourceId: `${adapterLabel}:${activeSymbol}:${activeTimeframe}`,
        symbol: activeSymbol,
        timeframe: activeTimeframe,
        adapterLabel,
        seriesData: engineSeriesData,
    }), [adapterLabel, activeSymbol, activeTimeframe, engineSeriesData]);
    useEffect(() => {
        if (!useForkRuntime || !chartSurfaceReady || paneSnapshots.length === 0 || plotData.length === 0 || typeof window === "undefined") {
            forkDegradeNotifiedRef.current = false;
            return;
        }
        const timers = [];
        const runPixelCheck = (blankChecks) => {
            if (forkDegradeNotifiedRef.current) {
                return;
            }
            const root = ref.current;
            if (!root) {
                return;
            }
            const canvas = root.querySelector('canvas[data-vn-kline-engine="canvas"]');
            if (!canvas || canvas.width <= 1 || canvas.height <= 1) {
                return;
            }
            const context = canvas.getContext("2d");
            if (!context || typeof context.getImageData !== "function") {
                return;
            }
            const buffer = context.getImageData(0, 0, canvas.width, canvas.height).data;
            let hasRenderedPixels = false;
            for (let index = 3; index < buffer.length; index += 4) {
                if ((buffer[index] ?? 0) > 0) {
                    hasRenderedPixels = true;
                    break;
                }
            }
            if (hasRenderedPixels) {
                return;
            }
            const nextBlankChecks = blankChecks + 1;
            if (nextBlankChecks < FORK_DEGRADE_REQUIRED_BLANK_CHECKS) {
                timers.push(window.setTimeout(() => {
                    runPixelCheck(nextBlankChecks);
                }, FORK_DEGRADE_PIXEL_RECHECK_DELAY_MS));
                return;
            }
            if (!hasRenderedPixels) {
                forkDegradeNotifiedRef.current = true;
                onRuntimeDegraded?.("fork-no-render-output");
            }
        };
        timers.push(window.setTimeout(() => {
            runPixelCheck(0);
        }, FORK_DEGRADE_PIXEL_CHECK_DELAY_MS));
        return () => {
            timers.forEach((timer) => window.clearTimeout(timer));
        };
    }, [chartSurfaceReady, onRuntimeDegraded, paneSnapshots.length, plotData.length, ref, useForkRuntime]);
    const forkDrawingContextMenuDrawing = useMemo(() => {
        if (!forkDrawingContextMenu) {
            return null;
        }
        return resolvedDrawings.find((drawing) => drawing.id === forkDrawingContextMenu.drawingId) ?? resolvedSelectedDrawing;
    }, [forkDrawingContextMenu, resolvedDrawings, resolvedSelectedDrawing]);
    const forkDrawingContextMenuItems = useMemo(() => {
        if (!forkDrawingContextMenuDrawing) {
            return [];
        }
        return createDrawingContextMenuItems(forkDrawingContextMenuDrawing, drawingWorkspace.state.clipboard !== null, {
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
            selectGroup: (groupId) => drawingWorkspace.interaction.selectGroup(groupId),
            deleteGroup: (groupId) => drawingWorkspace.interaction.deleteGroup(groupId),
        });
    }, [bringSelectedToFront, copySelectedDrawing, drawingWorkspace, forkDrawingContextMenuDrawing, pasteCopiedDrawing, sendSelectedToBack, t]);
    // seriesLabelKeys, formatSeriesSuffix, seriesAbbreviations, formatSeriesDisplayName
    // extracted to utils/seriesLabelUtils.js
    const paneHeaderLabels = useMemo(() => ({
        dragAriaLabel: (label) => t("library.dragPane", { pane: label }) || `Drag ${label}`,
        dragTitle: (pane) => pane.pinned ? (t("library.dragDisabled") || "Drag disabled") : (t("library.dragTitle") || "Drag to reposition pane"),
        addSeriesAriaLabel: (label) => t("library.addSeriesToPane", { pane: label }) || `Add series to ${label}`,
        addSeriesTitle: t("library.addSeries") || "Add indicator/series",
        toggleVisibleAriaLabel: (label, visible) => t(visible ? "library.hidePaneAria" : "library.showPaneAria", { pane: label }) || `${visible ? "Hide" : "Show"} ${label}`,
        toggleVisibleTitle: (pane) => pane.pinned ? (t("library.primaryPaneLocked") || "Locked") : t(pane.visible ? "library.hidePane" : "library.restorePane") || (pane.visible ? "Hide pane" : "Restore pane"),
        removeAriaLabel: (label) => t("library.hidePaneAria", { pane: label }) || `Remove ${label}`,
        removeTitle: t("library.removePaneHint") || "Hide pane",
    }), [t]);
    const indicatorLegendLabels = useMemo(() => ({
        seriesLabel: (seriesType, params) => formatSeriesDisplayName(seriesType, params, t),
        showIndicatorTitle: t("library.showIndicator") || "Show indicator",
        hideIndicatorTitle: t("library.hideIndicator") || "Hide indicator",
        removeIndicatorTitle: t("library.removeIndicator") || "Remove indicator",
        showIndicatorAriaLabel: (label) => t("library.showIndicatorAria", { series: label }) || `Show ${label}`,
        hideIndicatorAriaLabel: (label) => t("library.hideIndicatorAria", { series: label }) || `Hide ${label}`,
        removeIndicatorAriaLabel: (label) => t("library.removeIndicatorAria", { series: label }) || `Remove ${label}`,
    }), [t]);
    if (error) {
        throw error;
    }
    const ready = size.width > 0 && size.height > 0;
    if (!ready || (loading && !hasExternalData) || plotData.length === 0) {
        return (_jsx("div", { ref: ref, className: className, style: {
                display: "flex",
                flexDirection: "column",
                width: "100%",
                height: "100%",
                minHeight: 0,
                ...style,
            }, children: _jsx(WidgetEmptyState, { loading: loading || !ready }) }));
    }
    const axisStroke = isDark ? "#64748b" : "#475569";
    const axisTickFill = isDark ? "#e2e8f0" : "#0f172a";
    const paneToolbarNodes = renderPaneToolbar
        ? visiblePanes.map((pane) => {
            const snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            const paneLeft = snapshot.plotBounds.left;
            const paneRight = Math.max(0, size.width - (snapshot.plotBounds.left + snapshot.plotBounds.width));
            const paneToolbarRight = paneRight + 3;
            var wrapperProps = buildPaneToolbarWrapperProps(pane, snapshot, hoveredPaneId, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner, size);
            return _jsx("div", Object.assign({}, wrapperProps, { children: renderPaneToolbar({
                    pane: pane,
                    snapshot: snapshot,
                    hovered: hoveredPaneId === pane.id,
                    actions: {
                        toggleVisibility: function () { return handlePaneToggleVisible(pane.id); },
                        removePane: function () { return handlePaneRemove(pane.id); },
                        addSeries: function () { return handlePaneAddSeries(pane.id); },
                        toggleSeries: function (seriesType, seriesIndex) { return handlePaneToggleSeries(pane.id, seriesType, seriesIndex); },
                        removeSeries: function (seriesType, seriesIndex) { return handlePaneRemoveSeries(pane.id, seriesType, seriesIndex); },
                    },
                }) }), "".concat(pane.id, "-toolbar"));
        })
        : visiblePanes.map(function (pane) {
            var snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            var localizedPane = localizePane(pane);
            var wrapperProps = buildPaneToolbarWrapperProps(pane, snapshot, hoveredPaneId, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner, size);
            return _jsx("div", Object.assign({}, wrapperProps, { children: _jsxs(PaneHeader, { pane: localizedPane, className: "vnsc-pane-header", onToggleVisible: function () { return handlePaneToggleVisible(pane.id); }, onRemove: function () { return handlePaneRemove(pane.id); }, onAddSeries: function () { return handlePaneAddSeries(pane.id); }, addButtonRef: undefined, labels: paneHeaderLabels, children: [_jsx(IndicatorLegend, { pane: localizedPane, onToggleSeries: function (seriesType, seriesIndex) { return handlePaneToggleSeries(pane.id, seriesType, seriesIndex); }, onRemoveSeries: function (seriesType, seriesIndex) { return handlePaneRemoveSeries(pane.id, seriesType, seriesIndex); }, className: "rsc-pane-header__legend", labels: indicatorLegendLabels })] }) }), "".concat(pane.id, "-toolbar"));
        });
    var paneSplitterNodes = renderPaneSplitter
        ? visiblePanes.slice(0, -1).map(function (pane, splitterIndex) {
            var snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            var splitterWrapperProps = buildPaneSplitterWrapperProps(pane, snapshot, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner);
            return _jsx("div", Object.assign({}, splitterWrapperProps, { children: renderPaneSplitter({
                    pane: pane,
                    snapshot: snapshot,
                    splitterIndex: splitterIndex,
                    top: snapshot.bounds.top + snapshot.bounds.height,
                    left: snapshot.plotBounds.left,
                    right: Math.max(0, size.width - (snapshot.plotBounds.left + snapshot.plotBounds.width)),
                }) }), "".concat(pane.id, "-splitter-owner"));
        })
        : visiblePanes.slice(0, -1).map(function (pane, splitterIndex) {
            var snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            var splitterWrapperProps = buildPaneSplitterWrapperProps(pane, snapshot, useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner);
            return _jsx("div", Object.assign({}, splitterWrapperProps, { children: _jsx(ChartSplitter, { className: "vnsc-splitter", splitterIndex: splitterIndex, available: localAvailable, onCommitDelta: localApplyDelta, onDoubleClick: localResetToDefault, title: t("library.splitterHint") || "Drag to resize", style: {
                        top: snapshot.bounds.top + snapshot.bounds.height,
                        left: snapshot.plotBounds.left,
                        right: Math.max(0, size.width - (snapshot.plotBounds.left + snapshot.plotBounds.width)),
                    } }, "".concat(pane.id, "-splitter")) }), "".concat(pane.id, "-splitter-owner"));
        });
    var drawingChromeContent = renderDrawingChrome
        ? renderDrawingChrome({
            activeTool: drawingWorkspace.state.activeTool,
            drawingWorkspace: drawingWorkspace,
            isDark: isDark,
            magnetSensitivity: magnetSensitivity,
            paneSnapshots: paneSnapshots,
            selectedDrawing: resolvedSelectedDrawing,
            visibleRange: useForkRuntime ? effectiveForkVisibleRange : resolvedLegacyVisibleRange,
            size: { width: size.width, height: size.height },
        })
        : buildDrawingChromeContent(resolvedSelectedDrawing, drawingWorkspace, isDark, magnetSensitivity, paneSnapshots, resolvedLegacyVisibleRange, useForkRuntime, effectiveForkVisibleRange, size, t, plotData, visibleDomainRef, cloneSelectedDrawing, toggleSelectedLock, handleStartTextEdit, bringSelectedToFront, sendSelectedToBack);
    var drawingChromeWrapperProps = buildDrawingChromeWrapperProps(useForkRuntime, claimForkPointerOwner, releaseForkPointerOwner);
    var drawingChromeNode = drawingChromeContent
        ? _jsx("div", Object.assign({}, drawingChromeWrapperProps, { children: drawingChromeContent }))
        : null;
    return (_jsxs("div", { ref: ref, className: `vnsc-root ${className || ""}`, "data-chart-theme": resolvedTheme, "data-vn-camera-envelope": useForkRuntime ? forkCameraEnvelopeMode : "shared", onPointerMove: handleWidgetPointerMove, onPointerLeave: handleWidgetPointerLeave, style: {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            minHeight: 0,
            ...style,
        }, children: [showHeader ? (renderHeader ? (renderHeader({ symbol: activeSymbol, timeframe: activeTimeframe })) : (_jsx(OHLCHeader, { symbol: activeSymbol, timeframe: activeTimeframe, showMenu: true, isFullscreen: isFullscreen, searchOpen: searchOpen, onSearchToggle: () => setSearchOpen((prev) => !prev), onSettingsClick: () => setLocalSettingsOpen(true), onFullscreenClick: handleFullscreenToggle, onSnapshotClick: handleSnapshot }))) : null, showHeader && searchOpen && (_jsx("div", { className: "vnsc-symbol-search-dropdown-container", style: {
                    position: "absolute",
                    top: "36px",
                    left: "12px",
                    zIndex: 100,
                    width: "240px",
                }, children: _jsx(VNSymbolSearch, { adapter: adapter, value: activeSymbol, onChange: (sym) => {
                        onSymbolChange?.(sym);
                        setSearchOpen(false);
                    } }) })), renderReplayBar && renderReplayBar({
                playing: false,
                speed: 1,
                currentBar: 0,
                totalBars: 0,
                onPlay: () => { },
                onPause: () => { },
                onStepForward: () => { },
                onStepBack: () => { },
                onRewind: () => { },
                onSpeedChange: () => { },
            }), _jsxs("div", { style: { position: "relative", display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }, children: [showToolbar ? (renderToolbar ? (renderToolbar({
                        activeTool: drawingWorkspace.state.activeTool,
                        onToolSelect: (tool) => drawingWorkspace.setActiveTool(tool),
                    })) : (_jsxs("div", { className: `vnsc-drawing-toolbar-shell${toolbarCollapsed ? " vnsc-drawing-toolbar-shell--collapsed" : ""}`, children: [_jsx("span", { className: "vnsc-drawing-toolbar-handle", "aria-hidden": "true" }), _jsx(DrawingToolbar, { activeTool: drawingWorkspace.state.activeTool, onToolSelect: (tool) => drawingWorkspace.setActiveTool(tool), magnetSensitivity: magnetSensitivity === "strong" ? 3 : magnetSensitivity === "normal" ? 2 : magnetSensitivity === "weak" ? 1 : 0, onMagnetCycle: () => setMagnetSensitivity((prev) => {
                                    if (prev === "off")
                                        return "weak";
                                    if (prev === "weak")
                                        return "normal";
                                    if (prev === "normal")
                                        return "strong";
                                    return "off";
                                }), collapsed: toolbarCollapsed, onToggleCollapse: () => setToolbarCollapsed((prev) => !prev) })] }))) : null, showToolbar && toolbarCollapsed && (_jsx("button", { type: "button", className: "vnsc-drawing-toolbar__expand-btn", onClick: () => setToolbarCollapsed(false), title: t("drawing.showToolbar") || "Show Toolbar", style: {
                            position: "absolute", left: "8px", bottom: "8px", width: "28px", height: "28px",
                            borderRadius: "4px", border: "1px solid var(--vnsc-border, #2a2a2a)",
                            background: "var(--vnsc-bg-secondary, #111820)", color: "var(--vnsc-text-secondary, #a0a0a0)",
                            cursor: "pointer", zIndex: 45, display: "flex", alignItems: "center",
                            justifyContent: "center", fontSize: "14px", fontWeight: "bold",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                        }, children: "\u00BB" })), useForkRuntime ? (_jsxs("div", { className: "rsc-engine-surface", onClick: handleForkClick, onContextMenu: handleForkContextMenu, style: {
                            position: "relative",
                            display: "flex",
                            flex: 1,
                            minHeight: 0,
                            cursor: forkSurfaceCursor,
                        }, children: [_jsxs(StockChartProvider, { value: forkStockChartContextValue, children: [_jsx(EngineHost, { panes: enginePanes, dataSource: engineDataSource, engineOptions: engineOptions, overlayInputs: forkOverlayInputs, theme: engineTheme, locale: activeLocale, onEngineReady: handleEngineReady, onClick: handleForkDrawingClick, onOverlayStateChange: handleForkOverlayStateChange, onVisibleRangeChange: handleForkVisibleRangeChange, onPaneSnapshotsChange: emitPaneSnapshots, onPaneHover: emitHoveredPaneId, onPointerDown: handleForkPointerDown, onPointerMove: handleForkPointerMove, onPointerUp: handleForkPointerUp, onPointerLeave: handleForkPointerLeave, onContextMenu: handleForkHostContextMenu, style: { flex: 1, minHeight: 0 } }), forkChartRenderContextValue ? (_jsxs(ChartRenderContext.Provider, { value: forkChartRenderContextValue, children: [whaleEvents.length > 0 ? (_jsx("div", { "data-rsc-fork-overlay": "whale", style: { position: "absolute", inset: 0, pointerEvents: "none" }, children: _jsx(WhaleMarketBubbleOverlay, { events: whaleEvents, visibleRange: forkChartRenderContextValue.visibleRange }) })) : null, enableCVD && cvdData.length > 0 ? (_jsx("div", { "data-rsc-fork-overlay": "cvd", style: { position: "absolute", inset: 0, pointerEvents: "none" }, children: _jsx(CVDIndicator, { data: cvdData, visibleRange: forkChartRenderContextValue.visibleRange, mode: cvdMode }) })) : null, externalCvdSeries && externalCvdSeries.length > 0 ? (_jsx("div", { "data-rsc-fork-overlay": "external-cvd", style: { position: "absolute", inset: 0, pointerEvents: "none" }, children: _jsx(ExternalCVDOverlay, { series: externalCvdSeries }) })) : null, children != null ? (_jsx("svg", { "data-rsc-fork-children": "true", width: size.width, height: size.height, style: { position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }, children: children })) : null] })) : null] }), resolvedForkPriceMarkerSelection && showDrawingPriceMarkers ? (_jsx(DrawingPriceLabelsOverlay, { enabled: true, highlighted: true, renderMode: "engine", runtime: "fork", priceFormat: (value) => priceFormat(value), enginePriceLabels: forkOverlayState?.drawingPriceLabels ?? null, height: size.height })) : null, _jsx(MeasurementOverlay, { enabled: measurementEnabled ?? false, isDark: isDark, priceFormat: priceFormat, renderMode: "engine", engineMeasurementState: forkOverlayState?.measurement ?? null, paneSnapshots: paneSnapshots, width: size.width, height: size.height }), _jsx(ForkXAxisOverlay, { ticks: forkXAxisTicks, hoverLabel: forkXAxisHoverLabel, top: Math.max(0, (paneSnapshots[paneSnapshots.length - 1]?.bounds.top ?? 0) + (paneSnapshots[paneSnapshots.length - 1]?.bounds.height ?? 0)), isDark: isDark }), _jsx(ForkPaneTooltips, { hoveredDatum: forkHoveredDatum, isDark: isDark, paneSnapshots: paneSnapshots, panes: visiblePanes }), forkRubberBandSelection ? (_jsx("div", { "aria-hidden": "true", "data-rsc-fork-rubber-band": "true", style: {
                                    position: "absolute",
                                    left: Math.min(forkRubberBandSelection.startPixel[0], forkRubberBandSelection.currentPixel[0]),
                                    top: Math.min(forkRubberBandSelection.startPixel[1], forkRubberBandSelection.currentPixel[1]),
                                    width: Math.abs(forkRubberBandSelection.currentPixel[0] - forkRubberBandSelection.startPixel[0]),
                                    height: Math.abs(forkRubberBandSelection.currentPixel[1] - forkRubberBandSelection.startPixel[1]),
                                    border: "1px dashed rgba(56, 189, 248, 0.9)",
                                    background: "rgba(56, 189, 248, 0.12)",
                                    pointerEvents: "none",
                                    zIndex: 21,
                                } })) : null] })) : (_jsxs("div", { style: {
                            position: "relative",
                            display: "flex",
                            flex: 1,
                            minHeight: 0,
                        }, children: [_jsxs(DynamicChart, { panes: visiblePanes, heights: activeHeights, data: legacyChartScale.data, width: size.width, height: size.height, margin: CHART_MARGIN, type: "hybrid", seriesName: `vnstock-${activeSymbol}-${activeTimeframe}-r${resetKey}`, xScale: legacyChartScale.xScale, xAccessor: legacyChartScale.xAccessor, displayXAccessor: legacyChartScale.displayXAccessor, xExtents: legacyChartScale.xExtents, ratio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, mouseMoveEvent: true, zoomEvent: true, panEvent: true, useCrossHairStyleCursor: true, onClick: onClick, onContextMenu: onContextMenu, onVisibleDomainChange: handleLegacyVisibleDomainChange, onVisibleRangeChange: handleLegacyVisibleRangeChange, axisStroke: axisStroke, axisTickFill: axisTickFill, isDark: isDark, dateFormat: (date) => dateFormat(date), priceFormat: (value) => priceFormat(value), volumeFormat: (value) => volumeFormat(value), className: className, children: [whaleEvents.length > 0 && (_jsx(WhaleMarketBubbleOverlay, { events: whaleEvents, visibleRange: resolvedLegacyVisibleRange })), enableCVD && cvdData.length > 0 && (_jsx(CVDIndicator, { data: cvdData, visibleRange: resolvedLegacyVisibleRange, mode: cvdMode })), externalCvdSeries && externalCvdSeries.length > 0 && (_jsx(ExternalCVDOverlay, { series: externalCvdSeries })), children] }, legacyChartScale.usesDiscontinuousScale ? "disc" : "cont"), resolvedSelectedDrawing && showDrawingPriceMarkers && legacyCoordinateBridge ? (_jsx(DrawingPriceLabelsOverlay, { enabled: true, highlighted: true, runtime: "legacy", priceFormat: (value) => priceFormat(value), drawing: resolvedSelectedDrawing, coordinateBridge: legacyCoordinateBridge, paneSnapshots: legacyPaneSnapshots, height: size.height })) : null, legacyCoordinateBridge ? (_jsx(MeasurementOverlay, { enabled: measurementEnabled ?? false, isDark: isDark, priceFormat: priceFormat, coordinateBridge: legacyCoordinateBridge, paneSnapshots: legacyPaneSnapshots, width: size.width, height: size.height })) : null] })), typeof darkFlowStrength === "number" && Number.isFinite(darkFlowStrength) ? (_jsx(DarkFlowBadge, { strength: darkFlowStrength, signalType: darkFlowSignalType })) : null, paneToolbarNodes, paneSplitterNodes, drawingChromeNode, useForkRuntime && forkDrawingContextMenu && forkDrawingContextMenuDrawing ? (_jsx(DrawingContextMenu, { ariaLabel: t("drawing.contextMenuTitle"), title: t("drawing.contextMenuTitle"), isDark: isDark, position: { x: forkDrawingContextMenu.x, y: forkDrawingContextMenu.y }, onClose: closeForkDrawingContextMenu, items: forkDrawingContextMenuItems })) : null, settingsModalNode, snapshotPreviewModalNode, hasRightSidebar && (_jsxs(_Fragment, { children: [_jsx("div", { className: "vnsc-sidebar-splitter", onPointerDown: handleSidebarPointerDown, style: { width: "4px", cursor: "col-resize", zIndex: 49, background: isResizingSidebar ? "var(--vnsc-accent, #2962ff)" : "transparent", transition: "background 0.2s" } }), _jsxs("div", { className: "vnsc-sidebar-right", style: { width: `${sidebarWidth}px`, display: "flex", flexDirection: "column", height: "100%", borderLeft: "1px solid var(--vnsc-border, #2a2a2a)", background: "var(--vnsc-bg-secondary, #111820)", position: "relative", zIndex: 48, minWidth: "150px", overflowY: "auto" }, children: [drawingDockNode, renderPaperTradePanel && renderPaperTradePanel({ positions: [], journal: [], onReset: () => { }, onClose: onPaperTradePanelClose }), showAdvisoryPanel ? (_jsx(AdvisoryPanel, { show: showAdvisoryPanel, result: advisoryResult ?? null, isLoading: isAdvisoryLoading ?? false, onRefresh: onAdvisoryRefresh })) : null, showTapePanel ? (_jsx(TapePanel, { show: showTapePanel, entries: tapeEntries ?? [], isLoading: isTapeLoading ?? false, filterBillions: tapeFilterBillions ?? 0, onFilterChange: onTapeFilterChange })) : null] })] }))] }), showFooter ? (renderFooter ? (renderFooter({ timeframe: activeTimeframe, range: localRange })) : (_jsx(TimeframeFooter, { timeframe: activeTimeframe, onTimeframeChange: handleTimeframeChange, range: localRange, onRangeChange: handleRangeChange, supportedTimeframes: supportedTimeframes }))) : null] }));
});
VNInvestChartsContent.displayName = "VNInvestChartsContent";
export const VNInvestCharts = forwardRef((props, ref) => {
    const runtimePolicy = evaluateRuntimePolicy({
        engineRuntime: props.engineRuntime,
        drawingUiEnabled: props.drawingUiEnabled,
        drawingActiveTool: props.drawingActiveTool,
        selectedDrawingType: props.selectedDrawing?.type ?? null,
    });
    const resolvedRequestedRuntime = runtimePolicy.resolvedRuntime;
    const resolvedRequestedReason = runtimePolicy.reasonCode;
    const lastNotifiedRuntimeResolutionRef = useRef(null);
    useEffect(() => {
        const targetTz = props.timezone || props.defaultTimezone || "Asia/Ho_Chi_Minh";
        setGlobalTimezone(targetTz);
    }, [props.timezone, props.defaultTimezone]);
    const effectiveRuntime = resolvedRequestedRuntime;
    const effectiveRuntimeReason = resolvedRequestedReason;
    useEffect(() => {
        const previous = lastNotifiedRuntimeResolutionRef.current;
        if (previous && previous.runtime === effectiveRuntime && previous.reason === effectiveRuntimeReason) {
            return;
        }
        lastNotifiedRuntimeResolutionRef.current = {
            runtime: effectiveRuntime,
            reason: effectiveRuntimeReason,
        };
        props.onRuntimeResolved?.(effectiveRuntime, effectiveRuntimeReason);
    }, [effectiveRuntime, effectiveRuntimeReason, props.onRuntimeResolved]);
    const handleBoundaryError = useCallback((caughtError) => {
        props.onError?.(caughtError);
    }, [props.onError]);
    const handleRuntimeDegraded = useCallback((reason) => {
        void reason;
    }, []);
    const contentRuntimeKey = `${effectiveRuntime}-${props.showNonTradingDays ? "calendar" : "trading"}`;
    return (_jsx(VNInvestChartsProvider, { adapter: props.adapter ?? FALLBACK_ADAPTER, symbol: props.symbol, timeframe: props.timeframe, locale: props.locale, messages: props.messages, theme: props.theme, panes: props.panes, drawings: props.drawings, activeTool: props.drawingActiveTool, children: _jsx(WidgetErrorBoundary, { onError: handleBoundaryError, children: _jsx(VNInvestChartsContent, { ref: ref, ...props, adapter: props.adapter ?? FALLBACK_ADAPTER, engineRuntime: effectiveRuntime, onRuntimeDegraded: handleRuntimeDegraded }, contentRuntimeKey) }, effectiveRuntime) }));
});
VNInvestCharts.displayName = "VNInvestCharts";
