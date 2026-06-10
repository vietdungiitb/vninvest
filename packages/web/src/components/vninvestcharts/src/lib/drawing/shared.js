let drawingIdSeed = 0;
export function createDrawingId() {
    drawingIdSeed += 1;
    return `drawing-${drawingIdSeed}`;
}
export const defaultDrawingStyle = {
    stroke: "#2962ff",
    strokeWidth: 1,
    strokeDasharray: "solid",
    fill: "transparent",
    opacity: 1,
};
export function resolvePointAnchor(point) {
    return {
        xIndexFloat: typeof point.xIndexFloat === "number" && Number.isFinite(point.xIndexFloat) ? point.xIndexFloat : undefined,
        timeMsHint: typeof point.timeMsHint === "number" && Number.isFinite(point.timeMsHint) ? point.timeMsHint : point.x,
        yPrice: typeof point.yPrice === "number" && Number.isFinite(point.yPrice) ? point.yPrice : point.y,
    };
}
export function clonePoint(point) {
    return {
        x: point.x,
        y: point.y,
        ...(typeof point.xIndexFloat === "number" && Number.isFinite(point.xIndexFloat) ? { xIndexFloat: point.xIndexFloat } : {}),
        ...(typeof point.timeMsHint === "number" && Number.isFinite(point.timeMsHint) ? { timeMsHint: point.timeMsHint } : {}),
        ...(typeof point.yPrice === "number" && Number.isFinite(point.yPrice) ? { yPrice: point.yPrice } : {}),
    };
}
export function createDrawingObject(type, points, patch = {}) {
    const now = Date.now();
    return {
        id: patch.id ?? createDrawingId(),
        type,
        points: points.map(clonePoint),
        style: { ...defaultDrawingStyle, ...patch.style },
        paneId: patch.paneId,
        yScaleId: patch.yScaleId,
        text: patch.text,
        fibLevels: patch.fibLevels ? [...patch.fibLevels] : undefined,
        fibLevelConfigs: patch.fibLevelConfigs ? patch.fibLevelConfigs.map((c) => ({ ...c })) : undefined,
        label: patch.label,
        symbol: patch.symbol,
        timeframe: patch.timeframe,
        zIndex: patch.zIndex,
        clonedFrom: patch.clonedFrom,
        groupId: patch.groupId,
        riskReward: patch.riskReward ? { ...patch.riskReward } : undefined,
        segmentStyles: patch.segmentStyles
            ? Object.fromEntries(Object.entries(patch.segmentStyles).map(([key, value]) => [key, { ...value }]))
            : undefined,
        segmentVisible: patch.segmentVisible ? { ...patch.segmentVisible } : undefined,
        extendLeft: patch.extendLeft,
        extendRight: patch.extendRight,
        locked: patch.locked,
        visible: patch.visible ?? true,
        createdAt: patch.createdAt ?? now,
        updatedAt: patch.updatedAt ?? now,
    };
}
export function appendPoint(object, nextPoint) {
    return {
        ...object,
        points: [...object.points.map(clonePoint), clonePoint(nextPoint)],
        updatedAt: Date.now(),
    };
}
export function replacePoint(object, index, nextPoint) {
    return {
        ...object,
        points: object.points.map((point, pointIndex) => (pointIndex === index ? clonePoint(nextPoint) : clonePoint(point))),
        updatedAt: Date.now(),
    };
}
export function replaceNextPoint(object, nextPoint) {
    const startPoint = object.points[0];
    if (!startPoint) {
        return replacePoint(object, Math.max(0, object.points.length - 1), nextPoint);
    }
    const placeholderIndex = object.points.findIndex((point, index) => index > 0 && point.x === startPoint.x && point.y === startPoint.y);
    const targetIndex = placeholderIndex === -1 ? object.points.length - 1 : placeholderIndex;
    return replacePoint(object, targetIndex, nextPoint);
}
/**
 * DT-20: Always replace only the LAST point.
 * Use this for multi-step tool `updateDraft` (mouse-move preview) so that moving
 * the mouse quickly does NOT consume intermediate placeholder points.
 * `replaceNextPoint` remains correct for `handleClick` (to advance to next step).
 */
export function replaceLastPoint(object, nextPoint) {
    return replacePoint(object, Math.max(0, object.points.length - 1), nextPoint);
}
