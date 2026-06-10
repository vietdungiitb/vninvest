import { useState, useEffect, useRef, useCallback } from "react";
import { offsetDrawingByPixels } from "../../lib/drawing/clipboard.js";
export function useWidgetInteractionActions({ useForkRuntime = false, drawingUiEnabled = false, drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing, onSelectedDrawingChange, }) {
    const onSelectedDrawingChangeRef = useRef(onSelectedDrawingChange);
    useEffect(() => {
        onSelectedDrawingChangeRef.current = onSelectedDrawingChange;
    }, [onSelectedDrawingChange]);
    const [forkSelectionModifierPressed, setForkSelectionModifierPressed] = useState(false);
    const [forkDrawingContextMenu, setForkDrawingContextMenu] = useState(null);
    const forkAltShortcutPressedRef = useRef(false);
    useEffect(() => {
        if (!useForkRuntime || !drawingUiEnabled || drawingWorkspace.state.activeTool !== "cursor") {
            setForkSelectionModifierPressed(false);
            return;
        }
        const syncSelectionModifier = (next) => {
            setForkSelectionModifierPressed((current) => (current === next ? current : next));
        };
        const handleModifierChange = (event) => {
            syncSelectionModifier(Boolean(event.ctrlKey || event.metaKey || event.shiftKey));
        };
        const resetSelectionModifier = () => {
            syncSelectionModifier(false);
        };
        document.addEventListener("keydown", handleModifierChange);
        document.addEventListener("keyup", handleModifierChange);
        window.addEventListener("blur", resetSelectionModifier);
        return () => {
            document.removeEventListener("keydown", handleModifierChange);
            document.removeEventListener("keyup", handleModifierChange);
            window.removeEventListener("blur", resetSelectionModifier);
        };
    }, [drawingUiEnabled, drawingWorkspace.state.activeTool, useForkRuntime]);
    useEffect(() => {
        if (!useForkRuntime) {
            forkAltShortcutPressedRef.current = false;
            return;
        }
        const handleModifierChange = (event) => {
            forkAltShortcutPressedRef.current = Boolean(event.altKey || event.key === "Alt");
        };
        const resetModifierState = () => {
            forkAltShortcutPressedRef.current = false;
        };
        document.addEventListener("keydown", handleModifierChange);
        document.addEventListener("keyup", handleModifierChange);
        window.addEventListener("blur", resetModifierState);
        return () => {
            document.removeEventListener("keydown", handleModifierChange);
            document.removeEventListener("keyup", handleModifierChange);
            window.removeEventListener("blur", resetModifierState);
        };
    }, [useForkRuntime]);
    const copySelectedDrawing = useCallback(() => {
        drawingWorkspace.copySelected();
    }, [drawingWorkspace]);
    const pasteCopiedDrawing = useCallback(() => {
        const clipboardDrawing = drawingWorkspace.cloneClipboard();
        if (!clipboardDrawing) {
            return;
        }
        const nextDrawing = offsetDrawingByPixels(clipboardDrawing, 10, 10, {
            paneId: clipboardDrawing.paneId,
            yScaleId: clipboardDrawing.yScaleId,
        });
        drawingWorkspace.interaction.replaceDrawings([...resolvedDrawings, nextDrawing]);
        drawingWorkspace.selectDrawing(nextDrawing.id);
    }, [drawingWorkspace, resolvedDrawings]);
    const bringSelectedToFront = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        const maxZIndex = resolvedDrawings.reduce((currentMax, drawing) => Math.max(currentMax, drawing.zIndex ?? 0), 0);
        drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { zIndex: maxZIndex + 1 });
    }, [drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing]);
    const sendSelectedToBack = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        const minZIndex = resolvedDrawings.reduce((currentMin, drawing) => Math.min(currentMin, drawing.zIndex ?? 0), 0);
        drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { zIndex: minZIndex - 1 });
    }, [drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing]);
    const toggleSelectedLock = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        drawingWorkspace.interaction.updateDrawing(resolvedSelectedDrawing.id, { locked: !resolvedSelectedDrawing.locked });
    }, [drawingWorkspace, resolvedSelectedDrawing]);
    const cloneSelectedDrawing = useCallback(() => {
        if (!resolvedSelectedDrawing) {
            return;
        }
        const nextClone = offsetDrawingByPixels(resolvedSelectedDrawing, 10, 10, {
            paneId: resolvedSelectedDrawing.paneId,
            yScaleId: resolvedSelectedDrawing.yScaleId,
        });
        drawingWorkspace.interaction.replaceDrawings([...resolvedDrawings, nextClone]);
        drawingWorkspace.selectDrawing(nextClone.id);
    }, [drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing]);
    const updateForkReadonlySelection = useCallback((nextDrawing) => {
        onSelectedDrawingChangeRef.current?.(nextDrawing);
        drawingWorkspace.interaction.setSelectedObjects(nextDrawing ? [nextDrawing.id] : []);
    }, [drawingWorkspace.interaction]);
    const updateForkReadonlySelectionByIds = useCallback((nextSelectedIds) => {
        const normalizedIds = Array.from(new Set(nextSelectedIds));
        drawingWorkspace.interaction.setSelectedObjects(normalizedIds);
        const nextDrawing = normalizedIds.length === 1
            ? (resolvedDrawings.find((drawing) => drawing.id === normalizedIds[0]) ?? null)
            : null;
        onSelectedDrawingChangeRef.current?.(nextDrawing);
    }, [drawingWorkspace.interaction, resolvedDrawings]);
    const closeForkDrawingContextMenu = useCallback(() => {
        setForkDrawingContextMenu(null);
    }, []);
    return {
        forkSelectionModifierPressed,
        forkDrawingContextMenu,
        setForkDrawingContextMenu,
        forkAltShortcutPressedRef,
        copySelectedDrawing,
        pasteCopiedDrawing,
        bringSelectedToFront,
        sendSelectedToBack,
        toggleSelectedLock,
        cloneSelectedDrawing,
        updateForkReadonlySelection,
        updateForkReadonlySelectionByIds,
        closeForkDrawingContextMenu,
    };
}
