import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const HLine: DrawingToolDefinition = {
	name: "hLine",
	createDraft: (startPoint) => createDrawingObject("hLine", [startPoint, { ...startPoint }], { extendLeft: true, extendRight: true }),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, { x: nextPoint.x, y: draft.points[0]?.y ?? nextPoint.y }),
	render: () => undefined,
};

export default HLine;