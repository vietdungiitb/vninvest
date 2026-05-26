import type { DrawingObject, DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

function calculateRiskReward(startPoint: DrawingObject["points"][number], endPoint: DrawingObject["points"][number]) {
	return {
		entry: startPoint.y,
		stop: Math.max(startPoint.y, endPoint.y),
		target: Math.min(startPoint.y, endPoint.y),
	};
}

const ShortPosition: DrawingToolDefinition = {
	name: "shortPosition",
	createDraft: (startPoint) => createDrawingObject("shortPosition", [startPoint, startPoint], { riskReward: calculateRiskReward(startPoint, startPoint) }),
	updateDraft: (draft, nextPoint) => {
		const updated = replacePoint(draft, 1, nextPoint);
		return {
			...updated,
			riskReward: calculateRiskReward(updated.points[0] ?? nextPoint, updated.points[1] ?? nextPoint),
		};
	},
	render: () => undefined,
};

export default ShortPosition;