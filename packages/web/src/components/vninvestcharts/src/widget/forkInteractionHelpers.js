import { replacePoint } from "../lib/drawing/shared.js";
export function isPrimaryPointerPressed(pointerContext) {
    return (pointerContext.buttons & 1) === 1;
}
export const FORK_DRAWING_TOOL_CURSOR_MAP = {
    hLine: "ns-resize",
    vLine: "ew-resize",
    text: "default",
};
export function isForkMultiStepTool(toolName) {
    return (toolName === "channel"
        || toolName === "parallelChannel"
        || toolName === "pitchfork"
        || toolName === "triangle"
        || toolName === "abcdPattern"
        || toolName === "elliottImpulse"
        || toolName === "elliottCorrection"
        || toolName === "elliottTriangle"
        || toolName === "elliottDoubleCombo"
        || toolName === "elliottTripleCombo"
        || toolName === "xabcdPattern"
        || toolName === "cypherPattern"
        || toolName === "headAndShoulders"
        || toolName === "trianglePattern"
        || toolName === "threeDrivesPattern"
        || toolName === "fibChannel"
        || toolName === "trendBasedFibTime"
        || toolName === "fibWedge"
        || toolName === "pitchfan");
}
export function hasForkDraftProgress(drawing) {
    const startPoint = drawing.points[0];
    if (!startPoint) {
        return false;
    }
    return drawing.points.some((point, index) => index > 0 && (point.x !== startPoint.x || point.y !== startPoint.y));
}
export function resolveForkMultiStepDraftOnClick(draft, nextPoint) {
    const startPoint = draft.points[0];
    const lastIndex = draft.points.length - 1;
    const nextInteriorIdx = startPoint
        ? draft.points.findIndex((point, index) => index > 0 && index < lastIndex && point.x === startPoint.x && point.y === startPoint.y)
        : -1;
    if (nextInteriorIdx >= 0) {
        return {
            nextDraft: replacePoint(draft, nextInteriorIdx, nextPoint),
            shouldComplete: false,
        };
    }
    return {
        nextDraft: replacePoint(draft, lastIndex, nextPoint),
        shouldComplete: true,
    };
}
export function isForkSinglePointTool(toolName) {
    return toolName === "hLine"
        || toolName === "vLine"
        || toolName === "text"
        || toolName === "priceLabel";
}
