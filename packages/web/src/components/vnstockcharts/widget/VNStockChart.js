import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "d3-format";
import { scaleTime } from "d3-scale";
import { timeFormat } from "d3-time-format";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../lib/core/seriesValueResolver.js";
import { createPaneSpecsFromDescriptors, } from "@vnstockcharts/vn-kline-engine-core";
import { EngineHost } from "@vnstockcharts/vn-kline-engine-react";
import { DynamicChart, DEFAULT_PANES, useChartTheme } from "../lib/core/index.js";
import { createCanonicalSeriesStore } from "../lib/core/canonicalSeriesStore.js";
import { enrichDataWithCanonicalStore } from "../lib/core/calculators/enrichDataWithCanonicalStore.js";
import { useCanvasResize } from "../lib/core/hooks/useCanvasResize.js";
import { computePaneScaleSlotDomains } from "../lib/core/paneScaleSlotDomains.js";
import { detectWhaleEvents } from "../lib/indicators/overlays/whaleDetector.js";
import { WhaleMarketBubbleOverlay } from "../lib/indicators/overlays/WhaleMarketBubbleOverlay.js";
import { CVDIndicator } from "../lib/indicators/overlays/CVDIndicator.js";
import { ExternalCVDOverlay } from "../lib/indicators/overlays/ExternalCVDOverlay.js";
import { DarkFlowBadge } from "../lib/indicators/overlays/DarkFlowBadge.js";
import { resolvePaneDataIndexAtPixel, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, resolvePaneValueAtPixel, } from "./forkRuntimeCompat.js";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary.js";
import { WidgetEmptyState } from "./WidgetEmptyState.js";
import DrawingPriceLabelsOverlay from "./DrawingPriceLabelsOverlay.js";
import MeasurementOverlay from "./MeasurementOverlay.js";
import { WidgetI18nProvider } from "./context/WidgetI18nContext.js";
import { normalizeSeriesTypeId } from "../lib/core/types/pane-descriptor.js";
const priceFormat = format(",.2f");
const volumeFormat = format(".3s");
const dateFormat = timeFormat("%d/%m/%Y %H:%M");
const CHART_MARGIN = { left: 60, right: 68, top: 8, bottom: 28 };
function clampIndex(index, length) {
    if (length <= 0) {
        return 0;
    }
    const lastIndex = length - 1;
    return Math.min(lastIndex, Math.max(0, Math.floor(index)));
}
function normalizeForkVisibleRange(range, data) {
    if (data.length === 0) {
        return null;
    }
    const rawStartIndex = clampIndex(Math.min(range.from, range.to), data.length);
    const rawEndIndex = clampIndex(Math.max(range.from, range.to), data.length);
    const startBar = data[rawStartIndex];
    const endBar = data[rawEndIndex];
    if (!startBar?.date || !endBar?.date) {
        return null;
    }
    return {
        startIndex: rawStartIndex,
        endIndex: rawEndIndex,
        startDate: startBar.date,
        endDate: endBar.date,
        barCount: rawEndIndex - rawStartIndex + 1,
    };
}
function resolveEngineSeriesValueForRuntime(datum, series) {
    switch (series.type) {
        case "MACD": {
            const value = resolveSeriesStructuredValue(datum, series);
            return value?.divergence;
        }
        case "Whale": {
            const value = resolveSeriesStructuredValue(datum, series);
            const buy = value?.whaleBuyVol ?? 0;
            const sell = value?.whaleSellVol ?? 0;
            return buy - sell;
        }
        case "CVDApprox":
            return datum.cvdDelta ?? datum.cvdApprox;
        case "CVDRealtime":
            return datum.cvdRealtime;
        default:
            return resolveSeriesValue(datum, series);
    }
}
function buildLegacyPaneSnapshots(panes, heights, canvasSize, scaleSlotDomains) {
    const plotWidth = Math.max(0, canvasSize.width - CHART_MARGIN.left - CHART_MARGIN.right);
    let top = CHART_MARGIN.top;
    return panes.map((pane, index) => {
        const height = heights[index] ?? 0;
        const hasLeftAxis = pane.series.some((series) => series.visible !== false && series.yAxis === "left");
        const hasRightAxis = pane.series.some((series) => series.visible !== false && series.yAxis === "right");
        const snapshotTop = top;
        top += height;
        const leftBounds = hasLeftAxis
            ? {
                top: snapshotTop,
                left: 0,
                width: CHART_MARGIN.left,
                height,
            }
            : undefined;
        const rightBounds = hasRightAxis
            ? {
                top: snapshotTop,
                left: canvasSize.width - CHART_MARGIN.right,
                width: CHART_MARGIN.right,
                height,
            }
            : undefined;
        const scaleSlotBounds = {
            ...(leftBounds ? { [`${pane.id}-left`]: leftBounds } : {}),
            ...(rightBounds ? { [`${pane.id}-right`]: rightBounds } : {}),
        };
        const scaleSlotStates = {
            ...(leftBounds ? { [`${pane.id}-left`]: { side: "left", mode: "auto", visible: true, domain: scaleSlotDomains[`${pane.id}-left`] } } : {}),
            ...(rightBounds ? { [`${pane.id}-right`]: { side: "right", mode: "auto", visible: true, domain: scaleSlotDomains[`${pane.id}-right`] } } : {}),
        };
        return {
            paneId: pane.id,
            bounds: {
                top: snapshotTop,
                left: 0,
                width: canvasSize.width,
                height,
            },
            plotBounds: {
                top: snapshotTop,
                left: CHART_MARGIN.left,
                width: plotWidth,
                height,
            },
            axisBounds: {
                ...(leftBounds
                    ? {
                        left: leftBounds,
                    }
                    : {}),
                ...(rightBounds
                    ? {
                        right: rightBounds,
                    }
                    : {}),
            },
            scaleSlotBounds,
            scaleSlotStates,
            headerAnchor: {
                top: snapshotTop,
                left: CHART_MARGIN.left,
                width: plotWidth,
            },
            labelAnchor: {
                top: snapshotTop,
                left: 0,
                height,
            },
        };
    });
}
export function normalizePaneDescriptorsForExplicitScaleSlots(panes) {
    return panes.map((pane) => {
        const normalizedSeries = pane.series.flatMap((series) => {
            const normalizedType = normalizeSeriesTypeId(series.type);
            if (!normalizedType) {
                return [];
            }
            return [{
                    ...series,
                    type: normalizedType,
                    params: series.params ? { ...series.params } : undefined,
                    scaleSlotId: series.scaleSlotId ?? `${pane.id}-${series.yAxis}`,
                    subColors: series.subColors ? { ...series.subColors } : undefined,
                }];
        });
        const activeSeries = normalizedSeries.filter((series) => series.visible !== false);
        const hasLeftAxis = activeSeries.some((series) => series.yAxis === "left");
        const hasRightAxis = activeSeries.some((series) => series.yAxis === "right");
        return {
            ...pane,
            series: normalizedSeries,
            splitScale: hasLeftAxis && hasRightAxis,
        };
    });
}
const NORMALIZED_DEFAULT_PANES = normalizePaneDescriptorsForExplicitScaleSlots(DEFAULT_PANES);
function resolveVisiblePanes(panes) {
    const candidatePanes = panes?.length ? normalizePaneDescriptorsForExplicitScaleSlots(panes) : NORMALIZED_DEFAULT_PANES;
    const nextPanes = candidatePanes.filter((pane) => pane.visible);
    return nextPanes.length > 0 ? nextPanes : NORMALIZED_DEFAULT_PANES.filter((pane) => pane.visible);
}
function inferAxisSideFromScaleSlotId(scaleSlotId) {
    if (scaleSlotId.endsWith("-left")) {
        return "left";
    }
    if (scaleSlotId.endsWith("-right")) {
        return "right";
    }
    return "right";
}
function mergePaneSnapshotDomains(snapshots, scaleSlotDomains) {
    return snapshots.map((snapshot) => {
        const scaleSlotIds = new Set([
            ...Object.keys(snapshot.scaleSlotBounds),
            ...Object.keys(snapshot.scaleSlotStates ?? {}),
        ]);
        const scaleSlotStates = Object.fromEntries([...scaleSlotIds].map((scaleSlotId) => {
            const currentState = snapshot.scaleSlotStates[scaleSlotId];
            return [scaleSlotId, {
                    side: currentState?.side ?? inferAxisSideFromScaleSlotId(scaleSlotId),
                    mode: currentState?.mode ?? "auto",
                    visible: currentState?.visible ?? true,
                    domain: scaleSlotDomains[scaleSlotId] ?? currentState?.domain,
                }];
        }));
        return {
            ...snapshot,
            scaleSlotStates,
        };
    });
}
function resolvePreferredScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]) {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = Object.entries(snapshot.scaleSlotStates)
        .filter(([, state]) => state.visible)
        .map(([scaleSlotId]) => scaleSlotId);
    if (visibleScaleSlotIds.length === 0) {
        return undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? visibleScaleSlotIds[0];
}
function findPlotDataIndex(point, data) {
    if (point.index >= 0 && point.index < data.length) {
        return point.index;
    }
    return data.findIndex((datum) => datum.date.getTime() === point.date.getTime());
}
function findPlotDataIndexByTime(timestamp, data) {
    return data.findIndex((datum) => datum.date.getTime() === timestamp);
}
function createWidgetCoordinateBridge({ paneSnapshots, visibleRange, plotData, }) {
    const normalizedVisibleRange = visibleRange
        ? ("from" in visibleRange && "to" in visibleRange
            ? visibleRange
            : { from: visibleRange.startIndex, to: visibleRange.endIndex })
        : null;
    if (!normalizedVisibleRange || plotData.length === 0 || paneSnapshots.length === 0) {
        return null;
    }
    const paneSnapshotMap = new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot]));
    const resolveWidgetChartPoint = (snapshot, resolvedScaleSlotId, x, y) => {
        const index = resolvePaneDataIndexAtPixel(snapshot, normalizedVisibleRange, x, plotData.length);
        if (index === null) {
            return undefined;
        }
        const datum = plotData[index];
        const value = resolvePaneValueAtPixel(snapshot, resolvedScaleSlotId, y);
        if (!datum?.date || value === null) {
            return undefined;
        }
        return {
            x: datum.date.getTime(),
            y: value,
        };
    };
    const resolveWidgetPointPixel = (snapshot, resolvedScaleSlotId, point, preferredIndex) => {
        const dataIndex = preferredIndex != null && preferredIndex >= 0 && preferredIndex < plotData.length
            && plotData[preferredIndex]?.date.getTime() === point.x
            ? preferredIndex
            : findPlotDataIndexByTime(point.x, plotData);
        if (dataIndex < 0) {
            return undefined;
        }
        const x = resolvePanePixelAtDataIndex(snapshot, normalizedVisibleRange, dataIndex, plotData.length);
        const y = resolvePanePixelAtValue(snapshot, resolvedScaleSlotId, point.y);
        if (x === null || y === null) {
            return undefined;
        }
        return { x, y };
    };
    return {
        engineRuntime: "fork",
        paneSnapshots,
        visibleRange: normalizedVisibleRange,
        resolveChartPoint: ({ paneId, x, y, scaleSlotId }) => {
            const snapshot = paneSnapshotMap.get(paneId);
            if (!snapshot) {
                return undefined;
            }
            const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
            if (!resolvedScaleSlotId) {
                return undefined;
            }
            return resolveWidgetChartPoint(snapshot, resolvedScaleSlotId, x, y);
        },
        chartPointToPixel: ({ paneId, point, scaleSlotId }) => {
            const snapshot = paneSnapshotMap.get(paneId);
            if (!snapshot) {
                return undefined;
            }
            const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
            if (!resolvedScaleSlotId) {
                return undefined;
            }
            return resolveWidgetPointPixel(snapshot, resolvedScaleSlotId, point);
        },
        resolveMeasurementPoint: ({ paneId, x, y, scaleSlotId }) => {
            const snapshot = paneSnapshotMap.get(paneId);
            if (!snapshot) {
                return undefined;
            }
            const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
            if (!resolvedScaleSlotId) {
                return undefined;
            }
            const chartPoint = resolveWidgetChartPoint(snapshot, resolvedScaleSlotId, x, y);
            if (!chartPoint) {
                return undefined;
            }
            const index = findPlotDataIndexByTime(chartPoint.x, plotData);
            const datum = index >= 0 ? plotData[index] : undefined;
            if (!datum?.date) {
                return undefined;
            }
            return {
                index,
                date: datum.date,
                price: chartPoint.y,
            };
        },
        measurementPointToPixel: ({ paneId, point, scaleSlotId }) => {
            const snapshot = paneSnapshotMap.get(paneId);
            if (!snapshot) {
                return undefined;
            }
            const resolvedScaleSlotId = resolvePreferredScaleSlotId(snapshot, scaleSlotId);
            if (!resolvedScaleSlotId) {
                return undefined;
            }
            return resolveWidgetPointPixel(snapshot, resolvedScaleSlotId, {
                x: point.date.getTime(),
                y: point.price,
            }, findPlotDataIndex(point, plotData));
        },
    };
}
function arePaneSnapshotsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    return JSON.stringify(left) === JSON.stringify(right);
}
const PANE_HEADER_HEIGHT = 28;
function resolveHoveredPaneId(event, snapshots) {
    const rect = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    // Only activate header hover when cursor is within the header strip, not the full pane.
    const hoveredSnapshot = snapshots.find((snapshot) => {
        const headerTop = snapshot.headerAnchor.top;
        const headerBottom = headerTop + PANE_HEADER_HEIGHT;
        const right = snapshot.bounds.left + snapshot.bounds.width;
        return localX >= snapshot.bounds.left && localX <= right && localY >= headerTop && localY <= headerBottom;
    });
    return hoveredSnapshot?.paneId ?? null;
}
function findPaneSnapshotAtPosition(snapshots, localX, localY) {
    return snapshots.find((snapshot) => {
        const right = snapshot.bounds.left + snapshot.bounds.width;
        const bottom = snapshot.bounds.top + snapshot.bounds.height;
        return localX >= snapshot.bounds.left && localX <= right && localY >= snapshot.bounds.top && localY <= bottom;
    });
}
function resolveFetchWindow(timeframe) {
    const to = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const lookbackDays = (() => {
        switch (timeframe) {
            case "1m":
            case "3m":
            case "5m":
                return 7;
            case "15m":
            case "30m":
                return 14;
            case "1h":
                return 30;
            case "4h":
                return 90;
            case "1d":
                return 365;
            default:
                return 30;
        }
    })();
    return { from: new Date(to.getTime() - lookbackDays * oneDay), to };
}
function mergeBarsByDate(previousBars, nextBar) {
    if (previousBars.length === 0) {
        return [nextBar];
    }
    const lastBar = previousBars[previousBars.length - 1];
    if (lastBar.date.getTime() === nextBar.date.getTime()) {
        return [...previousBars.slice(0, -1), nextBar];
    }
    if (lastBar.date.getTime() < nextBar.date.getTime()) {
        return [...previousBars, nextBar];
    }
    const existingIndex = previousBars.findIndex((bar) => bar.date.getTime() === nextBar.date.getTime());
    if (existingIndex >= 0) {
        return previousBars.map((bar, index) => (index === existingIndex ? nextBar : bar));
    }
    return [...previousBars, nextBar].sort((left, right) => left.date.getTime() - right.date.getTime());
}
function VNStockChartContent({ adapter, data, symbol, timeframe, engineRuntime = "fork", useWebGL = false, locale, theme, panes, xExtents: controlledXExtents, children, className, style, measurementEnabled, selectedDrawing, showDrawingPriceMarkers, enableWhale, whaleThreshold = 1_000_000, whaleOrders, enableCVD, cvdMode = "oscillator", externalCvdSeries, darkFlowStrength, darkFlowSignalType, onClick, onContextMenu, onVisibleDomainChange, onVisibleRangeChange, onPaneSnapshotsChange, onPaneHover, onPaneToggleVisibleRequest, onPaneRemoveRequest, onPaneAddSeriesRequest, onPaneToggleSeriesRequest, onPaneRemoveSeriesRequest, onRuntimeCapabilitiesChange, onCoordinateBridgeChange, renderPaneToolbar, renderPaneSplitter, onError, onRuntimeDegraded, }) {
    const { ref, size } = useCanvasResize();
    const hoveredPaneIdRef = useRef(null);
    const forkDegradeNotifiedRef = useRef(false);
    const forkPaneSnapshotsRef = useRef([]);
    const forkVisibleRangeRef = useRef(null);
    /** Ref to the fork engine instance — used to call setEnrichedData on data change */
    const engineInstanceRef = useRef(null);
    const [paneSnapshots, setPaneSnapshots] = useState([]);
    const [hoveredPaneId, setHoveredPaneId] = useState(null);
    const [forkVisibleRange, setForkVisibleRange] = useState(null);
    const [legacyVisibleRange, setLegacyVisibleRange] = useState(null);
    const themeState = useChartTheme("light");
    const resolvedTheme = theme ?? themeState.theme;
    const isDark = resolvedTheme === "dark";
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
    const hasExternalData = Array.isArray(data);
    const [bars, setBars] = useState(data ?? []);
    const [loading, setLoading] = useState(() => !hasExternalData);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (!hasExternalData) {
            return;
        }
        setBars(data ?? []);
        setLoading(false);
        setError(null);
    }, [data, hasExternalData]);
    const activeSymbol = symbol ?? "BTCUSDT";
    const activeTimeframe = timeframe ?? "1h";
    const activeLocale = locale ?? "vi";
    const useForkRuntime = engineRuntime === "fork";
    const adapterLabel = useMemo(() => {
        const candidate = adapter.label;
        return typeof candidate === "string" && candidate.length > 0 ? candidate : "widget-adapter";
    }, [adapter]);
    const visiblePanes = useMemo(() => resolveVisiblePanes(panes), [panes]);
    const enginePanes = useMemo(() => createPaneSpecsFromDescriptors(visiblePanes), [visiblePanes]);
    const engineOptions = useMemo(() => ({ useWebGL }), [useWebGL]);
    const canonicalStore = useMemo(() => {
        return createCanonicalSeriesStore();
    }, [symbol, timeframe]);
    const enrichedData = useMemo(() => {
        return enrichDataWithCanonicalStore(bars, {
            series: visiblePanes.flatMap((pane) => pane.series),
            canonicalStore,
            sourceId: symbol ?? "unknown",
            timeframe: timeframe ?? "unknown",
        });
    }, [bars, visiblePanes, canonicalStore, symbol, timeframe]);
    const plotData = useMemo(() => enrichedData.filter((datum) => Boolean(datum && datum.date)), [enrichedData]);
    const whaleEvents = useMemo(() => {
        // H-02: If external whale orders from API are provided, map them to WhaleEvent[]
        // using bar-timestamp matching. Falls back to internal detection when absent.
        if (enableWhale && whaleOrders && whaleOrders.length > 0 && plotData.length > 0) {
            const mapped = [];
            for (const order of whaleOrders) {
                const ts = new Date(order.ts).valueOf();
                // Find nearest bar index by timestamp
                let nearestIdx = 0;
                let minDiff = Math.abs(plotData[0].date.valueOf() - ts);
                for (let i = 1; i < plotData.length; i++) {
                    const diff = Math.abs(plotData[i].date.valueOf() - ts);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestIdx = i;
                    }
                }
                const matchedValue = order.matched_value > 0 ? order.matched_value : order.price * order.volume;
                if (!Number.isFinite(matchedValue) || matchedValue <= 0)
                    continue;
                mapped.push({
                    index: nearestIdx,
                    date: new Date(order.ts),
                    buyVol: order.side === "buy" ? matchedValue : 0,
                    sellVol: order.side === "sell" ? matchedValue : 0,
                    netDelta: order.side === "buy" ? matchedValue : -matchedValue,
                    dominance: order.side,
                    sizeCategory: order.size_class === "whale" ? "mega" : order.size_class === "shark" ? "xlarge" : "large",
                });
            }
            return mapped;
        }
        return enableWhale ? detectWhaleEvents(plotData, whaleThreshold) : [];
    }, [enableWhale, plotData, whaleThreshold, whaleOrders]);
    const cvdData = useMemo(() => (enableCVD ? plotData : []), [enableCVD, plotData]);
    const scaleSlotDomains = useMemo(() => computePaneScaleSlotDomains(visiblePanes, plotData), [plotData, visiblePanes]);
    const chartInnerHeight = Math.max(1, size.height - CHART_MARGIN.top - CHART_MARGIN.bottom);
    const paneHeights = useMemo(() => visiblePanes.map((pane) => pane.heightRatio * chartInnerHeight), [chartInnerHeight, visiblePanes]);
    const legacyPaneSnapshots = useMemo(() => buildLegacyPaneSnapshots(visiblePanes, paneHeights, { width: size.width, height: size.height }, scaleSlotDomains), [paneHeights, scaleSlotDomains, size.height, size.width, visiblePanes]);
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
    const forkCoordinateBridge = useMemo(() => createWidgetCoordinateBridge({
        paneSnapshots,
        visibleRange: forkVisibleRange,
        plotData,
    }), [forkVisibleRange, paneSnapshots, plotData]);
    const legacyCoordinateBridge = useMemo(() => createWidgetCoordinateBridge({
        paneSnapshots: legacyPaneSnapshots,
        visibleRange: resolvedLegacyVisibleRange,
        plotData,
    }), [legacyPaneSnapshots, plotData, resolvedLegacyVisibleRange]);
    const runtimeCapabilities = useMemo(() => ({
        engineRuntime: useForkRuntime ? "fork" : "legacy",
        paneToolbar: true,
        paneSplitters: true,
        chartCanvasOverlays: !useForkRuntime,
        measurementOverlay: !useForkRuntime || Boolean(forkCoordinateBridge),
        drawingOverlays: !useForkRuntime,
    }), [forkCoordinateBridge, useForkRuntime]);
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
    const chartSurfaceReady = size.width > 0 && size.height > 0 && (!(loading && !hasExternalData)) && plotData.length > 0;
    useEffect(() => {
        if (hasExternalData) {
            return undefined;
        }
        const controller = new AbortController();
        let unsubscribe = null;
        let disposed = false;
        setBars([]);
        setLoading(true);
        setError(null);
        const { from, to } = resolveFetchWindow(activeTimeframe);
        void adapter
            .fetchBars(activeSymbol, activeTimeframe, from, to)
            .then((nextBars) => {
            if (disposed || controller.signal.aborted) {
                return;
            }
            setBars(nextBars);
            setLoading(false);
            try {
                unsubscribe = adapter.subscribeToBar(activeSymbol, activeTimeframe, (nextBar) => {
                    if (disposed || controller.signal.aborted) {
                        return;
                    }
                    setBars((previousBars) => mergeBarsByDate(previousBars, nextBar));
                });
            }
            catch (subscribeError) {
                if (!disposed && !controller.signal.aborted) {
                    setError(subscribeError instanceof Error ? subscribeError : new Error(String(subscribeError)));
                }
            }
        })
            .catch((fetchError) => {
            if (disposed || controller.signal.aborted) {
                return;
            }
            setLoading(false);
            setError(fetchError instanceof Error ? fetchError : new Error(String(fetchError)));
        });
        return () => {
            disposed = true;
            controller.abort();
            unsubscribe?.();
        };
    }, [adapter, activeSymbol, activeTimeframe, hasExternalData]);
    useEffect(() => {
        onRuntimeCapabilitiesChange?.(runtimeCapabilities);
    }, [onRuntimeCapabilitiesChange, runtimeCapabilities]);
    const emitCoordinateBridge = useCallback((nextPaneSnapshots, nextVisibleRange) => {
        onCoordinateBridgeChange?.(useForkRuntime ? createWidgetCoordinateBridge({
            paneSnapshots: nextPaneSnapshots,
            visibleRange: nextVisibleRange,
            plotData,
        }) : null);
    }, [onCoordinateBridgeChange, plotData, useForkRuntime]);
    const emitPaneSnapshots = useCallback((nextSnapshots) => {
        const mergedSnapshots = mergePaneSnapshotDomains(nextSnapshots, scaleSlotDomains);
        if (useForkRuntime) {
            forkPaneSnapshotsRef.current = mergedSnapshots;
        }
        setPaneSnapshots((currentSnapshots) => {
            if (arePaneSnapshotsEqual(currentSnapshots, mergedSnapshots)) {
                return currentSnapshots;
            }
            return mergedSnapshots;
        });
        onPaneSnapshotsChange?.(mergedSnapshots);
        if (useForkRuntime) {
            emitCoordinateBridge(mergedSnapshots, forkVisibleRangeRef.current);
        }
    }, [emitCoordinateBridge, onPaneSnapshotsChange, scaleSlotDomains, useForkRuntime]);
    useEffect(() => {
        if (!chartSurfaceReady) {
            forkPaneSnapshotsRef.current = [];
            forkVisibleRangeRef.current = null;
            onCoordinateBridgeChange?.(null);
            setPaneSnapshots((currentSnapshots) => (currentSnapshots.length === 0 ? currentSnapshots : []));
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
        onCoordinateBridgeChange?.(null);
        emitPaneSnapshots(legacyPaneSnapshots);
    }, [chartSurfaceReady, emitPaneSnapshots, legacyPaneSnapshots, onCoordinateBridgeChange, useForkRuntime]);
    // ── KF-SSOT-T03: Wire enrichedData → fork engine ─────────────────────────
    const handleEngineReady = useCallback((engine) => {
        engineInstanceRef.current = engine;
    }, []);
    useEffect(() => {
        const engine = engineInstanceRef.current;
        if (!engine || !useForkRuntime) {
            return;
        }
        // Cast: EnrichedDatum[] → readonly Record<string, unknown>[] (intentional type erasure for layer isolation)
        engine.setEnrichedData(enrichedData);
    }, [enrichedData, useForkRuntime]);
    // ─────────────────────────────────────────────────────────────────────────
    const handleForkVisibleRangeChange = useCallback((range) => {
        forkVisibleRangeRef.current = range;
        setForkVisibleRange(range);
        emitCoordinateBridge(forkPaneSnapshotsRef.current, range);
        const normalizedRange = normalizeForkVisibleRange(range, plotData);
        if (!normalizedRange) {
            return;
        }
        onVisibleRangeChange?.(normalizedRange);
        onVisibleDomainChange?.([normalizedRange.startDate, normalizedRange.endDate]);
    }, [emitCoordinateBridge, onVisibleDomainChange, onVisibleRangeChange, plotData]);
    const handleLegacyVisibleRangeChange = useCallback((range) => {
        setLegacyVisibleRange(range);
        onVisibleRangeChange?.(range);
    }, [onVisibleRangeChange]);
    const emitHoveredPaneId = useCallback((paneId) => {
        if (hoveredPaneIdRef.current === paneId) {
            return;
        }
        hoveredPaneIdRef.current = paneId;
        setHoveredPaneId(paneId);
        onPaneHover?.(paneId);
    }, [onPaneHover]);
    const handleWidgetPointerMove = useCallback((event) => {
        const activeSnapshots = useForkRuntime ? paneSnapshots : legacyPaneSnapshots;
        emitHoveredPaneId(resolveHoveredPaneId(event, activeSnapshots));
    }, [emitHoveredPaneId, legacyPaneSnapshots, paneSnapshots, useForkRuntime]);
    const handleWidgetPointerLeave = useCallback(() => {
        emitHoveredPaneId(null);
    }, [emitHoveredPaneId]);
    const resolveForkEventPayload = useCallback((event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const snapshot = findPaneSnapshotAtPosition(paneSnapshots, localX, localY);
        if (!snapshot) {
            return {
                mouseXY: [localX, localY],
            };
        }
        const currentCharts = visiblePanes.findIndex((pane) => pane.id === snapshot.paneId);
        const dataIndex = forkVisibleRange
            ? resolvePaneDataIndexAtPixel(snapshot, forkVisibleRange, localX, plotData.length)
            : null;
        return {
            currentItem: dataIndex === null ? undefined : plotData[dataIndex],
            currentCharts: currentCharts >= 0 ? [currentCharts] : undefined,
            mouseXY: [localX, localY],
        };
    }, [forkVisibleRange, paneSnapshots, plotData, visiblePanes]);
    const handleForkClick = useCallback((event) => {
        if (!useForkRuntime || !onClick) {
            return;
        }
        onClick(resolveForkEventPayload(event), event.nativeEvent);
    }, [onClick, resolveForkEventPayload, useForkRuntime]);
    const handleForkContextMenu = useCallback((event) => {
        if (!useForkRuntime || !onContextMenu) {
            return;
        }
        event.preventDefault();
        onContextMenu(resolveForkEventPayload(event), event.nativeEvent);
    }, [onContextMenu, resolveForkEventPayload, useForkRuntime]);
    const engineTheme = useMemo(() => ({ mode: resolvedTheme }), [resolvedTheme]);
    const engineSeriesData = useMemo(() => {
        const seriesValuesById = {};
        for (const pane of visiblePanes) {
            for (let index = 0; index < pane.series.length; index += 1) {
                const series = pane.series[index];
                if (series.visible === false) {
                    continue;
                }
                const seriesId = series.id ?? `${pane.id}-series-${index}`;
                const values = plotData
                    .map((datum) => resolveEngineSeriesValueForRuntime(datum, series))
                    .filter((value) => typeof value === "number" && Number.isFinite(value));
                if (values.length > 0) {
                    seriesValuesById[seriesId] = values;
                }
            }
        }
        return seriesValuesById;
    }, [plotData, visiblePanes]);
    const engineDataSource = useMemo(() => ({
        sourceId: `${adapterLabel}:${activeSymbol}:${activeTimeframe}`,
        symbol: activeSymbol,
        timeframe: activeTimeframe,
        adapterLabel,
        seriesData: engineSeriesData,
    }), [adapterLabel, activeSymbol, activeTimeframe, engineSeriesData]);
    useEffect(() => {
        if (!useForkRuntime || !chartSurfaceReady || plotData.length === 0 || typeof window === "undefined") {
            forkDegradeNotifiedRef.current = false;
            return;
        }
        const timer = window.setTimeout(() => {
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
            const columns = 6;
            const rows = 4;
            let hasRenderedPixels = false;
            for (let row = 0; row < rows && !hasRenderedPixels; row += 1) {
                for (let column = 0; column < columns; column += 1) {
                    const x = Math.floor(((column + 0.5) / columns) * Math.max(1, canvas.width - 1));
                    const y = Math.floor(((row + 0.5) / rows) * Math.max(1, canvas.height - 1));
                    const pixel = context.getImageData(x, y, 1, 1).data;
                    if ((pixel[3] ?? 0) > 0) {
                        hasRenderedPixels = true;
                        break;
                    }
                }
            }
            if (!hasRenderedPixels) {
                forkDegradeNotifiedRef.current = true;
                onRuntimeDegraded?.("fork-no-render-output");
            }
        }, 450);
        return () => {
            window.clearTimeout(timer);
        };
    }, [chartSurfaceReady, onRuntimeDegraded, plotData.length, ref, useForkRuntime]);
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
    const safeXAccessor = (datum) => datum?.date ?? new Date(0);
    const paneToolbarNodes = renderPaneToolbar
        ? visiblePanes.map((pane) => {
            const snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            return (_jsx("div", { className: `rsc-pane-wrap${hoveredPaneId === pane.id ? " rsc-pane-wrap--active" : ""}`, style: {
                    position: "absolute",
                    top: snapshot.headerAnchor.top,
                    left: 0,
                    right: 0,
                    height: 28,
                    zIndex: 20,
                }, children: renderPaneToolbar({
                    pane,
                    snapshot,
                    hovered: hoveredPaneId === pane.id,
                    actions: {
                        toggleVisibility: () => onPaneToggleVisibleRequest?.(pane.id),
                        removePane: () => onPaneRemoveRequest?.(pane.id),
                        addSeries: () => onPaneAddSeriesRequest?.(pane.id),
                        toggleSeries: (seriesType, seriesIndex) => onPaneToggleSeriesRequest?.(pane.id, seriesType, seriesIndex),
                        removeSeries: (seriesType, seriesIndex) => onPaneRemoveSeriesRequest?.(pane.id, seriesType, seriesIndex),
                    },
                }) }, `${pane.id}-toolbar`));
        })
        : null;
    const paneSplitterNodes = renderPaneSplitter
        ? visiblePanes.slice(0, -1).map((pane, splitterIndex) => {
            const snapshot = paneSnapshotMap.get(pane.id);
            if (!snapshot) {
                return null;
            }
            return renderPaneSplitter({
                pane,
                snapshot,
                splitterIndex,
                top: snapshot.bounds.top + snapshot.bounds.height,
            });
        })
        : null;
    return (_jsxs("div", { ref: ref, className: className, "data-chart-theme": resolvedTheme, onPointerMove: handleWidgetPointerMove, onPointerLeave: handleWidgetPointerLeave, style: {
            position: "relative",
            display: "flex",
            flexDirection: "column",
            width: "100%",
            height: "100%",
            minHeight: 0,
            ...style,
        }, children: [useForkRuntime ? (_jsxs("div", { className: "rsc-engine-surface", onClick: handleForkClick, onContextMenu: handleForkContextMenu, style: {
                    position: "relative",
                    display: "flex",
                    flex: 1,
                    minHeight: 0,
                }, children: [_jsx(EngineHost, { panes: enginePanes, dataSource: engineDataSource, engineOptions: engineOptions, theme: engineTheme, locale: activeLocale, onEngineReady: handleEngineReady, onVisibleRangeChange: handleForkVisibleRangeChange, onPaneSnapshotsChange: emitPaneSnapshots, onPaneHover: emitHoveredPaneId, style: { flex: 1, minHeight: 0 } }), selectedDrawing && showDrawingPriceMarkers && forkCoordinateBridge ? (_jsx(DrawingPriceLabelsOverlay, { enabled: true, highlighted: true, runtime: "fork", priceFormat: (value) => priceFormat(value), drawing: selectedDrawing, coordinateBridge: forkCoordinateBridge, paneSnapshots: paneSnapshots, height: size.height })) : null, _jsx(MeasurementOverlay, { enabled: measurementEnabled ?? false, isDark: isDark, priceFormat: priceFormat, coordinateBridge: forkCoordinateBridge, paneSnapshots: paneSnapshots, width: size.width, height: size.height })] })) : (_jsxs("div", { style: {
                    position: "relative",
                    display: "flex",
                    flex: 1,
                    minHeight: 0,
                }, children: [_jsxs(DynamicChart, { panes: visiblePanes, heights: paneHeights, data: plotData, width: size.width, height: size.height, margin: CHART_MARGIN, type: "hybrid", seriesName: `vnstock-${activeSymbol}-${activeTimeframe}`, xScale: scaleTime(), xAccessor: safeXAccessor, displayXAccessor: safeXAccessor, xExtents: resolvedXExtents, ratio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, mouseMoveEvent: true, zoomEvent: true, panEvent: true, useCrossHairStyleCursor: true, onClick: onClick, onContextMenu: onContextMenu, onVisibleDomainChange: onVisibleDomainChange, onVisibleRangeChange: handleLegacyVisibleRangeChange, axisStroke: axisStroke, axisTickFill: axisTickFill, isDark: isDark, dateFormat: (date) => dateFormat(date), priceFormat: (value) => priceFormat(value), volumeFormat: (value) => volumeFormat(value), className: className, children: [whaleEvents.length > 0 && (_jsx(WhaleMarketBubbleOverlay, { events: whaleEvents, visibleRange: resolvedLegacyVisibleRange })), enableCVD && cvdData.length > 0 && (_jsx(CVDIndicator, { data: cvdData, visibleRange: resolvedLegacyVisibleRange, mode: cvdMode })), externalCvdSeries && externalCvdSeries.length > 0 && (_jsx(ExternalCVDOverlay, { series: externalCvdSeries })), children] }), selectedDrawing && showDrawingPriceMarkers && legacyCoordinateBridge ? (_jsx(DrawingPriceLabelsOverlay, { enabled: true, highlighted: true, runtime: "legacy", priceFormat: (value) => priceFormat(value), drawing: selectedDrawing, coordinateBridge: legacyCoordinateBridge, paneSnapshots: legacyPaneSnapshots, height: size.height })) : null, legacyCoordinateBridge ? (_jsx(MeasurementOverlay, { enabled: measurementEnabled ?? false, isDark: isDark, priceFormat: priceFormat, coordinateBridge: legacyCoordinateBridge, paneSnapshots: legacyPaneSnapshots, width: size.width, height: size.height })) : null] })), typeof darkFlowStrength === "number" && Number.isFinite(darkFlowStrength) ? (_jsx(DarkFlowBadge, { strength: darkFlowStrength, signalType: darkFlowSignalType })) : null, paneToolbarNodes, paneSplitterNodes] }));
}
export function VNStockChart(props) {
    const requestedRuntime = props.engineRuntime ?? "fork";
    const [fallbackRuntime, setFallbackRuntime] = useState(null);
    useEffect(() => {
        setFallbackRuntime(null);
    }, [requestedRuntime]);
    const effectiveRuntime = fallbackRuntime ?? requestedRuntime;
    const handleBoundaryError = useCallback((caughtError) => {
        props.onError?.(caughtError);
        if (effectiveRuntime === "fork" && fallbackRuntime === null) {
            setFallbackRuntime("legacy");
        }
    }, [effectiveRuntime, fallbackRuntime, props.onError]);
    const handleRuntimeDegraded = useCallback((reason) => {
        if (requestedRuntime === "fork" && fallbackRuntime === null && reason === "fork-no-render-output") {
            setFallbackRuntime("legacy");
        }
    }, [fallbackRuntime, requestedRuntime]);
    return (_jsx(WidgetI18nProvider, { locale: props.locale, messages: props.messages, children: _jsx(WidgetErrorBoundary, { onError: handleBoundaryError, children: _jsx(VNStockChartContent, { ...props, engineRuntime: effectiveRuntime, onRuntimeDegraded: handleRuntimeDegraded }) }, effectiveRuntime) }));
}
