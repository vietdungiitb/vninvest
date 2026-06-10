import { format } from "d3-format";
import { utcFormat } from "d3-time-format";
import { DEFAULT_PANES, } from "../../lib/core/index.js";
import { getSeries } from "../../lib/core/registry/SeriesRegistry.js";
import { resolveSeriesStructuredValue, resolveSeriesValue } from "../../lib/core/seriesValueResolver.js";
import { asTimeValue, clampIndex, findNearestDateIndex } from "../visibleRangeBridge.js";
export const priceFormat = format(",.2f");
export const volumeFormat = format(".3s");
export const dateFormat = utcFormat("%d/%m/%Y %H:%M");
export const intradayAxisFormat = utcFormat("%H:%M");
export const mixedAxisFormat = utcFormat("%d/%m %H:%M");
export const dailyAxisFormat = utcFormat("%d/%m");
export const CHART_MARGIN = { left: 60, right: 68, top: 8, bottom: 28 };
export const HISTORY_BACKFILL_PAGE_LIMIT = 1000;
export const HISTORY_RECONCILE_MAX_PAGES = 12;
export const HISTORY_MIN_RESIDENT_BARS = 240;
export const FORK_DEGRADE_PIXEL_CHECK_DELAY_MS = 900;
export const FORK_DEGRADE_PIXEL_RECHECK_DELAY_MS = 350;
export const FORK_DEGRADE_REQUIRED_BLANK_CHECKS = 2;
export function isWidgetTestEnvironment() {
    const globalScope = globalThis;
    return typeof globalScope.vi !== "undefined"
        || typeof globalScope.describe !== "undefined"
        || globalScope.process?.env?.NODE_ENV === "test";
}
export function isPrimaryPriceSeries(type) {
    return type === "Candlestick"
        || type === "HollowCandle"
        || type === "OHLC"
        || type === "HeikinAshi"
        || type === "Line"
        || type === "Area"
        || type === "Bar";
}
export function resolveTooltipSeriesColor(series, fallback) {
    if (typeof series.color === "string" && series.color.length > 0) {
        return series.color;
    }
    const paramColor = series.params?.["color"];
    return typeof paramColor === "string" && paramColor.length > 0 ? paramColor : fallback;
}
export function formatTooltipValue(value, formatter) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return "n/a";
    }
    return formatter ? formatter(value) : priceFormat(value);
}
export function formatForkXAxisLabel(date, timeframe, visibleBarCount) {
    switch (timeframe) {
        case "1m":
        case "3m":
        case "5m":
        case "15m":
        case "30m":
        case "1h":
        case "2h":
        case "4h":
            return visibleBarCount <= 48 ? intradayAxisFormat(date) : mixedAxisFormat(date);
        default:
            return dailyAxisFormat(date);
    }
}
export function buildForkTooltipTokens(pane, datum, textColor) {
    const tokens = [];
    if (pane.tooltip === "ohlc") {
        tokens.push({ key: `${pane.id}-open`, label: "O", value: priceFormat(datum.open), color: textColor }, { key: `${pane.id}-high`, label: "H", value: priceFormat(datum.high), color: textColor }, { key: `${pane.id}-low`, label: "L", value: priceFormat(datum.low), color: textColor }, { key: `${pane.id}-close`, label: "C", value: priceFormat(datum.close), color: textColor }, { key: `${pane.id}-volume`, label: "Vol", value: volumeFormat(datum.volume), color: textColor });
    }
    for (let seriesIndex = 0; seriesIndex < pane.series.length; seriesIndex += 1) {
        const series = pane.series[seriesIndex];
        if (series.visible === false) {
            continue;
        }
        if (pane.tooltip === "ohlc" && isPrimaryPriceSeries(series.type)) {
            continue;
        }
        const tooltipEntry = getSeries(series.type).tooltipEntry(series);
        tokens.push({
            key: `${pane.id}-${series.id ?? `${series.type}-${seriesIndex}`}`,
            label: tooltipEntry.label,
            value: formatTooltipValue(resolveSeriesValue(datum, series), tooltipEntry.format),
            color: resolveTooltipSeriesColor(series, tooltipEntry.color ?? textColor),
        });
    }
    return tokens;
}
export function resolveDiscontinuousXExtents(extents, data, xAccessor) {
    if (data.length === 0) {
        return undefined;
    }
    const lastIndex = data.length - 1;
    const defaultStart = xAccessor(data[0]);
    const defaultEnd = xAccessor(data[lastIndex]);
    if (!extents) {
        return [defaultStart, defaultEnd];
    }
    const startIndex = findNearestDateIndex(data, asTimeValue(extents[0]));
    const endIndex = findNearestDateIndex(data, asTimeValue(extents[1]));
    return [xAccessor(data[startIndex]), xAccessor(data[endIndex])];
}
export function resolveDateDomainFromDiscontinuous(domain, data, xAccessor) {
    if (data.length === 0) {
        const epoch = new Date(0);
        return [epoch, epoch];
    }
    const firstIndexValue = xAccessor(data[0]);
    const lastDataIndex = data.length - 1;
    const resolveDate = (value, fallbackIndex) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            return data[fallbackIndex].date;
        }
        const dataIndex = clampIndex(Math.round(value - firstIndexValue), data.length);
        return data[dataIndex]?.date ?? data[fallbackIndex].date;
    };
    return [resolveDate(domain[0], 0), resolveDate(domain[1], lastDataIndex)];
}
export function resolveEngineSeriesValueForRuntime(datum, series) {
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
        default:
            return resolveSeriesValue(datum, series);
    }
}
export function buildLegacyPaneSnapshots(panes, heights, canvasSize, scaleSlotDomains) {
    const plotWidth = Math.max(0, canvasSize.width - CHART_MARGIN.left - CHART_MARGIN.right);
    let top = CHART_MARGIN.top;
    return panes.map((pane, index) => {
        const height = heights[index] ?? 0;
        const hasLeftAxis = pane.series.some((series) => series.visible !== false && series.yAxis === "left");
        const hasRightAxis = pane.series.some((series) => series.visible !== false && (series.yAxis === "right" || series.yAxis == null));
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
        const normalizedSeries = pane.series.map((series) => ({
            ...series,
            params: series.params ? { ...series.params } : undefined,
            scaleSlotId: `${pane.id}-${series.yAxis}`,
            lineWidth: typeof series.lineWidth === "number" && Number.isFinite(series.lineWidth) ? series.lineWidth : undefined,
            subColors: series.subColors ? { ...series.subColors } : undefined,
        }));
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
export const FALLBACK_ADAPTER = {
    fetchBarsInRange: () => Promise.resolve([]),
    fetchBarsBefore: () => Promise.resolve([]),
    subscribeToBar: () => () => { },
    subscribeToTrades: () => () => { },
    subscribeToOrderbook: () => () => { },
    searchSymbols: () => Promise.resolve([]),
    getSourceSemantics: () => ({
        sourceId: "fallback",
        sourceContractVersion: "1.0.0",
        instrumentClass: "custom",
        coverageMode: "finite-snapshot",
        sessionModel: "continuous",
        timezone: "UTC",
        supportsExactRangeFetch: false,
        supportsBackwardAnchor: false,
        supportsForwardAnchor: false,
        supportsLiveBars: false,
        finalityMode: "immutable",
        expectedGapReasons: [],
    }),
};
export const NORMALIZED_DEFAULT_PANES = normalizePaneDescriptorsForExplicitScaleSlots(DEFAULT_PANES);
export function resolveVisiblePanes(panes) {
    const candidatePanes = panes?.length ? normalizePaneDescriptorsForExplicitScaleSlots(panes) : NORMALIZED_DEFAULT_PANES;
    const nextPanes = candidatePanes.filter((pane) => pane.visible);
    return nextPanes.length > 0 ? nextPanes : NORMALIZED_DEFAULT_PANES.filter((pane) => pane.visible);
}
export function inferAxisSideFromScaleSlotId(scaleSlotId) {
    if (scaleSlotId.endsWith("-left")) {
        return "left";
    }
    if (scaleSlotId.endsWith("-right")) {
        return "right";
    }
    return "right";
}
export function mergePaneSnapshotDomains(snapshots, scaleSlotDomains, options) {
    const preferSnapshotPriceDomains = options?.preferSnapshotPriceDomains ?? false;
    return snapshots.map((snapshot) => {
        const scaleSlotIds = new Set([
            ...Object.keys(snapshot.scaleSlotBounds),
            ...Object.keys(snapshot.scaleSlotStates ?? {}),
        ]);
        const scaleSlotStates = Object.fromEntries([...scaleSlotIds].map((scaleSlotId) => {
            const currentState = snapshot.scaleSlotStates[scaleSlotId];
            const shouldPreferComputedDomain = scaleSlotId.startsWith("price-") && !preferSnapshotPriceDomains;
            return [scaleSlotId, {
                    side: currentState?.side ?? inferAxisSideFromScaleSlotId(scaleSlotId),
                    mode: currentState?.mode ?? "auto",
                    visible: currentState?.visible ?? true,
                    domain: shouldPreferComputedDomain
                        ? (scaleSlotDomains[scaleSlotId] ?? currentState?.domain)
                        : (currentState?.domain ?? scaleSlotDomains[scaleSlotId]),
                }];
        }));
        return {
            ...snapshot,
            scaleSlotStates,
        };
    });
}
export function resolvePreferredScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]?.visible) {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = Object.entries(snapshot.scaleSlotStates)
        .filter(([, state]) => state.visible)
        .map(([scaleSlotId]) => scaleSlotId);
    if (visibleScaleSlotIds.length === 0) {
        return requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]
            ? requestedScaleSlotId
            : undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId] ? requestedScaleSlotId : undefined)
        ?? visibleScaleSlotIds[0];
}
export function findPlotDataIndex(point, data) {
    if (point.index >= 0 && point.index < data.length) {
        return point.index;
    }
    return data.findIndex((datum) => datum.date.getTime() === point.date.getTime());
}
export function findPlotDataIndexByTime(timestamp, data) {
    if (data.length === 0) {
        return -1;
    }
    return findNearestDateIndex(data, timestamp);
}
export function resolveForkChartConfigScaleSlotId(snapshot) {
    const visibleRightScaleSlotId = Object.entries(snapshot.scaleSlotStates).find(([, state]) => state.visible && state.side === "right")?.[0];
    if (visibleRightScaleSlotId) {
        return visibleRightScaleSlotId;
    }
    const visibleScaleSlotId = Object.entries(snapshot.scaleSlotStates).find(([, state]) => state.visible)?.[0];
    if (visibleScaleSlotId) {
        return visibleScaleSlotId;
    }
    return Object.keys(snapshot.scaleSlotStates)[0] ?? null;
}
export { areBoundsEqual, areHeaderAnchorEqual, areLabelAnchorEqual, areAxisBoundsEqual, areBoundsMapEqual, areDomainTupleEqual, areScaleSlotStatesEqual, arePaneSnapshotsEqual, areRuntimeCapabilitiesEqual, } from "./widgetEquality.js";
