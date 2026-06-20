/**
 * WP-02: VNInvestClient — moved from src/demo/dataSources/
 * HTTP client for the VNInvest REST API with PAT Bearer authentication.
 * No React dependency — safe to use in non-component contexts.
 */
import { normalizeBarsPagingMeta } from "./barsPagingPolicy.js";
const PAT_STORAGE_KEY = "vni_pat";
const API_BASE_STORAGE_KEY = "vni_api_base";
const DEFAULT_API_BASE = "http://127.0.0.1";
function normalizeApiBase(value) {
    const trimmed = value.trim();
    return trimmed.replace(/\/+$/, "");
}
function resolveBrowserOrigin() {
    try {
        if (typeof location === "undefined" || typeof location.origin !== "string") {
            return null;
        }
        const normalizedOrigin = normalizeApiBase(location.origin);
        if (!/^https?:\/\//i.test(normalizedOrigin)) {
            return null;
        }
        return normalizedOrigin;
    }
    catch {
        return null;
    }
}
/** Resolve API base URL (priority: global override → localStorage → current origin → default). */
export function resolveApiBase() {
    try {
        const globalScope = globalThis;
        if (typeof globalScope.__VNI_API_BASE__ === "string") {
            return normalizeApiBase(globalScope.__VNI_API_BASE__);
        }
    }
    catch { /* ignore */ }
    try {
        if (typeof localStorage !== "undefined") {
            const stored = localStorage.getItem(API_BASE_STORAGE_KEY);
            if (stored)
                return normalizeApiBase(stored);
        }
    }
    catch { /* ignore */ }
    const browserOrigin = resolveBrowserOrigin();
    if (browserOrigin) {
        return browserOrigin;
    }
    return DEFAULT_API_BASE;
}
/** Map of common timeframe aliases to VNInvest canonical formats. */
export const TIMEFRAME_MAP = {
    "1m": "1m",
    "5m": "5m",
    "15m": "15m",
    "1h": "1H",
    "1H": "1H",
    "2H": "2H",
    "4H": "4H",
    "1d": "D",
    "1D": "D",
    "d": "D",
    "D": "D",
    "W": "W",
    "M": "M",
    "Y": "Y",
};
function normalizeTimeframe(tf) {
    return TIMEFRAME_MAP[tf] ?? tf;
}
function asObject(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
    }
    return null;
}
function asNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string") {
        const parsed = Number(value.trim());
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function parseDateValue(value) {
    if (typeof value === "number") {
        if (value > 0 && value < 1e12) {
            return new Date(value * 1000);
        }
        return new Date(value);
    }
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) {
        if (numeric > 0 && numeric < 1e12) {
            return new Date(numeric * 1000);
        }
        return new Date(numeric);
    }
    return new Date(value);
}
function normalizeChartPoint(value) {
    const point = asObject(value);
    if (!point) {
        return null;
    }
    const dateRaw = point.date ?? point.timestamp ?? point.time ?? point.t;
    const open = asNumber(point.open ?? point.o);
    const high = asNumber(point.high ?? point.h);
    const low = asNumber(point.low ?? point.l);
    const close = asNumber(point.close ?? point.c);
    const volume = asNumber(point.volume ?? point.v);
    if ((typeof dateRaw !== "string" && typeof dateRaw !== "number") || open === null || high === null || low === null || close === null || volume === null) {
        return null;
    }
    const dateValue = parseDateValue(dateRaw);
    if (!Number.isFinite(dateValue.valueOf())) {
        return null;
    }
    return {
        date: dateValue.toISOString(),
        open,
        high,
        low,
        close,
        volume,
    };
}
function extractChartPoints(data) {
    if (Array.isArray(data)) {
        return data.map(normalizeChartPoint).filter((point) => point !== null);
    }
    const payload = asObject(data);
    if (!payload) {
        return [];
    }
    const nestedData = asObject(payload.data);
    const candidates = [
        payload.points,
        nestedData?.points,
        payload.candles,
        nestedData?.candles,
        payload.ohlcv,
        nestedData?.ohlcv,
        payload.results,
        nestedData?.results,
        payload.data,
    ];
    for (const candidate of candidates) {
        if (!Array.isArray(candidate)) {
            continue;
        }
        const normalized = candidate
            .map(normalizeChartPoint)
            .filter((point) => point !== null);
        if (normalized.length > 0 || candidate.length === 0) {
            return normalized;
        }
    }
    return [];
}
function resolveTechnical(data) {
    if (Array.isArray(data)) {
        return undefined;
    }
    const payload = asObject(data);
    if (!payload) {
        return undefined;
    }
    const nestedData = asObject(payload.data);
    const technical = (payload.technical ?? nestedData?.technical);
    return technical;
}
function normalizeChartBars(data) {
    const points = extractChartPoints(data);
    const technical = resolveTechnical(data);
    return points
        .map((point) => ({
        date: new Date(point.date),
        open: point.open,
        high: point.high,
        low: point.low,
        close: point.close,
        volume: point.volume,
        technical,
    }))
        .filter((bar) => Number.isFinite(bar.date.valueOf()));
}
function isWhaleFeedResponse(data) {
    if (!data || Array.isArray(data) || typeof data !== "object") {
        return false;
    }
    return "summary" in data && "whale_orders" in data;
}
function buildEndpoints(base) {
    return {
        CHART: (symbol) => `${base}/core/v1/stock-management/stocks/${encodeURIComponent(symbol)}/chart/`,
        BARS: (symbol) => `${base}/core/v1/stock-management/stocks/${encodeURIComponent(symbol)}/bars/`,
        ORDER_FLOW: (symbol) => `${base}/core/v1/stock-management/stocks/${encodeURIComponent(symbol)}/order-flow/`,
        STOCKS_LIST: `${base}/core/v1/stock-management/stocks/`,
        AUTH_TOKEN: `${base}/core/v1/auth/token/`,
        TICKER: (symbol) => `${base}/core/v1/realtime/ticker/${encodeURIComponent(symbol)}/`,
        WHALE_FEED: (symbol) => `${base}/core/v1/realtime/whale-feed/${encodeURIComponent(symbol)}/`,
        AI_ADVISORY: `${base}/core/v1/stock-management/stocks/ai-advisory-session/`,
        INTRADAY_TAPE: (symbol) => `${base}/core/v1/market-data/intraday-tape/?symbol=${encodeURIComponent(symbol)}`,
    };
}
const BARS_HOT_WINDOW_TTL_MS = 15_000;
export const DEFAULT_BARS_HOT_WINDOW_LOAD_GATE_THRESHOLDS = {
    minimumObservedRequests: 100,
    healthySavedRequestRatio: 0.95,
    rollbackSavedRequestRatio: 0.75,
    healthyNetworkRequestRatio: 0.05,
    rollbackNetworkRequestRatio: 0.25,
};
const barsHotWindowCache = new Map();
const barsHotWindowInFlight = new Map();
const barsHotWindowTelemetry = {
    cacheHits: 0,
    inFlightCollapses: 0,
    networkRequests: 0,
    lastUpdatedAt: null,
};
function markBarsHotWindowTelemetry(metric) {
    barsHotWindowTelemetry[metric] += 1;
    barsHotWindowTelemetry.lastUpdatedAt = Date.now();
}
function cloneBarsHotWindowTelemetry(telemetry) {
    return {
        cacheHits: telemetry.cacheHits,
        inFlightCollapses: telemetry.inFlightCollapses,
        networkRequests: telemetry.networkRequests,
        lastUpdatedAt: telemetry.lastUpdatedAt,
    };
}
export function diffBarsHotWindowTelemetry(before, after) {
    return {
        cacheHits: Math.max(0, after.cacheHits - before.cacheHits),
        inFlightCollapses: Math.max(0, after.inFlightCollapses - before.inFlightCollapses),
        networkRequests: Math.max(0, after.networkRequests - before.networkRequests),
        lastUpdatedAt: after.lastUpdatedAt,
    };
}
export function evaluateBarsHotWindowLoadGate(telemetry, thresholds = DEFAULT_BARS_HOT_WINDOW_LOAD_GATE_THRESHOLDS) {
    const totalRequests = telemetry.cacheHits + telemetry.inFlightCollapses + telemetry.networkRequests;
    const cacheHitRatio = totalRequests > 0 ? telemetry.cacheHits / totalRequests : 0;
    const collapseRatio = totalRequests > 0 ? telemetry.inFlightCollapses / totalRequests : 0;
    const networkRequestRatio = totalRequests > 0 ? telemetry.networkRequests / totalRequests : 0;
    const savedRequestRatio = totalRequests > 0 ? (telemetry.cacheHits + telemetry.inFlightCollapses) / totalRequests : 0;
    const reasons = [];
    if (totalRequests < thresholds.minimumObservedRequests) {
        reasons.push("insufficient-sample");
        if (totalRequests > 0 && savedRequestRatio < thresholds.healthySavedRequestRatio) {
            reasons.push("warning-saved-request-ratio");
        }
        if (totalRequests > 0 && networkRequestRatio > thresholds.healthyNetworkRequestRatio) {
            reasons.push("warning-network-request-ratio");
        }
        return {
            status: "warning",
            reasons,
            telemetry: cloneBarsHotWindowTelemetry(telemetry),
            totalRequests,
            cacheHitRatio,
            collapseRatio,
            networkRequestRatio,
            savedRequestRatio,
            thresholds: { ...thresholds },
        };
    }
    if (savedRequestRatio < thresholds.rollbackSavedRequestRatio
        || networkRequestRatio > thresholds.rollbackNetworkRequestRatio) {
        if (savedRequestRatio < thresholds.rollbackSavedRequestRatio) {
            reasons.push("rollback-saved-request-ratio");
        }
        if (networkRequestRatio > thresholds.rollbackNetworkRequestRatio) {
            reasons.push("rollback-network-request-ratio");
        }
        return {
            status: "rollback",
            reasons,
            telemetry: cloneBarsHotWindowTelemetry(telemetry),
            totalRequests,
            cacheHitRatio,
            collapseRatio,
            networkRequestRatio,
            savedRequestRatio,
            thresholds: { ...thresholds },
        };
    }
    if (savedRequestRatio < thresholds.healthySavedRequestRatio) {
        reasons.push("warning-saved-request-ratio");
    }
    if (networkRequestRatio > thresholds.healthyNetworkRequestRatio) {
        reasons.push("warning-network-request-ratio");
    }
    return {
        status: reasons.length > 0 ? "warning" : "healthy",
        reasons,
        telemetry: cloneBarsHotWindowTelemetry(telemetry),
        totalRequests,
        cacheHitRatio,
        collapseRatio,
        networkRequestRatio,
        savedRequestRatio,
        thresholds: { ...thresholds },
    };
}
function createBarsHotWindowKey(base, pat, params) {
    const scope = [base, pat, params.symbol.trim().toUpperCase(), normalizeTimeframe(params.timeframe)].join("|");
    if (params.type === "backward") {
        return `${scope}|backward|${params.before}|${params.limit}|${params.snapshotId ?? ""}`;
    }
    return `${scope}|init|${params.from ?? ""}|${params.to ?? ""}|${params.limit ?? ""}`;
}
function cloneBarsPageResponse(response) {
    return {
        bars: response.bars.map((bar) => ({
            date: new Date(bar.date),
            open: bar.open,
            high: bar.high,
            low: bar.low,
            close: bar.close,
            volume: bar.volume,
            technical: bar.technical,
        })),
        hasMoreBefore: response.hasMoreBefore,
        hasMoreAfter: response.hasMoreAfter,
        nextBefore: response.nextBefore,
        snapshotId: response.snapshotId,
    };
}
function pruneExpiredBarsHotWindowEntries(now) {
    for (const [key, entry] of barsHotWindowCache.entries()) {
        if (entry.expiresAt <= now) {
            barsHotWindowCache.delete(key);
        }
    }
}
export class VNInvestClient {
    _pat = "";
    _base;
    constructor(patToken) {
        this._base = resolveApiBase();
        try {
            if (typeof localStorage !== "undefined") {
                this._pat = localStorage.getItem(PAT_STORAGE_KEY) ?? "";
            }
        }
        catch { /* ignore */ }
        if (patToken) {
            this.setPAT(patToken);
        }
    }
    setPAT(token) {
        const trimmed = (token ?? "").trim();
        if (!trimmed) {
            this._pat = "";
            try {
                if (typeof localStorage !== "undefined") {
                    localStorage.removeItem(PAT_STORAGE_KEY);
                }
            }
            catch { /* ignore */ }
            return;
        }
        this._pat = trimmed;
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(PAT_STORAGE_KEY, trimmed);
            }
        }
        catch { /* ignore */ }
    }
    getPAT() {
        return this._pat;
    }
    setBase(url) {
        const trimmed = (url ?? "").trim().replace(/\/+$/, "");
        if (!trimmed)
            return;
        this._base = trimmed;
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(API_BASE_STORAGE_KEY, trimmed);
            }
        }
        catch { /* ignore */ }
    }
    getBase() {
        return this._base;
    }
    hasPAT() {
        return this._pat.length > 0;
    }
    buildHeaders() {
        const headers = { "Content-Type": "application/json" };
        if (this._pat) {
            headers["Authorization"] = `Bearer ${this._pat}`;
        }
        return headers;
    }
    async _fetch(url, init) {
        const response = await fetch(url, { ...init, headers: this.buildHeaders() });
        if (response.status === 401) {
            throw new Error("TOKEN_EXPIRED");
        }
        if (response.status === 404) {
            throw new Error("SYMBOL_NOT_FOUND");
        }
        if (!response.ok) {
            const text = await response.text().catch(() => String(response.status));
            throw new Error(`HTTP_${response.status}: ${text.slice(0, 200)}`);
        }
        return response.json();
    }
    async getChart(symbol, options) {
        const endpoints = buildEndpoints(this._base);
        const params = new URLSearchParams();
        if (options?.timeframe)
            params.set("timeframe", normalizeTimeframe(options.timeframe));
        if (options?.days != null)
            params.set("days", String(options.days));
        const url = `${endpoints.CHART(symbol)}?${params.toString()}`;
        const data = await this._fetch(url);
        return normalizeChartBars(data);
    }
    async getBarsPage(params) {
        const cacheKey = createBarsHotWindowKey(this._base, this._pat, params);
        const now = Date.now();
        pruneExpiredBarsHotWindowEntries(now);
        const cachedEntry = barsHotWindowCache.get(cacheKey);
        if (cachedEntry && cachedEntry.expiresAt > now) {
            markBarsHotWindowTelemetry("cacheHits");
            return cloneBarsPageResponse(cachedEntry.response);
        }
        const inFlight = barsHotWindowInFlight.get(cacheKey);
        if (inFlight) {
            markBarsHotWindowTelemetry("inFlightCollapses");
            const sharedResponse = await inFlight;
            return cloneBarsPageResponse(sharedResponse);
        }
        const endpoints = buildEndpoints(this._base);
        const urlParams = new URLSearchParams();
        urlParams.set("timeframe", normalizeTimeframe(params.timeframe));
        if (params.type === "backward") {
            urlParams.set("before", String(params.before));
            urlParams.set("limit", String(params.limit));
            if (params.snapshotId)
                urlParams.set("snapshot_id", params.snapshotId);
        }
        else {
            if (params.from != null)
                urlParams.set("from", String(params.from));
            if (params.to != null)
                urlParams.set("to", String(params.to));
            if (params.limit != null)
                urlParams.set("limit", String(params.limit));
        }
        const requestPromise = (async () => {
            markBarsHotWindowTelemetry("networkRequests");
            const url = `${endpoints.BARS(params.symbol)}?${urlParams.toString()}`;
            const data = await this._fetch(url);
            const payload = data;
            const rawBars = Array.isArray(payload?.bars) ? payload.bars : [];
            const bars = rawBars
                .map(normalizeChartPoint)
                .filter((p) => p !== null)
                .map((point) => ({
                date: new Date(point.date),
                open: point.open,
                high: point.high,
                low: point.low,
                close: point.close,
                volume: point.volume,
            }))
                .filter((bar) => Number.isFinite(bar.date.valueOf()));
            const pagingMeta = normalizeBarsPagingMeta(payload, bars);
            const response = {
                bars,
                hasMoreBefore: pagingMeta.hasMoreBefore,
                hasMoreAfter: pagingMeta.hasMoreAfter,
                nextBefore: pagingMeta.nextBefore,
                snapshotId: pagingMeta.snapshotId,
            };
            barsHotWindowCache.set(cacheKey, {
                response: cloneBarsPageResponse(response),
                expiresAt: Date.now() + BARS_HOT_WINDOW_TTL_MS,
            });
            return response;
        })();
        barsHotWindowInFlight.set(cacheKey, requestPromise);
        try {
            const response = await requestPromise;
            return cloneBarsPageResponse(response);
        }
        finally {
            barsHotWindowInFlight.delete(cacheKey);
        }
    }
    static __resetBarsHotWindowCacheForTests() {
        barsHotWindowCache.clear();
        barsHotWindowInFlight.clear();
        barsHotWindowTelemetry.cacheHits = 0;
        barsHotWindowTelemetry.inFlightCollapses = 0;
        barsHotWindowTelemetry.networkRequests = 0;
        barsHotWindowTelemetry.lastUpdatedAt = null;
    }
    static getBarsHotWindowTelemetry() {
        return cloneBarsHotWindowTelemetry(barsHotWindowTelemetry);
    }
    static __getBarsHotWindowTelemetryForTests() {
        return VNInvestClient.getBarsHotWindowTelemetry();
    }
    async getStocks(query, exchange) {
        const endpoints = buildEndpoints(this._base);
        const params = new URLSearchParams();
        if (query)
            params.set("search", query);
        if (exchange)
            params.set("exchange", exchange);
        const url = `${endpoints.STOCKS_LIST}?${params.toString()}`;
        const data = await this._fetch(url);
        if (Array.isArray(data))
            return data;
        if ("results" in data && Array.isArray(data.results))
            return data.results;
        return [];
    }
    async getWhaleFeed(symbol) {
        const endpoints = buildEndpoints(this._base);
        const data = await this._fetch(endpoints.WHALE_FEED(symbol));
        return isWhaleFeedResponse(data) ? data : null;
    }
    async getOrderFlow(symbol, window = "30m") {
        const endpoints = buildEndpoints(this._base);
        const params = new URLSearchParams({ window });
        const url = `${endpoints.ORDER_FLOW(symbol)}?${params.toString()}`;
        const data = await this._fetch(url);
        const obj = data;
        if (!obj || obj["ok"] !== true) {
            return null;
        }
        return obj;
    }
    async getAdvisorySession(symbol) {
        const endpoints = buildEndpoints(this._base);
        const data = await this._fetch(endpoints.AI_ADVISORY, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol }),
        });
        const obj = data;
        if (!obj || obj["ok"] !== true) {
            return null;
        }
        return obj;
    }
    async getTapeEntries(symbol) {
        const endpoints = buildEndpoints(this._base);
        const url = endpoints.INTRADAY_TAPE(symbol);
        const data = await this._fetch(url);
        const obj = data;
        if (!obj || obj["ok"] !== true) {
            return null;
        }
        return obj;
    }
}
