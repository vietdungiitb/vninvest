import { createDrawingObject, replaceLastPoint } from "../shared.js";
function dashForStyle(strokeDasharray) {
    switch (strokeDasharray) {
        case "dashed":
            return [6, 4];
        case "dotted":
            return [2, 4];
        default:
            return [];
    }
}
function distanceToSegment(point, start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(point.x - start.x, point.y - start.y);
    }
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}
function sign(point, a, b) {
    return (point.x - b.x) * (a.y - b.y) - (a.x - b.x) * (point.y - b.y);
}
export function pointInTriangle(point, a, b, c) {
    const d1 = sign(point, a, b);
    const d2 = sign(point, b, c);
    const d3 = sign(point, c, a);
    const hasNegative = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPositive = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNegative && hasPositive);
}
export function renderTriangle(ctx, drawing, points) {
    const [a, b, c] = points;
    if (!a || !b || !c) {
        return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.closePath();
    if (drawing.style.fill && drawing.style.fill !== "transparent") {
        ctx.fillStyle = drawing.style.fill;
        ctx.globalAlpha = (drawing.style.fillOpacity ?? 0.16) * (drawing.style.opacity ?? 1);
        ctx.fill();
        ctx.globalAlpha = drawing.style.opacity ?? 1;
    }
    ctx.strokeStyle = drawing.style.stroke;
    ctx.lineWidth = drawing.style.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(dashForStyle(drawing.style.strokeDasharray));
    ctx.stroke();
    ctx.restore();
}
export function hitTestTriangle(a, b, c, mouse, tolerance) {
    return distanceToSegment(mouse, a, b) <= tolerance
        || distanceToSegment(mouse, b, c) <= tolerance
        || distanceToSegment(mouse, c, a) <= tolerance
        || pointInTriangle(mouse, a, b, c);
}
const TriangleShape = {
    name: "triangle",
    createDraft: (startPoint) => createDrawingObject("triangle", [startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
    render: () => undefined,
};
export default TriangleShape;
