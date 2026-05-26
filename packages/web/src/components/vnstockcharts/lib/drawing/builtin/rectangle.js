import { createDrawingObject, replacePoint } from "../shared.js";
const Rectangle = {
    name: "rectangle",
    createDraft: (startPoint) => createDrawingObject("rectangle", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default Rectangle;
