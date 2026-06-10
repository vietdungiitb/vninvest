export function areBoundsEqual(left, right) {
    return left.top === right.top
        && left.left === right.left
        && left.width === right.width
        && left.height === right.height;
}
export function areHeaderAnchorEqual(left, right) {
    return left.top === right.top && left.left === right.left && left.width === right.width;
}
export function areLabelAnchorEqual(left, right) {
    return left.top === right.top && left.left === right.left && left.height === right.height;
}
export function areAxisBoundsEqual(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const axisSide of leftKeys) {
        const leftBounds = left[axisSide];
        const rightBounds = right[axisSide];
        if (!leftBounds || !rightBounds || !areBoundsEqual(leftBounds, rightBounds)) {
            return false;
        }
    }
    return true;
}
export function areBoundsMapEqual(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        const leftBounds = left[key];
        const rightBounds = right[key];
        if (!rightBounds || !areBoundsEqual(leftBounds, rightBounds)) {
            return false;
        }
    }
    return true;
}
export function areDomainTupleEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return left[0] === right[0] && left[1] === right[1];
}
export function areScaleSlotStatesEqual(left, right) {
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    if (leftKeys.length !== rightKeys.length) {
        return false;
    }
    for (const key of leftKeys) {
        const leftState = left[key];
        const rightState = right[key];
        if (!rightState) {
            return false;
        }
        if (leftState.side !== rightState.side
            || leftState.mode !== rightState.mode
            || leftState.visible !== rightState.visible
            || !areDomainTupleEqual(leftState.domain, rightState.domain)) {
            return false;
        }
    }
    return true;
}
export function arePaneSnapshotsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (left.length !== right.length) {
        return false;
    }
    for (let index = 0; index < left.length; index += 1) {
        const leftSnapshot = left[index];
        const rightSnapshot = right[index];
        if (leftSnapshot.paneId !== rightSnapshot.paneId
            || !areBoundsEqual(leftSnapshot.bounds, rightSnapshot.bounds)
            || !areBoundsEqual(leftSnapshot.plotBounds, rightSnapshot.plotBounds)
            || !areAxisBoundsEqual(leftSnapshot.axisBounds, rightSnapshot.axisBounds)
            || !areBoundsMapEqual(leftSnapshot.scaleSlotBounds, rightSnapshot.scaleSlotBounds)
            || !areScaleSlotStatesEqual(leftSnapshot.scaleSlotStates, rightSnapshot.scaleSlotStates)
            || !areHeaderAnchorEqual(leftSnapshot.headerAnchor, rightSnapshot.headerAnchor)
            || !areLabelAnchorEqual(leftSnapshot.labelAnchor, rightSnapshot.labelAnchor)) {
            return false;
        }
    }
    return true;
}
export function areRuntimeCapabilitiesEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return left.engineRuntime === right.engineRuntime
        && left.paneToolbar === right.paneToolbar
        && left.paneSplitters === right.paneSplitters
        && left.chartCanvasOverlays === right.chartCanvasOverlays
        && left.measurementOverlay === right.measurementOverlay
        && left.drawingOverlays === right.drawingOverlays;
}
