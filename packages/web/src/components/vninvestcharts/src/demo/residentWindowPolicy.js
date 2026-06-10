export const DEFAULT_RESIDENT_WINDOW_POLICY = {
    maxBars: 12_000,
    trimToBars: 9_000,
    leftPaddingBars: 200,
};
function resolveDateMs(value) {
    return value instanceof Date ? value.valueOf() : value;
}
function resolveTrimStartIndex(bars, visibleDomain, targetTrimCount, leftPaddingBars) {
    if (targetTrimCount <= 0 || bars.length === 0) {
        return 0;
    }
    if (!visibleDomain) {
        return targetTrimCount;
    }
    const visibleStartMs = resolveDateMs(visibleDomain[0]);
    const firstVisibleIndex = bars.findIndex((bar) => bar.date.valueOf() >= visibleStartMs);
    if (firstVisibleIndex <= 0) {
        return targetTrimCount;
    }
    const maxTrimPreservingContext = Math.max(0, firstVisibleIndex - leftPaddingBars);
    return Math.min(targetTrimCount, maxTrimPreservingContext);
}
export function applyResidentWindowPolicy(bars, visibleDomain, policy = DEFAULT_RESIDENT_WINDOW_POLICY) {
    if (bars.length <= policy.maxBars) {
        return [...bars];
    }
    const targetTrimCount = bars.length - policy.trimToBars;
    if (targetTrimCount <= 0) {
        return [...bars];
    }
    const trimStartIndex = resolveTrimStartIndex(bars, visibleDomain, targetTrimCount, policy.leftPaddingBars);
    if (trimStartIndex <= 0) {
        return [...bars];
    }
    return bars.slice(trimStartIndex);
}
