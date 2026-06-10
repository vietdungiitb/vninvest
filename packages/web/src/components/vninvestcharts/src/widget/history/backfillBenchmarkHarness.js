import { createHistoryChunkStore } from "./chunkStore.js";
import { computeAdaptiveInflightControllerState } from "./inflightController.js";
import { computeMissingSegments, computeResidentTarget, computeTrimWindow, prioritizeMissingSegments, resolveResidentRetentionFactor } from "./historyWindowPlanner.js";
import { filterBarsForFinalityMerge } from "./historyDataUtils.js";
import { isSegmentCoalescedByInflight, toInflightRequestKey } from "./requestCoalescing.js";
export const BACKFILL_BENCHMARK_PROFILE_BARS = [2000, 10000, 30000, 60000];
function createDefaultSemantics() {
    return {
        sourceId: "benchmark-source",
        sourceContractVersion: "benchmark-v1",
        instrumentClass: "equity",
        coverageMode: "exact-range",
        sessionModel: "continuous",
        timezone: "UTC",
        supportsExactRangeFetch: true,
        supportsBackwardAnchor: true,
        supportsForwardAnchor: false,
        supportsLiveBars: true,
        maxBarsPerRequest: 5000,
        finalityMode: "immutable",
        expectedGapReasons: ["not-fetched", "source-no-data", "boundary-exhausted"],
    };
}
function createSyntheticBars(count, startMs, stepMs) {
    const bars = [];
    let close = 120;
    for (let index = 0; index < count; index += 1) {
        const drift = Math.sin(index / 12) * 1.75 + Math.cos(index / 30) * 0.85;
        const open = close;
        close = Number((close + drift).toFixed(4));
        const high = Number((Math.max(open, close) + 1.2).toFixed(4));
        const low = Number((Math.min(open, close) - 1.2).toFixed(4));
        bars.push({
            date: new Date(startMs + index * stepMs),
            open,
            high,
            low,
            close,
            volume: 2_500 + (index % 2_400),
            index,
            dataIndex: index,
        });
    }
    return bars;
}
function computePercentile(values, percentile) {
    if (values.length === 0) {
        return 0;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((percentile / 100) * (sorted.length - 1))));
    return sorted[index] ?? 0;
}
function createInitialControllerState(baseRetentionFactor) {
    return {
        maxInflight: 2,
        debounceMs: 120,
        chunkBars: 3000,
        retentionFactor: baseRetentionFactor,
        highFrameTimeCount: 0,
        lowFrameTimeCount: 0,
        highOverfetchCount: 0,
    };
}
function createBenchmarkWindow(visibleBars, timeframeMs, sampledAt) {
    const endMs = sampledAt;
    const spanMs = Math.max(timeframeMs, visibleBars * timeframeMs);
    return { startMs: endMs - spanMs, endMs };
}
function createLoadedWindow(residentStartMs, residentEndMs) {
    const spanMs = residentEndMs - residentStartMs;
    const insetMs = Math.round(spanMs * 0.22);
    return {
        startMs: residentStartMs + insetMs,
        endMs: residentEndMs - insetMs,
    };
}
function barsForWindow(allBars, startMs, endMs) {
    return allBars.filter((bar) => bar.date.getTime() >= startMs && bar.date.getTime() <= endMs);
}
function createBenchmarkMetricsState() {
    return {
        totalFetchableSegments: 0,
        totalNeededBars: 0,
        totalFetchedBars: 0,
        totalRequestedBars: 0,
        totalRequests: 0,
        maxQueueDepth: 0,
    };
}
export function runBackfillBenchmarkSuite(options = {}) {
    const sampledAt = options.sampledAt ?? Date.UTC(2026, 5, 2, 9, 0, 0);
    const timeframeMs = options.timeframeMs ?? 60 * 60 * 1000;
    const iterationsPerProfile = options.iterationsPerProfile ?? 6;
    const profileBars = options.profileBars ?? BACKFILL_BENCHMARK_PROFILE_BARS;
    const sourceSemantics = options.sourceSemantics ?? createDefaultSemantics();
    const maxBars = options.maxBars ?? 120000;
    const label = options.label ?? "backfill-benchmark";
    const profiles = profileBars.map((visibleBars) => {
        const visible = createBenchmarkWindow(visibleBars, timeframeMs, sampledAt);
        const retentionFactor = resolveResidentRetentionFactor(visibleBars, sourceSemantics);
        const residentTarget = computeResidentTarget(visible, timeframeMs, visibleBars, sourceSemantics, retentionFactor);
        const sampleBarCount = Math.max(512, Math.min(5000, visibleBars));
        const sampleBars = createSyntheticBars(sampleBarCount, residentTarget.startMs - (sampleBarCount * timeframeMs), timeframeMs);
        const loadedWindow = createLoadedWindow(residentTarget.startMs, residentTarget.endMs);
        const loadedBars = barsForWindow(sampleBars, loadedWindow.startMs, loadedWindow.endMs);
        const timings = [];
        let finalControllerState = createInitialControllerState(retentionFactor);
        const metrics = createBenchmarkMetricsState();
        for (let iteration = 0; iteration < iterationsPerProfile; iteration += 1) {
            const store = createHistoryChunkStore();
            let snapshot = store.replaceAll(loadedBars);
            let controllerState = createInitialControllerState(retentionFactor);
            const startedAt = performance.now();
            const missingSegments = computeMissingSegments(residentTarget, loadedWindow, sourceSemantics, undefined);
            const fetchableSegments = missingSegments.filter((segment) => segment.reason === "not-fetched");
            const prioritizedSegments = prioritizeMissingSegments(fetchableSegments, visible);
            metrics.totalFetchableSegments += prioritizedSegments.length;
            metrics.maxQueueDepth = Math.max(metrics.maxQueueDepth, prioritizedSegments.length);
            const inflightKeys = new Set();
            for (const segment of prioritizedSegments) {
                if (inflightKeys.size >= controllerState.maxInflight) {
                    break;
                }
                if (isSegmentCoalescedByInflight(segment, inflightKeys)) {
                    continue;
                }
                const segmentFrom = segment.from ?? residentTarget.startMs;
                const segmentTo = segment.to ?? residentTarget.endMs;
                const missingBarCount = Math.max(1, Math.ceil((segmentTo - segmentFrom) / timeframeMs));
                const pages = Math.max(1, Math.ceil(missingBarCount / controllerState.chunkBars));
                metrics.totalNeededBars += missingBarCount;
                for (let page = 0; page < pages; page += 1) {
                    const fetchSize = Math.min(controllerState.chunkBars, missingBarCount - (page * controllerState.chunkBars));
                    const pageStartMs = segment.side === "left"
                        ? segmentTo - ((page + 1) * controllerState.chunkBars * timeframeMs)
                        : segmentFrom + (page * controllerState.chunkBars * timeframeMs);
                    const pageBars = createSyntheticBars(fetchSize, pageStartMs, timeframeMs);
                    const mergeBars = filterBarsForFinalityMerge(pageBars, snapshot.bars, {
                        finalityMode: sourceSemantics.finalityMode,
                        nowMs: sampledAt,
                        correctionLookbackMs: sourceSemantics.correctionLookbackMs,
                    });
                    if (segment.side === "left") {
                        store.prepend(mergeBars);
                    }
                    else {
                        store.append(mergeBars);
                    }
                    const trimPatch = store.trimToWindow(computeTrimWindow(residentTarget), maxBars, segment.side !== "left");
                    snapshot = trimPatch?.snapshot ?? store.toSnapshot();
                    metrics.totalRequestedBars += fetchSize;
                    metrics.totalFetchedBars += fetchSize;
                    metrics.totalRequests += 1;
                    inflightKeys.add(toInflightRequestKey(segment));
                }
            }
            const elapsedMs = performance.now() - startedAt;
            timings.push(elapsedMs);
            controllerState = computeAdaptiveInflightControllerState(controllerState, {
                frameP95Ms: elapsedMs,
                queueDepth: prioritizedSegments.length,
                overfetchRatio: metrics.totalNeededBars > 0 ? metrics.totalFetchedBars / metrics.totalNeededBars : 0,
            }, retentionFactor);
            finalControllerState = controllerState;
        }
        return {
            visibleBars,
            iterations: iterationsPerProfile,
            avgDurationMs: timings.reduce((sum, duration) => sum + duration, 0) / Math.max(timings.length, 1),
            p50Ms: computePercentile(timings, 50),
            p95Ms: computePercentile(timings, 95),
            maxDurationMs: computePercentile(timings, 100),
            queueDepth: metrics.maxQueueDepth,
            requestCount: metrics.totalRequests,
            fetchedBarCount: metrics.totalFetchedBars,
            neededBarCount: metrics.totalNeededBars,
            overfetchRatio: metrics.totalNeededBars > 0 ? metrics.totalFetchedBars / metrics.totalNeededBars : 0,
            requestAmplificationRatio: metrics.totalNeededBars > 0 ? metrics.totalRequestedBars / metrics.totalNeededBars : 0,
            maxInflight: finalControllerState.maxInflight,
            chunkBars: finalControllerState.chunkBars,
            retentionFactor: finalControllerState.retentionFactor,
        };
    });
    return {
        label,
        sampledAt,
        timeframeMs,
        sourceSemantics,
        profiles,
    };
}
