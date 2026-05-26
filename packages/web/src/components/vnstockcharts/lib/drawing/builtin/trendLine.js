import { createDrawingObject, replacePoint } from "../shared.js";
const TrendLine = {
    name: "trendLine",
    createDraft: (startPoint) => createDrawingObject("trendLine", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default TrendLine;
