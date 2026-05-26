import { chartPointToPixel } from "./coordinateUtils.js";
import { findNearestOverlayEndpointSnap, MAGNET_TOLERANCE as CORE_MAGNET_TOLERANCE, } from "./engineCompat.js";
export const MAGNET_TOLERANCE = CORE_MAGNET_TOLERANCE;
function toDate(value) {
    return value instanceof Date ? value : new Date(value);
}
function getDatumDate(datum, scales) {
    const xAccessor = scales.xAccessor;
    const value = xAccessor ? xAccessor(datum) : datum.date;
    return toDate(value);
}
function findNearestBar(mouseX, scales, plotData, xTolerance) {
    let best = null;
    for (const datum of plotData) {
        const date = getDatumDate(datum, scales);
        if (!Number.isFinite(date.getTime())) {
            continue;
        }
        const pixelX = scales.xScale(date);
        const distance = Math.abs(mouseX - pixelX);
        if (distance <= xTolerance && (!best || distance < best.distance)) {
            best = { datum, pixelX, distance };
        }
    }
    return best;
}
function pickEndpointSnap(mouseX, mouseY, scales, existingDrawings, tolerance) {
    const candidates = [];
    for (const drawing of existingDrawings) {
        if (drawing.visible === false) {
            continue;
        }
        for (const point of drawing.points) {
            candidates.push({
                chartPoint: { x: point.x, y: point.y },
                pixelPoint: chartPointToPixel(point, scales),
            });
        }
    }
    const snap = findNearestOverlayEndpointSnap(mouseX, mouseY, candidates, tolerance);
    return snap
        ? {
            chartPoint: snap.chartPoint,
            pixelPoint: snap.pixelPoint,
            snapType: snap.snapType,
        }
        : null;
}
export function findSnapPoint(mouseX, mouseY, scales, plotData, existingDrawings, tolerance = 8) {
    const nearestBar = findNearestBar(mouseX, scales, plotData, 20);
    if (nearestBar) {
        const date = getDatumDate(nearestBar.datum, scales);
        const candidates = [
            { key: "high", price: Number(nearestBar.datum.high) },
            { key: "low", price: Number(nearestBar.datum.low) },
            { key: "open", price: Number(nearestBar.datum.open) },
            { key: "close", price: Number(nearestBar.datum.close) },
        ];
        let bestOhlc = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            if (!Number.isFinite(candidate.price)) {
                continue;
            }
            const pixelPoint = {
                x: nearestBar.pixelX,
                y: scales.yScale(candidate.price),
            };
            const distance = Math.abs(mouseY - pixelPoint.y);
            if (distance <= tolerance && distance < bestDistance) {
                bestDistance = distance;
                bestOhlc = {
                    chartPoint: { x: date.getTime(), y: candidate.price },
                    pixelPoint,
                    snapType: "ohlc",
                };
            }
        }
        if (bestOhlc) {
            return bestOhlc;
        }
    }
    return pickEndpointSnap(mouseX, mouseY, scales, existingDrawings, tolerance * 1.5);
}
