import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const ExtendedLine: DrawingToolDefinition = {
	name: "extendedLine",
	createDraft: (startPoint) => createDrawingObject("extendedLine", [startPoint, startPoint], { extendLeft: true, extendRight: true }),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default ExtendedLine;