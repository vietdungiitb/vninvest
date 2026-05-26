import type { ChartScales, PlotDatum } from "../coordinateUtils";
import { chartPointToPixel } from "../coordinateUtils";
import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

export interface RegressionChannelMetrics {
	bars: PlotDatum[];
	slope: number;
	intercept: number;
	stdDev: number;
	rSquared: number;
	startX: number;
	endX: number;
	startY: number;
	endY: number;
	upperStartY: number;
	upperEndY: number;
	lowerStartY: number;
	lowerEndY: number;
}

function toTimeValue(value: Date | number) {
	return value instanceof Date ? value.getTime() : value;
}

export function calculateRegressionChannelMetrics(
	drawing: DrawingObject,
	scales: ChartScales,
	plotData: PlotDatum[] = [],
): RegressionChannelMetrics | null {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return null;
	}

	const startTime = Math.min(startPoint.x, endPoint.x);
	const endTime = Math.max(startPoint.x, endPoint.x);
	const bars = plotData.filter((bar) => {
		const barTime = toTimeValue(bar.date);
		return barTime >= startTime && barTime <= endTime;
	});

	if (bars.length < 2) {
		const start = chartPointToPixel(startPoint, scales);
		const end = chartPointToPixel(endPoint, scales);
		return {
			bars,
			slope: endPoint.x === startPoint.x ? 0 : (endPoint.y - startPoint.y) / (endPoint.x - startPoint.x),
			intercept: startPoint.y,
			stdDev: 0,
			rSquared: 1,
			startX: start.x,
			endX: end.x,
			startY: start.y,
			endY: end.y,
			upperStartY: start.y,
			upperEndY: end.y,
			lowerStartY: start.y,
			lowerEndY: end.y,
		};
	}

	const closes = bars.map((bar) => bar.close);
	const xs = bars.map((_, index) => index);
	const n = closes.length;
	const sumX = xs.reduce((sum, value) => sum + value, 0);
	const sumY = closes.reduce((sum, value) => sum + value, 0);
	const sumXX = xs.reduce((sum, value) => sum + value * value, 0);
	const sumXY = xs.reduce((sum, value, index) => sum + value * closes[index], 0);
	const denominator = n * sumXX - sumX * sumX;
	const slope = denominator === 0 ? 0 : (n * sumXY - sumX * sumY) / denominator;
	const intercept = (sumY / n) - slope * (sumX / n);
	const residuals = closes.map((close, index) => close - (slope * index + intercept));
	const meanY = sumY / n;
	const ssRes = residuals.reduce((sum, value) => sum + value * value, 0);
	const ssTot = closes.reduce((sum, value) => sum + (value - meanY) ** 2, 0);
	const stdDev = Math.sqrt(ssRes / n);
	const rSquared = ssTot === 0 ? 1 : Math.max(0, Math.min(1, 1 - ssRes / ssTot));
	const startPrice = intercept + slope * 0;
	const endPrice = intercept + slope * (n - 1);
	const leftBar = bars[0];
	const rightBar = bars[n - 1];
	const startX = scales.xScale(new Date(toTimeValue(leftBar.date)));
	const endX = scales.xScale(new Date(toTimeValue(rightBar.date)));

	return {
		bars,
		slope,
		intercept,
		stdDev,
		rSquared,
		startX,
		endX,
		startY: scales.yScale(startPrice),
		endY: scales.yScale(endPrice),
		upperStartY: scales.yScale(startPrice + stdDev),
		upperEndY: scales.yScale(endPrice + stdDev),
		lowerStartY: scales.yScale(startPrice - stdDev),
		lowerEndY: scales.yScale(endPrice - stdDev),
	};
}

const RegressionChannel: DrawingToolDefinition = {
	name: "regressionChannel",
	createDraft: (startPoint) => createDrawingObject("regressionChannel", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default RegressionChannel;