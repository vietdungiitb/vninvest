import type { DrawingToolDefinition } from "../types";
import { createDrawingObject, replacePoint } from "../shared";

const DateAndPriceRange: DrawingToolDefinition = {
	name: "dateAndPriceRange",
	createDraft: (startPoint) => createDrawingObject("dateAndPriceRange", [startPoint, startPoint]),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default DateAndPriceRange;