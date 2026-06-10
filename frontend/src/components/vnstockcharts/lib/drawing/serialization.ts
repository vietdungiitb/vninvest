import type { DrawingHistory } from "./history";
import type { DrawingObject } from "./types";
import { normalizeDrawingObject } from "./DrawingStorage";

export const DRAWING_SCHEMA_VERSION = 1;

export interface SerializedDrawingsPayload {
	schemaVersion: number;
	drawings: DrawingObject[];
}

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

/** Export drawings wrapped with a schema version block */
export function exportDrawingsJSON(drawings: readonly DrawingObject[]): string {
	return JSON.stringify({
		schemaVersion: DRAWING_SCHEMA_VERSION,
		drawings,
	} as SerializedDrawingsPayload);
}

/** Import drawings, seamlessly supporting both legacy flat arrays and wrapped payloads */
export function importDrawingsJSON(raw: string): DrawingObject[] {
	const parsed = JSON.parse(raw) as unknown;
	if (Array.isArray(parsed)) {
		return migrateDrawings(parsed, 0);
	}
	const payload = parsed as SerializedDrawingsPayload;
	return migrateDrawings(payload.drawings ?? [], payload.schemaVersion ?? 0);
}

function migrateDrawings(drawings: unknown[], fromVersion: number): DrawingObject[] {
	let result = drawings;
	if (fromVersion < 1) {
		// v0 -> v1: All items are normalized safely, translating fibLevels -> fibLevelConfigs, etc.
		result = result.map((item, index) => normalizeDrawingObject(item, index));
	}
	return result as DrawingObject[];
}