import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const VLine: DrawingToolDefinition = {
	name: "vLine",
	createDraft: (startPoint) => createDrawingObject("vLine", [startPoint, { ...startPoint }], { extendLeft: false, extendRight: false }),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, { x: draft.points[0]?.x ?? nextPoint.x, y: nextPoint.y }),
	render: () => undefined,
};

export default VLine;