import { getXValue } from "../utils/ChartDataUtil";
import type { ChartConfig } from "../StockChartContext";
import { chartPointToPixel as chartPointToPixelFromScales, type ChartScales, type PlotDatum } from "./coordinateUtils";
import {
	buildRenderScalesFromBridge,
	resolveChartPointWithBridge,
	type DrawingCoordinateBridge,
} from "./coordinateBridge";
import type { DrawingObject, Point } from "./types";

type MorePropsLike = {
	chartConfig?: ChartConfig | ChartConfig[];
	chartConfigList?: ChartConfig | ChartConfig[];
	chartId?: number | string;
	currentCharts?: readonly (number | string)[];
	currentItem?: unknown;
	mouseXY?: readonly [number, number];
	plotData?: readonly unknown[];
	xAccessor?: (datum: any) => Date | number | undefined;
	xScale?: {
		(value: Date): number;
		invert?: (value: number) => Date;
	};
};

export function getChartConfigList(moreProps: MorePropsLike): ChartConfig[] {
	const chartConfigList = moreProps.chartConfigList ?? moreProps.chartConfig;
	if (Array.isArray(chartConfigList)) {
		return chartConfigList;
	}
	return chartConfigList ? [chartConfigList] : [];
}

export function resolveBaseChartConfig(moreProps: MorePropsLike): ChartConfig | undefined {
	const chartConfigList = getChartConfigList(moreProps);
	if (chartConfigList.length === 0) {
		return undefined;
	}

	return chartConfigList.find((each) => each.id === moreProps.chartId) ?? chartConfigList[0];
}

export function resolveActiveChartConfig(moreProps: MorePropsLike): ChartConfig | undefined {
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

export function resolveDrawingChartConfig(
	moreProps: MorePropsLike,
	drawing?: DrawingObject,
	preferCurrentCharts = false,
): ChartConfig | undefined {
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

export function getAdjustedMousePosition(
	moreProps: MorePropsLike,
	targetChartConfig: ChartConfig,
	mousePosition: readonly [number, number] = moreProps.mouseXY ?? [NaN, NaN],
): readonly [number, number] | undefined {
	const baseChartConfig = resolveBaseChartConfig(moreProps);
	if (!baseChartConfig || !Array.isArray(mousePosition)) {
		return undefined;
	}

	const [mouseX, mouseY] = mousePosition;
	const [baseOriginX, baseOriginY] = baseChartConfig.origin;
	const [targetOriginX, targetOriginY] = targetChartConfig.origin;
	return [mouseX + baseOriginX - targetOriginX, mouseY + baseOriginY - targetOriginY];
}

function resolveChartPointDirect(
	moreProps: MorePropsLike,
	mousePosition: readonly [number, number] = moreProps.mouseXY ?? [NaN, NaN],
	chartConfig = resolveActiveChartConfig(moreProps),
): Point | undefined {
	const targetChartConfig = chartConfig;
	const { currentItem, xAccessor, plotData, xScale } = moreProps;
	if (
		!targetChartConfig
		|| typeof targetChartConfig.yScale?.invert !== "function"
		|| typeof xScale !== "function"
		|| typeof xAccessor !== "function"
	) {
		return undefined;
	}

	const adjustedMousePosition = getAdjustedMousePosition(moreProps, targetChartConfig, mousePosition);
	if (!adjustedMousePosition) {
		return undefined;
	}

	const xValue = currentItem
		? xAccessor(currentItem)
		: getXValue(xScale, xAccessor, adjustedMousePosition, Array.isArray(plotData) ? [...plotData] : []);
	const dateValue = xValue instanceof Date ? xValue : new Date(xValue ?? Number.NaN);
	const yValue = targetChartConfig.yScale.invert(adjustedMousePosition[1]);

	if (!Number.isFinite(dateValue.getTime()) || !Number.isFinite(yValue)) {
		return undefined;
	}

	return { x: dateValue.getTime(), y: yValue };
}

export function resolveChartPaneId(chartConfig: ChartConfig) {
	return chartConfig.paneId ?? String(chartConfig.id);
}

export function resolveChartScaleDomain(chartConfig: ChartConfig): readonly [number, number] | undefined {
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

	return [Number(start), Number(end)] as const;
}

export function resolveBridgePixelOffset(moreProps: MorePropsLike, chartConfig: ChartConfig) {
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

export function createDrawingCoordinateBridgeFromMoreProps(
	moreProps: MorePropsLike,
	chartConfig = resolveActiveChartConfig(moreProps),
): DrawingCoordinateBridge | undefined {
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

			const renderScales = {
				xScale: moreProps.xScale,
				xScaleInvert: moreProps.xScale.invert,
				yScale: targetChartConfig.yScale,
				yScaleInvert: targetChartConfig.yScale.invert,
				xAccessor: moreProps.xAccessor as ChartScales["xAccessor"],
				plotData: moreProps.plotData as ChartScales["plotData"],
			};

			const pixel = chartPointToPixelFromScales(point, renderScales);
			const offset = resolveBridgePixelOffset(moreProps, targetChartConfig);
			return {
				x: pixel.x + offset.x,
				y: pixel.y + offset.y,
			};
		},
	};
}

export function buildRenderScalesFromMoreProps(
	moreProps: MorePropsLike,
	chartConfig = resolveBaseChartConfig(moreProps),
): ChartScales | undefined {
	if (!chartConfig) {
		return undefined;
	}

	const bridge = createDrawingCoordinateBridgeFromMoreProps(moreProps, chartConfig);
	const plotData = (Array.isArray(moreProps.plotData) ? moreProps.plotData : []) as PlotDatum[];
	return bridge
		? buildRenderScalesFromBridge(bridge, {
			paneId: resolveChartPaneId(chartConfig),
			scaleSlotId: chartConfig.yScaleId,
			plotData,
			xAccessor: moreProps.xAccessor as ((datum: PlotDatum) => Date | number | undefined) | undefined,
			yDomain: resolveChartScaleDomain(chartConfig),
			pixelOffset: resolveBridgePixelOffset(moreProps, chartConfig),
		})
		: undefined;
}

export function resolveChartPointFromMoreProps(
	moreProps: MorePropsLike,
	mousePosition: readonly [number, number] = moreProps.mouseXY ?? [NaN, NaN],
	chartConfig = resolveActiveChartConfig(moreProps),
): Point | undefined {
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