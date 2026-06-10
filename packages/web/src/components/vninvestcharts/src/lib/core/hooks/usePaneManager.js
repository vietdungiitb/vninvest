import { useCallback, useReducer } from "react";
let paneIdSeed = 0;
function createPaneId() {
    paneIdSeed += 1;
    return `pane-${paneIdSeed}`;
}
function normalizePane(input) {
    return {
        ...input,
        id: input.id ?? createPaneId(),
        indicators: input.indicators ?? [],
    };
}
function clampHeight(pane, heightPx) {
    return Math.max(pane.minHeightPx ?? 40, heightPx);
}
export function paneManagerReducer(state, action) {
    switch (action.type) {
        case "addPane":
            return [...state, normalizePane(action.pane)];
        case "removePane":
            return state.filter((pane) => pane.id !== action.paneId);
        case "resizePane":
            return state.map((pane) => (pane.id === action.paneId
                ? { ...pane, heightPx: clampHeight(pane, action.heightPx) }
                : pane));
        case "addIndicator":
            return state.map((pane) => (pane.id === action.paneId
                ? { ...pane, indicators: [...pane.indicators, action.indicator] }
                : pane));
        case "removeIndicator":
            return state.map((pane) => (pane.id === action.paneId
                ? { ...pane, indicators: pane.indicators.filter((indicator) => indicator.name !== action.indicatorName) }
                : pane));
        case "updateIndicator":
            return state.map((pane) => (pane.id === action.paneId
                ? {
                    ...pane,
                    indicators: pane.indicators.map((indicator) => (indicator.name === action.indicatorName ? { ...indicator, ...action.patch } : indicator)),
                }
                : pane));
        default:
            return state;
    }
}
export function usePaneManager(initialPanes = []) {
    const [panes, dispatch] = useReducer(paneManagerReducer, initialPanes, (seed) => seed.map(normalizePane));
    const addPane = useCallback((pane) => {
        const normalizedPane = normalizePane(pane);
        dispatch({ type: "addPane", pane: normalizedPane });
        return normalizedPane.id;
    }, []);
    const removePane = useCallback((paneId) => {
        dispatch({ type: "removePane", paneId });
    }, []);
    const resizePane = useCallback((paneId, heightPx) => {
        dispatch({ type: "resizePane", paneId, heightPx });
    }, []);
    const addIndicator = useCallback((paneId, indicator) => {
        dispatch({ type: "addIndicator", paneId, indicator });
    }, []);
    const removeIndicator = useCallback((paneId, indicatorName) => {
        dispatch({ type: "removeIndicator", paneId, indicatorName });
    }, []);
    const updateIndicator = useCallback((paneId, indicatorName, patch) => {
        dispatch({ type: "updateIndicator", paneId, indicatorName, patch });
    }, []);
    return {
        panes,
        addPane,
        removePane,
        resizePane,
        addIndicator,
        removeIndicator,
        updateIndicator,
    };
}
