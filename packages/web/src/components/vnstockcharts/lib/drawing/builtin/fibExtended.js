import { chartPointToPixel } from "../coordinateUtils.js";
import { createDrawingObject, replaceNextPoint } from "../shared.js";
// 2-point tools
const TWO_POINT = [
    "fibSpeedResistanceFan",
    "fibCircles",
    "fibSpiral",
    "fibSpeedResistanceArcs",
];
// 3-point tools
const THREE_POINT = [
    "fibChannel",
    "trendBasedFibTime",
    "fibWedge",
    "pitchfan",
];
export const FIB_EXTENDED_LEVELS = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0, 1.272, 1.618, 2.618, 4.236];
export const FIB_FAN_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
export function calculateFibExtendedGeometry(drawing, scales) {
    if (drawing.points.length < 2)
        return null;
    const p1 = chartPointToPixel(drawing.points[0], scales);
    const p2 = chartPointToPixel(drawing.points[1], scales);
    const p3 = drawing.points[2] ? chartPointToPixel(drawing.points[2], scales) : undefined;
    return { type: drawing.type, p1, p2, p3 };
}
// ───── factory helpers ──────────────────────────────────────────────────────
function createTool(name, nPoints) {
    return {
        name,
        createDraft: (startPoint) => createDrawingObject(name, Array.from({ length: nPoints }, () => ({ ...startPoint }))),
        updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
    };
}
export const FibChannel = createTool("fibChannel", 3);
export const FibSpeedResistanceFan = createTool("fibSpeedResistanceFan", 2);
export const TrendBasedFibTime = createTool("trendBasedFibTime", 3);
export const FibCircles = createTool("fibCircles", 2);
export const FibSpiral = createTool("fibSpiral", 2);
export const FibSpeedResistanceArcs = createTool("fibSpeedResistanceArcs", 2);
export const FibWedge = createTool("fibWedge", 3);
export const Pitchfan = createTool("pitchfan", 3);
export { TWO_POINT as FIB_EXTENDED_TWO_POINT, THREE_POINT as FIB_EXTENDED_THREE_POINT };
