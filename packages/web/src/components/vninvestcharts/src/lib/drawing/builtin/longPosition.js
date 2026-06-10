import { createDrawingObject, replacePoint } from "../shared.js";
function calculateRiskReward(startPoint, endPoint) {
    return {
        entry: startPoint.y,
        stop: Math.min(startPoint.y, endPoint.y),
        target: Math.max(startPoint.y, endPoint.y),
    };
}
const LongPosition = {
    name: "longPosition",
    createDraft: (startPoint) => createDrawingObject("longPosition", [startPoint, startPoint], { riskReward: calculateRiskReward(startPoint, startPoint) }),
    updateDraft: (draft, nextPoint) => {
        const updated = replacePoint(draft, 1, nextPoint);
        return {
            ...updated,
            riskReward: calculateRiskReward(updated.points[0] ?? nextPoint, updated.points[1] ?? nextPoint),
        };
    },
    render: () => undefined,
};
export default LongPosition;
