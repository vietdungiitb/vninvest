import { chartPointToPixel } from "../coordinateUtils.js";
import { createDrawingObject, replaceLastPoint } from "../shared.js";
export function calculateParallelChannelGeometry(drawing, scales) {
    const [startPoint, endPoint, offsetPoint] = drawing.points;
    if (!startPoint || !endPoint || !offsetPoint) {
        return null;
    }
    const start = chartPointToPixel(startPoint, scales);
    const end = chartPointToPixel(endPoint, scales);
    const offsetAnchor = chartPointToPixel(offsetPoint, scales);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) {
        return {
            start,
            end,
            offsetAnchor,
            offsetVector: { x: offsetAnchor.x - start.x, y: offsetAnchor.y - start.y },
            width: 0,
        };
    }
    const normal = { x: -dy / length, y: dx / length };
    const offsetDistance = (offsetAnchor.x - start.x) * normal.x + (offsetAnchor.y - start.y) * normal.y;
    return {
        start,
        end,
        offsetAnchor,
        offsetVector: {
            x: normal.x * offsetDistance,
            y: normal.y * offsetDistance,
        },
        width: Math.abs(offsetDistance),
    };
}
const ParallelChannel = {
    name: "parallelChannel",
    createDraft: (startPoint) => createDrawingObject("parallelChannel", [startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
    render: () => undefined,
};
export default ParallelChannel;
