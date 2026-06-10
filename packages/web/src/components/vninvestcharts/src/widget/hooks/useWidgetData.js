import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { isWidgetTestEnvironment, HISTORY_MIN_RESIDENT_BARS, resolveVisiblePanes, HISTORY_BACKFILL_PAGE_LIMIT } from "../utils/widgetHelpers.js";
import { enrichDataWithCanonicalStore } from "../../lib/core/calculators/enrichDataWithCanonicalStore.js";
import { createCanonicalSeriesStore } from "@vninvestcharts/vn-kline-engine-core";
import { applyCanaryFilter } from "../canaryBarFiltering.js";
import { resolveCanaryLevel, makeCanaryGateRecommendation, formatCanaryMetrics } from "../CanaryRolloutConfig.js";
import { validateRollbackSafety, formatRollbackEvent } from "../CanaryRollbackHelper.js";
import { resolveBackfillWorkerFlags } from "../BackfillWorkerFlags.js";
import { useExternalBarsNormalization } from "../history/useExternalBarsNormalization.js";
import { buildExternalDataValidationError } from "../history/externalBarsNormalization.js";
import { createHistoryChunkStore } from "../history/chunkStore.js";
import { createSingleWriterLane } from "../history/singleWriterLane.js";
import { toCacheKey, toCacheSemanticScope, LocalCacheMatrixFactoryImpl } from "../history/cache/index.js";
import { buildHistorySessionRequestKey, buildSourceRevisionKey } from "../history/sessionGuards.js";
import { resolveFetchWindow, resolveTimeframeMs } from "../history/historyDataUtils.js";
import { computeResidentTarget, computeTrimWindow, resolveResidentRetentionFactor } from "../history/historyWindowPlanner.js";
import { useWidgetDataBackfill } from "./useWidgetDataBackfill.js";
import { computeAdaptiveInflightControllerState } from "../history/inflightController.js";
import { areVisibleDomainsEqual, areEngineVisibleRangesEqual } from "../visibleRangeDiagnostics.js";
import { resolveOverflowHistoryQueueState } from "../visibleRangePolicies.js";
import { normalizeVisibleRangeForEngine, resolveForkVisibleRangeFromDateExtents, asTimeValue, normalizeForkVisibleRange } from "../visibleRangeBridge.js";
export function useWidgetData({ data, symbol, timeframe, canaryLevel, backfillWorkerFlags, localCacheRoot, onBarsChange, onHistorySyncBusyChange, onCanaryGateDecision, onCanaryRollbackEvent, enableWhale = false, whaleOrders, historyMinResidentBars, useForkRuntime = false, engineInstanceRef, forkEngineInstance, forkVisibleRangeRef, forkVisibleRange, setForkVisibleRange, incrementSnapshotRevision, emitCoordinateBridge, forkPaneSnapshotsRef, paneSnapshots, panes, adapter, onVisibleRangeChange, onVisibleDomainChange, controlledXExtents, sharedPlotDataRef, }) {
    const hasExternalData = Array.isArray(data);
    const resolvedBackfillWorkerFlags = useMemo(() => resolveBackfillWorkerFlags(backfillWorkerFlags), [backfillWorkerFlags]);
    const { result: normalizedExternalBars, pending: externalBarsNormalizationPending } = useExternalBarsNormalization(data ?? undefined, hasExternalData, resolvedBackfillWorkerFlags.enableExternalBarsNormalizationWorker);
    const historySessionMode = hasExternalData ? "controlled" : "uncontrolled";
    const [bars, setBars] = useState(normalizedExternalBars.bars);
    const [loading, setLoading] = useState(() => !hasExternalData || externalBarsNormalizationPending);
    const [error, setError] = useState(() => externalBarsNormalizationPending ? null : buildExternalDataValidationError(normalizedExternalBars));
    // Canary rollout filtering
    const resolvedCanaryLevel = useMemo(() => resolveCanaryLevel({ canaryLevel }), [canaryLevel]);
    const canaryFilteredBars = useMemo(() => applyCanaryFilter(bars, resolvedCanaryLevel), [bars, resolvedCanaryLevel]);
    const prevCanaryLevelRef = useRef(resolvedCanaryLevel);
    // Canary Gate Decision
    useEffect(() => {
        const previousLevel = prevCanaryLevelRef.current;
        if (previousLevel !== resolvedCanaryLevel && onCanaryGateDecision) {
            const metrics = {
                visibleBarsTotal: bars.length,
                visibleBarsAfterFilter: canaryFilteredBars.length,
                canaryPercentage: resolvedCanaryLevel,
                workersActive: {
                    externalBarsWorker: resolvedBackfillWorkerFlags.enableExternalBarsNormalizationWorker,
                    lodWorker: resolvedBackfillWorkerFlags.enableCandlestickLodWorker,
                },
                timestamp: Date.now(),
            };
            const { recommendation, reason } = makeCanaryGateRecommendation(metrics);
            onCanaryGateDecision({
                previousLevel,
                currentLevel: resolvedCanaryLevel,
                metrics: {
                    visibleBarsTotal: metrics.visibleBarsTotal,
                    visibleBarsAfterFilter: metrics.visibleBarsAfterFilter,
                    workersActive: metrics.workersActive,
                },
                recommendation,
                reason,
            });
            console.log(`[Canary Gate] Level: ${previousLevel}% → ${resolvedCanaryLevel}%`, formatCanaryMetrics(metrics), `Recommendation: ${recommendation} (${reason})`);
        }
    }, [resolvedCanaryLevel, bars.length, canaryFilteredBars.length, resolvedBackfillWorkerFlags, onCanaryGateDecision]);
    // Canary Rollback Detection
    const prevCanaryMetricsRef = useRef(null);
    useEffect(() => {
        const previousLevel = prevCanaryLevelRef.current;
        const isRollingBack = resolvedCanaryLevel < previousLevel;
        if (isRollingBack && onCanaryRollbackEvent) {
            const beforeMetrics = prevCanaryMetricsRef.current || {
                level: previousLevel,
                barCount: bars.length,
                workersActive: {
                    externalBarsWorker: resolvedBackfillWorkerFlags.enableExternalBarsNormalizationWorker,
                    lodWorker: resolvedBackfillWorkerFlags.enableCandlestickLodWorker,
                },
                timestamp: Date.now(),
            };
            const afterMetrics = {
                level: resolvedCanaryLevel,
                barCount: canaryFilteredBars.length,
                workersActive: {
                    externalBarsWorker: resolvedBackfillWorkerFlags.enableExternalBarsNormalizationWorker,
                    lodWorker: resolvedBackfillWorkerFlags.enableCandlestickLodWorker,
                },
                timestamp: Date.now(),
            };
            const validation = validateRollbackSafety(beforeMetrics, afterMetrics);
            const severity = validation.safe
                ? (previousLevel === 100 ? "INFO" : "HIGH")
                : "CRITICAL";
            const rollbackEvent = {
                previousLevel,
                newLevel: resolvedCanaryLevel,
                beforeMetrics,
                afterMetrics,
                validation,
                severity,
                timestamp: Date.now(),
            };
            onCanaryRollbackEvent(rollbackEvent);
            console.log(formatRollbackEvent(rollbackEvent), `before={bars:${beforeMetrics.barCount}}, after={bars:${afterMetrics.barCount}}`);
        }
        prevCanaryMetricsRef.current = {
            level: resolvedCanaryLevel,
            barCount: canaryFilteredBars.length,
            workersActive: {
                externalBarsWorker: resolvedBackfillWorkerFlags.enableExternalBarsNormalizationWorker,
                lodWorker: resolvedBackfillWorkerFlags.enableCandlestickLodWorker,
            },
            timestamp: Date.now(),
        };
        prevCanaryLevelRef.current = resolvedCanaryLevel;
    }, [resolvedCanaryLevel, canaryFilteredBars.length, resolvedBackfillWorkerFlags, onCanaryRollbackEvent]);
    // History Sync Refs & State
    const visibleDomainRef = useRef(null);
    const lastQueuedVisibleDomainRef = useRef(null);
    const lastQueuedOverflowHistoryKeyRef = useRef(null);
    const lastAppliedForkControlledExtentsKeyRef = useRef(null);
    const historyWindowSyncInFlightRef = useRef(false);
    const pendingVisibleDomainRef = useRef(null);
    const historyBackfillBeforeRef = useRef(null);
    const historyForwardAfterRef = useRef(null);
    const consecutiveEmptyBackfillRef = useRef(0);
    const EMPTY_BACKFILL_LOCK_THRESHOLD = 3;
    const pendingHistoryPatchRef = useRef(null);
    const activeHistoryRequestKeyRef = useRef("");
    const activeHistorySessionRevisionRef = useRef(0);
    const isTestEnv = isWidgetTestEnvironment();
    const historySessionRef = useRef({
        requestKey: "",
        mode: historySessionMode,
        revision: 0,
    });
    const historyChunkStoreRef = useRef(createHistoryChunkStore());
    const historyMergeLaneRef = useRef(createSingleWriterLane());
    const cacheMatrixRef = useRef(new LocalCacheMatrixFactoryImpl().create(localCacheRoot ?? "local-cache-root"));
    const liveEdgeMsRef = useRef(null);
    const prevVisibleSpanMsRef = useRef(null);
    const prevVisibleStartMsRef = useRef(null);
    const prevBarsRef = useRef([]);
    const prevEnrichedDataRef = useRef([]);
    const maxInflightRef = useRef(2);
    const debounceMsRef = useRef(120);
    const chunkBarsRef = useRef(isWidgetTestEnvironment() ? HISTORY_BACKFILL_PAGE_LIMIT : 3000);
    const retentionFactorRef = useRef(3.0);
    const overfetchRatioRef = useRef(0.0);
    const queueDepthRef = useRef(0);
    const lastFrameTimeRef = useRef(null);
    const frameTimesRef = useRef([]);
    const inflightControllerStateRef = useRef({
        highFrameTimeCount: 0,
        lowFrameTimeCount: 0,
        highOverfetchCount: 0,
    });
    const [forkCameraEnvelopeMode, setForkCameraEnvelopeMode] = useState("shared");
    const lastStableForkSpanRef = useRef(100);
    const pendingForkVisibleRangeRef = useRef(null);
    const pendingForkVisibleRangeRafRef = useRef(null);
    const onVisibleRangeChangeRef = useRef(onVisibleRangeChange);
    onVisibleRangeChangeRef.current = onVisibleRangeChange;
    const onVisibleDomainChangeRef = useRef(onVisibleDomainChange);
    onVisibleDomainChangeRef.current = onVisibleDomainChange;
    const activeRequestsRef = useRef(new Set());
    const abortControllersRef = useRef(new Map());
    const historySyncBusyRef = useRef(false);
    const emitHistorySyncBusy = useCallback((busy) => {
        if (historySyncBusyRef.current === busy) {
            return;
        }
        historySyncBusyRef.current = busy;
        onHistorySyncBusyChange?.(busy);
    }, [onHistorySyncBusyChange]);
    const syncHistoryBusyState = useCallback(() => {
        emitHistorySyncBusy(historyWindowSyncInFlightRef.current || activeRequestsRef.current.size > 0);
    }, [emitHistorySyncBusy]);
    const isHistorySessionRequestCurrent = useCallback((requestKey, sessionRevision, signal) => {
        if (signal?.aborted) {
            return false;
        }
        return activeHistoryRequestKeyRef.current === requestKey
            && activeHistorySessionRevisionRef.current === sessionRevision;
    }, []);
    const runHistoryMergeLane = useCallback((writer) => {
        return historyMergeLaneRef.current.run(writer);
    }, []);
    const resetHistorySessionControllerRefs = () => {
        visibleDomainRef.current = null;
        lastQueuedVisibleDomainRef.current = null;
        lastQueuedOverflowHistoryKeyRef.current = null;
        lastAppliedForkControlledExtentsKeyRef.current = null;
        historyWindowSyncInFlightRef.current = false;
        pendingVisibleDomainRef.current = null;
        pendingHistoryPatchRef.current = null;
        historyBackfillBeforeRef.current = null;
        historyForwardAfterRef.current = null;
        consecutiveEmptyBackfillRef.current = 0;
        liveEdgeMsRef.current = null;
        prevVisibleSpanMsRef.current = null;
        prevVisibleStartMsRef.current = null;
        for (const controller of abortControllersRef.current.values()) {
            controller.abort();
        }
        abortControllersRef.current.clear();
        activeRequestsRef.current.clear();
        queueDepthRef.current = 0;
    };
    // Controlled Mode synchronizer
    useEffect(() => {
        if (historySessionMode !== "controlled") {
            return;
        }
        pendingHistoryPatchRef.current = null;
        if (externalBarsNormalizationPending) {
            setLoading(true);
            setError(null);
            return;
        }
        setBars(normalizedExternalBars.bars);
        setError(buildExternalDataValidationError(normalizedExternalBars));
        setLoading(false);
    }, [historySessionMode, normalizedExternalBars, externalBarsNormalizationPending]);
    useEffect(() => {
        onBarsChange?.(bars);
    }, [bars, onBarsChange]);
    const activeSymbol = symbol ?? "BTCUSDT";
    const activeTimeframe = timeframe ?? "1h";
    const adapterLabel = useMemo(() => {
        const candidate = adapter.label;
        return typeof candidate === "string" && candidate.length > 0 ? candidate : "widget-adapter";
    }, [adapter]);
    const activeSourceSemantics = useMemo(() => adapter.getSourceSemantics?.() ?? null, [adapter]);
    const activeCacheSemanticScope = useMemo(() => (activeSourceSemantics ? toCacheSemanticScope(activeSourceSemantics) : undefined), [activeSourceSemantics]);
    const activeCacheKey = useMemo(() => {
        return toCacheKey({
            source: adapterLabel,
            symbol: activeSymbol,
            timeframe: activeTimeframe,
            adjustmentPolicy: "split-adjusted",
            schemaVersion: "v2",
        });
    }, [adapterLabel, activeSymbol, activeTimeframe]);
    const activeSourceRevisionKey = useMemo(() => buildSourceRevisionKey(adapterLabel, activeSourceSemantics), [adapterLabel, activeSourceSemantics]);
    const activeHistoryRequestKey = useMemo(() => buildHistorySessionRequestKey(activeSymbol, activeTimeframe, activeSourceRevisionKey), [activeSymbol, activeTimeframe, activeSourceRevisionKey]);
    // Reconcile session changes
    const historySession = historySessionRef.current;
    if (historySession.requestKey !== activeHistoryRequestKey || historySession.mode !== historySessionMode) {
        const nextSession = {
            requestKey: activeHistoryRequestKey,
            mode: historySessionMode,
            revision: historySession.revision + 1,
        };
        historySessionRef.current = nextSession;
        resetHistorySessionControllerRefs();
    }
    const currentHistorySessionRequestKey = historySessionRef.current.requestKey;
    const currentHistorySessionRevision = historySessionRef.current.revision;
    const isControlledHistorySession = historySessionRef.current.mode === "controlled";
    activeHistoryRequestKeyRef.current = currentHistorySessionRequestKey;
    activeHistorySessionRevisionRef.current = currentHistorySessionRevision;
    useEffect(() => {
        syncHistoryBusyState();
    }, [currentHistorySessionRequestKey, currentHistorySessionRevision, syncHistoryBusyState]);
    // Instantiate the backfill scheduler hook
    const backfill = useWidgetDataBackfill({
        adapter,
        activeSymbol,
        activeTimeframe,
        activeCacheKey,
        activeCacheSemanticScope: activeCacheSemanticScope,
        activeSourceSemantics,
        isControlledHistorySession,
        loading,
        useForkRuntime,
        engineInstanceRef,
        forkVisibleRangeRef,
        forkVisibleRange,
        setForkVisibleRange,
        incrementSnapshotRevision,
        emitCoordinateBridge,
        forkPaneSnapshotsRef,
        paneSnapshots,
        historyMinResidentBars,
        bars,
        setBars,
        historyBackfillBeforeRef,
        historyForwardAfterRef,
        consecutiveEmptyBackfillRef,
        pendingHistoryPatchRef,
        activeHistoryRequestKeyRef,
        activeHistorySessionRevisionRef,
        historyChunkStoreRef,
        historyMergeLaneRef,
        cacheMatrixRef,
        liveEdgeMsRef,
        prevVisibleSpanMsRef,
        prevVisibleStartMsRef,
        maxInflightRef,
        debounceMsRef,
        chunkBarsRef,
        retentionFactorRef,
        overfetchRatioRef,
        queueDepthRef,
        activeRequestsRef,
        abortControllersRef,
        historySyncBusyRef,
        historyWindowSyncInFlightRef,
        pendingVisibleDomainRef,
        visibleDomainRef,
        lastQueuedVisibleDomainRef,
        isHistorySessionRequestCurrent,
        runHistoryMergeLane,
        syncHistoryBusyState,
        isTestEnv,
        EMPTY_BACKFILL_LOCK_THRESHOLD,
    });
    // FPS Telemetry loop via requestAnimationFrame (TECH_SPEC.md#3.3)
    useEffect(() => {
        const isTest = isWidgetTestEnvironment();
        if (isTest) {
            return undefined;
        }
        let rafId;
        const trackFPS = () => {
            const now = performance.now();
            if (lastFrameTimeRef.current !== null) {
                const delta = now - lastFrameTimeRef.current;
                if (delta < 200) {
                    frameTimesRef.current.push(delta);
                    if (frameTimesRef.current.length > 300) {
                        frameTimesRef.current.shift();
                    }
                }
            }
            lastFrameTimeRef.current = now;
            rafId = requestAnimationFrame(trackFPS);
        };
        rafId = requestAnimationFrame(trackFPS);
        return () => cancelAnimationFrame(rafId);
    }, []);
    // 500ms rolling window Backpressure loop (TECH_SPEC.md#3.3)
    useEffect(() => {
        const isTest = isWidgetTestEnvironment();
        if (isTest) {
            return; // Disable loop in unit tests to protect timers
        }
        const intervalId = setInterval(() => {
            const samples = frameTimesRef.current;
            let p95 = 16.6; // Default 60 FPS
            if (samples.length >= 10) {
                const sorted = [...samples].sort((a, b) => a - b);
                p95 = sorted[Math.floor(sorted.length * 0.95)] ?? p95;
            }
            // Calculate visible bar count safely using forkVisibleRange
            const visibleBarCount = forkVisibleRange
                ? Math.max(1, Math.round(Math.abs(forkVisibleRange.to - forkVisibleRange.from)))
                : 100;
            const overfetchRatio = backfill.totalBarsFetchedRef.current / Math.max(1, visibleBarCount);
            overfetchRatioRef.current = overfetchRatio;
            const nextControllerState = computeAdaptiveInflightControllerState({
                maxInflight: maxInflightRef.current,
                debounceMs: debounceMsRef.current,
                chunkBars: chunkBarsRef.current,
                retentionFactor: retentionFactorRef.current,
                highFrameTimeCount: inflightControllerStateRef.current.highFrameTimeCount,
                lowFrameTimeCount: inflightControllerStateRef.current.lowFrameTimeCount,
                highOverfetchCount: inflightControllerStateRef.current.highOverfetchCount,
            }, {
                frameP95Ms: p95,
                queueDepth: queueDepthRef.current,
                overfetchRatio,
            }, resolveResidentRetentionFactor(visibleBarCount, activeSourceSemantics ?? undefined));
            maxInflightRef.current = nextControllerState.maxInflight;
            debounceMsRef.current = nextControllerState.debounceMs;
            chunkBarsRef.current = nextControllerState.chunkBars;
            retentionFactorRef.current = nextControllerState.retentionFactor;
            inflightControllerStateRef.current = {
                highFrameTimeCount: nextControllerState.highFrameTimeCount,
                lowFrameTimeCount: nextControllerState.lowFrameTimeCount,
                highOverfetchCount: nextControllerState.highOverfetchCount,
            };
        }, 500);
        return () => clearInterval(intervalId);
    }, [activeSourceSemantics, forkVisibleRange]);
    // Websocket subscription effect
    useEffect(() => {
        if (isControlledHistorySession) {
            return undefined;
        }
        const controller = new AbortController();
        let unsubscribe = null;
        let disposed = false;
        const sessionRevision = currentHistorySessionRevision;
        const requestKey = currentHistorySessionRequestKey;
        historyChunkStoreRef.current.replaceAll([]);
        setBars([]);
        setLoading(true);
        setError(null);
        const engine = engineInstanceRef.current;
        if (engine && "setCameraState" in engine) {
            engine.setCameraState({ followLatest: true, rightOffsetBars: 0 });
        }
        const { from, to } = resolveFetchWindow(activeTimeframe);
        const targetRange = { fromTs: from.getTime(), toTs: to.getTime() };
        const startInitialLoad = async () => {
            try {
                const cacheRead = isTestEnv
                    ? { bars: [], missingRanges: [targetRange] }
                    : await cacheMatrixRef.current.readRanges(activeCacheKey, [targetRange], activeCacheSemanticScope);
                if (disposed
                    || !isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                    return;
                }
                pendingHistoryPatchRef.current = null;
                await runHistoryMergeLane(() => {
                    if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                        return;
                    }
                    historyChunkStoreRef.current.replaceAll(cacheRead.bars);
                });
                for (const missing of cacheRead.missingRanges) {
                    const nextBars = await adapter.fetchBarsInRange(activeSymbol, activeTimeframe, new Date(missing.fromTs), new Date(missing.toTs)) ?? [];
                    if (disposed
                        || !isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                        return;
                    }
                    if (nextBars.length > 0) {
                        await runHistoryMergeLane(() => {
                            if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                return;
                            }
                            historyChunkStoreRef.current.append(nextBars);
                        });
                        if (!isTestEnv) {
                            await cacheMatrixRef.current.writePatch(activeCacheKey, nextBars, {
                                requestId: `init-req-${Date.now()}`,
                                sessionRevision,
                                reason: "warmup",
                                semanticScope: activeCacheSemanticScope,
                            });
                        }
                    }
                }
                const replaced = historyChunkStoreRef.current.toSnapshot();
                if (replaced.bars.length > 0) {
                    liveEdgeMsRef.current = replaced.bars[replaced.bars.length - 1].date.getTime();
                }
                setBars(replaced.bars);
                setLoading(false);
                if (useForkRuntime) {
                    const activeEngine = engineInstanceRef.current;
                    const activeRange = activeEngine?.getVisibleRange();
                    let initialVisibleDomain = null;
                    if (activeRange) {
                        const normalized = normalizeForkVisibleRange(activeRange, replaced.bars);
                        if (normalized) {
                            initialVisibleDomain = [normalized.startDate, normalized.endDate];
                        }
                    }
                    if (!initialVisibleDomain) {
                        const firstLoadedBar = replaced.bars[0];
                        const lastLoadedBar = replaced.bars[replaced.bars.length - 1];
                        if (firstLoadedBar && lastLoadedBar) {
                            initialVisibleDomain = [firstLoadedBar.date, lastLoadedBar.date];
                        }
                    }
                    if (initialVisibleDomain) {
                        backfill.requestVisibleHistoryWindowSync(initialVisibleDomain, { updateVisibleDomainRef: true });
                    }
                }
                const residentMaxBars = 120000;
                try {
                    unsubscribe = adapter.subscribeToBar(activeSymbol, activeTimeframe, (nextBar) => {
                        if (disposed || !isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                            return;
                        }
                        void runHistoryMergeLane(() => {
                            if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                return;
                            }
                            historyChunkStoreRef.current.append([nextBar]);
                            liveEdgeMsRef.current = nextBar.date.getTime();
                            if (visibleDomainRef.current) {
                                const liveTimeframeMs = resolveTimeframeMs(activeTimeframe);
                                const liveMinimumResidentSpanMs = liveTimeframeMs * (historyMinResidentBars ?? HISTORY_MIN_RESIDENT_BARS);
                                const liveVisibleSpanMs = Math.max(liveTimeframeMs, liveMinimumResidentSpanMs, visibleDomainRef.current[1].getTime() - visibleDomainRef.current[0].getTime());
                                const liveVisibleBarCount = Math.max(1, Math.round(liveVisibleSpanMs / Math.max(liveTimeframeMs, 1)));
                                let liveResidentTarget = computeResidentTarget({ startMs: visibleDomainRef.current[0].getTime(), endMs: visibleDomainRef.current[1].getTime() }, liveVisibleSpanMs, liveVisibleBarCount, activeSourceSemantics ?? undefined, retentionFactorRef.current);
                                if (liveEdgeMsRef.current !== null && visibleDomainRef.current[1].getTime() < liveEdgeMsRef.current) {
                                    liveResidentTarget = {
                                        ...liveResidentTarget,
                                        endMs: Math.max(liveResidentTarget.endMs, liveEdgeMsRef.current),
                                    };
                                }
                                historyChunkStoreRef.current.trimToWindow(computeTrimWindow(liveResidentTarget), residentMaxBars ?? 120000);
                            }
                            setBars(historyChunkStoreRef.current.toSnapshot().bars);
                        });
                        if (!isTestEnv) {
                            void cacheMatrixRef.current.writePatch(activeCacheKey, [nextBar], {
                                requestId: `live-tick-${Date.now()}`,
                                sessionRevision,
                                reason: "warmup",
                                semanticScope: activeCacheSemanticScope,
                            });
                        }
                    });
                }
                catch (subscribeError) {
                    if (!disposed
                        && isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                        setError(subscribeError instanceof Error ? subscribeError : new Error(String(subscribeError)));
                    }
                }
            }
            catch (err) {
                if (disposed
                    || !isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                    return;
                }
                setLoading(false);
                setError(err instanceof Error ? err : new Error(String(err)));
            }
        };
        void startInitialLoad();
        return () => {
            disposed = true;
            controller.abort();
            unsubscribe?.();
        };
    }, [
        adapter,
        activeSymbol,
        activeTimeframe,
        currentHistorySessionRequestKey,
        currentHistorySessionRevision,
        isControlledHistorySession,
        isHistorySessionRequestCurrent,
        runHistoryMergeLane,
    ]);
    // Enrichment and indicator mapping
    const visiblePanes = useMemo(() => resolveVisiblePanes(panes), [panes]);
    const canonicalStore = useMemo(() => {
        return createCanonicalSeriesStore();
    }, [symbol, timeframe]);
    const enrichedData = useMemo(() => {
        return enrichDataWithCanonicalStore(canaryFilteredBars, {
            series: visiblePanes.flatMap((pane) => pane.series),
            canonicalStore,
            sourceId: symbol ?? "unknown",
            timeframe: timeframe ?? "unknown",
        });
    }, [canaryFilteredBars, visiblePanes, canonicalStore, symbol, timeframe]);
    const plotData = useMemo(() => enrichedData.filter((datum) => Boolean(datum && datum.date)), [enrichedData]);
    const plotDataRef = useRef(plotData);
    plotDataRef.current = plotData;
    if (sharedPlotDataRef) {
        sharedPlotDataRef.current = plotData;
    }
    const plotDataLengthRef = useRef(plotData.length);
    plotDataLengthRef.current = plotData.length;
    // External/internal whale event mapping
    const whaleEvents = useMemo(() => {
        if (enableWhale && whaleOrders && whaleOrders.length > 0 && plotData.length > 0) {
            const mapped = [];
            for (const order of whaleOrders) {
                const ts = new Date(order.ts).valueOf();
                let nearestIdx = 0;
                let minDiff = Math.abs(plotData[0].date.valueOf() - ts);
                for (let i = 1; i < plotData.length; i++) {
                    const diff = Math.abs(plotData[i].date.valueOf() - ts);
                    if (diff < minDiff) {
                        minDiff = diff;
                        nearestIdx = i;
                    }
                }
                const matchedValue = order.matched_value > 0 ? order.matched_value : order.price * order.volume;
                if (!Number.isFinite(matchedValue) || matchedValue <= 0) {
                    continue;
                }
                mapped.push({
                    index: nearestIdx,
                    date: new Date(order.ts),
                    buyVol: order.side === "buy" ? matchedValue : 0,
                    sellVol: order.side === "sell" ? matchedValue : 0,
                    netDelta: order.side === "buy" ? matchedValue : -matchedValue,
                    dominance: order.side === "buy" ? "buy" : "sell",
                    sizeCategory: "large",
                });
            }
            return mapped;
        }
        return [];
    }, [enableWhale, whaleOrders, plotData]);
    // Keep snapshot delivery for chunk-store/camera contract, but run it BEFORE
    // setEnrichedData so the enriched payload remains the final engine state.
    useEffect(() => {
        const engine = engineInstanceRef.current;
        if (!engine || !useForkRuntime || !("setHistorySnapshot" in engine)) {
            prevBarsRef.current = bars;
            return;
        }
        const prevBars = prevBarsRef.current;
        const nextBars = bars;
        prevBarsRef.current = bars;
        const patch = pendingHistoryPatchRef.current;
        pendingHistoryPatchRef.current = null;
        let prependedCount = 0;
        if (patch?.prependedCount) {
            prependedCount = patch.prependedCount;
        }
        else if (prevBars.length > 0 && nextBars.length > prevBars.length) {
            const prevFirstTime = prevBars[0]?.date?.getTime();
            if (typeof prevFirstTime === "number") {
                const nextIndex = nextBars.findIndex((d) => d?.date?.getTime() === prevFirstTime);
                if (nextIndex > 0) {
                    prependedCount = nextIndex;
                }
            }
        }
        if (prependedCount > 0) {
            const cameraState = engine.getCameraState();
            if (!cameraState.followLatest) {
                const currentRange = forkVisibleRangeRef.current || forkVisibleRange;
                if (currentRange) {
                    const newRange = {
                        from: currentRange.from + prependedCount,
                        to: currentRange.to + prependedCount,
                    };
                    forkVisibleRangeRef.current = newRange;
                    engine.zoomToRange(newRange);
                    incrementSnapshotRevision();
                    if (newRange.from < 0 && historyBackfillBeforeRef.current === null) {
                        const normalized = normalizeForkVisibleRange(newRange, nextBars);
                        if (normalized) {
                            const nextDomain = [normalized.startDate, normalized.endDate];
                            backfill.requestVisibleHistoryWindowSync(nextDomain, { force: true });
                        }
                    }
                }
            }
        }
        const rawSnapshot = historyChunkStoreRef.current.toSnapshot();
        const snapshot = {
            ...rawSnapshot,
            bars: enrichedData,
        };
        let enginePatch = null;
        if (patch) {
            enginePatch = {
                ...patch,
                prependedCount: 0,
            };
        }
        else if (prependedCount > 0) {
            enginePatch = {
                kind: "prepend",
                snapshot,
                prependedCount: 0,
                appendedCount: 0,
                trimmedFromHead: 0,
                trimmedFromTail: 0,
            };
        }
        engine.setHistorySnapshot(snapshot, enginePatch);
        // forkEngineInstance in deps: re-runs when a new engine becomes ready so snapshot is never missed
    }, [bars, enrichedData, useForkRuntime, forkEngineInstance, incrementSnapshotRevision, backfill.requestVisibleHistoryWindowSync]);
    useEffect(() => {
        const engine = engineInstanceRef.current;
        if (!engine || !useForkRuntime) {
            prevEnrichedDataRef.current = enrichedData;
            return;
        }
        const nextData = enrichedData;
        prevEnrichedDataRef.current = enrichedData;
        // 2. Đồng bộ dữ liệu sang Engine
        // Cast: EnrichedDatum[] → readonly Record<string, unknown>[] (intentional type erasure for layer isolation)
        engine.setEnrichedData(nextData);
    }, [enrichedData, useForkRuntime, forkEngineInstance]);
    const handleForkVisibleRangeChange = useCallback((range) => {
        const previousVisibleRange = forkVisibleRangeRef.current;
        const previousVisibleDomain = visibleDomainRef.current;
        const dataLength = plotDataLengthRef.current;
        const backfillBusy = !isControlledHistorySession && (historyWindowSyncInFlightRef.current || activeRequestsRef.current.size > 0);
        // Auto-reset historyBackfillBeforeRef khi user pan sâu hơn boundary cũ.
        // Nếu lockedMs được set do rate-limit (không phải true boundary), user có
        // thể unlock bằng cách kéo chart sang trái vượt qua vị trí đó. Counter
        // cũng được reset để không accumulate sang vùng mới.
        const lockedMs = historyBackfillBeforeRef.current;
        if (lockedMs !== null && !isControlledHistorySession) {
            const normalizedRangeFrom = Math.min(range.from, range.to);
            if (normalizedRangeFrom < 0) {
                // Tính timestamp ứng với edge trái của viewport
                const currentBars = plotDataRef.current;
                const firstBarMs = currentBars.length > 0 ? currentBars[0]?.date?.getTime?.() ?? null : null;
                if (firstBarMs !== null) {
                    const timeframeMsEst = currentBars.length > 1
                        ? (currentBars[currentBars.length - 1]?.date?.getTime?.() ?? 0) - (currentBars[0]?.date?.getTime?.() ?? 0)
                            / (currentBars.length - 1)
                        : 3600000;
                    const viewportLeftMs = firstBarMs + normalizedRangeFrom * timeframeMsEst;
                    // Nếu viewport trái đang hiển thị vùng CŨ HƠN boundary lock → reset
                    if (viewportLeftMs < lockedMs) {
                        historyBackfillBeforeRef.current = null;
                        consecutiveEmptyBackfillRef.current = 0;
                    }
                }
            }
        }
        const leftBoundaryReached = !isControlledHistorySession && historyBackfillBeforeRef.current !== null;
        const rightBoundaryReached = !isControlledHistorySession && historyForwardAfterRef.current !== null;
        const stabilizedRange = range;
        const stabilizedMin = Math.min(stabilizedRange.from, stabilizedRange.to);
        const stabilizedMax = Math.max(stabilizedRange.from, stabilizedRange.to);
        const overflowQueueState = resolveOverflowHistoryQueueState(stabilizedRange, dataLength, leftBoundaryReached, rightBoundaryReached, lastQueuedOverflowHistoryKeyRef.current);
        if (stabilizedMin >= 0 && stabilizedMax <= dataLength) {
            lastStableForkSpanRef.current = Math.max(1, stabilizedMax - stabilizedMin);
        }
        const nextEnvelopeMode = engineInstanceRef.current?.getCameraState().envelopeMode ?? "shared";
        setForkCameraEnvelopeMode((currentMode) => (currentMode === nextEnvelopeMode ? currentMode : nextEnvelopeMode));
        pendingForkVisibleRangeRef.current = stabilizedRange;
        const commitPendingRange = () => {
            const pendingRange = pendingForkVisibleRangeRef.current;
            if (!pendingRange) {
                return;
            }
            pendingForkVisibleRangeRef.current = null;
            forkVisibleRangeRef.current = pendingRange;
            setForkVisibleRange((currentRange) => (areEngineVisibleRangesEqual(currentRange, pendingRange) ? currentRange : pendingRange));
            incrementSnapshotRevision();
            emitCoordinateBridge(forkPaneSnapshotsRef.current, pendingRange);
        };
        if (pendingForkVisibleRangeRafRef.current === null) {
            const schedule = () => {
                pendingForkVisibleRangeRafRef.current = null;
                commitPendingRange();
            };
            if (typeof requestAnimationFrame === "function") {
                pendingForkVisibleRangeRafRef.current = requestAnimationFrame(schedule);
                if (typeof queueMicrotask === "function") {
                    queueMicrotask(() => {
                        if (pendingForkVisibleRangeRef.current === null) {
                            return;
                        }
                        if (pendingForkVisibleRangeRafRef.current !== null && typeof cancelAnimationFrame === "function") {
                            cancelAnimationFrame(pendingForkVisibleRangeRafRef.current);
                        }
                        schedule();
                    });
                }
            }
            else {
                schedule();
            }
        }
        const normalizedRange = normalizeForkVisibleRange(stabilizedRange, plotDataRef.current);
        if (!normalizedRange) {
            return;
        }
        const visibleDomain = [normalizedRange.startDate, normalizedRange.endDate];
        visibleDomainRef.current = visibleDomain;
        const normalizedEngineRange = normalizeVisibleRangeForEngine(normalizedRange, plotDataRef.current.length);
        if (!normalizedEngineRange) {
            return;
        }
        const visibleRangeChanged = !areEngineVisibleRangesEqual(previousVisibleRange, stabilizedRange);
        const visibleDomainChanged = !areVisibleDomainsEqual(previousVisibleDomain, visibleDomain);
        if (visibleDomainChanged) {
            lastQueuedOverflowHistoryKeyRef.current = null;
        }
        if (visibleRangeChanged) {
            onVisibleRangeChangeRef.current?.(normalizedRange);
        }
        if (visibleDomainChanged) {
            onVisibleDomainChangeRef.current?.(visibleDomain);
        }
        if (visibleDomainChanged || overflowQueueState.shouldForceQueue) {
            const queuedVisibleHistorySync = backfill.requestVisibleHistoryWindowSync(visibleDomain, {
                force: overflowQueueState.shouldForceQueue,
            });
            if (queuedVisibleHistorySync && overflowQueueState.shouldForceQueue) {
                lastQueuedOverflowHistoryKeyRef.current = overflowQueueState.overflowKey;
            }
        }
    }, [emitCoordinateBridge, incrementSnapshotRevision, backfill.requestVisibleHistoryWindowSync, isControlledHistorySession, setForkVisibleRange, forkVisibleRange]);
    useEffect(() => {
        if (!useForkRuntime) {
            lastAppliedForkControlledExtentsKeyRef.current = null;
            return;
        }
        if (!controlledXExtents) {
            lastAppliedForkControlledExtentsKeyRef.current = null;
            return;
        }
        if (plotData.length === 0) {
            return;
        }
        const key = `${asTimeValue(controlledXExtents[0])}:${asTimeValue(controlledXExtents[1])}`;
        if (lastAppliedForkControlledExtentsKeyRef.current === key) {
            return;
        }
        const engine = engineInstanceRef.current;
        if (!engine) {
            return;
        }
        const nextRange = resolveForkVisibleRangeFromDateExtents(controlledXExtents, plotData);
        if (!nextRange) {
            return;
        }
        const isKeyChanged = lastAppliedForkControlledExtentsKeyRef.current !== key;
        lastAppliedForkControlledExtentsKeyRef.current = key;
        const normalizedRange = normalizeForkVisibleRange(nextRange, plotData);
        if (!normalizedRange) {
            return;
        }
        const visibleDomain = [normalizedRange.startDate, normalizedRange.endDate];
        backfill.requestVisibleHistoryWindowSync(visibleDomain, { force: true, updateVisibleDomainRef: true });
        if (!isKeyChanged && areEngineVisibleRangesEqual(forkVisibleRangeRef.current, nextRange)) {
            return;
        }
        pendingForkVisibleRangeRef.current = null;
        forkVisibleRangeRef.current = nextRange;
        setForkVisibleRange((currentRange) => (areEngineVisibleRangesEqual(currentRange, nextRange) ? currentRange : nextRange));
        incrementSnapshotRevision();
        engine.zoomToRange(nextRange);
    }, [controlledXExtents, plotData, backfill.requestVisibleHistoryWindowSync, useForkRuntime, incrementSnapshotRevision]);
    useEffect(() => {
        return () => {
            pendingForkVisibleRangeRef.current = null;
            if (pendingForkVisibleRangeRafRef.current !== null && typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(pendingForkVisibleRangeRafRef.current);
            }
            pendingForkVisibleRangeRafRef.current = null;
        };
    }, []);
    return {
        bars,
        setBars,
        loading,
        setLoading,
        error,
        setError,
        canaryFilteredBars,
        resolvedCanaryLevel,
        enrichedData,
        plotData,
        plotDataRef,
        plotDataLengthRef,
        whaleEvents,
        activeSymbol,
        activeTimeframe,
        activeCacheKey,
        activeCacheSemanticScope,
        activeSourceSemantics,
        activeSourceRevisionKey,
        activeHistoryRequestKey,
        isControlledHistorySession,
        requestVisibleHistoryWindowSync: backfill.requestVisibleHistoryWindowSync,
        reconcileVisibleHistoryWindow: backfill.reconcileVisibleHistoryWindow,
        totalBarsFetchedRef: backfill.totalBarsFetchedRef,
        consecutiveEmptyBackfillRef,
        historyBackfillBeforeRef,
        historyForwardAfterRef,
        pendingHistoryPatchRef,
        visibleDomainRef,
        pendingVisibleDomainRef,
        lastQueuedVisibleDomainRef,
        resetHistorySessionControllerRefs,
        liveEdgeMsRef,
        historySessionRef,
        forkCameraEnvelopeMode,
        setForkCameraEnvelopeMode,
        handleForkVisibleRangeChange,
    };
}
