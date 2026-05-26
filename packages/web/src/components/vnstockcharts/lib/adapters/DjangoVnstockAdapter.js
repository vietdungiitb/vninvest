import { BaseAdapter } from "./BaseAdapter.js";
function normalizeTrade(symbol, payload) {
    const rawTrade = payload;
    return {
        symbol,
        price: rawTrade.price ?? 0,
        size: rawTrade.size ?? 0,
        timestamp: rawTrade.timestamp instanceof Date ? rawTrade.timestamp : new Date(rawTrade.timestamp ?? Date.now()),
        side: rawTrade.side ?? "unknown",
    };
}
function normalizeOrderbook(payload) {
    const rawSnapshot = payload;
    return {
        bids: rawSnapshot.bids ?? [],
        asks: rawSnapshot.asks ?? [],
        timestamp: rawSnapshot.timestamp instanceof Date ? rawSnapshot.timestamp : new Date(rawSnapshot.timestamp ?? Date.now()),
    };
}
export class DjangoVnstockAdapter extends BaseAdapter {
    constructor(baseUrl = "", cacheTtlMs = 1_000) {
        super(baseUrl, cacheTtlMs);
    }
    async fetchBars(symbol, timeframe, from, to) {
        const cacheKey = `bars:${symbol}:${timeframe}:${from.toISOString()}:${to.toISOString()}`;
        return this.memoize(cacheKey, async () => {
            const params = new URLSearchParams({
                tf: timeframe,
                from: from.toISOString(),
                to: to.toISOString(),
            });
            const rawBars = await this.requestJson(`/api/bars/${symbol}/?${params}`);
            return this.normalizeBars(rawBars);
        });
    }
    async fetchMoreBars(symbol, timeframe, before, limit = 300) {
        const cacheKey = `more-bars:${symbol}:${timeframe}:${before.toISOString()}:${limit}`;
        return this.memoize(cacheKey, async () => {
            const params = new URLSearchParams({
                tf: timeframe,
                before: before.toISOString(),
                limit: String(limit),
            });
            const rawBars = await this.requestJson(`/api/bars/${symbol}/?${params}`);
            return this.normalizeBars(rawBars);
        });
    }
    subscribeToBar(symbol, timeframe, onBar) {
        const socket = new WebSocket(this.buildWebSocketUrl(`/ws/bars/${symbol}/${timeframe}/`));
        socket.onmessage = (event) => {
            const rawBar = JSON.parse(event.data);
            onBar(this.normalizeBar(rawBar, rawBar.index ?? 0));
        };
        return () => socket.close();
    }
    subscribeToTrades(symbol, onTrade) {
        const socket = new WebSocket(this.buildWebSocketUrl(`/ws/trades/${symbol}/`));
        socket.onmessage = (event) => {
            onTrade(normalizeTrade(symbol, JSON.parse(event.data)));
        };
        return () => socket.close();
    }
    subscribeToOrderbook(symbol, onUpdate) {
        const socket = new WebSocket(this.buildWebSocketUrl(`/ws/orderbook/${symbol}/`));
        socket.onmessage = (event) => {
            onUpdate(normalizeOrderbook(JSON.parse(event.data)));
        };
        return () => socket.close();
    }
    async searchSymbols(query) {
        const params = new URLSearchParams({ q: query });
        return this.requestJson(`/api/symbols/search/?${params}`);
    }
}
export function createRestAdapter(baseUrl = "") {
    return new DjangoVnstockAdapter(baseUrl);
}
