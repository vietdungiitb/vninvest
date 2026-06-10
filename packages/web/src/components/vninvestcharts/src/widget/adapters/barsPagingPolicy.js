/**
 * WP-02: Bars paging policy — moved from src/demo/dataSources/
 * Cursor-paged /bars/ endpoint response normalization.
 */
function asFiniteNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function resolveOldestBarTimestamp(bars) {
    if (bars.length === 0) {
        return null;
    }
    let oldest = Number.POSITIVE_INFINITY;
    for (const bar of bars) {
        const ts = bar.date instanceof Date ? bar.date.valueOf() : new Date(bar.date).valueOf();
        if (Number.isFinite(ts) && ts < oldest) {
            oldest = ts;
        }
    }
    return Number.isFinite(oldest) ? oldest : null;
}
export function normalizeBarsPagingMeta(payload, bars) {
    const explicitHasMoreBefore = payload.has_more_before;
    const explicitHasMoreAfter = payload.has_more_after;
    const explicitNextBefore = asFiniteNumber(payload.next_before);
    const snapshotId = typeof payload.snapshot_id === "string" ? payload.snapshot_id : null;
    const oldestBarTs = resolveOldestBarTimestamp(bars);
    const nextBefore = explicitNextBefore ?? oldestBarTs;
    const hasMoreBefore = typeof explicitHasMoreBefore === "boolean"
        ? explicitHasMoreBefore
        : nextBefore !== null;
    const hasMoreAfter = typeof explicitHasMoreAfter === "boolean"
        ? explicitHasMoreAfter
        : false;
    return {
        hasMoreBefore,
        hasMoreAfter,
        nextBefore: hasMoreBefore ? nextBefore : null,
        snapshotId,
    };
}
export function buildBackwardPageRequest(meta, fallbackBefore, limit) {
    if (!meta.hasMoreBefore) {
        return null;
    }
    const before = meta.nextBefore ?? fallbackBefore;
    if (!Number.isFinite(before)) {
        return null;
    }
    return {
        before,
        limit,
        snapshotId: meta.snapshotId ?? undefined,
    };
}
