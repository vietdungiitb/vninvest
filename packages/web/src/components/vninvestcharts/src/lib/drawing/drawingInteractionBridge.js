import { createInteractionCommand, } from "@vninvestcharts/vn-kline-engine-core";
import { buildRenderScalesFromBridge, resolveChartPointWithBridge, } from "./coordinateBridge.js";
import { getResizeHandleIndex, hitTestDrawing } from "./hitTest.js";
import { findSnapPoint, MAGNET_TOLERANCE } from "./snap.js";
function normalizePointerDeviceType(pointerType) {
    if (pointerType === "touch" || pointerType === "pen") {
        return pointerType;
    }
    return "mouse";
}
function sortVisibleDrawings(drawings) {
    return drawings
        .map((drawing, index) => ({ drawing, index }))
        .filter(({ drawing }) => drawing.visible !== false)
        .sort((left, right) => (left.drawing.zIndex ?? 0) - (right.drawing.zIndex ?? 0) || left.index - right.index)
        .map(({ drawing }) => drawing);
}
export function resolveDrawingInteractionContext({ bridge, paneId, chartWidth, chartHeight, x, y, plotData, xAccessor, scaleSlotId, yDomain, pixelOffset, }) {
    const renderScales = buildRenderScalesFromBridge(bridge, {
        paneId,
        scaleSlotId,
        plotData,
        xAccessor,
        yDomain,
        pixelOffset,
    });
    if (!renderScales) {
        return undefined;
    }
    const chartPoint = resolveChartPointWithBridge(bridge, {
        paneId,
        scaleSlotId,
        x,
        y,
    });
    if (!chartPoint) {
        return undefined;
    }
    const offsetX = pixelOffset?.x ?? 0;
    const offsetY = pixelOffset?.y ?? 0;
    return {
        paneId,
        scaleSlotId,
        chartWidth,
        chartHeight,
        mousePosition: [x - offsetX, y - offsetY],
        plotData: (renderScales.plotData ?? plotData),
        renderScales,
        chartPoint,
    };
}
export function createDrawingFrameSnapshot(context, pointer) {
    return {
        paneId: context.paneId,
        scaleSlotId: context.scaleSlotId,
        chartWidth: context.chartWidth,
        chartHeight: context.chartHeight,
        mousePosition: context.mousePosition,
        chartPoint: { ...context.chartPoint },
        plotDataLength: context.plotData.length,
        pointer: {
            clientX: pointer.clientX,
            clientY: pointer.clientY,
            localX: pointer.localX,
            localY: pointer.localY,
            buttons: pointer.buttons,
            pointerType: normalizePointerDeviceType(pointer.pointerType),
            modifiers: {
                altKey: pointer.altKey,
                ctrlKey: pointer.ctrlKey,
                metaKey: pointer.metaKey,
                shiftKey: pointer.shiftKey,
            },
        },
    };
}
export function createDrawingInteractionCommand(type, context, pointer) {
    const command = createInteractionCommand(type, pointer);
    return {
        type: command.type,
        context,
        frame: createDrawingFrameSnapshot(context, command.context),
        pointer: command.context,
    };
}
export function hitTestDrawingWithContext(drawing, context, toleranceOrPointerType = "mouse") {
    const [mouseX, mouseY] = context.mousePosition;
    return hitTestDrawing(drawing, mouseX, mouseY, context.renderScales, {
        chartWidth: context.chartWidth,
        chartHeight: context.chartHeight,
        plotData: context.plotData,
    }, toleranceOrPointerType);
}
export function findHitDrawingWithContext(drawings, context, toleranceOrPointerType = "mouse") {
    const orderedDrawings = sortVisibleDrawings(drawings);
    return [...orderedDrawings].reverse().find((drawing) => hitTestDrawingWithContext(drawing, context, toleranceOrPointerType));
}
export function findSnapPointWithContext(drawings, context, magnetSensitivity) {
    if (magnetSensitivity === "off") {
        return null;
    }
    const [mouseX, mouseY] = context.mousePosition;
    return findSnapPoint(mouseX, mouseY, context.renderScales, context.plotData, sortVisibleDrawings(drawings), MAGNET_TOLERANCE[magnetSensitivity], magnetSensitivity);
}
export function resolveDrawingPointWithContext(drawings, context, magnetSensitivity) {
    const snap = findSnapPointWithContext(drawings, context, magnetSensitivity);
    return {
        point: snap?.chartPoint ?? context.chartPoint,
        snap,
    };
}
export function resolveDrawingManipulationIntentWithContext(drawing, context) {
    const [mouseX, mouseY] = context.mousePosition;
    const resizeHandleIndex = getResizeHandleIndex(drawing, mouseX, mouseY, context.renderScales);
    if (resizeHandleIndex !== null) {
        return {
            mode: "resize",
            handleIndex: resizeHandleIndex,
        };
    }
    if (hitTestDrawingWithContext(drawing, context)) {
        return { mode: "move" };
    }
    return null;
}
