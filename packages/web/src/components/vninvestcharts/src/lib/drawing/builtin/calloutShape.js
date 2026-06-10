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
export function measureCalloutBox(anchor, text, fontSize = 12) {
    const label = text.trim().length ? text : "Text";
    const paddingX = 8;
    const paddingY = 6;
    const width = Math.max(fontSize * 2.6, label.length * fontSize * 0.58 + paddingX * 2);
    const height = fontSize + paddingY * 2;
    return {
        x: anchor.x - width / 2,
        y: anchor.y - height / 2,
        width,
        height,
        text: label,
    };
}
export function renderCallout(ctx, drawing, points) {
    const [boxAnchor, tailAnchor] = points;
    if (!boxAnchor || !tailAnchor) {
        return;
    }
    const fontSize = drawing.style.fontSize ?? 12;
    const box = measureCalloutBox(boxAnchor, drawing.text ?? "", fontSize);
    ctx.save();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.beginPath();
    ctx.roundRect(box.x, box.y, box.width, box.height, 8);
    ctx.fillStyle = drawing.style.fill && drawing.style.fill !== "transparent" ? drawing.style.fill : "#f8fafc";
    ctx.globalAlpha = (drawing.style.fillOpacity ?? 0.92) * (drawing.style.opacity ?? 1);
    ctx.fill();
    ctx.globalAlpha = drawing.style.opacity ?? 1;
    ctx.strokeStyle = drawing.style.stroke;
    ctx.lineWidth = drawing.style.strokeWidth;
    ctx.setLineDash(dashForStyle(drawing.style.strokeDasharray));
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(boxAnchor.x, box.y + box.height);
    ctx.lineTo(tailAnchor.x, tailAnchor.y);
    ctx.stroke();
    ctx.fillStyle = drawing.style.stroke;
    ctx.font = `${fontSize}px ${drawing.style.fontFamily ?? "sans-serif"}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(box.text, boxAnchor.x, boxAnchor.y + 0.5);
    ctx.restore();
}
export function hitTestCallout(boxAnchor, tailAnchor, mouse, text, fontSize, tolerance) {
    const box = measureCalloutBox(boxAnchor, text, fontSize);
    if (pointInRect(mouse, box.x - tolerance, box.y - tolerance, box.width + tolerance * 2, box.height + tolerance * 2)) {
        return true;
    }
    return distanceToSegment(mouse, { x: boxAnchor.x, y: box.y + box.height }, tailAnchor) <= tolerance;
}
const CalloutShape = {
    name: "callout",
    createDraft: (startPoint) => createDrawingObject("callout", [startPoint, startPoint], { text: "Text" }),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default CalloutShape;
