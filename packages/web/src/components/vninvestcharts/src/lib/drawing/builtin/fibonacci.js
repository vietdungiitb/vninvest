import { createDrawingObject, replacePoint } from "../shared.js";
import { DEFAULT_FIB_LEVELS } from "../renderCanvas.js";
const DEFAULT_FIB_LEVEL_CONFIGS = DEFAULT_FIB_LEVELS.map((ratio) => ({ ratio, visible: true }));
const Fibonacci = {
    name: "fibonacci",
    createDraft: (startPoint) => createDrawingObject("fibonacci", [startPoint, startPoint], { fibLevelConfigs: DEFAULT_FIB_LEVEL_CONFIGS }),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default Fibonacci;
