import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { resolvePreferredScaleSlotId, } from "../utils/widgetHelpers.js";
import { resolvePaneDataIndexAtPixel, } from "@vninvestcharts/vn-kline-engine-core";
import { createForkDrawingScales, resolveRenderableForkDrawings, } from "../ForkDrawingsOverlay.js";
import { FORK_DRAWING_TOOL_CURSOR_MAP, hasForkDraftProgress, isForkMultiStepTool, isForkSinglePointTool, isPrimaryPointerPressed, resolveForkMultiStepDraftOnClick, } from "../forkInteractionHelpers.js";
import { createWidgetCoordinateBridge } from "../utils/coordinateBridge.js";
import { findPaneSnapshotAtPosition } from "../paneInteractionUtils.js";
import { resizeDrawingsByIds, translateDrawingsByIds } from "../../lib/drawing/DrawingLayer.js";
import { createDrawingInteractionCommand, hitTestDrawingWithContext, resolveDrawingManipulationIntentWithContext, resolveDrawingInteractionContext, resolveDrawingPointWithContext, } from "../../lib/drawing/drawingInteractionBridge.js";
import { createDraftFromTool, createTool, isDrawingToolName } from "../../lib/drawing/registry.js";
import { isDrawingInRect } from "../../lib/drawing/hitTest.js";
export function useWidgetForkInteraction({ useForkRuntime, drawingUiEnabled, activeForkDrawingTool, drawingWorkspace, resolvedDrawings, resolvedSelectedDrawing, resolvedForkSingleSelection, onSelectedDrawingChange, magnetSensitivity, paneSnapshots, plotData, forkMovableSelectionIds, activeForkManipulationDrawing, forkSelectionModifierPressed, closeForkDrawingContextMenu, setForkDrawingContextMenu, size, engineInstanceRef, visiblePanes, onContextMenu, onClick, forkAltShortcutPressedRef, cloneSelectedDrawing, toggleSelectedLock, updateForkReadonlySelection, updateForkReadonlySelectionByIds, forkVisibleRangeRef, forkPaneSnapshotsRef, }) {
    const ignoreNextForkDrawingClickRef = useRef(false);
    const forkManipulationSessionRef = useRef(null);
    const forkManipulationPreviewRef = useRef(null);
    const forkRubberBandSelectionRef = useRef(null);
    const forkRubberBandJustCommittedRef = useRef(false);
    const previousForkAuthoringToolRef = useRef(null);
    const suppressNextForkSurfaceClickRef = useRef(false);
    const forkPointerOwnerRef = useRef(null);
    const lastPointerContextRef = useRef(null);
    const [forkSurfaceCursor, setForkSurfaceCursor] = useState(undefined);
    const [forkPreviewRevision, setForkPreviewRevision] = useState(0);
    const [forkManipulationActive, setForkManipulationActive] = useState(false);
    const [forkRubberBandTick, setForkRubberBandTick] = useState(0);
    const forkDrawingStateRef = useRef(drawingWorkspace.interaction.drawingState);
    useEffect(() => {
        forkDrawingStateRef.current = drawingWorkspace.interaction.drawingState;
    }, [drawingWorkspace.interaction.drawingState]);
    const clearForkPointerOwner = useCallback(() => {
        forkPointerOwnerRef.current = null;
    }, []);
    const claimForkPointerOwner = useCallback((owner) => {
        forkPointerOwnerRef.current = owner;
    }, []);
    const releaseForkPointerOwner = useCallback((owner) => {
        if (forkPointerOwnerRef.current === owner) {
            clearForkPointerOwner();
        }
    }, [clearForkPointerOwner]);
    const releasePointerOwner = useCallback(() => {
        clearForkPointerOwner();
    }, [clearForkPointerOwner]);
    const releaseWhenNoButtonsPressed = useCallback((event) => {
        if ("buttons" in event && event.buttons === 0) {
            clearForkPointerOwner();
        }
    }, [clearForkPointerOwner]);
    const releaseOnVisibilityChange = useCallback(() => {
        if (typeof document === "undefined" || document.visibilityState !== "visible") {
            clearForkPointerOwner();
        }
    }, [clearForkPointerOwner]);
    const resolveForkDrawingContext = useCallback((pointerContext, drawing) => {
        const engine = engineInstanceRef.current;
        const visibleRange = (() => {
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? forkVisibleRangeRef.current;
        if (!visibleRange) {
            return null;
        }
        const currentPaneSnapshots = (() => {
            if (!engine)
                return null;
            const sn = engine.getPaneSnapshots();
            if (!sn || sn.length === 0)
                return null;
            return sn;
        })() ?? (forkPaneSnapshotsRef.current.length > 0 ? forkPaneSnapshotsRef.current : paneSnapshots);
        const bridge = createWidgetCoordinateBridge({
            paneSnapshots: currentPaneSnapshots,
            visibleRange,
            plotData,
        });
        if (!bridge) {
            return null;
        }
        const snapshot = drawing?.paneId
            ? currentPaneSnapshots.find((candidate) => candidate.paneId === drawing.paneId) ?? null
            : (pointerContext.paneId
                ? currentPaneSnapshots.find((candidate) => candidate.paneId === pointerContext.paneId) ?? null
                : findPaneSnapshotAtPosition(currentPaneSnapshots, pointerContext.localX, pointerContext.localY));
        if (!snapshot) {
            return null;
        }
        const scaleSlotId = resolvePreferredScaleSlotId(snapshot, drawing?.yScaleId);
        if (!scaleSlotId) {
            return null;
        }
        const scaleSlotDomain = snapshot.scaleSlotStates[scaleSlotId]?.domain;
        const yDomain = Array.isArray(scaleSlotDomain) && scaleSlotDomain.length >= 2
            ? [scaleSlotDomain[0], scaleSlotDomain[1]]
            : undefined;
        const normalizedX = pointerContext.localX;
        const normalizedY = pointerContext.localY;
        return resolveDrawingInteractionContext({
            bridge,
            paneId: snapshot.paneId,
            scaleSlotId,
            chartWidth: snapshot.plotBounds.width,
            chartHeight: snapshot.plotBounds.height,
            x: normalizedX,
            y: normalizedY,
            plotData: plotData,
            yDomain,
            pixelOffset: { x: snapshot.plotBounds.left, y: snapshot.plotBounds.top },
        }) ?? null;
    }, [paneSnapshots, plotData, forkPaneSnapshotsRef, forkVisibleRangeRef, engineInstanceRef]);
    const resolveForkDrawingCommand = useCallback((type, pointerContext, drawing) => {
        const interactionContext = resolveForkDrawingContext(pointerContext, drawing);
        if (!interactionContext) {
            return null;
        }
        return createDrawingInteractionCommand(type, interactionContext, pointerContext);
    }, [resolveForkDrawingContext]);
    const resolveForkSurfaceCursor = useCallback((pointerContext) => {
        const context = pointerContext ?? lastPointerContextRef.current ?? undefined;
        const activeTool = drawingWorkspace.state.activeTool;
        if (activeTool === "cursor" && context) {
            const { localX, localY } = context;
            const currentPaneSnapshots = forkPaneSnapshotsRef.current.length > 0 ? forkPaneSnapshotsRef.current : paneSnapshots;
            const overSlot = currentPaneSnapshots.some((snapshot) => {
                return Object.values(snapshot.scaleSlotBounds).some((bounds) => {
                    const right = bounds.left + bounds.width;
                    const bottom = bounds.top + bounds.height;
                    return localX >= bounds.left && localX <= right && localY >= bounds.top && localY <= bottom;
                });
            });
            if (overSlot) {
                return "ns-resize";
            }
        }
        const toolCursor = isDrawingToolName(activeTool)
            ? FORK_DRAWING_TOOL_CURSOR_MAP[activeTool]
            : undefined;
        if (toolCursor) {
            return toolCursor;
        }
        if (activeTool !== "cursor" && isDrawingToolName(activeTool)) {
            return "crosshair";
        }
        if (forkDrawingStateRef.current.type === "drawing") {
            return "crosshair";
        }
        const manipulationSession = forkManipulationSessionRef.current;
        if (manipulationSession) {
            return manipulationSession.mode === "resize" ? "pointer" : "grabbing";
        }
        const isSelectionModifierPressed = activeTool === "cursor"
            && (forkSelectionModifierPressed || Boolean(context?.ctrlKey || context?.metaKey || context?.shiftKey));
        if (isSelectionModifierPressed && !context) {
            return "cell";
        }
        if (!context) {
            return "grab";
        }
        const interactionContext = resolveForkDrawingContext(context, activeForkManipulationDrawing ?? undefined);
        if (!interactionContext) {
            return "grab";
        }
        if (activeForkManipulationDrawing) {
            const manipulationIntent = resolveDrawingManipulationIntentWithContext(activeForkManipulationDrawing, interactionContext);
            if (manipulationIntent?.mode === "resize") {
                return "pointer";
            }
            if (isSelectionModifierPressed) {
                return "cell";
            }
            if (manipulationIntent?.mode === "move") {
                return "move";
            }
        }
        if (isSelectionModifierPressed) {
            return "cell";
        }
        const hitDrawing = [...resolvedDrawings]
            .filter((drawing) => drawing.visible !== false)
            .reverse()
            .find((drawing) => hitTestDrawingWithContext(drawing, interactionContext));
        if (hitDrawing) {
            return "pointer";
        }
        if (activeTool === "cursor" && ((context?.buttons ?? 0) & 1) === 1) {
            return "grabbing";
        }
        return "grab";
    }, [activeForkManipulationDrawing, drawingWorkspace.state.activeTool, forkSelectionModifierPressed, resolveForkDrawingContext, resolvedDrawings, paneSnapshots, forkPaneSnapshotsRef]);
    const handleForkDrawingPointerDown = useCallback((pointerContext) => {
        if (!activeForkDrawingTool) {
            return;
        }
        const currentDrawingState = forkDrawingStateRef.current;
        if (currentDrawingState.type === "drawing") {
            return;
        }
        closeForkDrawingContextMenu();
        const command = resolveForkDrawingCommand("pointerdown", pointerContext);
        if (!command) {
            return;
        }
        const resolvedPoint = resolveDrawingPointWithContext(resolvedDrawings, command.context, magnetSensitivity).point;
        const draft = {
            ...createDraftFromTool(activeForkDrawingTool, resolvedPoint),
            paneId: command.frame.paneId,
            yScaleId: command.frame.scaleSlotId,
        };
        if (resolvedSelectedDrawing) {
            updateForkReadonlySelection(null);
            drawingWorkspace.selectDrawing(null);
        }
        ignoreNextForkDrawingClickRef.current = true;
        forkDrawingStateRef.current = {
            type: "drawing",
            toolName: activeForkDrawingTool,
            object: draft,
        };
        drawingWorkspace.interaction.dispatch({
            type: "START_DRAWING",
            toolName: activeForkDrawingTool,
            object: draft,
        });
    }, [activeForkDrawingTool, closeForkDrawingContextMenu, drawingWorkspace, magnetSensitivity, updateForkReadonlySelection, resolveForkDrawingCommand, resolvedDrawings, resolvedSelectedDrawing]);
    const handleForkDrawingPointerMove = useCallback((pointerContext) => {
        const currentDrawingState = forkDrawingStateRef.current;
        if (currentDrawingState.type !== "drawing") {
            return;
        }
        const command = resolveForkDrawingCommand("pointermove", pointerContext, currentDrawingState.object);
        if (!command) {
            return;
        }
        const resolvedPoint = resolveDrawingPointWithContext(resolvedDrawings, command.context, magnetSensitivity).point;
        const nextDraft = createTool(currentDrawingState.toolName).updateDraft(currentDrawingState.object, resolvedPoint);
        forkDrawingStateRef.current = {
            ...currentDrawingState,
            object: nextDraft,
        };
        drawingWorkspace.interaction.dispatch({ type: "UPDATE_DRAWING", object: nextDraft });
    }, [drawingWorkspace, magnetSensitivity, resolveForkDrawingCommand, resolvedDrawings]);
    const handleForkDrawingClick = useCallback((pointerContext) => {
        if (forkPointerOwnerRef.current !== null) {
            return;
        }
        const currentDrawingState = forkDrawingStateRef.current;
        if (currentDrawingState.type !== "drawing") {
            return;
        }
        if (ignoreNextForkDrawingClickRef.current) {
            ignoreNextForkDrawingClickRef.current = false;
            return;
        }
        const command = resolveForkDrawingCommand("click", pointerContext, currentDrawingState.object);
        if (!command) {
            return;
        }
        const resolvedPoint = resolveDrawingPointWithContext(resolvedDrawings, command.context, magnetSensitivity).point;
        if (isForkMultiStepTool(currentDrawingState.toolName)) {
            const { nextDraft, shouldComplete } = resolveForkMultiStepDraftOnClick(currentDrawingState.object, resolvedPoint);
            if (!shouldComplete) {
                forkDrawingStateRef.current = {
                    ...currentDrawingState,
                    object: nextDraft,
                };
                drawingWorkspace.interaction.dispatch({ type: "UPDATE_DRAWING", object: nextDraft });
                return;
            }
            ignoreNextForkDrawingClickRef.current = false;
            forkDrawingStateRef.current = { type: "complete", object: nextDraft };
            drawingWorkspace.interaction.dispatch({ type: "COMPLETE_DRAWING", object: nextDraft });
            drawingWorkspace.interaction.dispatch({ type: "PUSH", drawing: nextDraft });
            drawingWorkspace.selectDrawing(nextDraft.id);
            drawingWorkspace.setActiveTool("cursor");
            return;
        }
        const completedDrawing = createTool(currentDrawingState.toolName).updateDraft(currentDrawingState.object, resolvedPoint);
        ignoreNextForkDrawingClickRef.current = false;
        forkDrawingStateRef.current = { type: "complete", object: completedDrawing };
        drawingWorkspace.interaction.dispatch({ type: "COMPLETE_DRAWING", object: completedDrawing });
        drawingWorkspace.interaction.dispatch({ type: "PUSH", drawing: completedDrawing });
        drawingWorkspace.selectDrawing(completedDrawing.id);
        drawingWorkspace.setActiveTool("cursor");
    }, [drawingWorkspace, magnetSensitivity, resolveForkDrawingCommand, resolvedDrawings]);
    const handleForkManipulationPointerDown = useCallback((pointerContext) => {
        const hitDrawingState = engineInstanceRef.current?.hitTestDrawingPrimitive(pointerContext.localX, pointerContext.localY) ?? null;
        if (drawingWorkspace.state.activeTool === "cursor"
            && Boolean(pointerContext.ctrlKey || pointerContext.metaKey)) {
            if (!hitDrawingState || hitDrawingState.actionHandle) {
                forkRubberBandSelectionRef.current = {
                    startPixel: [pointerContext.localX, pointerContext.localY],
                    currentPixel: [pointerContext.localX, pointerContext.localY],
                };
                setForkRubberBandTick((revision) => revision + 1);
                return;
            }
        }
        const hitDrawing = hitDrawingState?.drawingId
            ? (resolvedDrawings.find((drawing) => drawing.id === hitDrawingState.drawingId) ?? null)
            : null;
        const targetDrawing = activeForkManipulationDrawing
            ?? (hitDrawing && forkMovableSelectionIds.includes(hitDrawing.id) ? hitDrawing : null);
        if (!targetDrawing) {
            return;
        }
        const moveTargetIds = forkMovableSelectionIds.includes(targetDrawing.id)
            ? forkMovableSelectionIds
            : [targetDrawing.id];
        closeForkDrawingContextMenu();
        const command = resolveForkDrawingCommand("pointerdown", pointerContext, targetDrawing);
        if (!command) {
            return;
        }
        const manipulationIntent = resolveDrawingManipulationIntentWithContext(targetDrawing, command.context);
        forkManipulationPreviewRef.current = null;
        setForkPreviewRevision((revision) => revision + 1);
        if (manipulationIntent?.mode === "resize") {
            if (moveTargetIds.length !== 1) {
                forkManipulationSessionRef.current = null;
                return;
            }
            drawingWorkspace.interaction.startResizing(targetDrawing.id, String(manipulationIntent.handleIndex));
            forkManipulationSessionRef.current = {
                mode: "resize",
                objectId: targetDrawing.id,
                objectIds: [targetDrawing.id],
                baseDrawings: resolvedDrawings,
                handleIndex: manipulationIntent.handleIndex,
                started: true,
            };
            setForkManipulationActive(true);
            return;
        }
        if (!manipulationIntent || manipulationIntent.mode !== "move") {
            forkManipulationSessionRef.current = null;
            return;
        }
        drawingWorkspace.interaction.startMoving(targetDrawing.id, command.frame.chartPoint, command.frame.chartPoint);
        forkManipulationSessionRef.current = {
            mode: "move",
            objectId: targetDrawing.id,
            objectIds: moveTargetIds,
            baseDrawings: resolvedDrawings,
            startChartPoint: command.frame.chartPoint,
            started: true,
        };
        setForkManipulationActive(true);
    }, [activeForkManipulationDrawing, closeForkDrawingContextMenu, drawingWorkspace.state.activeTool, forkMovableSelectionIds, resolveForkDrawingCommand, resolvedDrawings, engineInstanceRef]);
    const handleForkManipulationPointerMove = useCallback((pointerContext) => {
        if (forkRubberBandSelectionRef.current) {
            forkRubberBandSelectionRef.current = {
                startPixel: forkRubberBandSelectionRef.current.startPixel,
                currentPixel: [pointerContext.localX, pointerContext.localY],
            };
            setForkRubberBandTick((revision) => revision + 1);
            return;
        }
        const session = forkManipulationSessionRef.current;
        if (!session) {
            return;
        }
        if (!isPrimaryPointerPressed(pointerContext)) {
            return;
        }
        const targetDrawing = session.baseDrawings.find((drawing) => drawing.id === session.objectId);
        if (!targetDrawing) {
            return;
        }
        const command = resolveForkDrawingCommand("pointermove", pointerContext, targetDrawing);
        if (!command) {
            return;
        }
        if (session.mode === "resize" && session.handleIndex != null) {
            forkManipulationPreviewRef.current = resizeDrawingsByIds(session.baseDrawings, session.objectIds, session.handleIndex, command.frame.chartPoint);
            setForkPreviewRevision((revision) => revision + 1);
            return;
        }
        if (!session.startChartPoint) {
            return;
        }
        const deltaX = command.frame.chartPoint.x - session.startChartPoint.x;
        const deltaY = command.frame.chartPoint.y - session.startChartPoint.y;
        const deltaIndex = typeof command.frame.chartPoint.xIndexFloat === "number"
            && Number.isFinite(command.frame.chartPoint.xIndexFloat)
            && typeof session.startChartPoint.xIndexFloat === "number"
            && Number.isFinite(session.startChartPoint.xIndexFloat)
            ? command.frame.chartPoint.xIndexFloat - session.startChartPoint.xIndexFloat
            : undefined;
        forkManipulationPreviewRef.current = translateDrawingsByIds(session.baseDrawings, session.objectIds, deltaX, deltaY, deltaIndex);
        setForkPreviewRevision((revision) => revision + 1);
    }, [resolveForkDrawingCommand]);
    const handleForkManipulationPointerUp = useCallback(() => {
        const rubberBand = forkRubberBandSelectionRef.current;
        if (rubberBand) {
            forkRubberBandSelectionRef.current = null;
            setForkRubberBandTick((revision) => revision + 1);
            const dx = Math.abs(rubberBand.currentPixel[0] - rubberBand.startPixel[0]);
            const dy = Math.abs(rubberBand.currentPixel[1] - rubberBand.startPixel[1]);
            if (dx < 4 && dy < 4) {
                return;
            }
            const engine = engineInstanceRef.current;
            const visibleRange = (() => {
                if (!engine)
                    return null;
                const range = engine.getVisibleRange();
                if (!range || Math.abs(range.to - range.from) <= 1e-6)
                    return null;
                return range;
            })() ?? forkVisibleRangeRef.current;
            const currentPaneSnapshots = (() => {
                if (!engine)
                    return null;
                const sn = engine.getPaneSnapshots();
                if (!sn || sn.length === 0)
                    return null;
                return sn;
            })() ?? (forkPaneSnapshotsRef.current.length > 0 ? forkPaneSnapshotsRef.current : paneSnapshots);
            if (!visibleRange || plotData.length === 0 || currentPaneSnapshots.length === 0) {
                return;
            }
            const absoluteRect = {
                minX: Math.min(rubberBand.startPixel[0], rubberBand.currentPixel[0]),
                maxX: Math.max(rubberBand.startPixel[0], rubberBand.currentPixel[0]),
                minY: Math.min(rubberBand.startPixel[1], rubberBand.currentPixel[1]),
                maxY: Math.max(rubberBand.startPixel[1], rubberBand.currentPixel[1]),
            };
            const matchingIds = resolvedDrawings
                .filter((drawing) => drawing.visible !== false)
                .filter((drawing) => {
                const snapshot = drawing.paneId
                    ? currentPaneSnapshots.find((candidate) => candidate.paneId === drawing.paneId)
                    : currentPaneSnapshots[0];
                if (!snapshot) {
                    return false;
                }
                const scaleSlotId = resolvePreferredScaleSlotId(snapshot, drawing.yScaleId);
                if (!scaleSlotId) {
                    return false;
                }
                const renderScales = createForkDrawingScales(snapshot, scaleSlotId, visibleRange, plotData);
                if (!renderScales) {
                    return false;
                }
                const paneRect = {
                    minX: absoluteRect.minX - snapshot.plotBounds.left,
                    maxX: absoluteRect.maxX - snapshot.plotBounds.left,
                    minY: absoluteRect.minY - snapshot.plotBounds.top,
                    maxY: absoluteRect.maxY - snapshot.plotBounds.top,
                };
                return isDrawingInRect(drawing, paneRect, renderScales, snapshot.plotBounds.width, snapshot.plotBounds.height);
            })
                .map((drawing) => drawing.id);
            const normalizedIds = Array.from(new Set(matchingIds));
            drawingWorkspace.interaction.setSelectedObjects(normalizedIds);
            const nextDrawing = normalizedIds.length === 1
                ? (resolvedDrawings.find((drawing) => drawing.id === normalizedIds[0]) ?? null)
                : null;
            updateForkReadonlySelection(nextDrawing);
            forkRubberBandJustCommittedRef.current = true;
            return;
        }
        const session = forkManipulationSessionRef.current;
        const previewDrawings = forkManipulationPreviewRef.current;
        forkManipulationSessionRef.current = null;
        forkManipulationPreviewRef.current = null;
        setForkPreviewRevision((revision) => revision + 1);
        setForkManipulationActive(false);
        if (!session) {
            return;
        }
        const didChange = previewDrawings != null
            ? (previewDrawings.length !== session.baseDrawings.length
                || previewDrawings.some((drawing, index) => drawing !== session.baseDrawings[index]))
            : false;
        if (previewDrawings && didChange) {
            drawingWorkspace.interaction.replaceDrawings(previewDrawings);
            suppressNextForkSurfaceClickRef.current = true;
        }
        if (session.started) {
            if (session.objectIds.length > 1) {
                drawingWorkspace.interaction.setSelectedObjects(session.objectIds);
            }
            else {
                drawingWorkspace.selectDrawing(session.objectId);
            }
        }
    }, [drawingWorkspace, updateForkReadonlySelection, paneSnapshots, plotData, resolvedDrawings, forkPaneSnapshotsRef, forkVisibleRangeRef, engineInstanceRef]);
    const handleForkPointerDown = useCallback((pointerContext) => {
        lastPointerContextRef.current = pointerContext;
        if (forkPointerOwnerRef.current !== null) {
            return;
        }
        if (!isPrimaryPointerPressed(pointerContext) && pointerContext.buttons !== 0) {
            return;
        }
        if (activeForkDrawingTool) {
            handleForkDrawingPointerDown(pointerContext);
            return;
        }
        handleForkManipulationPointerDown(pointerContext);
        setForkSurfaceCursor(resolveForkSurfaceCursor(pointerContext));
    }, [activeForkDrawingTool, handleForkDrawingPointerDown, handleForkManipulationPointerDown, resolveForkSurfaceCursor]);
    const handleForkPointerMove = useCallback((pointerContext) => {
        lastPointerContextRef.current = pointerContext;
        if (forkPointerOwnerRef.current !== null) {
            return;
        }
        if (forkDrawingStateRef.current.type === "drawing") {
            handleForkDrawingPointerMove(pointerContext);
            setForkSurfaceCursor(resolveForkSurfaceCursor(pointerContext));
            return;
        }
        handleForkManipulationPointerMove(pointerContext);
        setForkSurfaceCursor(resolveForkSurfaceCursor(pointerContext));
    }, [handleForkDrawingPointerMove, handleForkManipulationPointerMove, resolveForkSurfaceCursor]);
    const handleForkPointerUp = useCallback((pointerContext) => {
        lastPointerContextRef.current = pointerContext;
        if (forkPointerOwnerRef.current !== null) {
            return;
        }
        const currentDrawingState = forkDrawingStateRef.current;
        if (currentDrawingState.type === "drawing"
            && !isForkMultiStepTool(currentDrawingState.toolName)
            && (hasForkDraftProgress(currentDrawingState.object)
                || isForkSinglePointTool(currentDrawingState.toolName))) {
            const command = resolveForkDrawingCommand("pointermove", pointerContext, currentDrawingState.object);
            const completedDrawing = command
                ? createTool(currentDrawingState.toolName).updateDraft(currentDrawingState.object, resolveDrawingPointWithContext(resolvedDrawings, command.context, magnetSensitivity).point)
                : currentDrawingState.object;
            ignoreNextForkDrawingClickRef.current = false;
            forkDrawingStateRef.current = { type: "complete", object: completedDrawing };
            drawingWorkspace.interaction.dispatch({ type: "COMPLETE_DRAWING", object: completedDrawing });
            drawingWorkspace.interaction.dispatch({ type: "PUSH", drawing: completedDrawing });
            drawingWorkspace.selectDrawing(completedDrawing.id);
            drawingWorkspace.setActiveTool("cursor");
            return;
        }
        handleForkManipulationPointerUp();
        setForkSurfaceCursor(resolveForkSurfaceCursor(pointerContext));
    }, [drawingWorkspace, handleForkManipulationPointerUp, magnetSensitivity, resolveForkDrawingCommand, resolveForkSurfaceCursor, resolvedDrawings]);
    const handleForkPointerLeave = useCallback(() => {
        lastPointerContextRef.current = null;
        if (forkPointerOwnerRef.current !== null) {
            return;
        }
        setForkSurfaceCursor(resolveForkSurfaceCursor());
    }, [resolveForkSurfaceCursor]);
    useEffect(() => {
        if (!useForkRuntime) {
            setForkSurfaceCursor(undefined);
            return;
        }
        setForkSurfaceCursor(resolveForkSurfaceCursor());
    }, [resolveForkSurfaceCursor, useForkRuntime]);
    const resolveForkEventPayloadAtPosition = useCallback((localX, localY) => {
        const engine = engineInstanceRef.current;
        const visibleRange = (() => {
            if (!engine)
                return null;
            const range = engine.getVisibleRange();
            if (!range || Math.abs(range.to - range.from) <= 1e-6)
                return null;
            return range;
        })() ?? forkVisibleRangeRef.current;
        const currentPaneSnapshots = (() => {
            if (!engine)
                return null;
            const sn = engine.getPaneSnapshots();
            if (!sn || sn.length === 0)
                return null;
            return sn;
        })() ?? (forkPaneSnapshotsRef.current.length > 0 ? forkPaneSnapshotsRef.current : paneSnapshots);
        const snapshot = findPaneSnapshotAtPosition(currentPaneSnapshots, localX, localY);
        if (!snapshot) {
            return {
                mouseXY: [localX, localY],
            };
        }
        const currentCharts = visiblePanes.findIndex((pane) => pane.id === snapshot.paneId);
        const dataIndex = visibleRange
            ? resolvePaneDataIndexAtPixel(snapshot, visibleRange, localX, plotData.length)
            : null;
        return {
            currentItem: dataIndex === null ? undefined : plotData[dataIndex],
            currentCharts: currentCharts >= 0 ? [currentCharts] : undefined,
            mouseXY: [localX, localY],
        };
    }, [paneSnapshots, plotData, visiblePanes, forkPaneSnapshotsRef, forkVisibleRangeRef, engineInstanceRef]);
    useEffect(() => {
        const previousTool = previousForkAuthoringToolRef.current;
        previousForkAuthoringToolRef.current = activeForkDrawingTool;
        if (!useForkRuntime || !drawingUiEnabled || !activeForkDrawingTool) {
            return;
        }
        if (previousTool === activeForkDrawingTool) {
            return;
        }
        forkManipulationSessionRef.current = null;
        forkManipulationPreviewRef.current = null;
        setForkManipulationActive(false);
        setForkPreviewRevision((revision) => revision + 1);
        closeForkDrawingContextMenu();
        if (!resolvedSelectedDrawing) {
            return;
        }
        updateForkReadonlySelection(null);
        drawingWorkspace.selectDrawing(null);
    }, [activeForkDrawingTool, closeForkDrawingContextMenu, drawingUiEnabled, drawingWorkspace, updateForkReadonlySelection, resolvedSelectedDrawing, useForkRuntime]);
    const forkRenderableDrawings = useMemo(() => {
        if (forkManipulationPreviewRef.current) {
            return forkManipulationPreviewRef.current;
        }
        if (drawingWorkspace.interaction.drawingState.type === "drawing") {
            const draftDrawing = drawingWorkspace.interaction.drawingState.object;
            return resolveRenderableForkDrawings([...resolvedDrawings.filter((drawing) => drawing.id !== draftDrawing.id), draftDrawing], resolvedForkSingleSelection);
        }
        return resolveRenderableForkDrawings(resolvedDrawings, resolvedForkSingleSelection);
    }, [drawingWorkspace.interaction.drawingState, forkPreviewRevision, resolvedDrawings, resolvedForkSingleSelection]);
    const forkRenderableDrawingMap = useMemo(() => new Map(forkRenderableDrawings.map((drawing) => [drawing.id, drawing])), [forkRenderableDrawings]);
    const openForkContextMenuAtPosition = useCallback((localX, localY, nativeEvent) => {
        const hitDrawingState = engineInstanceRef.current?.hitTestDrawingPrimitive(localX, localY) ?? null;
        const hitDrawing = hitDrawingState?.actionHandle
            ? null
            : (hitDrawingState?.drawingId ?? hitDrawingState?.key)
                ? forkRenderableDrawingMap.get(hitDrawingState.drawingId ?? hitDrawingState.key) ?? null
                : null;
        if (hitDrawing) {
            updateForkReadonlySelection(hitDrawing);
            setForkDrawingContextMenu({
                x: Math.min(Math.max(12, localX + 8), Math.max(12, size.width - 260)),
                y: Math.min(Math.max(12, localY + 8), Math.max(12, size.height - 260)),
                drawingId: hitDrawing.id,
            });
            return;
        }
        closeForkDrawingContextMenu();
        if (!onContextMenu) {
            return;
        }
        onContextMenu(resolveForkEventPayloadAtPosition(localX, localY), nativeEvent);
    }, [closeForkDrawingContextMenu, forkRenderableDrawingMap, onContextMenu, resolveForkEventPayloadAtPosition, size.height, size.width, updateForkReadonlySelection, setForkDrawingContextMenu, engineInstanceRef]);
    const handleForkClick = useCallback((event) => {
        if (!useForkRuntime) {
            return;
        }
        if (forkRubberBandJustCommittedRef.current) {
            forkRubberBandJustCommittedRef.current = false;
            return;
        }
        if (suppressNextForkSurfaceClickRef.current) {
            suppressNextForkSurfaceClickRef.current = false;
            return;
        }
        if (activeForkDrawingTool) {
            return;
        }
        closeForkDrawingContextMenu();
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        const hitDrawingState = engineInstanceRef.current?.hitTestDrawingPrimitive(localX, localY) ?? null;
        if (hitDrawingState?.actionHandle) {
            switch (hitDrawingState.actionHandle) {
                case "delete":
                    drawingWorkspace.interaction.deleteSelected();
                    return;
                case "clone":
                    cloneSelectedDrawing();
                    return;
                case "lock":
                    toggleSelectedLock();
                    return;
            }
        }
        const hitDrawingId = hitDrawingState?.drawingId ?? hitDrawingState?.key ?? null;
        const hitDrawing = hitDrawingId
            ? forkRenderableDrawingMap.get(hitDrawingId) ?? null
            : null;
        const isMultiSelectModifier = Boolean(event.shiftKey || event.ctrlKey || event.metaKey);
        if (hitDrawing) {
            if (isMultiSelectModifier) {
                const currentSelectedIds = drawingWorkspace.state.selectedIds;
                const nextSelectedIds = currentSelectedIds.includes(hitDrawing.id)
                    ? currentSelectedIds.filter((id) => id !== hitDrawing.id)
                    : [...currentSelectedIds, hitDrawing.id];
                updateForkReadonlySelectionByIds(nextSelectedIds);
                return;
            }
            if (resolvedSelectedDrawing?.id !== hitDrawing.id) {
                updateForkReadonlySelection(hitDrawing);
            }
            return;
        }
        if (resolvedSelectedDrawing) {
            updateForkReadonlySelection(null);
        }
        if (!onClick) {
            return;
        }
        onClick(resolveForkEventPayloadAtPosition(localX, localY), event.nativeEvent);
    }, [activeForkDrawingTool, cloneSelectedDrawing, closeForkDrawingContextMenu, drawingWorkspace, forkRenderableDrawingMap, onClick, resolveForkEventPayloadAtPosition, resolvedSelectedDrawing, toggleSelectedLock, updateForkReadonlySelection, updateForkReadonlySelectionByIds, useForkRuntime, engineInstanceRef]);
    const handleForkHostContextMenu = useCallback((pointerContext) => {
        if (!useForkRuntime || pointerContext.pointerType === "mouse") {
            return;
        }
        if (forkPointerOwnerRef.current !== null || activeForkDrawingTool) {
            return;
        }
        openForkContextMenuAtPosition(pointerContext.localX, pointerContext.localY, pointerContext);
    }, [activeForkDrawingTool, openForkContextMenuAtPosition, useForkRuntime]);
    const handleForkContextMenu = useCallback((event) => {
        if (!useForkRuntime) {
            return;
        }
        const isReplayShortcut = Boolean(event.altKey
            || event.nativeEvent.altKey
            || event.getModifierState?.("Alt")
            || forkAltShortcutPressedRef.current);
        if (isReplayShortcut) {
            closeForkDrawingContextMenu();
            if (!onContextMenu) {
                return;
            }
            event.preventDefault();
            const rect = event.currentTarget.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            onContextMenu(resolveForkEventPayloadAtPosition(localX, localY), event.nativeEvent);
            return;
        }
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const localX = event.clientX - rect.left;
        const localY = event.clientY - rect.top;
        openForkContextMenuAtPosition(localX, localY, event.nativeEvent);
    }, [closeForkDrawingContextMenu, onContextMenu, openForkContextMenuAtPosition, resolveForkEventPayloadAtPosition, useForkRuntime, forkAltShortcutPressedRef]);
    const cancelForkInteraction = useCallback(() => {
        forkPointerOwnerRef.current = null;
        forkManipulationSessionRef.current = null;
        forkManipulationPreviewRef.current = null;
        setForkManipulationActive(false);
        setForkPreviewRevision((revision) => revision + 1);
        if (forkRubberBandSelectionRef.current) {
            forkRubberBandSelectionRef.current = null;
            setForkRubberBandTick((revision) => revision + 1);
        }
        drawingWorkspace.interaction.cancelDrawing();
        drawingWorkspace.setActiveTool("cursor");
    }, [drawingWorkspace]);
    useEffect(() => {
        if (!useForkRuntime) {
            return undefined;
        }
        window.addEventListener("pointerup", releasePointerOwner);
        window.addEventListener("pointercancel", releasePointerOwner);
        window.addEventListener("pointermove", releaseWhenNoButtonsPressed);
        window.addEventListener("mouseup", releasePointerOwner);
        window.addEventListener("touchend", releasePointerOwner);
        window.addEventListener("touchcancel", releasePointerOwner);
        window.addEventListener("contextmenu", releasePointerOwner);
        window.addEventListener("lostpointercapture", releasePointerOwner);
        window.addEventListener("pagehide", releasePointerOwner);
        window.addEventListener("blur", releasePointerOwner);
        document.addEventListener("visibilitychange", releaseOnVisibilityChange);
        return () => {
            window.removeEventListener("pointerup", releasePointerOwner);
            window.removeEventListener("pointercancel", releasePointerOwner);
            window.removeEventListener("pointermove", releaseWhenNoButtonsPressed);
            window.removeEventListener("mouseup", releasePointerOwner);
            window.removeEventListener("touchend", releasePointerOwner);
            window.removeEventListener("touchcancel", releasePointerOwner);
            window.removeEventListener("contextmenu", releasePointerOwner);
            window.removeEventListener("lostpointercapture", releasePointerOwner);
            window.removeEventListener("pagehide", releasePointerOwner);
            window.removeEventListener("blur", releasePointerOwner);
            document.removeEventListener("visibilitychange", releaseOnVisibilityChange);
        };
    }, [clearForkPointerOwner, useForkRuntime, releasePointerOwner, releaseWhenNoButtonsPressed, releaseOnVisibilityChange]);
    const forkRubberBandSelection = forkRubberBandSelectionRef.current;
    return {
        forkSurfaceCursor,
        forkPreviewRevision,
        forkManipulationActive,
        forkRubberBandSelection,
        forkRenderableDrawings,
        forkPointerOwnerRef,
        claimForkPointerOwner,
        releaseForkPointerOwner,
        handleForkPointerDown,
        handleForkPointerMove,
        handleForkPointerUp,
        handleForkPointerLeave,
        handleForkClick,
        handleForkContextMenu,
        handleForkHostContextMenu,
        handleForkDrawingClick,
        cancelForkInteraction,
    };
}
