/**
 * TDM-C: Date Range measurement tool
 * 2-point model: p[0].x = x-start, p[1].x = x-end (y ignored for band, but kept for anchor)
 * Renders a vertical band between two x positions + bar-count label at the top.
 */
import { createDrawingObject, replacePoint } from "../shared.js";
export function renderDateRange(ctx, drawing, points, chartWidth, chartHeight) {
    const [p0, p1] = points;
    if (!p0 || !p1)
        return;
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    const bandW = x2 - x1;
    if (bandW < 1)
        return;
    const fillBase = "#2962ff";
    ctx.save();
    ctx.globalAlpha = (drawing.style.fillOpacity ?? 0.12) * (drawing.style.opacity ?? 1);
    ctx.fillStyle = fillBase;
    ctx.fillRect(x1, 0, bandW, chartHeight);
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    // Left & right boundary lines
    ctx.strokeStyle = drawing.style.stroke ?? fillBase;
    ctx.lineWidth = drawing.style.strokeWidth ?? 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x1, 0);
    ctx.lineTo(x1, chartHeight);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, 0);
    ctx.lineTo(x2, chartHeight);
    ctx.stroke();
    ctx.setLineDash([]);
    // Horizontal arrow line at top
    const arrowY = 20;
    ctx.strokeStyle = drawing.style.stroke ?? fillBase;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x2, arrowY);
    ctx.stroke();
    // Arrowheads
    const ah = 4;
    ctx.beginPath();
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x1 + ah, arrowY - ah);
    ctx.moveTo(x1, arrowY);
    ctx.lineTo(x1 + ah, arrowY + ah);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, arrowY);
    ctx.lineTo(x2 - ah, arrowY - ah);
    ctx.moveTo(x2, arrowY);
    ctx.lineTo(x2 - ah, arrowY + ah);
    ctx.stroke();
    // Label at centre-top
    const label = drawing.text ?? "Δt";
    const midX = (x1 + x2) / 2;
    const fontSize = 12;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const padX = 6;
    const labelW = Math.max(ctx.measureText(label).width + padX * 2, 30);
    const labelH = fontSize + 6;
    const lx = midX;
    const ly = arrowY + 14;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = drawing.style.stroke ?? fillBase;
    ctx.beginPath();
    ctx.roundRect(lx - labelW / 2, ly - labelH / 2, labelW, labelH, 3);
    ctx.fill();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(label, lx, ly);
    ctx.restore();
}
export function hitTestDateRange(p0, p1, mouse, tolerance, chartHeight) {
    const x1 = Math.min(p0.x, p1.x);
    const x2 = Math.max(p0.x, p1.x);
    // Hit the two boundary lines
    if ((Math.abs(mouse.x - x1) <= tolerance || Math.abs(mouse.x - x2) <= tolerance) &&
        mouse.y >= 0 && mouse.y <= chartHeight) {
        return true;
    }
    // Hit interior band
    if (mouse.x >= x1 - tolerance && mouse.x <= x2 + tolerance && mouse.y >= 0 && mouse.y <= chartHeight) {
        return true;
    }
    return false;
}
const DateRange = {
    name: "dateRange",
    createDraft(startPoint) {
        return createDrawingObject("dateRange", [startPoint, startPoint]);
    },
    updateDraft(object, nextPoint) {
        return replacePoint(object, 1, nextPoint);
    },
};
export default DateRange;
