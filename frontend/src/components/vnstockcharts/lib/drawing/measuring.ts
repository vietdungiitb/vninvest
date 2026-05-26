import { getCurrentItem, getXValue } from "../utils/ChartDataUtil";
import {
	measurementPointToPixelFromScales,
	resolveMeasurementPointFromValues,
	summarizeMeasurement as summarizeMeasurementCore,
	type MeasurementPoint,
	type MeasurementSelection,
	type MeasurementSummary,
} from "@vnstockcharts/vn-kline-engine-core";

type ChartConfigLike = {
	id?: number | string;
	yScale?: {
		invert?: (value: number) => number;
		(value: number): number;
	};
};

export type { MeasurementPoint, MeasurementSelection, MeasurementSummary };

function resolveChartConfig(moreProps: any): ChartConfigLike | undefined {
	const chartConfigList = moreProps.chartConfig;
	if (Array.isArray(chartConfigList)) {
		return chartConfigList.find((each: ChartConfigLike) => each.id === moreProps.chartId) || chartConfigList[0];
	}
	return chartConfigList;
}

export function resolveMeasurementPoint(moreProps: any, mousePosition: readonly [number, number] = moreProps.mouseXY): MeasurementPoint | undefined {
	const chartConfig = resolveChartConfig(moreProps);
	const { xScale, xAccessor, plotData } = moreProps;

	if (!chartConfig || typeof chartConfig.yScale?.invert !== "function") {
		return undefined;
	}

	if (!Array.isArray(mousePosition) || mousePosition.length < 2) {
		return undefined;
	}

	if (!Array.isArray(plotData) || plotData.length === 0 || typeof xAccessor !== "function") {
		return undefined;
	}

	const currentItem = getCurrentItem(xScale, xAccessor, mousePosition, plotData);
	const xValue = currentItem ? xAccessor(currentItem) : getXValue(xScale, xAccessor, mousePosition, plotData);
	const dateValue = xValue instanceof Date ? xValue : new Date(xValue);
	const priceValue = chartConfig.yScale.invert(mousePosition[1]);
	return resolveMeasurementPointFromValues({
		plotData,
		xAccessor,
		dateValue,
		priceValue,
	});
}

export function measurementPointToPixel(point: MeasurementPoint, moreProps: any): { x: number; y: number } | undefined {
	const chartConfig = resolveChartConfig(moreProps);
	if (!chartConfig) {
		return undefined;
	}

	const { xScale } = moreProps;
	if (typeof xScale !== "function" || typeof chartConfig.yScale !== "function") {
		return undefined;
	}

	return measurementPointToPixelFromScales({
		point,
		xScale,
		yScale: chartConfig.yScale,
	});
}

export function summarizeMeasurement(selection: MeasurementSelection): MeasurementSummary {
	return summarizeMeasurementCore(selection);
}

// ─── DT-6: Live Measurement Overlay ──────────────────────────────────────────

export interface LiveMeasurement {
	/** Absolute price delta (point 1 price − point 0 price) */
	priceDelta: number;
	/** Percentage change relative to start price (0..1 scale, e.g. 0.05 = +5%) */
	pricePct: number;
	/** Horizontal distance in calendar time as milliseconds */
	timeDeltaMs: number;
	/** Number of integer x-index bars between the two points (may be fractional for intraday) */
	barCount: number;
	/** Pixel position of point 0 after projection */
	px0: { x: number; y: number };
	/** Pixel position of point 1 after projection */
	px1: { x: number; y: number };
}

import type { ChartScales } from "./coordinateUtils";
import type { Point } from "./types";

/**
 * Compute a live measurement summary between two drawing points using chart scales.
 *
 * Returns null when either point is missing or scales are not yet available.
 */
export function computeLiveMeasurement(
	p0: Point,
	p1: Point,
	scales: ChartScales,
): LiveMeasurement | null {
	if (!scales || typeof scales.xScale !== "function" || typeof scales.yScale !== "function") {
		return null;
	}

	const px0 = { x: scales.xScale(new Date(p0.x)), y: scales.yScale(p0.y) };
	const px1 = { x: scales.xScale(new Date(p1.x)), y: scales.yScale(p1.y) };

	const priceDelta = p1.y - p0.y;
	const pricePct = p0.y !== 0 ? priceDelta / p0.y : 0;
	const timeDeltaMs = p1.x - p0.x;

	// Bar count: number of bars in the plot data between the two timestamps
	let barCount = 0;
	if (scales.plotData && scales.xAccessor && scales.plotData.length > 1) {
		const dates = scales.plotData.map((d) => {
			const v = scales.xAccessor!(d);
			return v instanceof Date ? v.getTime() : (d as any).date instanceof Date ? (d as any).date.getTime() : Number(v);
		});
		const t0 = p0.x;
		const t1 = p1.x;
		const tMin = Math.min(t0, t1);
		const tMax = Math.max(t0, t1);
		barCount = dates.filter((t) => t >= tMin && t <= tMax).length - 1;
		if (barCount < 0) barCount = 0;
	} else if (scales.plotData && scales.plotData.length > 1) {
		// Fallback: estimate from timeDeltaMs vs average bar duration
		const first = scales.plotData[0] as any;
		const last = scales.plotData[scales.plotData.length - 1] as any;
		const totalMs = (last.date ?? last.Date ?? 0) - (first.date ?? first.Date ?? 0);
		const avgBarMs = totalMs / (scales.plotData.length - 1);
		if (avgBarMs > 0) {
			barCount = Math.round(Math.abs(timeDeltaMs) / avgBarMs);
		}
	}

	return { priceDelta, pricePct, timeDeltaMs, barCount, px0, px1 };
}