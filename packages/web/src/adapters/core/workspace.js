/**
 * workspace.js
 *
 * User workspace (Portfolios, Watchlists, Price Alerts, Tracked Symbols), DNSE integrations,
 * and Operator mail configuration endpoints for coreApiAdapter.
 */

export function createWorkspaceClient({ coreGet, corePost, corePut, corePatch, coreDelete }) {
  /**
   * Sinh `Idempotency-Key` mới cho mỗi lần bấm đặt lệnh.
   *
   * BE so sánh fingerprint của payload với key đã claim: cùng key + cùng payload ⇒
   * replay trả kết quả cũ; cùng key + khác payload ⇒ `idempotency_key_conflict`.
   * Vì vậy KHÔNG cache key theo symbol hay theo form — phải mới mỗi lần submit.
   */
  function newOrderIdempotencyKey() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `dnse-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }

  /** `mode` bắt buộc cho cả 3 endpoint DNSE (SAFE-01 fail-closed). */
  function resolveDnseMode(data) {
    const mode = (data && data.mode) || "paper";
    if (mode !== "paper" && mode !== "live") {
      throw new Error(`mode "${mode}" không hợp lệ. Chỉ nhận "paper" hoặc "live".`);
    }
    return mode;
  }

  return {
    /**
     * List portfolios for the authenticated user.
     * @returns {Promise<{results: object[]}>}
     */
    getPortfolios() {
      return coreGet("/workspace/portfolios/");
    },

    /**
     * Create a new portfolio.
     * @param {{ name: string, description?: string }} data
     * @returns {Promise<object>}
     */
    createPortfolio(data) {
      return corePost("/workspace/portfolios/", data);
    },

    /**
     * Update an existing portfolio.
     * @param {number|string} portfolioId
     * @param {{ name?: string, description?: string }} data
     * @returns {Promise<object>}
     */
    updatePortfolio(portfolioId, data) {
      return corePatch(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/`, data);
    },

    /**
     * Delete a portfolio.
     * @param {number|string} portfolioId
     * @returns {Promise<void>}
     */
    deletePortfolio(portfolioId) {
      return coreDelete(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/`);
    },

    /**
     * List watchlists for the authenticated user.
     * @returns {Promise<{results: object[]}>}
     */
    getWatchlists() {
      return coreGet("/workspace/watchlists/");
    },

    /**
     * Create a watchlist.
     * @param {{ name: string, description?: string }} data
     * @returns {Promise<object>}
     */
    createWatchlist(data) {
      return corePost("/workspace/watchlists/", data);
    },

    /**
     * Update a watchlist (rename or update description).
     * @param {number|string} watchlistId
     * @param {{ name?: string, description?: string }} data
     * @returns {Promise<object>}
     */
    updateWatchlist(watchlistId, data) {
      if (!watchlistId) throw new Error("watchlistId is required for updateWatchlist");
      return corePatch(`/workspace/watchlists/${encodeURIComponent(watchlistId)}/`, data);
    },

    /**
     * Delete a watchlist.
     * @param {number|string} watchlistId
     * @returns {Promise<void>}
     */
    deleteWatchlist(watchlistId) {
      if (!watchlistId) throw new Error("watchlistId is required for deleteWatchlist");
      return coreDelete(`/workspace/watchlists/${encodeURIComponent(watchlistId)}/`);
    },

    /**
     * List items in a watchlist.
     * @param {number|string} watchlistId
     * @returns {Promise<{results: object[]}>}
     */
    getWatchlistItems(watchlistId) {
      if (!watchlistId) throw new Error("watchlistId is required for getWatchlistItems");
      return coreGet(`/workspace/watchlists/${encodeURIComponent(watchlistId)}/items/`);
    },

    /**
     * Add a symbol to a watchlist.
     * @param {number|string} watchlistId
     * @param {string} symbol
     * @returns {Promise<object>}
     */
    addWatchlistItem(watchlistId, symbol) {
      return corePost(`/workspace/watchlists/${encodeURIComponent(watchlistId)}/items/`, { symbol });
    },

    /**
     * Remove a symbol from a watchlist.
     * @param {number|string} watchlistId
     * @param {string} symbol
     * @returns {Promise<void>}
     */
    removeWatchlistItem(watchlistId, symbol) {
      return coreDelete(
        `/workspace/watchlists/${encodeURIComponent(watchlistId)}/items/${encodeURIComponent(symbol)}/`
      );
    },

    /**
     * List transactions for a portfolio.
     * @param {number|string} portfolioId
     * @param {object} [params] - symbol, date_from, date_to, cursor
     * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
     */
    getTransactions(portfolioId, params = {}) {
      if (!portfolioId) throw new Error("portfolioId is required for getTransactions");
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(
        `/workspace/portfolios/${encodeURIComponent(portfolioId)}/transactions/${query ? `?${query}` : ""}`
      );
    },

    /**
     * Create a transaction in a portfolio.
     * @param {number|string} portfolioId
     * @param {{ symbol: string, transaction_type: string, date: string, price: number, quantity: number, fee?: number }} data
     * @returns {Promise<object>}
     */
    createTransaction(portfolioId, data) {
      return corePost(
        `/workspace/portfolios/${encodeURIComponent(portfolioId)}/transactions/`,
        data
      );
    },

    /**
     * Get current holdings for a portfolio.
     * @param {number|string} portfolioId
     * @returns {Promise<{results: object[]}>}
     */
    getPortfolioHoldings(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioHoldings");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/holdings/`);
    },

    /**
     * Get portfolio summary (P&L, market value, cost basis).
     * @param {number|string} portfolioId
     * @returns {Promise<object>}
     */
    getPortfolioSummary(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioSummary");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/summary/`);
    },

    /**
     * Get portfolio performance analytics.
     * @param {number|string} portfolioId
     * @param {number} [days=30]
     * @returns {Promise<object>}
     */
    getPortfolioAnalytics(portfolioId, days = 30) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioAnalytics");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/analytics/?days=${days}`);
    },

    /**
     * S-00a - daily NAV history (duong cong van gia).
     *
     * Backend tra `{portfolio_id, curve: [{date, nav, nav_reason, missing_symbols}]}`.
     * `nav` la `null` + `nav_reason` khi ngay do thieu gia cho it nhat ma nao -
     * KHONG coi la 0 (LED-03 AC4).
     * @returns {Promise<{portfolio_id: number, curve: object[]}>}
     */
    getPortfolioEquityCurve(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioEquityCurve");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/equity-curve/`);
    },

    /**
     * S-00a - phan bo theo ma (weight_pct). Moi row co them `industry` tu S-00c
     * de FE group-by sector ma khong can goi them endpoint.
     * @returns {Promise<{portfolio_id: number, total_value: string|null, allocation: object[]}>}
     */
    getPortfolioAllocation(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioAllocation");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/allocation/`);
    },

    /**
     * S-00a - alias cua `equity-curve` (`PortfolioChartView` goi thang
     * `PortfolioEquityCurveView().get(...)`). Giu de khong pha client cu; code
     * moi DUNG `getPortfolioEquityCurve`.
     * @returns {Promise<{portfolio_id: number, curve: object[]}>}
     */
    getPortfolioChart(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioChart");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/chart/`);
    },

    /**
     * S-00b - chi so THAT: performance / risk / benchmark / freshness.
     *
     * ⚠ Doc contract truoc khi ve chart: khi thieu du lieu moi nhom la `null`
     * **kem** `<nhom>_reason`. Backend KHONG tinh `sharpe`/`sortino`/
     * `correlation` nen response khong co 3 key do - FE KHONG duoc ve card
     * cho chung. Mot so = 0 o day co nghia la 0 that, khong phai "chua co".
     * @returns {Promise<{performance: object|null, risk: object|null, benchmark: object|null, freshness: object|null}>}
     */
    getPortfolioMetrics(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioMetrics");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/metrics/`);
    },

    /**
     * Get technicals for all holdings in a portfolio.
     * @param {number|string} portfolioId
     * @returns {Promise<{results: object[]}>}
     */
    getPortfolioTechnicals(portfolioId) {
      if (!portfolioId) throw new Error("portfolioId is required for getPortfolioTechnicals");
      return coreGet(`/workspace/portfolios/${encodeURIComponent(portfolioId)}/technicals/`);
    },

    /**
     * Get the list of symbols tracked by the current user.
     * @returns {Promise<{results: object[]}>}
     */
    getTrackedSymbols() {
      return coreGet("/stock-management/tracked-symbols/");
    },

    /**
     * Add a tracked symbol for the authenticated user.
     * POST /core/v1/stock-management/tracked-symbols/
     * @param {string} symbol
     * @param {number|string} sourceGroupId
     * @param {number} whaleAlertThresholdMillion
     * @returns {Promise<object>}
     */
    addTrackedSymbol(symbol, sourceGroupId, whaleAlertThresholdMillion) {
      if (!symbol) throw new Error("symbol is required for addTrackedSymbol");
      return corePost("/stock-management/tracked-symbols/", {
        symbol: symbol.toUpperCase(),
        source_group_id: sourceGroupId,
        whale_alert_threshold_million: whaleAlertThresholdMillion,
      });
    },

    /**
     * Remove a tracked symbol.
     * DELETE /core/v1/stock-management/tracked-symbols/{id}/
     * @param {number|string} id
     * @returns {Promise<void>}
     */
    removeTrackedSymbol(id) {
      if (!id) throw new Error("id is required for removeTrackedSymbol");
      return coreDelete(`/stock-management/tracked-symbols/${encodeURIComponent(id)}/`);
    },

    /**
     * Update a tracked symbol's alert threshold.
     * @param {number|string} id
     * @param {number} whaleAlertThresholdMillion
     * @returns {Promise<object>}
     */
    updateTrackedSymbol(id, whaleAlertThresholdMillion) {
      if (!id) throw new Error("id is required for updateTrackedSymbol");
      return corePatch(`/stock-management/tracked-symbols/${encodeURIComponent(id)}/`, {
        whale_alert_threshold_million: whaleAlertThresholdMillion,
      });
    },

    /**
     * Get price alerts for the authenticated user.
     * GET /core/v1/stock-management/price-alerts/
     * @param {object} [params] - Filters: symbol, cursor, page_size
     * @returns {Promise<{results: object[], next: string|null}>}
     */
    getPriceAlerts(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/stock-management/price-alerts/${query ? `?${query}` : ""}`);
    },

    /**
     * Create a price alert.
     * POST /core/v1/stock-management/price-alerts/
     * @param {{ symbol: string, condition: string, target_price: number, cooldown_seconds: number, is_active: boolean }} payload
     * @returns {Promise<object>}
     */
    createPriceAlert(payload) {
      if (!payload || !payload.symbol) throw new Error("symbol is required in price alert payload");
      return corePost("/stock-management/price-alerts/", {
        ...payload,
        symbol: payload.symbol.toUpperCase(),
      });
    },

    /**
     * Update a price alert.
     * PATCH /core/v1/stock-management/price-alerts/{id}/
     * @param {number|string} id
     * @param {object} payload
     * @returns {Promise<object>}
     */
    updatePriceAlert(id, payload) {
      if (!id) throw new Error("id is required for updatePriceAlert");
      return corePatch(`/stock-management/price-alerts/${encodeURIComponent(id)}/`, payload);
    },

    /**
     * Delete a price alert.
     * DELETE /core/v1/stock-management/price-alerts/{id}/
     * @param {number|string} id
     * @returns {Promise<void>}
     */
    deletePriceAlert(id) {
      if (!id) throw new Error("id is required for deletePriceAlert");
      return coreDelete(`/stock-management/price-alerts/${encodeURIComponent(id)}/`);
    },

    // ─── DNSE LightSpeed API Broker Integration ───────────────────────────────

    /**
     * Lấy trạng thái cấu hình DNSE LightSpeed của user hiện tại (B1.2: store UserBrokerConfig mới).
     * @returns {Promise<{ is_configured: boolean, status?: string, preview?: object, last_verified_at?: string|null }>}
     */
    getDNSEConfig() {
      return coreGet("/broker/dnse/config/");
    },

    /**
     * Cập nhật DNSE LightSpeed credential (client_id + client_secret) — B1.2 backend mới.
     * @param {{ client_id: string, client_secret: string, is_active?: boolean }} data
     * @returns {Promise<{ ok: boolean, is_configured: boolean, preview?: object }>}
     */
    updateDNSEConfig(data) {
      if (!data.client_id || !data.client_secret) {
        throw new Error("client_id và client_secret là bắt buộc cho DNSE LightSpeed API.");
      }
      return corePost("/broker/dnse/config/", data);
    },

    /**
     * Xoá cấu hình DNSE LightSpeed của user hiện tại.
     * @returns {Promise<{ ok: boolean }>}
     */
    deleteDNSEConfig() {
      return coreDelete("/broker/dnse/config/");
    },

    /**
     * Kích hoạt đồng bộ tiểu khoản từ DNSE LightSpeed API.
     * @returns {Promise<{ ok: boolean, synced_count: number, accounts: object[] }>}
     */
    syncDNSEAccounts() {
      return corePost("/broker/dnse/sync-accounts/");
    },

    /**
     * Đồng bộ số dư/NAV cho các tiểu khoản DNSE đã liên kết.
     * @returns {Promise<{ ok: boolean, synced_count: number, date?: string }>}
     */
    syncDNSEBalances() {
      return corePost("/broker/dnse/sync-balances/");
    },

    /**
     * Đối soát giao dịch DNSE trong khoảng ngày gần đây.
     * @param {{ days_back?: number }} [params]
     * @returns {Promise<{ ok: boolean, synced_count: number }>}
     */
    reconcileDNSETransactions(params = {}) {
      return corePost("/broker/dnse/reconcile-transactions/", params);
    },

    /**
     * Gửi OTP email cho phiên giao dịch DNSE.
     *
     * BE (`views_dnse.py:dnse_send_email_otp_api`) cũng gọi `_resolve_order_mode` nên
     * thiếu `mode` ⇒ 400 `order_mode_required`. `dry_run` boolean đã bị BE từ chối.
     *
     * @param {{ mode?: 'paper'|'live' }} [params]
     */
    sendDNSEEmailOtp(params = {}) {
      return corePost("/broker/dnse/send-email-otp/", { ...params, mode: resolveDnseMode(params) });
    },

    /**
     * Tạo trading token DNSE từ OTP/passcode.
     *
     * BE (`views_dnse.py:dnse_create_trading_token_api`) cũng cần `mode`.
     *
     * @param {{ otp_type?: string, passcode: string, mode?: 'paper'|'live' }} data
     */
    createDNSETradingToken(data) {
      if (!data || !data.passcode) {
        throw new Error("passcode là bắt buộc để tạo trading token DNSE.");
      }
      return corePost("/broker/dnse/create-trading-token/", { ...data, mode: resolveDnseMode(data) });
    },

    /**
     * Đặt lệnh DNSE với trading token hợp lệ.
     *
     * BE (`views_dnse.py`) fail-closed từ SAFE-01: `mode` bắt buộc trong body và
     * `Idempotency-Key` bắt buộc là **header**. Thiếu một trong hai ⇒ 400
     * (`order_mode_required` / `idempotency_key_required`). FE chỉ gửi
     * `mode: 'paper'`; `live` bị từ chối với `live_ordering_disabled` cho tới khi
     * có policy + OTP + risk limit + commercial license.
     *
     * `idempotencyKey` phải MỚI cho mỗi lần bấm đặt lệnh. Dùng lại key cũ với
     * payload khác ⇒ `idempotency_key_conflict`; dùng lại key cũ với payload
     * giống ⇒ trả lại kết quả cũ (replay) thay vì đặt lệnh hai lần.
     *
     * @param {{ market_type?: string, order_category?: string, trading_token: string, payload: object, mode?: 'paper'|'live' }} data
     * @param {{ idempotencyKey?: string }} [options]
     */
    placeDNSEOrder(data, options = {}) {
      if (!data || !data.trading_token) {
        throw new Error("trading_token là bắt buộc để đặt lệnh DNSE.");
      }
      if (!data.payload || typeof data.payload !== "object") {
        throw new Error("payload đặt lệnh DNSE không hợp lệ.");
      }
      const mode = resolveDnseMode(data);
      const idempotencyKey = (options.idempotencyKey || newOrderIdempotencyKey()).trim();
      return corePost(
        "/broker/dnse/place-order/",
        { market_type: "STOCK", order_category: "NORMAL", ...data, mode },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
    },

    /**
     * @returns {Promise<{ ok: boolean, is_configured: boolean, is_active: boolean }>}
     */
    getDNSETokenStatus() {
      return coreGet("/broker/dnse/token-status/");
    },

    // --- OPERATOR MAIL CONFIGURATIONS ---

    getOperatorMailConfigs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
      ).toString();
      return coreGet(`/operator/mail-configs/${query ? `?${query}` : ""}`);
    },

    getOperatorMailConfigDetail(id) {
      if (!id) throw new Error("id is required");
      return coreGet(`/operator/mail-configs/${encodeURIComponent(id)}/`);
    },

    createOperatorMailConfig(data) {
      return corePost("/operator/mail-configs/", data);
    },

    updateOperatorMailConfig(id, data) {
      if (!id) throw new Error("id is required");
      return corePatch(`/operator/mail-configs/${encodeURIComponent(id)}/`, data);
    },

    deleteOperatorMailConfig(id) {
      if (!id) throw new Error("id is required");
      return coreDelete(`/operator/mail-configs/${encodeURIComponent(id)}/`);
    },

    activateOperatorMailConfig(id) {
      if (!id) throw new Error("id is required");
      return corePost(`/operator/mail-configs/${encodeURIComponent(id)}/activate/`, {});
    },

    testOperatorMailConfig(data) {
      return corePost("/operator/mail-configs/test/", data);
    },

    // ─── Tracked Symbol Bulk Operations ─────────────────────────────────────

    bulkUpdateTrackedSymbolThreshold(trackedSymbolIds, whaleAlertThresholdMillion) {
      if (!trackedSymbolIds || trackedSymbolIds.length === 0) {
        throw new Error("trackedSymbolIds is required for bulkUpdateTrackedSymbolThreshold");
      }
      return corePost("/stock-management/tracked-symbols/bulk-threshold/", {
        tracked_symbol_ids: trackedSymbolIds,
        whale_alert_threshold_million: whaleAlertThresholdMillion,
      });
    },

    deleteTrackedSymbol(id) {
      if (!id) throw new Error("id is required for deleteTrackedSymbol");
      return coreDelete(`/stock-management/tracked-symbols/${encodeURIComponent(id)}/`);
    },

    markPriceAlertTriggered(id) {
      if (!id) throw new Error("id is required for markPriceAlertTriggered");
      return corePost(`/stock-management/price-alerts/${encodeURIComponent(id)}/mark-triggered/`);
    },

    // ─── SubAccounts API ─────────────────────────────────────────────────────

    getSubAccounts() {
      return coreGet("/portfolio/subaccounts/");
    },

    createSubAccount(data) {
      return corePost("/portfolio/subaccounts/", data);
    },

    updateSubAccount(subAccountId, data) {
      if (!subAccountId) throw new Error("subAccountId is required for updateSubAccount");
      return corePatch(`/portfolio/subaccounts/${encodeURIComponent(subAccountId)}/`, data);
    },

    deleteSubAccount(subAccountId) {
      if (!subAccountId) throw new Error("subAccountId is required for deleteSubAccount");
      return coreDelete(`/portfolio/subaccounts/${encodeURIComponent(subAccountId)}/`);
    },

    getSubAccountTransactions(subAccountId) {
      if (!subAccountId) throw new Error("subAccountId is required for getSubAccountTransactions");
      return coreGet(`/portfolio/subaccounts/${encodeURIComponent(subAccountId)}/transactions/`);
    },

    createSubAccountTransaction(subAccountId, data) {
      if (!subAccountId) throw new Error("subAccountId is required for createSubAccountTransaction");
      return corePost(`/portfolio/subaccounts/${encodeURIComponent(subAccountId)}/transactions/`, data);
    },

    // ─── Screener Rules API ──────────────────────────────────────────────────

    getScreenerRules() {
      return coreGet("/screener/rules/");
    },

    createScreenerRule(data) {
      return corePost("/screener/rules/", data);
    },

    updateScreenerRule(ruleId, data) {
      if (!ruleId) throw new Error("ruleId is required for updateScreenerRule");
      return corePut(`/screener/rules/${encodeURIComponent(ruleId)}/`, data);
    },

    deleteScreenerRule(ruleId) {
      if (!ruleId) throw new Error("ruleId is required for deleteScreenerRule");
      return coreDelete(`/screener/rules/${encodeURIComponent(ruleId)}/`);
    },

    // P1.1: optional server scan params {sort, order, page, limit, include_ai}
    // are sent as querystring (POST body stays {}).
    runScreenerRule(ruleId, params = {}) {
      if (!ruleId) throw new Error("ruleId is required for runScreenerRule");
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      const url = `/screener/rules/${encodeURIComponent(ruleId)}/run/${qs ? `?${qs}` : ""}`;
      return corePost(url, {});
    },

    getScreenerRunStatus(ruleId, jobId) {
      if (!ruleId) throw new Error("ruleId is required for getScreenerRunStatus");
      if (!jobId) throw new Error("jobId is required for getScreenerRunStatus");
      return coreGet(`/screener/rules/${encodeURIComponent(ruleId)}/run/status/?job_id=${encodeURIComponent(jobId)}`);
    },

    getScreenerTemplates() {
      return coreGet("/screener/templates/");
    },

    // P2.3: server history (Q5, D10) — fallback to localStorage when unavailable
    getScreenerHistory(params = {}) {
      const qs = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&");
      return coreGet(`/screener/history/${qs ? `?${qs}` : ""}`);
    },

    getScreenerHistoryBacktest(historyId, horizon = 5) {
      if (!historyId) throw new Error("historyId is required for getScreenerHistoryBacktest");
      return coreGet(`/screener/history/${encodeURIComponent(historyId)}/backtest/?horizon=${encodeURIComponent(String(horizon))}`);
    },

    deleteScreenerHistory(historyId) {
      if (!historyId) throw new Error("historyId is required for deleteScreenerHistory");
      return coreDelete(`/screener/history/${encodeURIComponent(historyId)}/`);
    },

    clearScreenerHistory() {
      return coreDelete("/screener/history/");
    },

    // P2.4: schedules (Q6, D11)
    getScreenerSchedules() {
      return coreGet("/screener/schedules/");
    },

    createScreenerSchedule(data) {
      return corePost("/screener/schedules/", data);
    },

    updateScreenerSchedule(scheduleId, data) {
      if (!scheduleId) throw new Error("scheduleId is required for updateScreenerSchedule");
      return corePut(`/screener/schedules/${encodeURIComponent(scheduleId)}/`, data);
    },

    deleteScreenerSchedule(scheduleId) {
      if (!scheduleId) throw new Error("scheduleId is required for deleteScreenerSchedule");
      return coreDelete(`/screener/schedules/${encodeURIComponent(scheduleId)}/`);
    },

    runScreenerScheduleNow(scheduleId) {
      if (!scheduleId) throw new Error("scheduleId is required for runScreenerScheduleNow");
      return corePost(`/screener/schedules/${encodeURIComponent(scheduleId)}/run-now/`, {});
    },

    getScreenerScheduleAlerts() {
      return coreGet("/screener/schedules/alerts/");
    },

    // W8 P3 preset cộng đồng — public catalog + fork + share toggle (via updateScreenerRule {is_public})
    getScreenerPublicRules() {
      return coreGet("/screener/rules/public/");
    },

    forkScreenerRule(ruleId) {
      if (!ruleId) throw new Error("ruleId is required for forkScreenerRule");
      return corePost(`/screener/rules/${encodeURIComponent(ruleId)}/fork/`, {});
    },

    // ─── AI Command Center API ───────────────────────────────────────────────

    getAICommandCenterConfig() {
      return coreGet("/workspace/ai-command-center/");
    },

    updateAICommandCenterConfig(data) {
      return corePut("/workspace/ai-command-center/", data);
    },

    /** F7: rollback prompt config to a history version → { ai_prompt_config, ai_prompt_config_history, rolled_back_to } */
    rollbackAICommandCenterPromptConfig(version) {
      return corePost("/workspace/ai-command-center/prompt-config/rollback/", { version });
    },

    testAICommandCenterConnection(data) {
      return corePost("/workspace/ai-command-center/test-connection/", data);
    },

    getAIAuditLogs(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/workspace/ai-command-center/audit-logs/${query ? `?${query}` : ''}`);
    },

    getUserConfig() {
      return coreGet('/workspace/userconfig/');
    },

    /**
     * Cập nhật user config (preferences) — hiện tại hỗ trợ toggle event gate.
     * @param {{ advisory_whale_signal_enabled?: boolean }} data
     * @returns {Promise<{ ok: boolean, preferences: object, advisory_whale_signal_enabled: boolean }>}
     */
    updateUserConfig(data) {
      return corePatch('/workspace/userconfig/', data);
    },

    // ─── AI Agent Registry API ───────────────────────────────────────────

    getAIAgents(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/ai/agents/${query ? `?${query}` : ''}`);
    },

    createAIAgent(data) {
      return corePost('/ai/agents/', data);
    },

    updateAIAgent(id, data) {
      return corePatch(`/ai/agents/${id}/`, data);
    },

    deleteAIAgent(id) {
      return coreDelete(`/ai/agents/${id}/`);
    },

    // ─── AI Usage Analytics API ──────────────────────────────────────────

    getAIUsageRecords(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/ai/usage/${query ? `?${query}` : ''}`);
    },

    getAIUsageSummary(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/ai/usage/summary/${query ? `?${query}` : ''}`);
    },

    getAIUsageAggregate(params = {}) {
      const query = new URLSearchParams(
        Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== ''))
      ).toString();
      return coreGet(`/ai/usage/aggregate/${query ? `?${query}` : ''}`);
    },
  };
}