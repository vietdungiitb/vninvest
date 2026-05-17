/**
 * coreApiAdapter.js
 *
 * Data-plane serving adapter for packages/core backend.
 * Calls /core/v1/* endpoints for SymbolSnapshot, SessionFacts,
 * UnifiedAlert, and WhaleAlertCanonical.
 *
 * This adapter is the preferred client for packages/web shell pages
 * to consume market serving data from the core API — replacing
 * direct calls to legacy portfolio endpoints over time.
 */

function resolveCoreApiBase(env = {}) {
  if (env && typeof env.CORE_API_BASE_URL === "string" && env.CORE_API_BASE_URL.trim()) {
    return env.CORE_API_BASE_URL.trim();
  }
  if (env && typeof env.REACT_APP_CORE_API_BASE_URL === "string" && env.REACT_APP_CORE_API_BASE_URL.trim()) {
    return env.REACT_APP_CORE_API_BASE_URL.trim();
  }
  if (typeof window !== "undefined" && window.CORE_API_BASE_URL) {
    return window.CORE_API_BASE_URL;
  }
  if (typeof process !== "undefined" && process.env?.REACT_APP_CORE_API_BASE_URL) {
    return process.env.REACT_APP_CORE_API_BASE_URL;
  }
  return "/core/v1";
}

function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function getBrowserStorageToken(key) {
  if (typeof window === "undefined") return null;
  return window.localStorage?.getItem(key) || null;
}

function getAuthorizationHeader(getToken) {
  const token = typeof getToken === "function" ? getToken() : null;
  if (!token) return {};
  return { "Authorization": `Bearer ${token}` };
}

function normalizeRefreshResponsePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const directAccess = typeof payload.access === "string" ? payload.access : null;
  const directRefresh = typeof payload.refresh === "string" ? payload.refresh : null;
  if (directAccess) {
    return { access: directAccess, refresh: directRefresh };
  }
  const nestedData = payload.data;
  if (nestedData && typeof nestedData === "object" && typeof nestedData.access === "string") {
    return {
      access: nestedData.access,
      refresh: typeof nestedData.refresh === "string" ? nestedData.refresh : null,
    };
  }
  return null;
}

function createCoreTransport(env = {}, options = {}) {
  const {
    getToken = () => null,
    getRefreshToken = () => null,
    setTokens = () => {},
    clearTokens = () => {},
  } = options;
  let refreshPromise = null;

  function shouldTryRefresh(path, responseStatus) {
    return (
      responseStatus === 401
      && path !== "/auth/token/refresh/"
      && typeof getRefreshToken === "function"
      && Boolean(getRefreshToken())
    );
  }

  async function requestTokenRefresh() {
    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const base = resolveCoreApiBase(env);
    const requestId = generateRequestId();

    refreshPromise = fetch(`${base}/auth/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      credentials: "include",
      body: JSON.stringify({ refresh: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTokens();
          return null;
        }
        const payload = await response.json().catch(() => null);
        const tokenPayload = normalizeRefreshResponsePayload(payload);
        if (!tokenPayload || !tokenPayload.access) {
          clearTokens();
          return null;
        }
        setTokens(tokenPayload);
        return tokenPayload.access;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async function requestWithAuth(path, init = {}, attemptRefresh = true) {
    const base = resolveCoreApiBase(env);
    const requestId = generateRequestId();
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...getAuthorizationHeader(getToken),
        ...(init.headers || {}),
      },
      credentials: "include",
    });

    if (attemptRefresh && shouldTryRefresh(path, response.status)) {
      const nextAccessToken = await requestTokenRefresh();
      if (nextAccessToken) {
        return requestWithAuth(path, init, false);
      }
    }

    return response;
  }

  async function coreGet(path, options = {}) {
    const response = await requestWithAuth(path, options, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return response.json();
  }

  async function corePost(path, body = undefined) {
    const response = await requestWithAuth(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API POST error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function corePatch(path, body = undefined) {
    const response = await requestWithAuth(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API PATCH error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return response.json();
  }

  async function coreDelete(path) {
    const response = await requestWithAuth(path, {
      method: "DELETE",
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API DELETE error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return null;
  }

  return { coreGet, corePost, corePatch, coreDelete };
}

/**
 * coreApiAdapter — facade object exposing all data-plane serving calls.
 *
 * Usage:
 *   import { coreApiAdapter } from '../../adapters/coreApiAdapter';
 *   const snapshot = await coreApiAdapter.getSymbolSnapshot('VCI');
 */
export function createCoreApiAdapter({ env = {}, getToken, getRefreshToken, setTokens, clearTokens } = {}) {
  const { coreGet, corePost, corePatch, coreDelete } = createCoreTransport(env, {
    getToken,
    getRefreshToken,
    setTokens,
    clearTokens,
  });

  return {
  
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
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return coreGet(
      `/session-facts/${encodeURIComponent(symbol.toUpperCase())}/${query}`
    );
  },

  /**
   * List alert-center feed (main lane) with optional filters.
   * @param {object} [params] - Filters: symbol, alert_family, severity, session_date, cursor, page_size
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
   * Get alert-center event detail by alert_id.
   * @param {string} alertId
   * @returns {Promise<object>}
   */
  getAlertCenterEventDetail(alertId) {
    if (!alertId) throw new Error("alertId is required for getAlertCenterEventDetail");
    return coreGet(`/signals/alert-center/events/${encodeURIComponent(alertId)}`);
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
  acknowledgeAlertCenterEvent(alertId) {
    if (!alertId) throw new Error("alertId is required for acknowledgeAlertCenterEvent");
    return corePost(`/signals/alert-center/events/${encodeURIComponent(alertId)}/ack`);
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
   * Get WhaleAlertCanonical feed for a symbol.
   * Response includes cursor-pagination `next`/`previous` links.
   * @param {string} symbol
   * @param {object} [params] - Additional filters: session_date, cursor
   * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
   */
  getWhaleFeedAggregate(symbol, params = {}) {
    if (!symbol) throw new Error("symbol is required for getWhaleFeedAggregate");
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return coreGet(
      `/whale-feed-aggregate/${encodeURIComponent(symbol.toUpperCase())}/${
        query ? `?${query}` : ""
      }`
    );
  },

  /**
   * Get tenant lifecycle/subscription status (requires authentication).
   * @returns {Promise<object>}
   */
  getTenantLifecycle() {
    return coreGet("/tenant/lifecycle/");
  },

  // ─── Advisory ────────────────────────────────────────────────────────────

  /**
   * Get the latest advisory for a symbol on a given session date.
   * @param {string} symbol
   * @param {string} [date] - ISO date YYYY-MM-DD; defaults to today
   * @returns {Promise<object>}
   */
  getAdvisoryLatest(symbol, date) {
    if (!symbol) throw new Error("symbol is required for getAdvisoryLatest");
    const query = date ? `?date=${encodeURIComponent(date)}` : "";
    return coreGet(`/advisory/latest/${encodeURIComponent(symbol.toUpperCase())}/${query}`);
  },

  /**
   * Request an advisory refresh/generation for a symbol.
   * @param {string} symbol
   * @returns {Promise<object>}
   */
  refreshAdvisory(symbol) {
    if (!symbol) throw new Error("symbol is required for refreshAdvisory");
    return corePost(`/advisory/refresh/${encodeURIComponent(symbol.toUpperCase())}/`);
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
    );
  },

  // ─── User Workspace ───────────────────────────────────────────────────────

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

  // ─── User Profile ─────────────────────────────────────────────────────────

  /**
   * Get the profile for the currently authenticated user.
   * @returns {Promise<object>}
   */
  getUserProfile() {
    return coreGet("/identity/profile/");
  },

  /**
   * Update the authenticated user's profile.
   * @param {{ display_name?: string, language?: string, theme?: string, whale_alert_threshold?: number }} data
   * @returns {Promise<object>}
   */
  updateUserProfile(data) {
    return corePatch("/identity/profile/", data);
  },

  // ─── Market Data ──────────────────────────────────────────────────────────

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
    return coreGet(`/market-data/symbols/${encodeURIComponent(symbol.toUpperCase())}/`);
  },

  // ─── Order Flow ───────────────────────────────────────────────────────────

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
  // ─── DNSE LightSpeed API Broker Integration ───────────────────────────────
  // Tất cả calls DNSE phải đi qua adapter này — KHÔNG dùng legacy client.js.
  // Auth: client_id + client_secret (LightSpeed OAuth2), không phải username/password.

  /**
   * Lấy trạng thái cấu hình DNSE LightSpeed của user hiện tại.
   * @returns {Promise<{ is_configured: boolean, data?: object }>}
   */
  getDNSEConfig() {
    return coreGet("/broker/dnse/config/");
  },

  /**
   * Cập nhật DNSE LightSpeed credential (client_id + client_secret).
   * Lấy từ trang quản lý EntradeX → LightSpeed API → Client Management.
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
  };
}

export const defaultCoreApiAdapter = createCoreApiAdapter({
  getToken: () => getBrowserStorageToken("access_token"),
  getRefreshToken: () => getBrowserStorageToken("refresh_token"),
  setTokens: (tokens) => {
    if (typeof window === "undefined" || !tokens?.access) return;
    window.localStorage?.setItem("access_token", tokens.access);
    if (tokens.refresh) {
      window.localStorage?.setItem("refresh_token", tokens.refresh);
    }
  },
  clearTokens: () => {
    if (typeof window === "undefined") return;
    window.localStorage?.removeItem("access_token");
    window.localStorage?.removeItem("refresh_token");
  },
});

export const coreApiAdapter = defaultCoreApiAdapter;
