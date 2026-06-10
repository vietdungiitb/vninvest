import { chartPointToPixel } from "../../lib/drawing/coordinateUtils.js";
import { createDrawingObject, replacePoint } from "../../lib/drawing/shared.js";
export const DEFAULT_FIB_TIME_ZONE_LEVELS = [1, 2, 3, 5, 8, 13, 21, 34];
export function calculateFibTimeZoneGeometry(drawing, scales) {
    const [startPoint, endPoint] = drawing.points;
    if (!startPoint || !endPoint) {
        return null;
    }
    const start = chartPointToPixel(startPoint, scales);
    const end = chartPointToPixel(endPoint, scales);
    const stepX = end.x - start.x;
    const levels = drawing.fibLevels ?? DEFAULT_FIB_TIME_ZONE_LEVELS;
    return {
        start,
        end,
        stepX,
        levels,
        positions: levels.map((level) => start.x + stepX * level),
    };
}
const FibTimeZone = {
    name: "fibTimeZone",
    createDraft: (startPoint) => createDrawingObject("fibTimeZone", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default FibTimeZone;
