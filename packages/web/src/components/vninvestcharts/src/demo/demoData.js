import bitstampCsv from "../../docs/data/bitfinex_xbtusd_1m.csv";
const DEMO_WINDOW = 1000;
const BINANCE_MAX_LIMIT = 1000;
const BINANCE_BASE = "https://api.binance.com/api/v3/klines";
/** Map demo timeframe labels → Binance interval strings */
export const BINANCE_INTERVAL_MAP = {
    "1m": "1m", "3m": "3m", "5m": "5m", "15m": "15m", "30m": "30m",
    "1h": "1h", "4h": "4h", "1D": "1d", "1W": "1w",
};
function sortBars(data) {
    const getMs = (d) => {
        if (d instanceof Date)
            return d.getTime();
        return new Date(d).getTime();
    };
    return data
        .slice()
        .sort((left, right) => getMs(left.date) - getMs(right.date));
}
function normalizeBars(data, limit = DEMO_WINDOW) {
    const sorted = sortBars(data);
    return sorted.slice(-limit);
}
export function mergeBarsByDate(primary, secondary) {
    const merged = sortBars([...primary, ...secondary]);
    if (merged.length === 0) {
        return [];
    }
    const getMs = (d) => {
        if (d instanceof Date)
            return d.getTime();
        return new Date(d).getTime();
    };
    const deduped = [merged[0]];
    for (const bar of merged.slice(1)) {
        const lastBar = deduped[deduped.length - 1];
        if (getMs(lastBar.date) === getMs(bar.date)) {
            deduped[deduped.length - 1] = bar;
        }
        else {
            deduped.push(bar);
        }
    }
    return deduped;
}
function parseDateTime(value) {
    return new Date(value.replace(" ", "T"));
}
function parseCsvRow(row) {
    const [date, open, high, low, close, volume] = row.split(",");
    return {
        date: parseDateTime(date),
        open: Number(open),
        high: Number(high),
        low: Number(low),
        close: Number(close),
        volume: Number(volume),
    };
}
export function getOfflineDemoBars() {
    return normalizeBars(bitstampCsv.trim().split(/\r?\n/).slice(1).map(parseCsvRow));
}
function formatBinanceKlineBars(json, limit = DEMO_WINDOW) {
    return normalizeBars(json.map((d) => ({
        date: new Date(d[0]),
        open: parseFloat(d[1]),
        high: parseFloat(d[2]),
        low: parseFloat(d[3]),
        close: parseFloat(d[4]),
        volume: parseFloat(d[5]),
    })), limit);
}
function toTimeValue(value) {
    if (value === undefined) {
        return undefined;
    }
    return value instanceof Date ? value.valueOf() : value;
}
/** Map timeframe strings → millisecond intervals for gap detection. */
export const INTERVAL_MS_MAP = {
    "1m": 60_000, "3m": 3 * 60_000, "5m": 5 * 60_000,
    "15m": 15 * 60_000, "30m": 30 * 60_000,
    "1h": 3_600_000, "4h": 4 * 3_600_000,
    "1D": 86_400_000, "1W": 7 * 86_400_000,
};
/**
 * Maximum allowed gap between backward-fetched bars and current bars,
 * in multiples of the interval. 48 × 1h = 2 days for crypto (24/7 market).
 */
const MAX_CONTIGUOUS_GAP_MULTIPLIER = 48;
/**
 * Detect whether merging `olderBars` into `currentBars` would create
 * an excessive time gap. Used to reject stale backward-fetched pages
 * that would cause visual artefacts (BB ballooning, chart discontinuity).
 */
export function isBackfillGapExcessive(olderBars, currentBars, timeframe, maxMultiplier = MAX_CONTIGUOUS_GAP_MULTIPLIER) {
    if (olderBars.length === 0 || currentBars.length === 0)
        return false;
    const newestOlderTs = olderBars[olderBars.length - 1].date.valueOf();
    const oldestCurrentTs = currentBars[0].date.valueOf();
    const gapMs = oldestCurrentTs - newestOlderTs;
    if (gapMs <= 0)
        return false;
    const intervalMs = INTERVAL_MS_MAP[timeframe] ?? 3_600_000;
    return gapMs > intervalMs * maxMultiplier;
}
async function fetchBinanceKlinePage(options = {}) {
    const { symbol = "BTCUSDT", interval = "1h", limit = DEMO_WINDOW, startTime, endTime, signal } = options;
    const binanceInterval = BINANCE_INTERVAL_MAP[interval] ?? interval;
    const params = new URLSearchParams({
        symbol,
        interval: binanceInterval,
        limit: String(Math.max(1, Math.min(BINANCE_MAX_LIMIT, limit))),
    });
    const startTimeValue = toTimeValue(startTime);
    const endTimeValue = toTimeValue(endTime);
    if (startTimeValue !== undefined) {
        params.set("startTime", String(startTimeValue));
    }
    if (endTimeValue !== undefined) {
        params.set("endTime", String(endTimeValue));
    }
    const url = `${BINANCE_BASE}?${params.toString()}`;
    const response = await fetch(url, { signal });
    if (!response.ok) {
        throw new Error(`Không tải được dữ liệu Binance: ${response.status}`);
    }
    const json = await response.json();
    return formatBinanceKlineBars(json, limit);
}
export async function fetchHistoricalDemoBars(options = {}) {
    const { pages = 1, limit = BINANCE_MAX_LIMIT, endTime, ...rest } = options;
    let nextEndTime = toTimeValue(endTime);
    let bars = [];
    for (let page = 0; page < Math.max(1, pages); page += 1) {
        const pageBars = await fetchBinanceKlinePage({
            ...rest,
            limit,
            endTime: nextEndTime,
        });
        if (pageBars.length === 0) {
            break;
        }
        bars = mergeBarsByDate(pageBars, bars);
        if (pageBars.length < limit) {
            break;
        }
        nextEndTime = pageBars[0].date.valueOf() - 1;
    }
    return bars;
}
