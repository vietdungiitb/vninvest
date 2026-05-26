import { chartPointToPixel } from "../coordinateUtils.js";
import { createDrawingObject, replaceNextPoint } from "../shared.js";
export function calculateAbcdPatternMetrics(drawing, scales) {
    const [aPoint, bPoint, cPoint, dPoint] = drawing.points;
    if (!aPoint || !bPoint || !cPoint || !dPoint) {
        return null;
    }
    const points = [aPoint, bPoint, cPoint, dPoint].map((point) => chartPointToPixel(point, scales));
    const [a, b, c, d] = points;
    const ab = Math.abs(b.y - a.y);
    const bc = Math.abs(c.y - b.y);
    const cd = Math.abs(d.y - c.y);
    return {
        points,
        segmentMidpoints: [
            { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
            { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 },
            { x: (c.x + d.x) / 2, y: (c.y + d.y) / 2 },
        ],
        ab,
        bc,
        cd,
        bcToAb: ab > 0 ? bc / ab : null,
        cdToBc: bc > 0 ? cd / bc : null,
    };
}
const AbcdPattern = {
    name: "abcdPattern",
    createDraft: (startPoint) => createDrawingObject("abcdPattern", [startPoint, startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
    render: () => undefined,
};
export default AbcdPattern;
