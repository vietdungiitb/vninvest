export function resolveOverflowHistoryQueueState(range, dataLength, leftBoundaryReached, rightBoundaryReached, lastOverflowKey) {
    if (dataLength <= 0) {
        return {
            overflowKey: null,
            shouldForceQueue: false,
        };
    }
    const minRange = Math.min(range.from, range.to);
    const maxRange = Math.max(range.from, range.to);
    const normalizedDataLength = Math.max(0, Math.round(dataLength));
    const overflowKey = minRange < 0 && !leftBoundaryReached
        ? `left:${normalizedDataLength}:${Math.floor(minRange)}:${Math.floor(maxRange)}`
        : maxRange > normalizedDataLength && !rightBoundaryReached
            ? `right:${normalizedDataLength}:${Math.ceil(minRange)}:${Math.ceil(maxRange)}`
            : null;
    return {
        overflowKey,
        shouldForceQueue: overflowKey !== null && overflowKey !== lastOverflowKey,
    };
}
