import { chartPointToPixel } from "./coordinateUtils.js";
import { findNearestOverlayEndpointSnap, MAGNET_TOLERANCE as CORE_MAGNET_TOLERANCE, } from "@vninvestcharts/vn-kline-engine-core";
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
/** GAP-7: Collect price candidates from visible Fibonacci level drawings. */
export function collectFibLevelSnapCandidates(drawings) {
    const candidates = [];
    for (const drawing of drawings) {
        if (drawing.visible === false)
            continue;
        if (!drawing.fibLevelConfigs?.length)
            continue;
        if (drawing.points.length < 2)
            continue;
        const p0y = drawing.points[0].y;
        const p1y = drawing.points[1].y;
        for (const level of drawing.fibLevelConfigs) {
            if (!level.visible)
                continue;
            const price = p0y + (p1y - p0y) * level.ratio;
            candidates.push({ price });
        }
    }
    return candidates;
}
function findFibLevelSnap(mouseX, mouseY, scales, existingDrawings, yTolerance) {
    const candidates = collectFibLevelSnapCandidates(existingDrawings);
    let best = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const c of candidates) {
        const pixelY = scales.yScale(c.price);
        const dist = Math.abs(mouseY - pixelY);
        if (dist <= yTolerance && dist < bestDist) {
            bestDist = dist;
            best = {
                chartPoint: { x: scales.xScaleInvert(mouseX).getTime(), y: c.price },
                pixelPoint: { x: mouseX, y: pixelY },
                snapType: "fib",
            };
        }
    }
    return best;
}
export function findSnapPoint(mouseX, mouseY, scales, plotData, existingDrawings, tolerance = 8, sensitivity = "normal") {
    if (sensitivity === "off") {
        return null;
    }
    const isStrong = sensitivity === "strong";
    const xTolerance = isStrong ? Infinity : 20;
    const yTolerance = isStrong ? Infinity : tolerance;
    const nearestBar = findNearestBar(mouseX, scales, plotData, xTolerance);
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
            if ((isStrong || distance <= yTolerance) && distance < bestDistance) {
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
    // GAP-7: Fibonacci level snap (between OHLC and endpoint priority)
    const fibSnap = findFibLevelSnap(mouseX, mouseY, scales, existingDrawings, yTolerance);
    if (fibSnap)
        return fibSnap;
    return pickEndpointSnap(mouseX, mouseY, scales, existingDrawings, isStrong ? Infinity : tolerance * 1.5);
}
