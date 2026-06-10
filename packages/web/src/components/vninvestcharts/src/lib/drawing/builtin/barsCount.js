/**
 * TDM-C: Bars Count measurement tool
 * 2-point model: p[0] = start bar (x), p[1] = end bar (x)
 * Renders a double-headed horizontal arrow + N bars label.
 */
import { createDrawingObject, replacePoint } from "../shared.js";
export function renderBarsCount(ctx, drawing, points) {
    const [p0, p1] = points;
    if (!p0 || !p1)
        return;
    const x1 = p0.x;
    const x2 = p1.x;
    const y = (p0.y + p1.y) / 2;
    const color = drawing.style.stroke;
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = drawing.style.strokeWidth ?? 1;
    ctx.fillStyle = color;
    // Main horizontal line
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    // Arrowheads
    const ah = 6;
    function arrowhead(fromX, dir) {
        ctx.beginPath();
        ctx.moveTo(fromX, y);
        ctx.lineTo(fromX + dir * ah, y - ah / 2);
        ctx.lineTo(fromX + dir * ah, y + ah / 2);
        ctx.closePath();
        ctx.fill();
    }
    arrowhead(x1, x2 > x1 ? -1 : 1);
    arrowhead(x2, x2 > x1 ? 1 : -1);
    // Vertical tick lines at each end
    const tickH = 10;
    ctx.beginPath();
    ctx.moveTo(x1, y - tickH / 2);
    ctx.lineTo(x1, y + tickH / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y - tickH / 2);
    ctx.lineTo(x2, y + tickH / 2);
    ctx.stroke();
    // Label
    const label = drawing.text ?? "N";
    const midX = (x1 + x2) / 2;
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const padX = 6;
    const labelW = Math.max(ctx.measureText(label).width + padX * 2, 26);
    const labelH = fontSize + 6;
    const labelY = y - 18;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(midX - labelW / 2, labelY - labelH / 2, labelW, labelH, 3);
    ctx.fill();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, midX, labelY);
    ctx.restore();
}
export function hitTestBarsCount(p0, p1, mouse, tolerance) {
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    const y = (p0.y + p1.y) / 2;
    // Hit the horizontal line
    if (Math.abs(mouse.y - y) <= tolerance && mouse.x >= x1 - tolerance && mouse.x <= x2 + tolerance) {
        return true;
    }
    // Hit left or right anchor
    if (Math.hypot(mouse.x - p0.x, mouse.y - p0.y) <= tolerance * 2)
        return true;
    if (Math.hypot(mouse.x - p1.x, mouse.y - p1.y) <= tolerance * 2)
        return true;
    return false;
}
const BarsCount = {
    name: "barsCount",
    createDraft(startPoint) {
        return createDrawingObject("barsCount", [startPoint, startPoint]);
    },
    updateDraft(object, nextPoint) {
        return replacePoint(object, 1, nextPoint);
    },
};
export default BarsCount;
