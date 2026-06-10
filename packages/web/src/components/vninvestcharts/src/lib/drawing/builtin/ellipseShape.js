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
export function renderEllipse(ctx, drawing, points) {
    const [cornerA, cornerB] = points;
    if (!cornerA || !cornerB) {
        return;
    }
    const centerX = (cornerA.x + cornerB.x) / 2;
    const centerY = (cornerA.y + cornerB.y) / 2;
    const radiusX = Math.abs(cornerB.x - cornerA.x) / 2;
    const radiusY = Math.abs(cornerB.y - cornerA.y) / 2;
    if (radiusX < 1 || radiusY < 1) {
        return;
    }
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
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
export function hitTestEllipse(cornerA, cornerB, mouse, tolerance, allowInterior = false) {
    const centerX = (cornerA.x + cornerB.x) / 2;
    const centerY = (cornerA.y + cornerB.y) / 2;
    const radiusX = Math.abs(cornerB.x - cornerA.x) / 2;
    const radiusY = Math.abs(cornerB.y - cornerA.y) / 2;
    if (radiusX < 1 || radiusY < 1) {
        return false;
    }
    const dx = (mouse.x - centerX) / radiusX;
    const dy = (mouse.y - centerY) / radiusY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const normalizedTolerance = tolerance / Math.max(1, Math.min(radiusX, radiusY));
    if (Math.abs(distance - 1) <= normalizedTolerance) {
        return true;
    }
    return allowInterior && distance < 1;
}
const EllipseShape = {
    name: "ellipse",
    createDraft: (startPoint) => createDrawingObject("ellipse", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default EllipseShape;
