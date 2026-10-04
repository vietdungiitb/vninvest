/**
 * market.js
 *
 * Market data, alerts and intelligence serving endpoints for coreApiAdapter.
 */

export function createMarketClient({ coreGet, corePost }) {
  return {
    getRealtimeTickers(symbols) {
      if (!symbols || symbols.length === 0) return Promise.resolve({ data: {} });
      const symbolList = Array.isArray(symbols) ? symbols : [symbols];
      const q = symbolList.map((s) => encodeURIComponent(String(s).toUpperCase())).join(",");
      return coreGet(`/realtime/tickers/?symbols=${q}`).then((data) => ({ data }));
    },

    getRealtimeTicker(symbol) {
      if (!symbol) throw new Error("symbol is required for getRealtimeTicker");
      return coreGet(`/realtime/tickers/?symbols=${encodeURIComponent(symbol.toUpperCase())}`).then((data) => ({ data }));
    },

    /**
     * Get the latest SymbolSnapshot for a given symbol.
     * @param {string} symbol - Stock ticker (e.g. 'VCI')
     * @returns {Promise<object>}
     */
    getSymbolSnapshot(symbol) {
      if (!symbol) throw new Error("symbol is required for getSymbolSnapshot");
      return coreGet(`/symbol-snapshot/${encodeURIComponent(symbol.toUpperCase())}/`);
    },

    /**
     * Get SessionFacts (CVD, buy/institutional strength) for a symbol+date.
     * @param {string} symbol
     * @param {string} [date] - ISO date string YYYY-MM-DD; defaults to today
     * @returns {Promise<object>}
     */
    getSessionFacts(symbol, date) {
      if (!symbol) throw new Error("symbol is required for getSessionFacts");
      // T1.4 F-10: BE reads `trade_date` (market_serving/views.py:35-52), not `date`
      const query = date ? `?trade_date=${encodeURIComponent(date)}` : "";
      return coreGet(
        `/session-facts/${encodeURIComponent(symbol.toUpperCase())}/${query}`
      );
    },

    /**
     * List alert-center feed (main lane) with optional filters.
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date, timeframe, order, cursor, page_size
     * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
     */
    getAlertCenterFeed(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/alert-center/feed${query ? `?${query}` : ""}`);
    },

    /**
     * Get alert-center summary (main lane).
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date
     * @returns {Promise<object>}
     */
    getAlertCenterSummary(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/alert-center/summary${query ? `?${query}` : ""}`);
    },

    /**
     * Get alert-center symbol statistics (main lane).
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date, timeframe, page, page_size
     * @returns {Promise<object>}
     */
    getAlertCenterSymbolStats(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/alert-center/symbol-stats${query ? `?${query}` : ""}`);
    },

    /**
     * Get alert-center event detail by alert_id.
     * @param {string} alertId
     * @returns {Promise<object>}
     */
    getAlertCenterEventDetail(alertId, params = {}) {
      if (!alertId) throw new Error("alertId is required for getAlertCenterEventDetail");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/alert-center/events/${encodeURIComponent(alertId)}${query ? `?${query}` : ""}`);
    },

    /**
     * Get alert-center symbol context.
     * @param {string} symbol
     * @param {object} [params] - Optional filters like session_date
     * @returns {Promise<object>}
     */
    getAlertCenterSymbolContext(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getAlertCenterSymbolContext");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/alert-center/symbols/${encodeURIComponent(symbol.toUpperCase())}/context${query ? `?${query}` : ""}`);
    },

    /**
     * Acknowledge an alert-center event.
     * @param {string} alertId
     * @returns {Promise<object>}
     */
    acknowledgeAlertCenterEvent(alertId, params = {}) {
      if (!alertId) throw new Error("alertId is required for acknowledgeAlertCenterEvent");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return corePost(`/signals/alert-center/events/${encodeURIComponent(alertId)}/ack${query ? `?${query}` : ""}`);
    },

    /**
     * Mute alert-center preference by symbol/family scope.
     * @param {{symbol?: string, alert_family?: string, mute_minutes?: number, cooldown_seconds?: number, metadata?: object}} payload
     * @returns {Promise<object>}
     */
    muteAlertCenterPreference(payload = {}) {
      return corePost(`/signals/alert-center/preferences/mute`, payload);
    },

    /**
     * List AI Alerts lane feed with optional filters.
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date, cursor, page_size
     * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
     */
    getAIAlertsFeed(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/ai-alerts/feed${query ? `?${query}` : ""}`);
    },

    /**
     * Get AI Alerts summary (ai lane).
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date
     * @returns {Promise<object>}
     */
    getAIAlertsSummary(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/ai-alerts/summary${query ? `?${query}` : ""}`);
    },

    /**
     * Get AI Alerts symbol statistics (ai lane).
     * @param {object} [params] - Filters: symbol, alert_family, severity, session_date, timeframe, page, page_size
     * @returns {Promise<object>}
     */
    getAIAlertsSymbolStats(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/signals/ai-alerts/symbol-stats${query ? `?${query}` : ""}`);
    },

    /**
     * Get the portfolio news digest used by the legacy AI sidebar.
     * @param {object} [params]
     * @returns {Promise<object>}
     */
    getPortfolioNewsDigest(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/stock-management/portfolio/news-digest/${query ? `?${query}` : ""}`);
    },

    /**
     * List available symbols (with optional exchange/industry filter).
     * @param {object} [params] - exchange, industry, status, cursor
     * @returns {Promise<{results: object[], next: string|null}>}
     */
    getSymbolList(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/market-data/symbols/${query ? `?${query}` : ""}`);
    },

    /**
     * Get OHLCV daily prices for a symbol.
     * @param {string} symbol
     * @param {object} [params] - date_from, date_to, cursor
     * @returns {Promise<{results: object[]}>}
     */
    getDailyPrices(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getDailyPrices");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/market-data/daily-prices/${encodeURIComponent(symbol.toUpperCase())}/${query ? `?${query}` : ""}`
      );
    },

    /**
     * Get stock profile/metadata for a symbol.
     * @param {string} symbol
     * @returns {Promise<object>}
     */
    getStockProfile(symbol) {
      if (!symbol) throw new Error("symbol is required for getStockProfile");
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/`);
    },

    /**
     * Get stock overview (SSI iBoard details) for a symbol.
     * @param {string} symbol
     * @returns {Promise<object>}
     */
    getStockOverview(symbol) {
      if (!symbol) throw new Error("symbol is required for getStockOverview");
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/overview/`);
    },

    /**
     * Get stock chart history by timeframe.
     * @param {string} symbol
     * @param {{ timeframe?: string, days?: number }} [params]
     * @returns {Promise<object>}
     */
    getStockChartHistory(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getStockChartHistory");
      const timeframe = params.timeframe ?? "1H";
      const days = params.days ?? 180;
      const query = new URLSearchParams({
        timeframe: String(timeframe),
        days: String(days),
      }).toString();
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/chart/${query ? `?${query}` : ""}`);
    },

    /**
     * Get dark-money-history by interval/period.
     * @param {string} symbol
     * @param {{ interval?: string, period?: string }} [params]
     * @returns {Promise<object>}
     */
    getDarkMoneyHistory(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getDarkMoneyHistory");
      const interval = params.interval ?? "1D";
      const period = params.period ?? "3M";
      const query = new URLSearchParams({
        interval: String(interval),
        period: String(period),
      }).toString();
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/dark-money-history/${query ? `?${query}` : ""}`);
    },

    /**
     * Get stock order flow analytics (radar contract).
     * @param {string} symbol
     * @param {{ window?: string, limit?: number }} [params]
     * @returns {Promise<object>}
     */
    getStockOrderFlow(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getStockOrderFlow");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/order-flow/${query ? `?${query}` : ""}`
      );
    },

    /**
     * Get SessionFacts CVD series for a symbol.
     * @param {string} symbol
     * @param {object} [params] - window (5m, 15m, 30m, 1h), trade_date (YYYY-MM-DD)
     * @returns {Promise<object>}
     */
    getSessionFactsCvd(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getSessionFactsCvd");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/session-facts/${encodeURIComponent(symbol.toUpperCase())}/cvd${query ? `?${query}` : ""}`
      ).catch((err) => {
        if (err && err.status === 404) return null;
        throw err;
      });
    },

    /**
     * List OrderFlowEvent records for a symbol.
     * @param {string} symbol
     * @param {object} [params] - session_date, signal_type, cursor
     * @returns {Promise<{results: object[], next: string|null}>}
     */
    getOrderFlowEvents(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getOrderFlowEvents");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/signals/order-flow/${encodeURIComponent(symbol.toUpperCase())}/${query ? `?${query}` : ""}`
      );
    },

    /**
     * Get bulk technicals for an explicit list of symbols.
     * Calls the native core route /core/v1/market-data/technicals/bulk/.
     * @param {string[]} symbols
     * @returns {Promise<object[]>}
     */
    getBulkTechnicalsBySymbols(symbols) {
      if (!symbols || symbols.length === 0) return Promise.resolve([]);
      const q = symbols.map((s) => encodeURIComponent(String(s).toUpperCase())).join(",");
      return coreGet(`/market-data/technicals/bulk/?symbols=${q}`);
    },

    /**
     * Get a facts-first whale analytics snapshot for one symbol.
     * Calls the native core route /core/v1/workspace/whale-analytics/{symbol}/.
     * @param {string} symbol
     * @param {{ timeframe?: string, compact?: number, tradeDate?: string|null, includeBaseline?: boolean }} [options]
     * @returns {Promise<object>}
     */
    getWhaleAnalyticsSnapshot(symbol, { timeframe = "session", compact = 1, tradeDate, includeBaseline } = {}) {
      if (!symbol) throw new Error("symbol is required for getWhaleAnalyticsSnapshot");
      const params = new URLSearchParams();
      params.set("timeframe", String(timeframe || "session"));
      if (compact !== undefined && compact !== null) {
        params.set("compact", String(compact));
      }
      if (tradeDate) {
        params.set("trade_date", String(tradeDate).slice(0, 10));
      }
      if (includeBaseline !== undefined) {
        params.set("include_baseline", includeBaseline ? "1" : "0");
      }
      const query = params.toString();
      return coreGet(`/workspace/whale-analytics/${encodeURIComponent(String(symbol).toUpperCase())}/${query ? `?${query}` : ""}`);
    },

    /**
     * Get realtime order book depth (Market Depth) for a symbol.
     * Calls the native core route /core/v1/realtime/depth-chart/{symbol}/.
     * @param {string} symbol
     * @returns {Promise<object>}
     */
    getRealtimeDepthChart(symbol) {
      if (!symbol) throw new Error("symbol is required for getRealtimeDepthChart");
      return coreGet(`/realtime/depth-chart/${encodeURIComponent(String(symbol).toUpperCase())}/`);
    },

    /**
     * Get realtime intraday trades (Trade Log) for a symbol.
     * Calls the native core route /core/v1/realtime/intraday/{symbol}/.
     * @param {string} symbol
     * @param {object} [params] - page_size, etc.
     * @returns {Promise<object>}
     */
    getRealtimeIntraday(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getRealtimeIntraday");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/realtime/intraday/${encodeURIComponent(String(symbol).toUpperCase())}/${query ? `?${query}` : ""}`);
    },

    /**
     * Get whale feed aggregate for a symbol.
     * Calls the native core route /core/v1/realtime/whale-feed-aggregate/{symbol}/.
     * @param {string} symbol
     * @param {object} [params] - session_date, limit, sort, window
     * @returns {Promise<object>}
     */
    getWhaleFeedAggregate(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getWhaleFeedAggregate");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/realtime/whale-feed-aggregate/${encodeURIComponent(String(symbol).toUpperCase())}/${query ? `?${query}` : ""}`);
    },

    /**
     * Get watchlist-backed market groups used for symbol universe construction.
     * Keeps the legacy method name so existing callers can migrate without churn.
     * @returns {Promise<{results: object[]}>}
     */
    getLegacyWatchlistGroups() {
      return coreGet("/stock-management/groups/?include_prices=0");
    },

    /**
     * Get the latest advisory for a symbol on a given session date.
     * @param {string} symbol
     * @param {string} [date] - ISO date YYYY-MM-DD; defaults to today
     * @returns {Promise<object>}
     */
    getAdvisoryLatest(symbol, date) {
      if (!symbol) throw new Error("symbol is required for getAdvisoryLatest");
      const query = date ? `?date=${encodeURIComponent(date)}` : "";
      return coreGet(`/advisory/latest/${encodeURIComponent(symbol.toUpperCase())}/${query}`).catch(
        (err) => {
          if (err && err.status === 404) return null;
          throw err;
        }
      );
    },

    /**
     * Request an advisory refresh/generation for a symbol.
     * @param {string} symbol
     * @param {object} [promptConfig] - Optional client prompt config configuration.
     * @returns {Promise<object>}
     */
    refreshAdvisory(symbol, promptConfig) {
      if (!symbol) throw new Error("symbol is required for refreshAdvisory");
      return corePost(
        `/advisory/refresh/${encodeURIComponent(symbol.toUpperCase())}/`,
        promptConfig ? { prompt_config: promptConfig } : {}
      );
    },

    /**
     * Get advisory history for a symbol.
     * @param {string} symbol
     * @param {object} [params] - cursor, session_date
     * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
     */
    getAdvisoryHistory(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getAdvisoryHistory");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/advisory/history/${encodeURIComponent(symbol.toUpperCase())}/${query ? `?${query}` : ""}`
      ).catch((err) => {
        if (err && err.status === 404) return { results: [], next: null, previous: null };
        throw err;
      });
    },

    /**
     * Get stock news feed for a symbol.
     * GET /core/v1/stock-management/stocks/{symbol}/news/
     * @param {string} symbol
     * @param {object} [params]
     * @returns {Promise<{results: object[]}>}
     */
    getStockNews(symbol, params = {}) {
      if (!symbol) throw new Error("symbol is required for getStockNews");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/news/${query ? `?${query}` : ""}`);
    },

    /**
     * Get stock financial details/indicators for a symbol.
     * GET /core/v1/stock-management/stocks/{symbol}/financials/
     * @param {string} symbol
     * @returns {Promise<object>}
     */
    getStockFinancials(symbol) {
      if (!symbol) throw new Error("symbol is required for getStockFinancials");
      return coreGet(`/stock-management/stocks/${encodeURIComponent(symbol.toUpperCase())}/financials/`);
    },

    /**
     * Trigger admin market groups sync.
     * POST /core/v1/market-data/admin-groups/sync/
     * @param {string} [mode] - 'active' (default) or 'all'
     * @returns {Promise<object>}
     */
    syncAdminMarketGroups(mode = "active") {
      return corePost(`/market-data/admin-groups/sync/`, { mode });
    },

    /**
     * Get market groups sync task status.
     * GET /core/v1/data-ingest/task-status/{taskId}/
     * @param {string} taskId
     * @returns {Promise<object>}
     */
    getMarketGroupsSyncStatus(taskId) {
      if (!taskId) throw new Error("taskId is required for getMarketGroupsSyncStatus");
      return coreGet(`/data-ingest/task-status/${encodeURIComponent(taskId)}/`);
    },

    /**
     * Preview admin market groups sync (dry run).
     * GET /core/v1/market-data/admin-groups/preview/
     * @returns {Promise<object>}
     */
    previewAdminMarketGroups() {
      return coreGet(`/market-data/admin-groups/preview/`);
    },

    /**
     * Seed system default groups (VN30, VN100).
     * POST /core/v1/market-data/system-defaults/seed/
     * @returns {Promise<object>}
     */
    seedSystemDefaults() {
      return corePost(`/market-data/system-defaults/seed/`);
    },

getWhaleFeed(symbol) {
      if (!symbol) throw new Error("symbol is required for getWhaleFeed");
      return coreGet(`/realtime/whale-feed/${encodeURIComponent(symbol.toUpperCase())}/`);
    },
  };
}