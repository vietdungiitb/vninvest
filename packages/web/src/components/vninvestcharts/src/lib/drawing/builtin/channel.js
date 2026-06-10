import { createDrawingObject, replaceLastPoint } from "../shared.js";
const Channel = {
    name: "channel",
    createDraft: (startPoint) => createDrawingObject("channel", [startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceLastPoint(draft, nextPoint),
    render: () => undefined,
};
export default Channel;
