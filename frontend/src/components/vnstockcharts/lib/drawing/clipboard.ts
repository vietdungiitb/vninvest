import type { DrawingObject } from "./types";
import { clonePoint } from "./shared";
import { resolveDrawingStyle } from "./drawingStyleRegistry";

export interface DrawingPlacement {
	paneId?: string;
	yScaleId?: string;
}

export function cloneDrawingSnapshot(drawing: DrawingObject, placement?: DrawingPlacement): DrawingObject {
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

export function offsetDrawingByPixels(drawing: DrawingObject, xOffset: number, yOffset: number, placement?: DrawingPlacement): DrawingObject {
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