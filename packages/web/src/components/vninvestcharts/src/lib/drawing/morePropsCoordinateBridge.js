import { getXValue } from "../utils/ChartDataUtil.js";
import { chartPointToPixel as chartPointToPixelFromScales } from "./coordinateUtils.js";
import { buildRenderScalesFromBridge, resolveChartPointWithBridge, } from "./coordinateBridge.js";
export function getChartConfigList(moreProps) {
    const chartConfigList = moreProps.chartConfigList ?? moreProps.chartConfig;
    if (Array.isArray(chartConfigList)) {
        return chartConfigList;
    }
    return chartConfigList ? [chartConfigList] : [];
}
export function resolveBaseChartConfig(moreProps) {
    const chartConfigList = getChartConfigList(moreProps);
    if (chartConfigList.length === 0) {
        return undefined;
    }
    return chartConfigList.find((each) => each.id === moreProps.chartId) ?? chartConfigList[0];
}
export function resolveActiveChartConfig(moreProps) {
    const chartConfigList = getChartConfigList(moreProps);
    if (chartConfigList.length === 0) {
        return undefined;
    }
    const currentCharts = Array.isArray(moreProps.currentCharts) ? moreProps.currentCharts : [];
    for (const chartId of currentCharts) {
        const match = chartConfigList.find((each) => each.id === chartId);
        if (match) {
            return match;
        }
    }
    return resolveBaseChartConfig(moreProps);
}
export function resolveDrawingChartConfig(moreProps, drawing, preferCurrentCharts = false) {
    const chartConfigList = getChartConfigList(moreProps);
    if (chartConfigList.length === 0) {
        return undefined;
    }
    if (drawing?.paneId) {
        const paneChartConfigs = chartConfigList.filter((each) => each.paneId === drawing.paneId);
        if (drawing.yScaleId) {
            const exactMatch = paneChartConfigs.find((each) => each.yScaleId === drawing.yScaleId);
            if (exactMatch) {
                return exactMatch;
            }
        }
        if (preferCurrentCharts) {
            const currentCharts = Array.isArray(moreProps.currentCharts) ? moreProps.currentCharts : [];
            const currentMatch = paneChartConfigs.find((each) => currentCharts.includes(each.id));
            if (currentMatch) {
                return currentMatch;
            }
        }
        if (paneChartConfigs.length > 0) {
            return paneChartConfigs[0];
        }
    }
    return resolveActiveChartConfig(moreProps);
}
export function getAdjustedMousePosition(moreProps, targetChartConfig, mousePosition = moreProps.mouseXY ?? [NaN, NaN]) {
    const baseChartConfig = resolveBaseChartConfig(moreProps);
    if (!baseChartConfig || !Array.isArray(mousePosition)) {
        return undefined;
    }
    const [mouseX, mouseY] = mousePosition;
    const [baseOriginX, baseOriginY] = baseChartConfig.origin;
    const [targetOriginX, targetOriginY] = targetChartConfig.origin;
    return [mouseX + baseOriginX - targetOriginX, mouseY + baseOriginY - targetOriginY];
}
function resolveChartPointDirect(moreProps, mousePosition = moreProps.mouseXY ?? [NaN, NaN], chartConfig = resolveActiveChartConfig(moreProps)) {
    const targetChartConfig = chartConfig;
    const { currentItem, xAccessor, plotData, xScale } = moreProps;
    if (!targetChartConfig
        || typeof targetChartConfig.yScale?.invert !== "function"
        || typeof xScale !== "function"
        || typeof xAccessor !== "function") {
        return undefined;
    }
    const adjustedMousePosition = getAdjustedMousePosition(moreProps, targetChartConfig, mousePosition);
    if (!adjustedMousePosition) {
        return undefined;
    }
    const xValue = currentItem
        ? xAccessor(currentItem)
        : getXValue(xScale, xAccessor, adjustedMousePosition, Array.isArray(plotData) ? [...plotData] : []);
    // DT-22 Fix 3A: for discontinuous scales xAccessor returns a bar-index (integer), not a
    // real timestamp.  Always prefer currentItem.date (the real candle Date) so that stored
    // drawing coordinates survive bar-index shifts caused by historical-data prepend.
    const rawDate = currentItem != null && currentItem.date instanceof Date
        ? currentItem.date
        : undefined;
    const dateValue = rawDate ?? (xValue instanceof Date ? xValue : new Date(xValue ?? Number.NaN));
    const yValue = targetChartConfig.yScale.invert(adjustedMousePosition[1]);
    if (!Number.isFinite(dateValue.getTime()) || !Number.isFinite(yValue)) {
        return undefined;
    }
    return { x: dateValue.getTime(), y: yValue };
}
export function resolveChartPaneId(chartConfig) {
    return chartConfig.paneId ?? String(chartConfig.id);
}
export function resolveChartScaleDomain(chartConfig) {
    const domain = typeof chartConfig.yScale?.domain === "function"
        ? chartConfig.yScale.domain()
        : undefined;
    if (!Array.isArray(domain) || domain.length < 2) {
        return undefined;
    }
    const [start, end] = domain;
    if (!Number.isFinite(Number(start)) || !Number.isFinite(Number(end))) {
        return undefined;
    }
    return [Number(start), Number(end)];
}
export function resolveBridgePixelOffset(moreProps, chartConfig) {
    const baseChartConfig = resolveBaseChartConfig(moreProps);
    if (!baseChartConfig) {
        return { x: 0, y: 0 };
    }
    const [baseOriginX, baseOriginY] = baseChartConfig.origin;
    const [targetOriginX, targetOriginY] = chartConfig.origin;
    return {
        x: targetOriginX - baseOriginX,
        y: targetOriginY - baseOriginY,
    };
}
export function createDrawingCoordinateBridgeFromMoreProps(moreProps, chartConfig = resolveActiveChartConfig(moreProps)) {
    const targetChartConfig = chartConfig;
    if (!targetChartConfig) {
        return undefined;
    }
    return {
        resolveChartPoint: ({ x, y }) => resolveChartPointDirect(moreProps, [x, y], targetChartConfig),
        chartPointToPixel: ({ point }) => {
            if (typeof moreProps.xScale !== "function" || typeof moreProps.xScale.invert !== "function" || typeof targetChartConfig.yScale !== "function" || typeof targetChartConfig.yScale.invert !== "function") {
                return undefined;
            }
            // DT-22 Fix 3B: stored point.x is a real unix timestamp (after Fix 3A) but
            // financeDiscontinuousScale expects the *current* bar-index.  Translate via
            // plotData lookup so drawings stay pinned to the correct candle even when
            // historical data is prepended and all bar-indices shift.
            let effectivePoint = point;
            const xAcc = moreProps.xAccessor;
            const pData = Array.isArray(moreProps.fullData) && moreProps.fullData.length > 0
                ? moreProps.fullData
                : moreProps.plotData;
            if (typeof xAcc === "function" && Array.isArray(pData) && pData.length > 0) {
                const sampleX = xAcc(pData[0]);
                if (typeof sampleX === "number") {
                    // Discontinuous scale: search for the datum whose real date matches
                    const datum = pData.find((d) => d.date instanceof Date && d.date.getTime() === point.x);
                    if (datum) {
                        const barIndex = xAcc(datum);
                        effectivePoint = {
                            ...point,
                            x: barIndex,
                            // coordinateUtils resolves x via timeMsHint when xIndexFloat is absent.
                            // Keep the same unit as x (bar index) once discontinuous lookup succeeds.
                            timeMsHint: barIndex,
                        };
                    }
                }
            }
            const renderScales = {
                xScale: moreProps.xScale,
                xScaleInvert: moreProps.xScale.invert,
                yScale: targetChartConfig.yScale,
                yScaleInvert: targetChartConfig.yScale.invert,
                xAccessor: moreProps.xAccessor,
                plotData: moreProps.plotData,
            };
            const pixel = chartPointToPixelFromScales(effectivePoint, renderScales);
            const offset = resolveBridgePixelOffset(moreProps, targetChartConfig);
            return {
                x: pixel.x + offset.x,
                y: pixel.y + offset.y,
            };
        },
    };
}
export function buildRenderScalesFromMoreProps(moreProps, chartConfig = resolveBaseChartConfig(moreProps)) {
    if (!chartConfig) {
        return undefined;
    }
    const bridge = createDrawingCoordinateBridgeFromMoreProps(moreProps, chartConfig);
    const plotData = (Array.isArray(moreProps.plotData) ? moreProps.plotData : []);
    return bridge
        ? buildRenderScalesFromBridge(bridge, {
            paneId: resolveChartPaneId(chartConfig),
            scaleSlotId: chartConfig.yScaleId,
            plotData,
            xAccessor: moreProps.xAccessor,
            yDomain: resolveChartScaleDomain(chartConfig),
            pixelOffset: resolveBridgePixelOffset(moreProps, chartConfig),
        })
        : undefined;
}
export function resolveChartPointFromMoreProps(moreProps, mousePosition = moreProps.mouseXY ?? [NaN, NaN], chartConfig = resolveActiveChartConfig(moreProps)) {
    if (!chartConfig) {
        return undefined;
    }
    const bridge = createDrawingCoordinateBridgeFromMoreProps(moreProps, chartConfig);
    return bridge
        ? resolveChartPointWithBridge(bridge, {
            paneId: resolveChartPaneId(chartConfig),
            scaleSlotId: chartConfig.yScaleId,
            x: mousePosition[0],
            y: mousePosition[1],
        })
        : resolveChartPointDirect(moreProps, mousePosition, chartConfig);
}
