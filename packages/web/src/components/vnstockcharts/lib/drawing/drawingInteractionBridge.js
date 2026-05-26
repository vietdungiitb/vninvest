import { buildRenderScalesFromBridge, resolveChartPointWithBridge, } from "./coordinateBridge.js";
import { hitTestDrawing } from "./hitTest.js";
import { findSnapPoint, MAGNET_TOLERANCE } from "./snap.js";
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
    const [mouseX, mouseY] = context.mousePosition;
    return findSnapPoint(mouseX, mouseY, context.renderScales, context.plotData, sortVisibleDrawings(drawings), MAGNET_TOLERANCE[magnetSensitivity]);
}
export function resolveDrawingPointWithContext(drawings, context, magnetSensitivity) {
    const snap = findSnapPointWithContext(drawings, context, magnetSensitivity);
    return {
        point: snap?.chartPoint ?? context.chartPoint,
        snap,
    };
}
