import { createDateTimeIndexMap, createPaneProjector, } from "@vninvestcharts/vn-kline-engine-core";
import { getDrawingBoundingBox } from "../lib/drawing/hitTest.js";
import { toOverlayPrimitive } from "../lib/drawing/overlayPrimitiveAdapter.js";
function resolvePreferredScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]?.visible) {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = Object.entries(snapshot.scaleSlotStates)
        .filter(([, state]) => state.visible)
        .map(([scaleSlotId]) => scaleSlotId);
    if (visibleScaleSlotIds.length === 0) {
        return requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]
            ? requestedScaleSlotId
            : undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId] ? requestedScaleSlotId : undefined)
        ?? visibleScaleSlotIds[0];
}
function resolveDrawingSnapshot(drawing, paneSnapshots) {
    if (drawing.paneId) {
        const targetedSnapshot = paneSnapshots.find((snapshot) => snapshot.paneId === drawing.paneId);
        if (targetedSnapshot) {
            return targetedSnapshot;
        }
    }
    return paneSnapshots[0];
}
export function resolveRenderableForkDrawings(drawings, selectedDrawing) {
    const visibleDrawings = drawings.filter((drawing) => drawing.visible !== false);
    if (!selectedDrawing || selectedDrawing.visible === false || visibleDrawings.some((drawing) => drawing.id === selectedDrawing.id)) {
        return visibleDrawings;
    }
    return [...visibleDrawings, selectedDrawing];
}
function sortDrawingsForHitTest(drawings) {
    return [...drawings].sort((left, right) => {
        const leftZIndex = left.zIndex ?? 0;
        const rightZIndex = right.zIndex ?? 0;
        if (leftZIndex !== rightZIndex) {
            return leftZIndex - rightZIndex;
        }
        return left.id.localeCompare(right.id);
    });
}
function createActionHandlePrimitiveInput(drawing, paneId, scaleSlotId, handle, center) {
    const iconByHandle = {
        delete: "\u00d7",
        clone: "+",
        lock: drawing.locked ? "\u25a0" : "\u25a1",
    };
    const fillByHandle = {
        delete: "#ff4d4f",
        clone: "#1677ff",
        lock: drawing.locked ? "#faad14" : "#8c8c8c",
    };
    return {
        key: `${drawing.id}::action-handle::${handle}`,
        paneId,
        scaleSlotId,
        selected: false,
        drawingId: drawing.id,
        actionHandle: handle,
        clipToPane: false,
        primitive: {
            type: "circle",
            points: [center, { x: center.x + 8, y: center.y }],
            style: {
                stroke: "#ffffff",
                strokeWidth: 1.5,
                fill: fillByHandle[handle],
                fillOpacity: 1,
                opacity: 1,
                fontSize: 10,
                fontFamily: "sans-serif",
            },
            labels: [{
                    text: iconByHandle[handle],
                    position: center,
                    color: "#ffffff",
                    align: "center",
                    baseline: "middle",
                    weight: 700,
                    fontSize: 10,
                }],
        },
    };
}
function createForkDrawingActionHandlePrimitiveInputs(drawing, snapshot, scaleSlotId, scales) {
    const boundingBox = getDrawingBoundingBox(drawing, scales, snapshot.plotBounds.width, snapshot.plotBounds.height);
    if (!boundingBox) {
        return [];
    }
    const timeIndexMap = createDateTimeIndexMap(scales.plotData);
    const getLogicCenter = (px, py) => {
        const date = scales.xScaleInvert(px);
        const xIndexFloat = timeIndexMap.resolveIndexByTime(date.getTime()) ?? undefined;
        const yPrice = scales.yScaleInvert(py);
        return { x: px, y: py, xIndexFloat, yPrice };
    };
    return [
        createActionHandlePrimitiveInput(drawing, snapshot.paneId, scaleSlotId, "delete", getLogicCenter(boundingBox.maxX + 14, boundingBox.minY - 14)),
        createActionHandlePrimitiveInput(drawing, snapshot.paneId, scaleSlotId, "clone", getLogicCenter(boundingBox.maxX + 32, boundingBox.minY - 14)),
        createActionHandlePrimitiveInput(drawing, snapshot.paneId, scaleSlotId, "lock", getLogicCenter(boundingBox.minX - 14, boundingBox.minY - 14)),
    ];
}
export function createForkDrawingScales(snapshot, scaleSlotId, visibleRange, plotData) {
    if (plotData.length === 0) {
        return null;
    }
    const timeIndexMap = createDateTimeIndexMap(plotData);
    const projector = createPaneProjector(snapshot, visibleRange, scaleSlotId);
    const { plotBounds } = snapshot;
    const scaleSlotDomain = snapshot.scaleSlotStates[scaleSlotId]?.domain;
    const hasFiniteDomain = Array.isArray(scaleSlotDomain)
        && scaleSlotDomain.length >= 2
        && Number.isFinite(scaleSlotDomain[0])
        && Number.isFinite(scaleSlotDomain[1])
        && scaleSlotDomain[0] !== scaleSlotDomain[1];
    const mapDataIndexToAbsoluteX = (index) => {
        const targetIndex = index + 0.5;
        const projected = projector.indexToPixelX(targetIndex);
        if (projected !== null) {
            return projected;
        }
        const from = Math.min(visibleRange.from, visibleRange.to);
        const to = Math.max(visibleRange.from, visibleRange.to);
        const span = Math.max(1e-6, to - from);
        const ratio = (targetIndex - from) / span;
        return plotBounds.left + ratio * plotBounds.width;
    };
    const mapAbsoluteXToDataIndex = (absoluteX) => {
        const projected = projector.pixelXToIndex(absoluteX);
        if (projected !== null) {
            return projected - 0.5;
        }
        if (plotBounds.width <= 0) {
            return null;
        }
        const from = Math.min(visibleRange.from, visibleRange.to);
        const to = Math.max(visibleRange.from, visibleRange.to);
        const span = Math.max(1e-6, to - from);
        const ratio = (absoluteX - plotBounds.left) / plotBounds.width;
        const index = from + ratio * span;
        return index - 0.5;
    };
    const mapValueToAbsoluteY = (price) => {
        const projected = projector.valueToPixelY(price);
        if (projected !== null) {
            return projected;
        }
        if (hasFiniteDomain && plotBounds.height > 0) {
            const [domainStart, domainEnd] = scaleSlotDomain;
            const ratio = (price - domainStart) / (domainEnd - domainStart);
            return plotBounds.top + ((1 - ratio) * plotBounds.height);
        }
        return null;
    };
    const mapAbsoluteYToValue = (absoluteY) => {
        const projected = projector.pixelYToValue(absoluteY);
        if (projected !== null) {
            return projected;
        }
        if (hasFiniteDomain && plotBounds.height > 0) {
            const [domainStart, domainEnd] = scaleSlotDomain;
            const ratio = (plotBounds.top + plotBounds.height - absoluteY) / plotBounds.height;
            return domainStart + ratio * (domainEnd - domainStart);
        }
        return null;
    };
    return {
        xScale: (date) => {
            const fractionalDataIndex = timeIndexMap.resolveIndexByTime(date.getTime());
            const x = fractionalDataIndex === null ? null : mapDataIndexToAbsoluteX(fractionalDataIndex);
            return x === null ? Number.NaN : x - plotBounds.left;
        },
        xScaleByIndex: (index) => {
            return mapDataIndexToAbsoluteX(index) - plotBounds.left;
        },
        xScaleInvert: (pixel) => {
            const absoluteX = plotBounds.left + pixel;
            const dataIndex = mapAbsoluteXToDataIndex(absoluteX);
            const timestamp = dataIndex === null ? null : timeIndexMap.resolveTimeByIndex(dataIndex);
            return timestamp === null ? new Date(0) : new Date(timestamp);
        },
        xScaleInvertToIndex: (pixel) => {
            const absoluteX = plotBounds.left + pixel;
            return mapAbsoluteXToDataIndex(absoluteX);
        },
        yScale: (price) => {
            const y = mapValueToAbsoluteY(price);
            return y === null ? Number.NaN : y - plotBounds.top;
        },
        yScaleInvert: (pixel) => {
            const absoluteY = plotBounds.top + pixel;
            const value = mapAbsoluteYToValue(absoluteY);
            return value === null ? Number.NaN : value;
        },
        plotData: plotData,
    };
}
export function createForkDrawingPrimitiveInputs({ drawings, selectedDrawing, selectedDrawingIds, paneSnapshots, visibleRange, plotData, }) {
    if (!visibleRange || plotData.length === 0 || paneSnapshots.length === 0) {
        return [];
    }
    const selectedDrawingId = selectedDrawing?.id;
    const selectedIdSet = new Set(selectedDrawingIds ?? (selectedDrawingId ? [selectedDrawingId] : []));
    return sortDrawingsForHitTest(resolveRenderableForkDrawings(drawings, selectedDrawing)).flatMap((drawing) => {
        const snapshot = resolveDrawingSnapshot(drawing, paneSnapshots);
        if (!snapshot) {
            return [];
        }
        const scaleSlotId = resolvePreferredScaleSlotId(snapshot, drawing.yScaleId);
        if (!scaleSlotId) {
            return [];
        }
        const scales = createForkDrawingScales(snapshot, scaleSlotId, visibleRange, plotData);
        if (!scales) {
            return [];
        }
        const primitive = toOverlayPrimitive(drawing, scales, {
            chartWidth: snapshot.plotBounds.width,
            chartHeight: snapshot.plotBounds.height,
            plotData: scales.plotData,
        });
        if (!primitive) {
            return [];
        }
        const primitiveInput = {
            key: drawing.id,
            paneId: snapshot.paneId,
            scaleSlotId,
            primitive,
            selected: selectedIdSet.has(drawing.id),
            drawingId: drawing.id,
            clipToPane: true,
        };
        if (!selectedDrawingId || selectedIdSet.size !== 1 || drawing.id !== selectedDrawingId) {
            return [primitiveInput];
        }
        return [
            primitiveInput,
            ...createForkDrawingActionHandlePrimitiveInputs(drawing, snapshot, scaleSlotId, scales),
        ];
    });
}
