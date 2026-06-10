/**
 * historyWindowPlanner.ts
 *
 * Resident 3x window planner for VNInvestCharts history management.
 *
 * Computes the resident target window (3x visible span) and plans only the
 * missing segments that need to be fetched, preventing request storms when
 * data is already loaded.
 */
const RETENTION_FACTOR_MIN = 1.15;
const RETENTION_FACTOR_MAX = 3.0;
function clampRetentionFactor(factor) {
    return Math.min(RETENTION_FACTOR_MAX, Math.max(RETENTION_FACTOR_MIN, factor));
}
function resolveDensityRetentionFactor(visibleBarCount) {
    if (visibleBarCount > 30000) {
        return 1.2;
    }
    if (visibleBarCount > 10000) {
        return 1.4;
    }
    if (visibleBarCount > 2000) {
        return 2.0;
    }
    return 3.0;
}
function classifyGapReason(segmentFrom, segmentTo, sourceSemantics, calendar) {
    if (sourceSemantics?.coverageMode === "finite-snapshot") {
        return "boundary-exhausted";
    }
    if (calendar &&
        sourceSemantics?.sessionModel === "exchange-calendar" &&
        !calendar.hasAnyTradingTime(segmentFrom, segmentTo)) {
        return "market-closed";
    }
    return "not-fetched";
}
/**
 * Resolves the base resident retention factor from visible density and the
 * source-class matrix. Session-based sources keep a slightly wider buffer,
 * while window-hint and finite sources trim more aggressively.
 */
export function resolveResidentRetentionFactor(visibleBarCount = 0, sourceSemantics) {
    let factor = resolveDensityRetentionFactor(visibleBarCount);
    if (!sourceSemantics) {
        return factor;
    }
    if (sourceSemantics.coverageMode === "finite-snapshot") {
        return 1.5;
    }
    if (sourceSemantics.coverageMode === "anchor-before"
        || sourceSemantics.coverageMode === "anchor-after") {
        factor += 0.25;
    }
    if (sourceSemantics.coverageMode === "window-hint") {
        factor -= 0.25;
    }
    if (sourceSemantics.sessionModel === "exchange-calendar") {
        factor += 0.15;
    }
    return clampRetentionFactor(factor);
}
/**
 * Computes the resident target window as 3x the visible span:
 * [visibleStart - 1xSpan, visibleEnd + 1xSpan]
 *
 * Uses `minSpanMs` as the floor for the visible span (one bar width).
 * Ensures the resident window is always at least 3× the minimum span even
 * when the visible window is very narrow. The resident factor is resolved from
 * visible density, source-class semantics, and an optional runtime override
 * from backpressure logic.
 */
export function computeResidentTarget(visible, minSpanMs = 0, visibleBarCount = 0, sourceSemantics, retentionFactorOverride) {
    const rawSpan = visible.endMs - visible.startMs;
    const span = Math.max(rawSpan, minSpanMs);
    const baseFactor = resolveResidentRetentionFactor(visibleBarCount, sourceSemantics);
    const factor = clampRetentionFactor(retentionFactorOverride === undefined
        ? baseFactor
        : Math.min(retentionFactorOverride, baseFactor));
    const paddingMs = Math.round(((factor - 1) / 2) * span);
    return {
        startMs: visible.startMs - paddingMs,
        endMs: visible.endMs + paddingMs,
    };
}
/**
 * Computes which segments of the resident target are not covered by the
 * loaded window.
 *
 * Rules:
 * - If `loaded` covers the full `resident` range: returns empty array.
 * - If `loaded` starts after `resident.startMs`: returns a left-segment.
 * - If `loaded` ends before `resident.endMs`: returns a right-segment.
 * - Both can be returned simultaneously (initial empty state, large pan).
 * - When loaded is null/empty (no data yet): returns both sides.
 */
export function computeMissingSegments(resident, loaded, sourceSemantics, calendar) {
    function reasonFor(from, to) {
        return classifyGapReason(from, to, sourceSemantics, calendar);
    }
    if (!loaded) {
        // No data loaded at all: need both sides (full resident range)
        return [
            { side: "left", from: resident.startMs, to: resident.endMs, reason: reasonFor(resident.startMs, resident.endMs) },
        ];
    }
    const segments = [];
    if (loaded.startMs > resident.startMs) {
        // Left side is missing: from resident start to current loaded head
        segments.push({
            side: "left",
            from: resident.startMs,
            to: loaded.startMs,
            reason: reasonFor(resident.startMs, loaded.startMs),
        });
    }
    if (loaded.endMs < resident.endMs) {
        // Right side is missing: from current loaded tail to resident end
        segments.push({
            side: "right",
            from: loaded.endMs,
            to: resident.endMs,
            reason: reasonFor(loaded.endMs, resident.endMs),
        });
    }
    return segments;
}
/**
 * Orders fetchable missing segments so the nearest resident gap to the
 * viewport is scheduled first. Ties prefer the left edge for deterministic
 * execution when both sides are equally close.
 */
export function prioritizeMissingSegments(segments, visible) {
    return segments
        .map((segment) => ({
        ...segment,
        distance: segment.side === "left"
            ? Math.abs(visible.startMs - (segment.to ?? visible.startMs))
            : Math.abs((segment.from ?? visible.endMs) - visible.endMs),
    }))
        .sort((left, right) => {
        if (left.distance !== right.distance) {
            return left.distance - right.distance;
        }
        if (left.side === right.side) {
            return 0;
        }
        return left.side === "left" ? -1 : 1;
    });
}
/**
 * Computes a hysteresis-aware trim window.
 *
 * Returns a trim window slightly wider than the resident target to avoid
 * thrashing: bars are only evicted when they fall outside the trim window,
 * which is `hysteresisRatio × span` wider on each side than the resident
 * target.
 *
 * Default `hysteresisRatio = 0.5` means bars within 0.5× span outside the
 * resident target are retained. This prevents evicting bars that would be
 * needed again if the user pans back slightly.
 */
export function computeTrimWindow(resident, hysteresisRatio = 0.5) {
    const span = resident.endMs - resident.startMs;
    const hysteresisPadMs = Math.round(span * hysteresisRatio);
    return {
        startMs: resident.startMs - hysteresisPadMs,
        endMs: resident.endMs + hysteresisPadMs,
    };
}
