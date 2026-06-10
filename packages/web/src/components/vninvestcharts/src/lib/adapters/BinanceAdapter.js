// In dev the webpack DefinePlugin injects VN_BINANCE_BASE = "/binance-proxy" so the
// browser never hits api.binance.com directly (avoids CORS / regional blocks).
// In production the value is "" and we fall back to the public Binance URL.
const _BINANCE_ORIGIN = typeof VN_BINANCE_BASE === "string" && VN_BINANCE_BASE.length > 0
    ? VN_BINANCE_BASE
    : "https://api.binance.com";
const BINANCE_BASE = `${_BINANCE_ORIGIN}/api/v3/klines`;
const MAX_LIMIT = 1000;
/** Allowlist of valid Binance interval strings */
const BINANCE_INTERVALS = new Set([
    "1m", "3m", "5m", "15m", "30m",
    "1h", "2h", "4h", "6h", "8h", "12h",
    "1d", "3d", "1w", "1M",
]);
/** Map demo timeframe labels → Binance interval strings */
const INTERVAL_MAP = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};
/** OWASP: validate symbol against allowlist pattern before sending to API */
const SYMBOL_RE = /^[A-Z0-9]{2,20}$/;
function validateSymbol(symbol) {
    const upper = symbol.toUpperCase();
    if (!SYMBOL_RE.test(upper)) {
        throw new Error(`Tên symbol không hợp lệ: "${symbol}"`);
    }
    return upper;
}
function resolveInterval(interval) {
    const mapped = INTERVAL_MAP[interval] ?? interval;
    if (!BINANCE_INTERVALS.has(mapped)) {
        throw new Error(`Interval không hợp lệ: "${interval}"`);
    }
    return mapped;
}
function parseKlines(json) {
    return json.map((d) => ({
        timestamp: Number(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    }));
}
async function fetchBinancePage({ symbol, interval, limit, startTime, endTime, signal, }) {
    const urlParams = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit),
    });
    if (startTime !== undefined) {
        urlParams.set("startTime", String(startTime));
    }
    if (endTime !== undefined) {
        urlParams.set("endTime", String(endTime));
    }
    const response = await fetch(`${BINANCE_BASE}?${urlParams.toString()}`, { signal });
    if (!response.ok) {
        throw new Error(`Không tải được dữ liệu Binance: ${response.status}`);
    }
    const json = await response.json();
    return parseKlines(json);
}
export class BinanceAdapter {
    name = "binance";
    getSourceSemantics() {
        return {
            sourceId: this.name,
            sourceContractVersion: "binance-klines-v1",
            instrumentClass: "crypto",
            coverageMode: "exact-range",
            sessionModel: "continuous",
            timezone: "UTC",
            supportsExactRangeFetch: true,
            supportsBackwardAnchor: true,
            supportsForwardAnchor: false,
            supportsLiveBars: true,
            maxBarsPerRequest: MAX_LIMIT,
            finalityMode: "near-now-provisional",
            expectedGapReasons: ["not-fetched", "source-no-data", "rate-limited", "boundary-exhausted"],
        };
    }
    async getBars(params) {
        const { symbol, interval, timestamp, limit, signal } = params;
        const safeSymbol = validateSymbol(symbol);
        const safeInterval = resolveInterval(interval);
        const safeLimit = Math.max(1, Math.min(MAX_LIMIT, limit));
        const bars = await fetchBinancePage({
            symbol: safeSymbol,
            interval: safeInterval,
            limit: safeLimit,
            endTime: params.type === "backward" && timestamp !== null ? timestamp - 1 : undefined,
            signal,
        });
        return { bars, hasMore: bars.length >= safeLimit };
    }
    async fetchBarsInRange(symbol, timeframe, from, to, signal) {
        const safeSymbol = validateSymbol(symbol);
        const safeInterval = resolveInterval(timeframe);
        const startTime = from.getTime();
        const endTime = to.getTime();
        if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime < startTime) {
            return [];
        }
        const collectedBars = new Map();
        let nextStartTime = startTime;
        while (nextStartTime <= endTime) {
            const pageBars = await fetchBinancePage({
                symbol: safeSymbol,
                interval: safeInterval,
                limit: MAX_LIMIT,
                startTime: nextStartTime,
                endTime,
                signal,
            });
            if (pageBars.length === 0) {
                break;
            }
            for (const bar of pageBars) {
                if (bar.timestamp < startTime || bar.timestamp > endTime) {
                    continue;
                }
                collectedBars.set(bar.timestamp, bar);
            }
            const lastBarTimestamp = pageBars[pageBars.length - 1]?.timestamp;
            if (lastBarTimestamp === undefined || pageBars.length < MAX_LIMIT || lastBarTimestamp >= endTime) {
                break;
            }
            if (lastBarTimestamp < nextStartTime) {
                break;
            }
            nextStartTime = lastBarTimestamp + 1;
        }
        return [...collectedBars.values()].sort((left, right) => left.timestamp - right.timestamp);
    }
    async fetchBarsBefore(symbol, timeframe, before, limit = MAX_LIMIT, signal) {
        const result = await this.getBars({
            type: "backward",
            symbol,
            interval: timeframe,
            timestamp: before.getTime(),
            limit,
            signal,
        });
        return result.bars;
    }
    getBarsCanonical(params) {
        return this.getBars(params).then((result) => {
            const coverage = buildBinanceCoverage(result, params);
            return { ...result, coverage };
        });
    }
}
/**
 * Builds coverage fragments for a Binance exact-range fetch.
 *
 * Binance is a continuous 24/7 market so any gap is either:
 * - Covered (bars returned)
 * - boundary-exhausted (no older data exists)
 */
function buildBinanceCoverage(result, params) {
    const { bars, hasMore } = result;
    if (bars.length === 0) {
        if (params.type === "backward" && params.timestamp !== null) {
            // Source returned nothing before the anchor — boundary exhausted
            return [{ fromTs: 0, toTs: params.timestamp, status: "unresolved", reason: "boundary-exhausted" }];
        }
        // Init / no anchor → no data at all
        return [{ fromTs: 0, toTs: Date.now(), status: "unresolved", reason: "source-no-data" }];
    }
    const oldestTs = bars[0].timestamp;
    const newestTs = bars[bars.length - 1].timestamp;
    const covered = { fromTs: oldestTs, toTs: newestTs, status: "covered" };
    if (!hasMore) {
        // No more data before oldest bar → boundary reached
        return [
            { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
            covered,
        ];
    }
    return [covered];
}
export const binanceAdapter = new BinanceAdapter();
