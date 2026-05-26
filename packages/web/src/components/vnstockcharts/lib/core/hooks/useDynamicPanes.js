import { useCallback, useEffect, useMemo, useReducer } from "react";
import { DEFAULT_PANES, PANE_LAYOUT_STORAGE_KEY, PANE_MAX_VISIBLE, isDefaultPaneId } from "../types/pane-descriptor.js";
const FRAME_VERTICAL_MARGIN = 36;
const MIN_PANE_HEIGHT = 80;
function createId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `pane-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
function createSeriesId(type) {
    return `${type.toLowerCase()}-${createId()}`;
}
function createScaleSlotId(paneId, yAxis) {
    return `${paneId}-${yAxis}`;
}
function cloneSeries(series) {
    return series.map((item) => ({
        ...item,
        id: item.id ?? createSeriesId(item.type),
        params: item.params ? { ...item.params } : undefined,
        subColors: item.subColors ? { ...item.subColors } : undefined,
    }));
}
function clonePane(pane) {
    return {
        ...pane,
        series: cloneSeries(pane.series),
    };
}
function clonePaneList(panes) {
    return panes.map(clonePane);
}
function normalizeDefaultPane(pane, template) {
    return {
        ...pane,
        label: template.label,
        pinned: template.pinned,
        tooltip: template.tooltip,
    };
}
function normalizeLoadedPaneLayout(panes) {
    const cloned = clonePaneList(panes);
    const byId = new Map(cloned.map((pane) => [pane.id, pane]));
    const defaultPanes = DEFAULT_PANES.map((template) => {
        const stored = byId.get(template.id);
        const pane = stored ? normalizeDefaultPane(stored, template) : clonePane(template);
        syncSplitScale(pane);
        return pane;
    });
    const customPanes = cloned.filter((pane) => !isDefaultPaneId(pane.id));
    customPanes.forEach(syncSplitScale);
    return normalizeVisibleRatios([...defaultPanes, ...customPanes]);
}
function syncSplitScale(pane) {
    pane.series.forEach((series) => {
        series.scaleSlotId = createScaleSlotId(pane.id, series.yAxis);
    });
    const activeSeries = pane.series.filter((series) => series.visible !== false);
    pane.splitScale = activeSeries.some((series) => series.yAxis === "left") && activeSeries.some((series) => series.yAxis === "right");
}
function getVisiblePanes(panes) {
    return panes.filter((pane) => pane.visible);
}
function normalizeVisibleRatios(panes) {
    const next = clonePaneList(panes);
    const visible = next.filter((pane) => pane.visible);
    const total = visible.reduce((sum, pane) => sum + pane.heightRatio, 0);
    if (visible.length === 0) {
        return next;
    }
    if (total <= 0) {
        const ratio = 1 / visible.length;
        visible.forEach((pane) => {
            pane.heightRatio = ratio;
        });
        return next;
    }
    visible.forEach((pane) => {
        pane.heightRatio = pane.heightRatio / total;
    });
    return next;
}
function visibleCount(panes) {
    return panes.reduce((count, pane) => count + (pane.visible ? 1 : 0), 0);
}
function visibleIndices(panes) {
    const indices = [];
    panes.forEach((pane, index) => {
        if (pane.visible) {
            indices.push(index);
        }
    });
    return indices;
}
function ratiosToHeights(panes, available) {
    const visible = getVisiblePanes(panes);
    if (visible.length === 0) {
        return [];
    }
    const heights = [];
    let allocated = 0;
    visible.forEach((pane, index) => {
        if (index === visible.length - 1) {
            heights.push(Math.max(available - allocated, MIN_PANE_HEIGHT));
            return;
        }
        const height = Math.max(Math.round(pane.heightRatio * available), MIN_PANE_HEIGHT);
        heights.push(height);
        allocated += height;
    });
    const total = heights.reduce((sum, value) => sum + value, 0);
    if (total !== available && heights.length > 0) {
        heights[heights.length - 1] += available - total;
    }
    return heights;
}
function heightsToRatios(heights) {
    const total = heights.reduce((sum, value) => sum + value, 0);
    if (total <= 0) {
        return heights.map(() => 1 / heights.length);
    }
    return heights.map((height) => height / total);
}
function validatePane(candidate) {
    if (!candidate || typeof candidate !== "object") {
        return false;
    }
    const pane = candidate;
    return typeof pane.id === "string"
        && typeof pane.label === "string"
        && typeof pane.pinned === "boolean"
        && typeof pane.visible === "boolean"
        && typeof pane.heightRatio === "number"
        && Array.isArray(pane.series)
        && typeof pane.splitScale === "boolean"
        && (pane.tooltip === "ohlc" || pane.tooltip === "value" || pane.tooltip === "none");
}
function sanitizeLayout(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const stored = raw;
    if (stored.version !== 1 || !Array.isArray(stored.panes) || stored.panes.length === 0) {
        return null;
    }
    if (!stored.panes.every(validatePane)) {
        return null;
    }
    return normalizeLoadedPaneLayout(stored.panes);
}
function readStoredPaneLayout(storage) {
    if (!storage) {
        return makeDefaultLayout();
    }
    try {
        const raw = storage.getItem(PANE_LAYOUT_STORAGE_KEY);
        if (!raw) {
            return makeDefaultLayout();
        }
        const parsed = JSON.parse(raw);
        const layout = sanitizeLayout(parsed);
        return layout ?? makeDefaultLayout();
    }
    catch {
        return makeDefaultLayout();
    }
}
function writeStoredPaneLayout(panes, storage) {
    if (!storage) {
        return;
    }
    try {
        storage.setItem(PANE_LAYOUT_STORAGE_KEY, JSON.stringify({
            version: 1,
            panes,
        }));
    }
    catch {
        // ignore storage quota / sandbox errors
    }
}
function makeDefaultLayout() {
    return normalizeLoadedPaneLayout(DEFAULT_PANES);
}
function replacePaneLayout(panes) {
    if (panes.length === 0) {
        return makeDefaultLayout();
    }
    const next = normalizeVisibleRatios(clonePaneList(panes));
    next.forEach(syncSplitScale);
    return next;
}
function mutateVisibleRatio(panes, visiblePaneIndex, nextHeightRatio) {
    const next = clonePaneList(panes);
    const visible = next.filter((pane) => pane.visible);
    const pane = visible[visiblePaneIndex];
    if (!pane) {
        return next;
    }
    const ratio = Math.max(nextHeightRatio, 0);
    pane.heightRatio = ratio;
    return normalizeVisibleRatios(next);
}
function reorderVisiblePanes(panes, fromVisibleIndex, toVisibleIndex) {
    if (fromVisibleIndex === toVisibleIndex) {
        return clonePaneList(panes);
    }
    const next = clonePaneList(panes);
    const visibleSlots = visibleIndices(next);
    if (fromVisibleIndex < 0 || fromVisibleIndex >= visibleSlots.length) {
        return next;
    }
    if (toVisibleIndex < 0 || toVisibleIndex >= visibleSlots.length) {
        return next;
    }
    if (toVisibleIndex === 0 || next[visibleSlots[fromVisibleIndex]]?.pinned) {
        return next;
    }
    const orderedVisible = visibleSlots.map((index) => next[index]);
    const [moved] = orderedVisible.splice(fromVisibleIndex, 1);
    if (!moved) {
        return next;
    }
    orderedVisible.splice(toVisibleIndex, 0, moved);
    let cursor = 0;
    return next.map((pane) => {
        if (!pane.visible) {
            return pane;
        }
        const replacement = orderedVisible[cursor];
        cursor += 1;
        return replacement;
    });
}
function resolveSeriesIndex(series, seriesType, seriesIndex) {
    if (typeof seriesIndex === "number" && seriesIndex >= 0 && seriesIndex < series.length) {
        return seriesIndex;
    }
    return series.findIndex((item) => item.type === seriesType);
}
export function dynamicPanesReducer(state, action) {
    const maxVisiblePanes = Math.max(1, ("maxVisiblePanes" in action ? action.maxVisiblePanes : undefined) ?? PANE_MAX_VISIBLE);
    switch (action.type) {
        case "toggleVisible": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.id);
            if (!pane || pane.pinned) {
                return next;
            }
            if (pane.visible && visibleCount(next) === 1) {
                return next;
            }
            if (pane.visible) {
                pane.visible = false;
            }
            else {
                if (visibleCount(next) >= maxVisiblePanes) {
                    return next;
                }
                pane.visible = true;
            }
            return normalizeVisibleRatios(next);
        }
        case "addPane": {
            const next = clonePaneList(state);
            if (visibleCount(next) >= maxVisiblePanes) {
                return next;
            }
            const pane = {
                ...action.pane,
                id: createId(),
                series: cloneSeries(action.pane.series),
            };
            syncSplitScale(pane);
            next.push(pane);
            return normalizeVisibleRatios(next);
        }
        case "removePane": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.id);
            if (!pane || pane.pinned || isDefaultPaneId(pane.id)) {
                return next;
            }
            if (pane.visible && visibleCount(next) === 1) {
                return next;
            }
            // Soft-delete: hide the pane so it can be restored from the Panes menu
            pane.visible = false;
            return normalizeVisibleRatios(next);
        }
        case "deletePane": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.id);
            if (!pane || pane.pinned || isDefaultPaneId(pane.id)) {
                return next;
            }
            if (pane.visible && visibleCount(next) === 1) {
                return next;
            }
            return normalizeVisibleRatios(next.filter((item) => item.id !== action.id));
        }
        case "renamePane": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.paneId);
            if (!pane || pane.pinned || isDefaultPaneId(pane.id)) {
                return next;
            }
            const nextLabel = action.label.trim();
            if (nextLabel.length === 0 || nextLabel === pane.label) {
                return next;
            }
            pane.label = nextLabel;
            return next;
        }
        case "restorePane": {
            const next = clonePaneList(state);
            if (visibleCount(next) >= maxVisiblePanes) {
                return next;
            }
            const pane = next.find((item) => item.id === action.id);
            if (!pane) {
                return next;
            }
            pane.visible = true;
            // Restore all series visibility when restoring a pane
            pane.series.forEach((s) => { s.visible = true; });
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "addSeries": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.paneId);
            if (!pane) {
                return next;
            }
            if (!pane.visible) {
                if (visibleCount(next) >= maxVisiblePanes) {
                    return next;
                }
                pane.visible = true;
            }
            pane.series.push({
                ...action.series,
                id: action.series.id ?? createSeriesId(action.series.type),
                params: action.series.params ? { ...action.series.params } : undefined,
            });
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "removeSeries": {
            const next = clonePaneList(state);
            const pane = next.find((item) => item.id === action.paneId);
            if (!pane) {
                return next;
            }
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            if (seriesIndex < 0) {
                return next;
            }
            pane.series = pane.series.filter((_, index) => index !== seriesIndex);
            if (!pane.pinned) {
                const anyVisible = pane.series.some((series) => series.visible !== false);
                if (!anyVisible && pane.visible && visibleCount(next) > 1) {
                    pane.visible = false;
                }
            }
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "applyDelta": {
            const next = clonePaneList(state);
            const visible = getVisiblePanes(next);
            const topPane = visible[action.splitterIndex];
            const bottomPane = visible[action.splitterIndex + 1];
            if (!topPane || !bottomPane) {
                return next;
            }
            const available = Math.max(action.available, MIN_PANE_HEIGHT * 2);
            const heights = ratiosToHeights(visible, available);
            const topHeight = heights[action.splitterIndex];
            const bottomHeight = heights[action.splitterIndex + 1];
            const pairTotal = topHeight + bottomHeight;
            const minTop = MIN_PANE_HEIGHT;
            const minBottom = MIN_PANE_HEIGHT;
            const nextTop = Math.min(Math.max(topHeight + action.deltaY, minTop), pairTotal - minBottom);
            const nextBottom = pairTotal - nextTop;
            heights[action.splitterIndex] = nextTop;
            heights[action.splitterIndex + 1] = nextBottom;
            const updated = clonePaneList(next);
            let visibleCursor = 0;
            updated.forEach((pane) => {
                if (!pane.visible) {
                    return;
                }
                pane.heightRatio = heights[visibleCursor] / available;
                visibleCursor += 1;
            });
            return normalizeVisibleRatios(updated);
        }
        case "resetToDefault":
            return makeDefaultLayout();
        case "replaceLayout":
            return replacePaneLayout(action.panes);
        case "reorderPanes":
            return reorderVisiblePanes(state, action.fromVisibleIndex, action.toVisibleIndex);
        case "toggleSeriesVisible": {
            const next = clonePaneList(state);
            const pane = next.find((p) => p.id === action.paneId);
            if (!pane)
                return next;
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            const series = pane.series[seriesIndex];
            if (!series)
                return next;
            // Toggle: false → true, undefined/true → false
            series.visible = series.visible === false ? true : false;
            if (series.visible === true && !pane.visible) {
                if (visibleCount(next) >= maxVisiblePanes) {
                    return next;
                }
                pane.visible = true;
            }
            // AD-2: auto-hide non-pinned pane when all its series are hidden
            if (!pane.pinned) {
                const anyVisible = pane.series.some((s) => s.visible !== false);
                if (!anyVisible && pane.visible && visibleCount(next) > 1) {
                    pane.visible = false;
                }
            }
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "updateSeriesParams": {
            const next = clonePaneList(state);
            const pane = next.find((p) => p.id === action.paneId);
            if (!pane)
                return next;
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            const series = pane.series[seriesIndex];
            if (!series)
                return next;
            series.params = { ...(series.params ?? {}), ...action.params };
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "updateSeriesYAxis": {
            const next = clonePaneList(state);
            const pane = next.find((p) => p.id === action.paneId);
            if (!pane)
                return next;
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            const series = pane.series[seriesIndex];
            if (!series)
                return next;
            series.yAxis = action.yAxis;
            syncSplitScale(pane);
            return normalizeVisibleRatios(next);
        }
        case "updateSeriesColor": {
            const next = clonePaneList(state);
            const pane = next.find((p) => p.id === action.paneId);
            if (!pane)
                return next;
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            const series = pane.series[seriesIndex];
            if (!series)
                return next;
            series.color = action.color || undefined;
            return next;
        }
        case "updateSeriesSubColor": {
            const next = clonePaneList(state);
            const pane = next.find((p) => p.id === action.paneId);
            if (!pane)
                return next;
            const seriesIndex = resolveSeriesIndex(pane.series, action.seriesType, action.seriesIndex);
            const series = pane.series[seriesIndex];
            if (!series)
                return next;
            series.subColors = { ...(series.subColors ?? {}), [action.subKey]: action.color };
            return next;
        }
        default:
            return clonePaneList(state);
    }
}
export function createDefaultPaneLayout() {
    return makeDefaultLayout();
}
export function loadPaneLayout(storage) {
    return readStoredPaneLayout(storage);
}
export function savePaneLayout(panes, storage) {
    writeStoredPaneLayout(panes, storage);
}
export function useDynamicPanes(totalHeight, options = {}) {
    const [panes, dispatch] = useReducer(dynamicPanesReducer, undefined, () => loadPaneLayout(typeof localStorage !== "undefined" ? localStorage : undefined));
    const maxVisiblePanes = Math.max(1, options.maxVisiblePanes ?? PANE_MAX_VISIBLE);
    const available = useMemo(() => {
        const visible = panes.filter((pane) => pane.visible).length;
        return Math.max(totalHeight - FRAME_VERTICAL_MARGIN, visible * MIN_PANE_HEIGHT);
    }, [panes, totalHeight]);
    const visiblePanes = useMemo(() => getVisiblePanes(panes), [panes]);
    const heights = useMemo(() => ratiosToHeights(panes, available), [panes, available]);
    useEffect(() => {
        savePaneLayout(panes, typeof localStorage !== "undefined" ? localStorage : undefined);
    }, [panes]);
    const toggleVisible = useCallback((id) => {
        dispatch({ type: "toggleVisible", id, maxVisiblePanes });
    }, [maxVisiblePanes]);
    const addPane = useCallback((pane) => {
        dispatch({ type: "addPane", pane, maxVisiblePanes });
    }, [maxVisiblePanes]);
    const removePane = useCallback((id) => {
        dispatch({ type: "removePane", id });
    }, []);
    const deletePane = useCallback((id) => {
        dispatch({ type: "deletePane", id });
    }, []);
    const renamePane = useCallback((paneId, label) => {
        dispatch({ type: "renamePane", paneId, label });
    }, []);
    const restorePane = useCallback((id) => {
        dispatch({ type: "restorePane", id, maxVisiblePanes });
    }, [maxVisiblePanes]);
    const addSeries = useCallback((paneId, series) => {
        dispatch({ type: "addSeries", paneId, series, maxVisiblePanes });
    }, [maxVisiblePanes]);
    const removeSeries = useCallback((paneId, seriesType, seriesIndex) => {
        dispatch({ type: "removeSeries", paneId, seriesType, seriesIndex });
    }, []);
    const applyDelta = useCallback((splitterIndex, deltaY) => {
        dispatch({ type: "applyDelta", splitterIndex, deltaY, available });
    }, [available]);
    const replaceLayout = useCallback((panes) => {
        dispatch({ type: "replaceLayout", panes });
    }, []);
    const resetToDefault = useCallback(() => {
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.removeItem(PANE_LAYOUT_STORAGE_KEY);
            }
        }
        catch {
            // ignore storage errors
        }
        dispatch({ type: "resetToDefault" });
    }, []);
    const reorderPanes = useCallback((fromVisibleIndex, toVisibleIndex) => {
        dispatch({ type: "reorderPanes", fromVisibleIndex, toVisibleIndex });
    }, []);
    const toggleSeriesVisible = useCallback((paneId, seriesType, seriesIndex) => {
        dispatch({ type: "toggleSeriesVisible", paneId, seriesType, seriesIndex, maxVisiblePanes });
    }, [maxVisiblePanes]);
    const updateSeriesParams = useCallback((paneId, seriesType, params, seriesIndex) => {
        dispatch({ type: "updateSeriesParams", paneId, seriesType, params, seriesIndex });
    }, []);
    const updateSeriesYAxis = useCallback((paneId, seriesType, yAxis, seriesIndex) => {
        dispatch({ type: "updateSeriesYAxis", paneId, seriesType, yAxis, seriesIndex });
    }, []);
    const updateSeriesColor = useCallback((paneId, seriesType, color, seriesIndex) => {
        dispatch({ type: "updateSeriesColor", paneId, seriesType, color, seriesIndex });
    }, []);
    const updateSeriesSubColor = useCallback((paneId, seriesType, subKey, color, seriesIndex) => {
        dispatch({ type: "updateSeriesSubColor", paneId, seriesType, subKey, color, seriesIndex });
    }, []);
    return {
        panes,
        visiblePanes,
        heights,
        available,
        toggleVisible,
        addPane,
        removePane,
        deletePane,
        renamePane,
        restorePane,
        addSeries,
        removeSeries,
        toggleSeriesVisible,
        updateSeriesParams,
        updateSeriesYAxis,
        updateSeriesColor,
        updateSeriesSubColor,
        applyDelta,
        replaceLayout,
        resetToDefault,
        reorderPanes,
        canAddPane: visiblePanes.length < maxVisiblePanes,
    };
}
