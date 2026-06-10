export function clampIndex(index, length) {
    if (length <= 0) {
        return 0;
    }
    const lastIndex = length - 1;
    return Math.min(lastIndex, Math.max(0, Math.floor(index)));
}
export function clampToRange(value, min, max) {
    return Math.min(max, Math.max(min, value));
}
export function asTimeValue(value) {
    return value instanceof Date ? value.getTime() : value;
}
export function findNearestDateIndex(data, targetTime) {
    if (data.length === 0) {
        return 0;
    }
    let low = 0;
    let high = data.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = data[mid].date.getTime();
        if (midTime === targetTime) {
            return mid;
        }
        if (midTime < targetTime) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    const right = Math.min(data.length - 1, Math.max(0, low));
    const left = Math.min(data.length - 1, Math.max(0, high));
    return Math.abs(data[left].date.getTime() - targetTime) <= Math.abs(data[right].date.getTime() - targetTime)
        ? left
        : right;
}
export function normalizeForkVisibleRange(range, data) {
    if (data.length === 0) {
        return null;
    }
    const rawStartIndex = clampIndex(Math.floor(Math.min(range.from, range.to)), data.length);
    const rawEndExclusive = clampToRange(Math.ceil(Math.max(range.from, range.to)), rawStartIndex + 1, data.length);
    const rawEndIndex = rawEndExclusive - 1;
    const startBar = data[rawStartIndex];
    const endBar = data[rawEndIndex];
    if (!startBar?.date || !endBar?.date) {
        return null;
    }
    return {
        startIndex: rawStartIndex,
        endIndex: rawEndIndex,
        startDate: startBar.date,
        endDate: endBar.date,
        barCount: rawEndExclusive - rawStartIndex,
    };
}
export function normalizeEngineVisibleRange(visibleRange, dataLength) {
    if (!visibleRange || dataLength <= 0) {
        return null;
    }
    const from = clampIndex(Math.floor(Math.min(visibleRange.from, visibleRange.to)), dataLength);
    const to = clampToRange(Math.ceil(Math.max(visibleRange.from, visibleRange.to)), from + 1, dataLength);
    return {
        from,
        to,
    };
}
export function normalizeVisibleRangeForEngine(visibleRange, dataLength) {
    if (!visibleRange || dataLength <= 0) {
        return null;
    }
    if ("from" in visibleRange && "to" in visibleRange) {
        return normalizeEngineVisibleRange(visibleRange, dataLength);
    }
    const from = clampIndex(Math.floor(Math.min(visibleRange.startIndex, visibleRange.endIndex)), dataLength);
    const to = clampToRange(Math.ceil(Math.max(visibleRange.startIndex, visibleRange.endIndex)) + 1, from + 1, dataLength);
    return { from, to };
}
export function resolveForkVisibleRangeFromDateExtents(extents, data) {
    if (data.length === 0) {
        return null;
    }
    const startTime = asTimeValue(extents[0]);
    const endTime = asTimeValue(extents[1]);
    const lowerTime = Math.min(startTime, endTime);
    const upperTime = Math.max(startTime, endTime);
    const startIndex = findNearestDateIndex(data, lowerTime);
    const endIndex = findNearestDateIndex(data, upperTime);
    const fromIndex = Math.min(startIndex, endIndex);
    const toIndex = Math.max(startIndex, endIndex);
    const toExclusive = clampToRange(toIndex + 1, fromIndex + 1, data.length);
    return {
        from: fromIndex,
        to: toExclusive,
    };
}
