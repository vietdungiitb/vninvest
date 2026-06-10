import { createPaneProjector } from "./paneProjector.js";
function clampIndexInt(index, dataLength) {
    if (dataLength <= 0) {
        return 0;
    }
    return Math.min(dataLength - 1, Math.max(0, Math.round(index)));
}
function clampIndexFloat(index, dataLength) {
    if (dataLength <= 0) {
        return 0;
    }
    return index;
}
export function resolvePaneDataIndexAtPixel(snapshot, visibleRange, x, dataLength) {
    const { left, width } = snapshot.plotBounds;
    if (!Number.isFinite(x) || width <= 0 || x < left || x > left + width || dataLength <= 0) {
        return null;
    }
    const projector = createPaneProjector(snapshot, visibleRange, "__unused-scale-slot__");
    const index = projector.pixelXToIndex(x);
    if (index === null) {
        return null;
    }
    return clampIndexInt(index, dataLength);
}
export function resolvePanePixelAtDataIndex(snapshot, visibleRange, index, dataLength) {
    const { left, width } = snapshot.plotBounds;
    if (!Number.isFinite(index) || width <= 0 || dataLength <= 0) {
        return null;
    }
    const clampedIndex = clampIndexFloat(index, dataLength);
    const projector = createPaneProjector(snapshot, visibleRange, "__unused-scale-slot__");
    return projector.indexToPixelX(clampedIndex);
}
export function resolvePaneValueAtPixel(snapshot, scaleSlotId, y) {
    const scaleSlotState = snapshot.scaleSlotStates[scaleSlotId];
    const { top, height } = snapshot.plotBounds;
    if (!scaleSlotState?.domain || !Number.isFinite(y) || height <= 0 || y < top || y > top + height) {
        return null;
    }
    const projector = createPaneProjector(snapshot, visibleRangeFromPlotBounds(snapshot), scaleSlotId);
    return projector.pixelYToValue(y);
}
export function resolvePanePixelAtValue(snapshot, scaleSlotId, value) {
    const scaleSlotState = snapshot.scaleSlotStates[scaleSlotId];
    const { top, height } = snapshot.plotBounds;
    if (!scaleSlotState?.domain || !Number.isFinite(value) || height <= 0) {
        return null;
    }
    const [minValue, maxValue] = scaleSlotState.domain;
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
        return null;
    }
    if (maxValue === minValue) {
        return top + height / 2;
    }
    const projector = createPaneProjector(snapshot, visibleRangeFromPlotBounds(snapshot), scaleSlotId);
    const y = projector.valueToPixelY(value);
    if (y === null) {
        return null;
    }
    return Math.min(top + height, Math.max(top, y));
}
function visibleRangeFromPlotBounds(snapshot) {
    const { left, width } = snapshot.plotBounds;
    return { from: left, to: left + width };
}
