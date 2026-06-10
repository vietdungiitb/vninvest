/**
 * TDM-C: Price Range measurement tool
 * 2-point model: p[0] = anchor (x ignored, y = price1), p[1] = second price (y = price2)
 * Renders a horizontal band between two price levels + delta label on the right edge.
 */
import { createDrawingObject, replacePoint } from "../shared.js";
export function renderPriceRange(ctx, drawing, points, chartWidth, chartHeight) {
    const [p0, p1] = points;
    if (!p0 || !p1)
        return;
    const y1 = Math.min(p0.y, p1.y);
    const y2 = Math.max(p0.y, p1.y);
    const bandH = y2 - y1;
    if (bandH < 1)
        return;
    const isUp = p1.y < p0.y;
    const fillBase = isUp ? "#089981" : "#f23645";
    ctx.save();
    ctx.globalAlpha = (drawing.style.fillOpacity ?? 0.16) * (drawing.style.opacity ?? 1);
    ctx.fillStyle = fillBase;
    ctx.fillRect(0, y1, chartWidth, bandH);
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    // Top & bottom boundary lines
    ctx.strokeStyle = fillBase;
    ctx.lineWidth = drawing.style.strokeWidth ?? 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y1);
    ctx.lineTo(chartWidth, y1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y2);
    ctx.lineTo(chartWidth, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Delta label at centre-right
    const midY = (y1 + y2) / 2;
    const label = drawing.text ?? "Δ";
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    const padX = 6;
    const labelW = ctx.measureText(label).width + padX * 2;
    const labelH = fontSize + 6;
    const lx = chartWidth - 4;
    const ly = midY;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = fillBase;
    const rx = lx - labelW;
    const ry = ly - labelH / 2;
    ctx.beginPath();
    ctx.roundRect(rx, ry, labelW, labelH, 3);
    ctx.fill();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, lx - padX, ly);
    ctx.restore();
}
export function hitTestPriceRange(p0, p1, mouse, tolerance, chartWidth) {
    const y1 = Math.min(p0.y, p1.y);
    const y2 = Math.max(p0.y, p1.y);
    // Hit the two boundary lines
    if ((Math.abs(mouse.y - y1) <= tolerance || Math.abs(mouse.y - y2) <= tolerance) &&
        mouse.x >= 0 && mouse.x <= chartWidth) {
        return true;
    }
    // Hit interior band
    if (mouse.y >= y1 - tolerance && mouse.y <= y2 + tolerance && mouse.x >= 0 && mouse.x <= chartWidth) {
        return true;
    }
    return false;
}
const PriceRange = {
    name: "priceRange",
    createDraft(startPoint) {
        return createDrawingObject("priceRange", [startPoint, startPoint]);
    },
    updateDraft(object, nextPoint) {
        return replacePoint(object, 1, nextPoint);
    },
};
export default PriceRange;
