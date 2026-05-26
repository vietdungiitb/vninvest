import type { DrawingToolDefinition, FibLevelConfig } from "../types";
import { createDrawingObject, replacePoint } from "../shared";
import { DEFAULT_FIB_LEVELS } from "../renderCanvas";

const DEFAULT_FIB_LEVEL_CONFIGS: FibLevelConfig[] = DEFAULT_FIB_LEVELS.map((ratio) => ({ ratio, visible: true }));

const Fibonacci: DrawingToolDefinition = {
	name: "fibonacci",
	createDraft: (startPoint) => createDrawingObject("fibonacci", [startPoint, startPoint], { fibLevelConfigs: DEFAULT_FIB_LEVEL_CONFIGS }),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default Fibonacci;