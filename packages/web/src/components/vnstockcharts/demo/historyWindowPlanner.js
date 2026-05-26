/**
 * OB-M01 — historyWindowPlanner
 * Pure utility functions for computing what history windows need to be fetched.
 * No React dependency, no side effects.
 */
/**
 * Expand a viewport window by the given prefetch ratios to compute the ideal
 * target window that should be loaded.
 */
export function computeTargetWindow(viewport, options) {
    const leftRatio = options?.leftPrefetchRatio ?? 2.0;
    const rightRatio = options?.rightPrefetchRatio ?? 0.5;
    const span = viewport.endMs - viewport.startMs;
    return {
        startMs: viewport.startMs - span * leftRatio,
        endMs: viewport.endMs + span * rightRatio,
    };
}
/**
 * Compute the min/max window of the provided data array.
 * Returns null when data is empty.
 */
export function computeLoadedWindow(data) {
    if (data.length === 0) {
        return null;
    }
    let minMs = Infinity;
    let maxMs = -Infinity;
    for (const item of data) {
        const ms = item.date instanceof Date
            ? item.date.valueOf()
            : typeof item.date === "number"
                ? item.date
                : 0;
        if (ms < minMs)
            minMs = ms;
        if (ms > maxMs)
            maxMs = ms;
    }
    return { startMs: minMs, endMs: maxMs };
}
/**
 * Compare target vs. loaded windows and identify which segments are missing.
 */
export function computeMissingSegments(target, loaded) {
    const leftMissing = loaded.startMs > target.startMs;
    const rightMissing = loaded.endMs < target.endMs;
    return {
        leftMissing,
        rightMissing,
        leftTargetMs: target.startMs,
        rightTargetMs: target.endMs,
    };
}
/**
 * Decide whether a new scheduler tick should enqueue a fetch job.
 * Returns true only when missing state transitions from absent/false → true
 * (avoids hammering the server when nothing has changed).
 */
export function shouldScheduleFetch(previous, next) {
    if (!next.leftMissing && !next.rightMissing) {
        return false;
    }
    if (previous === null) {
        return true;
    }
    // Trigger if either side transitions false → true
    const leftTrigger = !previous.leftMissing && next.leftMissing;
    const rightTrigger = !previous.rightMissing && next.rightMissing;
    return leftTrigger || rightTrigger;
}
