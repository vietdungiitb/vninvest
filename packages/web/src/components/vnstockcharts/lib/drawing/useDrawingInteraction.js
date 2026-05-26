import { useCallback, useMemo, useReducer } from "react";
import { createDrawingHistory, historyReducer } from "./history.js";
import { drawingReducer } from "./stateMachine.js";
import { clonePoint } from "./shared.js";
import { deleteDrawingGroup, resolveDrawingGroupMemberIds } from "./engineCompat.js";
function isHistoryAction(action) {
    return action.type === "PUSH" || action.type === "REPLACE" || action.type === "UNDO" || action.type === "REDO" || action.type === "CLEAR";
}
function getSelectedObjectIds(state) {
    switch (state.type) {
        case "selected":
            return [state.objectId];
        case "selectedMultiple":
            return state.objectIds;
        case "moving":
        case "resizing":
        case "editing":
            return [state.objectId];
        default:
            return [];
    }
}
function cloneDrawingPoints(points) {
    return points.map(clonePoint);
}
function patchDrawing(drawing, patch) {
    return {
        ...drawing,
        ...patch,
        points: patch.points ? cloneDrawingPoints(patch.points) : cloneDrawingPoints(drawing.points),
        style: patch.style ? { ...drawing.style, ...patch.style } : { ...drawing.style },
        fibLevels: patch.fibLevels ? [...patch.fibLevels] : drawing.fibLevels ? [...drawing.fibLevels] : undefined,
        riskReward: patch.riskReward ? { ...patch.riskReward } : drawing.riskReward ? { ...drawing.riskReward } : undefined,
        updatedAt: Date.now(),
    };
}
function replaceDrawingById(drawings, objectId, patch) {
    let didChange = false;
    const nextDrawings = drawings.map((drawing) => {
        if (drawing.id !== objectId) {
            return drawing;
        }
        didChange = true;
        return patchDrawing(drawing, patch);
    });
    return didChange ? nextDrawings : null;
}
export function createDrawingInteractionState(initialDrawings = []) {
    return {
        drawingState: { type: "idle" },
        history: createDrawingHistory(initialDrawings),
    };
}
export function drawingInteractionReducer(state, action) {
    if (isHistoryAction(action)) {
        return {
            ...state,
            history: historyReducer(state.history, action),
        };
    }
    return {
        ...state,
        drawingState: drawingReducer(state.drawingState, action),
    };
}
export function deleteSelectedInteractionState(state) {
    const selectedObjectIds = getSelectedObjectIds(state.drawingState);
    if (selectedObjectIds.length === 0) {
        return state;
    }
    const selectedDrawings = state.history.present.filter((drawing) => selectedObjectIds.includes(drawing.id));
    if (selectedDrawings.some((drawing) => drawing.locked)) {
        return state;
    }
    const nextDrawings = state.history.present.filter((drawing) => !selectedObjectIds.includes(drawing.id));
    const nextHistory = nextDrawings.length === state.history.present.length
        ? state.history
        : historyReducer(state.history, { type: "REPLACE", drawings: nextDrawings });
    return {
        drawingState: { type: "idle" },
        history: nextHistory,
    };
}
export function useDrawingInteraction(initialDrawings = []) {
    const [state, dispatch] = useReducer(drawingInteractionReducer, initialDrawings, createDrawingInteractionState);
    const selectObject = useCallback((objectId) => {
        dispatch({ type: "SELECT_OBJECT", objectId });
    }, [dispatch]);
    const setSelectedObjects = useCallback((objectIds) => {
        dispatch({ type: "SET_SELECTED_OBJECTS", objectIds: [...objectIds] });
    }, [dispatch]);
    const startMoving = useCallback((objectId, startPoint, currentPoint) => {
        dispatch({ type: "START_MOVING", objectId, startPoint, currentPoint });
    }, [dispatch]);
    const startResizing = useCallback((objectId, handle) => {
        dispatch({ type: "START_RESIZING", objectId, handle });
    }, [dispatch]);
    const startEditing = useCallback((objectId, text) => {
        dispatch({ type: "START_EDITING", objectId, text });
    }, [dispatch]);
    const replaceDrawings = useCallback((drawings) => {
        dispatch({ type: "REPLACE", drawings: [...drawings] });
    }, [dispatch]);
    const updateDrawing = useCallback((objectId, patch) => {
        const nextDrawings = replaceDrawingById(state.history.present, objectId, patch);
        if (!nextDrawings) {
            return;
        }
        dispatch({ type: "REPLACE", drawings: nextDrawings });
    }, [dispatch, state.history.present]);
    const undo = useCallback(() => {
        dispatch({ type: "UNDO" });
    }, [dispatch]);
    const redo = useCallback(() => {
        dispatch({ type: "REDO" });
    }, [dispatch]);
    const cancelDrawing = useCallback(() => {
        dispatch({ type: "CANCEL" });
    }, [dispatch]);
    const deleteSelected = useCallback(() => {
        const selectedObjectIds = getSelectedObjectIds(state.drawingState);
        if (selectedObjectIds.length === 0) {
            return;
        }
        const selectedDrawings = state.history.present.filter((drawing) => selectedObjectIds.includes(drawing.id));
        if (selectedDrawings.some((drawing) => drawing.locked)) {
            return;
        }
        const nextDrawings = state.history.present.filter((drawing) => !selectedObjectIds.includes(drawing.id));
        if (nextDrawings.length !== state.history.present.length) {
            dispatch({ type: "REPLACE", drawings: nextDrawings });
        }
        dispatch({ type: "CANCEL" });
    }, [dispatch, state.drawingState, state.history.present]);
    const selectGroup = useCallback((groupId) => {
        dispatch({ type: "SET_SELECTED_OBJECTS", objectIds: resolveDrawingGroupMemberIds(state.history.present, groupId) });
    }, [dispatch, state.history.present]);
    const deleteGroup = useCallback((groupId) => {
        const nextDrawings = deleteDrawingGroup(state.history.present, groupId);
        if (nextDrawings.length !== state.history.present.length) {
            dispatch({ type: "REPLACE", drawings: nextDrawings });
        }
        dispatch({ type: "CANCEL" });
    }, [dispatch, state.history.present]);
    return useMemo(() => ({
        drawingState: state.drawingState,
        history: state.history,
        dispatch,
        selectObject,
        setSelectedObjects,
        startMoving,
        startResizing,
        startEditing,
        replaceDrawings,
        updateDrawing,
        undo,
        redo,
        deleteSelected,
        cancelDrawing,
        selectGroup,
        deleteGroup,
        canUndo: state.history.past.length > 0,
        canRedo: state.history.future.length > 0,
        allDrawings: state.history.present,
    }), [cancelDrawing, deleteGroup, deleteSelected, dispatch, redo, replaceDrawings, selectGroup, selectObject, setSelectedObjects, startEditing, startMoving, startResizing, state.drawingState, state.history, undo, updateDrawing]);
}
