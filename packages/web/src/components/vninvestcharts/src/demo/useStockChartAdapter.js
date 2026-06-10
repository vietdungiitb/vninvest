import { useMemo, useRef } from "react";
const DEFAULT_PAGE_LIMIT = 300;
function resolveEffectiveMaxBarsPerRequest(requestedBars, sourceSemantics) {
    const requested = Math.max(1, Math.floor(requestedBars));
    const sourceLimit = sourceSemantics.maxBarsPerRequest;
    if (typeof sourceLimit !== "number" || !Number.isFinite(sourceLimit) || sourceLimit <= 0) {
        return requested;
    }
    return Math.min(requested, Math.floor(sourceLimit));
}
function cloneWidgetBar(bar) {
    return {
        ...bar,
        date: new Date(bar.date),
    };
}
function mapKLineBarToWidgetBar(bar, index) {
    return {
        date: new Date(bar.timestamp),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        index,
        dataIndex: index,
    };
}
function buildExactRangeBackwardCoverage(bars, before, limit, sourceSemantics) {
    if (sourceSemantics.coverageMode !== "exact-range" || !sourceSemantics.supportsBackwardAnchor) {
        return null;
    }
    const anchorTs = before.getTime();
    if (!Number.isFinite(anchorTs)) {
        return null;
    }
    if (bars.length === 0) {
        return [{ fromTs: 0, toTs: anchorTs, status: "unresolved", reason: "boundary-exhausted" }];
    }
    const oldestTs = bars[0]?.date.getTime();
    const newestTs = bars[bars.length - 1]?.date.getTime();
    if (!Number.isFinite(oldestTs) || !Number.isFinite(newestTs)) {
        return null;
    }
    return [{ fromTs: oldestTs, toTs: newestTs, status: "covered" }];
}
function buildExactRangeWindowCoverage(bars, from, to, sourceSemantics) {
    if (sourceSemantics.coverageMode !== "exact-range" || !sourceSemantics.supportsExactRangeFetch) {
        return null;
    }
    const fromTs = from.getTime();
    const toTs = to.getTime();
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs < fromTs) {
        return null;
    }
    if (bars.length === 0) {
        return [{ fromTs, toTs, status: "unresolved", reason: "boundary-exhausted" }];
    }
    const firstTs = bars[0]?.date.getTime();
    const lastTs = bars[bars.length - 1]?.date.getTime();
    if (!Number.isFinite(firstTs) || !Number.isFinite(lastTs)) {
        return null;
    }
    return [{ fromTs: firstTs, toTs: lastTs, status: "covered" }];
}
function createFallbackSemantics(activeSource, dataAdapter) {
    if (dataAdapter.name === "binance" || activeSource === "binance") {
        return {
            sourceId: "binance",
            sourceContractVersion: "binance-klines-v1",
            instrumentClass: "crypto",
            coverageMode: "exact-range",
            sessionModel: "continuous",
            timezone: "UTC",
            supportsExactRangeFetch: true,
            supportsBackwardAnchor: true,
            supportsForwardAnchor: false,
            supportsLiveBars: true,
            maxBarsPerRequest: 1000,
            finalityMode: "near-now-provisional",
            expectedGapReasons: ["not-fetched", "source-no-data", "rate-limited", "boundary-exhausted"],
        };
    }
    if (dataAdapter.name === "vnstocks" || activeSource === "vninvest") {
        return {
            sourceId: "vnstocks",
            sourceContractVersion: "vnstocks-window-v1",
            instrumentClass: "equity",
            coverageMode: "window-hint",
            sessionModel: "exchange-calendar",
            timezone: "Asia/Ho_Chi_Minh",
            sessionCalendarId: "vn-exchange-calendar",
            supportsExactRangeFetch: false,
            supportsBackwardAnchor: true,
            supportsForwardAnchor: false,
            supportsLiveBars: true,
            maxBarsPerRequest: 3650,
            finalityMode: "historically-correctable",
            expectedGapReasons: ["not-fetched", "market-closed", "source-no-data", "rate-limited", "boundary-exhausted"],
        };
    }
    return {
        sourceId: dataAdapter.name,
        sourceContractVersion: "local-archive-v1",
        instrumentClass: "custom",
        coverageMode: "finite-snapshot",
        sessionModel: "continuous",
        timezone: "UTC",
        supportsExactRangeFetch: false,
        supportsBackwardAnchor: true,
        supportsForwardAnchor: false,
        supportsLiveBars: false,
        finalityMode: "immutable",
        expectedGapReasons: ["not-fetched", "source-no-data", "boundary-exhausted", "retention-trimmed", "cache-corrupted"],
    };
}
export function useStockChartAdapter({ activeSource, dataAdapter, selectedSymbol, useWidgetOwnedHistory, widgetData, backfillPageLimit, }) {
    const widgetDataRef = useRef(widgetData);
    widgetDataRef.current = widgetData;
    const sourceSemantics = useMemo(() => dataAdapter.getSourceSemantics?.() ?? createFallbackSemantics(activeSource, dataAdapter), [activeSource, dataAdapter]);
    return useMemo(() => {
        const lastBackfillCoverageRef = { current: null };
        const lastRangeCoverageRef = { current: null };
        async function callGetBars(params) {
            if (dataAdapter.getBarsCanonical) {
                return dataAdapter.getBarsCanonical(params);
            }
            const result = await dataAdapter.getBars(params);
            return { ...result, coverage: [] };
        }
        return {
            getSourceSemantics() {
                return sourceSemantics;
            },
            async fetchBarsInRange(symbol, timeframeValue, _from, _to) {
                if (useWidgetOwnedHistory) {
                    lastRangeCoverageRef.current = null;
                    if (dataAdapter.fetchBarsInRange) {
                        const bars = await dataAdapter.fetchBarsInRange(symbol, timeframeValue, _from, _to);
                        const mappedBars = bars.map(mapKLineBarToWidgetBar);
                        lastRangeCoverageRef.current = buildExactRangeWindowCoverage(mappedBars, _from, _to, sourceSemantics);
                        return mappedBars;
                    }
                    const result = await callGetBars({
                        type: "init",
                        symbol,
                        interval: timeframeValue,
                        timestamp: null,
                        limit: backfillPageLimit,
                    });
                    lastRangeCoverageRef.current = result.coverage.length > 0 ? result.coverage : null;
                    return result.bars.map(mapKLineBarToWidgetBar);
                }
                return widgetDataRef.current.map(cloneWidgetBar);
            },
            async fetchBarsBefore(symbol, timeframeValue, before, limit = DEFAULT_PAGE_LIMIT) {
                if (useWidgetOwnedHistory) {
                    lastBackfillCoverageRef.current = null;
                    if (dataAdapter.fetchBarsBefore) {
                        const bars = await dataAdapter.fetchBarsBefore(symbol, timeframeValue, before, limit);
                        const mappedBars = bars.map(mapKLineBarToWidgetBar);
                        lastBackfillCoverageRef.current = buildExactRangeBackwardCoverage(mappedBars, before, limit, sourceSemantics);
                        return mappedBars;
                    }
                    const result = await callGetBars({
                        type: "backward",
                        symbol,
                        interval: timeframeValue,
                        timestamp: before.valueOf(),
                        limit,
                    });
                    lastBackfillCoverageRef.current = result.coverage.length > 0 ? result.coverage : null;
                    return result.bars.map(mapKLineBarToWidgetBar);
                }
                return widgetDataRef.current
                    .filter((bar) => bar.date < before)
                    .slice(-limit)
                    .map(cloneWidgetBar);
            },
            subscribeToBar(symbol, timeframe, onBar) {
                if (useWidgetOwnedHistory && typeof dataAdapter.subscribeToBar === "function") {
                    return dataAdapter.subscribeToBar(symbol, timeframe, onBar);
                }
                return () => undefined;
            },
            subscribeToTrades(symbol, onTrade) {
                if (useWidgetOwnedHistory && typeof dataAdapter.subscribeToTrades === "function") {
                    return dataAdapter.subscribeToTrades(symbol, onTrade);
                }
                return () => undefined;
            },
            subscribeToOrderbook(symbol, onUpdate) {
                if (useWidgetOwnedHistory && typeof dataAdapter.subscribeToOrderbook === "function") {
                    return dataAdapter.subscribeToOrderbook(symbol, onUpdate);
                }
                return () => undefined;
            },
            async searchSymbols() {
                return [{ symbol: selectedSymbol, name: selectedSymbol, exchange: activeSource === "vninvest" ? "VNINVEST" : "BINANCE" }];
            },
            getLastBackfillCoverage() {
                return lastBackfillCoverageRef.current;
            },
            getLastRangeCoverage() {
                return lastRangeCoverageRef.current;
            },
        };
    }, [activeSource, backfillPageLimit, dataAdapter, selectedSymbol, sourceSemantics, useWidgetOwnedHistory]);
}
