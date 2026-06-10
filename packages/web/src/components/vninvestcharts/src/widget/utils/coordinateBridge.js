import { scaleLinear } from "d3-scale";
import { createDateTimeIndexMap, createPaneProjector, resolvePanePixelAtDataIndex, resolvePanePixelAtValue, } from "@vninvestcharts/vn-kline-engine-core";
import { resolvePointAnchor } from "../../lib/drawing/shared.js";
import { CHART_MARGIN, resolvePreferredScaleSlotId, resolveForkChartConfigScaleSlotId, findPlotDataIndexByTime, } from "./widgetHelpers.js";
import { normalizeVisibleRangeForEngine, normalizeEngineVisibleRange, findNearestDateIndex, } from "../visibleRangeBridge.js";
export function createWidgetCoordinateBridge({ paneSnapshots, visibleRange, plotData, engineRuntime = "fork", }) {
    const normalizedVisibleRange = normalizeVisibleRangeForEngine(visibleRange, plotData.length);
    if (!normalizedVisibleRange || plotData.length === 0 || paneSnapshots.length === 0) {
        return null;
    }
    const paneSnapshotMap = new Map(paneSnapshots.map((snapshot) => [snapshot.paneId, snapshot]));
    const timeIndexMap = createDateTimeIndexMap(plotData);
    const projectorCache = new Map();
    const useCenteredIndexProjection = engineRuntime === "fork";
    const resolvePaneProjector = (snapshot, resolvedScaleSlotId) => {
        const cacheKey = `${snapshot.paneId}::${resolvedScaleSlotId}`;
        const cached = projectorCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const projector = createPaneProjector(snapshot, normalizedVisibleRange, resolvedScaleSlotId);
        projectorCache.set(cacheKey, projector);
        return projector;
    };
    const resolveWidgetChartPoint = (snapshot, resolvedScaleSlotId, x, y) => {
        const projector = resolvePaneProjector(snapshot, resolvedScaleSlotId);
        const fractionalIndex = (() => {
            const projected = projector.pixelXToIndex(x);
            if (projected !== null) {
                return useCenteredIndexProjection ? projected - 0.5 : projected;
            }
            if (snapshot.plotBounds.width <= 0) {
                return null;
            }
            const from = Math.min(normalizedVisibleRange.from, normalizedVisibleRange.to);
            const to = Math.max(normalizedVisibleRange.from, normalizedVisibleRange.to);
            const span = Math.max(1e-6, to - from);
            const ratio = (x - snapshot.plotBounds.left) / snapshot.plotBounds.width;
            const index = from + ratio * span;
            return useCenteredIndexProjection ? index - 0.5 : index;
        })();
        if (fractionalIndex === null) {
            return undefined;
        }
        const timestamp = timeIndexMap.resolveTimeByIndex(fractionalIndex);
        const value = (() => {
            const projected = projector.pixelYToValue(y);
            if (projected !== null) {
                return projected;
            }
            const domain = snapshot.scaleSlotStates[resolvedScaleSlotId]?.domain;
            const hasFiniteDomain = Array.isArray(domain)
                && domain.length >= 2
                && Number.isFinite(domain[0])
                && Number.isFinite(domain[1])
                && domain[0] !== domain[1]
                && snapshot.plotBounds.height > 0;
            if (!hasFiniteDomain) {
                return null;
            }
            const ratio = (snapshot.plotBounds.top + snapshot.plotBounds.height - y) / snapshot.plotBounds.height;
            return domain[0] + ratio * (domain[1] - domain[0]);
        })();
        if (timestamp === null || !Number.isFinite(timestamp) || value === null) {
            return undefined;
        }
        return {
            x: timestamp,
            y: value,
            xIndexFloat: fractionalIndex,
            timeMsHint: timestamp,
            yPrice: value,
        };
    };
    const resolveWidgetPointPixel = (snapshot, resolvedScaleSlotId, point) => {
        const anchor = resolvePointAnchor(point);
        const projector = resolvePaneProjector(snapshot, resolvedScaleSlotId);
        const fractionalDataIndex = typeof anchor.xIndexFloat === "number" && Number.isFinite(anchor.xIndexFloat)
            ? anchor.xIndexFloat
            : timeIndexMap.resolveIndexByTime(anchor.timeMsHint);
        const x = fractionalDataIndex === null
            ? null
            : (() => {
                const targetIndex = useCenteredIndexProjection ? fractionalDataIndex + 0.5 : fractionalDataIndex;
                const projected = projector.indexToPixelX(targetIndex);
                if (projected !== null) {
                    return projected;
                }
                const from = Math.min(normalizedVisibleRange.from, normalizedVisibleRange.to);
                const to = Math.max(normalizedVisibleRange.from, normalizedVisibleRange.to);
                const span = Math.max(1e-6, to - from);
                const ratio = (targetIndex - from) / span;
                return snapshot.plotBounds.left + ratio * snapshot.plotBounds.width;
            })();
        const y = projector.valueToPixelY(anchor.yPrice);
        if (x === null || y === null) {
            return undefined;
        }
        return {
            x,
            y,
        };
    };
    return {
        engineRuntime,
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
            });
        },
    };
}
export function createForkChartRenderContextValue({ paneSnapshots, visibleRange, plotData, width, height, }) {
    const normalizedVisibleRange = normalizeEngineVisibleRange(visibleRange, plotData.length);
    if (!normalizedVisibleRange || paneSnapshots.length === 0 || plotData.length === 0) {
        return null;
    }
    const primaryPaneSnapshot = paneSnapshots[0];
    const primaryScaleSlotId = resolvePreferredScaleSlotId(primaryPaneSnapshot);
    const startDatum = plotData[normalizedVisibleRange.from];
    const endDatum = plotData[normalizedVisibleRange.to - 1];
    if (!primaryScaleSlotId || !startDatum?.date || !endDatum?.date) {
        return null;
    }
    const visibleBarCount = Math.max(1, normalizedVisibleRange.to - normalizedVisibleRange.from);
    const candleWidth = Math.max(1, primaryPaneSnapshot.plotBounds.width / visibleBarCount);
    const timeIndexMap = createDateTimeIndexMap(plotData);
    return {
        xScale: (value) => {
            const ts = value.getTime();
            const resolvedIndex = timeIndexMap.resolveIndexByTime(ts);
            const dataIndex = resolvedIndex !== null ? resolvedIndex : findNearestDateIndex(plotData, ts);
            const x = resolvePanePixelAtDataIndex(primaryPaneSnapshot, normalizedVisibleRange, dataIndex + 0.5, plotData.length);
            return x ?? Number.NaN;
        },
        xScaleByIndex: (index) => {
            const x = resolvePanePixelAtDataIndex(primaryPaneSnapshot, normalizedVisibleRange, index + 0.5, plotData.length);
            return x ?? Number.NaN;
        },
        yScale: (value) => {
            const y = resolvePanePixelAtValue(primaryPaneSnapshot, primaryScaleSlotId, value);
            return y ?? Number.NaN;
        },
        plotData: plotData,
        candleWidth,
        devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        visibleRange: {
            startIndex: normalizedVisibleRange.from,
            endIndex: normalizedVisibleRange.to - 1,
            startDate: startDatum.date,
            endDate: endDatum.date,
            barCount: visibleBarCount,
        },
        width,
        height,
    };
}
export function createForkStockChartContextValue({ paneSnapshots, plotData, chartRenderContextValue, width, height, generateSubscriptionId, }) {
    const chartConfig = paneSnapshots.map((snapshot, index) => {
        const scaleSlotId = resolveForkChartConfigScaleSlotId(snapshot);
        const scaleSlotDomain = scaleSlotId ? snapshot.scaleSlotStates[scaleSlotId]?.domain : undefined;
        const yScale = scaleLinear();
        if (Array.isArray(scaleSlotDomain) && scaleSlotDomain.length >= 2 && Number.isFinite(scaleSlotDomain[0]) && Number.isFinite(scaleSlotDomain[1]) && scaleSlotDomain[0] !== scaleSlotDomain[1]) {
            yScale.domain([scaleSlotDomain[0], scaleSlotDomain[1]]).range([snapshot.plotBounds.height, 0]);
        }
        else {
            yScale.domain([0, 1]).range([snapshot.plotBounds.height, 0]);
        }
        return {
            id: index,
            paneId: snapshot.paneId,
            yScaleId: scaleSlotId ?? undefined,
            origin: [snapshot.plotBounds.left, snapshot.plotBounds.top],
            padding: 0,
            yScale,
            yExtents: [],
            width: snapshot.plotBounds.width,
            height: snapshot.plotBounds.height,
        };
    });
    return {
        plotData: plotData,
        fullData: plotData,
        chartConfig,
        xScale: chartRenderContextValue?.xScale ?? (() => Number.NaN),
        xAccessor: (datum) => datum?.date ?? new Date(0),
        displayXAccessor: (datum) => datum?.date ?? new Date(0),
        width,
        height,
        chartCanvasType: "svg",
        margin: CHART_MARGIN,
        ratio: typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
        subscribe: () => undefined,
        unsubscribe: () => undefined,
        generateSubscriptionId,
        getMutableState: () => ({}),
        setCursorClass: () => undefined,
        redraw: () => undefined,
        amIOnTop: () => true,
    };
}
