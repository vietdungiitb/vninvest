/** Line tool family: types that share the same 2-point geometry but differ in extension semantics. */
export const LINE_FAMILY_TYPES = ["trendLine", "ray", "extendedLine"];
/** Returns the extendLeft/extendRight flags for a given line-family drawing type. */
export function lineTypeFlagsFor(type) {
    switch (type) {
        case "ray":
            return { type, extendLeft: false, extendRight: true };
        case "extendedLine":
            return { type, extendLeft: true, extendRight: true };
        case "trendLine":
        default:
            return { type: "trendLine", extendLeft: false, extendRight: false };
    }
}
/** Returns true if the drawing type belongs to the line family (trendLine / ray / extendedLine). */
export function isLineFamilyType(type) {
    return LINE_FAMILY_TYPES.includes(type);
}
function normalizeSelectedObjectIds(objectIds) {
    return [...new Set(objectIds.filter((objectId) => typeof objectId === "string" && objectId.length > 0))];
}
function selectionStateFor(objectIds) {
    const normalized = normalizeSelectedObjectIds(objectIds);
    if (normalized.length === 0) {
        return { type: "idle" };
    }
    if (normalized.length === 1) {
        return { type: "selected", objectId: normalized[0] };
    }
    return { type: "selectedMultiple", objectIds: normalized };
}
export function getSelectedObjectIds(state) {
    switch (state.type) {
        case "selected":
            return [state.objectId];
        case "selectedMultiple":
            return [...state.objectIds];
        case "moving":
        case "resizing":
        case "editing":
            return [state.objectId];
        case "movingGroup":
            return [...state.objectIds];
        default:
            return [];
    }
}
export function drawingReducer(state, action) {
    switch (action.type) {
        case "START_DRAWING":
            return {
                type: "drawing",
                toolName: action.toolName,
                object: action.object,
            };
        case "UPDATE_DRAWING":
            return state.type === "drawing"
                ? {
                    ...state,
                    object: action.object,
                }
                : state;
        case "COMPLETE_DRAWING":
            return {
                type: "complete",
                object: action.object,
            };
        case "SELECT_OBJECT":
            return {
                type: "selected",
                objectId: action.objectId,
            };
        case "SET_SELECTED_OBJECTS":
            return selectionStateFor(action.objectIds);
        case "START_MOVING":
            return {
                type: "moving",
                objectId: action.objectId,
                startPoint: action.startPoint,
                currentPoint: action.currentPoint,
            };
        case "START_RESIZING":
            return {
                type: "resizing",
                objectId: action.objectId,
                handle: action.handle,
            };
        case "START_EDITING":
            return {
                type: "editing",
                objectId: action.objectId,
                text: action.text ?? "",
            };
        case "CANCEL":
            return { type: "idle" };
        case "START_RUBBER_BAND":
            return { type: "rubberBand" };
        case "COMMIT_RUBBER_BAND":
            return selectionStateFor(action.objectIds);
        case "START_MOVING_GROUP":
            return { type: "movingGroup", objectIds: normalizeSelectedObjectIds(action.objectIds) };
        default:
            return state;
    }
}
