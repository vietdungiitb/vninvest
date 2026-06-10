export function areVisibleDomainsEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return left[0].getTime() === right[0].getTime() && left[1].getTime() === right[1].getTime();
}
export function isForkRangeTraceEnabled() {
    if (typeof window === "undefined") {
        return false;
    }
    return Boolean(window.__VN_DEBUG_RANGE__);
}
export function traceForkRange(event, payload) {
    if (!isForkRangeTraceEnabled()) {
        return;
    }
    console.debug(`[VNInvestCharts][RangeTrace] ${event}`, payload);
}
export function areEngineVisibleRangesEqual(left, right) {
    if (left === right) {
        return true;
    }
    if (!left || !right) {
        return false;
    }
    return left.from === right.from && left.to === right.to;
}
