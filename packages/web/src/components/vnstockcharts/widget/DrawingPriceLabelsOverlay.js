import { jsx as _jsx } from "react/jsx-runtime";
import { useMemo } from "react";
import { measurementPointToPixelWithBridge } from "../lib/drawing/coordinateBridge.js";
import { resolveDrawingStyle } from "../lib/drawing/drawingStyleRegistry.js";
import { resolveDrawingPriceMarkers } from "../lib/drawing/priceLabel.js";
function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
function resolvePreferredScaleSlotId(snapshot, requestedScaleSlotId) {
    if (requestedScaleSlotId && snapshot.scaleSlotStates[requestedScaleSlotId]) {
        return requestedScaleSlotId;
    }
    const visibleScaleSlotIds = Object.entries(snapshot.scaleSlotStates)
        .filter(([, state]) => state.visible)
        .map(([scaleSlotId]) => scaleSlotId);
    if (visibleScaleSlotIds.length === 0) {
        return undefined;
    }
    return visibleScaleSlotIds.find((scaleSlotId) => snapshot.scaleSlotStates[scaleSlotId]?.side === "right")
        ?? visibleScaleSlotIds[0];
}
function resolveDrawingSnapshot(drawing, paneSnapshots) {
    if (!drawing) {
        return undefined;
    }
    if (drawing.paneId) {
        const targetedSnapshot = paneSnapshots.find((snapshot) => snapshot.paneId === drawing.paneId);
        if (targetedSnapshot) {
            return targetedSnapshot;
        }
    }
    return paneSnapshots[0];
}
export default function DrawingPriceLabelsOverlay({ enabled, highlighted = false, runtime = "fork", priceFormat, drawing, coordinateBridge, paneSnapshots, height, }) {
    const markers = useMemo(() => resolveDrawingPriceMarkers(drawing), [drawing]);
    const effectiveDrawing = useMemo(() => drawing ? {
        ...drawing,
        style: resolveDrawingStyle(drawing),
    } : null, [drawing]);
    if (!enabled || markers.length === 0 || !effectiveDrawing) {
        return null;
    }
    const snapshot = resolveDrawingSnapshot(drawing, paneSnapshots);
    if (!snapshot) {
        return null;
    }
    const anchorPoint = effectiveDrawing.points[0] ?? effectiveDrawing.points[effectiveDrawing.points.length - 1];
    if (!anchorPoint) {
        return null;
    }
    const scaleSlotId = resolvePreferredScaleSlotId(snapshot, effectiveDrawing.yScaleId);
    if (!scaleSlotId) {
        return null;
    }
    const labelFill = effectiveDrawing.style.fill && effectiveDrawing.style.fill !== "transparent"
        ? effectiveDrawing.style.fill
        : "#BAB8B8";
    const highlightFill = "#f59e0b";
    const fillColor = highlighted ? highlightFill : labelFill;
    const strokeColor = highlighted ? highlightFill : effectiveDrawing.style.stroke;
    const textColor = "#FFFFFF";
    return (_jsx("div", { "aria-hidden": "true", "data-rsc-drawing-price-labels": runtime, style: {
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            zIndex: 12,
        }, children: markers.map((marker) => {
            const pixel = measurementPointToPixelWithBridge(coordinateBridge, {
                paneId: snapshot.paneId,
                scaleSlotId,
                point: {
                    index: 0,
                    date: new Date(anchorPoint.x),
                    price: marker.price,
                },
            });
            if (!pixel) {
                return null;
            }
            const top = height > 0 ? clamp(pixel.y - 10, 0, Math.max(0, height - 22)) : pixel.y - 10;
            const side = snapshot.scaleSlotStates[scaleSlotId]?.side ?? "right";
            return (_jsx("div", { "data-rsc-drawing-price-label": marker.key, style: {
                    position: "absolute",
                    top,
                    left: side === "left" ? 0 : undefined,
                    right: side === "right" ? 0 : undefined,
                    transform: "translateY(-50%)",
                    minWidth: 52,
                    padding: "2px 8px",
                    boxSizing: "border-box",
                    display: "flex",
                    justifyContent: side === "right" ? "flex-end" : "flex-start",
                    alignItems: "center",
                    borderRadius: 6,
                    border: `1px solid ${strokeColor}`,
                    background: fillColor,
                    color: textColor,
                    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
                    fontSize: 12,
                    fontWeight: 600,
                    lineHeight: "16px",
                    whiteSpace: "nowrap",
                }, children: priceFormat(marker.price) }, marker.key));
        }) }));
}
