import { chartPointToPixel } from "../../lib/drawing/coordinateUtils.js";
import { createDrawingObject, replaceLastPoint } from "../../lib/drawing/shared.js";
export function calculateCycleGeometry(drawing, scales) {
    const pts = drawing.points;
    if (pts.length < 2)
        return null;
    const p1 = chartPointToPixel(pts[0], scales);
    const p2 = chartPointToPixel(pts[1], scales);
    const count = drawing.cycleParams?.count ?? 8;
    const rawAmp = drawing.cycleParams?.amplitude;
    const amplitude = rawAmp ?? (Math.abs(p2.y - p1.y) / 2 || 40);
    return { type: drawing.type, x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, count, amplitude };
}
// ── Tool definitions ──────────────────────────────────────────────────────────
export const CyclicLines = {
    name: "cyclicLines",
    createDraft: (startPoint) => ({
        ...createDrawingObject("cyclicLines", [{ ...startPoint }, { ...startPoint }]),
        cycleParams: { count: 8 },
    }),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
};
export const TimeCycles = {
    name: "timeCycles",
    createDraft: (startPoint) => ({
        ...createDrawingObject("timeCycles", [{ ...startPoint }, { ...startPoint }]),
        cycleParams: { count: 8 },
    }),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
};
export const SineLine = {
    name: "sineLine",
    createDraft: (startPoint) => ({
        ...createDrawingObject("sineLine", [{ ...startPoint }, { ...startPoint }]),
        cycleParams: { count: 3, amplitude: 40 },
    }),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
};
