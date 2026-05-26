import type { Point } from "./types";

export interface PlotDatum {
	date: Date | number;
	open: number;
	high: number;
	low: number;
	close: number;
	volume: number;
	[key: string]: unknown;
}

export interface ChartScales {
	xScale: (date: Date) => number;
	xScaleInvert: (px: number) => Date;
	yScale: (price: number) => number;
	yScaleInvert: (px: number) => number;
	xAccessor?: (datum: PlotDatum) => Date;
	plotData?: PlotDatum[];
}

export function pixelToChartPoint(
	clientX: number,
	clientY: number,
	containerRect: DOMRect,
	scales: ChartScales,
): Point {
	const localX = clientX - containerRect.left;
	const localY = clientY - containerRect.top;

	return {
		x: scales.xScaleInvert(localX).getTime(),
		y: scales.yScaleInvert(localY),
	};
}

export function chartPointToPixel(point: Point, scales: ChartScales): { x: number; y: number } {
	return {
		x: scales.xScale(new Date(point.x)),
		y: scales.yScale(point.y),
	};
}