import { createDrawingObject, replacePoint } from "../shared.js";
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
function pointInRect(point, x, y, width, height) {
    return point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height;
}
export function measurePriceLabelTag(chartWidth, text, fontSize = 11) {
    const label = text.trim().length ? text : "Price";
    const paddingX = 6;
    const paddingY = 4;
    const width = Math.max(fontSize * 3, label.length * fontSize * 0.58 + paddingX * 2);
    const height = fontSize + paddingY * 2;
    return {
        x: chartWidth - width - 2,
        width,
        height,
        text: label,
    };
}
export function renderPriceLabel(ctx, drawing, points, chartWidth) {
    const [anchor] = points;
    if (!anchor) {
        return;
    }
    const fontSize = drawing.style.fontSize ?? 11;
    const tag = measurePriceLabelTag(chartWidth, drawing.text ?? "", fontSize);
    const tagY = anchor.y - tag.height / 2;
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.strokeStyle = drawing.style.stroke;
    ctx.lineWidth = drawing.style.strokeWidth;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(0, anchor.y);
    ctx.lineTo(tag.x, anchor.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.roundRect(tag.x, tagY, tag.width, tag.height, 4);
    ctx.fillStyle = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : drawing.style.stroke;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${fontSize}px ${drawing.style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(tag.text, tag.x + 6, anchor.y + 0.5);
    ctx.restore();
}
export function hitTestPriceLabel(anchor, mouse, chartWidth, text, fontSize, tolerance) {
    const tag = measurePriceLabelTag(chartWidth, text, fontSize);
    const tagY = anchor.y - tag.height / 2;
    if (pointInRect(mouse, tag.x - tolerance, tagY - tolerance, tag.width + tolerance * 2, tag.height + tolerance * 2)) {
        return true;
    }
    return distanceToSegment(mouse, { x: 0, y: anchor.y }, { x: tag.x, y: anchor.y }) <= tolerance;
}
const PriceLabelShape = {
    name: "priceLabel",
    createDraft: (startPoint) => createDrawingObject("priceLabel", [startPoint], { text: "Price" }),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 0, nextPoint),
    render: () => undefined,
};
export default PriceLabelShape;
