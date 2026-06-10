import { clipOverlaySegmentToBox, measureOverlayCalloutBox, measureOverlayPriceLabelTag, pointInOverlayTriangle } from "./canvasOverlayGeometry.js";
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
function pointInPolygon(px, py, points) {
    let inside = false;
    for (let current = 0, previous = points.length - 1; current < points.length; previous = current, current += 1) {
        const point = points[current];
        const prior = points[previous];
        const intersects = ((point.y > py) !== (prior.y > py))
            && (px < ((prior.x - point.x) * (py - point.y)) / ((prior.y - point.y) || Number.EPSILON) + point.x);
        if (intersects) {
            inside = !inside;
        }
    }
    return inside;
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
function normalizeAngle(angle) {
    const full = Math.PI * 2;
    const normalized = angle % full;
    return normalized < 0 ? normalized + full : normalized;
}
function isAngleWithinArc(angle, startAngle, endAngle) {
    if (startAngle == null || endAngle == null) {
        return true;
    }
    const start = normalizeAngle(startAngle);
    const end = normalizeAngle(endAngle);
    if (Math.abs((endAngle - startAngle) % (Math.PI * 2)) < 1e-6 && endAngle !== startAngle) {
        return true;
    }
    if (start <= end) {
        return angle >= start && angle <= end;
    }
    return angle >= start || angle <= end;
}
function hitTestLineLike(primitive, mouseX, mouseY, tolerance) {
    const [start, end] = primitive.points;
    if (!start || !end) {
        return false;
    }
    return distanceToSegment(mouseX, mouseY, start.x, start.y, end.x, end.y) <= tolerance;
}
function hitTestExtendedLineLike(primitive, mouseX, mouseY, options, tolerance, extendLeft, extendRight) {
    const [start, end] = primitive.points;
    if (!start || !end) {
        return false;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const extensionDistance = 10_000;
    const clipped = clipOverlaySegmentToBox(extendLeft
        ? { x: start.x - dx * extensionDistance, y: start.y - dy * extensionDistance }
        : start, extendRight
        ? { x: start.x + dx * extensionDistance, y: start.y + dy * extensionDistance }
        : end, options.chartWidth, options.chartHeight);
    if (!clipped) {
        return false;
    }
    return distanceToSegment(mouseX, mouseY, clipped[0].x, clipped[0].y, clipped[1].x, clipped[1].y) <= tolerance;
}
function hitTestHorizontalLine(primitive, mouseY, tolerance) {
    const [point] = primitive.points;
    if (!point) {
        return false;
    }
    return Math.abs(mouseY - point.y) <= tolerance;
}
function hitTestVerticalLine(primitive, mouseX, tolerance) {
    const [point] = primitive.points;
    if (!point) {
        return false;
    }
    return Math.abs(mouseX - point.x) <= tolerance;
}
function hitTestRectangleLike(primitive, mouseX, mouseY, tolerance) {
    const [start, end] = primitive.points;
    if (!start || !end) {
        return false;
    }
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
function hitTestTextLike(primitive, mouseX, mouseY, tolerance) {
    const [point] = primitive.points;
    if (!point) {
        return false;
    }
    const fontSize = primitive.style.fontSize ?? 12;
    const text = primitive.text?.trim().length ? primitive.text : "Text";
    const width = Math.max(fontSize, text.length * fontSize * 0.6);
    const bounds = {
        x: point.x - width * 0.1,
        y: point.y - fontSize * 0.5,
        width,
        height: fontSize,
    };
    return pointInRect(mouseX, mouseY, bounds.x - tolerance, bounds.y - tolerance, bounds.width + tolerance * 2, bounds.height + tolerance * 2);
}
function hitTestCircleLike(primitive, mouseX, mouseY, tolerance) {
    const [center, edge] = primitive.points;
    if (!center || !edge) {
        return false;
    }
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (radius < 1) {
        return false;
    }
    const distance = Math.hypot(mouseX - center.x, mouseY - center.y);
    if (Math.abs(distance - radius) <= tolerance) {
        return true;
    }
    return primitive.style.fill != null && primitive.style.fill !== "transparent" && distance < radius;
}
function hitTestEllipseLike(primitive, mouseX, mouseY, tolerance) {
    const [cornerA, cornerB] = primitive.points;
    if (!cornerA || !cornerB) {
        return false;
    }
    const centerX = (cornerA.x + cornerB.x) / 2;
    const centerY = (cornerA.y + cornerB.y) / 2;
    const radiusX = Math.abs(cornerB.x - cornerA.x) / 2;
    const radiusY = Math.abs(cornerB.y - cornerA.y) / 2;
    if (radiusX < 1 || radiusY < 1) {
        return false;
    }
    const dx = (mouseX - centerX) / radiusX;
    const dy = (mouseY - centerY) / radiusY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedTolerance = tolerance / Math.max(1, Math.min(radiusX, radiusY));
    if (Math.abs(distance - 1) <= normalizedTolerance) {
        return true;
    }
    return primitive.style.fill != null && primitive.style.fill !== "transparent" && distance < 1;
}
function hitTestTriangleLike(primitive, mouseX, mouseY, tolerance) {
    const [a, b, c] = primitive.points;
    if (!a || !b || !c) {
        return false;
    }
    return distanceToSegment(mouseX, mouseY, a.x, a.y, b.x, b.y) <= tolerance
        || distanceToSegment(mouseX, mouseY, b.x, b.y, c.x, c.y) <= tolerance
        || distanceToSegment(mouseX, mouseY, c.x, c.y, a.x, a.y) <= tolerance
        || pointInOverlayTriangle({ x: mouseX, y: mouseY }, a, b, c);
}
function hitTestCalloutLike(primitive, mouseX, mouseY, tolerance) {
    const [boxAnchor, tailAnchor] = primitive.points;
    if (!boxAnchor || !tailAnchor) {
        return false;
    }
    const fontSize = primitive.style.fontSize ?? 12;
    const box = measureOverlayCalloutBox(boxAnchor, primitive.text, fontSize);
    if (pointInRect(mouseX, mouseY, box.x - tolerance, box.y - tolerance, box.width + tolerance * 2, box.height + tolerance * 2)) {
        return true;
    }
    return distanceToSegment(mouseX, mouseY, boxAnchor.x, box.y + box.height, tailAnchor.x, tailAnchor.y) <= tolerance;
}
function hitTestPriceLabelLike(primitive, mouseX, mouseY, options, tolerance) {
    const [anchor] = primitive.points;
    if (!anchor) {
        return false;
    }
    const tag = measureOverlayPriceLabelTag(options.chartWidth, primitive.text, primitive.style.fontSize ?? 11);
    const tagY = anchor.y - tag.height / 2;
    if (pointInRect(mouseX, mouseY, tag.x - tolerance, tagY - tolerance, tag.width + tolerance * 2, tag.height + tolerance * 2)) {
        return true;
    }
    return distanceToSegment(mouseX, mouseY, 0, anchor.y, tag.x, anchor.y) <= tolerance;
}
function hitTestPriceRangeLike(primitive, mouseX, mouseY, options, tolerance) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1) {
        return false;
    }
    const y1 = Math.min(p0.y, p1.y);
    const y2 = Math.max(p0.y, p1.y);
    if ((Math.abs(mouseY - y1) <= tolerance || Math.abs(mouseY - y2) <= tolerance) && mouseX >= 0 && mouseX <= options.chartWidth) {
        return true;
    }
    return mouseY >= y1 - tolerance && mouseY <= y2 + tolerance && mouseX >= 0 && mouseX <= options.chartWidth;
}
function hitTestDateRangeLike(primitive, mouseX, mouseY, options, tolerance) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1) {
        return false;
    }
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    if ((Math.abs(mouseX - x1) <= tolerance || Math.abs(mouseX - x2) <= tolerance) && mouseY >= 0 && mouseY <= options.chartHeight) {
        return true;
    }
    return mouseX >= x1 - tolerance && mouseX <= x2 + tolerance && mouseY >= 0 && mouseY <= options.chartHeight;
}
function hitTestBarsCountLike(primitive, mouseX, mouseY, tolerance) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1) {
        return false;
    }
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    const y = (p0.y + p1.y) / 2;
    if (Math.abs(mouseY - y) <= tolerance && mouseX >= x1 - tolerance && mouseX <= x2 + tolerance) {
        return true;
    }
    return Math.hypot(mouseX - p0.x, mouseY - p0.y) <= tolerance * 2
        || Math.hypot(mouseX - p1.x, mouseY - p1.y) <= tolerance * 2;
}
function hitTestHorizontalLevelSet(primitive, mouseY, tolerance) {
    return (primitive.levelLines ?? []).some((level) => Math.abs(mouseY - level.y) <= tolerance);
}
function hitTestFibArcLevels(primitive, mouseX, mouseY, tolerance) {
    const [center] = primitive.points;
    if (!center) {
        return false;
    }
    const distanceFromCenter = Math.hypot(mouseX - center.x, mouseY - center.y);
    const angle = normalizeAngle(Math.atan2(mouseY - center.y, mouseX - center.x));
    return (primitive.arcLevels ?? []).some((level) => Math.abs(distanceFromCenter - level.radius) <= tolerance && isAngleWithinArc(angle, level.startAngle, level.endAngle));
}
function hitTestVerticalMarkerSet(primitive, mouseX, tolerance) {
    return (primitive.verticalMarkers ?? []).some((marker) => Math.abs(mouseX - marker.x) <= tolerance);
}
function hitTestSegmentSet(primitive, mouseX, mouseY, tolerance) {
    return (primitive.segments ?? [])
        .filter((segment) => segment.hitTestable !== false)
        .some((segment) => distanceToSegment(mouseX, mouseY, segment.start.x, segment.start.y, segment.end.x, segment.end.y) <= tolerance);
}
function hitTestPathSet(primitive, mouseX, mouseY, tolerance) {
    return (primitive.paths ?? []).some((path) => distanceToPolyline(path.points, mouseX, mouseY) <= tolerance);
}
function hitTestPolygonSet(primitive, mouseX, mouseY, tolerance) {
    return (primitive.polygons ?? []).some((polygon) => {
        if (pointInPolygon(mouseX, mouseY, polygon.points)) {
            return true;
        }
        return distanceToPolyline([...polygon.points, polygon.points[0]], mouseX, mouseY) <= tolerance;
    });
}
const SUPPORTED_PRIMITIVE_TYPES = [
    "trendLine",
    "hLine",
    "vLine",
    "rectangle",
    "text",
    "arrow",
    "ray",
    "extendedLine",
    "polyline",
    "dateAndPriceRange",
    "circle",
    "ellipse",
    "triangle",
    "callout",
    "priceLabel",
    "priceRange",
    "dateRange",
    "barsCount",
    "fibonacci",
    "fibExtension",
    "fibArc",
    "fibTimeZone",
    "fibCircles",
    "fibSpeedResistanceArcs",
    "fibSpiral",
    "fibSpeedResistanceFan",
    "fibChannel",
    "trendBasedFibTime",
    "fibWedge",
    "pitchfan",
    "channel",
    "parallelChannel",
    "pitchfork",
    "regressionChannel",
    "abcdPattern",
    "xabcdPattern",
    "cypherPattern",
    "headAndShoulders",
    "trianglePattern",
    "threeDrivesPattern",
    "elliottImpulse",
    "elliottCorrection",
    "elliottTriangle",
    "elliottDoubleCombo",
    "elliottTripleCombo",
    "gannFan",
    "gannBox",
    "gannSquareFixed",
    "gannSquare",
    "longPosition",
    "shortPosition",
    "cyclicLines",
    "timeCycles",
    "sineLine",
];
export function isOverlayPrimitiveHitTestSupported(type) {
    return SUPPORTED_PRIMITIVE_TYPES.includes(type);
}
export function hitTestOverlayPrimitive(primitive, mouseX, mouseY, options) {
    if (primitive.visible === false) {
        return false;
    }
    const { tolerance } = options;
    switch (primitive.type) {
        case "trendLine":
        case "arrow":
            return hitTestLineLike(primitive, mouseX, mouseY, tolerance);
        case "ray":
            return hitTestExtendedLineLike(primitive, mouseX, mouseY, options, tolerance, false, true);
        case "extendedLine":
            return hitTestExtendedLineLike(primitive, mouseX, mouseY, options, tolerance, true, true);
        case "hLine":
            return hitTestHorizontalLine(primitive, mouseY, tolerance);
        case "vLine":
            return hitTestVerticalLine(primitive, mouseX, tolerance);
        case "rectangle":
        case "dateAndPriceRange":
            return hitTestRectangleLike(primitive, mouseX, mouseY, tolerance);
        case "text":
            return hitTestTextLike(primitive, mouseX, mouseY, tolerance);
        case "polyline":
            return distanceToPolyline(primitive.points, mouseX, mouseY) <= tolerance;
        case "circle":
            return hitTestCircleLike(primitive, mouseX, mouseY, tolerance);
        case "ellipse":
            return hitTestEllipseLike(primitive, mouseX, mouseY, tolerance);
        case "triangle":
            return hitTestTriangleLike(primitive, mouseX, mouseY, tolerance);
        case "callout":
            return hitTestCalloutLike(primitive, mouseX, mouseY, tolerance);
        case "priceLabel":
            return hitTestPriceLabelLike(primitive, mouseX, mouseY, options, tolerance);
        case "priceRange":
            return hitTestPriceRangeLike(primitive, mouseX, mouseY, options, tolerance);
        case "dateRange":
            return hitTestDateRangeLike(primitive, mouseX, mouseY, options, tolerance);
        case "barsCount":
            return hitTestBarsCountLike(primitive, mouseX, mouseY, tolerance);
        case "fibonacci":
        case "fibExtension":
            return hitTestHorizontalLevelSet(primitive, mouseY, tolerance);
        case "fibArc":
            return hitTestFibArcLevels(primitive, mouseX, mouseY, tolerance);
        case "fibTimeZone":
            return hitTestVerticalMarkerSet(primitive, mouseX, tolerance);
        case "fibCircles":
        case "fibSpeedResistanceArcs":
            return hitTestFibArcLevels(primitive, mouseX, mouseY, tolerance);
        case "fibSpiral":
            return hitTestPathSet(primitive, mouseX, mouseY, tolerance);
        case "fibSpeedResistanceFan":
        case "fibChannel":
        case "trendBasedFibTime":
        case "fibWedge":
        case "pitchfan":
        case "channel":
        case "parallelChannel":
        case "pitchfork":
        case "abcdPattern":
        case "xabcdPattern":
        case "cypherPattern":
        case "headAndShoulders":
        case "trianglePattern":
        case "threeDrivesPattern":
        case "elliottImpulse":
        case "elliottCorrection":
        case "elliottTriangle":
        case "elliottDoubleCombo":
        case "elliottTripleCombo":
        case "gannFan":
        case "gannBox":
        case "gannSquareFixed":
        case "gannSquare":
            return hitTestSegmentSet(primitive, mouseX, mouseY, tolerance);
        case "longPosition":
        case "shortPosition":
            return hitTestPolygonSet(primitive, mouseX, mouseY, tolerance) || hitTestSegmentSet(primitive, mouseX, mouseY, tolerance);
        case "cyclicLines":
        case "timeCycles":
        case "sineLine":
            return hitTestSegmentSet(primitive, mouseX, mouseY, tolerance);
        case "regressionChannel":
            return hitTestPolygonSet(primitive, mouseX, mouseY, tolerance) || hitTestSegmentSet(primitive, mouseX, mouseY, tolerance);
        default:
            return false;
    }
}
