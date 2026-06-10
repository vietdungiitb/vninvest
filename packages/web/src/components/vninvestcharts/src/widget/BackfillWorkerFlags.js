/**
 * BU-40-01: Feature flags for backfill worker lanes.
 * Toggle external bars normalization worker and candlestick LOD downsample worker.
 */
export const DEFAULT_BACKFILL_WORKER_FLAGS = {
    enableExternalBarsNormalizationWorker: true,
    enableCandlestickLodWorker: true,
};
export function resolveBackfillWorkerFlags(props, searchParams) {
    const flags = { ...DEFAULT_BACKFILL_WORKER_FLAGS };
    // Apply URL params first
    if (typeof window !== "undefined" && searchParams === undefined) {
        searchParams = new URLSearchParams(window.location.search);
    }
    if (searchParams) {
        const externalWorkerParam = searchParams.get("disableExternalBarsWorker");
        if (externalWorkerParam === "1") {
            flags.enableExternalBarsNormalizationWorker = false;
        }
        const lodWorkerParam = searchParams.get("disableLodWorker");
        if (lodWorkerParam === "1") {
            flags.enableCandlestickLodWorker = false;
        }
    }
    // Props override URL params
    if (props?.enableExternalBarsNormalizationWorker !== undefined) {
        flags.enableExternalBarsNormalizationWorker = props.enableExternalBarsNormalizationWorker;
    }
    if (props?.enableCandlestickLodWorker !== undefined) {
        flags.enableCandlestickLodWorker = props.enableCandlestickLodWorker;
    }
    return flags;
}
