/**
 * workspace.js
 *
 * User workspace (Portfolios, Watchlists, Price Alerts, Tracked Symbols), DNSE integrations,
 * and Operator mail configuration endpoints for coreApiAdapter.
 */

export function createWorkspaceClient({ coreGet, corePost, corePatch, coreDelete }) {
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
     * Lấy trạng thái cấu hình DNSE LightSpeed của user hiện tại.
     * @returns {Promise<{ is_configured: boolean, data?: object }>}
     */
    getDNSEConfig() {
      return coreGet("/broker/dnse/config/");
    },

    /**
     * Cập nhật DNSE LightSpeed credential (client_id + client_secret).
     * @param {{ client_id: string, client_secret: string, is_active?: boolean }} data
     * @returns {Promise<{ ok: boolean }>}
     */
    updateDNSEConfig(data) {
      if (!data.client_id || !data.client_secret) {
        throw new Error("client_id và client_secret là bắt buộc cho DNSE LightSpeed API.");
      }
      return corePost("/broker/dnse/config/", data);
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
     * @param {{ dry_run?: boolean }} [params]
     */
    sendDNSEEmailOtp(params = {}) {
      return corePost("/broker/dnse/send-email-otp/", params);
    },

    /**
     * Tạo trading token DNSE từ OTP/passcode.
     * @param {{ otp_type?: string, passcode: string, dry_run?: boolean }} data
     */
    createDNSETradingToken(data) {
      if (!data || !data.passcode) {
        throw new Error("passcode là bắt buộc để tạo trading token DNSE.");
      }
      return corePost("/broker/dnse/create-trading-token/", data);
    },

    /**
     * Đặt lệnh DNSE với trading token hợp lệ.
     * @param {{ market_type?: string, order_category?: string, trading_token: string, payload: object, dry_run?: boolean }} data
     */
    placeDNSEOrder(data) {
      if (!data || !data.trading_token) {
        throw new Error("trading_token là bắt buộc để đặt lệnh DNSE.");
      }
      if (!data.payload || typeof data.payload !== "object") {
        throw new Error("payload đặt lệnh DNSE không hợp lệ.");
      }
      return corePost("/broker/dnse/place-order/", data);
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
  };
}`n