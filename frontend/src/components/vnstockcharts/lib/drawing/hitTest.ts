import { chartPointToPixel, type ChartScales, type PlotDatum } from "./coordinateUtils";
import { resolveDrawingStyle } from "./drawingStyleRegistry";
import type { DrawingHandleType, DrawingObject, DrawingToolType } from "./types";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel";
import { calculatePitchforkGeometry } from "./builtin/pitchfork";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern";
import { calculateFibArcGeometry } from "./builtin/fibArc";
import { calculateFibTimeZoneGeometry } from "./builtin/fibTimeZone";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel";
import { calculateGannFanGeometry } from "./builtin/gannFan";
import { clipSegmentToBox, DEFAULT_FIB_EXTENSION_LEVELS, DEFAULT_FIB_LEVELS } from "./renderCanvas";
// OverlayCanvasPrimitive — định nghĩa local vì export đã bị xóa khỏi vn-kline-engine-core
export type OverlayCanvasPrimitive = {
	type: "trendLine" | "arrow" | "hLine" | "vLine" | "rectangle" | "dateAndPriceRange" | "text";
	points: Array<{ x: number; y: number }>;
	text?: string;
	style: {
		stroke?: string;
		strokeWidth?: number;
		strokeDasharray?: "solid" | "dashed" | "dotted" | readonly number[];
		fill?: string;
		fillOpacity?: number;
		opacity?: number;
		fontSize?: number;
		fontFamily?: string;
	};
};

function hitTestOverlayPrimitive(
	primitive: OverlayCanvasPrimitive,
	mouseX: number,
	mouseY: number,
	options: { chartWidth: number; chartHeight: number; tolerance: number },
): boolean {
	const { tolerance, chartWidth, chartHeight } = options;
	const pts = primitive.points;
	switch (primitive.type) {
		case "trendLine":
		case "arrow": {
			const [a, b] = pts;
			if (!a || !b) return false;
			return distanceToSegment(mouseX, mouseY, a.x, a.y, b.x, b.y) <= tolerance;
		}
		case "hLine": {
			const [p] = pts;
			if (!p) return false;
			return Math.abs(mouseY - p.y) <= tolerance;
		}
		case "vLine": {
			const [p] = pts;
			if (!p) return false;
			return Math.abs(mouseX - p.x) <= tolerance;
		}
		case "rectangle":
		case "dateAndPriceRange": {
			const [start, end] = pts;
			if (!start || !end) return false;
			const x = Math.min(start.x, end.x);
			const y = Math.min(start.y, end.y);
			const w = Math.abs(end.x - start.x);
			const h = Math.abs(end.y - start.y);
			return pointInRect(mouseX, mouseY, x - tolerance, y - tolerance, w + tolerance * 2, h + tolerance * 2);
		}
		case "text": {
			const [p] = pts;
			if (!p) return false;
			const fontSize = primitive.style.fontSize ?? 12;
			const len = (primitive.text?.length ?? 4) * fontSize * 0.6;
			return pointInRect(mouseX, mouseY, p.x - tolerance, p.y - fontSize - tolerance, len + tolerance * 2, fontSize + tolerance * 2);
		}
		default:
			return false;
	}
}

// CE21: device-aware hit tolerance. Touch targets need ~3× the tolerance of mouse.
export type PointerDeviceType = "mouse" | "touch" | "pen";
export const HIT_TOLERANCE: Record<PointerDeviceType, number> = {
	mouse: 6,
	touch: 16,
	pen: 8,
};

function toPixel(point: DrawingObject["points"][number], scales: ChartScales) {
	return chartPointToPixel(point, scales);
}

function toOverlayPrimitive(drawing: DrawingObject, scales: ChartScales): OverlayCanvasPrimitive | null {
	const style = drawing.style;
	const primitiveStyle = {
		stroke: style.stroke,
		strokeWidth: style.strokeWidth,
		strokeDasharray: style.strokeDasharray,
		fill: style.fill,
		fillOpacity: style.fillOpacity,
		opacity: style.opacity,
		fontSize: style.fontSize,
		fontFamily: style.fontFamily,
	} satisfies OverlayCanvasPrimitive["style"];

	switch (drawing.type) {
		case "trendLine":
		case "arrow": {
			const [startPoint, endPoint] = drawing.points;
			if (!startPoint || !endPoint) {
				return null;
			}

			return {
				type: drawing.type,
				points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
				style: primitiveStyle,
			};
		}
		case "hLine": {
			const [point] = drawing.points;
			if (!point) {
				return null;
			}

			return {
				type: "hLine",
				points: [toPixel(point, scales)],
				style: primitiveStyle,
			};
		}
		case "vLine": {
			const [point] = drawing.points;
			if (!point) {
				return null;
			}

			return {
				type: "vLine",
				points: [toPixel(point, scales)],
				style: primitiveStyle,
			};
		}
		case "rectangle":
		case "dateAndPriceRange": {
			const [startPoint, endPoint] = drawing.points;
			if (!startPoint || !endPoint) {
				return null;
			}

			return {
				type: "rectangle",
				points: [toPixel(startPoint, scales), toPixel(endPoint, scales)],
				style: primitiveStyle,
			};
		}
		case "text": {
			const [point] = drawing.points;
			if (!point) {
				return null;
			}

			return {
				type: "text",
				points: [toPixel(point, scales)],
				style: primitiveStyle,
				text: drawing.text,
			};
		}
		default:
			return null;
	}
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const lengthSquared = dx * dx + dy * dy;
	if (lengthSquared === 0) {
		return Math.hypot(px - x1, py - y1);
	}

	const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number) {
	return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

function distanceToPolyline(points: Array<{ x: number; y: number }>, px: number, py: number) {
	if (points.length < 2) {
		return Number.POSITIVE_INFINITY;
	}

	let best = Number.POSITIVE_INFINITY;
	for (let index = 1; index < points.length; index += 1) {
		best = Math.min(best, distanceToSegment(px, py, points[index - 1].x, points[index - 1].y, points[index].x, points[index].y));
	}
	return best;
}

function pathBounds(points: Array<{ x: number; y: number }>) {
	const xs = points.map((point) => point.x);
	const ys = points.map((point) => point.y);
	const minX = Math.min(...xs);
	const maxX = Math.max(...xs);
	const minY = Math.min(...ys);
	const maxY = Math.max(...ys);
	return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function getTextBounds(drawing: DrawingObject, scales: ChartScales) {
	const point = drawing.points[0];
	if (!point) {
		return null;
	}

	const pixel = toPixel(point, scales);
	const fontSize = drawing.style.fontSize ?? 12;
	const text = drawing.text?.trim().length ? drawing.text : "Text";
	const width = Math.max(fontSize, text.length * fontSize * 0.6);
	return {
		x: pixel.x - width * 0.1,
		y: pixel.y - fontSize * 0.5,
		width,
		height: fontSize,
	};
}

function hitTestLineLike(
	drawing: DrawingObject,
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	chartWidth: number,
	chartHeight: number,
	tolerance: number,
) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return false;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	return distanceToSegment(mouseX, mouseY, start.x, start.y, end.x, end.y) <= tolerance;
}

function hitTestRayLike(
	drawing: DrawingObject,
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	chartWidth: number,
	chartHeight: number,
	tolerance: number,
	multiplier: number,
	forwardOnly: boolean,
) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return false;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const clipped = forwardOnly
		? clipSegmentToBox(
			start,
			{ x: start.x + (end.x - start.x) * multiplier, y: start.y + (end.y - start.y) * multiplier },
			chartWidth,
			chartHeight,
		)
		: clipSegmentToBox(
			{ x: start.x - (end.x - start.x) * multiplier, y: start.y - (end.y - start.y) * multiplier },
			{ x: start.x + (end.x - start.x) * multiplier, y: start.y + (end.y - start.y) * multiplier },
			chartWidth,
			chartHeight,
		);
	if (!clipped) {
		return false;
	}

	return distanceToSegment(mouseX, mouseY, clipped[0].x, clipped[0].y, clipped[1].x, clipped[1].y) <= tolerance;
}

function hitTestRectangleLike(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return false;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);
	if (pointInRect(mouseX, mouseY, x - tolerance, y - tolerance, width + tolerance * 2, height + tolerance * 2)) {
		return true;
	}

	return distanceToSegment(mouseX, mouseY, x, y, x + width, y) <= tolerance
		|| distanceToSegment(mouseX, mouseY, x + width, y, x + width, y + height) <= tolerance
		|| distanceToSegment(mouseX, mouseY, x + width, y + height, x, y + height) <= tolerance
		|| distanceToSegment(mouseX, mouseY, x, y + height, x, y) <= tolerance;
}

function hitTestFibonacciLike(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number, levels: number[]) {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return false;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const priceDelta = endPoint.y - startPoint.y;
	const pixelDelta = end.y - start.y;
	return levels.some((level) => {
		const y = start.y + pixelDelta * level;
		return Math.abs(mouseY - y) <= tolerance;
	});
}

function hitTestChannelLike(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number) {
	const [startPoint, endPoint, offsetPoint] = drawing.points;
	if (!startPoint || !endPoint || !offsetPoint) {
		return false;
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
	return distanceToSegment(mouseX, mouseY, start.x, start.y, end.x, end.y) <= tolerance
		|| distanceToSegment(mouseX, mouseY, offsetStart.x, offsetStart.y, offsetEnd.x, offsetEnd.y) <= tolerance;
}

function hitTestParallelChannel(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, chartWidth: number, chartHeight: number, tolerance: number) {
	const geometry = calculateParallelChannelGeometry(drawing, scales);
	if (!geometry) {
		return false;
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

	return [upper, middle, lower].some((segment) => segment != null && distanceToSegment(mouseX, mouseY, segment[0].x, segment[0].y, segment[1].x, segment[1].y) <= tolerance);
}

function hitTestPitchfork(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, chartWidth: number, chartHeight: number, tolerance: number) {
	const geometry = calculatePitchforkGeometry(drawing, scales);
	if (!geometry || (geometry.direction.x === 0 && geometry.direction.y === 0)) {
		return false;
	}

	const median = clipSegmentToBox(
		{ x: geometry.pivot.x - geometry.direction.x * 10_000, y: geometry.pivot.y - geometry.direction.y * 10_000 },
		{ x: geometry.pivot.x + geometry.direction.x * 10_000, y: geometry.pivot.y + geometry.direction.y * 10_000 },
		chartWidth,
		chartHeight,
	);
	const leftFork = clipSegmentToBox(
		{ x: geometry.leftSwing.x - geometry.direction.x * 10_000, y: geometry.leftSwing.y - geometry.direction.y * 10_000 },
		{ x: geometry.leftSwing.x + geometry.direction.x * 10_000, y: geometry.leftSwing.y + geometry.direction.y * 10_000 },
		chartWidth,
		chartHeight,
	);
	const rightFork = clipSegmentToBox(
		{ x: geometry.rightSwing.x - geometry.direction.x * 10_000, y: geometry.rightSwing.y - geometry.direction.y * 10_000 },
		{ x: geometry.rightSwing.x + geometry.direction.x * 10_000, y: geometry.rightSwing.y + geometry.direction.y * 10_000 },
		chartWidth,
		chartHeight,
	);

	return [median, leftFork, rightFork].some((segment) => segment != null && distanceToSegment(mouseX, mouseY, segment[0].x, segment[0].y, segment[1].x, segment[1].y) <= tolerance);
}

function hitTestAbcdPattern(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number) {
	const metrics = calculateAbcdPatternMetrics(drawing, scales);
	if (!metrics) {
		return false;
	}

	const [a, b, c, d] = metrics.points;
	return distanceToSegment(mouseX, mouseY, a.x, a.y, b.x, b.y) <= tolerance
		|| distanceToSegment(mouseX, mouseY, b.x, b.y, c.x, c.y) <= tolerance
		|| distanceToSegment(mouseX, mouseY, c.x, c.y, d.x, d.y) <= tolerance;
}

function hitTestFibArc(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number) {
	const geometry = calculateFibArcGeometry(drawing, scales);
	if (!geometry) {
		return false;
	}

	const distanceFromCenter = Math.hypot(mouseX - geometry.center.x, mouseY - geometry.center.y);
	return geometry.radii.some((radius) => Math.abs(distanceFromCenter - radius) <= tolerance);
}

function hitTestFibTimeZone(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number) {
	const geometry = calculateFibTimeZoneGeometry(drawing, scales);
	if (!geometry) {
		return false;
	}

	return geometry.positions.some((x) => Math.abs(mouseX - x) <= tolerance);
}

function hitTestRegressionChannel(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, plotData: PlotDatum[] | undefined, tolerance: number) {
	const metrics = calculateRegressionChannelMetrics(drawing, scales, plotData ?? []);
	if (!metrics) {
		return false;
	}

	const x1 = Math.min(metrics.startX, metrics.endX) - tolerance;
	const x2 = Math.max(metrics.startX, metrics.endX) + tolerance;
	const y1 = Math.min(metrics.upperStartY, metrics.upperEndY, metrics.lowerStartY, metrics.lowerEndY) - tolerance;
	const y2 = Math.max(metrics.upperStartY, metrics.upperEndY, metrics.lowerStartY, metrics.lowerEndY) + tolerance;
	return pointInRect(mouseX, mouseY, x1, y1, x2 - x1, y2 - y1);
}

function hitTestPositionZones(drawing: DrawingObject, mouseX: number, mouseY: number, scales: ChartScales, tolerance: number, mode: "long" | "short") {
	const [startPoint, endPoint] = drawing.points;
	if (!startPoint || !endPoint) {
		return false;
	}

	const start = toPixel(startPoint, scales);
	const end = toPixel(endPoint, scales);
	const x = Math.min(start.x, end.x);
	const y = Math.min(start.y, end.y);
	const width = Math.abs(end.x - start.x);
	const height = Math.abs(end.y - start.y);
	return pointInRect(mouseX, mouseY, x - tolerance, y - tolerance, width + tolerance * 2, height + tolerance * 2);
}

export function hitTestDrawing(
	drawing: DrawingObject,
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	options: { chartWidth: number; chartHeight: number; plotData?: PlotDatum[] },
	toleranceOrPointerType: number | PointerDeviceType = "mouse",
): boolean {
	if (drawing.visible === false) {
		return false;
	}

	const tolerance = typeof toleranceOrPointerType === "number"
		? toleranceOrPointerType
		: HIT_TOLERANCE[toleranceOrPointerType];

	const effectiveDrawing = {
		...drawing,
		style: resolveDrawingStyle(drawing),
	};

	const overlayPrimitive = toOverlayPrimitive(effectiveDrawing, scales);
	if (overlayPrimitive) {
		return hitTestOverlayPrimitive(overlayPrimitive, mouseX, mouseY, {
			chartWidth: options.chartWidth,
			chartHeight: options.chartHeight,
			tolerance,
		});
	}

	switch (effectiveDrawing.type as DrawingToolType) {
		case "ray":
			return hitTestRayLike(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance, 10_000, true);
		case "extendedLine":
			return hitTestRayLike(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance, 10_000, false);
		case "fibonacci":
			return hitTestFibonacciLike(effectiveDrawing, mouseX, mouseY, scales, tolerance, effectiveDrawing.fibLevels ?? DEFAULT_FIB_LEVELS);
		case "fibExtension":
			return hitTestFibonacciLike(effectiveDrawing, mouseX, mouseY, scales, tolerance, effectiveDrawing.fibLevels ?? DEFAULT_FIB_EXTENSION_LEVELS);
		case "channel":
			return hitTestChannelLike(effectiveDrawing, mouseX, mouseY, scales, tolerance);
		case "longPosition":
			return hitTestPositionZones(effectiveDrawing, mouseX, mouseY, scales, tolerance, "long");
		case "shortPosition":
			return hitTestPositionZones(effectiveDrawing, mouseX, mouseY, scales, tolerance, "short");
		case "parallelChannel":
			return hitTestParallelChannel(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance);
		case "pitchfork":
			return hitTestPitchfork(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance);
		case "polyline": {
			const pixels = effectiveDrawing.points.map((point) => toPixel(point, scales));
			return distanceToPolyline(pixels, mouseX, mouseY) <= tolerance;
		}
		case "abcdPattern":
			return hitTestAbcdPattern(effectiveDrawing, mouseX, mouseY, scales, tolerance);
		case "fibArc":
			return hitTestFibArc(effectiveDrawing, mouseX, mouseY, scales, tolerance);
		case "fibTimeZone":
			return hitTestFibTimeZone(effectiveDrawing, mouseX, mouseY, scales, tolerance);
		case "regressionChannel":
			return hitTestRegressionChannel(effectiveDrawing, mouseX, mouseY, scales, options.plotData, tolerance);
		case "gannFan": {
			const [originPoint, endPoint] = effectiveDrawing.points;
			if (!originPoint || !endPoint) {
				return false;
			}
			const origin = toPixel(originPoint, scales);
			const end = toPixel(endPoint, scales);
			const geometry = calculateGannFanGeometry(origin.x, origin.y, end.x, end.y, 1e6, 1e6);
			return geometry.lines.some((line) => distanceToSegment(mouseX, mouseY, line.x1, line.y1, line.x2, line.y2) <= tolerance);
		}
		case "elliottImpulse":
		case "elliottCorrection":
		case "elliottTriangle":
		case "elliottDoubleCombo":
		case "elliottTripleCombo": {
			const pixels = effectiveDrawing.points.map((point) => toPixel(point, scales));
			return distanceToPolyline(pixels, mouseX, mouseY) <= tolerance;
		}
		case "xabcdPattern":
		case "cypherPattern":
		case "headAndShoulders":
		case "trianglePattern":
		case "threeDrivesPattern": {
			const pixels = effectiveDrawing.points.map((point) => toPixel(point, scales));
			return distanceToPolyline(pixels, mouseX, mouseY) <= tolerance;
		}
		case "fibChannel":
		case "fibSpeedResistanceFan":
		case "trendBasedFibTime":
		case "fibCircles":
		case "fibSpiral":
		case "fibSpeedResistanceArcs":
		case "fibWedge":
		case "pitchfan": {
			// Hit test: proximity to any of the base segment(s)
			const pts = effectiveDrawing.points;
			if (pts.length < 2) return false;
			const px1 = toPixel(pts[0], scales);
			const px2 = toPixel(pts[1], scales);
			return distanceToSegment(mouseX, mouseY, px1.x, px1.y, px2.x, px2.y) <= tolerance;
		}
		case "gannBox":
		case "gannSquareFixed":
		case "gannSquare": {
			const pts = effectiveDrawing.points;
			if (pts.length < 1) return false;
			const px1 = toPixel(pts[0], scales);
			const px2 = pts[1] ? toPixel(pts[1], scales) : px1;
			const x = Math.min(px1.x, px2.x);
			const y = Math.min(px1.y, px2.y);
			const w = Math.abs(px2.x - px1.x);
			const h = Math.abs(px2.y - px1.y);
			return (
				distanceToSegment(mouseX, mouseY, x, y, x + w, y) <= tolerance
				|| distanceToSegment(mouseX, mouseY, x + w, y, x + w, y + h) <= tolerance
				|| distanceToSegment(mouseX, mouseY, x + w, y + h, x, y + h) <= tolerance
				|| distanceToSegment(mouseX, mouseY, x, y + h, x, y) <= tolerance
			);
		}
		case "cyclicLines":
		case "timeCycles":
		case "sineLine": {
			const pts2 = effectiveDrawing.points;
			if (pts2.length < 2) return false;
			const px1 = toPixel(pts2[0], scales);
			const px2 = toPixel(pts2[1], scales);
			return distanceToSegment(mouseX, mouseY, px1.x, px1.y, px2.x, px2.y) <= tolerance;
		}
		default:
			return false;
	}
}

export function getResizeHandleIndex(
	drawing: DrawingObject,
	mouseX: number,
	mouseY: number,
	scales: ChartScales,
	tolerance = 8,
): number | null {
	for (let index = 0; index < drawing.points.length; index += 1) {
		const point = drawing.points[index];
		if (!point) {
			continue;
		}
		const pixel = toPixel(point, scales);
		if (Math.hypot(mouseX - pixel.x, mouseY - pixel.y) <= tolerance) {
			return index;
		}
	}

	return null;
}

// ─── CE21-DT1: Action handles (delete / clone / lock) ─────────────────────────

/** Visual radius of each action handle circle (px). Larger for touch targets. */
export const ACTION_HANDLE_RADIUS: Record<PointerDeviceType, number> = {
	mouse: 8,
	touch: 12,
	pen: 8,
};

/**
 * Compute the pixel bounding box of a drawing's anchor points.
 * hLine / vLine are treated as spanning the full chart dimension.
 */
export function getDrawingBoundingBox(
	drawing: DrawingObject,
	scales: ChartScales,
	chartWidth = 1000,
	chartHeight = 600,
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
 * Hit-test the three action handles (delete / clone / lock) for a selected drawing.
 * Handle positions relative to the drawing bounding box:
 *   delete → top-right + (14, -14)
 *   clone  → top-right + (32, -14)
 *   lock   → top-left  + (-14, -14)
 *
 * Returns the handle type if the pointer is within the hit radius, otherwise null.
 */
export function hitTestActionHandles(
	mouseX: number,
	mouseY: number,
	drawing: DrawingObject,
	scales: ChartScales,
	deviceType: PointerDeviceType = "mouse",
	chartWidth?: number,
	chartHeight?: number,
): DrawingHandleType | null {
	const bbox = getDrawingBoundingBox(drawing, scales, chartWidth, chartHeight);
	if (!bbox) {
		return null;
	}

	const radius = ACTION_HANDLE_RADIUS[deviceType];
	const hitRadius = radius + 4; // slightly larger than visual for easier clicking

	const handles: Array<{ type: DrawingHandleType; x: number; y: number }> = [
		{ type: "delete", x: bbox.maxX + 14, y: bbox.minY - 14 },
		{ type: "clone",  x: bbox.maxX + 32, y: bbox.minY - 14 },
		{ type: "lock",   x: bbox.minX - 14, y: bbox.minY - 14 },
	];

	for (const handle of handles) {
		if (Math.hypot(mouseX - handle.x, mouseY - handle.y) <= hitRadius) {
			return handle.type;
		}
	}

	return null;
}

/**
 * Returns true if the drawing's bounding box intersects with the given pixel rectangle.
 * Used for rubber-band selection.
 */
export function isDrawingInRect(
	drawing: DrawingObject,
	rect: { minX: number; minY: number; maxX: number; maxY: number },
	scales: ChartScales,
	chartWidth?: number,
	chartHeight?: number,
): boolean {
	const bbox = getDrawingBoundingBox(drawing, scales, chartWidth, chartHeight);
	if (!bbox) {
		return false;
	}
	return !(bbox.maxX < rect.minX || bbox.minX > rect.maxX || bbox.maxY < rect.minY || bbox.minY > rect.maxY);
}