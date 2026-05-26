import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const Rectangle: DrawingToolDefinition = {
	name: "rectangle",
	createDraft: (startPoint) => createDrawingObject("rectangle", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default Rectangle;