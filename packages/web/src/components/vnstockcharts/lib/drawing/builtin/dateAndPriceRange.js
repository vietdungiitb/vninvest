import { createDrawingObject, replacePoint } from "../shared.js";
const DateAndPriceRange = {
    name: "dateAndPriceRange",
    createDraft: (startPoint) => createDrawingObject("dateAndPriceRange", [startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replacePoint(draft, 1, nextPoint),
    render: () => undefined,
};
export default DateAndPriceRange;
