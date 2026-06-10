/**
 * WP-04: VNInvestDataAdapter
 *
 * Implements `StockDataAdapter` interface, wrapping VNInvestClient (REST)
 * and VNInvestWebSocketClient (WebSocket) into a single cohesive adapter.
 *
 * This is the OPTIONAL subpath import — NOT bundled in core IIFE.
 * Usage:
 *   import { VNInvestDataAdapter } from 'vninvestcharts/adapters';
 */
import { VNInvestClient } from "./VNInvestClient.js";
import { VNInvestWebSocketClient } from "./VNInvestWebSocketClient.js";
const PAGE_LIMIT = 1000;
/**
 * Full-featured data adapter for the VNInvest platform.
 *
 * Implements:
 *   - fetchBarsInRange / fetchBarsBefore (cursor-paged /bars/ endpoint)
 *   - subscribeToBar (WebSocket ticker_update)
 *   - searchSymbols (GET /stocks/)
 *
 * Not implemented (VNInvest does not provide these endpoints):
 *   - subscribeToTrades → returns no-op unsubscribe
 *   - subscribeToOrderbook → returns no-op unsubscribe
 */
export class VNInvestDataAdapter {
    name = "vninvest";
    client;
    wsClient = null;
    barSubscribers = new Map();
    snapshotIds = new Map();
    lastBackfillCoverage = null;
    lastRangeCoverage = null;
    constructor(config) {
        this.client = new VNInvestClient(config.patToken);
        if (config.apiBase) {
            this.client.setBase(config.apiBase);
        }
    }
    getSourceSemantics() {
        return {
            sourceId: this.name,
            sourceContractVersion: "vninvest-backfill-v1",
            instrumentClass: "equity",
            coverageMode: "exact-range",
            sessionModel: "exchange-calendar",
            timezone: "Asia/Ho_Chi_Minh",
            sessionCalendarId: "vn-exchange-calendar",
            supportsExactRangeFetch: true,
            supportsBackwardAnchor: true,
            supportsForwardAnchor: false,
            supportsLiveBars: true,
            maxBarsPerRequest: PAGE_LIMIT,
            finalityMode: "historically-correctable",
            correctionLookbackMs: 30 * 86_400_000,
            expectedGapReasons: ["not-fetched", "market-closed", "source-no-data", "rate-limited", "boundary-exhausted"],
        };
    }
    getLastBackfillCoverage() {
        return this.lastBackfillCoverage;
    }
    getLastRangeCoverage() {
        return this.lastRangeCoverage;
    }
    /** Expose the underlying REST client for advanced use cases. */
    get restClient() {
        return this.client;
    }
    /**
     * Fetch bars in a date range.
     * Uses the cursor-paged /bars/ endpoint with backward pagination.
     */
    async fetchBarsInRange(symbol, timeframe, from, to) {
        const allBars = [];
        // Initial forward fetch from "to" backwards
        const initParams = {
            type: "init",
            symbol,
            timeframe,
            from: from.valueOf(),
            to: to.valueOf(),
            limit: PAGE_LIMIT,
        };
        const page = await this.client.getBarsPage(initParams);
        const key = `${symbol.toUpperCase()}:${timeframe}`;
        if (page.snapshotId) {
            this.snapshotIds.set(key, page.snapshotId);
        }
        const bars = sortBarsByDate(pageToOHLCV(page.bars));
        allBars.push(...bars);
        if (bars.length === 0) {
            this.lastRangeCoverage = [
                { fromTs: from.valueOf(), toTs: to.valueOf(), status: "unresolved", reason: "source-no-data" }
            ];
        }
        else {
            const oldestTs = bars[0].date.getTime();
            const newestTs = bars[bars.length - 1].date.getTime();
            const covered = { fromTs: oldestTs, toTs: newestTs, status: "covered" };
            if (!page.hasMoreBefore) {
                this.lastRangeCoverage = [
                    { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
                    covered,
                ];
            }
            else {
                this.lastRangeCoverage = [covered];
            }
        }
        return allBars;
    }
    /**
     * Fetch bars before a given anchor date (backward pagination).
     */
    async fetchBarsBefore(symbol, timeframe, before, limit = PAGE_LIMIT) {
        const key = `${symbol.toUpperCase()}:${timeframe}`;
        const snapshotId = this.snapshotIds.get(key);
        const params = {
            type: "backward",
            symbol,
            timeframe,
            before: before.valueOf(),
            limit,
            snapshotId,
        };
        const page = await this.client.getBarsPage(params);
        if (page.snapshotId) {
            this.snapshotIds.set(key, page.snapshotId);
        }
        const bars = sortBarsByDate(pageToOHLCV(page.bars));
        if (bars.length === 0) {
            this.lastBackfillCoverage = [
                { fromTs: 0, toTs: before.valueOf(), status: "unresolved", reason: "boundary-exhausted" }
            ];
        }
        else {
            const oldestTs = bars[0].date.getTime();
            const newestTs = bars[bars.length - 1].date.getTime();
            const covered = { fromTs: oldestTs, toTs: newestTs, status: "covered" };
            if (!page.hasMoreBefore) {
                this.lastBackfillCoverage = [
                    { fromTs: 0, toTs: oldestTs, status: "unresolved", reason: "boundary-exhausted" },
                    covered,
                ];
            }
            else {
                this.lastBackfillCoverage = [covered];
            }
        }
        return bars;
    }
    /**
     * Subscribe to real-time bar updates via WebSocket.
     * Maps ticker_update events to OHLCVBar callbacks.
     */
    subscribeToBar(symbol, timeframe, onBar) {
        const key = `${symbol.toUpperCase()}:${timeframe}`;
        if (!this.wsClient) {
            this.wsClient = new VNInvestWebSocketClient(this.client.getPAT(), this.client.getBase());
            this.wsClient.setOnTickerUpdate(this.handleTickerUpdate.bind(this));
            this.wsClient.connect();
        }
        if (!this.barSubscribers.has(key)) {
            this.barSubscribers.set(key, new Set());
            this.wsClient.subscribe([symbol.toUpperCase()]);
        }
        this.barSubscribers.get(key).add(onBar);
        return () => {
            const subs = this.barSubscribers.get(key);
            if (subs) {
                subs.delete(onBar);
                if (subs.size === 0) {
                    this.barSubscribers.delete(key);
                    this.wsClient?.unsubscribe([symbol.toUpperCase()]);
                }
            }
        };
    }
    /** Not supported by VNInvest — returns no-op. */
    subscribeToTrades(_symbol, _onTrade) {
        return () => { };
    }
    /** Not supported by VNInvest — returns no-op. */
    subscribeToOrderbook(_symbol, _onUpdate) {
        return () => { };
    }
    /** Search symbols via GET /stocks/ endpoint. */
    async searchSymbols(query) {
        const items = await this.client.getStocks(query);
        return items.map((item) => ({
            symbol: item.symbol,
            name: item.company_name,
            exchange: item.exchange,
        }));
    }
    /** Clean up: destroy WebSocket connection. */
    destroy() {
        this.wsClient?.destroy();
        this.wsClient = null;
        this.barSubscribers.clear();
    }
    handleTickerUpdate(event) {
        const symbolUpper = event.symbol.toUpperCase();
        for (const [key, subs] of this.barSubscribers.entries()) {
            if (key.startsWith(`${symbolUpper}:`)) {
                // Map ticker update to a minimal OHLCVBar
                const bar = {
                    date: new Date(event.ts),
                    open: event.price,
                    high: event.price,
                    low: event.price,
                    close: event.current_price,
                    volume: event.volume,
                    index: event.seq,
                    dataIndex: event.seq,
                };
                for (const cb of subs) {
                    cb(bar);
                }
            }
        }
    }
}
function pageToOHLCV(bars) {
    return bars.map((bar, index) => ({
        date: bar.date,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        index,
        dataIndex: index,
    }));
}
function sortBarsByDate(bars) {
    return bars.sort((a, b) => a.date.valueOf() - b.date.valueOf());
}
