import { createDrawingObject, replaceNextPoint } from "../shared.js";
const Channel = {
    name: "channel",
    createDraft: (startPoint) => createDrawingObject("channel", [startPoint, startPoint, startPoint]),
    updateDraft: (draft, nextPoint) => replaceNextPoint(draft, nextPoint),
    render: () => undefined,
};
export default Channel;
