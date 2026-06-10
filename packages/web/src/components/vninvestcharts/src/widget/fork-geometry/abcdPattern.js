import { chartPointToPixel } from "../../lib/drawing/coordinateUtils.js";
import { createDrawingObject, replaceLastPoint } from "../../lib/drawing/shared.js";
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
    // DT-16-T01: Use price-coordinate distances for ratio calculation so ratios
    // remain valid even when two points map to the same pixel Y (e.g. heavy zoom-out).
    const priceAB = Math.abs(bPoint.y - aPoint.y);
    const priceBC = Math.abs(cPoint.y - bPoint.y);
    const priceCD = Math.abs(dPoint.y - cPoint.y);
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
        bcToAb: priceAB > 1e-10 ? priceBC / priceAB : null,
        cdToBc: priceBC > 1e-10 ? priceCD / priceBC : null,
    };
}
const AbcdPattern = {
    name: "abcdPattern",
    createDraft: (startPoint) => createDrawingObject("abcdPattern", [startPoint, startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
    render: () => undefined,
};
export default AbcdPattern;
