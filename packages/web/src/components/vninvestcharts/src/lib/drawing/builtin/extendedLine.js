import { createDrawingObject, replacePoint } from "../shared.js";
const ExtendedLine = {
    name: "extendedLine",
    createDraft: (startPoint) => createDrawingObject("extendedLine", [startPoint, startPoint], { extendLeft: true, extendRight: true }),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default ExtendedLine;
