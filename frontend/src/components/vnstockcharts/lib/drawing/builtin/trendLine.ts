import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const TrendLine: DrawingToolDefinition = {
	name: "trendLine",
	createDraft: (startPoint) => createDrawingObject("trendLine", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default TrendLine;