import type { DrawingObject, DrawingStyle, DrawingToolType, Point } from "./types";

let drawingIdSeed = 0;

export function createDrawingId() {
	drawingIdSeed += 1;
	return `drawing-${drawingIdSeed}`;
}

export const defaultDrawingStyle: DrawingStyle = {
	stroke: "#2962ff",
	strokeWidth: 1,
	strokeDasharray: "solid",
	fill: "transparent",
	opacity: 1,
};

export function clonePoint(point: Point): Point {
	return { x: point.x, y: point.y };
}

export function createDrawingObject(type: DrawingToolType, points: Point[], patch: Partial<DrawingObject> = {}): DrawingObject {
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
		extendLeft: patch.extendLeft,
		extendRight: patch.extendRight,
		locked: patch.locked,
		visible: patch.visible ?? true,
		createdAt: patch.createdAt ?? now,
		updatedAt: patch.updatedAt ?? now,
	};
}

export function appendPoint(object: DrawingObject, nextPoint: Point) {
	return {
		...object,
		points: [...object.points.map(clonePoint), clonePoint(nextPoint)],
		updatedAt: Date.now(),
	};
}

export function replacePoint(object: DrawingObject, index: number, nextPoint: Point) {
	return {
		...object,
		points: object.points.map((point, pointIndex) => (pointIndex === index ? nextPoint : point)),
		updatedAt: Date.now(),
	};
}

export function replaceNextPoint(object: DrawingObject, nextPoint: Point) {
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
export function replaceLastPoint(object: DrawingObject, nextPoint: Point) {
	return replacePoint(object, Math.max(0, object.points.length - 1), nextPoint);
}