import { chartPointToPixel } from "./coordinateUtils.js";
import { resolveDrawingStyle } from "./drawingStyleRegistry.js";
import { toOverlayPrimitive } from "./overlayPrimitiveAdapter.js";
import { calculateParallelChannelGeometry } from "./builtin/parallelChannel.js";
import { calculatePitchforkGeometry } from "./builtin/pitchfork.js";
import { calculateAbcdPatternMetrics } from "./builtin/abcdPattern.js";
import { calculateFibArcGeometry } from "./builtin/fibArc.js";
import { calculateFibTimeZoneGeometry } from "./builtin/fibTimeZone.js";
import { calculateRegressionChannelMetrics } from "./builtin/regressionChannel.js";
import { calculateGannAdvancedGeometry } from "./builtin/gannAdvanced.js";
import { clipSegmentToBox } from "./renderCanvas.js";
import { hitTestOverlayPrimitive, } from "@vninvestcharts/vn-kline-engine-core";
export const HIT_TOLERANCE = {
    mouse: 6,
    touch: 16,
    pen: 8,
};
const AABB_SAFE_TYPES = new Set([
    "trendLine",
    "arrow",
    "hLine",
    "vLine",
    "rectangle",
    "dateAndPriceRange",
    "ellipse",
    "triangle",
    "polyline",
    "channel",
    "parallelChannel",
    "elliottImpulse",
    "elliottCorrection",
    "elliottTriangle",
    "elliottDoubleCombo",
    "elliottTripleCombo",
    "xabcdPattern",
    "cypherPattern",
    "headAndShoulders",
    "trianglePattern",
    "threeDrivesPattern",
    "abcdPattern",
]);
function toPixel(point, scales) {
    return chartPointToPixel(point, scales);
}
function distanceToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(px - x1, py - y1);
    }
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lengthSquared));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
function distanceToPolyline(points, px, py) {
    if (points.length < 2) {
        return Number.POSITIVE_INFINITY;
    }
    let best = Number.POSITIVE_INFINITY;
    for (let index = 1; index < points.length; index += 1) {
        best = Math.min(best, distanceToSegment(px, py, points[index - 1].x, points[index - 1].y, points[index].x, points[index].y));
    }
    return best;
}
function pathBounds(points) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
function getTextBounds(drawing, scales) {
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
function hitTestLineLike(drawing, mouseX, mouseY, scales, chartWidth, chartHeight, tolerance) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return false;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    return distanceToSegment(mouseX, mouseY, start.x, start.y, end.x, end.y) <= tolerance;
}
function hitTestRayLike(drawing, mouseX, mouseY, scales, chartWidth, chartHeight, tolerance, multiplier, forwardOnly) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return false;
    }
    const start = toPixel(startPoint, scales);
    const end = toPixel(endPoint, scales);
    const clipped = forwardOnly
        ? clipSegmentToBox(start, { x: start.x + (end.x - start.x) * multiplier, y: start.y + (end.y - start.y) * multiplier }, chartWidth, chartHeight)
        : clipSegmentToBox({ x: start.x - (end.x - start.x) * multiplier, y: start.y - (end.y - start.y) * multiplier }, { x: start.x + (end.x - start.x) * multiplier, y: start.y + (end.y - start.y) * multiplier }, chartWidth, chartHeight);
    if (!clipped) {
        return false;
    }
    return distanceToSegment(mouseX, mouseY, clipped[0].x, clipped[0].y, clipped[1].x, clipped[1].y) <= tolerance;
}
function hitTestRectangleLike(drawing, mouseX, mouseY, scales, tolerance) {
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
function hitTestFibonacciLike(drawing, mouseX, mouseY, scales, tolerance, levels) {
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
function hitTestChannelLike(drawing, mouseX, mouseY, scales, tolerance) {
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
function hitTestParallelChannel(drawing, mouseX, mouseY, scales, chartWidth, chartHeight, tolerance) {
    const geometry = calculateParallelChannelGeometry(drawing, scales);
    if (!geometry) {
        return false;
    }
    const upper = clipSegmentToBox({ x: geometry.start.x + geometry.offsetVector.x, y: geometry.start.y + geometry.offsetVector.y }, { x: geometry.end.x + geometry.offsetVector.x, y: geometry.end.y + geometry.offsetVector.y }, chartWidth, chartHeight);
    const middle = clipSegmentToBox(geometry.start, geometry.end, chartWidth, chartHeight);
    const lower = clipSegmentToBox({ x: geometry.start.x - geometry.offsetVector.x, y: geometry.start.y - geometry.offsetVector.y }, { x: geometry.end.x - geometry.offsetVector.x, y: geometry.end.y - geometry.offsetVector.y }, chartWidth, chartHeight);
    return [upper, middle, lower].some((segment) => segment != null && distanceToSegment(mouseX, mouseY, segment[0].x, segment[0].y, segment[1].x, segment[1].y) <= tolerance);
}
function hitTestPitchfork(drawing, mouseX, mouseY, scales, chartWidth, chartHeight, tolerance) {
    const geometry = calculatePitchforkGeometry(drawing, scales);
    if (!geometry || (geometry.direction.x === 0 && geometry.direction.y === 0)) {
        return false;
    }
    const median = clipSegmentToBox({ x: geometry.pivot.x - geometry.direction.x * 10_000, y: geometry.pivot.y - geometry.direction.y * 10_000 }, { x: geometry.pivot.x + geometry.direction.x * 10_000, y: geometry.pivot.y + geometry.direction.y * 10_000 }, chartWidth, chartHeight);
    const leftFork = clipSegmentToBox({ x: geometry.leftSwing.x - geometry.direction.x * 10_000, y: geometry.leftSwing.y - geometry.direction.y * 10_000 }, { x: geometry.leftSwing.x + geometry.direction.x * 10_000, y: geometry.leftSwing.y + geometry.direction.y * 10_000 }, chartWidth, chartHeight);
    const rightFork = clipSegmentToBox({ x: geometry.rightSwing.x - geometry.direction.x * 10_000, y: geometry.rightSwing.y - geometry.direction.y * 10_000 }, { x: geometry.rightSwing.x + geometry.direction.x * 10_000, y: geometry.rightSwing.y + geometry.direction.y * 10_000 }, chartWidth, chartHeight);
    return [median, leftFork, rightFork].some((segment) => segment != null && distanceToSegment(mouseX, mouseY, segment[0].x, segment[0].y, segment[1].x, segment[1].y) <= tolerance);
}
function hitTestAbcdPattern(drawing, mouseX, mouseY, scales, tolerance) {
    const metrics = calculateAbcdPatternMetrics(drawing, scales);
    if (!metrics) {
        return false;
    }
    const [a, b, c, d] = metrics.points;
    return distanceToSegment(mouseX, mouseY, a.x, a.y, b.x, b.y) <= tolerance
        || distanceToSegment(mouseX, mouseY, b.x, b.y, c.x, c.y) <= tolerance
        || distanceToSegment(mouseX, mouseY, c.x, c.y, d.x, d.y) <= tolerance;
}
function hitTestFibArc(drawing, mouseX, mouseY, scales, tolerance) {
    const geometry = calculateFibArcGeometry(drawing, scales);
    if (!geometry) {
        return false;
    }
    const distanceFromCenter = Math.hypot(mouseX - geometry.center.x, mouseY - geometry.center.y);
    return geometry.radii.some((radius) => Math.abs(distanceFromCenter - radius) <= tolerance);
}
function hitTestFibTimeZone(drawing, mouseX, mouseY, scales, tolerance) {
    const geometry = calculateFibTimeZoneGeometry(drawing, scales);
    if (!geometry) {
        return false;
    }
    return geometry.positions.some((x) => Math.abs(mouseX - x) <= tolerance);
}
function hitTestRegressionChannel(drawing, mouseX, mouseY, scales, plotData, tolerance) {
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
function hitTestPositionZones(drawing, mouseX, mouseY, scales, tolerance, mode) {
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
export function hitTestDrawing(drawing, mouseX, mouseY, scales, options, toleranceOrPointerType = "mouse") {
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
    // --- AABB Broad-Phase check (Early Exit) ---
    if (AABB_SAFE_TYPES.has(effectiveDrawing.type)) {
        const bbox = getDrawingBoundingBox(effectiveDrawing, scales, options.chartWidth, options.chartHeight);
        if (bbox) {
            if (mouseX < bbox.minX - tolerance ||
                mouseX > bbox.maxX + tolerance ||
                mouseY < bbox.minY - tolerance ||
                mouseY > bbox.maxY + tolerance) {
                return false;
            }
        }
    }
    const overlayPrimitive = toOverlayPrimitive(effectiveDrawing, scales, {
        chartWidth: options.chartWidth,
        chartHeight: options.chartHeight,
        plotData: options.plotData,
    });
    if (overlayPrimitive) {
        return hitTestOverlayPrimitive(overlayPrimitive, mouseX, mouseY, {
            chartWidth: options.chartWidth,
            chartHeight: options.chartHeight,
            tolerance,
        });
    }
    switch (effectiveDrawing.type) {
        case "ray":
            return hitTestRayLike(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance, 10_000, true);
        case "extendedLine":
            return hitTestRayLike(effectiveDrawing, mouseX, mouseY, scales, options.chartWidth, options.chartHeight, tolerance, 10_000, false);
        case "polyline": {
            const pixels = effectiveDrawing.points.map((point) => toPixel(point, scales));
            return distanceToPolyline(pixels, mouseX, mouseY) <= tolerance;
        }
        default:
            return false;
    }
}
export function getResizeHandleIndex(drawing, mouseX, mouseY, scales, tolerance = 8) {
    // For gannSquare the rendered corner (index 1) is constrained to a square aspect ratio
    // and differs from raw points[1] pixel. Use actual geometry corners for hit detection.
    if (drawing.type === "gannSquare" || drawing.type === "gannBox") {
        const geo = calculateGannAdvancedGeometry(drawing, scales);
        if (geo) {
            if (Math.hypot(mouseX - geo.x1, mouseY - geo.y1) <= tolerance)
                return 0;
            if (Math.hypot(mouseX - geo.x2, mouseY - geo.y2) <= tolerance)
                return 1;
            return null;
        }
    }
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
export const ACTION_HANDLE_RADIUS = {
    mouse: 8,
    touch: 12,
    pen: 8,
};
/**
 * Compute the pixel bounding box of a drawing's anchor points.
 * hLine / vLine are treated as spanning the full chart dimension.
 */
export function getDrawingBoundingBox(drawing, scales, chartWidth = 1000, chartHeight = 600) {
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
    if (drawing.type === "circle") {
        const [centerPoint, edgePoint] = drawing.points;
        if (!centerPoint || !edgePoint) {
            return null;
        }
        const center = toPixel(centerPoint, scales);
        const edge = toPixel(edgePoint, scales);
        const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
        if (!Number.isFinite(radius) || radius <= 0) {
            return null;
        }
        return {
            minX: center.x - radius,
            maxX: center.x + radius,
            minY: center.y - radius,
            maxY: center.y + radius,
        };
    }
    // For gannSquare/gannBox/gannSquareFixed use actual rendered corners clamped to the
    // visible chart area so action handles and rubber-band selection stay within viewport.
    if (drawing.type === "gannSquare" || drawing.type === "gannBox" || drawing.type === "gannSquareFixed") {
        const geo = calculateGannAdvancedGeometry(drawing, scales);
        if (geo) {
            return {
                minX: Math.max(0, Math.min(geo.x1, geo.x2)),
                maxX: Math.min(chartWidth, Math.max(geo.x1, geo.x2)),
                minY: Math.max(0, Math.min(geo.y1, geo.y2)),
                maxY: Math.min(chartHeight, Math.max(geo.y1, geo.y2)),
            };
        }
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
export function hitTestActionHandles(mouseX, mouseY, drawing, scales, deviceType = "mouse", chartWidth, chartHeight) {
    const bbox = getDrawingBoundingBox(drawing, scales, chartWidth, chartHeight);
    if (!bbox) {
        return null;
    }
    const radius = ACTION_HANDLE_RADIUS[deviceType];
    const hitRadius = radius + 4; // slightly larger than visual for easier clicking
    const handles = [
        { type: "delete", x: bbox.maxX + 14, y: bbox.minY - 14 },
        { type: "clone", x: bbox.maxX + 32, y: bbox.minY - 14 },
        { type: "lock", x: bbox.minX - 14, y: bbox.minY - 14 },
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
export function isDrawingInRect(drawing, rect, scales, chartWidth, chartHeight) {
    const bbox = getDrawingBoundingBox(drawing, scales, chartWidth, chartHeight);
    if (!bbox) {
        return false;
    }
    return !(bbox.maxX < rect.minX || bbox.minX > rect.maxX || bbox.maxY < rect.minY || bbox.minY > rect.maxY);
}
