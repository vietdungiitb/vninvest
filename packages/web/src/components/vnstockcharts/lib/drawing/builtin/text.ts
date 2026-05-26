import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const Text: DrawingToolDefinition = {
	name: "text",
	createDraft: (startPoint) => createDrawingObject("text", [startPoint], { text: "" }),
	updateDraft: (draft, nextPoint) => {
		if (draft.points.length === 0) {
			return createDrawingObject("text", [nextPoint], { ...draft, text: draft.text ?? "" });
		}
		return replacePoint(draft, 0, nextPoint);
	},
	render: () => undefined,
};

export default Text;