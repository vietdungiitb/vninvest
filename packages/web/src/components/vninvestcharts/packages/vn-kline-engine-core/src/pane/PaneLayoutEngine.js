const DEFAULT_AXIS_WIDTH = 48;
function cloneBounds(bounds) {
    return { ...bounds };
}
function cloneScaleSlotRuntimeState(state) {
    return {
        ...state,
        domain: state.domain ? [...state.domain] : undefined,
    };
}
export function clonePaneRuntimeSnapshot(snapshot) {
    return {
        paneId: snapshot.paneId,
        bounds: cloneBounds(snapshot.bounds),
        plotBounds: cloneBounds(snapshot.plotBounds),
        axisBounds: Object.fromEntries(Object.entries(snapshot.axisBounds).map(([side, bounds]) => [side, bounds ? cloneBounds(bounds) : bounds])),
        scaleSlotBounds: Object.fromEntries(Object.entries(snapshot.scaleSlotBounds).map(([slotId, bounds]) => [slotId, cloneBounds(bounds)])),
        scaleSlotStates: Object.fromEntries(Object.entries(snapshot.scaleSlotStates).map(([slotId, state]) => [slotId, cloneScaleSlotRuntimeState(state)])),
        headerAnchor: { ...snapshot.headerAnchor },
        labelAnchor: { ...snapshot.labelAnchor },
    };
}
function normalizeVisiblePanes(panes) {
    return panes.filter((pane) => pane.visible).map((pane) => ({
        ...pane,
        heightRatio: pane.heightRatio > 0 ? pane.heightRatio : 1,
    }));
}
function collectVisibleScaleSlots(scaleSlots, side) {
    return scaleSlots.filter((slot) => slot.visible && slot.side === side);
}
function createScaleSlotRuntimeState(slot) {
    return {
        side: slot.side,
        mode: slot.mode,
        visible: slot.visible,
        domain: slot.domain ? [...slot.domain] : undefined,
    };
}
export class PaneLayoutEngine {
    axisWidth;
    constructor(axisWidth = DEFAULT_AXIS_WIDTH) {
        this.axisWidth = axisWidth;
    }
    layout(panes, width, height) {
        const visiblePanes = normalizeVisiblePanes(panes);
        if (visiblePanes.length === 0) {
            return [];
        }
        const hasAnyLeftAxis = visiblePanes.some((pane) => collectVisibleScaleSlots(pane.scaleSlots, "left").length > 0);
        const hasAnyRightAxis = visiblePanes.some((pane) => collectVisibleScaleSlots(pane.scaleSlots, "right").length > 0);
        const globalLeftAxisWidth = hasAnyLeftAxis ? this.axisWidth : 0;
        const globalRightAxisWidth = hasAnyRightAxis ? this.axisWidth : 0;
        const totalRatio = visiblePanes.reduce((sum, pane) => sum + pane.heightRatio, 0);
        let cursorTop = 0;
        return visiblePanes.map((pane, index) => {
            const isLastPane = index === visiblePanes.length - 1;
            const remainingHeight = Math.max(1, height - cursorTop);
            const paneHeight = isLastPane
                ? remainingHeight
                : Math.max(1, Math.round((pane.heightRatio / totalRatio) * height));
            const leftSlots = collectVisibleScaleSlots(pane.scaleSlots, "left");
            const rightSlots = collectVisibleScaleSlots(pane.scaleSlots, "right");
            const leftAxisWidth = leftSlots.length > 0 ? this.axisWidth : 0;
            const rightAxisWidth = rightSlots.length > 0 ? this.axisWidth : 0;
            const plotWidth = Math.max(1, width - globalLeftAxisWidth - globalRightAxisWidth);
            const top = cursorTop;
            cursorTop += paneHeight;
            const bounds = { top, left: 0, width, height: paneHeight };
            const plotBounds = { top, left: globalLeftAxisWidth, width: plotWidth, height: paneHeight };
            const axisBounds = {};
            const scaleSlotBounds = {};
            const scaleSlotStates = {};
            if (leftAxisWidth > 0) {
                const leftBounds = { top, left: 0, width: leftAxisWidth, height: paneHeight };
                axisBounds.left = leftBounds;
                leftSlots.forEach((slot) => {
                    scaleSlotBounds[slot.id] = cloneBounds(leftBounds);
                    scaleSlotStates[slot.id] = createScaleSlotRuntimeState(slot);
                });
            }
            if (rightAxisWidth > 0) {
                const rightBounds = { top, left: width - rightAxisWidth, width: rightAxisWidth, height: paneHeight };
                axisBounds.right = rightBounds;
                rightSlots.forEach((slot) => {
                    scaleSlotBounds[slot.id] = cloneBounds(rightBounds);
                    scaleSlotStates[slot.id] = createScaleSlotRuntimeState(slot);
                });
            }
            return {
                paneId: pane.id,
                bounds,
                plotBounds,
                axisBounds,
                scaleSlotBounds,
                scaleSlotStates,
                headerAnchor: { top, left: leftAxisWidth, width: plotWidth },
                labelAnchor: { top, left: 0, height: paneHeight },
            };
        });
    }
}
