import { jsx as _jsx } from "react/jsx-runtime";
/**
 * WE2 P1-04: VNInvestChartsStateContext
 *
 * Medium-frequency state context: panes, drawings, activeTool, selectedDrawing.
 * These change on user interactions (add pane, select tool, etc.) but not
 * per-frame like hover coordinates.
 *
 * High-frequency data (mouse X/Y, hoveredDatum) must go through the
 * HoverEmitter (EventTarget ref) — NOT this context — to avoid re-render storms.
 */
import { createContext, useCallback, useContext, useMemo, useReducer } from "react";
import { useDrawingInteraction } from "../../lib/drawing/useDrawingInteraction.js";
import { dynamicPanesReducer, loadPaneLayout, normalizeLoadedPaneLayout } from "../../lib/core/hooks/useDynamicPanes.js";
const defaultValue = undefined;
export const VNInvestChartsStateContext = createContext(defaultValue);
export function useVNInvestChartsState() {
    const ctx = useContext(VNInvestChartsStateContext);
    if (ctx === defaultValue) {
        throw new Error("useVNInvestChartsState must be used within VNInvestChartsStateProvider");
    }
    return ctx;
}
export function VNInvestChartsStateProvider({ initialPanes, initialDrawings, initialActiveTool, children, }) {
    // Pane state
    const [panes, dispatch] = useReducer(dynamicPanesReducer, undefined, () => {
        if (initialPanes)
            return normalizeLoadedPaneLayout(initialPanes);
        const isTestEnv = typeof globalThis !== "undefined" && (globalThis.vi !== undefined ||
            globalThis.describe !== undefined ||
            globalThis.process?.env?.NODE_ENV === "test");
        return loadPaneLayout(typeof localStorage !== "undefined" && !isTestEnv ? localStorage : undefined);
    });
    const toggleVisible = useCallback((id) => {
        dispatch({ type: "toggleVisible", id });
    }, [dispatch]);
    const addPane = useCallback((pane) => {
        dispatch({ type: "addPane", pane });
    }, [dispatch]);
    const removePane = useCallback((id) => {
        dispatch({ type: "removePane", id });
    }, [dispatch]);
    const deletePane = useCallback((id) => {
        dispatch({ type: "deletePane", id });
    }, [dispatch]);
    const renamePane = useCallback((paneId, label) => {
        dispatch({ type: "renamePane", paneId, label });
    }, [dispatch]);
    const restorePane = useCallback((id) => {
        dispatch({ type: "restorePane", id });
    }, [dispatch]);
    const addSeries = useCallback((paneId, series) => {
        dispatch({ type: "addSeries", paneId, series });
    }, [dispatch]);
    const removeSeries = useCallback((paneId, seriesType, seriesIndex) => {
        dispatch({ type: "removeSeries", paneId, seriesType, seriesIndex });
    }, [dispatch]);
    const toggleSeriesVisible = useCallback((paneId, seriesType, seriesIndex) => {
        dispatch({ type: "toggleSeriesVisible", paneId, seriesType, seriesIndex });
    }, [dispatch]);
    const reorderPanes = useCallback((fromVisibleIndex, toVisibleIndex) => {
        dispatch({ type: "reorderPanes", fromVisibleIndex, toVisibleIndex });
    }, [dispatch]);
    const paneState = useMemo(() => ({
        panes,
        dispatch,
        toggleVisible,
        addPane,
        removePane,
        deletePane,
        renamePane,
        restorePane,
        addSeries,
        removeSeries,
        toggleSeriesVisible,
        reorderPanes,
    }), [panes, dispatch, toggleVisible, addPane, removePane, deletePane, renamePane, restorePane, addSeries, removeSeries, toggleSeriesVisible, reorderPanes]);
    // Drawing state
    const drawingInteraction = useDrawingInteraction(initialDrawings ?? []);
    // Active tool state
    const [activeTool, setActiveToolState] = useReducer((_state, next) => next, initialActiveTool);
    const setActiveTool = useCallback((tool) => {
        setActiveToolState(tool);
    }, []);
    const activeToolState = useMemo(() => ({
        activeTool,
        setActiveTool,
    }), [activeTool, setActiveTool]);
    const value = useMemo(() => ({
        paneState,
        drawingInteraction,
        activeTool: activeToolState,
    }), [paneState, drawingInteraction, activeToolState]);
    return (_jsx(VNInvestChartsStateContext.Provider, { value: value, children: children }));
}
