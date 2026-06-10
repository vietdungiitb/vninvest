import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cloneDrawingSnapshot } from "../clipboard.js";
import { createLocalStorageAdapter } from "../DrawingStorage.js";
import { getSelectedObjectIds } from "../stateMachine.js";
import { useDrawingInteraction } from "../useDrawingInteraction.js";
import { useDrawingStorage } from "../useDrawingStorage.js";
function cloneDrawings(drawings) {
    return drawings.map((drawing) => cloneDrawingSnapshot(drawing));
}
function areDrawingsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        const leftDrawing = left[index];
        const rightDrawing = right[index];
        if (leftDrawing.id !== rightDrawing.id
            || leftDrawing.type !== rightDrawing.type
            || leftDrawing.paneId !== rightDrawing.paneId
            || leftDrawing.yScaleId !== rightDrawing.yScaleId
            || leftDrawing.text !== rightDrawing.text
            || leftDrawing.zIndex !== rightDrawing.zIndex
            || leftDrawing.locked !== rightDrawing.locked
            || leftDrawing.visible !== rightDrawing.visible
            || JSON.stringify(leftDrawing.points) !== JSON.stringify(rightDrawing.points)
            || JSON.stringify(leftDrawing.style) !== JSON.stringify(rightDrawing.style)
            || JSON.stringify(leftDrawing.fibLevels ?? null) !== JSON.stringify(rightDrawing.fibLevels ?? null)
            || JSON.stringify(leftDrawing.fibLevelConfigs ?? null) !== JSON.stringify(rightDrawing.fibLevelConfigs ?? null)
            || JSON.stringify(leftDrawing.riskReward ?? null) !== JSON.stringify(rightDrawing.riskReward ?? null)
            || JSON.stringify(leftDrawing.segmentStyles ?? null) !== JSON.stringify(rightDrawing.segmentStyles ?? null)
            || JSON.stringify(leftDrawing.segmentVisible ?? null) !== JSON.stringify(rightDrawing.segmentVisible ?? null)
            || leftDrawing.clonedFrom !== rightDrawing.clonedFrom
            || leftDrawing.groupId !== rightDrawing.groupId
            || leftDrawing.symbol !== rightDrawing.symbol
            || leftDrawing.timeframe !== rightDrawing.timeframe
            || leftDrawing.extendLeft !== rightDrawing.extendLeft
            || leftDrawing.extendRight !== rightDrawing.extendRight
            || leftDrawing.showMeasurement !== rightDrawing.showMeasurement
            || JSON.stringify(leftDrawing.alertCondition ?? null) !== JSON.stringify(rightDrawing.alertCondition ?? null)
            || JSON.stringify(leftDrawing.alertConditions ?? null) !== JSON.stringify(rightDrawing.alertConditions ?? null)
            || JSON.stringify(leftDrawing.waveLabels ?? null) !== JSON.stringify(rightDrawing.waveLabels ?? null)
            || JSON.stringify(leftDrawing.harmonicRatios ?? null) !== JSON.stringify(rightDrawing.harmonicRatios ?? null)
            || leftDrawing.gannSquareSize !== rightDrawing.gannSquareSize
            || JSON.stringify(leftDrawing.cycleParams ?? null) !== JSON.stringify(rightDrawing.cycleParams ?? null)
            || leftDrawing.createdAt !== rightDrawing.createdAt) {
            return false;
        }
    }
    return true;
}
function getSelectedDrawing(drawings, selectedIds) {
    if (selectedIds.length === 0) {
        return null;
    }
    return drawings.find((drawing) => drawing.id === selectedIds[0]) ?? null;
}
export function useDrawingWorkspaceController({ defaultDockTab = "properties", defaultDrawings, drawings, drawingStorageKey, drawingStorageAdapter, enabled = true, onDrawingsChange, symbol, timeframe, }) {
    const isControlled = drawings !== undefined;
    const initialDrawingsRef = useRef(drawings ?? defaultDrawings ?? []);
    const interaction = useDrawingInteraction(initialDrawingsRef.current);
    const [activeTool, setActiveTool] = useState("cursor");
    const [clipboard, setClipboard] = useState(null);
    const [dock, setDock] = useState({
        isOpen: false,
        activeTab: defaultDockTab,
    });
    const syncingFromExternalRef = useRef(false);
    const lastControlledDrawingsRef = useRef(drawings);
    const lastEmittedDrawingsRef = useRef(null);
    const storageAdapter = useMemo(() => drawingStorageAdapter ?? createLocalStorageAdapter(drawingStorageKey), [drawingStorageAdapter, drawingStorageKey]);
    const allDrawings = interaction.allDrawings;
    const replaceDrawings = interaction.replaceDrawings;
    const handleStorageLoad = useCallback((loadedDrawings) => {
        if (isControlled) {
            onDrawingsChange?.(cloneDrawings(loadedDrawings));
            return;
        }
        replaceDrawings(loadedDrawings);
    }, [isControlled, onDrawingsChange, replaceDrawings]);
    const storage = useDrawingStorage(symbol, timeframe, allDrawings, handleStorageLoad, storageAdapter, { enabled: enabled && !isControlled });
    useEffect(() => {
        if (!isControlled) {
            lastControlledDrawingsRef.current = drawings;
            return;
        }
        const nextDrawings = drawings ?? [];
        const previousControlledDrawings = lastControlledDrawingsRef.current ?? [];
        lastControlledDrawingsRef.current = nextDrawings;
        if (areDrawingsEqual(previousControlledDrawings, nextDrawings)) {
            return;
        }
        if (areDrawingsEqual(nextDrawings, allDrawings)) {
            return;
        }
        syncingFromExternalRef.current = true;
        replaceDrawings(nextDrawings);
    }, [allDrawings, drawings, isControlled, replaceDrawings]);
    useEffect(() => {
        if (!onDrawingsChange || (!enabled && !isControlled)) {
            return;
        }
        if (syncingFromExternalRef.current) {
            syncingFromExternalRef.current = false;
            lastEmittedDrawingsRef.current = allDrawings;
            return;
        }
        if (lastEmittedDrawingsRef.current !== null && areDrawingsEqual(lastEmittedDrawingsRef.current, allDrawings)) {
            return;
        }
        lastEmittedDrawingsRef.current = allDrawings;
        onDrawingsChange(cloneDrawings(allDrawings));
    }, [allDrawings, enabled, isControlled, onDrawingsChange]);
    const selectedIds = useMemo(() => getSelectedObjectIds(interaction.drawingState), [interaction.drawingState]);
    const selectedDrawing = useMemo(() => getSelectedDrawing(allDrawings, selectedIds), [allDrawings, selectedIds]);
    const copySelected = useCallback(() => {
        if (!selectedDrawing) {
            return;
        }
        setClipboard(cloneDrawingSnapshot(selectedDrawing));
    }, [selectedDrawing]);
    const clearClipboard = useCallback(() => {
        setClipboard(null);
    }, []);
    const openDock = useCallback((tab) => {
        setDock((current) => ({
            isOpen: true,
            activeTab: tab ?? current.activeTab,
        }));
    }, []);
    const closeDock = useCallback(() => {
        setDock((current) => ({ ...current, isOpen: false }));
    }, []);
    const setDockTab = useCallback((tab) => {
        setDock({ isOpen: true, activeTab: tab });
    }, []);
    const selectDrawing = useCallback((objectId) => {
        if (!objectId) {
            interaction.cancelDrawing();
            return;
        }
        interaction.selectObject(objectId);
    }, [interaction]);
    const cloneClipboard = useCallback(() => {
        return clipboard ? cloneDrawingSnapshot(clipboard) : null;
    }, [clipboard]);
    const state = useMemo(() => ({
        activeTool,
        clipboard,
        dock,
        drawings: allDrawings,
        selectedDrawing,
        selectedIds,
    }), [activeTool, allDrawings, clipboard, dock, selectedDrawing, selectedIds]);
    const controllerRef = useRef(null);
    if (controllerRef.current === null) {
        controllerRef.current = {
            interaction,
            storage,
            state,
            setActiveTool,
            setClipboard,
            copySelected,
            clearClipboard,
            openDock,
            closeDock,
            setDockTab,
            selectDrawing,
            cloneClipboard,
        };
    }
    else {
        controllerRef.current.interaction = interaction;
        controllerRef.current.storage = storage;
        controllerRef.current.state = state;
        controllerRef.current.setActiveTool = setActiveTool;
        controllerRef.current.setClipboard = setClipboard;
        controllerRef.current.copySelected = copySelected;
        controllerRef.current.clearClipboard = clearClipboard;
        controllerRef.current.openDock = openDock;
        controllerRef.current.closeDock = closeDock;
        controllerRef.current.setDockTab = setDockTab;
        controllerRef.current.selectDrawing = selectDrawing;
        controllerRef.current.cloneClipboard = cloneClipboard;
    }
    return controllerRef.current;
}
