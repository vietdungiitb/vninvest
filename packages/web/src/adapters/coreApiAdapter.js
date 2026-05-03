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

async function coreGet(path, options = {}) {
  const base = resolveCoreApiBase();
  const requestId = generateRequestId();

  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Request-ID": requestId,
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
};
