import type { DrawingToolDefinition, FibLevelConfig } from "../types";
import { createDrawingObject, replacePoint } from "../shared";
import { DEFAULT_FIB_EXTENSION_LEVELS } from "../renderCanvas";

const DEFAULT_FIB_EXTENSION_CONFIGS: FibLevelConfig[] = DEFAULT_FIB_EXTENSION_LEVELS.map((ratio) => ({ ratio, visible: true }));

const FibExtension: DrawingToolDefinition = {
	name: "fibExtension",
	createDraft: (startPoint) => createDrawingObject("fibExtension", [startPoint, startPoint], { fibLevelConfigs: DEFAULT_FIB_EXTENSION_CONFIGS }),
	updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
	render: () => undefined,
};

export default FibExtension;