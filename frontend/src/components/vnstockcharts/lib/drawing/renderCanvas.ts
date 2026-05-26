import { chartPointToPixel, type ChartScales, type PlotDatum } from "./coordinateUtils";
import {
	renderOverlayPrimitiveToCanvas,
	type OverlayCanvasPrimitive,
} from "./engineCompat";
import { resolveDrawingStyle } from "./drawingStyleRegistry";
import type { DrawingObject, DrawingStyle } from "./types";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel";
import { calculatePitchforkGeometry } from "./builtin/pitchfork";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern";
import { calculateFibArcGeometry } from "./builtin/fibArc";
import { calculateFibTimeZoneGeometry } from "./builtin/fibTimeZone";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel";
import { calculateGannFanGeometry } from "./builtin/gannFan";
import { calculateElliottWaveGeometry } from "./builtin/elliottWaves";
import { calculateHarmonicPatternGeometry } from "./builtin/harmonicPatterns";
import { calculateFibExtendedGeometry, FIB_EXTENDED_LEVELS, FIB_FAN_RATIOS } from "./builtin/fibExtended";
import { calculateGannAdvancedGeometry, GANN_FRACTIONS } from "./builtin/gannAdvanced";
import { calculateCycleGeometry } from "./builtin/cycles";

export interface RenderCanvasOptions {
	chartWidth: number;
	chartHeight: number;
	isSelected: boolean;
	plotData?: PlotDatum[];
}

export const DEFAULT_FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.618, 2.618];
export const DEFAULT_FIB_EXTENSION_LEVELS = [1.272, 1.414, 1.618, 2, 2.618];

function numberFormatter(value: number) {
	return new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(value);
}

function strokeDasharrayForStyle(style: DrawingStyle): number[] {
	switch (style.strokeDasharray) {
		case "dashed":
			return [6, 4];
		case "dotted":
			return [2, 4];
		case "solid":
		case undefined:
		default:
			return [];
	}
}

function applyLineStyle(ctx: CanvasRenderingContext2D, style: DrawingStyle) {
	ctx.strokeStyle = style.stroke;
	ctx.lineWidth = style.strokeWidth;
	ctx.lineCap = "round";
	ctx.lineJoin = "round";
	ctx.setLineDash(strokeDasharrayForStyle(style));
	ctx.globalAlpha = style.opacity ?? 1;
}

function toPixel(point: DrawingObject["points"][number], scales: ChartScales) {
	return chartPointToPixel(point, scales);
}

function toPrimitiveStyle(style: DrawingStyle) {
	return {
		stroke: style.stroke,
		strokeWidth: style.strokeWidth,
		strokeDasharray: style.strokeDasharray,
		fill: style.fill,
		fillOpacity: style.fillOpacity,
		opacity: style.opacity,
		fontSize: style.fontSize,
		fontFamily: style.fontFamily,
	} satisfies OverlayCanvasPrimitive["style"];
}

function drawSelectionHandles(
	ctx: CanvasRenderingContext2D,
	points: Array<{ x: number; y: number }>,
	color: string,
) {
	if (points.length === 0) {
		return;
	}

	ctx.save();
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);
	ctx.lineWidth = 1;
	points.forEach((point) => {
		ctx.beginPath();
		ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
		ctx.fillStyle = color;
		ctx.strokeStyle = "#ffffff";
		ctx.fill();
		ctx.stroke();
	});
	ctx.restore();
}

export function clipSegmentToBox(
	start: { x: number; y: number },
	end: { x: number; y: number },
	chartWidth: number,
	chartHeight: number,
) {
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
	] as const;
}

function extendLineThroughBox(point: { x: number; y: number }, direction: { x: number; y: number }, chartWidth: number, chartHeight: number) {
	return clipSegmentToBox(
		{ x: point.x - direction.x * 10_000, y: point.y - direction.y * 10_000 },
		{ x: point.x + direction.x * 10_000, y: point.y + direction.y * 10_000 },
		chartWidth,
		chartHeight,
	);
}

function drawLine(
	ctx: CanvasRenderingContext2D,
	start: { x: number; y: number },
	end: { x: number; y: number },
	style: DrawingStyle,
) {
	ctx.save();
	applyLineStyle(ctx, style);
	ctx.beginPath();
	ctx.moveTo(start.x, start.y);
	ctx.lineTo(end.x, end.y);
	ctx.stroke();
	ctx.restore();
}

function drawPolyline(
	ctx: CanvasRenderingContext2D,
	points: Array<{ x: number; y: number }>,
	style: DrawingStyle,
) {
	if (points.length < 2) {
		return;
	}

	ctx.save();
	applyLineStyle(ctx, style);
	ctx.beginPath();
	ctx.moveTo(points[0].x, points[0].y);
	for (let index = 1; index < points.length; index += 1) {
		ctx.lineTo(points[index].x, points[index].y);
	}
	ctx.stroke();
	ctx.restore();
}

function drawTextLabel(
	ctx: CanvasRenderingContext2D,
	text: string,
	position: { x: number; y: number },
	style: DrawingStyle,
	options: {
		align?: CanvasTextAlign;
		baseline?: CanvasTextBaseline;
		weight?: number;
		fillStyle?: string;
		fontSize?: number;
	},
) {
	ctx.save();
	ctx.globalAlpha = style.opacity ?? 1;
	ctx.fillStyle = options.fillStyle ?? style.stroke;
	ctx.font = `${options.weight ? `${options.weight} ` : ""}${options.fontSize ?? style.fontSize ?? 11}px ${style.fontFamily ?? "sans-serif"}`;
	ctx.textAlign = options.align ?? "left";
	ctx.textBaseline = options.baseline ?? "alphabetic";
	ctx.fillText(text, position.x, position.y);
	ctx.restore();
}

function drawFilledRect(
	ctx: CanvasRenderingContext2D,
	rect: { x: number; y: number; width: number; height: number },
	fill: string,
	fillAlpha: number,
) {
	ctx.save();
	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = fill;
	ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}

function drawStrokedRect(
	ctx: CanvasRenderingContext2D,
	rect: { x: number; y: number; width: number; height: number },
	style: DrawingStyle,
) {
	ctx.save();
	applyLineStyle(ctx, style);
	ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
	ctx.restore();
}

function drawPolygonFill(
	ctx: CanvasRenderingContext2D,
	points: Array<{ x: number; y: number }>,
	fill: string,
	fillAlpha: number,
) {
	if (points.length < 3) {
		return;
	}

	ctx.save();
	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.moveTo(points[0].x, points[0].y);
	for (let index = 1; index < points.length; index += 1) {
		ctx.lineTo(points[index].x, points[index].y);
	}
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

function drawTrendLine(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	drawLine(ctx, start, end, drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawHLine(drawing: DrawingObject, scales: ChartScales, chartWidth: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const point = drawing.points[0];
	if (!point) {
		return;
	}

	const y = toPixel(point, scales).y;
	const left = { x: 0, y };
	const right = { x: chartWidth, y };
	drawLine(ctx, left, right, drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [left, right], drawing.style.stroke);
	}
}

function drawVLine(drawing: DrawingObject, scales: ChartScales, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const point = drawing.points[0];
	if (!point) {
		return;
	}

	const x = toPixel(point, scales).x;
	const top = { x, y: 0 };
	const bottom = { x, y: chartHeight };
	drawLine(ctx, top, bottom, drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [top, bottom], drawing.style.stroke);
	}
}

function drawFibonacci(drawing: DrawingObject, scales: ChartScales, chartWidth: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const priceDelta = endPoint.y - startPoint.y;
	const pixelDelta = end.y - start.y;

	if (drawing.fibLevelConfigs && drawing.fibLevelConfigs.length > 0) {
		// DT-7: per-level config (visible + per-level color)
		drawing.fibLevelConfigs.forEach((cfg) => {
			if (!cfg.visible) return;
			const y = start.y + pixelDelta * cfg.ratio;
			const price = startPoint.y + priceDelta * cfg.ratio;
			const levelStyle = cfg.color ? { ...drawing.style, stroke: cfg.color } : drawing.style;
			drawLine(ctx, { x: 0, y }, { x: chartWidth, y }, levelStyle);
			drawTextLabel(ctx, `${(cfg.ratio * 100).toFixed(1)}% — ${numberFormatter(price)}`, { x: chartWidth - 6, y: y - 4 }, levelStyle, {
				align: "right",
				baseline: "alphabetic",
				fontSize: drawing.style.fontSize ?? 11,
			});
		});
	} else {
		// Legacy: plain fibLevels array or defaults
		const levels = drawing.fibLevels ?? DEFAULT_FIB_LEVELS;
		levels.forEach((level) => {
			const y = start.y + pixelDelta * level;
			const price = startPoint.y + priceDelta * level;
			drawLine(ctx, { x: 0, y }, { x: chartWidth, y }, drawing.style);
			drawTextLabel(ctx, `${(level * 100).toFixed(1)}% — ${numberFormatter(price)}`, { x: chartWidth - 6, y: y - 4 }, drawing.style, {
				align: "right",
				baseline: "alphabetic",
				fontSize: drawing.style.fontSize ?? 11,
			});
		});
	}

	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawChannel(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint, offsetPoint] = drawing.points;
	if (!startPoint || !endPoint || !offsetPoint) {
		return;
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
	drawLine(ctx, start, end, drawing.style);
	drawLine(ctx, offsetStart, offsetEnd, drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [start, end, offsetAnchor], drawing.style.stroke);
	}
}

function drawParallelChannel(drawing: DrawingObject, scales: ChartScales, chartWidth: number, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const geometry = calculateParallelChannelGeometry(drawing, scales);
	if (!geometry) {
		return;
	}

	const upper = clipSegmentToBox(
		{ x: geometry.start.x + geometry.offsetVector.x, y: geometry.start.y + geometry.offsetVector.y },
		{ x: geometry.end.x + geometry.offsetVector.x, y: geometry.end.y + geometry.offsetVector.y },
		chartWidth,
		chartHeight,
	);
	const middle = clipSegmentToBox(geometry.start, geometry.end, chartWidth, chartHeight);
	const lower = clipSegmentToBox(
		{ x: geometry.start.x - geometry.offsetVector.x, y: geometry.start.y - geometry.offsetVector.y },
		{ x: geometry.end.x - geometry.offsetVector.x, y: geometry.end.y - geometry.offsetVector.y },
		chartWidth,
		chartHeight,
	);

	if (upper) {
		drawLine(ctx, upper[0], upper[1], drawing.style);
	}
	if (middle) {
		drawLine(ctx, middle[0], middle[1], drawing.style);
	}
	if (lower) {
		drawLine(ctx, lower[0], lower[1], drawing.style);
	}

	if (isSelected) {
		drawSelectionHandles(ctx, [geometry.start, geometry.end, geometry.offsetAnchor], drawing.style.stroke);
	}
}

function drawPitchfork(drawing: DrawingObject, scales: ChartScales, chartWidth: number, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const geometry = calculatePitchforkGeometry(drawing, scales);
	if (!geometry || (geometry.direction.x === 0 && geometry.direction.y === 0)) {
		return;
	}

	const median = extendLineThroughBox(geometry.pivot, geometry.direction, chartWidth, chartHeight);
	const leftFork = extendLineThroughBox(geometry.leftSwing, geometry.direction, chartWidth, chartHeight);
	const rightFork = extendLineThroughBox(geometry.rightSwing, geometry.direction, chartWidth, chartHeight);
	if (!median || !leftFork || !rightFork) {
		return;
	}

	drawLine(ctx, median[0], median[1], drawing.style);
	drawLine(ctx, leftFork[0], leftFork[1], drawing.style);
	drawLine(ctx, rightFork[0], rightFork[1], drawing.style);
	drawTextLabel(ctx, "A", { x: geometry.pivot.x + 6, y: geometry.pivot.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });
	drawTextLabel(ctx, "B", { x: geometry.leftSwing.x + 6, y: geometry.leftSwing.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });
	drawTextLabel(ctx, "C", { x: geometry.rightSwing.x + 6, y: geometry.rightSwing.y - 6 }, drawing.style, { weight: 700, fontSize: drawing.style.fontSize ?? 11 });

	if (isSelected) {
		drawSelectionHandles(ctx, [geometry.pivot, geometry.leftSwing, geometry.rightSwing], drawing.style.stroke);
	}
}

function drawAbcdPattern(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const metrics = calculateAbcdPatternMetrics(drawing, scales);
	if (!metrics) {
		return;
	}

	const [a, b, c, d] = metrics.points;
	drawLine(ctx, a, b, drawing.style);
	drawLine(ctx, b, c, drawing.style);
	drawLine(ctx, c, d, drawing.style);

	const badgeStyle = { weight: 700, fontSize: drawing.style.fontSize ?? 11 };
	drawTextLabel(ctx, "A", { x: a.x + 6, y: a.y - 6 }, drawing.style, badgeStyle);
	drawTextLabel(ctx, "B", { x: b.x + 6, y: b.y - 6 }, drawing.style, badgeStyle);
	drawTextLabel(ctx, "C", { x: c.x + 6, y: c.y - 6 }, drawing.style, badgeStyle);
	drawTextLabel(ctx, "D", { x: d.x + 6, y: d.y - 6 }, drawing.style, badgeStyle);

	const ratioAB = metrics.bcToAb == null ? "BC/AB n/a" : `BC/AB ${metrics.bcToAb.toFixed(2)}`;
	const ratioBC = metrics.cdToBc == null ? "CD/BC n/a" : `CD/BC ${metrics.cdToBc.toFixed(2)}`;
	drawTextLabel(ctx, ratioAB, { x: metrics.segmentMidpoints[1].x, y: metrics.segmentMidpoints[1].y - 10 }, drawing.style, {
		align: "center",
		baseline: "alphabetic",
		weight: 700,
		fontSize: drawing.style.fontSize ?? 11,
	});
	drawTextLabel(ctx, ratioBC, { x: metrics.segmentMidpoints[2].x, y: metrics.segmentMidpoints[2].y - 10 }, drawing.style, {
		align: "center",
		baseline: "alphabetic",
		weight: 700,
		fontSize: drawing.style.fontSize ?? 11,
	});

	if (isSelected) {
		drawSelectionHandles(ctx, metrics.points, drawing.style.stroke);
	}
}

function drawFibArc(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const geometry = calculateFibArcGeometry(drawing, scales);
	if (!geometry) {
		return;
	}

	geometry.radii.forEach((radius, index) => {
		ctx.save();
		applyLineStyle(ctx, drawing.style);
		ctx.beginPath();
		ctx.arc(geometry.center.x, geometry.center.y, radius, Math.PI, 0);
		ctx.stroke();
		ctx.restore();

		drawTextLabel(ctx, `${(geometry.levels[index] * 100).toFixed(1)}%`, {
			x: geometry.center.x + radius + 4,
			y: geometry.center.y - radius - 4,
		}, drawing.style, {
			baseline: "alphabetic",
			fontSize: drawing.style.fontSize ?? 11,
		});
	});

	if (isSelected) {
		drawSelectionHandles(ctx, [geometry.center, geometry.reference], drawing.style.stroke);
	}
}

function drawFibTimeZone(drawing: DrawingObject, scales: ChartScales, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const geometry = calculateFibTimeZoneGeometry(drawing, scales);
	if (!geometry) {
		return;
	}

	geometry.positions.forEach((x, index) => {
		drawLine(ctx, { x, y: 0 }, { x, y: chartHeight }, drawing.style);
		drawTextLabel(ctx, `${geometry.levels[index]}`, { x: x + 4, y: 12 }, drawing.style, {
			baseline: "alphabetic",
			fontSize: drawing.style.fontSize ?? 11,
		});
	});

	if (isSelected) {
		drawSelectionHandles(ctx, [geometry.start, geometry.end], drawing.style.stroke);
	}
}

function drawRegressionChannel(drawing: DrawingObject, scales: ChartScales, options: RenderCanvasOptions, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const metrics = calculateRegressionChannelMetrics(drawing, scales, options.plotData ?? []);
	if (!metrics) {
		return;
	}

	const fill = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : "rgba(100,149,237,0.08)";
	const fillAlpha = (drawing.style.fillOpacity ?? 1) * (drawing.style.opacity ?? 1);
	drawPolygonFill(ctx, [
		{ x: metrics.startX, y: metrics.upperStartY },
		{ x: metrics.endX, y: metrics.upperEndY },
		{ x: metrics.endX, y: metrics.lowerEndY },
		{ x: metrics.startX, y: metrics.lowerStartY },
	], fill, fillAlpha);

	const dashedStyle: DrawingStyle = { ...drawing.style, strokeDasharray: "dashed" };
	drawLine(ctx, { x: metrics.startX, y: metrics.upperStartY }, { x: metrics.endX, y: metrics.upperEndY }, dashedStyle);
	drawLine(ctx, { x: metrics.startX, y: metrics.lowerStartY }, { x: metrics.endX, y: metrics.lowerEndY }, dashedStyle);
	drawLine(ctx, { x: metrics.startX, y: metrics.startY }, { x: metrics.endX, y: metrics.endY }, drawing.style);

	drawTextLabel(ctx, `R² ${metrics.rSquared.toFixed(2)}`, { x: metrics.endX - 4, y: Math.min(metrics.upperEndY, metrics.lowerEndY, metrics.endY) - 6 }, drawing.style, {
		align: "right",
		baseline: "alphabetic",
		weight: 700,
		fontSize: drawing.style.fontSize ?? 11,
	});

	if (isSelected) {
		const handles = drawing.points
			.filter((point): point is DrawingObject["points"][number] => Boolean(point))
			.map((point) => toPixel(point, scales));
		drawSelectionHandles(ctx, handles, drawing.style.stroke);
	}
}

function drawText(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const point = drawing.points[0];
	if (!point) {
		return;
	}

	const pixel = toPixel(point, scales);
	const text = drawing.text?.trim().length ? drawing.text : "Text";
	drawTextLabel(ctx, text, pixel, drawing.style, {
		baseline: "middle",
		fontSize: drawing.style.fontSize ?? 12,
	});

	if (isSelected) {
		drawSelectionHandles(ctx, [pixel], drawing.style.stroke);
	}
}

function drawRay(drawing: DrawingObject, scales: ChartScales, chartWidth: number, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const clipped = clipSegmentToBox(
		start,
		{ x: start.x + (end.x - start.x) * 10_000, y: start.y + (end.y - start.y) * 10_000 },
		chartWidth,
		chartHeight,
	);

	if (!clipped) {
		return;
	}

	drawLine(ctx, clipped[0], clipped[1], drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [clipped[0], clipped[1]], drawing.style.stroke);
	}
}

function drawExtendedLine(drawing: DrawingObject, scales: ChartScales, chartWidth: number, chartHeight: number, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const vector = { x: end.x - start.x, y: end.y - start.y };
	const clipped = clipSegmentToBox(
		{ x: start.x - vector.x * 10_000, y: start.y - vector.y * 10_000 },
		{ x: start.x + vector.x * 10_000, y: start.y + vector.y * 10_000 },
		chartWidth,
		chartHeight,
	);

	if (!clipped) {
		return;
	}

	drawLine(ctx, clipped[0], clipped[1], drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, [clipped[0], clipped[1]], drawing.style.stroke);
	}
}

function drawPolylineTool(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	if (drawing.points.length < 2) {
		return;
	}

	const pixels = drawing.points.map((point) => toPixel(point, scales));
	drawPolyline(ctx, pixels, drawing.style);
	if (isSelected) {
		drawSelectionHandles(ctx, pixels, drawing.style.stroke);
	}
}

function drawDateAndPriceRange(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
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

	ctx.save();
	const fillColor = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : drawing.style.stroke;
	ctx.globalAlpha = drawing.style.fillOpacity ?? drawing.style.opacity ?? 1;
	ctx.fillStyle = fillColor;
	ctx.fillRect(x, y, width, height);
	ctx.restore();
	drawStrokedRect(ctx, { x, y, width, height }, drawing.style);
	drawTextLabel(ctx, badge, { x: x + 8, y: y + 16 }, drawing.style, {
		weight: 700,
		fontSize: drawing.style.fontSize ?? 11,
	});

	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawPositionZones(drawing: DrawingObject, scales: ChartScales, mode: "long" | "short", ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
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
	const tpFill = "rgba(34, 171, 92, 0.18)";
	const slFill = "rgba(215, 50, 75, 0.18)";
	const tpBounds = { x: left, y: Math.min(entryY, targetY), width, height: Math.abs(targetY - entryY) };
	const slBounds = { x: left, y: Math.min(entryY, stopY), width, height: Math.abs(stopY - entryY) };

	drawFilledRect(ctx, tpBounds, tpFill, 1);
	drawFilledRect(ctx, slBounds, slFill, 1);
	drawLine(ctx, { x: left, y: entryY }, { x: right, y: entryY }, drawing.style);
	drawLine(ctx, { x: left, y: targetY }, { x: right, y: targetY }, drawing.style);
	drawLine(ctx, { x: left, y: stopY }, { x: right, y: stopY }, drawing.style);
	drawTextLabel(ctx, badge, { x: right - 4, y: Math.min(entryY, stopY, targetY) - 6 }, drawing.style, {
		align: "right",
		baseline: "alphabetic",
		weight: 700,
		fontSize: drawing.style.fontSize ?? 11,
	});

	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawRectangle(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);
	const fill = drawing.style.fill ?? "transparent";
	const fillAlpha = drawing.style.fillOpacity ?? drawing.style.opacity ?? 1;
	ctx.save();
	ctx.globalAlpha = fillAlpha;
	ctx.fillStyle = fill;
	ctx.fillRect(x, y, width, height);
	ctx.restore();
	drawStrokedRect(ctx, { x, y, width, height }, drawing.style);

	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawArrow(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const length = Math.hypot(dx, dy);
	const headLength = Math.max(8, drawing.style.strokeWidth * 4);
	const headWidth = Math.max(5, drawing.style.strokeWidth * 2);

	drawLine(ctx, start, end, drawing.style);
	if (length > 0) {
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

		ctx.save();
		ctx.globalAlpha = drawing.style.opacity ?? 1;
		ctx.beginPath();
		ctx.moveTo(end.x, end.y);
		ctx.lineTo(left.x, left.y);
		ctx.lineTo(right.x, right.y);
		ctx.closePath();
		ctx.fillStyle = drawing.style.stroke;
		ctx.strokeStyle = drawing.style.stroke;
		ctx.lineWidth = drawing.style.strokeWidth;
		ctx.fill();
		ctx.stroke();
		ctx.restore();
	}

	if (isSelected) {
		drawSelectionHandles(ctx, [start, end], drawing.style.stroke);
	}
}

function drawLongPosition(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	drawPositionZones(drawing, scales, "long", ctx, isSelected);
}

function drawShortPosition(drawing: DrawingObject, scales: ChartScales, ctx: CanvasRenderingContext2D, isSelected: boolean) {
	drawPositionZones(drawing, scales, "short", ctx, isSelected);
}

function drawGannFan(
	drawing: DrawingObject,
	scales: ChartScales,
	chartWidth: number,
	chartHeight: number,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
) {
	const [originPoint, endPoint] = drawing.points;
	if (!originPoint || !endPoint) {
		return;
	}

	const origin = toPixel(originPoint, scales);
	const end = toPixel(endPoint, scales);
	const geometry = calculateGannFanGeometry(origin.x, origin.y, end.x, end.y, chartWidth, chartHeight);

	for (const line of geometry.lines) {
		ctx.save();
		ctx.strokeStyle = drawing.style.stroke;
		ctx.lineWidth = line.isPrincipal ? (drawing.style.strokeWidth + 1) : drawing.style.strokeWidth;
		ctx.lineCap = "round";
		ctx.setLineDash([]);
		ctx.globalAlpha = drawing.style.opacity ?? 1;
		ctx.beginPath();
		ctx.moveTo(line.x1, line.y1);
		ctx.lineTo(line.x2, line.y2);
		ctx.stroke();
		ctx.restore();

		// Label at end of line (clamped within chart)
		const labelX = Math.max(4, Math.min(chartWidth - 30, line.x2 + 4));
		const labelY = Math.max(12, Math.min(chartHeight - 4, line.y2 - 4));
		drawTextLabel(ctx, line.label, { x: labelX, y: labelY }, drawing.style, {
			align: "left",
			baseline: "alphabetic",
			weight: line.isPrincipal ? 700 : 400,
			fontSize: drawing.style.fontSize ?? 10,
		});
	}

	if (isSelected) {
		drawSelectionHandles(ctx, [origin, end], drawing.style.stroke);
	}
}

function drawElliottWave(
	drawing: DrawingObject,
	scales: ChartScales,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
): void {
	const geometry = calculateElliottWaveGeometry(drawing, scales);
	if (!geometry || geometry.pixels.length < 2) {
		return;
	}
	const { pixels, labels } = geometry;
	drawPolyline(ctx, pixels, drawing.style);
	const radius = 9;
	pixels.forEach((pixel, index) => {
		const label = labels[index] ?? "";
		if (!label) {
			return;
		}
		ctx.save();
		ctx.globalAlpha = drawing.style.opacity ?? 1;
		ctx.beginPath();
		ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
		ctx.fillStyle = drawing.style.stroke;
		ctx.fill();
		ctx.font = `bold ${String(drawing.style.fontSize ?? 9)}px ${drawing.style.fontFamily ?? "sans-serif"}`;
		ctx.fillStyle = "#ffffff";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(label, pixel.x, pixel.y);
		ctx.restore();
	});
	if (isSelected) {
		drawSelectionHandles(ctx, pixels, drawing.style.stroke);
	}
}

function drawHarmonicPattern(
	drawing: DrawingObject,
	scales: ChartScales,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
): void {
	const geometry = calculateHarmonicPatternGeometry(drawing, scales);
	if (!geometry || geometry.pixels.length < 2) {
		return;
	}
	const { pixels, labels, hasClosingLine, isHeadAndShoulders } = geometry;

	// Filled polygon
	if (drawing.style.fill && drawing.style.fill !== "none") {
		ctx.save();
		ctx.globalAlpha = drawing.style.fillOpacity ?? 0.1;
		ctx.beginPath();
		pixels.forEach((pt, i) => {
			if (i === 0) {
				ctx.moveTo(pt.x, pt.y);
			} else {
				ctx.lineTo(pt.x, pt.y);
			}
		});
		ctx.closePath();
		ctx.fillStyle = drawing.style.fill;
		ctx.fill();
		ctx.restore();
	}

	// Zigzag polyline (body)
	drawPolyline(ctx, pixels, drawing.style);

	// Closing line (dashed) from first → last point
	if (hasClosingLine && pixels.length >= 2) {
		const first = pixels[0];
		const last = pixels[pixels.length - 1];
		if (first && last) {
			ctx.save();
			ctx.globalAlpha = drawing.style.opacity ?? 1;
			ctx.strokeStyle = drawing.style.stroke;
			ctx.lineWidth = drawing.style.strokeWidth;
			ctx.setLineDash([5, 3]);
			ctx.beginPath();
			ctx.moveTo(first.x, first.y);
			ctx.lineTo(last.x, last.y);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.restore();
		}
	}

	// Head & Shoulders neckline (NL=index5, NR=index6), yellow dashed, extended 20%
	if (isHeadAndShoulders && pixels.length >= 7) {
		const nl = pixels[5];
		const nr = pixels[6];
		if (nl && nr) {
			const dx = nr.x - nl.x;
			const dy = nr.y - nl.y;
			const ext = 0.2;
			ctx.save();
			ctx.globalAlpha = drawing.style.opacity ?? 1;
			ctx.strokeStyle = "#faad14";
			ctx.lineWidth = drawing.style.strokeWidth;
			ctx.setLineDash([6, 3]);
			ctx.beginPath();
			ctx.moveTo(nl.x - dx * ext, nl.y - dy * ext);
			ctx.lineTo(nr.x + dx * ext, nr.y + dy * ext);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.restore();
		}
	}

	// Point labels
	const radius = 7;
	pixels.forEach((pixel, index) => {
		const label = labels[index] ?? "";
		if (!label) {
			return;
		}
		ctx.save();
		ctx.globalAlpha = drawing.style.opacity ?? 1;
		ctx.beginPath();
		ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
		ctx.fillStyle = drawing.style.stroke;
		ctx.fill();
		ctx.font = `bold ${String(drawing.style.fontSize ?? 8)}px ${drawing.style.fontFamily ?? "sans-serif"}`;
		ctx.fillStyle = "#ffffff";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(label, pixel.x, pixel.y);
		ctx.restore();
	});

	if (isSelected) {
		drawSelectionHandles(ctx, pixels, drawing.style.stroke);
	}
}

// ───── DT-13: Extended Fibonacci ────────────────────────────────────────────

function drawFibExtended(
	drawing: DrawingObject,
	scales: ChartScales,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
): void {
	const geo = calculateFibExtendedGeometry(drawing, scales);
	if (!geo) return;
	const { type, p1, p2, p3 } = geo;
	const stroke = drawing.style.stroke;
	const strokeWidth = drawing.style.strokeWidth;

	ctx.save();
	ctx.globalAlpha = drawing.style.opacity ?? 1;
	ctx.strokeStyle = stroke;
	ctx.lineWidth = strokeWidth;
	ctx.fillStyle = stroke;
	ctx.font = `bold 9px sans-serif`;

	const dx = p2.x - p1.x;
	const dy = p2.y - p1.y;
	const baseRadius = Math.sqrt(dx * dx + dy * dy);

	switch (type) {
		case "fibCircles":
		case "fibSpeedResistanceArcs": {
			// Concentric arcs / circles at fib levels × base radius
			const isArcs = type === "fibSpeedResistanceArcs";
			for (const level of FIB_EXTENDED_LEVELS) {
				const r = baseRadius * level;
				ctx.beginPath();
				if (isArcs) {
					ctx.arc(p1.x, p1.y, r, Math.PI, 2 * Math.PI); // top semi-circle
				} else {
					ctx.arc(p1.x, p1.y, r, 0, 2 * Math.PI);
				}
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.7;
				ctx.stroke();
				// label
				ctx.globalAlpha = drawing.style.opacity ?? 1;
				ctx.fillText(String(level), p1.x + r * 0.707, p1.y - r * 0.707);
			}
			// Center dot
			ctx.beginPath();
			ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
			ctx.fill();
			break;
		}

		case "fibSpiral": {
			// Golden ratio spiral: r = r0 * φ^(θ / (π/2))
			const PHI = 1.6180339887;
			const r0 = 1;
			const turns = 4 * Math.PI;
			const steps = 200;
			const angle0 = Math.atan2(dy, dx);
			ctx.beginPath();
			for (let i = 0; i <= steps; i++) {
				const theta = (i / steps) * turns;
				const r = r0 * Math.pow(PHI, theta / (Math.PI / 2));
				const x = p1.x + r * Math.cos(theta + angle0);
				const y = p1.y + r * Math.sin(theta + angle0);
				if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
			}
			ctx.stroke();
			break;
		}

		case "fibSpeedResistanceFan": {
			// Fan lines from p1 to p2 at FIB_FAN_RATIOS
			const canvasHeight = p1.y; // base at p1 y
			for (const ratio of FIB_FAN_RATIOS) {
				const targetY = p1.y - (p1.y - p2.y) * ratio;
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(p2.x, targetY);
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * (ratio === 0.618 ? 1 : 0.7);
				ctx.stroke();
				ctx.globalAlpha = drawing.style.opacity ?? 1;
				ctx.fillText(String(ratio), p2.x + 4, targetY);
			}
			break;
		}

		case "fibChannel": {
			// Fib retracement channel — p3 is the offset point
			const channelDy = p2.y - p1.y;
			const offsetY = p3 ? (p3.y - p1.y) : channelDy;
			for (const level of FIB_EXTENDED_LEVELS.slice(0, 7)) {
				const lineY1 = p1.y + offsetY * level;
				const lineY2 = p2.y + offsetY * level;
				ctx.beginPath();
				ctx.moveTo(p1.x, lineY1);
				ctx.lineTo(p2.x, lineY2);
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * (level === 0.618 ? 1 : 0.6);
				ctx.stroke();
				ctx.globalAlpha = drawing.style.opacity ?? 1;
				ctx.fillText(String(level), p2.x + 4, lineY2);
			}
			break;
		}

		case "trendBasedFibTime": {
			// Vertical lines at fib time intervals from p1→p2, then p2 + n*(p2-p1)
			const period = p2.x - p1.x;
			const FIBS = [0, 1, 1, 2, 3, 5, 8, 13, 21];
			const canvasH = 2000; // approximate
			for (const n of FIBS) {
				const vx = p1.x + period * n;
				ctx.beginPath();
				ctx.moveTo(vx, 0);
				ctx.lineTo(vx, canvasH);
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.6;
				ctx.stroke();
				ctx.globalAlpha = drawing.style.opacity ?? 1;
				ctx.fillText(String(n), vx + 3, p1.y - 8);
			}
			break;
		}

		case "fibWedge": {
			// Two converging trend lines meeting at p3 (apex-like)
			const apex = p3 ?? p2;
			ctx.beginPath();
			ctx.moveTo(p1.x, p1.y);
			ctx.lineTo(apex.x, apex.y);
			ctx.stroke();
			ctx.beginPath();
			ctx.moveTo(p2.x, p2.y);
			ctx.lineTo(apex.x, apex.y);
			ctx.stroke();
			// Fib retracement lines between p1 and p2 at apex
			for (const level of [0.382, 0.5, 0.618]) {
				const lx = p1.x + (p2.x - p1.x) * level;
				const ly = p1.y + (p2.y - p1.y) * level;
				ctx.beginPath();
				ctx.setLineDash([4, 3]);
				ctx.moveTo(lx, ly);
				ctx.lineTo(apex.x, apex.y);
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.5;
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.globalAlpha = drawing.style.opacity ?? 1;
			}
			break;
		}

		case "pitchfan": {
			// 3 pivot points: A·B·C — fan lines from A through midpoints of B-C at fib ratios
			const midX = p3 ? (p2.x + p3.x) / 2 : p2.x;
			const midY = p3 ? (p2.y + p3.y) / 2 : p2.y;
			for (const ratio of FIB_FAN_RATIOS) {
				const tx = p3 ? p2.x + (p3.x - p2.x) * ratio : p2.x;
				const ty = p3 ? p2.y + (p3.y - p2.y) * ratio : p2.y;
				const extX = p1.x + (tx - p1.x) * 3;
				const extY = p1.y + (ty - p1.y) * 3;
				ctx.beginPath();
				ctx.moveTo(p1.x, p1.y);
				ctx.lineTo(extX, extY);
				ctx.globalAlpha = (drawing.style.opacity ?? 1) * (ratio === 0.5 ? 1 : 0.65);
				ctx.stroke();
				ctx.globalAlpha = drawing.style.opacity ?? 1;
				ctx.fillText(String(ratio), extX - 20, extY);
			}
			// Draw connecting line p2→p3
			if (p3) {
				ctx.beginPath();
				ctx.setLineDash([4, 3]);
				ctx.moveTo(p2.x, p2.y);
				ctx.lineTo(p3.x, p3.y);
				ctx.stroke();
				ctx.setLineDash([]);
			}
			break;
		}

		default:
			break;
	}

	if (isSelected) {
		const handles = [p1, p2];
		if (p3) handles.push(p3);
		drawSelectionHandles(ctx, handles, stroke);
	}

	ctx.restore();
}

// ───── DT-14: Gann Advanced ──────────────────────────────────────────────────

function drawGannAdvanced(
	drawing: DrawingObject,
	scales: ChartScales,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
): void {
	const geo = calculateGannAdvancedGeometry(drawing, scales);
	if (!geo) return;
	const { x1, y1, x2, y2 } = geo;
	const w = x2 - x1;
	const h = y2 - y1;
	const stroke = drawing.style.stroke;

	ctx.save();
	ctx.globalAlpha = drawing.style.opacity ?? 1;

	// Outer rect
	ctx.strokeStyle = stroke;
	ctx.lineWidth = drawing.style.strokeWidth;
	ctx.strokeRect(x1, y1, w, h);

	// Grid lines at 1/8 fractions (opacity 0.4)
	ctx.lineWidth = 1;
	for (const frac of GANN_FRACTIONS) {
		// Horizontal
		const gy = y1 + h * frac;
		ctx.beginPath();
		ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.4;
		ctx.strokeStyle = stroke;
		ctx.moveTo(x1, gy);
		ctx.lineTo(x2, gy);
		ctx.stroke();
		// Vertical
		const gx = x1 + w * frac;
		ctx.beginPath();
		ctx.moveTo(gx, y1);
		ctx.lineTo(gx, y2);
		ctx.stroke();
	}

	// 1×1 diagonal — red
	ctx.globalAlpha = drawing.style.opacity ?? 1;
	ctx.strokeStyle = "#ff4d4f";
	ctx.lineWidth = drawing.style.strokeWidth;
	ctx.beginPath();
	ctx.moveTo(x1, y1);
	ctx.lineTo(x2, y2);
	ctx.stroke();

	// Other diagonals (muted)
	ctx.strokeStyle = stroke;
	ctx.lineWidth = 1;
	ctx.globalAlpha = (drawing.style.opacity ?? 1) * 0.4;
	ctx.beginPath();
	ctx.moveTo(x1, y2);
	ctx.lineTo(x2, y1);
	ctx.stroke();

	if (isSelected) {
		ctx.globalAlpha = drawing.style.opacity ?? 1;
		drawSelectionHandles(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], stroke);
	}

	ctx.restore();
}

// ───── DT-15: Cycle Tools ─────────────────────────────────────────────────────

function drawCycleTools(
	drawing: DrawingObject,
	scales: ChartScales,
	ctx: CanvasRenderingContext2D,
	isSelected: boolean,
): void {
	const geo = calculateCycleGeometry(drawing, scales);
	if (!geo) return;
	const { type, x1, y1, x2, y2, count, amplitude } = geo;
	const stroke = drawing.style.stroke;
	const opacity = drawing.style.opacity ?? 1;

	ctx.save();
	ctx.strokeStyle = stroke;
	ctx.lineWidth = drawing.style.strokeWidth;

	if (type === "cyclicLines") {
		const dx = (x2 - x1) / count;
		for (let i = 0; i <= count; i++) {
			ctx.globalAlpha = opacity * (i % 2 === 0 ? 0.8 : 0.4);
			const gx = x1 + i * dx;
			ctx.beginPath();
			ctx.moveTo(gx, Math.min(y1, y2) - 20);
			ctx.lineTo(gx, Math.max(y1, y2) + 20);
			ctx.stroke();
		}
	} else if (type === "timeCycles") {
		ctx.globalAlpha = opacity;
		const dx = (x2 - x1) / count;
		const radius = Math.abs(dx) / 2;
		for (let i = 0; i < count; i++) {
			const cx = x1 + (i + 0.5) * dx;
			ctx.beginPath();
			ctx.arc(cx, y1, Math.abs(radius), 0, Math.PI, false);
			ctx.stroke();
		}
	} else if (type === "sineLine") {
		ctx.globalAlpha = opacity;
		const totalWidth = x2 - x1;
		const halfPeriod = totalWidth / count;
		ctx.beginPath();
		const steps = Math.max(200, Math.abs(totalWidth) * 2);
		for (let i = 0; i <= steps; i++) {
			const px = x1 + (i / steps) * totalWidth;
			const py = y1 - amplitude * Math.sin(Math.PI * (px - x1) / halfPeriod);
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.stroke();
	}

	if (isSelected) {
		ctx.globalAlpha = opacity;
		drawSelectionHandles(ctx, [{ x: x1, y: y1 }, { x: x2, y: y2 }], stroke);
	}

	ctx.restore();
}

export function renderDrawingToCanvas(
	ctx: CanvasRenderingContext2D,
	drawing: DrawingObject,
	scales: ChartScales,
	options: RenderCanvasOptions,
): void {
	if (drawing.visible === false) {
		return;
	}

	renderDrawingShape(ctx, drawing, scales, options);

	// DT-10-T07: render 🔔 badge if alert is active
	if (drawing.alertCondition?.enabled) {
		renderDrawingAlertIcon(ctx, drawing, scales, options.chartWidth, options.chartHeight);
	}
}

function renderDrawingShape(
	ctx: CanvasRenderingContext2D,
	drawing: DrawingObject,
	scales: ChartScales,
	options: RenderCanvasOptions,
): void {
	const effectiveDrawing = {
		...drawing,
		style: resolveDrawingStyle(drawing),
	};

	switch (effectiveDrawing.type as string) {
		case "trendLine":
			renderOverlayPrimitiveToCanvas(ctx, {
				type: "trendLine",
				points: effectiveDrawing.points.slice(0, 2).map((point) => toPixel(point, scales)),
				style: toPrimitiveStyle(effectiveDrawing.style),
			}, options);
			return;
		case "hLine":
			if (effectiveDrawing.points[0]) {
				renderOverlayPrimitiveToCanvas(ctx, {
					type: "hLine",
					points: [toPixel(effectiveDrawing.points[0], scales)],
					style: toPrimitiveStyle(effectiveDrawing.style),
				}, options);
			}
			return;
		case "vLine":
			if (effectiveDrawing.points[0]) {
				renderOverlayPrimitiveToCanvas(ctx, {
					type: "vLine",
					points: [toPixel(effectiveDrawing.points[0], scales)],
					style: toPrimitiveStyle(effectiveDrawing.style),
				}, options);
			}
			return;
		case "fibonacci":
			drawFibonacci(effectiveDrawing, scales, options.chartWidth, ctx, options.isSelected);
			return;
		case "channel":
			drawChannel(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "text":
			if (effectiveDrawing.points[0]) {
				renderOverlayPrimitiveToCanvas(ctx, {
					type: "text",
					points: [toPixel(effectiveDrawing.points[0], scales)],
					style: toPrimitiveStyle(effectiveDrawing.style),
					text: effectiveDrawing.text,
				}, options);
			}
			return;
		case "rectangle":
			renderOverlayPrimitiveToCanvas(ctx, {
				type: "rectangle",
				points: effectiveDrawing.points.slice(0, 2).map((point) => toPixel(point, scales)),
				style: toPrimitiveStyle(effectiveDrawing.style),
			}, options);
			return;
		case "arrow":
			renderOverlayPrimitiveToCanvas(ctx, {
				type: "arrow",
				points: effectiveDrawing.points.slice(0, 2).map((point) => toPixel(point, scales)),
				style: toPrimitiveStyle(effectiveDrawing.style),
			}, options);
			return;
		case "ray":
			drawRay(effectiveDrawing, scales, options.chartWidth, options.chartHeight, ctx, options.isSelected);
			return;
		case "extendedLine":
			drawExtendedLine(effectiveDrawing, scales, options.chartWidth, options.chartHeight, ctx, options.isSelected);
			return;
		case "polyline":
			drawPolylineTool(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "dateAndPriceRange":
			drawDateAndPriceRange(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "longPosition":
			drawLongPosition(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "shortPosition":
			drawShortPosition(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "fibExtension": {
			const [startPoint, endPoint] = effectiveDrawing.points;
			if (!startPoint || !endPoint) {
				return;
			}

			const start = toPixel(startPoint, scales);
			const end = toPixel(endPoint, scales);
			const priceDelta = endPoint.y - startPoint.y;

			if (effectiveDrawing.fibLevelConfigs && effectiveDrawing.fibLevelConfigs.length > 0) {
				// DT-7: per-level config
				effectiveDrawing.fibLevelConfigs.forEach((cfg) => {
					if (!cfg.visible) return;
					const extensionPrice = endPoint.y + priceDelta * cfg.ratio;
					const y = toPixel({ x: endPoint.x, y: extensionPrice }, scales).y;
					const levelStyle = cfg.color ? { ...effectiveDrawing.style, stroke: cfg.color } : effectiveDrawing.style;
					drawLine(ctx, { x: 0, y }, { x: options.chartWidth, y }, levelStyle);
					drawTextLabel(ctx, `${(cfg.ratio * 100).toFixed(1)}% — ${numberFormatter(extensionPrice)}`, { x: options.chartWidth - 6, y: y - 4 }, levelStyle, {
						align: "right",
						baseline: "alphabetic",
						fontSize: effectiveDrawing.style.fontSize ?? 11,
					});
				});
			} else {
				// Legacy
				const levels = effectiveDrawing.fibLevels ?? DEFAULT_FIB_EXTENSION_LEVELS;
				levels.forEach((level) => {
					const extensionPrice = endPoint.y + priceDelta * level;
					const y = toPixel({ x: endPoint.x, y: extensionPrice }, scales).y;
					drawLine(ctx, { x: 0, y }, { x: options.chartWidth, y }, effectiveDrawing.style);
					drawTextLabel(ctx, `${(level * 100).toFixed(1)}% — ${numberFormatter(extensionPrice)}`, { x: options.chartWidth - 6, y: y - 4 }, effectiveDrawing.style, {
						align: "right",
						baseline: "alphabetic",
						fontSize: effectiveDrawing.style.fontSize ?? 11,
					});
				});
			}

			if (options.isSelected) {
				drawSelectionHandles(ctx, [start, end], effectiveDrawing.style.stroke);
			}
			return;
		}
		case "parallelChannel":
			drawParallelChannel(effectiveDrawing, scales, options.chartWidth, options.chartHeight, ctx, options.isSelected);
			return;
		case "pitchfork":
			drawPitchfork(effectiveDrawing, scales, options.chartWidth, options.chartHeight, ctx, options.isSelected);
			return;
		case "abcdPattern":
			drawAbcdPattern(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "fibArc":
			drawFibArc(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "fibTimeZone":
			drawFibTimeZone(effectiveDrawing, scales, options.chartWidth, ctx, options.isSelected);
			return;
		case "regressionChannel":
			drawRegressionChannel(effectiveDrawing, scales, options, ctx, options.isSelected);
			return;
		case "gannFan":
			drawGannFan(effectiveDrawing, scales, options.chartWidth, options.chartHeight, ctx, options.isSelected);
			return;
		case "elliottImpulse":
		case "elliottCorrection":
		case "elliottTriangle":
		case "elliottDoubleCombo":
		case "elliottTripleCombo":
			drawElliottWave(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "xabcdPattern":
		case "cypherPattern":
		case "headAndShoulders":
		case "trianglePattern":
		case "threeDrivesPattern":
			drawHarmonicPattern(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "fibChannel":
		case "fibSpeedResistanceFan":
		case "trendBasedFibTime":
		case "fibCircles":
		case "fibSpiral":
		case "fibSpeedResistanceArcs":
		case "fibWedge":
		case "pitchfan":
			drawFibExtended(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "gannBox":
		case "gannSquareFixed":
		case "gannSquare":
			drawGannAdvanced(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		case "cyclicLines":
		case "timeCycles":
		case "sineLine":
			drawCycleTools(effectiveDrawing, scales, ctx, options.isSelected);
			return;
		default:
			return;
	}

	// DT-10-T07: After rendering, draw alert icon if condition is active
	if (drawing.alertCondition?.enabled) {
		renderDrawingAlertIcon(ctx, drawing, scales, options.chartWidth, options.chartHeight);
	}
}

// ─── CE21-DT1: Action handles (delete / clone / lock) ─────────────────────────

/**
 * Compute the bounding box of a drawing's anchor points in pixel space.
 * hLine / vLine are treated as spanning the full chart dimension.
 * (Mirrors getDrawingBoundingBox in hitTest.ts — kept local to avoid circular dep.)
 */
function computeBoundingBox(
	drawing: DrawingObject,
	scales: ChartScales,
	chartWidth: number,
	chartHeight: number,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
	if (drawing.points.length === 0) {
		return null;
	}

	if (drawing.type === "hLine" && drawing.points[0]) {
		const p = toPixel(drawing.points[0], scales);
		return { minX: 0, maxX: chartWidth, minY: p.y, maxY: p.y };
	}

	if (drawing.type === "vLine" && drawing.points[0]) {
		const p = toPixel(drawing.points[0], scales);
		return { minX: p.x, maxX: p.x, minY: 0, maxY: chartHeight };
	}

	const pixels = drawing.points.map((pt) => toPixel(pt, scales));
	const xs = pixels.map((p) => p.x);
	const ys = pixels.map((p) => p.y);
	return {
		minX: Math.min(...xs),
		maxX: Math.max(...xs),
		minY: Math.min(...ys),
		maxY: Math.max(...ys),
	};
}

/**
 * Render the three action handles for a selected drawing onto the canvas.
 *   delete → red circle with × , top-right corner + (14, −14)
 *   clone  → blue circle with +, top-right corner + (32, −14)
 *   lock   → yellow (locked) / gray (unlocked) circle with indicator, top-left + (−14, −14)
 */
export function renderDrawingActionHandles(
	ctx: CanvasRenderingContext2D,
	drawing: DrawingObject,
	scales: ChartScales,
	chartWidth = 1000,
	chartHeight = 600,
): void {
	const bbox = computeBoundingBox(drawing, scales, chartWidth, chartHeight);
	if (!bbox) {
		return;
	}

	const handles = [
		{ x: bbox.maxX + 14, y: bbox.minY - 14, fill: "#ff4d4f", icon: "\u00d7" }, // delete
		{ x: bbox.maxX + 32, y: bbox.minY - 14, fill: "#1677ff", icon: "+"      }, // clone
		{
			x: bbox.minX - 14,
			y: bbox.minY - 14,
			fill: drawing.locked ? "#faad14" : "#8c8c8c",
			icon: drawing.locked ? "\u25a0" : "\u25a1", // ■ locked / □ unlocked
		},
	] as const;

	ctx.save();
	ctx.globalAlpha = 1;
	ctx.setLineDash([]);

	for (const handle of handles) {
		const r = 8;
		ctx.beginPath();
		ctx.arc(handle.x, handle.y, r, 0, Math.PI * 2);
		ctx.fillStyle = handle.fill;
		ctx.fill();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 1.5;
		ctx.stroke();

		ctx.fillStyle = "#ffffff";
		ctx.font = "bold 10px sans-serif";
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText(handle.icon, handle.x, handle.y);
	}

	ctx.restore();
}

/**
 * DT-10-T07: Render a 🔔 bell badge on drawings that have an active alert condition.
 * Drawn at top-right of the drawing's bounding box.
 */
export function renderDrawingAlertIcon(
	ctx: CanvasRenderingContext2D,
	drawing: DrawingObject,
	scales: ChartScales,
	chartWidth = 1000,
	chartHeight = 600,
): void {
	if (!drawing.alertCondition?.enabled) return;
	const bbox = computeBoundingBox(drawing, scales, chartWidth, chartHeight);
	if (!bbox) return;

	const x = bbox.maxX - 2;
	const y = bbox.minY + 2;
	ctx.save();
	ctx.font = "11px sans-serif";
	ctx.textAlign = "right";
	ctx.textBaseline = "top";
	ctx.globalAlpha = 0.9;
	ctx.fillText("\uD83D\uDD14", x, y);
	ctx.restore();
}

/**
 * Renders the rubber-band selection rectangle.
 * Coordinates are in chart-local pixel space (matching moreProps.mouseXY).
 */
export function renderRubberBand(
	ctx: CanvasRenderingContext2D,
	startX: number,
	startY: number,
	currentX: number,
	currentY: number,
): void {
	const x = Math.min(startX, currentX);
	const y = Math.min(startY, currentY);
	const w = Math.abs(currentX - startX);
	const h = Math.abs(currentY - startY);
	if (w < 2 && h < 2) {
		return;
	}
	ctx.save();
	ctx.globalAlpha = 0.12;
	ctx.fillStyle = "#1677ff";
	ctx.fillRect(x, y, w, h);
	ctx.globalAlpha = 1;
	ctx.strokeStyle = "#1677ff";
	ctx.lineWidth = 1;
	ctx.setLineDash([4, 3]);
	ctx.strokeRect(x, y, w, h);
	ctx.setLineDash([]);
	ctx.restore();
}

// ─── DT-6: Live Measurement Overlay ──────────────────────────────────────────

export interface MeasurementLabelOptions {
	/** Formatted price delta string, e.g. "+1.23" */
	priceDeltaText: string;
	/** Formatted percentage string, e.g. "+2.50%" */
	pctText: string;
	/** Formatted bar count string, e.g. "5 nến" */
	barsText: string;
	/** Chart pixel width (for right-edge clamping) */
	chartWidth: number;
	/** Chart pixel height (for bottom-edge clamping) */
	chartHeight: number;
}

/**
 * Render a live measurement tooltip near (px, py).
 * The label is clamped to stay inside the chart viewport.
 */
export function renderMeasurementLabel(
	ctx: CanvasRenderingContext2D,
	px: number,
	py: number,
	opts: MeasurementLabelOptions,
): void {
	const PADDING = 6;
	const LINE_HEIGHT = 16;
	const FONT = "12px sans-serif";
	const lines = [opts.priceDeltaText, opts.pctText, opts.barsText];

	ctx.save();
	ctx.font = FONT;

	const maxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width));
	const boxW = maxWidth + PADDING * 2;
	const boxH = lines.length * LINE_HEIGHT + PADDING * 2;

	// Default: just above and to the right of cursor
	let bx = px + 10;
	let by = py - boxH - 6;

	// Clamp right edge
	if (bx + boxW > opts.chartWidth - 4) {
		bx = px - boxW - 10;
	}
	// Clamp bottom edge
	if (by + boxH > opts.chartHeight - 4) {
		by = opts.chartHeight - boxH - 4;
	}
	// Clamp top
	if (by < 4) {
		by = 4;
	}
	// Clamp left
	if (bx < 4) {
		bx = 4;
	}

	// Background
	ctx.globalAlpha = 0.88;
	ctx.fillStyle = "#1a1a2e";
	ctx.beginPath();
	ctx.roundRect(bx, by, boxW, boxH, 4);
	ctx.fill();
	ctx.globalAlpha = 1;

	// Text
	ctx.fillStyle = "#ffffff";
	ctx.textBaseline = "top";
	lines.forEach((line, i) => {
		ctx.fillText(line, bx + PADDING, by + PADDING + i * LINE_HEIGHT);
	});

	ctx.restore();
}