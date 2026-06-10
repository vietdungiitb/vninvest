import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replaceLastPoint } from "../shared";

const Channel: DrawingToolDefinition = {
	name: "channel",
	createDraft: (startPoint) => createDrawingObject("channel", [startPoint, startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
	render: () => undefined,
};

export default Channel;