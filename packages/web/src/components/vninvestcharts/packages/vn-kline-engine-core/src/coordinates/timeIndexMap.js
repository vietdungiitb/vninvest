function resolveInterpolatedIndexByTime(timestamp, timestamps) {
    if (timestamps.length === 0 || !Number.isFinite(timestamp)) {
        return null;
    }
    if (timestamps.length === 1) {
        return 0;
    }
    const firstTime = timestamps[0];
    const lastTime = timestamps[timestamps.length - 1];
    if (timestamp <= firstTime) {
        const secondTime = timestamps[1];
        if (!Number.isFinite(secondTime) || secondTime === firstTime) {
            return 0;
        }
        return (timestamp - firstTime) / (secondTime - firstTime);
    }
    if (timestamp >= lastTime) {
        const penultimateTime = timestamps[timestamps.length - 2];
        if (!Number.isFinite(penultimateTime) || lastTime === penultimateTime) {
            return timestamps.length - 1;
        }
        return (timestamps.length - 1) + ((timestamp - lastTime) / (lastTime - penultimateTime));
    }
    let low = 0;
    let high = timestamps.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const midTime = timestamps[mid];
        if (midTime === timestamp) {
            return mid;
        }
        if (midTime < timestamp) {
            low = mid + 1;
        }
        else {
            high = mid - 1;
        }
    }
    const rightIndex = Math.min(timestamps.length - 1, Math.max(1, low));
    const leftIndex = rightIndex - 1;
    const leftTime = timestamps[leftIndex];
    const rightTime = timestamps[rightIndex];
    if (rightTime <= leftTime) {
        return leftIndex;
    }
    const ratio = (timestamp - leftTime) / (rightTime - leftTime);
    return leftIndex + ratio;
}
function resolveInterpolatedTimeByIndex(index, timestamps) {
    if (timestamps.length === 0 || !Number.isFinite(index)) {
        return null;
    }
    if (timestamps.length === 1) {
        return timestamps[0];
    }
    if (index <= 0) {
        const firstTime = timestamps[0];
        const secondTime = timestamps[1];
        if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) {
            return null;
        }
        return firstTime + index * (secondTime - firstTime);
    }
    if (index >= timestamps.length - 1) {
        const lastTime = timestamps[timestamps.length - 1];
        const penultimateTime = timestamps[timestamps.length - 2];
        if (!Number.isFinite(lastTime) || !Number.isFinite(penultimateTime)) {
            return null;
        }
        return lastTime + (index - (timestamps.length - 1)) * (lastTime - penultimateTime);
    }
    const leftIndex = Math.floor(index);
    const rightIndex = Math.ceil(index);
    const leftTime = timestamps[leftIndex];
    const rightTime = timestamps[rightIndex];
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) {
        return null;
    }
    if (leftIndex === rightIndex || rightTime <= leftTime) {
        return leftTime;
    }
    const ratio = index - leftIndex;
    return leftTime + ratio * (rightTime - leftTime);
}
export function createTimeIndexMap(data, resolveTimestamp) {
    const timestamps = data.map((item) => resolveTimestamp(item));
    return {
        resolveIndexByTime: (timestamp) => resolveInterpolatedIndexByTime(timestamp, timestamps),
        resolveTimeByIndex: (index) => resolveInterpolatedTimeByIndex(index, timestamps),
    };
}
export function createDateTimeIndexMap(data) {
    return createTimeIndexMap(data, (item) => item.date.getTime());
}
