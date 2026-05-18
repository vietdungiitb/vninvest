/**
 * api/client.js
 * Axios client với JWT auth interceptor.
 * BaseURL từ REACT_APP_API_BASE_URL hoặc proxy /api -> backend:8000
 */
import axios from 'axios';
import { coreApiAdapter } from '@vninvest/web/adapters/core-api-adapter';

const apiBaseURL = process.env.REACT_APP_API_BASE_URL || '/api';
const REQUEST_TIMEOUT_MS = 20000;

function normalizeChartTimeframe(timeframe) {
  const value = String(timeframe || '1H').trim();
  const upperValue = value.toUpperCase();
  const aliasMap = {
    '1M': '1m',
    '5M': '5m',
    '15M': '15m',
    '1H': '1H',
    '2H': '2H',
    '4H': '4H',
    D: 'D',
    '1D': '1D',
    W: 'W',
    '1W': '1W',
    M: 'M',
    '1MO': '1MO',
    Y: 'Y',
  };
  return aliasMap[upperValue] || '1H';
}

const apiClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
  timeout: REQUEST_TIMEOUT_MS,
});

function getCoreRequestId(headers = {}) {
  return String(headers['x-core-request-id'] || headers['X-Core-Request-Id'] || '').trim();
}

function attachCoreRequestId(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const requestId = getCoreRequestId(response.headers || {});
  if (requestId) {
    response.coreRequestId = requestId;
  }
  return response;
}

function buildIdempotencyKey(prefix = 'request') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeListResponse(response) {
  if (!response || typeof response !== 'object') {
    return response;
  }

  const requestUrl = String(response.config?.url || '');
  const payload = response.data;
  const rawRows = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : Array.isArray(payload?.results)
        ? payload.results
        : [];

  const rows = rawRows.map((item) => {
    if (requestUrl.includes('/core/v1/partner/service-accounts')) {
      return {
        ...item,
        id: item.id || item.service_account_id || item.public_id || '',
        service_account_id: item.service_account_id || item.id || item.public_id || '',
        environment: item.environment || item.metadata?.environment || 'prod',
        policy_ids: Array.isArray(item.policy_ids)
          ? item.policy_ids
          : Array.isArray(item.scopes)
            ? item.scopes
            : [],
      };
    }

    if (requestUrl.includes('/core/v1/partner/pats')) {
      return {
        ...item,
        id: item.id || item.pat_id || item.public_id || '',
        pat_id: item.pat_id || item.id || item.public_id || '',
        scope_codes: Array.isArray(item.scope_codes)
          ? item.scope_codes
          : Array.isArray(item.scopes)
            ? item.scopes
            : [],
      };
    }

    return item;
  });

  if (Array.isArray(payload)) {
    return {
      ...response,
      data: {
        object: 'list',
        data: rows,
        has_more: false,
        next_cursor: null,
        prev_cursor: null,
      },
    };
  }

  if (payload && typeof payload === 'object') {
    return {
      ...response,
      data: {
        ...payload,
        data: rows,
      },
    };
  }

  return {
    ...response,
    data: {
      object: 'list',
      data: rows,
      has_more: false,
      next_cursor: null,
      prev_cursor: null,
    },
  };
}

function normalizeTenantServiceAccountWritePayload(payload = {}) {
  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes
    : Array.isArray(payload.policy_ids)
      ? payload.policy_ids
      : [];

  return {
    ...payload,
    scopes,
    policy_ids: Array.isArray(payload.policy_ids) ? payload.policy_ids : scopes,
  };
}

function normalizeTenantPatWritePayload(payload = {}) {
  const scopes = Array.isArray(payload.scopes)
    ? payload.scopes
    : Array.isArray(payload.scope_codes)
      ? payload.scope_codes
      : [];

  return {
    ...payload,
    scopes,
    scope_codes: Array.isArray(payload.scope_codes) ? payload.scope_codes : scopes,
  };
}

function withDefaultAuditReason(payload = {}, defaultReason) {
  return {
    ...payload,
    audit_reason: payload.audit_reason || defaultReason,
  };
}

const AUTH_PUBLIC_ENDPOINT_PATTERN = /\/auth\/(token\/?|token\/refresh\/?|register\/?|verify-email\/?|resend-verification\/?)$/i;
let refreshRequestPromise = null;

function hasAuthTokens() {
  const access = localStorage.getItem('access_token');
  const refresh = localStorage.getItem('refresh_token');
  return Boolean(access && refresh);
}

export function isAuthPublicEndpoint(url) {
  return AUTH_PUBLIC_ENDPOINT_PATTERN.test(String(url || ''));
}

async function requestTokenRefresh() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) {
    return null;
  }

  if (!refreshRequestPromise) {
    refreshRequestPromise = axios.post(`${apiBaseURL}/auth/token/refresh/`, {
      refresh: refreshToken,
    }, {
      timeout: REQUEST_TIMEOUT_MS,
    })
      .then(({ data }) => {
        localStorage.setItem('access_token', data.access);
        if (data.refresh) {
          localStorage.setItem('refresh_token', data.refresh);
        }
        return data.access;
      })
      .catch((error) => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        throw error;
      })
      .finally(() => {
        refreshRequestPromise = null;
      });
  }

  return refreshRequestPromise;
}

// Interceptor request: Bearer token từ localStorage
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor response: 401 -> refresh token -> retry, fail -> logout
apiClient.interceptors.response.use(
  (res) => attachCoreRequestId(res),
  async (err) => {
    const originalRequest = err.config || {};
    attachCoreRequestId(err.response);
    if (err.response?.coreRequestId) {
      err.coreRequestId = err.response.coreRequestId;
    }

    // Login/register/verify endpoints must return their own errors to UI.
    // If we auto-redirect here, the login page appears to refresh without message.
    if (isAuthPublicEndpoint(originalRequest.url)) {
      return Promise.reject(err);
    }

    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const nextAccessToken = await requestTokenRefresh();
          if (!nextAccessToken) {
            if (window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return Promise.reject(err);
          }
          originalRequest.headers.Authorization = `Bearer ${nextAccessToken}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          // Refresh fail -> logout
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshErr);
        }
      } else {
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Standalone token refresh — dùng cho WebSocket khi nhận close code 4401.
 * Returns new access token string, or null nếu refresh thất bại.
 */
export const refreshAccessToken = async () => {
  try {
    return await requestTokenRefresh();
  } catch {
    return null;
  }
};

export const getTenantServiceAccounts = (params = {}) =>
  apiClient.get('/core/v1/partner/service-accounts/', { params }).then(normalizeListResponse);

export const getTenantSummary = () =>
  apiClient.get('/core/v1/partner/tenant/');

export const createTenantServiceAccount = (payload) =>
  apiClient.post('/core/v1/partner/service-accounts/', normalizeTenantServiceAccountWritePayload(payload), {
    headers: {
      'Idempotency-Key': buildIdempotencyKey('tenant-service-account'),
    },
  });

export const getTenantPATs = (params = {}) =>
  apiClient.get('/core/v1/partner/pats/', { params }).then(normalizeListResponse);

export const getTenantUsageMeters = (params = {}) =>
  apiClient.get('/core/v1/partner/usage/meters/', { params });

export const getTenantUsageQuotas = (params = {}) =>
  apiClient.get('/core/v1/partner/usage/quotas/', { params });

export const getTenantBillingSubscription = () =>
  apiClient.get('/core/v1/partner/billing/subscription/');

export const getTenantBillingInvoices = (params = {}) =>
  apiClient.get('/core/v1/partner/billing/invoices/', { params });

export const getCoreOperatorJobs = (params = {}) =>
  apiClient.get('/core/v1/operator/jobs/', { params });

export const getCoreOperatorAuditRequests = (params = {}) =>
  apiClient.get('/core/v1/operator/audit/requests/', { params });

export const getCoreOperatorAuditRequestDetail = (requestId) =>
  apiClient.get(`/core/v1/operator/audit/requests/${requestId}/`);

export const issueTenantPAT = (payload) =>
  apiClient.post('/core/v1/partner/pats/issue/', normalizeTenantPatWritePayload(withDefaultAuditReason(payload, 'tenant_admin_issue_pat')), {
    headers: {
      'Idempotency-Key': buildIdempotencyKey('tenant-pat-issue'),
    },
  });

export const rotateTenantPAT = (tokenId, payload = {}) =>
  apiClient.post(`/core/v1/partner/pats/${tokenId}/rotate/`, withDefaultAuditReason(payload, 'tenant_admin_rotate_pat'), {
    headers: {
      'Idempotency-Key': buildIdempotencyKey('tenant-pat-rotate'),
    },
  });

export const revokeTenantPAT = (tokenId, payload = {}) =>
  apiClient.post(`/core/v1/partner/pats/${tokenId}/revoke/`, withDefaultAuditReason(payload, 'tenant_admin_revoke_pat'), {
    headers: {
      'Idempotency-Key': buildIdempotencyKey('tenant-pat-revoke'),
    },
  });

// --- Portfolio APIs (prefix portfolio/ theo urls.py) ---
export const getPortfolios = () => apiClient.get('/portfolio/portfolios/');
export const createPortfolio = (data) => apiClient.post('/portfolio/portfolios/', data);
export const getPortfolio = (id) => apiClient.get(`/portfolio/portfolios/${id}/`);
export const updatePortfolio = (id, data) => apiClient.put(`/portfolio/portfolios/${id}/`, data);
export const deletePortfolio = (id) => apiClient.delete(`/portfolio/portfolios/${id}/`);

// --- SubAccount APIs ---
export const getSubAccounts = () => apiClient.get('/portfolio/subaccounts/');
export const createSubAccount = (data) => apiClient.post('/portfolio/subaccounts/', data);
export const updateSubAccount = (id, data) => apiClient.patch(`/portfolio/subaccounts/${id}/`, data);
export const deleteSubAccount = (id) => apiClient.delete(`/portfolio/subaccounts/${id}/`);

// --- Transaction APIs ---
export const getTransactions = (subAccountId) =>
  apiClient.get(`/portfolio/subaccounts/${subAccountId}/transactions/`);
export const createTransaction = (subAccountId, data) =>
  apiClient.post(`/portfolio/subaccounts/${subAccountId}/transactions/`, data);

export const updateTransaction = (id, data) =>
  apiClient.patch(`/portfolio/transactions/${id}/`, data);
export const deleteTransaction = (id) =>
  apiClient.delete(`/portfolio/transactions/${id}/`);

// --- Analytics APIs ---
export const getHoldings = (portfolioId) =>
  Promise.resolve(coreApiAdapter.getPortfolioHoldings(portfolioId)).then((data) => ({ data }));
export const getSummary = (portfolioId) =>
  Promise.resolve(coreApiAdapter.getPortfolioSummary(portfolioId)).then((data) => ({ data }));
export const getChartData = (portfolioId, days = 90) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/chart/?days=${days}`);

export const getEquityCurve = (portfolioId, days = 180) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/equity-curve/?days=${days}`);
export const getAllocation = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/allocation/`);
export const getAllocationBySector = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/allocation/?by=sector`);
export const getAnalytics = (portfolioId, days = 365) =>
  Promise.resolve(coreApiAdapter.getPortfolioAnalytics(portfolioId, days)).then((data) => ({ data }));
export const getPortfolioTechnicals = (portfolioId) =>
  Promise.resolve(coreApiAdapter.getPortfolioTechnicals(portfolioId)).then((data) => ({
    data: { technicals: Array.isArray(data) ? data : Array.isArray(data?.technicals) ? data.technicals : Array.isArray(data?.results) ? data.results : [] },
  }));
export const getBulkTechnicalsBySymbols = (symbols = []) =>
  Promise.resolve(coreApiAdapter.getBulkTechnicalsBySymbols(symbols)).then((data) => ({
    data: {
      technicals: Array.isArray(data)
        ? data
        : Array.isArray(data?.technicals)
          ? data.technicals
          : Array.isArray(data?.results)
            ? data.results
            : [],
    },
  }));

// --- Sync ---
export const syncPrices = (portfolioId, days = 30) =>
  apiClient.post(`/portfolio/portfolios/${portfolioId}/sync/`, { days });

// --- Sync StockProfile (trigger backend sync) ---
export const syncStockProfile = () => apiClient.post('/admin-sync/stockprofile/');

// --- Watchlist Cache & Auth Guard ---
let watchlistGroupsCache = null;
let watchlistGroupsCacheTimestamp = 0;
const WATCHLIST_GROUPS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getWatchlistGroups = () => {
  if (!hasAuthTokens()) {
    return Promise.resolve({ data: [] });
  }

  const now = Date.now();
  if (watchlistGroupsCache && now - watchlistGroupsCacheTimestamp < WATCHLIST_GROUPS_CACHE_TTL) {
    return Promise.resolve({ data: watchlistGroupsCache });
  }

  return Promise.resolve(coreApiAdapter.getLegacyWatchlistGroups())
    .then((data) => {
      watchlistGroupsCache = data || [];
      watchlistGroupsCacheTimestamp = now;
      return { data: watchlistGroupsCache };
    })
    .catch((err) => {
      console.error('getWatchlistGroups failed:', err);
      return { data: [] };
    });
};
export const createWatchlistGroup = (data) => apiClient.post('/portfolio/watchlist/groups/', data);
export const updateWatchlistGroup = (id, data) => apiClient.patch(`/portfolio/watchlist/groups/${id}/`, data);
export const deleteWatchlistGroup = (id) => apiClient.delete(`/portfolio/watchlist/groups/${id}/`);
export const addWatchlistItem = (groupId, symbol) =>
  apiClient.post(`/portfolio/watchlist/groups/${groupId}/items/`, { symbol });
export const deleteWatchlistItem = (itemId) => apiClient.delete(`/portfolio/watchlist/items/${itemId}/`);
export const seedWatchlist = () => apiClient.post('/portfolio/watchlist/seed/');
export const syncWatchlistPrices = (days = 5) => apiClient.post('/portfolio/watchlist/sync/', { days });

// --- Securities Groups APIs ---
export const getSecuritiesGroups = () => apiClient.get('/stock-management/groups/');
export const seedSecurities = () => apiClient.post('/stock-management/seed/');
export const syncSecuritiesPrices = (days = 5) => apiClient.post('/stock-management/sync/', { days });
export const getStockProfile = (symbol) => apiClient.get(`/stock-management/stocks/${symbol}/`);
export const getStockWorkspaceOverview = (symbol) => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/overview/`);
export const getStockPriceChart = (symbol, days = 180, timeframe = '1H') =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/chart/`, {
    params: { days, timeframe: normalizeChartTimeframe(timeframe) },
  });
export const getStockOrderFlow = (symbol, window = '30m') => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/order-flow/`, { params: { window } });
export const getStockNews = (symbol, { force = false } = {}) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/news/`, {
    params: force ? { force: 1 } : undefined,
  });
export const generateStockNewsAISummary = (symbol, { force = false } = {}) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/news/ai-summary/`, {
    force_refresh: Boolean(force),
  });
export const getPortfolioNewsDigest = (params = {}) =>
  Promise.resolve(coreApiAdapter.getPortfolioNewsDigest(params)).then((data) => ({ data }));
export const getStockAIAdvisorySession = (symbol, params = {}) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-session/`, { params });
export const getStockAIAdvisoryObservability = (symbol, params = {}) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-observability/`, { params });
export const postStockAIAdvisoryObservabilityEvent = (symbol, payload = {}) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-observability/`, payload);
export const refreshStockAIAdvisorySession = (symbol) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-session/`);
export const generateStockAIAdvisoryComponents = (symbol, payload = {}) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-components/generate/`, payload);
export const toggleStockAIAdvisoryComponentInclude = (componentId) =>
  apiClient.post(`/stock-management/ai-advisory-components/${componentId}/toggle-include/`);
export const refreshStockAIAdvisoryComponent = (componentId) =>
  apiClient.post(`/stock-management/ai-advisory-components/${componentId}/refresh/`);
export const restoreStockAIAdvisoryComponent = (componentId) =>
  apiClient.post(`/stock-management/ai-advisory-components/${componentId}/restore/`);
export const deleteStockAIAdvisoryComponent = (componentId) =>
  apiClient.delete(`/stock-management/ai-advisory-components/${componentId}/`);
export const clearDeletedStockAIAdvisoryComponents = (symbol) =>
  apiClient.delete(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-components/deleted/`);
export const regenerateStockAIExecutiveSummary = (symbol, payload = {}) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-summary/regenerate/`, payload);
export const deleteStockAIExecutiveSummary = (symbol, summaryId) =>
  apiClient.delete(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-summary/${summaryId}/`);
export const getRealtimeTicker = (symbol) => apiClient.get(`/realtime/ticker/${symbol}/`);
export const getRealtimeTickers = (symbols) => {
  const symbolList = Array.isArray(symbols) ? symbols : [symbols];
  return apiClient.get(`/realtime/tickers/?symbols=${symbolList.join(',')}`);
};
export const getIntradayMatched = (symbol, pageSize = 50) =>
  apiClient.get(`/realtime/intraday/${encodeURIComponent(symbol)}/?page_size=${pageSize}`);
export const getPriceBoard = (symbol) =>
  apiClient.get(`/realtime/price-board/${encodeURIComponent(symbol)}/`);
export const getSectorBreadth = (symbol) =>
  apiClient.get(`/realtime/breadth/${encodeURIComponent(symbol)}/`);
export const getWhaleFeed = (symbol) =>
  apiClient.get(`/realtime/whale-feed/${encodeURIComponent(symbol)}/`);
/**
 * Lấy SessionFacts (CVD, Strength, Dark Flow) cho một symbol.
 * Endpoint: GET /api/market/session-facts/<symbol>/
 * Nếu truyền tradeDate, endpoint khóa đúng selected session thay vì fallback về phiên gần nhất.
 */
export const getSessionFacts = (symbol, tradeDate = null) =>
  apiClient.get(`/market/session-facts/${encodeURIComponent(symbol)}/`, {
    params: {
      ...(tradeDate ? { trade_date: tradeDate } : {}),
    },
  });

/**
 * Lấy chuỗi CVD theo bucket từ SSOT duy nhất (WhaleAlertCanonical).
 * Endpoint: GET /api/market/session-facts/<symbol>/cvd/?window=<5m|15m|30m|1h>
 * Thay thế cvd_series từ IntradayTick cho OrderFlowRadarPanel.
 */
export const getSessionFactsCvd = (symbol, window = '15m', tradeDate = null) =>
  apiClient.get(`/market/session-facts/${encodeURIComponent(symbol)}/cvd/`, {
    params: {
      window,
      ...(tradeDate ? { trade_date: tradeDate } : {}),
    },
  });export const getWhaleAnalyticsSnapshot = (symbol, { timeframe = 'session', compact = 1, tradeDate, includeBaseline } = {}) =>
  apiClient.get(`/portfolio/whale/analytics/${encodeURIComponent(symbol)}/`, {
    params: {
      timeframe,
      compact,
      ...(tradeDate ? { trade_date: tradeDate } : {}),
      ...(includeBaseline === undefined ? {} : { include_baseline: includeBaseline ? 1 : 0 }),
    },
  });
export const getAggregateWhaleFeed = ({ symbols, watchlistGroupIds, sort = 'ts', window = 'session', limit = 12, cursor, signal } = {}) => {
  const params = new URLSearchParams();
  if (Array.isArray(symbols) && symbols.length > 0) {
    params.set('symbols', symbols.join(','));
  }
  if (Array.isArray(watchlistGroupIds) && watchlistGroupIds.length > 0) {
    params.set('watchlist_group_ids', watchlistGroupIds.join(','));
  }
  if (sort) {
    params.set('sort', sort);
  }
  if (window) {
    params.set('window', window);
  }
  if (limit) {
    params.set('limit', String(limit));
  }
  if (cursor) {
    params.set('cursor', cursor);
  }
  const queryString = params.toString();
  return apiClient.get(`/realtime/whale-feed/aggregate/${queryString ? `?${queryString}` : ''}`, { signal });
};
export const getWhaleCampaigns = ({
  symbols,
  watchlistGroupIds,
  window = 'session',
  campaignLimit = 24,
  campaignSort = 'strength',
  campaignGapMinutes,
  cursor,
  signal,
} = {}) => {
  const params = new URLSearchParams();
  if (Array.isArray(symbols) && symbols.length > 0) {
    params.set('symbols', symbols.join(','));
  }
  if (Array.isArray(watchlistGroupIds) && watchlistGroupIds.length > 0) {
    params.set('watchlist_group_ids', watchlistGroupIds.join(','));
  }
  if (window) {
    params.set('window', window);
  }
  if (campaignLimit) {
    params.set('campaign_limit', String(campaignLimit));
  }
  if (campaignSort) {
    params.set('campaign_sort', campaignSort);
  }
  if (Number.isFinite(Number(campaignGapMinutes))) {
    params.set('campaign_gap_minutes', String(campaignGapMinutes));
  }
  if (cursor) {
    params.set('cursor', cursor);
  }
  const queryString = params.toString();
  return apiClient.get(`/realtime/whale-campaigns/${queryString ? `?${queryString}` : ''}`, { signal });
};

export const getAlertCenterFeed = async ({ symbols, watchlistGroupIds: _watchlistGroupIds, window: _window = 'session', severityMin = 'low', limit: _limit = 20, cursor } = {}) => {
  const normalizedSymbols = Array.isArray(symbols)
    ? symbols.map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean)
    : [];
  const severity = severityMin && severityMin !== 'low' ? severityMin : undefined;
  // Không lọc theo ngày cứng — backend trả alerts từ phiên gần nhất
  // session_date=today sẽ loại bỏ whale/dark_flow từ phiên trước khi thị trường đóng cửa
  const payload = await coreApiAdapter.getAlertCenterFeed({
    symbol: normalizedSymbols.length === 1 ? normalizedSymbols[0] : undefined,
    severity,
    alert_family: undefined,
    page_size: Number.isFinite(Number(_limit)) ? Number(_limit) : undefined,
    cursor: cursor || undefined,
  });

  const nextUrl = String(payload?.next || '').trim();
  let nextCursor = null;
  if (nextUrl) {
    try {
      const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost';
      nextCursor = new URL(nextUrl, origin).searchParams.get('cursor');
    } catch (_error) {
      nextCursor = null;
    }
  }

  const scopedResults = normalizedSymbols.length > 1
    ? (payload?.results || []).filter((item) => normalizedSymbols.includes(String(item?.symbol || '').trim().toUpperCase()))
    : (payload?.results || []);

  return {
    data: {
      results: scopedResults,
      next_cursor: nextCursor,
      has_more: Boolean(nextCursor),
      next: payload?.next || null,
      previous: payload?.previous || null,
    },
  };
};

// Compatibility alias for legacy consumers during migration.
export const getUnifiedAlerts = getAlertCenterFeed;

/**
 * Get symbol co-observation data (dark money + whale campaigns correlation)
 * @param {string} symbol - Stock symbol (e.g. 'VNM')
 * @param {object} options - Query parameters
 * @param {string} options.window - Time window: '5d', '30m', etc.
 * @param {string} options.sort - Sort key: 'created_at' or 'correlation_strength'
 * @param {boolean} options.include_campaigns - Include whale campaigns
 * @param {boolean} options.include_signals - Include dark flow signals
 * @returns {Promise} API response with co-observation data
 */
export const getSymbolInvestigation = (symbol, {
  window = '5d',
  sort = 'created_at',
  include_campaigns = true,
  include_signals = true,
} = {}) => {
  const params = new URLSearchParams();
  if (window) params.set('window', window);
  if (sort) params.set('sort', sort);
  params.set('include_campaigns', String(include_campaigns));
  params.set('include_signals', String(include_signals));
  const queryString = params.toString();
  return apiClient.get(
    `/realtime/symbol-investigation/${encodeURIComponent(symbol)}/${queryString ? `?${queryString}` : ''}`
  );
};

export const getWhaleAdvisories = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiClient.get(`/portfolio/ai-advisory/${suffix}`);
};
export const getMarketDiscoveryHub = () => apiClient.get('/portfolio/market-discovery-hub/');
export const getCanonicalAIAdvisory = (symbol) =>
  apiClient.get(`/portfolio/ai-advisory/${encodeURIComponent(symbol)}/canonical/`);
export const refreshWhaleAdvisory = (symbol) =>
  apiClient.post(`/portfolio/ai-advisory/${encodeURIComponent(symbol)}/refresh/`);
export const deleteCurrentWhaleAdvisory = (symbol) =>
  apiClient.delete(`/portfolio/ai-advisory/${encodeURIComponent(symbol)}/current/`);
export const getAdvisoryAutoRefreshInfo = (symbol) =>
  apiClient.get(`/portfolio/ai-advisory/${encodeURIComponent(symbol)}/auto-refresh-info/`);
export const getPortfolioUserConfig = () => apiClient.get('/portfolio/userconfig/');
export const getWhaleAdvisorySymbolStats = (params = {}) => {
  const query = new URLSearchParams();
  if (params.symbols && Array.isArray(params.symbols)) {
    query.set('symbols', params.symbols.join(','));
  }
  if (params.window) {
    query.set('window', params.window);
  }
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiClient.get(`/portfolio/ai-advisory-symbol-stats/${suffix}`);
};
export const updatePortfolioUserConfig = (data) => apiClient.put('/portfolio/userconfig/', data);
export const getAICommandCenterConfig = () => apiClient.get('/portfolio/ai-command-center/');
export const updateAICommandCenterConfig = (data) => apiClient.put('/portfolio/ai-command-center/', data);
export const testAICommandCenterConnection = (data) =>
  apiClient.post('/portfolio/ai-command-center/test-connection/', data);
export const getAICommandCenterAuditLogs = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') return;
    query.set(key, String(value));
  });
  const suffix = query.toString() ? `?${query.toString()}` : '';
  return apiClient.get(`/portfolio/ai-command-center/audit-logs/${suffix}`);
};

export const getAIConfig = getAICommandCenterConfig;
export const updateAIConfig = updateAICommandCenterConfig;
export const getAIOptions = () => apiClient.get('/ai-options/');
export const getRVOL = (symbol) =>
  apiClient.get(`/realtime/rvol/${encodeURIComponent(symbol)}/`);
export const getDepthChart = (symbol) =>
  apiClient.get(`/realtime/depth-chart/${encodeURIComponent(symbol)}/`);

export const getStockFinancials = (symbol) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/financials/`);

export const getRealtimeWebSocketUrl = (token) => {
  const normalizedToken = token || localStorage.getItem('access_token') || '';
  if (process.env.REACT_APP_DISABLE_REALTIME_WEBSOCKET === 'true') {
    return null;
  }
  const customBase = process.env.REACT_APP_WS_BASE_URL;

  if (customBase) {
    return `${customBase.replace(/\/$/, '')}/ws/realtime/?token=${encodeURIComponent(normalizedToken)}`;
  }

  // In dev mode, use proxy through React dev server
  const isDevFrontendPort = ['3000', '3001'].includes(window.location.port);
  if (isDevFrontendPort) {
    return `ws://localhost:3000/ws/realtime/?token=${encodeURIComponent(normalizedToken)}`;
  }

  // In production, use same host
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws/realtime/?token=${encodeURIComponent(normalizedToken)}`;
};

// --- Mã Theo dõi (personal tracked symbols) ---
export const getTrackedSymbols = () => {
  if (!hasAuthTokens()) {
    return Promise.resolve({ data: [] });
  }
  return Promise.resolve(coreApiAdapter.getTrackedSymbols()).then((data) => ({ data })).catch((error) => {
    const status = error?.response?.status;
    if (status === 503 || status === 502 || status === 504) {
      console.warn('getTrackedSymbols fallback empty due to service unavailability:', status);
      return { data: [] };
    }
    throw error;
  });
};
export const addTrackedSymbol = (symbol, sourceGroupId = null, whaleAlertThresholdMillion = null) =>
  apiClient.post('/stock-management/tracked-symbols/', {
    symbol,
    source_group_id: sourceGroupId,
    whale_alert_threshold_million: whaleAlertThresholdMillion,
  });
export const updateTrackedSymbol = (id, data) => apiClient.patch(`/stock-management/tracked-symbols/${id}/`, data);
export const bulkUpdateTrackedSymbolThreshold = (trackedSymbolIds, whaleAlertThresholdMillion) =>
  apiClient.post('/stock-management/tracked-symbols/bulk-threshold/', {
    tracked_symbol_ids: trackedSymbolIds,
    whale_alert_threshold_million: whaleAlertThresholdMillion,
  });
export const deleteTrackedSymbol = (id) => apiClient.delete(`/stock-management/tracked-symbols/${id}/`);

// ---------------------------------------------------------------------------
// Sprint 28 — Legal content (public, no auth required)
// ---------------------------------------------------------------------------
const publicApiClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Lấy nội dung trang pháp lý đang active.
 * @param {string|null} slug - 'about' | 'disclaimer' | null (lấy tất cả)
 * @param {string} locale - 'vi' | 'en', mặc định 'vi'
 * @returns {Promise<Array>} - mảng LegalPage objects
 */
export const fetchLegalPages = async (slug = null, locale = 'vi') => {
  const params = { locale };
  if (slug) params.slug = slug;
  const response = await publicApiClient.get('/public/legal-pages/', { params });
  return response.data?.results ?? [];
};

export const getPriceAlerts = () => apiClient.get('/stock-management/price-alerts/');
export const createPriceAlert = (data) => apiClient.post('/stock-management/price-alerts/', data);
export const updatePriceAlert = (id, data) => apiClient.patch(`/stock-management/price-alerts/${id}/`, data);
export const deletePriceAlert = (id) => apiClient.delete(`/stock-management/price-alerts/${id}/`);

// --- Health / Observability (public, no auth needed) ---
export const getRealtimeHealth = () =>
  axios.get(`${apiBaseURL.replace(/\/api$/, '')}/api/health/realtime/`);
export const markPriceAlertTriggered = (id) => apiClient.post(`/stock-management/price-alerts/${id}/mark-triggered/`);

// --- Core operator (admin/core routes) ---
export const getAdminAuditLog = (params = {}) => apiClient.get('/core/v1/audit-log', { params, baseURL: '' });
export const getCoreOperatorOverview = () => apiClient.get('/core/v1/operator/overview/', { baseURL: '' });
export const getCoreOperatorHealth = () => apiClient.get('/core/v1/operator/health/', { baseURL: '' });
export const getCoreOperatorTenants = (params = {}) => apiClient.get('/core/v1/operator/tenants/', { params });
export const getCoreOperatorTenantDetail = (tenantId) => apiClient.get(`/core/v1/operator/tenants/${tenantId}/`);
export const getCoreOperatorTenantServiceAccounts = (tenantId, params = {}) => apiClient.get(`/core/v1/operator/tenants/${tenantId}/service-accounts/`, { params });
export const getCoreOperatorTenantPATs = (tenantId, params = {}) => apiClient.get(`/core/v1/operator/tenants/${tenantId}/pats/`, { params });

// --- Screener ---
export const getScreenerRules = () => apiClient.get('/portfolio/screener/rules/');
export const createScreenerRule = (data) => apiClient.post('/portfolio/screener/rules/', data);
export const updateScreenerRule = (id, data) => apiClient.put(`/portfolio/screener/rules/${id}/`, data);
export const deleteScreenerRule = (id) => apiClient.delete(`/portfolio/screener/rules/${id}/`);
export const runScreenerRule = (id) => apiClient.post(`/portfolio/screener/rules/${id}/run/`);
export const getAdminScreenerConfig = () => apiClient.get('/portfolio/admin/screener/config/');
export const updateAdminScreenerConfig = (payload) => apiClient.put('/portfolio/admin/screener/config/', payload);
export const getAdminGlobalScreenerRules = () => apiClient.get('/portfolio/admin/screener/rules/');
export const createAdminGlobalScreenerRule = (payload) => apiClient.post('/portfolio/admin/screener/rules/', payload);
export const updateAdminGlobalScreenerRule = (id, payload) => apiClient.put(`/portfolio/admin/screener/rules/${id}/`, payload);
export const deleteAdminGlobalScreenerRule = (id) => apiClient.delete(`/portfolio/admin/screener/rules/${id}/`);
export const runAdminGlobalScreenerManual = () => apiClient.post('/portfolio/admin/screener/run-manual/');

// --- Broker Integration (DNSE) ---
// DNSE LightSpeed API — backward-compatible bridge sang coreApiAdapter.
// Lưu ý: các call thực tế vẫn đi qua coreApiAdapter, không dùng retail flow cũ.
export const getDNSEConfig = () => coreApiAdapter.getDNSEConfig();
export const updateDNSEConfig = (data) => coreApiAdapter.updateDNSEConfig(data);
export const syncDNSEAccounts = () => coreApiAdapter.syncDNSEAccounts();
export const getDNSETokenStatus = () => coreApiAdapter.getDNSETokenStatus();
export const placeDNSEOrder = (data) => coreApiAdapter.placeDNSEOrder ? coreApiAdapter.placeDNSEOrder(data) : Promise.reject(new Error('DNSE place order is not implemented.'));

// --- Crawling Control API ---
export const getAdminCrawlJobs = () => apiClient.get('/v1/admin/crawl/jobs/');
export const runAdminCrawlJob = (id) => apiClient.post(`/v1/admin/crawl/jobs/${id}/run/`);
export const stopAdminCrawlJob = (id) => apiClient.post(`/v1/admin/crawl/jobs/${id}/stop/`);
export const getAdminCrawlRuns = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/v1/admin/crawl/runs/${query ? `?${query}` : ''}`);
};
export const getAdminCrawlAuditLogs = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return apiClient.get(`/v1/admin/crawl/audit-logs/${query ? `?${query}` : ''}`);
};

export default apiClient;

