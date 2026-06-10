import { clipOverlaySegmentToBox, measureOverlayCalloutBox, measureOverlayPriceLabelTag } from "./canvasOverlayGeometry.js";
function strokeDasharrayForStyle(style) {
    if (style.dashPattern && style.dashPattern.length > 0) {
        return style.dashPattern;
    }
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
function safeArc(ctx, x, y, radius, startAngle, endAngle, counterclockwise) {
    if (Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(radius) &&
        Number.isFinite(startAngle) &&
        Number.isFinite(endAngle)) {
        if (counterclockwise !== undefined) {
            ctx.arc(x, y, radius, startAngle, endAngle, counterclockwise);
        }
        else {
            ctx.arc(x, y, radius, startAngle, endAngle);
        }
    }
}
function safeEllipse(ctx, x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise) {
    if (Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(radiusX) &&
        Number.isFinite(radiusY) &&
        Number.isFinite(rotation) &&
        Number.isFinite(startAngle) &&
        Number.isFinite(endAngle)) {
        if (counterclockwise !== undefined) {
            ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle, counterclockwise);
        }
        else {
            ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle);
        }
    }
}
function safeRoundRect(ctx, x, y, w, h, r) {
    if (Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(w) &&
        Number.isFinite(h) &&
        (Array.isArray(r) ? r.every(Number.isFinite) : Number.isFinite(r))) {
        ctx.roundRect(x, y, w, h, r);
    }
}
function applyLineStyle(ctx, style) {
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth = style.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(strokeDasharrayForStyle(style));
    ctx.globalAlpha = style.opacity ?? 1;
}
function drawSelectionHandles(ctx, points, color) {
    if (points.length === 0) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
    ctx.lineWidth = 1;
    for (const point of points) {
        ctx.beginPath();
        safeArc(ctx, point.x, point.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.strokeStyle = "#ffffff";
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}
function drawLine(ctx, start, end, style) {
    ctx.save();
    applyLineStyle(ctx, style);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.restore();
}
function drawPolyline(ctx, points, style) {
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
function drawText(ctx, text, position, style, options) {
    ctx.save();
    ctx.globalAlpha = (style.opacity ?? 1) * (options?.opacity ?? 1);
    ctx.fillStyle = options?.color ?? style.stroke;
    ctx.font = `${options?.weight ? `${options.weight} ` : ""}${options?.fontSize ?? style.fontSize ?? 12}px ${style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = options?.align ?? "left";
    ctx.textBaseline = options?.baseline ?? "middle";
    ctx.fillText(text, position.x, position.y);
    ctx.restore();
}
function mergeStyle(style, override) {
    return {
        ...style,
        stroke: override?.color ?? style.stroke,
        strokeWidth: override?.strokeWidth ?? style.strokeWidth,
        strokeDasharray: override?.strokeDasharray ?? style.strokeDasharray,
        dashPattern: override?.dashPattern ?? style.dashPattern,
        opacity: (style.opacity ?? 1) * (override?.opacity ?? 1),
    };
}
function drawOverlaySegments(ctx, primitive) {
    for (const segment of primitive.segments ?? []) {
        drawLine(ctx, segment.start, segment.end, mergeStyle(primitive.style, segment));
        if (segment.label && segment.labelPosition) {
            drawText(ctx, segment.label, segment.labelPosition, mergeStyle(primitive.style, segment));
        }
    }
}
function drawOverlayPaths(ctx, primitive) {
    for (const path of primitive.paths ?? []) {
        drawPolyline(ctx, path.points, mergeStyle(primitive.style, path));
    }
}
function drawOverlayPointMarkers(ctx, primitive) {
    for (const marker of primitive.pointMarkers ?? []) {
        ctx.save();
        ctx.globalAlpha = (primitive.style.opacity ?? 1) * (marker.opacity ?? 1);
        ctx.fillStyle = marker.fill ?? marker.color ?? primitive.style.stroke;
        ctx.beginPath();
        safeArc(ctx, marker.point.x, marker.point.y, marker.radius ?? 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}
function drawOverlayLabels(ctx, primitive) {
    for (const label of primitive.labels ?? []) {
        drawText(ctx, label.text, label.position, primitive.style, label);
    }
}
function drawOverlayPolygons(ctx, primitive) {
    for (const polygon of primitive.polygons ?? []) {
        if (polygon.points.length < 3) {
            continue;
        }
        ctx.save();
        ctx.globalAlpha = polygon.opacity ?? primitive.style.fillOpacity ?? primitive.style.opacity ?? 1;
        ctx.fillStyle = polygon.fill;
        ctx.beginPath();
        ctx.moveTo(polygon.points[0].x, polygon.points[0].y);
        for (let index = 1; index < polygon.points.length; index += 1) {
            ctx.lineTo(polygon.points[index].x, polygon.points[index].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
}
function drawOverlaySemanticBadges(ctx, primitive, options) {
    for (const badge of primitive.semanticBadges ?? []) {
        if (!Number.isFinite(badge.position.x) || !Number.isFinite(badge.position.y)) {
            continue;
        }
        const fontSize = Math.max(10, Math.min(12, primitive.style.fontSize ?? 11));
        const accent = badge.color ?? primitive.style.stroke;
        const isFocused = badge.isFocused === true;
        const ringRadius = isFocused ? 10 : options.isSelected ? 8 : 6;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.font = `700 ${fontSize}px ${primitive.style.fontFamily ?? "sans-serif"}`;
        const textWidth = ctx.measureText(badge.label).width;
        const badgeWidth = Math.max(20, textWidth + 10);
        const badgeHeight = fontSize + 6;
        const badgeX = badge.position.x + 10;
        const badgeY = badge.position.y - badgeHeight - 10;
        ctx.fillStyle = isFocused
            ? "rgba(15, 23, 42, 0.98)"
            : options.isSelected
                ? "rgba(15, 23, 42, 0.94)"
                : "rgba(15, 23, 42, 0.88)";
        ctx.strokeStyle = accent;
        ctx.lineWidth = isFocused ? 1.5 : 1;
        ctx.beginPath();
        safeRoundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 999);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "#f8fafc";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(badge.label, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2 + 0.5);
        ctx.beginPath();
        safeArc(ctx, badge.position.x, badge.position.y, ringRadius, 0, Math.PI * 2);
        ctx.fillStyle = accent;
        ctx.globalAlpha = isFocused ? 0.38 : options.isSelected ? 0.28 : 0.18;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = isFocused ? 2.5 : options.isSelected ? 2 : 1.5;
        ctx.stroke();
        ctx.restore();
    }
}
function resolveLineExtension(primitive, options, extendLeft, extendRight) {
    const [start, end] = primitive.points;
    if (!start || !end) {
        return null;
    }
    if (!Number.isFinite(start.x) ||
        !Number.isFinite(start.y) ||
        !Number.isFinite(end.x) ||
        !Number.isFinite(end.y) ||
        !Number.isFinite(options.chartWidth) ||
        !Number.isFinite(options.chartHeight)) {
        return null;
    }
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const extensionDistance = 10_000;
    return clipOverlaySegmentToBox(extendLeft
        ? { x: start.x - dx * extensionDistance, y: start.y - dy * extensionDistance }
        : start, extendRight
        ? { x: start.x + dx * extensionDistance, y: start.y + dy * extensionDistance }
        : end, options.chartWidth, options.chartHeight);
}
function drawTrendLine(ctx, primitive, options) {
    const [start, end] = primitive.points;
    if (!start || !end || !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
        return;
    }
    drawLine(ctx, start, end, primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [start, end], primitive.style.stroke);
    }
}
function drawHorizontalLine(ctx, primitive, options) {
    const [point] = primitive.points;
    if (!point || !Number.isFinite(point.y) || !Number.isFinite(options.chartWidth)) {
        return;
    }
    const left = { x: 0, y: point.y };
    const right = { x: options.chartWidth, y: point.y };
    drawLine(ctx, left, right, primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [left, right], primitive.style.stroke);
    }
}
function drawVerticalLine(ctx, primitive, options) {
    const [point] = primitive.points;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(options.chartHeight)) {
        return;
    }
    const top = { x: point.x, y: 0 };
    const bottom = { x: point.x, y: options.chartHeight };
    drawLine(ctx, top, bottom, primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [top, bottom], primitive.style.stroke);
    }
}
function drawRectangle(ctx, primitive, options) {
    const [start, end] = primitive.points;
    if (!start || !end || !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
        return;
    }
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    ctx.save();
    ctx.globalAlpha = primitive.style.fillOpacity ?? primitive.style.opacity ?? 1;
    ctx.fillStyle = primitive.style.fill ?? "transparent";
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    ctx.save();
    applyLineStyle(ctx, primitive.style);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [start, end], primitive.style.stroke);
    }
}
function drawArrow(ctx, primitive, options) {
    const [start, end] = primitive.points;
    if (!start || !end || !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
        return;
    }
    drawLine(ctx, start, end, primitive.style);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length > 0) {
        const headLength = Math.max(8, primitive.style.strokeWidth * 4);
        const headWidth = Math.max(5, primitive.style.strokeWidth * 2);
        const ux = dx / length;
        const uy = dy / length;
        const px = -uy;
        const py = ux;
        const base = { x: end.x - ux * headLength, y: end.y - uy * headLength };
        const left = { x: base.x + px * headWidth, y: base.y + py * headWidth };
        const right = { x: base.x - px * headWidth, y: base.y - py * headWidth };
        ctx.save();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
        ctx.beginPath();
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.closePath();
        ctx.fillStyle = primitive.style.stroke;
        ctx.strokeStyle = primitive.style.stroke;
        ctx.lineWidth = primitive.style.strokeWidth;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }
    if (options.isSelected) {
        drawSelectionHandles(ctx, [start, end], primitive.style.stroke);
    }
}
function drawRay(ctx, primitive, options) {
    const clipped = resolveLineExtension(primitive, options, false, true);
    if (!clipped) {
        return;
    }
    drawLine(ctx, clipped[0], clipped[1], primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [clipped[0], clipped[1]], primitive.style.stroke);
    }
}
function drawExtendedLine(ctx, primitive, options) {
    const clipped = resolveLineExtension(primitive, options, true, true);
    if (!clipped) {
        return;
    }
    drawLine(ctx, clipped[0], clipped[1], primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [clipped[0], clipped[1]], primitive.style.stroke);
    }
}
function drawPolylinePrimitive(ctx, primitive, options) {
    if (primitive.points.length < 2 || primitive.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
        return;
    }
    drawPolyline(ctx, primitive.points, primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
    }
}
function drawDateAndPriceRange(ctx, primitive, options) {
    const [start, end] = primitive.points;
    if (!start || !end || !Number.isFinite(start.x) || !Number.isFinite(start.y) || !Number.isFinite(end.x) || !Number.isFinite(end.y)) {
        return;
    }
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    ctx.save();
    ctx.globalAlpha = primitive.style.fillOpacity ?? primitive.style.opacity ?? 1;
    ctx.fillStyle = primitive.style.fill ?? primitive.style.stroke;
    ctx.fillRect(x, y, width, height);
    ctx.restore();
    ctx.save();
    applyLineStyle(ctx, primitive.style);
    ctx.strokeRect(x, y, width, height);
    ctx.restore();
    if (primitive.text?.trim().length) {
        drawText(ctx, primitive.text, { x: x + 8, y: y + 16 }, primitive.style);
    }
    if (options.isSelected) {
        drawSelectionHandles(ctx, [start, end], primitive.style.stroke);
    }
}
function drawCircle(ctx, primitive, options) {
    const [center, edge] = primitive.points;
    if (!center || !edge || !Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(edge.x) || !Number.isFinite(edge.y)) {
        return;
    }
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (radius < 1 || !Number.isFinite(radius)) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.beginPath();
    safeArc(ctx, center.x, center.y, radius, 0, Math.PI * 2);
    if (primitive.style.fill && primitive.style.fill !== "transparent") {
        ctx.fillStyle = primitive.style.fill;
        ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.16) * (primitive.style.opacity ?? 1);
        ctx.fill();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
    }
    applyLineStyle(ctx, primitive.style);
    ctx.stroke();
    ctx.restore();
    drawOverlayLabels(ctx, primitive);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [center, edge], primitive.style.stroke);
    }
}
function drawEllipse(ctx, primitive, options) {
    const [cornerA, cornerB] = primitive.points;
    if (!cornerA || !cornerB || !Number.isFinite(cornerA.x) || !Number.isFinite(cornerA.y) || !Number.isFinite(cornerB.x) || !Number.isFinite(cornerB.y)) {
        return;
    }
    const centerX = (cornerA.x + cornerB.x) / 2;
    const centerY = (cornerA.y + cornerB.y) / 2;
    const radiusX = Math.abs(cornerB.x - cornerA.x) / 2;
    const radiusY = Math.abs(cornerB.y - cornerA.y) / 2;
    if (radiusX < 1 || radiusY < 1 || !Number.isFinite(centerX) || !Number.isFinite(centerY) || !Number.isFinite(radiusX) || !Number.isFinite(radiusY)) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.beginPath();
    safeEllipse(ctx, centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
    if (primitive.style.fill && primitive.style.fill !== "transparent") {
        ctx.fillStyle = primitive.style.fill;
        ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.16) * (primitive.style.opacity ?? 1);
        ctx.fill();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
    }
    applyLineStyle(ctx, primitive.style);
    ctx.stroke();
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [cornerA, cornerB], primitive.style.stroke);
    }
}
function drawTriangle(ctx, primitive, options) {
    const [a, b, c] = primitive.points;
    if (!a || !b || !c || !Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y) || !Number.isFinite(c.x) || !Number.isFinite(c.y)) {
        return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    if (primitive.style.fill && primitive.style.fill !== "transparent") {
        ctx.fillStyle = primitive.style.fill;
        ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.16) * (primitive.style.opacity ?? 1);
        ctx.fill();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
    }
    applyLineStyle(ctx, primitive.style);
    ctx.stroke();
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [a, b, c], primitive.style.stroke);
    }
}
function drawCallout(ctx, primitive, options) {
    const [boxAnchor, tailAnchor] = primitive.points;
    if (!boxAnchor || !tailAnchor) {
        return;
    }
    if (!Number.isFinite(boxAnchor.x) ||
        !Number.isFinite(boxAnchor.y) ||
        !Number.isFinite(tailAnchor.x) ||
        !Number.isFinite(tailAnchor.y)) {
        return;
    }
    const fontSize = primitive.style.fontSize ?? 12;
    const box = measureOverlayCalloutBox(boxAnchor, primitive.text, fontSize);
    ctx.save();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.beginPath();
    safeRoundRect(ctx, box.x, box.y, box.width, box.height, 8);
    ctx.fillStyle = primitive.style.fill && primitive.style.fill !== "transparent" ? primitive.style.fill : "#f8fafc";
    ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.92) * (primitive.style.opacity ?? 1);
    ctx.fill();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    applyLineStyle(ctx, primitive.style);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(boxAnchor.x, box.y + box.height);
    ctx.lineTo(tailAnchor.x, tailAnchor.y);
    ctx.stroke();
    ctx.fillStyle = primitive.style.stroke;
    ctx.font = `${fontSize}px ${primitive.style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(box.text, boxAnchor.x, boxAnchor.y + 0.5);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [boxAnchor, tailAnchor], primitive.style.stroke);
    }
}
function drawPriceLabel(ctx, primitive, options) {
    const [anchor] = primitive.points;
    if (!anchor) {
        return;
    }
    if (!Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return;
    }
    const fontSize = primitive.style.fontSize ?? 11;
    const tag = measureOverlayPriceLabelTag(options.chartWidth, primitive.text, fontSize);
    const tagY = anchor.y - tag.height / 2;
    ctx.save();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.strokeStyle = primitive.style.stroke;
    ctx.lineWidth = primitive.style.strokeWidth;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, anchor.y);
    ctx.lineTo(tag.x, anchor.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    safeRoundRect(ctx, tag.x, tagY, tag.width, tag.height, 4);
    ctx.fillStyle = primitive.style.fill && primitive.style.fill !== "transparent" ? primitive.style.fill : primitive.style.stroke;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${fontSize}px ${primitive.style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, tag.x + 6, anchor.y + 0.5);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [anchor], primitive.style.stroke);
    }
}
function drawPriceRange(ctx, primitive, options) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1 || !Number.isFinite(p0.y) || !Number.isFinite(p1.y) || !Number.isFinite(options.chartWidth)) {
        return;
    }
    const y1 = Math.min(p0.y, p1.y);
    const y2 = Math.max(p0.y, p1.y);
    const bandHeight = y2 - y1;
    if (bandHeight < 1 || !Number.isFinite(bandHeight)) {
        return;
    }
    const isUp = p1.y < p0.y;
    const fillBase = isUp ? "#089981" : "#f23645";
    ctx.save();
    ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.16) * (primitive.style.opacity ?? 1);
    ctx.fillStyle = fillBase;
    ctx.fillRect(0, y1, options.chartWidth, bandHeight);
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.strokeStyle = fillBase;
    ctx.lineWidth = primitive.style.strokeWidth ?? 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(options.chartWidth, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(options.chartWidth, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    const midY = (y1 + y2) / 2;
    const label = primitive.text ?? "Δ";
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    const padX = 6;
    const labelWidth = (ctx.measureText(label).width) + padX * 2;
    const labelHeight = fontSize + 6;
    const labelX = options.chartWidth - 4;
    const labelY = midY;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = fillBase;
    ctx.beginPath();
    safeRoundRect(ctx, labelX - labelWidth, labelY - labelHeight / 2, labelWidth, labelHeight, 3);
    ctx.fill();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, labelX - padX, labelY);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [p0, p1], primitive.style.stroke);
    }
}
function drawDateRange(ctx, primitive, options) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1 || !Number.isFinite(p0.x) || !Number.isFinite(p1.x) || !Number.isFinite(options.chartHeight)) {
        return;
    }
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    const bandWidth = x2 - x1;
    if (bandWidth < 1 || !Number.isFinite(bandWidth)) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = (primitive.style.fillOpacity ?? 0.12) * (primitive.style.opacity ?? 1);
    ctx.fillStyle = "#2962ff";
    ctx.fillRect(x1, 0, bandWidth, options.chartHeight);
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.strokeStyle = primitive.style.stroke;
    ctx.lineWidth = primitive.style.strokeWidth ?? 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, options.chartHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, options.chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    const arrowY = 20;
    ctx.beginPath();
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x2, arrowY);
    ctx.stroke();
    const arrowHead = 4;
    ctx.beginPath();
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x1 + arrowHead, arrowY - arrowHead);
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x1 + arrowHead, arrowY + arrowHead);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, arrowY);
    ctx.lineTo(x2 - arrowHead, arrowY - arrowHead);
    ctx.moveTo(x2, arrowY);
    ctx.lineTo(x2 - arrowHead, arrowY + arrowHead);
    ctx.stroke();
    const label = primitive.text ?? "Δt";
    const midX = (x1 + x2) / 2;
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const padX = 6;
    const labelWidth = Math.max(ctx.measureText(label).width + padX * 2, 30);
    const labelHeight = fontSize + 6;
    const labelY = arrowY + 14;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = primitive.style.stroke;
    ctx.beginPath();
    safeRoundRect(ctx, midX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight, 3);
    ctx.fill();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, midX, labelY);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [p0, p1], primitive.style.stroke);
    }
}
function drawBarsCount(ctx, primitive, options) {
    const [p0, p1] = primitive.points;
    if (!p0 || !p1 || !Number.isFinite(p0.x) || !Number.isFinite(p1.x) || !Number.isFinite(p0.y) || !Number.isFinite(p1.y)) {
        return;
    }
    const y = (p0.y + p1.y) / 2;
    const color = primitive.style.stroke;
    ctx.save();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = primitive.style.strokeWidth ?? 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(p0.x, y);
    ctx.lineTo(p1.x, y);
    ctx.stroke();
    const arrowHead = 6;
    function drawArrowhead(fromX, direction) {
        ctx.beginPath();
        ctx.moveTo(fromX, y);
        ctx.lineTo(fromX + direction * arrowHead, y - arrowHead / 2);
        ctx.lineTo(fromX + direction * arrowHead, y + arrowHead / 2);
        ctx.closePath();
        ctx.fill();
    }
    drawArrowhead(p0.x, p1.x > p0.x ? -1 : 1);
    drawArrowhead(p1.x, p1.x > p0.x ? 1 : -1);
    const tickHeight = 10;
    ctx.beginPath();
    ctx.moveTo(p0.x, y - tickHeight / 2);
    ctx.lineTo(p0.x, y + tickHeight / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(p1.x, y - tickHeight / 2);
    ctx.lineTo(p1.x, y + tickHeight / 2);
    ctx.stroke();
    const label = primitive.text ?? "N";
    const midX = (p0.x + p1.x) / 2;
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const padX = 6;
    const labelWidth = Math.max(ctx.measureText(label).width + padX * 2, 26);
    const labelHeight = fontSize + 6;
    const labelY = y - 18;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    safeRoundRect(ctx, midX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight, 3);
    ctx.fill();
    ctx.globalAlpha = primitive.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, midX, labelY);
    ctx.restore();
    if (options.isSelected) {
        drawSelectionHandles(ctx, [p0, p1], primitive.style.stroke);
    }
}
function drawHorizontalLevelSet(ctx, primitive, options) {
    const levels = primitive.levelLines ?? [];
    if (levels.length === 0) {
        return;
    }
    for (const level of levels) {
        drawLine(ctx, { x: 0, y: level.y }, { x: options.chartWidth, y: level.y }, {
            ...primitive.style,
            stroke: level.color ?? primitive.style.stroke,
        });
        ctx.save();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
        ctx.fillStyle = level.color ?? primitive.style.stroke;
        ctx.font = `${primitive.style.fontSize ?? 11}px ${primitive.style.fontFamily ?? "sans-serif"}`;
        ctx.textAlign = "right";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(level.label, options.chartWidth - 6, level.y - 4);
        ctx.restore();
    }
    if (options.isSelected) {
        drawSelectionHandles(ctx, primitive.points.slice(0, 2), primitive.style.stroke);
    }
}
function drawFibArcLevels(ctx, primitive, options) {
    const [center, reference] = primitive.points;
    const arcLevels = primitive.arcLevels ?? [];
    if (!center || !reference || !Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(reference.x) || !Number.isFinite(reference.y) || arcLevels.length === 0) {
        return;
    }
    for (const level of arcLevels) {
        if (!Number.isFinite(level.radius)) {
            continue;
        }
        ctx.save();
        applyLineStyle(ctx, {
            ...primitive.style,
            stroke: level.color ?? primitive.style.stroke,
            opacity: (primitive.style.opacity ?? 1) * (level.opacity ?? 1),
        });
        ctx.beginPath();
        safeArc(ctx, center.x, center.y, level.radius, level.startAngle ?? Math.PI, level.endAngle ?? 0);
        ctx.stroke();
        ctx.restore();
        const labelPosition = level.labelPosition ?? {
            x: center.x + level.radius + 4,
            y: center.y - level.radius - 4,
        };
        ctx.save();
        ctx.globalAlpha = (primitive.style.opacity ?? 1) * (level.opacity ?? 1);
        ctx.fillStyle = level.color ?? primitive.style.stroke;
        ctx.font = `${primitive.style.fontSize ?? 11}px ${primitive.style.fontFamily ?? "sans-serif"}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(level.label, labelPosition.x, labelPosition.y);
        ctx.restore();
    }
    drawOverlayPointMarkers(ctx, primitive);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [center, reference], primitive.style.stroke);
    }
}
function drawVerticalMarkerSet(ctx, primitive, options) {
    const markers = primitive.verticalMarkers ?? [];
    if (markers.length === 0) {
        return;
    }
    for (const marker of markers) {
        drawLine(ctx, { x: marker.x, y: 0 }, { x: marker.x, y: options.chartHeight }, {
            ...primitive.style,
            stroke: marker.color ?? primitive.style.stroke,
        });
        const labelPosition = marker.labelPosition ?? { x: marker.x + 4, y: 12 };
        ctx.save();
        ctx.globalAlpha = primitive.style.opacity ?? 1;
        ctx.fillStyle = marker.color ?? primitive.style.stroke;
        ctx.font = `${primitive.style.fontSize ?? 11}px ${primitive.style.fontFamily ?? "sans-serif"}`;
        ctx.textAlign = "left";
        ctx.textBaseline = "alphabetic";
        ctx.fillText(marker.label, labelPosition.x, labelPosition.y);
        ctx.restore();
    }
    if (options.isSelected) {
        drawSelectionHandles(ctx, primitive.points.slice(0, 2), primitive.style.stroke);
    }
}
function drawTextPrimitive(ctx, primitive, options) {
    const [point] = primitive.points;
    if (!point) {
        return;
    }
    drawText(ctx, primitive.text?.trim().length ? primitive.text : "Text", point, primitive.style);
    if (options.isSelected) {
        drawSelectionHandles(ctx, [point], primitive.style.stroke);
    }
}
export function renderOverlayPrimitiveToCanvas(ctx, primitive, options) {
    if (primitive.visible === false) {
        return;
    }
    switch (primitive.type) {
        case "trendLine":
            drawTrendLine(ctx, primitive, options);
            return;
        case "hLine":
            drawHorizontalLine(ctx, primitive, options);
            return;
        case "vLine":
            drawVerticalLine(ctx, primitive, options);
            return;
        case "rectangle":
            drawRectangle(ctx, primitive, options);
            return;
        case "text":
            drawTextPrimitive(ctx, primitive, options);
            return;
        case "arrow":
            drawArrow(ctx, primitive, options);
            return;
        case "ray":
            drawRay(ctx, primitive, options);
            return;
        case "extendedLine":
            drawExtendedLine(ctx, primitive, options);
            return;
        case "polyline":
            drawPolylinePrimitive(ctx, primitive, options);
            return;
        case "dateAndPriceRange":
            drawDateAndPriceRange(ctx, primitive, options);
            return;
        case "circle":
            drawCircle(ctx, primitive, options);
            return;
        case "ellipse":
            drawEllipse(ctx, primitive, options);
            return;
        case "triangle":
            drawTriangle(ctx, primitive, options);
            return;
        case "callout":
            drawCallout(ctx, primitive, options);
            return;
        case "priceLabel":
            drawPriceLabel(ctx, primitive, options);
            return;
        case "priceRange":
            drawPriceRange(ctx, primitive, options);
            return;
        case "dateRange":
            drawDateRange(ctx, primitive, options);
            return;
        case "barsCount":
            drawBarsCount(ctx, primitive, options);
            return;
        case "fibonacci":
        case "fibExtension":
            drawHorizontalLevelSet(ctx, primitive, options);
            return;
        case "fibArc":
            drawFibArcLevels(ctx, primitive, options);
            return;
        case "fibTimeZone":
            drawVerticalMarkerSet(ctx, primitive, options);
            return;
        case "fibCircles":
        case "fibSpeedResistanceArcs":
            drawFibArcLevels(ctx, primitive, options);
            return;
        case "fibSpiral":
            drawOverlayPaths(ctx, primitive);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points.slice(0, 2), primitive.style.stroke);
            }
            return;
        case "fibSpeedResistanceFan":
        case "fibChannel":
        case "trendBasedFibTime":
        case "fibWedge":
        case "pitchfan":
            drawOverlaySegments(ctx, primitive);
            drawOverlayLabels(ctx, primitive);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
            }
            return;
        case "channel":
        case "parallelChannel":
        case "pitchfork":
            drawOverlaySegments(ctx, primitive);
            drawOverlayLabels(ctx, primitive);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
            }
            return;
        case "regressionChannel":
            drawOverlayPolygons(ctx, primitive);
            drawOverlaySegments(ctx, primitive);
            drawOverlayLabels(ctx, primitive);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
            }
            return;
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
        case "longPosition":
        case "shortPosition":
            drawOverlayPolygons(ctx, primitive);
            drawOverlaySegments(ctx, primitive);
            drawOverlayLabels(ctx, primitive);
            drawOverlaySemanticBadges(ctx, primitive, options);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
            }
            return;
        case "cyclicLines":
        case "timeCycles":
        case "sineLine":
            drawOverlaySegments(ctx, primitive);
            drawOverlayPaths(ctx, primitive);
            if (options.isSelected) {
                drawSelectionHandles(ctx, primitive.points, primitive.style.stroke);
            }
            return;
        default:
            return;
    }
}
