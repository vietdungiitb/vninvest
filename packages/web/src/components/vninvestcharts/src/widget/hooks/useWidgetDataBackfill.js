import { useCallback, useRef } from "react";
import { getCalendar } from "../../lib/calendars/index.js";
import { computeLoadedHistoryWindow, filterBarsForFinalityMerge, resolveTimeframeMs, } from "../history/historyDataUtils.js";
import { computeResidentTarget, computeMissingSegments, computeTrimWindow, prioritizeMissingSegments } from "../history/historyWindowPlanner.js";
import { coalesceAndAdjustSegment, toInflightRequestKey } from "../history/requestCoalescing.js";
import { traceForkRange, areVisibleDomainsEqual } from "../visibleRangeDiagnostics.js";
export function useWidgetDataBackfill({ adapter, activeSymbol, activeTimeframe, activeCacheKey, activeCacheSemanticScope, activeSourceSemantics, isControlledHistorySession, loading, useForkRuntime = false, engineInstanceRef, forkVisibleRangeRef, forkVisibleRange, setForkVisibleRange, incrementSnapshotRevision, emitCoordinateBridge, forkPaneSnapshotsRef, paneSnapshots, historyMinResidentBars, bars, setBars, historyBackfillBeforeRef, historyForwardAfterRef, consecutiveEmptyBackfillRef, pendingHistoryPatchRef, activeHistoryRequestKeyRef, activeHistorySessionRevisionRef, historyChunkStoreRef, historyMergeLaneRef, cacheMatrixRef, liveEdgeMsRef, prevVisibleSpanMsRef, prevVisibleStartMsRef, maxInflightRef, debounceMsRef, chunkBarsRef, retentionFactorRef, overfetchRatioRef, queueDepthRef, activeRequestsRef, abortControllersRef, historySyncBusyRef, historyWindowSyncInFlightRef, pendingVisibleDomainRef, visibleDomainRef, lastQueuedVisibleDomainRef, isHistorySessionRequestCurrent, runHistoryMergeLane, syncHistoryBusyState, isTestEnv, EMPTY_BACKFILL_LOCK_THRESHOLD, }) {
    const reconcileVisibleHistoryWindow = useCallback(async (visibleDomain) => {
        const workingBars = historyChunkStoreRef.current.toSnapshot().bars;
        if (isControlledHistorySession || (loading && workingBars.length === 0)) {
            return;
        }
        const residentMaxBars = 120000;
        const requestKey = activeHistoryRequestKeyRef.current;
        const sessionRevision = activeHistorySessionRevisionRef.current;
        const timeframeMs = resolveTimeframeMs(activeTimeframe);
        let adjustedVisibleStartMs = visibleDomain[0].getTime();
        let adjustedVisibleEndMs = visibleDomain[1].getTime();
        const currentForkRange = forkVisibleRangeRef.current || forkVisibleRange;
        if (useForkRuntime && currentForkRange && workingBars.length > 0) {
            const minRange = Math.min(currentForkRange.from, currentForkRange.to);
            const maxRange = Math.max(currentForkRange.from, currentForkRange.to);
            if (minRange < 0) {
                adjustedVisibleStartMs = workingBars[0].date.getTime() + minRange * timeframeMs;
            }
            if (maxRange > workingBars.length) {
                const rawEndMs = workingBars[0].date.getTime() + maxRange * timeframeMs;
                const liveEdgeCap = liveEdgeMsRef.current ??
                    workingBars[workingBars.length - 1].date.getTime();
                adjustedVisibleEndMs = Math.min(rawEndMs, liveEdgeCap);
            }
        }
        const HISTORY_MIN_RESIDENT_BARS = 240;
        const minimumResidentSpanMs = timeframeMs * (historyMinResidentBars ?? HISTORY_MIN_RESIDENT_BARS);
        const visibleSpanMs = Math.max(timeframeMs, minimumResidentSpanMs, adjustedVisibleEndMs - adjustedVisibleStartMs);
        const visibleBarCount = Math.max(1, Math.round(visibleSpanMs / timeframeMs));
        const currentVisibleSpanMs = adjustedVisibleEndMs - adjustedVisibleStartMs;
        const isZoomIn = prevVisibleSpanMsRef.current !== null && currentVisibleSpanMs < prevVisibleSpanMsRef.current;
        prevVisibleSpanMsRef.current = currentVisibleSpanMs;
        const visibleStartMs = visibleDomain[0].getTime();
        const isMovingLeft = prevVisibleStartMsRef.current !== null && visibleStartMs < prevVisibleStartMsRef.current;
        prevVisibleStartMsRef.current = visibleStartMs;
        const isPast = liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current - 2 * timeframeMs;
        let targetWindow = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, activeSourceSemantics ?? undefined, retentionFactorRef.current);
        if (isZoomIn && isPast && liveEdgeMsRef.current !== null) {
            targetWindow = {
                ...targetWindow,
                endMs: Math.max(targetWindow.endMs, liveEdgeMsRef.current),
            };
        }
        if (workingBars.length === 0) {
            return;
        }
        const loadedWindow = computeLoadedHistoryWindow(workingBars);
        if (!loadedWindow) {
            return;
        }
        const sourceSemantics = activeSourceSemantics ?? undefined;
        const calendar = getCalendar(sourceSemantics?.sessionCalendarId);
        const rawMissingSegments = computeMissingSegments(targetWindow, loadedWindow, sourceSemantics, calendar ?? undefined);
        const finalityMergeOpts = sourceSemantics
            ? {
                finalityMode: sourceSemantics.finalityMode,
                nowMs: Date.now(),
                provisionalWindowMs: timeframeMs,
                correctionLookbackMs: sourceSemantics.correctionLookbackMs,
            }
            : null;
        const fetchableMissingSegments = rawMissingSegments.filter((segment) => segment.reason === "not-fetched");
        if (fetchableMissingSegments.length === 0) {
            let resolvedResidentTarget = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, sourceSemantics, retentionFactorRef.current);
            if (liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current) {
                resolvedResidentTarget = {
                    ...resolvedResidentTarget,
                    endMs: Math.max(resolvedResidentTarget.endMs, liveEdgeMsRef.current),
                };
            }
            const trimPatch = historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget), residentMaxBars ?? 120000, !isMovingLeft, isMovingLeft);
            if (trimPatch !== null) {
                setBars(historyChunkStoreRef.current.toSnapshot().bars);
            }
            return;
        }
        const priorityQueue = prioritizeMissingSegments(fetchableMissingSegments, {
            startMs: adjustedVisibleStartMs,
            endMs: adjustedVisibleEndMs,
        });
        queueDepthRef.current = priorityQueue.length;
        const promises = [];
        for (const rawSegment of priorityQueue) {
            if (activeRequestsRef.current.size >= maxInflightRef.current) {
                break;
            }
            const segment = coalesceAndAdjustSegment(rawSegment, abortControllersRef.current.keys());
            if (!segment) {
                continue;
            }
            const controller = new AbortController();
            const controllerKey = toInflightRequestKey(segment);
            abortControllersRef.current.set(controllerKey, controller);
            let requestPromise = Promise.resolve();
            if (segment.side === "left") {
                const beforeTimestamp = segment.to;
                if (beforeTimestamp && historyBackfillBeforeRef.current !== beforeTimestamp) {
                    requestPromise = (async () => {
                        try {
                            const targetRange = { fromTs: segment.from, toTs: beforeTimestamp };
                            const cacheRead = isTestEnv
                                ? { bars: [], missingRanges: [targetRange] }
                                : await cacheMatrixRef.current.readRanges(activeCacheKey, [targetRange], activeCacheSemanticScope);
                            if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                return;
                            }
                            if (cacheRead.bars.length > 0) {
                                await runHistoryMergeLane(() => {
                                    if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                        return;
                                    }
                                    historyChunkStoreRef.current.prepend(cacheRead.bars);
                                    let resolvedResidentTarget = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, sourceSemantics, retentionFactorRef.current);
                                    if (liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current) {
                                        resolvedResidentTarget = {
                                            ...resolvedResidentTarget,
                                            endMs: Math.max(resolvedResidentTarget.endMs, liveEdgeMsRef.current),
                                        };
                                    }
                                    historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget), residentMaxBars ?? 120000, false, true);
                                    setBars(historyChunkStoreRef.current.toSnapshot().bars);
                                });
                            }
                            if (cacheRead.missingRanges.length > 0) {
                                for (const missing of cacheRead.missingRanges) {
                                    let olderBars = [];
                                    try {
                                        olderBars = await adapter.fetchBarsBefore(activeSymbol, activeTimeframe, new Date(missing.toTs), chunkBarsRef.current) ?? [];
                                    }
                                    catch (fetchError) {
                                        if (fetchError?.name === "AbortError" || controller.signal.aborted) {
                                            return;
                                        }
                                        console.error("Failed to fetch older bars:", fetchError);
                                        break;
                                    }
                                    if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                        return;
                                    }
                                    const backwardCoverage = adapter.getLastBackfillCoverage?.() ?? null;
                                    const backwardBoundaryStopTs = backwardCoverage?.reduce((currentValue, fragment) => {
                                        if (fragment.status !== "unresolved" || fragment.reason !== "boundary-exhausted") {
                                            return currentValue;
                                        }
                                        return currentValue === null ? fragment.toTs : Math.min(currentValue, fragment.toTs);
                                    }, null) ?? null;
                                    const boundaryExhaustedByCoverage = backwardCoverage !== null && backwardCoverage.some((fragment) => (fragment.status === "unresolved"
                                        && fragment.reason === "boundary-exhausted"
                                        && fragment.toTs <= beforeTimestamp));
                                    const hasOlderBars = olderBars.some((bar) => bar.date.getTime() < missing.toTs);
                                    if (!hasOlderBars) {
                                        consecutiveEmptyBackfillRef.current += 1;
                                        const shouldLock = consecutiveEmptyBackfillRef.current >= EMPTY_BACKFILL_LOCK_THRESHOLD
                                            && (backwardCoverage === null || boundaryExhaustedByCoverage);
                                        if (shouldLock) {
                                            historyBackfillBeforeRef.current = backwardBoundaryStopTs ?? beforeTimestamp;
                                        }
                                        traceForkRange(shouldLock ? "left-boundary-exhausted" : "left-boundary-open", {
                                            beforeTimestamp,
                                            missingRange: missing,
                                            olderBarsLength: olderBars.length,
                                            backwardCoverage,
                                            backwardBoundaryStopTs,
                                            consecutiveEmptyCount: consecutiveEmptyBackfillRef.current,
                                        });
                                    }
                                    else {
                                        await runHistoryMergeLane(() => {
                                            if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                                return;
                                            }
                                            totalBarsFetchedRef.current += olderBars.length;
                                            const barsToMerge = finalityMergeOpts
                                                ? filterBarsForFinalityMerge(olderBars, historyChunkStoreRef.current.toSnapshot().bars, finalityMergeOpts)
                                                : olderBars;
                                            const prependPatch = historyChunkStoreRef.current.prepend(barsToMerge);
                                            console.log('[VNInvestCharts][Debug] Remote prepend barsToMerge:', barsToMerge.length, 'prepended:', prependPatch.prependedCount, 'total in store:', historyChunkStoreRef.current.toSnapshot().bars.length);
                                            let resolvedResidentTarget = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, sourceSemantics, retentionFactorRef.current);
                                            if (liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current) {
                                                resolvedResidentTarget = {
                                                    ...resolvedResidentTarget,
                                                    endMs: Math.max(resolvedResidentTarget.endMs, liveEdgeMsRef.current),
                                                };
                                            }
                                            historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget), residentMaxBars ?? 120000, false, true);
                                            pendingHistoryPatchRef.current = {
                                                kind: "prepend",
                                                snapshot: historyChunkStoreRef.current.toSnapshot(),
                                                prependedCount: prependPatch.prependedCount,
                                                appendedCount: 0,
                                                trimmedFromHead: prependPatch.trimmedFromHead,
                                                trimmedFromTail: prependPatch.trimmedFromTail,
                                            };
                                            setBars(historyChunkStoreRef.current.toSnapshot().bars);
                                        });
                                        consecutiveEmptyBackfillRef.current = 0;
                                        historyBackfillBeforeRef.current = boundaryExhaustedByCoverage
                                            ? (backwardBoundaryStopTs ?? olderBars[0]?.date.getTime() ?? null)
                                            : null;
                                        traceForkRange(boundaryExhaustedByCoverage ? "left-boundary-exhausted" : "left-boundary-open", {
                                            beforeTimestamp,
                                            missingRange: missing,
                                            olderBarsLength: olderBars.length,
                                            backwardCoverage,
                                            backwardBoundaryStopTs,
                                        });
                                        try {
                                            if (!isTestEnv) {
                                                await cacheMatrixRef.current.writePatch(activeCacheKey, olderBars, {
                                                    requestId: `fill-before-${Date.now()}`,
                                                    sessionRevision,
                                                    reason: "remote-fill",
                                                    semanticScope: activeCacheSemanticScope,
                                                });
                                            }
                                        }
                                        catch (cacheError) {
                                            console.error("Failed to write backfill bars to cache:", cacheError);
                                        }
                                    }
                                }
                            }
                        }
                        finally {
                            abortControllersRef.current.delete(controllerKey);
                            activeRequestsRef.current.delete(requestPromise);
                            syncHistoryBusyState();
                            if (!controller.signal.aborted &&
                                activeHistoryRequestKeyRef.current === requestKey &&
                                activeHistorySessionRevisionRef.current === sessionRevision) {
                                const latestDomain = visibleDomainRef.current ?? visibleDomain;
                                void reconcileVisibleHistoryWindow(latestDomain);
                            }
                        }
                    })();
                    activeRequestsRef.current.add(requestPromise);
                    syncHistoryBusyState();
                    promises.push(requestPromise);
                }
            }
            else {
                const afterTimestamp = segment.from;
                if (afterTimestamp && historyForwardAfterRef.current !== afterTimestamp) {
                    requestPromise = (async () => {
                        try {
                            const targetRange = { fromTs: afterTimestamp, toTs: segment.to };
                            const cacheRead = isTestEnv
                                ? { bars: [], missingRanges: [targetRange] }
                                : await cacheMatrixRef.current.readRanges(activeCacheKey, [targetRange], activeCacheSemanticScope);
                            if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                return;
                            }
                            if (cacheRead.bars.length > 0) {
                                await runHistoryMergeLane(() => {
                                    if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                        return;
                                    }
                                    historyChunkStoreRef.current.append(cacheRead.bars);
                                    let resolvedResidentTarget = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, sourceSemantics, retentionFactorRef.current);
                                    if (liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current) {
                                        resolvedResidentTarget = {
                                            ...resolvedResidentTarget,
                                            endMs: Math.max(resolvedResidentTarget.endMs, liveEdgeMsRef.current),
                                        };
                                    }
                                    historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget), residentMaxBars ?? 120000, true, false);
                                    setBars(historyChunkStoreRef.current.toSnapshot().bars);
                                });
                            }
                            if (cacheRead.missingRanges.length > 0) {
                                for (const missing of cacheRead.missingRanges) {
                                    let newerBars = [];
                                    try {
                                        newerBars = await adapter.fetchBarsInRange(activeSymbol, activeTimeframe, new Date(missing.fromTs), new Date(missing.toTs)) ?? [];
                                    }
                                    catch (fetchError) {
                                        if (fetchError?.name === "AbortError" || controller.signal.aborted) {
                                            return;
                                        }
                                        console.error("Failed to fetch newer bars:", fetchError);
                                        break;
                                    }
                                    if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                        return;
                                    }
                                    const rangeCoverage = adapter.getLastRangeCoverage?.() ?? null;
                                    const rangeBoundaryStopTs = rangeCoverage?.reduce((currentValue, fragment) => {
                                        if (fragment.status !== "unresolved" || fragment.reason !== "boundary-exhausted") {
                                            return currentValue;
                                        }
                                        return currentValue === null ? fragment.fromTs : Math.max(currentValue, fragment.fromTs);
                                    }, null) ?? null;
                                    const boundaryExhaustedByCoverage = rangeCoverage !== null && rangeCoverage.some((fragment) => (fragment.status === "unresolved"
                                        && fragment.reason === "boundary-exhausted"
                                        && fragment.toTs >= missing.toTs));
                                    const hasNewerBars = newerBars.some((bar) => bar.date.getTime() > missing.fromTs);
                                    if (!hasNewerBars) {
                                        if (rangeCoverage === null || boundaryExhaustedByCoverage) {
                                            historyForwardAfterRef.current = rangeBoundaryStopTs ?? afterTimestamp;
                                        }
                                        traceForkRange((rangeCoverage === null || boundaryExhaustedByCoverage) ? "right-boundary-exhausted" : "right-boundary-open", {
                                            afterTimestamp,
                                            missingRange: missing,
                                            newerBarsLength: newerBars.length,
                                            rangeCoverage,
                                            rangeBoundaryStopTs,
                                        });
                                        continue;
                                    }
                                    await runHistoryMergeLane(() => {
                                        if (!isHistorySessionRequestCurrent(requestKey, sessionRevision, controller.signal)) {
                                            return;
                                        }
                                        totalBarsFetchedRef.current += newerBars.length;
                                        const newerBarsToMerge = finalityMergeOpts
                                            ? filterBarsForFinalityMerge(newerBars, historyChunkStoreRef.current.toSnapshot().bars, finalityMergeOpts)
                                            : newerBars;
                                        const appendPatch = historyChunkStoreRef.current.append(newerBarsToMerge);
                                        let resolvedResidentTarget = computeResidentTarget({ startMs: adjustedVisibleStartMs, endMs: adjustedVisibleEndMs }, visibleSpanMs, visibleBarCount, sourceSemantics, retentionFactorRef.current);
                                        if (liveEdgeMsRef.current !== null && adjustedVisibleEndMs < liveEdgeMsRef.current) {
                                            resolvedResidentTarget = {
                                                ...resolvedResidentTarget,
                                                endMs: Math.max(resolvedResidentTarget.endMs, liveEdgeMsRef.current),
                                            };
                                        }
                                        historyChunkStoreRef.current.trimToWindow(computeTrimWindow(resolvedResidentTarget), residentMaxBars ?? 120000, true, false);
                                        pendingHistoryPatchRef.current = {
                                            kind: "append",
                                            snapshot: historyChunkStoreRef.current.toSnapshot(),
                                            prependedCount: 0,
                                            appendedCount: appendPatch.appendedCount,
                                            trimmedFromHead: appendPatch.trimmedFromHead,
                                            trimmedFromTail: appendPatch.trimmedFromTail,
                                        };
                                        setBars(historyChunkStoreRef.current.toSnapshot().bars);
                                    });
                                    historyForwardAfterRef.current = boundaryExhaustedByCoverage
                                        ? (rangeBoundaryStopTs ?? newerBars[newerBars.length - 1]?.date.getTime() ?? null)
                                        : null;
                                    traceForkRange(boundaryExhaustedByCoverage ? "right-boundary-exhausted" : "right-boundary-open", {
                                        afterTimestamp,
                                        missingRange: missing,
                                        newerBarsLength: newerBars.length,
                                        rangeCoverage,
                                        rangeBoundaryStopTs,
                                    });
                                    try {
                                        if (!isTestEnv) {
                                            await cacheMatrixRef.current.writePatch(activeCacheKey, newerBars, {
                                                requestId: `fill-range-${Date.now()}`,
                                                sessionRevision,
                                                reason: "remote-fill",
                                                semanticScope: activeCacheSemanticScope,
                                            });
                                        }
                                    }
                                    catch (cacheError) {
                                        console.error("Failed to write forward bars to cache:", cacheError);
                                    }
                                }
                            }
                        }
                        finally {
                            abortControllersRef.current.delete(controllerKey);
                            activeRequestsRef.current.delete(requestPromise);
                            syncHistoryBusyState();
                            if (!controller.signal.aborted &&
                                activeHistoryRequestKeyRef.current === requestKey &&
                                activeHistorySessionRevisionRef.current === sessionRevision) {
                                const latestDomain = visibleDomainRef.current ?? visibleDomain;
                                void reconcileVisibleHistoryWindow(latestDomain);
                            }
                        }
                    })();
                    activeRequestsRef.current.add(requestPromise);
                    syncHistoryBusyState();
                    promises.push(requestPromise);
                }
            }
        }
    }, [
        activeSymbol,
        activeTimeframe,
        activeCacheSemanticScope,
        activeSourceSemantics,
        adapter,
        loading,
        forkVisibleRange,
        syncHistoryBusyState,
        isHistorySessionRequestCurrent,
        runHistoryMergeLane,
    ]);
    const queueVisibleHistoryWindowSync = useCallback((visibleDomain, force = false) => {
        const isSameAsLastQueued = lastQueuedVisibleDomainRef.current !== null
            && areVisibleDomainsEqual(lastQueuedVisibleDomainRef.current, visibleDomain);
        if (historyWindowSyncInFlightRef.current) {
            if (!force
                && isSameAsLastQueued
                && pendingVisibleDomainRef.current !== null
                && areVisibleDomainsEqual(pendingVisibleDomainRef.current, visibleDomain)) {
                return;
            }
            lastQueuedVisibleDomainRef.current = visibleDomain;
            pendingVisibleDomainRef.current = visibleDomain;
            return;
        }
        if (!force && isSameAsLastQueued) {
            return;
        }
        lastQueuedVisibleDomainRef.current = visibleDomain;
        pendingVisibleDomainRef.current = visibleDomain;
        historyWindowSyncInFlightRef.current = true;
        syncHistoryBusyState();
        const runSync = () => {
            void (async () => {
                try {
                    const nextVisibleDomain = pendingVisibleDomainRef.current;
                    pendingVisibleDomainRef.current = null;
                    if (nextVisibleDomain) {
                        await reconcileVisibleHistoryWindow(nextVisibleDomain);
                    }
                }
                finally {
                    historyWindowSyncInFlightRef.current = false;
                    syncHistoryBusyState();
                    const queuedVisibleDomain = pendingVisibleDomainRef.current;
                    if (queuedVisibleDomain) {
                        pendingVisibleDomainRef.current = null;
                        queueVisibleHistoryWindowSync(queuedVisibleDomain, true);
                    }
                }
            })();
        };
        if (isTestEnv || debounceMsRef.current <= 0) {
            runSync();
        }
        else {
            setTimeout(runSync, debounceMsRef.current);
        }
    }, [reconcileVisibleHistoryWindow, syncHistoryBusyState]);
    const requestVisibleHistoryWindowSync = useCallback((visibleDomain, options) => {
        const { force = false, updateVisibleDomainRef = false } = options ?? {};
        if (updateVisibleDomainRef) {
            visibleDomainRef.current = visibleDomain;
        }
        if (isControlledHistorySession) {
            return false;
        }
        queueVisibleHistoryWindowSync(visibleDomain, force);
        return true;
    }, [isControlledHistorySession, queueVisibleHistoryWindowSync]);
    const totalBarsFetchedRef = useRef(0);
    return {
        reconcileVisibleHistoryWindow,
        queueVisibleHistoryWindowSync,
        requestVisibleHistoryWindowSync,
        totalBarsFetchedRef,
    };
}
