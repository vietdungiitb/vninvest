import { chartPointToPixel } from "../coordinateUtils.js";
import { createDrawingObject, replaceNextPoint } from "../shared.js";
export function calculatePitchforkGeometry(drawing, scales) {
    const [pivotPoint, leftPoint, rightPoint] = drawing.points;
    if (!pivotPoint || !leftPoint || !rightPoint) {
        return null;
    }
    const pivot = chartPointToPixel(pivotPoint, scales);
    const leftSwing = chartPointToPixel(leftPoint, scales);
    const rightSwing = chartPointToPixel(rightPoint, scales);
    const midpoint = {
        x: (leftSwing.x + rightSwing.x) / 2,
        y: (leftSwing.y + rightSwing.y) / 2,
    };
    return {
        pivot,
        leftSwing,
        rightSwing,
        midpoint,
        direction: {
            x: midpoint.x - pivot.x,
            y: midpoint.y - pivot.y,
        },
    };
}
const Pitchfork = {
    name: "pitchfork",
    createDraft: (startPoint) => createDrawingObject("pitchfork", [startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
    render: () => undefined,
};
export default Pitchfork;
