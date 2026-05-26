function toDate(value) {
    if (value instanceof Date) {
        return value;
    }
    return new Date(value ?? Number.NaN);
}
function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function resolveReferenceDate(plotData, xAccessor) {
    for (const datum of plotData) {
        const resolved = toDate(xAccessor ? xAccessor(datum) : datum.date);
        if (Number.isFinite(resolved.getTime())) {
            return resolved;
        }
    }
    return new Date(0);
}
function resolveReferencePrice(plotData, yDomain) {
    if (Array.isArray(yDomain) && yDomain.length >= 2) {
        const [start, end] = yDomain;
        if (isFiniteNumber(start) && isFiniteNumber(end)) {
            return (start + end) / 2;
        }
    }
    for (const datum of plotData) {
        const candidates = [datum.close, datum.open, datum.high, datum.low];
        for (const candidate of candidates) {
            if (isFiniteNumber(candidate)) {
                return candidate;
            }
        }
    }
    return 0;
}
export function resolveChartPointWithBridge(bridge, input) {
    return bridge.resolveChartPoint(input);
}
export function chartPointToPixelWithBridge(bridge, input) {
    return bridge.chartPointToPixel(input);
}
export function buildRenderScalesFromBridge(bridge, context) {
    const pixelOffset = context.pixelOffset ?? { x: 0, y: 0 };
    const toBridgePixel = (x, y) => ({
        x: x + pixelOffset.x,
        y: y + pixelOffset.y,
    });
    const fromBridgePixel = (pixel) => ({
        x: pixel.x - pixelOffset.x,
        y: pixel.y - pixelOffset.y,
    });
    const referenceDate = resolveReferenceDate(context.plotData, context.xAccessor);
    const referencePrice = resolveReferencePrice(context.plotData, context.yDomain);
    const referencePoint = { x: referenceDate.getTime(), y: referencePrice };
    const bridgeReferencePixel = bridge.chartPointToPixel({
        paneId: context.paneId,
        scaleSlotId: context.scaleSlotId,
        point: referencePoint,
    });
    if (!bridgeReferencePixel) {
        return undefined;
    }
    const referencePixel = fromBridgePixel(bridgeReferencePixel);
    return {
        xScale: (date) => {
            const pixel = bridge.chartPointToPixel({
                paneId: context.paneId,
                scaleSlotId: context.scaleSlotId,
                point: { x: date.getTime(), y: referencePrice },
            });
            return pixel ? fromBridgePixel(pixel).x : Number.NaN;
        },
        xScaleInvert: (pixelX) => new Date(bridge.resolveChartPoint({
            paneId: context.paneId,
            scaleSlotId: context.scaleSlotId,
            ...toBridgePixel(pixelX, referencePixel.y),
        })?.x ?? Number.NaN),
        yScale: (price) => {
            const pixel = bridge.chartPointToPixel({
                paneId: context.paneId,
                scaleSlotId: context.scaleSlotId,
                point: { x: referencePoint.x, y: price },
            });
            return pixel ? fromBridgePixel(pixel).y : Number.NaN;
        },
        yScaleInvert: (pixelY) => bridge.resolveChartPoint({
            paneId: context.paneId,
            scaleSlotId: context.scaleSlotId,
            ...toBridgePixel(referencePixel.x, pixelY),
        })?.y ?? Number.NaN,
        xAccessor: context.xAccessor,
        plotData: context.plotData,
    };
}
export function resolveMeasurementPointWithBridge(bridge, input) {
    return bridge.resolveMeasurementPoint(input);
}
export function measurementPointToPixelWithBridge(bridge, input) {
    return bridge.measurementPointToPixel(input);
}
