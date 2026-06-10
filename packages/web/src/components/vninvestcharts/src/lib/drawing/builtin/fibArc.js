import { chartPointToPixel } from "../coordinateUtils.js";
import { createDrawingObject, replacePoint } from "../shared.js";
export const DEFAULT_FIB_ARC_LEVELS = [0.382, 0.5, 0.618];
export function calculateFibArcGeometry(drawing, scales) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return null;
    }
    const center = chartPointToPixel(startPoint, scales);
    const reference = chartPointToPixel(endPoint, scales);
    const baseRadius = Math.hypot(reference.x - center.x, reference.y - center.y);
    const levels = drawing.fibLevels ?? DEFAULT_FIB_ARC_LEVELS;
    return {
        center,
        reference,
        baseRadius,
        levels,
        radii: levels.map((level) => baseRadius * level),
    };
}
const FibArc = {
    name: "fibArc",
    createDraft: (startPoint) => createDrawingObject("fibArc", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default FibArc;
