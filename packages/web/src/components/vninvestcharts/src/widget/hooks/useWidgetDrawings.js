import { useEffect, useRef } from "react";
import { useDrawingWorkspaceController } from "../../lib/drawing/index.js";
import { cloneDrawingSnapshot, offsetDrawingByPixels } from "../../lib/drawing/clipboard.js";
import { reconcileForkDrawingIndexAnchors } from "../forkAnchorReconciliation.js";
import { createDateTimeIndexMap } from "@vninvestcharts/vn-kline-engine-core";
export function useWidgetDrawings({ defaultDrawings, drawings, drawingStorageKey, drawingStorageAdapter, defaultDrawingDockTab, onDrawingsChange, drawingUiEnabled = false, selectedDrawing, onSelectedDrawingChange, onDrawingWorkspaceChange, plotData, useForkRuntime = false, symbol, timeframe, }) {
    const drawingWorkspace = useDrawingWorkspaceController({
        defaultDrawings,
        drawings,
        drawingStorageKey,
        drawingStorageAdapter,
        defaultDockTab: defaultDrawingDockTab,
        onDrawingsChange,
        symbol,
        timeframe,
    });
    const lastDrawingWorkspaceSubscriberRef = useRef(onDrawingWorkspaceChange);
    const lastEmittedDrawingWorkspaceRef = useRef(null);
    const lastEmittedDrawingWorkspaceStateRef = useRef(null);
    const lastNotifiedSelectedDrawingIdRef = useRef(null);
    const forkDrawingStateRef = useRef(drawingWorkspace.interaction.drawingState);
    useEffect(() => {
        forkDrawingStateRef.current = drawingWorkspace.interaction.drawingState;
    }, [drawingWorkspace.interaction.drawingState]);
    lastDrawingWorkspaceSubscriberRef.current = onDrawingWorkspaceChange;
    const isSelectedDrawingControlled = selectedDrawing !== undefined;
    const resolvedSelectedDrawing = isSelectedDrawingControlled ? (selectedDrawing ?? null) : drawingWorkspace.state.selectedDrawing;
    const hasMultipleDrawingsSelected = drawingWorkspace.state.selectedIds.length > 1;
    const resolvedForkSingleSelection = hasMultipleDrawingsSelected ? null : resolvedSelectedDrawing;
    useEffect(() => {
        if (!isSelectedDrawingControlled) {
            return;
        }
        if (drawingWorkspace.interaction.drawingState.type === "drawing") {
            return;
        }
        const currentSelectedId = drawingWorkspace.state.selectedIds[0] ?? null;
        const nextSelectedId = selectedDrawing?.id ?? null;
        if (currentSelectedId === nextSelectedId) {
            return;
        }
        drawingWorkspace.selectDrawing(nextSelectedId);
    }, [drawingWorkspace, drawingWorkspace.interaction.drawingState.type, isSelectedDrawingControlled, selectedDrawing?.id]);
    useEffect(() => {
        const nextWorkspace = drawingUiEnabled ? drawingWorkspace : null;
        const nextWorkspaceState = nextWorkspace?.state ?? null;
        const callbackChanged = lastDrawingWorkspaceSubscriberRef.current !== onDrawingWorkspaceChange;
        const workspaceChanged = lastEmittedDrawingWorkspaceRef.current !== nextWorkspace;
        const workspaceStateChanged = lastEmittedDrawingWorkspaceStateRef.current !== nextWorkspaceState;
        if (!callbackChanged && !workspaceChanged && !workspaceStateChanged) {
            return;
        }
        lastEmittedDrawingWorkspaceRef.current = nextWorkspace;
        lastEmittedDrawingWorkspaceStateRef.current = nextWorkspaceState;
        lastDrawingWorkspaceSubscriberRef.current = onDrawingWorkspaceChange;
        onDrawingWorkspaceChange?.(nextWorkspace ? { ...nextWorkspace } : null);
    }, [drawingUiEnabled, drawingWorkspace, drawingWorkspace.state, onDrawingWorkspaceChange]);
    useEffect(() => {
        return () => {
            const callback = lastDrawingWorkspaceSubscriberRef.current;
            lastEmittedDrawingWorkspaceRef.current = null;
            lastEmittedDrawingWorkspaceStateRef.current = null;
            lastDrawingWorkspaceSubscriberRef.current = undefined;
            callback?.(null);
        };
    }, []);
    useEffect(() => {
        const nextSelectedDrawingId = resolvedForkSingleSelection?.id ?? null;
        if (lastNotifiedSelectedDrawingIdRef.current === nextSelectedDrawingId && lastNotifiedSelectedDrawingIdRef.current !== undefined) {
            return;
        }
        lastNotifiedSelectedDrawingIdRef.current = nextSelectedDrawingId;
        onSelectedDrawingChange?.(resolvedForkSingleSelection);
    }, [onSelectedDrawingChange, resolvedForkSingleSelection]);
    useEffect(() => {
        if (!drawingUiEnabled) {
            return undefined;
        }
        const handleKeyDown = (event) => {
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === "INPUT" || activeElement.tagName === "TEXTAREA")) {
                return;
            }
            if (event.key === "Delete" || event.key === "Backspace") {
                const selectedIds = drawingWorkspace.state.selectedIds;
                if (selectedIds.length > 0) {
                    event.preventDefault();
                    const nextDrawings = drawingWorkspace.interaction.allDrawings.filter((d) => !selectedIds.includes(d.id));
                    drawingWorkspace.interaction.replaceDrawings(nextDrawings);
                    drawingWorkspace.selectDrawing(null);
                }
                return;
            }
            const isCtrlOrCmd = event.ctrlKey || event.metaKey;
            if (isCtrlOrCmd && event.key.toLowerCase() === "c") {
                const selectedDrawing = drawingWorkspace.state.selectedDrawing;
                if (selectedDrawing) {
                    event.preventDefault();
                    localStorage.setItem("vninvestcharts_clipboard", JSON.stringify(cloneDrawingSnapshot(selectedDrawing)));
                }
                return;
            }
            if (isCtrlOrCmd && event.key.toLowerCase() === "v") {
                const clipboardRaw = localStorage.getItem("vninvestcharts_clipboard");
                if (clipboardRaw) {
                    event.preventDefault();
                    try {
                        const snapshot = JSON.parse(clipboardRaw);
                        const offset = offsetDrawingByPixels(snapshot, 15, 15);
                        drawingWorkspace.interaction.dispatch({ type: "PUSH", drawing: offset });
                        drawingWorkspace.selectDrawing(offset.id);
                    }
                    catch (e) {
                        console.error("Failed to parse drawing clipboard:", e);
                    }
                }
                return;
            }
            if (isCtrlOrCmd && event.key.toLowerCase() === "l") {
                const sel = drawingWorkspace.state.selectedDrawing;
                if (sel) {
                    event.preventDefault();
                    drawingWorkspace.interaction.updateDrawing(sel.id, { locked: !sel.locked });
                }
                return;
            }
            if (isCtrlOrCmd && event.key.toLowerCase() === "h") {
                const sel = drawingWorkspace.state.selectedDrawing;
                if (sel) {
                    event.preventDefault();
                    drawingWorkspace.interaction.updateDrawing(sel.id, { visible: sel.visible === false ? true : false });
                }
                return;
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [drawingUiEnabled, drawingWorkspace]);
    useEffect(() => {
        if (!useForkRuntime || !drawingUiEnabled || plotData.length === 0 || drawingWorkspace.state.drawings.length === 0) {
            return;
        }
        const drawingStateType = drawingWorkspace.interaction.drawingState.type;
        if (drawingStateType === "drawing" ||
            drawingStateType === "moving" ||
            drawingStateType === "resizing") {
            return;
        }
        const timeIndexMap = createDateTimeIndexMap(plotData);
        const reconciled = reconcileForkDrawingIndexAnchors(drawingWorkspace.state.drawings, timeIndexMap);
        if (!reconciled.changed) {
            return;
        }
        drawingWorkspace.interaction.replaceDrawings(reconciled.drawings);
    }, [
        drawingUiEnabled,
        drawingWorkspace.interaction,
        drawingWorkspace.interaction.drawingState.type,
        plotData,
        drawingWorkspace.state.drawings,
        useForkRuntime,
    ]);
    const resolvedDrawings = drawingWorkspace.state.drawings;
    return {
        drawingWorkspace,
        resolvedDrawings,
        resolvedSelectedDrawing,
        hasMultipleDrawingsSelected,
        resolvedForkSingleSelection,
    };
}
