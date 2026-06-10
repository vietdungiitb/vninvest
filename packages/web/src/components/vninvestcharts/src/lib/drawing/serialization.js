import { normalizeDrawingObject } from "./DrawingStorage.js";
export const DRAWING_SCHEMA_VERSION = 1;
export function serializeDrawingObject(drawing) {
    return JSON.stringify(drawing);
}
export function deserializeDrawingObject(payload) {
    return JSON.parse(payload);
}
export function serializeDrawings(drawings) {
    return JSON.stringify(drawings);
}
export function deserializeDrawings(payload) {
    return JSON.parse(payload);
}
export function serializeDrawingHistory(history) {
    return JSON.stringify(history);
}
export function deserializeDrawingHistory(payload) {
    return JSON.parse(payload);
}
/** Export drawings wrapped with a schema version block */
export function exportDrawingsJSON(drawings) {
    return JSON.stringify({
        schemaVersion: DRAWING_SCHEMA_VERSION,
        drawings,
    });
}
/** Import drawings, seamlessly supporting both legacy flat arrays and wrapped payloads */
export function importDrawingsJSON(raw) {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
        return migrateDrawings(parsed, 0);
    }
    const payload = parsed;
    return migrateDrawings(payload.drawings ?? [], payload.schemaVersion ?? 0);
}
function migrateDrawings(drawings, fromVersion) {
    let result = drawings;
    if (fromVersion < 1) {
        // v0 -> v1: All items are normalized safely, translating fibLevels -> fibLevelConfigs, etc.
        result = result.map((item, index) => normalizeDrawingObject(item, index));
    }
    return result;
}
