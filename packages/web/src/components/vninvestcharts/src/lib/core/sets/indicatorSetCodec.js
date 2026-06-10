import { INDICATOR_SETS_STORAGE_KEY } from "../types/indicator-set.js";
function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `indicator-set-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function createSeriesId(type) {
    return `${type.toLowerCase()}-${createId()}`;
}
function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function cloneSeries(series) {
    return series.map((item) => ({
        ...item,
        id: item.id ?? createSeriesId(item.type),
        params: item.params ? { ...item.params } : undefined,
    }));
}
function clonePane(pane) {
    return {
        ...pane,
        series: cloneSeries(pane.series),
    };
}
export function cloneIndicatorSet(set) {
    return {
        ...set,
        panes: set.panes.map(clonePane),
    };
}
export function createIndicatorSet(name, panes, now = Date.now()) {
    return {
        id: createId(),
        name: name.trim(),
        createdAt: now,
        updatedAt: now,
        panes: panes.map(clonePane),
        isBuiltin: false,
    };
}
function isYAxisSide(value) {
    return value === "left" || value === "right";
}
function isTooltipMode(value) {
    return value === "ohlc" || value === "value" || value === "none";
}
function isSeriesTypeId(value) {
    return typeof value === "string" && value.length > 0;
}
function isSeriesConfig(candidate) {
    if (!isPlainObject(candidate)) {
        return false;
    }
    if (candidate.id !== undefined && typeof candidate.id !== "string") {
        return false;
    }
    if (!isSeriesTypeId(candidate.type) || !isYAxisSide(candidate.yAxis)) {
        return false;
    }
    if (candidate.params !== undefined && !isPlainObject(candidate.params)) {
        return false;
    }
    if (candidate.overlay !== undefined && typeof candidate.overlay !== "boolean") {
        return false;
    }
    if (candidate.color !== undefined && typeof candidate.color !== "string") {
        return false;
    }
    if (candidate.visible !== undefined && typeof candidate.visible !== "boolean") {
        return false;
    }
    return true;
}
function isPaneDescriptor(candidate) {
    if (!isPlainObject(candidate)) {
        return false;
    }
    return typeof candidate.id === "string"
        && typeof candidate.label === "string"
        && typeof candidate.pinned === "boolean"
        && typeof candidate.visible === "boolean"
        && typeof candidate.heightRatio === "number"
        && Array.isArray(candidate.series)
        && candidate.series.every(isSeriesConfig)
        && typeof candidate.splitScale === "boolean"
        && isTooltipMode(candidate.tooltip);
}
export function sanitizeIndicatorSet(candidate, options = {}) {
    if (!isPlainObject(candidate)) {
        return null;
    }
    if (typeof candidate.id !== "string" || typeof candidate.name !== "string") {
        return null;
    }
    if (typeof candidate.createdAt !== "number" || !Number.isFinite(candidate.createdAt)) {
        return null;
    }
    if (typeof candidate.updatedAt !== "number" || !Number.isFinite(candidate.updatedAt)) {
        return null;
    }
    if (!Array.isArray(candidate.panes) || candidate.panes.length === 0 || !candidate.panes.every(isPaneDescriptor)) {
        return null;
    }
    if (candidate.isBuiltin !== undefined && typeof candidate.isBuiltin !== "boolean") {
        return null;
    }
    if (options.allowedSeriesTypes && options.allowedSeriesTypes.length > 0) {
        const allowed = new Set(options.allowedSeriesTypes);
        for (const pane of candidate.panes) {
            for (const series of pane.series) {
                if (!allowed.has(series.type)) {
                    return null;
                }
            }
        }
    }
    return {
        id: candidate.id,
        name: candidate.name.trim(),
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt,
        panes: candidate.panes.map(clonePane),
        isBuiltin: options.preserveBuiltin ? candidate.isBuiltin === true : false,
    };
}
export function sanitizeIndicatorSetsStorage(candidate, options = {}) {
    if (!isPlainObject(candidate)) {
        return null;
    }
    if (candidate.version !== 1 || !Array.isArray(candidate.sets)) {
        return null;
    }
    const sanitized = candidate.sets
        .map((set) => sanitizeIndicatorSet(set, options))
        .filter((set) => set !== null && set.name.length > 0);
    if (sanitized.length === 0) {
        return [];
    }
    const byId = new Map();
    for (const set of sanitized) {
        byId.set(set.id, set);
    }
    return [...byId.values()];
}
export function loadIndicatorSets(storage, options = {}) {
    if (!storage) {
        return [];
    }
    try {
        const raw = storage.getItem(INDICATOR_SETS_STORAGE_KEY);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        return sanitizeIndicatorSetsStorage(parsed, options) ?? [];
    }
    catch {
        return [];
    }
}
export function saveIndicatorSets(storage, sets) {
    if (!storage) {
        return;
    }
    try {
        const payload = {
            version: 1,
            sets: sets.map((set) => cloneIndicatorSet({ ...set, isBuiltin: false })),
        };
        storage.setItem(INDICATOR_SETS_STORAGE_KEY, JSON.stringify(payload));
    }
    catch {
        // ignore storage quota / sandbox errors
    }
}
export function indicatorSetToPaneLayout(set) {
    return set.panes.map(clonePane);
}
export function buildIndicatorSetFileName(name, createdAt) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\-\s]+/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "indicator-set";
    const stamp = new Date(createdAt).toISOString().slice(0, 10).replace(/-/g, "");
    return `${slug}-${stamp}.vnsc-set`;
}
export function stringifyIndicatorSet(set) {
    return JSON.stringify(cloneIndicatorSet(set), null, 2);
}
