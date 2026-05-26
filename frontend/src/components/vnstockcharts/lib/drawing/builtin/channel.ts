import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replaceNextPoint } from "../shared";

const Channel: DrawingToolDefinition = {
	name: "channel",
	createDraft: (startPoint) => createDrawingObject("channel", [startPoint, startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
	render: () => undefined,
};

export default Channel;