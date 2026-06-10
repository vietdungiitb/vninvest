function cacheKey(symbol, interval) {
    return `${symbol}|${interval}`;
}
function isValidBar(bar) {
    return [bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume].every((value) => Number.isFinite(value));
}
/**
 * In-memory adapter backed by pre-loaded bars (e.g. offline CSV data).
 * Useful for testing and offline demo mode.
 */
export class LocalCacheAdapter {
    name = "local";
    store = new Map();
    getSourceSemantics() {
        return {
            sourceId: this.name,
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
    /**
     * Pre-load bars for a given symbol/interval pair.
     * Bars are sorted ascending by timestamp after loading.
     */
    loadBars(symbol, interval, bars) {
        const key = cacheKey(symbol, interval);
        const sorted = bars
            .filter(isValidBar)
            .map((bar) => ({ ...bar }))
            .sort((a, b) => a.timestamp - b.timestamp);
        this.store.set(key, sorted);
    }
    getBars(params) {
        const { symbol, interval, type, timestamp, limit } = params;
        const bars = this.store.get(cacheKey(symbol, interval)) ?? [];
        let slice;
        if (type === "backward" && timestamp !== null) {
            // Return up to `limit` bars ending before `timestamp`
            const before = bars.filter((b) => b.timestamp < timestamp);
            slice = before.slice(-limit);
        }
        else {
            // "init" / "forward" — return the latest `limit` bars
            slice = bars.slice(-limit);
        }
        return Promise.resolve({ bars: slice, hasMore: false });
    }
    getBarsCanonical(params) {
        return this.getBars(params).then((result) => {
            const { bars } = result;
            const coverage = buildLocalCacheCoverage(bars, params);
            return { ...result, coverage };
        });
    }
}
/**
 * Coverage for a finite in-memory snapshot.
 * `hasMore` is always false so any gap to the left is boundary-exhausted.
 */
function buildLocalCacheCoverage(bars, params) {
    if (bars.length === 0) {
        const anchorTs = params.type === "backward" && params.timestamp !== null ? params.timestamp : Date.now();
        return [{ fromTs: 0, toTs: anchorTs, status: "unresolved", reason: "boundary-exhausted" }];
    }
    const oldestTs = bars[0].timestamp;
    const newestTs = bars[bars.length - 1].timestamp;
    return [
        { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
        { fromTs: oldestTs, toTs: newestTs, status: "covered" },
    ];
}
