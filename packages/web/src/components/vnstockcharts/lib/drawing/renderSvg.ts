import { createElement } from "react";
import type { ReactElement } from "react";
import { chartPointToPixel, type ChartScales, type PlotDatum } from "./coordinateUtils";
import { resolveDrawingStyle } from "./drawingStyleRegistry";
import type { DrawingObject, DrawingStyle } from "./types";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel";
import { calculatePitchforkGeometry } from "./builtin/pitchfork";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern";
import { calculateFibArcGeometry } from "./builtin/fibArc";
import { calculateFibTimeZoneGeometry } from "./builtin/fibTimeZone";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel";

export interface RenderSvgOptions {
	chartWidth: number;
	chartHeight: number;
	isSelected: boolean;
	plotData?: PlotDatum[];
	onSelect?: (drawing: DrawingObject, event?: { shiftKey?: boolean }) => void;
}

const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
const DEFAULT_FIB_EXTENSION_LEVELS = [1.272, 1.414, 1.618, 2, 2.618];

function strokeDasharrayForStyle(style: DrawingStyle): string | undefined {
	switch (style.strokeDasharray) {
		case "dashed":
			return "6 4";
		case "dotted":
			return "2 4";
		case "solid":
		case undefined:
			return undefined;
		default:
			return style.strokeDasharray;
	}
}

function numberFormatter(value: number) {
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function lineElement(key: string, props: Record<string, unknown>) {
	return createElement("line", { key, ...props });
}

function textElement(key: string, props: Record<string, unknown>, text: string) {
	return createElement("text", { key, ...props }, text);
}

function circleElement(key: string, props: Record<string, unknown>) {
	return createElement("circle", { key, ...props });
}

function polylineElement(key: string, props: Record<string, unknown>) {
	return createElement("polyline", { key, ...props });
}

function rectElement(key: string, props: Record<string, unknown>) {
	return createElement("rect", { key, ...props });
}

function polygonElement(key: string, props: Record<string, unknown>) {
	return createElement("polygon", { key, ...props });
}

function pathElement(key: string, props: Record<string, unknown>) {
	return createElement("path", { key, ...props });
}

function toPixel(point: DrawingObject["points"][number], scales: ChartScales) {
	return chartPointToPixel(point, scales);
}

function interactiveProps(drawing: DrawingObject, options: RenderSvgOptions) {
	return options.onSelect
		? {
			onClick: (event: { shiftKey?: boolean }) => options.onSelect?.(drawing, event),
			pointerEvents: "all",
		}
		: {};
}

function selectionHandles(points: Array<{ x: number; y: number }>, drawing: DrawingObject, options: RenderSvgOptions): ReactElement[] {
	return points.map((point, index) => circleElement(`${drawing.id}-handle-${index}`, {
		cx: point.x,
		cy: point.y,
		r: 4,
		className: "rsc-drawing-handle",
		fill: drawing.style.stroke,
		stroke: "#ffffff",
		strokeWidth: 1,
		pointerEvents: "all",
		onClick: (event: { shiftKey?: boolean }) => options.onSelect?.(drawing, event),
	}));
}

function clipSegmentToBox(start: { x: number; y: number }, end: { x: number; y: number }, chartWidth: number, chartHeight: number) {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	let t0 = 0;
	let t1 = 1;

	const edges: Array<[number, number]> = [
		[-dx, start.x],
		[dx, chartWidth - start.x],
		[-dy, start.y],
		[dy, chartHeight - start.y],
	];

	for (const [p, q] of edges) {
		if (p === 0) {
			if (q < 0) {
				return null;
			}
			continue;
		}

		const r = q / p;
		if (p < 0) {
			if (r > t1) {
				return null;
			}
			if (r > t0) {
				t0 = r;
			}
		} else {
			if (r < t0) {
				return null;
			}
			if (r < t1) {
				t1 = r;
			}
		}
	}

	if (t1 < t0) {
		return null;
	}

	return [
		{ x: start.x + dx * t0, y: start.y + dy * t0 },
		{ x: start.x + dx * t1, y: start.y + dy * t1 },
	];
}

function renderLineWithHandles(
	drawing: DrawingObject,
	start: { x: number; y: number },
	end: { x: number; y: number },
	options: RenderSvgOptions,
	key: string,
	className?: string,
) {
	const line = lineElement(key, {
		x1: start.x,
		y1: start.y,
		x2: end.x,
		y2: end.y,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	return options.isSelected ? [line, ...selectionHandles([start, end], drawing, options)] : [line];
}

function extendLineThroughBox(point: { x: number; y: number }, direction: { x: number; y: number }, chartWidth: number, chartHeight: number) {
	return clipSegmentToBox(
		{ x: point.x - direction.x * 10_000, y: point.y - direction.y * 10_000 },
		{ x: point.x + direction.x * 10_000, y: point.y + direction.y * 10_000 },
		chartWidth,
		chartHeight,
	);
}

function renderTrendLine(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const line = lineElement(`${drawing.id}-trend-line`, {
		x1: start.x,
		y1: start.y,
		x2: end.x,
		y2: end.y,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	return options.isSelected ? [line, ...selectionHandles([start, end], drawing, options)] : [line];
}

function renderHLine(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const point = drawing.points[0];
	if (!point) {
		return [];
	}

	const y = toPixel(point, scales).y;
	const left = { x: 0, y };
	const right = { x: options.chartWidth, y };
	const line = lineElement(`${drawing.id}-h-line`, {
		x1: left.x,
		y1: left.y,
		x2: right.x,
		y2: right.y,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	return options.isSelected ? [line, ...selectionHandles([left, right], drawing, options)] : [line];
}

function renderVLine(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const point = drawing.points[0];
	if (!point) {
		return [];
	}

	const x = toPixel(point, scales).x;
	const top = { x, y: 0 };
	const bottom = { x, y: options.chartHeight };
	const line = lineElement(`${drawing.id}-v-line`, {
		x1: top.x,
		y1: top.y,
		x2: bottom.x,
		y2: bottom.y,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	return options.isSelected ? [line, ...selectionHandles([top, bottom], drawing, options)] : [line];
}

function renderFibonacci(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const levels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;
	const elements: ReactElement[] = [];
	const priceDelta = endPoint.y - startPoint.y;
	const pixelDelta = end.y - start.y;

	levels.forEach((level, index) => {
		const y = start.y + pixelDelta * level;
		const price = startPoint.y + priceDelta * level;
		elements.push(lineElement(`${drawing.id}-fib-line-${index}`, {
			x1: 0,
			y1: y,
			x2: options.chartWidth,
			y2: y,
			stroke: drawing.style.stroke,
			strokeWidth: drawing.style.strokeWidth,
			strokeDasharray: strokeDasharrayForStyle(drawing.style),
			fill: "none",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			vectorEffect: "non-scaling-stroke",
			...interactiveProps(drawing, options),
		}));
		elements.push(textElement(`${drawing.id}-fib-label-${index}`, {
			x: options.chartWidth - 6,
			y: y - 4,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			textAnchor: "end",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, `${(level * 100).toFixed(1)}% — ${numberFormatter(price)}`));
	});

	return options.isSelected ? [...elements, ...selectionHandles([start, end], drawing, options)] : elements;
}

function renderChannel(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint, offsetPoint] = drawing.points;
	if (!startPoint || !endPoint || !offsetPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const offsetAnchor = toPixel(offsetPoint, scales);
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy);
	const offsetVector = length === 0
		? { x: offsetAnchor.x - start.x, y: offsetAnchor.y - start.y }
		: (() => {
			const normal = { x: -dy / length, y: dx / length };
			const distance = (offsetAnchor.x - start.x) * normal.x + (offsetAnchor.y - start.y) * normal.y;
			return { x: normal.x * distance, y: normal.y * distance };
		})();
	const offsetStart = { x: start.x + offsetVector.x, y: start.y + offsetVector.y };
	const offsetEnd = { x: end.x + offsetVector.x, y: end.y + offsetVector.y };
	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};

	return options.isSelected
		? [
			lineElement(`${drawing.id}-channel-primary`, { x1: start.x, y1: start.y, x2: end.x, y2: end.y, ...lineProps }),
			lineElement(`${drawing.id}-channel-secondary`, { x1: offsetStart.x, y1: offsetStart.y, x2: offsetEnd.x, y2: offsetEnd.y, ...lineProps }),
			...selectionHandles([start, end, offsetAnchor], drawing, options),
		]
		: [
			lineElement(`${drawing.id}-channel-primary`, { x1: start.x, y1: start.y, x2: end.x, y2: end.y, ...lineProps }),
			lineElement(`${drawing.id}-channel-secondary`, { x1: offsetStart.x, y1: offsetStart.y, x2: offsetEnd.x, y2: offsetEnd.y, ...lineProps }),
		];
}

function renderParallelChannel(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const geometry = calculateParallelChannelGeometry(drawing, scales);
	if (!geometry) {
		return [];
	}

	const positiveBoundary = clipSegmentToBox(
		{ x: geometry.start.x + geometry.offsetVector.x, y: geometry.start.y + geometry.offsetVector.y },
		{ x: geometry.end.x + geometry.offsetVector.x, y: geometry.end.y + geometry.offsetVector.y },
		options.chartWidth,
		options.chartHeight,
	);
	const negativeBoundary = clipSegmentToBox(
		{ x: geometry.start.x - geometry.offsetVector.x, y: geometry.start.y - geometry.offsetVector.y },
		{ x: geometry.end.x - geometry.offsetVector.x, y: geometry.end.y - geometry.offsetVector.y },
		options.chartWidth,
		options.chartHeight,
	);
	const middle = clipSegmentToBox(geometry.start, geometry.end, options.chartWidth, options.chartHeight);
	if (!positiveBoundary || !negativeBoundary || !middle) {
		return [];
	}

	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const elements = [
		lineElement(`${drawing.id}-parallel-channel-upper`, { x1: positiveBoundary[0].x, y1: positiveBoundary[0].y, x2: positiveBoundary[1].x, y2: positiveBoundary[1].y, ...lineProps }),
		lineElement(`${drawing.id}-parallel-channel-middle`, { x1: middle[0].x, y1: middle[0].y, x2: middle[1].x, y2: middle[1].y, ...lineProps }),
		lineElement(`${drawing.id}-parallel-channel-lower`, { x1: negativeBoundary[0].x, y1: negativeBoundary[0].y, x2: negativeBoundary[1].x, y2: negativeBoundary[1].y, ...lineProps }),
	];

	return options.isSelected ? [...elements, ...selectionHandles([geometry.start, geometry.end, geometry.offsetAnchor], drawing, options)] : elements;
}

function renderPitchfork(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const geometry = calculatePitchforkGeometry(drawing, scales);
	if (!geometry) {
		return [];
	}

	if (geometry.direction.x === 0 && geometry.direction.y === 0) {
		return [];
	}

	const median = extendLineThroughBox(geometry.pivot, geometry.direction, options.chartWidth, options.chartHeight);
	const leftFork = extendLineThroughBox(geometry.leftSwing, geometry.direction, options.chartWidth, options.chartHeight);
	const rightFork = extendLineThroughBox(geometry.rightSwing, geometry.direction, options.chartWidth, options.chartHeight);
	if (!median || !leftFork || !rightFork) {
		return [];
	}

	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const labels = [
		textElement(`${drawing.id}-pitchfork-label-a`, {
			x: geometry.pivot.x + 6,
			y: geometry.pivot.y - 6,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			fontWeight: 700,
			textAnchor: "start",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, "A"),
		textElement(`${drawing.id}-pitchfork-label-b`, {
			x: geometry.leftSwing.x + 6,
			y: geometry.leftSwing.y - 6,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			fontWeight: 700,
			textAnchor: "start",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, "B"),
		textElement(`${drawing.id}-pitchfork-label-c`, {
			x: geometry.rightSwing.x + 6,
			y: geometry.rightSwing.y - 6,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			fontWeight: 700,
			textAnchor: "start",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, "C"),
	];

	const elements = [
		lineElement(`${drawing.id}-pitchfork-median`, { x1: median[0].x, y1: median[0].y, x2: median[1].x, y2: median[1].y, ...lineProps }),
		lineElement(`${drawing.id}-pitchfork-left`, { x1: leftFork[0].x, y1: leftFork[0].y, x2: leftFork[1].x, y2: leftFork[1].y, ...lineProps }),
		lineElement(`${drawing.id}-pitchfork-right`, { x1: rightFork[0].x, y1: rightFork[0].y, x2: rightFork[1].x, y2: rightFork[1].y, ...lineProps }),
		...labels,
	];

	return options.isSelected ? [...elements, ...selectionHandles([geometry.pivot, geometry.leftSwing, geometry.rightSwing], drawing, options)] : elements;
}

function renderAbcdPattern(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const metrics = calculateAbcdPatternMetrics(drawing, scales);
	if (!metrics) {
		return [];
	}

	const [a, b, c, d] = metrics.points;
	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const badgeProps = {
		fill: drawing.style.stroke,
		fontSize: drawing.style.fontSize ?? 11,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		fontWeight: 700,
		textAnchor: "middle" as const,
		alignmentBaseline: "middle" as const,
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		...interactiveProps(drawing, options),
	};

	const ratioAB = metrics.bcToAb == null ? "BC/AB n/a" : `BC/AB ${metrics.bcToAb.toFixed(2)}`;
	const ratioBC = metrics.cdToBc == null ? "CD/BC n/a" : `CD/BC ${metrics.cdToBc.toFixed(2)}`;

	const elements = [
		lineElement(`${drawing.id}-abcd-ab`, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, ...lineProps }),
		lineElement(`${drawing.id}-abcd-bc`, { x1: b.x, y1: b.y, x2: c.x, y2: c.y, ...lineProps }),
		lineElement(`${drawing.id}-abcd-cd`, { x1: c.x, y1: c.y, x2: d.x, y2: d.y, ...lineProps }),
		textElement(`${drawing.id}-abcd-a`, { x: a.x + 6, y: a.y - 6, ...badgeProps }, "A"),
		textElement(`${drawing.id}-abcd-b`, { x: b.x + 6, y: b.y - 6, ...badgeProps }, "B"),
		textElement(`${drawing.id}-abcd-c`, { x: c.x + 6, y: c.y - 6, ...badgeProps }, "C"),
		textElement(`${drawing.id}-abcd-d`, { x: d.x + 6, y: d.y - 6, ...badgeProps }, "D"),
		textElement(`${drawing.id}-abcd-ratio-ab`, { x: metrics.segmentMidpoints[1].x, y: metrics.segmentMidpoints[1].y - 10, ...badgeProps }, ratioAB),
		textElement(`${drawing.id}-abcd-ratio-bc`, { x: metrics.segmentMidpoints[2].x, y: metrics.segmentMidpoints[2].y - 10, ...badgeProps }, ratioBC),
	];

	return options.isSelected ? [...elements, ...selectionHandles(metrics.points, drawing, options)] : elements;
}

function renderFibArc(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const geometry = calculateFibArcGeometry(drawing, scales);
	if (!geometry) {
		return [];
	}

	const stroke = drawing.style.stroke;
	const lineProps = {
		stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const arcs = geometry.radii.map((radius, index) => {
		const leftX = geometry.center.x - radius;
		const rightX = geometry.center.x + radius;
		const path = `M ${leftX} ${geometry.center.y} A ${radius} ${radius} 0 0 1 ${rightX} ${geometry.center.y}`;
		return pathElement(`${drawing.id}-fib-arc-${index}`, { d: path, ...lineProps });
	});
	const labels = geometry.radii.map((radius, index) => textElement(`${drawing.id}-fib-arc-label-${index}`, {
		x: geometry.center.x + radius + 4,
		y: geometry.center.y - radius - 4,
		fill: stroke,
		fontSize: drawing.style.fontSize ?? 11,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		textAnchor: "start",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		...interactiveProps(drawing, options),
	}, `${(geometry.levels[index] * 100).toFixed(1)}%`));

	const elements = [...arcs, ...labels];
	return options.isSelected ? [...elements, ...selectionHandles([geometry.center, geometry.reference], drawing, options)] : elements;
}

function renderFibTimeZone(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const geometry = calculateFibTimeZoneGeometry(drawing, scales);
	if (!geometry) {
		return [];
	}

	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const elements = geometry.positions.flatMap((x, index) => [
		lineElement(`${drawing.id}-fib-time-zone-line-${index}`, {
			x1: x,
			y1: 0,
			x2: x,
			y2: options.chartHeight,
			...lineProps,
		}),
		textElement(`${drawing.id}-fib-time-zone-label-${index}`, {
			x: x + 4,
			y: 12,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			textAnchor: "start",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, `${geometry.levels[index]}`),
	]);

	return options.isSelected ? [...elements, ...selectionHandles([geometry.start, geometry.end], drawing, options)] : elements;
}

function renderRegressionChannel(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const metrics = calculateRegressionChannelMetrics(drawing, scales, options.plotData ?? []);
	if (!metrics) {
		return [];
	}

	const lineProps = {
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	};
	const fill = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : "rgba(100,149,237,0.08)";
	const polygon = polygonElement(`${drawing.id}-regression-fill`, {
		points: [
			`${metrics.startX},${metrics.upperStartY}`,
			`${metrics.endX},${metrics.upperEndY}`,
			`${metrics.endX},${metrics.lowerEndY}`,
			`${metrics.startX},${metrics.lowerStartY}`,
		].join(" "),
		fill,
		fillOpacity: drawing.style.fillOpacity ?? 1,
		stroke: "none",
		opacity: drawing.style.opacity ?? 1,
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});
	const dashedStroke = strokeDasharrayForStyle({ ...drawing.style, strokeDasharray: "dashed" });
	const badge = textElement(`${drawing.id}-regression-badge`, {
		x: metrics.endX - 4,
		y: Math.min(metrics.upperEndY, metrics.lowerEndY, metrics.endY) - 6,
		fill: drawing.style.stroke,
		fontSize: drawing.style.fontSize ?? 11,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		fontWeight: 700,
		textAnchor: "end",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		...interactiveProps(drawing, options),
	}, `R² ${metrics.rSquared.toFixed(2)}`);

	const elements = [
		polygon,
		lineElement(`${drawing.id}-regression-upper`, { x1: metrics.startX, y1: metrics.upperStartY, x2: metrics.endX, y2: metrics.upperEndY, ...lineProps, strokeDasharray: dashedStroke }),
		lineElement(`${drawing.id}-regression-lower`, { x1: metrics.startX, y1: metrics.lowerStartY, x2: metrics.endX, y2: metrics.lowerEndY, ...lineProps, strokeDasharray: dashedStroke }),
		lineElement(`${drawing.id}-regression-center`, { x1: metrics.startX, y1: metrics.startY, x2: metrics.endX, y2: metrics.endY, ...lineProps }),
		badge,
	];

	return options.isSelected ? [...elements, ...selectionHandles([drawing.points[0], drawing.points[1]].filter(Boolean) as Array<{ x: number; y: number }>, drawing, options)] : elements;
}

function renderText(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const point = drawing.points[0];
	if (!point) {
		return [];
	}

	const pixel = toPixel(point, scales);
	const text = drawing.text?.trim().length ? drawing.text : "Text";

	return [textElement(`${drawing.id}-text`, {
		x: pixel.x,
		y: pixel.y,
		fill: drawing.style.stroke,
		fontSize: drawing.style.fontSize ?? 12,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		alignmentBaseline: "middle",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		...interactiveProps(drawing, options),
	}, text)];
}

function renderRay(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const clipped = clipSegmentToBox(
		start,
		{ x: start.x + (end.x - start.x) * 10_000, y: start.y + (end.y - start.y) * 10_000 },
		options.chartWidth,
		options.chartHeight,
	);

	if (!clipped) {
		return [];
	}

	return renderLineWithHandles(drawing, clipped[0], clipped[1], options, `${drawing.id}-ray`);
}

function renderExtendedLine(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const vector = { x: end.x - start.x, y: end.y - start.y };
	const clipped = clipSegmentToBox(
		{ x: start.x - vector.x * 10_000, y: start.y - vector.y * 10_000 },
		{ x: start.x + vector.x * 10_000, y: start.y + vector.y * 10_000 },
		options.chartWidth,
		options.chartHeight,
	);

	if (!clipped) {
		return [];
	}

	return renderLineWithHandles(drawing, clipped[0], clipped[1], options, `${drawing.id}-extended-line`);
}

function renderPolyline(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	if (drawing.points.length < 2) {
		return [];
	}

	const pixels = drawing.points.map((point) => toPixel(point, scales));
	const element = polylineElement(`${drawing.id}-polyline`, {
		points: pixels.map((point) => `${point.x},${point.y}`).join(" "),
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	return options.isSelected ? [element, ...selectionHandles(pixels, drawing, options)] : [element];
}

function renderDateAndPriceRange(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);
	const percent = startPoint.y === 0 ? 0 : ((endPoint.y - startPoint.y) / Math.abs(startPoint.y)) * 100;
	const bars = Math.max(1, Math.round(Math.abs(end.x - start.x) / 6));
	const badge = `Δ ${percent >= 0 ? "+" : ""}${percent.toFixed(2)}% · ${bars} bars`;

	const rect = rectElement(`${drawing.id}-range`, {
		x,
		y,
		width,
		height,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		fill: drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : drawing.style.stroke,
		fillOpacity: drawing.style.fillOpacity ?? 0.16,
		opacity: drawing.style.opacity ?? 1,
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});
	const badgeText = textElement(`${drawing.id}-range-badge`, {
		x: x + 8,
		y: y + 16,
		fill: drawing.style.stroke,
		fontSize: drawing.style.fontSize ?? 11,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		fontWeight: 700,
		textAnchor: "start",
		alignmentBaseline: "middle",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		...interactiveProps(drawing, options),
	}, badge);

	return options.isSelected ? [rect, badgeText, ...selectionHandles([start, end], drawing, options)] : [rect, badgeText];
}

function renderPositionZones(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions, mode: "long" | "short"): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const left = Math.min(start.x, end.x);
	const right = Math.max(start.x, end.x);
	const width = Math.max(0, right - left);
	const riskReward = drawing.riskReward ?? {
		entry: startPoint.y,
		stop: mode === "long" ? Math.min(startPoint.y, endPoint.y) : Math.max(startPoint.y, endPoint.y),
		target: mode === "long" ? Math.max(startPoint.y, endPoint.y) : Math.min(startPoint.y, endPoint.y),
	};

	const entryY = toPixel({ x: startPoint.x, y: riskReward.entry }, scales).y;
	const stopY = toPixel({ x: startPoint.x, y: riskReward.stop }, scales).y;
	const targetY = toPixel({ x: startPoint.x, y: riskReward.target }, scales).y;
	const reward = Math.abs(riskReward.target - riskReward.entry);
	const risk = Math.abs(riskReward.entry - riskReward.stop);
	const ratio = risk > 0 ? reward / risk : undefined;
	const badge = ratio ? `R/R 1:${ratio.toFixed(1)}` : "R/R n/a";
	const tpZoneClass = mode === "long" ? "rsc-long-tp-zone" : "rsc-short-tp-zone";
	const slZoneClass = mode === "long" ? "rsc-long-sl-zone" : "rsc-short-sl-zone";
	const tpZone = rectElement(`${drawing.id}-tp-zone`, {
		x: left,
		y: Math.min(entryY, targetY),
		width,
		height: Math.abs(targetY - entryY),
		className: tpZoneClass,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		...interactiveProps(drawing, options),
	});
	const slZone = rectElement(`${drawing.id}-sl-zone`, {
		x: left,
		y: Math.min(entryY, stopY),
		width,
		height: Math.abs(stopY - entryY),
		className: slZoneClass,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		...interactiveProps(drawing, options),
	});
	const entryLine = lineElement(`${drawing.id}-entry-line`, {
		x1: left,
		y1: entryY,
		x2: right,
		y2: entryY,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});
	const stopLine = lineElement(`${drawing.id}-stop-line`, {
		x1: left,
		y1: stopY,
		x2: right,
		y2: stopY,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});
	const targetLine = lineElement(`${drawing.id}-target-line`, {
		x1: left,
		y1: targetY,
		x2: right,
		y2: targetY,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});
	const badgeText = textElement(`${drawing.id}-rr-badge`, {
		x: right - 4,
		y: Math.min(entryY, stopY, targetY) - 6,
		fill: drawing.style.stroke,
		fontSize: drawing.style.fontSize ?? 11,
		fontFamily: drawing.style.fontFamily ?? "sans-serif",
		fontWeight: 700,
		textAnchor: "end",
		alignmentBaseline: "middle",
		className: ["rsc-rr-badge", options.isSelected ? "rsc-drawing-selected" : ""].filter(Boolean).join(" "),
		...interactiveProps(drawing, options),
	}, badge);

	const elements = [tpZone, slZone, entryLine, targetLine, stopLine, badgeText];
	return options.isSelected ? [...elements, ...selectionHandles([start, end], drawing, options)] : elements;
}

function renderLongPosition(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	return renderPositionZones(drawing, scales, options, "long");
}

function renderShortPosition(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	return renderPositionZones(drawing, scales, options, "short");
}

function renderFibExtension(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const levels = drawing.fibLevels ?? DEFAULT_FIB_EXTENSION_LEVELS;
	const priceDelta = endPoint.y - startPoint.y;
	const elements: ReactElement[] = [];

	levels.forEach((level, index) => {
		const extensionPrice = endPoint.y + priceDelta * level;
		const y = toPixel({ x: endPoint.x, y: extensionPrice }, scales).y;
		elements.push(lineElement(`${drawing.id}-fib-extension-line-${index}`, {
			x1: 0,
			y1: y,
			x2: options.chartWidth,
			y2: y,
			stroke: drawing.style.stroke,
			strokeWidth: drawing.style.strokeWidth,
			strokeDasharray: strokeDasharrayForStyle(drawing.style),
			fill: "none",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			vectorEffect: "non-scaling-stroke",
			...interactiveProps(drawing, options),
		}));
		elements.push(textElement(`${drawing.id}-fib-extension-label-${index}`, {
			x: options.chartWidth - 6,
			y: y - 4,
			fill: drawing.style.stroke,
			fontSize: drawing.style.fontSize ?? 11,
			fontFamily: drawing.style.fontFamily ?? "sans-serif",
			textAnchor: "end",
			className: options.isSelected ? "rsc-drawing-selected" : undefined,
			...interactiveProps(drawing, options),
		}, `${(level * 100).toFixed(1)}% — ${numberFormatter(extensionPrice)}`));
	});

	return options.isSelected ? [...elements, ...selectionHandles([start, end], drawing, options)] : elements;
}

function renderRectangle(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);

	return [rectElement(`${drawing.id}-rectangle`, {
		x,
		y,
		width,
		height,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: drawing.style.fill ?? "transparent",
		fillOpacity: drawing.style.fillOpacity ?? drawing.style.opacity ?? 1,
		opacity: drawing.style.opacity ?? 1,
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	})];
}

function renderArrow(drawing: DrawingObject, scales: ChartScales, options: RenderSvgOptions): ReactElement[] {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return [];
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy);
	const headLength = Math.max(8, drawing.style.strokeWidth * 4);
	const headWidth = Math.max(5, drawing.style.strokeWidth * 2);
	const line = lineElement(`${drawing.id}-arrow-line`, {
		x1: start.x,
		y1: start.y,
		x2: end.x,
		y2: end.y,
		stroke: drawing.style.stroke,
		strokeWidth: drawing.style.strokeWidth,
		strokeDasharray: strokeDasharrayForStyle(drawing.style),
		fill: "none",
		className: options.isSelected ? "rsc-drawing-selected" : undefined,
		vectorEffect: "non-scaling-stroke",
		...interactiveProps(drawing, options),
	});

	if (length === 0) {
		return [line];
	}

	const ux = dx / length;
	const uy = dy / length;
	const px = -uy;
	const py = ux;
	const base = {
		x: end.x - ux * headLength,
		y: end.y - uy * headLength,
	};
	const left = {
		x: base.x + px * headWidth,
		y: base.y + py * headWidth,
	};
	const right = {
		x: base.x - px * headWidth,
		y: base.y - py * headWidth,
	};

	return options.isSelected
		? [
			line,
			polygonElement(`${drawing.id}-arrow-head`, {
				points: `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`,
				fill: drawing.style.stroke,
				stroke: drawing.style.stroke,
				strokeWidth: drawing.style.strokeWidth,
				className: "rsc-drawing-selected",
				...interactiveProps(drawing, options),
			}),
			...selectionHandles([start, end], drawing, options),
		]
		: [
			line,
			polygonElement(`${drawing.id}-arrow-head`, {
				points: `${end.x},${end.y} ${left.x},${left.y} ${right.x},${right.y}`,
				fill: drawing.style.stroke,
				stroke: drawing.style.stroke,
				strokeWidth: drawing.style.strokeWidth,
				...interactiveProps(drawing, options),
			}),
		];
}

export function renderDrawingToSvg(
	drawing: DrawingObject,
	scales: ChartScales,
	options: RenderSvgOptions,
): ReactElement[] {
	if (drawing.visible === false) {
		return [];
	}

	const effectiveDrawing = {
		...drawing,
		style: resolveDrawingStyle(drawing),
	};

	switch (effectiveDrawing.type as string) {
		case "trendLine":
				return renderTrendLine(effectiveDrawing, scales, options);
		case "ray":
			return renderRay(effectiveDrawing, scales, options);
		case "extendedLine":
			return renderExtendedLine(effectiveDrawing, scales, options);
		case "polyline":
			return renderPolyline(effectiveDrawing, scales, options);
		case "dateAndPriceRange":
			return renderDateAndPriceRange(effectiveDrawing, scales, options);
		case "longPosition":
			return renderLongPosition(effectiveDrawing, scales, options);
		case "shortPosition":
			return renderShortPosition(effectiveDrawing, scales, options);
		case "fibExtension":
			return renderFibExtension(effectiveDrawing, scales, options);
		case "hLine":
			return renderHLine(effectiveDrawing, scales, options);
		case "vLine":
			return renderVLine(effectiveDrawing, scales, options);
		case "fibonacci":
			return renderFibonacci(effectiveDrawing, scales, options);
		case "channel":
				return renderChannel(effectiveDrawing, scales, options);
		case "parallelChannel":
			return renderParallelChannel(effectiveDrawing, scales, options);
		case "pitchfork":
			return renderPitchfork(effectiveDrawing, scales, options);
		case "abcdPattern":
			return renderAbcdPattern(effectiveDrawing, scales, options);
		case "fibArc":
			return renderFibArc(effectiveDrawing, scales, options);
		case "fibTimeZone":
			return renderFibTimeZone(effectiveDrawing, scales, options);
		case "regressionChannel":
			return renderRegressionChannel(effectiveDrawing, scales, options);
		case "text":
				return renderText(effectiveDrawing, scales, options);
		case "rectangle":
				return renderRectangle(effectiveDrawing, scales, options);
		case "arrow":
				return renderArrow(effectiveDrawing, scales, options);
		default:
			return [];
	}
}