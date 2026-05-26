import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const Ray: DrawingToolDefinition = {
	name: "ray",
	createDraft: (startPoint) => createDrawingObject("ray", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default Ray;