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

function resolveCoreApiBase() {
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

function getAuthorizationHeader() {
  if (typeof window === "undefined") return {};
  const token = window.localStorage?.getItem("access_token");
  if (!token) return {};
  return { "Authorization": `Bearer ${token}` };
}

async function coreGet(path, options = {}) {
  const base = resolveCoreApiBase();
  const requestId = generateRequestId();

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...getAuthorizationHeader(),
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Core API error ${response.status} ${response.statusText} — ${path}: ${text}`
    );
  }

  return response.json();
}

async function corePost(path, body = undefined) {
  const base = resolveCoreApiBase();
  const requestId = generateRequestId();

  const response = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...getAuthorizationHeader(),
    },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

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
  const base = resolveCoreApiBase();
  const requestId = generateRequestId();

  const response = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
      ...getAuthorizationHeader(),
    },
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Core API PATCH error ${response.status} ${response.statusText} — ${path}: ${text}`
    );
  }

  return response.json();
}

async function coreDelete(path) {
  const base = resolveCoreApiBase();
  const requestId = generateRequestId();

  const response = await fetch(`${base}${path}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      ...getAuthorizationHeader(),
      "X-Request-ID": requestId,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Core API DELETE error ${response.status} ${response.statusText} — ${path}: ${text}`
    );
  }

  return null;
}

/**
 * coreApiAdapter — facade object exposing all data-plane serving calls.
 *
 * Usage:
 *   import { coreApiAdapter } from '../../adapters/coreApiAdapter';
 *   const snapshot = await coreApiAdapter.getSymbolSnapshot('VCI');
 */
export const coreApiAdapter = {
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
   * List UnifiedAlerts with optional filters.
   * Response includes cursor-pagination `next`/`previous` links.
   * @param {object} [params] - Filters: symbol, alert_type, severity, session_date, cursor
   * @returns {Promise<{results: object[], next: string|null, previous: string|null}>}
   */
  getUnifiedAlerts(params = {}) {
    const query = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString();
    return coreGet(`/unified-alert/${query ? `?${query}` : ""}`);
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
   * Lấy trạng thái kết nối DNSE LightSpeed API.
   * @returns {Promise<{ ok: boolean, is_configured: boolean, is_active: boolean }>}
   */
  getDNSETokenStatus() {
    return coreGet("/broker/dnse/token-status/");
  },
};
