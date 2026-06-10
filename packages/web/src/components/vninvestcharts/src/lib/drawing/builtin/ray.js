import { createDrawingObject, replacePoint } from "../shared.js";
const Ray = {
    name: "ray",
    createDraft: (startPoint) => createDrawingObject("ray", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default Ray;
