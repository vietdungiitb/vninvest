import { clearDrawingStyleOverrides, clearSeriesStyleOverrides, listDrawingStyleOverrides, listSeriesStyleOverrides, overrideDrawingStyle, overrideSeriesStyle, } from "../index.js";
export const STYLE_OVERRIDES_STORAGE_KEY = "rsc-demo-style-overrides-v1";
function getStorage(storage) {
    if (storage) {
        return storage;
    }
    if (typeof localStorage === "undefined") {
        return null;
    }
    return localStorage;
}
function isPlainRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function normalizeStyleMap(value) {
    if (!isPlainRecord(value)) {
        return {};
    }
    return Object.fromEntries(Object.entries(value)
        .filter(([id, style]) => typeof id === "string" && id.length > 0 && isPlainRecord(style))
        .map(([id, style]) => [id, { ...style }]));
}
function isEmptyOverrides(overrides) {
    return Object.keys(overrides.series).length === 0 && Object.keys(overrides.drawings).length === 0;
}
export function snapshotStyleOverrides() {
    return {
        series: listSeriesStyleOverrides(),
        drawings: listDrawingStyleOverrides(),
    };
}
export function loadPersistedStyleOverrides(storage) {
    const resolvedStorage = getStorage(storage);
    if (!resolvedStorage) {
        return null;
    }
    try {
        const raw = resolvedStorage.getItem(STYLE_OVERRIDES_STORAGE_KEY);
        if (!raw) {
            return null;
        }
        const parsed = JSON.parse(raw);
        if (!isPlainRecord(parsed)) {
            return null;
        }
        return {
            series: normalizeStyleMap(parsed.series),
            drawings: normalizeStyleMap(parsed.drawings),
        };
    }
    catch {
        return null;
    }
}
export function saveCurrentStyleOverrides(storage) {
    const resolvedStorage = getStorage(storage);
    if (!resolvedStorage) {
        return;
    }
    const overrides = snapshotStyleOverrides();
    try {
        if (isEmptyOverrides(overrides)) {
            resolvedStorage.removeItem(STYLE_OVERRIDES_STORAGE_KEY);
            return;
        }
        resolvedStorage.setItem(STYLE_OVERRIDES_STORAGE_KEY, JSON.stringify(overrides));
    }
    catch {
        // ignore storage failures
    }
}
export function restorePersistedStyleOverrides(storage) {
    clearSeriesStyleOverrides();
    clearDrawingStyleOverrides();
    const overrides = loadPersistedStyleOverrides(storage);
    if (!overrides) {
        return;
    }
    Object.entries(overrides.series).forEach(([instanceId, style]) => {
        overrideSeriesStyle(instanceId, style);
    });
    Object.entries(overrides.drawings).forEach(([drawingId, style]) => {
        overrideDrawingStyle(drawingId, style);
    });
}
