/**
 * CE20-05: Bridge adapter for VN stock OHLCV on the current VNInvest chart API.
 *
 * This is an adapter bridge, not the final production protocol. The upstream
 * endpoint is still `days`-based, so backward paging is emulated by requesting
 * a bounded window and slicing the returned bars locally.
 */
const PAT_STORAGE_KEY = "vni_pat";
const API_BASE_STORAGE_KEY = "vni_api_base";
const DEFAULT_API_BASE = "http://127.0.0.1";
const DAY_MS = 86_400_000;
const MAX_DAYS = 3650;
const SYMBOL_RE = /^[A-Z0-9]{1,20}$/;
const DAY_LOOKBACK_MS = 30 * DAY_MS;
function normalizeApiBase(value) {
    return value.trim().replace(/\/+$/, "");
}
function readStorageValue(key) {
    try {
        if (typeof localStorage === "undefined") {
            return null;
        }
        return localStorage.getItem(key);
    }
    catch {
        return null;
    }
}
function resolveApiBase() {
    const globalScope = globalThis;
    if (typeof globalScope.__VNI_API_BASE__ === "string" && globalScope.__VNI_API_BASE__.trim()) {
        return normalizeApiBase(globalScope.__VNI_API_BASE__);
    }
    const stored = readStorageValue(API_BASE_STORAGE_KEY);
    if (stored && stored.trim()) {
        return normalizeApiBase(stored);
    }
    if (typeof location !== "undefined" && location.origin) {
        return normalizeApiBase(location.origin);
    }
    return DEFAULT_API_BASE;
}
function resolvePatToken() {
    return readStorageValue(PAT_STORAGE_KEY)?.trim() ?? "";
}
function validateSymbol(symbol) {
    const normalized = symbol.trim().toUpperCase();
    if (!SYMBOL_RE.test(normalized)) {
        throw new Error(`Tên symbol không hợp lệ: "${symbol}"`);
    }
    return normalized;
}
function resolveIntervalMs(interval) {
    switch (interval) {
        case "1m": return 60_000;
        case "3m": return 3 * 60_000;
        case "5m": return 5 * 60_000;
        case "15m": return 15 * 60_000;
        case "30m": return 30 * 60_000;
        case "1h":
        case "1H": return 60 * 60_000;
        case "2H": return 2 * 60 * 60_000;
        case "4h":
        case "4H": return 4 * 60 * 60_000;
        case "D":
        case "1D":
        case "1d": return DAY_MS;
        case "W":
        case "1W":
        case "1w": return 7 * DAY_MS;
        case "M": return 30 * DAY_MS;
        case "Y": return 365 * DAY_MS;
        default:
            throw new Error(`Interval không hợp lệ: "${interval}"`);
    }
}
function normalizeInterval(interval) {
    switch (interval) {
        case "1h": return "1H";
        case "4h": return "4H";
        case "1D":
        case "1d": return "D";
        case "1W":
        case "1w": return "W";
        default:
            resolveIntervalMs(interval);
            return interval;
    }
}
function parseNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function parseTimestamp(value) {
    if (typeof value === "number") {
        if (value > 0 && value < 1e12) {
            return value * 1000;
        }
        return Number.isFinite(value) ? value : null;
    }
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
        if (numeric > 0 && numeric < 1e12) {
            return numeric * 1000;
        }
        return numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}
function normalizePoint(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }
    const point = value;
    const rawDate = point.date ?? point.timestamp ?? point.time ?? point.t;
    const timestamp = (typeof rawDate === "string" || typeof rawDate === "number")
        ? parseTimestamp(rawDate)
        : null;
    const open = parseNumber(point.open ?? point.o);
    const high = parseNumber(point.high ?? point.h);
    const low = parseNumber(point.low ?? point.l);
    const close = parseNumber(point.close ?? point.c);
    const volume = parseNumber(point.volume ?? point.v);
    if (timestamp === null || open === null || high === null || low === null || close === null || volume === null) {
        return null;
    }
    return { timestamp, open, high, low, close, volume };
}
function extractRawPoints(payload) {
    if (Array.isArray(payload)) {
        return payload;
    }
    if (!payload || typeof payload !== "object") {
        return [];
    }
    const data = payload;
    return data.points
        ?? data.data?.points
        ?? data.candles
        ?? data.data?.candles
        ?? data.ohlcv
        ?? data.data?.ohlcv
        ?? [];
}
function clampDays(days) {
    if (!Number.isFinite(days)) {
        return 1;
    }
    return Math.max(1, Math.min(MAX_DAYS, Math.ceil(days)));
}
function resolveDays(params) {
    const intervalMs = resolveIntervalMs(params.interval);
    const requestedWindowMs = Math.max(1, params.limit) * intervalMs;
    if (params.type === "backward" && params.timestamp !== null) {
        const anchorWindowMs = Math.max(0, Date.now() - params.timestamp);
        return clampDays((anchorWindowMs + requestedWindowMs) / DAY_MS);
    }
    return clampDays(requestedWindowMs / DAY_MS);
}
function buildHeaders(patToken) {
    return {
        "Content-Type": "application/json",
        Authorization: `Bearer ${patToken}`,
    };
}
export class VNStocksAdapter {
    name = "vnstocks";
    getSourceSemantics() {
        return {
            sourceId: this.name,
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
            maxBarsPerRequest: MAX_DAYS,
            finalityMode: "historically-correctable",
            correctionLookbackMs: DAY_LOOKBACK_MS,
            expectedGapReasons: ["not-fetched", "market-closed", "source-no-data", "rate-limited", "boundary-exhausted"],
        };
    }
    async getBars(params) {
        const patToken = resolvePatToken();
        if (!patToken) {
            throw new Error("NO_PAT");
        }
        const safeSymbol = validateSymbol(params.symbol);
        const safeInterval = normalizeInterval(params.interval);
        const safeLimit = Math.max(1, params.limit);
        const days = resolveDays(params);
        const base = resolveApiBase();
        const url = new URL(`${base}/core/v1/stock-management/stocks/${encodeURIComponent(safeSymbol)}/chart/`);
        url.searchParams.set("timeframe", safeInterval);
        url.searchParams.set("days", String(days));
        const response = await fetch(url.toString(), {
            headers: buildHeaders(patToken),
            signal: params.signal,
        });
        if (!response.ok) {
            throw new Error(`HTTP_${response.status}`);
        }
        const payload = await response.json();
        const allBars = extractRawPoints(payload)
            .map(normalizePoint)
            .filter((bar) => bar !== null)
            .sort((left, right) => left.timestamp - right.timestamp);
        const backwardAnchor = params.type === "backward" ? params.timestamp : null;
        const bars = backwardAnchor !== null
            ? allBars.filter((bar) => bar.timestamp < backwardAnchor).slice(-safeLimit)
            : allBars.slice(-safeLimit);
        return {
            bars,
            hasMore: bars.length > 0,
        };
    }
    getBarsCanonical(params) {
        return this.getBars(params).then((result) => {
            const coverage = buildVNStocksCoverage(result, params);
            return { ...result, coverage };
        });
    }
}
/**
 * Coverage for a window-hint source.
 *
 * VNStocks returns a days-based window so the exact left boundary is
 * approximate.  We report covered = what was actually returned; anything
 * before the oldest bar is unresolved (may be market-closed or boundary).
 */
function buildVNStocksCoverage(result, params) {
    const { bars, hasMore } = result;
    if (bars.length === 0) {
        if (params.type === "backward" && params.timestamp !== null) {
            return [
                { fromTs: 0, toTs: params.timestamp, status: "unresolved", reason: "boundary-exhausted" },
            ];
        }
        return [{ fromTs: 0, toTs: Date.now(), status: "unresolved", reason: "source-no-data" }];
    }
    const oldestTs = bars[0].timestamp;
    const newestTs = bars[bars.length - 1].timestamp;
    const covered = { fromTs: oldestTs, toTs: newestTs, status: "covered" };
    if (!hasMore) {
        return [
            // Gaps before oldest may be market-closed or truly exhausted; we tag as
            // boundary-exhausted since we cannot distinguish without a calendar.
            { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
            covered,
        ];
    }
    return [covered];
}
