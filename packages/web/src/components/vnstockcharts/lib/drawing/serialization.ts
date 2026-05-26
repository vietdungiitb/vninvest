import type { DrawingHistory } from "./history";
import type { DrawingObject } from "./types";

export function serializeDrawingObject(drawing: DrawingObject) {
	return JSON.stringify(drawing);
}

export function deserializeDrawingObject(payload: string) {
	return JSON.parse(payload) as DrawingObject;
}

export function serializeDrawings(drawings: readonly DrawingObject[]) {
	return JSON.stringify(drawings);
}

export function deserializeDrawings(payload: string) {
	return JSON.parse(payload) as DrawingObject[];
}

export function serializeDrawingHistory(history: DrawingHistory) {
	return JSON.stringify(history);
}

export function deserializeDrawingHistory(payload: string) {
	return JSON.parse(payload) as DrawingHistory;
}