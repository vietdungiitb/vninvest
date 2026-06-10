import { chartPointToPixel } from "../../lib/drawing/coordinateUtils.js";
import { createDrawingObject, replaceLastPoint } from "../../lib/drawing/shared.js";
// Fractional grid lines at 1/8 intervals
export const GANN_FRACTIONS = [1 / 8, 2 / 8, 3 / 8, 4 / 8, 5 / 8, 6 / 8, 7 / 8];
export function calculateGannAdvancedGeometry(drawing, scales) {
    const { points, type } = drawing;
    if (type === "gannSquareFixed") {
        if (points.length < 1)
            return null;
        const p1 = chartPointToPixel(points[0], scales);
        const size = drawing.gannSquareSize ?? 50;
        // size is in price units — convert to pixels
        const sizeInPx = Math.abs(scales.yScale(0) - scales.yScale(size));
        return { type: type, x1: p1.x, y1: p1.y, x2: p1.x + sizeInPx, y2: p1.y + sizeInPx };
    }
    if (points.length < 2)
        return null;
    const p1 = chartPointToPixel(points[0], scales);
    const p2 = chartPointToPixel(points[1], scales);
    let x2 = p2.x;
    let y2 = p2.y;
    if (type === "gannSquare") {
        // Force equal pixel dimensions
        const side = Math.min(Math.abs(p2.x - p1.x), Math.abs(p2.y - p1.y));
        x2 = p1.x + (p2.x >= p1.x ? side : -side);
        y2 = p1.y + (p2.y >= p1.y ? side : -side);
    }
    return { type: type, x1: p1.x, y1: p1.y, x2, y2 };
}
// ───── tool definitions ──────────────────────────────────────────────────────
export const GannBox = {
    name: "gannBox",
    createDraft: (startPoint) => createDrawingObject("gannBox", [{ ...startPoint }, { ...startPoint }]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
};
export const GannSquare = {
    name: "gannSquare",
    createDraft: (startPoint) => createDrawingObject("gannSquare", [{ ...startPoint }, { ...startPoint }]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
};
export const GannSquareFixed = {
    name: "gannSquareFixed",
    createDraft: (startPoint) => ({
        ...createDrawingObject("gannSquareFixed", [{ ...startPoint }]),
        gannSquareSize: 100,
    }),
    updateDraft: (draft, _nextPoint) => draft,
};
