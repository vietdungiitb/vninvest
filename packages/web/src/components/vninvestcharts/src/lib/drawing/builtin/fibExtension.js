import { createDrawingObject, replacePoint } from "../shared.js";
import { DEFAULT_FIB_EXTENSION_LEVELS } from "../renderCanvas.js";
const DEFAULT_FIB_EXTENSION_CONFIGS = DEFAULT_FIB_EXTENSION_LEVELS.map((ratio) => ({ ratio, visible: true }));
const FibExtension = {
    name: "fibExtension",
    createDraft: (startPoint) => createDrawingObject("fibExtension", [startPoint, startPoint], { fibLevelConfigs: DEFAULT_FIB_EXTENSION_CONFIGS }),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default FibExtension;
