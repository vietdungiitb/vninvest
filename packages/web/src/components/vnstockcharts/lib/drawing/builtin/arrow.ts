import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const Arrow: DrawingToolDefinition = {
	name: "arrow",
	createDraft: (startPoint) => createDrawingObject("arrow", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default Arrow;