function toDate(value) {
    return value instanceof Date ? value : new Date(value);
}
function resolveMeasurementIndex(plotData, xAccessor, dateValue) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < plotData.length; index += 1) {
        const xValue = xAccessor(plotData[index]);
        if (xValue === undefined) {
            continue;
        }
        const candidateDate = toDate(xValue);
        if (!Number.isFinite(candidateDate.valueOf())) {
            continue;
        }
        const distance = Math.abs(candidateDate.getTime() - dateValue.getTime());
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
        }
    }
    return bestIndex;
}
export function resolveMeasurementPointFromValues({ plotData, xAccessor, dateValue, priceValue, }) {
    if (plotData.length === 0 || !Number.isFinite(dateValue.valueOf()) || !Number.isFinite(priceValue)) {
        return undefined;
    }
    const index = resolveMeasurementIndex(plotData, xAccessor, dateValue);
    if (index < 0) {
        return undefined;
    }
    return {
        index,
        date: dateValue,
        price: priceValue,
    };
}
export function measurementPointToPixelFromScales({ point, xScale, yScale, }) {
    const x = xScale(point.date);
    const y = yScale(point.price);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return undefined;
    }
    return { x, y };
}
export function summarizeMeasurement(selection) {
    const bars = Math.abs(selection.end.index - selection.start.index);
    const priceDelta = selection.end.price - selection.start.price;
    const priceDeltaPercent = selection.start.price !== 0 ? priceDelta / Math.abs(selection.start.price) : null;
    return {
        bars,
        priceDelta,
        priceDeltaPercent,
    };
}
