import { clonePoint } from "./shared.js";
import { resolveDrawingStyle } from "./drawingStyleRegistry.js";
export function cloneDrawingSnapshot(drawing, placement) {
    return {
        ...drawing,
        points: drawing.points.map(clonePoint),
        style: { ...resolveDrawingStyle(drawing) },
        fibLevels: drawing.fibLevels ? [...drawing.fibLevels] : undefined,
        riskReward: drawing.riskReward ? { ...drawing.riskReward } : undefined,
        paneId: placement?.paneId ?? drawing.paneId,
        yScaleId: placement?.yScaleId ?? drawing.yScaleId,
    };
}
export function offsetDrawingByPixels(drawing, xOffset, yOffset, placement) {
    const now = Date.now();
    const snapshot = cloneDrawingSnapshot(drawing, placement);
    return {
        ...snapshot,
        id: `${drawing.id}-clone-${now}`,
        points: snapshot.points.map((point) => ({ x: point.x + xOffset, y: point.y + yOffset })),
        style: { ...snapshot.style },
        fibLevels: snapshot.fibLevels ? [...snapshot.fibLevels] : undefined,
        riskReward: snapshot.riskReward ? { ...snapshot.riskReward } : undefined,
        locked: false,
        visible: true,
        clonedFrom: drawing.id,
        zIndex: (drawing.zIndex ?? 0) + 1,
        createdAt: now,
        updatedAt: now,
    };
}
