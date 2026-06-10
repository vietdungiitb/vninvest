import { createDrawingObject, replacePoint } from "../shared.js";
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
export function renderCircle(ctx, drawing, points) {
    const [center, edge] = points;
    if (!center || !edge) {
        return;
    }
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (radius < 1) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.beginPath();
    ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
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
export function hitTestCircle(center, edge, mouse, tolerance, allowInterior = false) {
    const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
    if (radius < 1) {
        return false;
    }
    const distance = Math.hypot(mouse.x - center.x, mouse.y - center.y);
    if (Math.abs(distance - radius) <= tolerance) {
        return true;
    }
    return allowInterior && distance < radius;
}
const CircleShape = {
    name: "circle",
    createDraft: (startPoint) => createDrawingObject("circle", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default CircleShape;
