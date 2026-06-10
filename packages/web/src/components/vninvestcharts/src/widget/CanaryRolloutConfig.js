/**
 * Canary rollout configuration and resolver for progressive feature rollout.
 * Supports props and URL parameters with prop precedence.
 *
 * @example
 * // Via props
 * <VNInvestCharts {...props} canaryLevel={10} />
 *
 * // Via URL params
 * // ?canaryLevel=10 or ?canaryLevel=30 or ?canaryLevel=100
 */
export const DEFAULT_CANARY_LEVEL = 100;
const VALID_CANARY_LEVELS = new Set([10, 30, 100]);
/**
 * Parse and validate canary level from value.
 * @param value Candidate value (number, string, or null)
 * @returns Valid CanaryLevel or DEFAULT_CANARY_LEVEL if invalid
 */
export function parseCanaryLevel(value) {
    if (typeof value === "number") {
        if (VALID_CANARY_LEVELS.has(value)) {
            return value;
        }
    }
    if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        if (!Number.isNaN(parsed) && VALID_CANARY_LEVELS.has(parsed)) {
            return parsed;
        }
    }
    return DEFAULT_CANARY_LEVEL;
}
/**
 * Resolve canary level from props and URL search parameters.
 * Props override URL params (props take precedence).
 *
 * @param props Canary config from component props
 * @param searchParams URL search parameters (e.g., from useLocation().search)
 * @returns Resolved canary level
 *
 * @example
 * // Props only
 * resolveCanaryLevel({ canaryLevel: 30 }) // => 30
 *
 * // URL params only
 * resolveCanaryLevel(undefined, new URLSearchParams("canaryLevel=10")) // => 10
 *
 * // Props override URL (props win)
 * resolveCanaryLevel(
 *   { canaryLevel: 30 },
 *   new URLSearchParams("canaryLevel=10")
 * ) // => 30
 */
export function resolveCanaryLevel(props, searchParams) {
    let level = DEFAULT_CANARY_LEVEL;
    // Apply URL params first
    if (searchParams) {
        const urlLevel = searchParams.get("canaryLevel");
        level = parseCanaryLevel(urlLevel);
    }
    // Props override URL params
    if (props?.canaryLevel !== undefined) {
        level = parseCanaryLevel(props.canaryLevel);
    }
    return level;
}
/**
 * Create a decision recommendation based on canary metrics.
 * Currently: simple heuristic (NO-GO if p95 > 50ms, otherwise GO).
 * In production, this would integrate with real SLO/alerting.
 *
 * @param metrics Current canary metrics
 * @returns GO or NO-GO recommendation with reason
 */
export function makeCanaryGateRecommendation(metrics) {
    const thresholds = {
        p95FrameTimeMs: 50, // Go/no-go gate at p95 frame time
        maxBarsExpected: 4000, // Worker should handle up to 4K bars
    };
    // Check frame time
    if (metrics.p95FrameTimeMs !== undefined &&
        metrics.p95FrameTimeMs > thresholds.p95FrameTimeMs) {
        return {
            recommendation: "NO-GO",
            reason: `Frame time p95=${metrics.p95FrameTimeMs}ms exceeds threshold ${thresholds.p95FrameTimeMs}ms`,
        };
    }
    // Check if workers are active and needed
    if (metrics.canaryPercentage >= 30 && !metrics.workersActive.lodWorker) {
        return {
            recommendation: "NO-GO",
            reason: "LOD worker disabled but canary level >= 30% (risk of dropped bars)",
        };
    }
    return {
        recommendation: "GO",
        reason: "Metrics within acceptable range",
    };
}
/**
 * Format canary metrics for console logging or telemetry.
 * @param metrics Metrics to format
 * @returns Human-readable string
 */
export function formatCanaryMetrics(metrics) {
    const { visibleBarsTotal, visibleBarsAfterFilter, canaryPercentage, workersActive, p95FrameTimeMs, requestCount, } = metrics;
    const parts = [
        `Canary ${canaryPercentage}%`,
        `[${visibleBarsAfterFilter}/${visibleBarsTotal} bars]`,
        `workers={externalBars:${workersActive.externalBarsWorker},lod:${workersActive.lodWorker}}`,
    ];
    if (p95FrameTimeMs !== undefined) {
        parts.push(`p95=${p95FrameTimeMs.toFixed(1)}ms`);
    }
    if (requestCount !== undefined) {
        parts.push(`requests=${requestCount}`);
    }
    return parts.join(" ");
}
