import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const Polyline: DrawingToolDefinition = {
	name: "polyline",
	createDraft: (startPoint) => createDrawingObject("polyline", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, draft.points.length - 1, nextPoint),
	render: () => undefined,
};

export default Polyline;