/**
 * api/client.js
 * Axios client với JWT auth interceptor.
 * BaseURL từ REACT_APP_API_BASE_URL hoặc proxy /api -> backend:8000
 */
import axios from 'axios';

const apiBaseURL = process.env.REACT_APP_API_BASE_URL || '/api';

const apiClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

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
  (res) => res,
  async (err) => {
    const originalRequest = err.config;
    if (err.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${apiBaseURL}/auth/token/refresh/`, {
            refresh: refreshToken,
          });
          localStorage.setItem('access_token', data.access);
          // Only overwrite refresh_token when server rotates it (ROTATE_REFRESH_TOKENS=True)
          // If rotation is off, data.refresh is undefined — do NOT overwrite valid stored token
          if (data.refresh) {
            localStorage.setItem('refresh_token', data.refresh);
          }
          originalRequest.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(originalRequest);
        } catch (refreshErr) {
          // Refresh fail -> logout
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return Promise.reject(refreshErr);
        }
      } else {
        window.location.href = '/login';
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
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post(`${apiBaseURL}/auth/token/refresh/`, {
      refresh: refreshToken,
    });
    localStorage.setItem('access_token', data.access);
    if (data.refresh) {
      localStorage.setItem('refresh_token', data.refresh);
    }
    return data.access;
  } catch {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    return null;
  }
};

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
  apiClient.get(`/portfolio/portfolios/${portfolioId}/holdings/`);
export const getSummary = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/summary/`);
export const getChartData = (portfolioId, days = 90) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/chart/?days=${days}`);

export const getEquityCurve = (portfolioId, days = 180) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/equity-curve/?days=${days}`);
export const getAllocation = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/allocation/`);
export const getAllocationBySector = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/allocation/?by=sector`);
export const getAnalytics = (portfolioId, days = 365) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/analytics/?days=${days}`);

// --- Sync ---
export const syncPrices = (portfolioId, days = 30) =>
  apiClient.post(`/portfolio/portfolios/${portfolioId}/sync/`, { days });

// --- Sync StockProfile (trigger backend sync) ---
export const syncStockProfile = () => apiClient.post('/admin-sync/stockprofile/');

// --- Watchlist ---
export const getWatchlistGroups = () => apiClient.get('/portfolio/watchlist/groups/');
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
export const getStockPriceChart = (symbol, days = 180) => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/chart/?days=${days}`);
export const getStockOrderFlow = (symbol, window = '30m') => apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/order-flow/`, { params: { window } });
export const getStockAIAdvisorySession = (symbol) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-session/`);
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
export const regenerateStockAIExecutiveSummary = (symbol, payload = {}) =>
  apiClient.post(`/stock-management/stocks/${encodeURIComponent(symbol)}/ai-advisory-summary/regenerate/`, payload);
export const getRealtimeTicker = (symbol) => apiClient.get(`/realtime/ticker/${symbol}/`);
export const getIntradayMatched = (symbol, pageSize = 50) =>
  apiClient.get(`/realtime/intraday/${encodeURIComponent(symbol)}/?page_size=${pageSize}`);
export const getPriceBoard = (symbol) =>
  apiClient.get(`/realtime/price-board/${encodeURIComponent(symbol)}/`);
export const getSectorBreadth = (symbol) =>
  apiClient.get(`/realtime/breadth/${encodeURIComponent(symbol)}/`);
export const getWhaleFeed = (symbol) =>
  apiClient.get(`/realtime/whale-feed/${encodeURIComponent(symbol)}/`);
export const getAggregateWhaleFeed = ({ symbols, watchlistGroupIds, sort = 'ts', limit = 12, cursor } = {}) => {
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
  if (limit) {
    params.set('limit', String(limit));
  }
  if (cursor) {
    params.set('cursor', cursor);
  }
  const queryString = params.toString();
  return apiClient.get(`/realtime/whale-feed/aggregate/${queryString ? `?${queryString}` : ''}`);
};
export const getWhaleAdvisories = () => apiClient.get('/portfolio/whale-advisory/');
export const refreshWhaleAdvisory = (symbol) =>
  apiClient.post(`/portfolio/whale-advisory/${encodeURIComponent(symbol)}/refresh/`);
export const getAIOptions = () => apiClient.get('/ai-options/');
export const getUserConfig = () => apiClient.get('/ai-config/');
export const updateUserConfig = (data) => apiClient.put('/ai-config/', data);
export const testAIConnection = (data) => apiClient.post('/ai-config/test-connection/', data);
export const getRVOL = (symbol) =>
  apiClient.get(`/realtime/rvol/${encodeURIComponent(symbol)}/`);
export const getDepthChart = (symbol) =>
  apiClient.get(`/realtime/depth-chart/${encodeURIComponent(symbol)}/`);

export const getStockFinancials = (symbol) =>
  apiClient.get(`/stock-management/stocks/${encodeURIComponent(symbol)}/financials/`);

export const getRealtimeWebSocketUrl = (token) => {
  const normalizedToken = token || localStorage.getItem('access_token') || '';
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
export const getTrackedSymbols = () => apiClient.get('/stock-management/tracked-symbols/');
export const addTrackedSymbol = (symbol, sourceGroupId = null) =>
  apiClient.post('/stock-management/tracked-symbols/', { symbol, source_group_id: sourceGroupId });
export const deleteTrackedSymbol = (id) => apiClient.delete(`/stock-management/tracked-symbols/${id}/`);

export const getPriceAlerts = () => apiClient.get('/stock-management/price-alerts/');
export const createPriceAlert = (data) => apiClient.post('/stock-management/price-alerts/', data);
export const updatePriceAlert = (id, data) => apiClient.patch(`/stock-management/price-alerts/${id}/`, data);
export const deletePriceAlert = (id) => apiClient.delete(`/stock-management/price-alerts/${id}/`);

// --- Health / Observability (public, no auth needed) ---
export const getRealtimeHealth = () =>
  axios.get(`${apiBaseURL.replace(/\/api$/, '')}/api/health/realtime/`);
export const markPriceAlertTriggered = (id) => apiClient.post(`/stock-management/price-alerts/${id}/mark-triggered/`);

// --- Admin Ops (is_staff only) ---
export const getAdminOpsStats = () => apiClient.get('/admin-ops/stats/');
export const warmTickerPrefetch = (mode = 'async') =>
  apiClient.post(`/admin-ops/prefetch/warm/?mode=${encodeURIComponent(mode)}`);
export const syncMarketGroups = (mode = 'all', clear = false) =>
  apiClient.post(`/admin-ops/market-groups/sync/?mode=${mode}&clear=${clear}`);

// --- Screener ---
export const getScreenerRules = () => apiClient.get('/portfolio/screener/rules/');
export const createScreenerRule = (data) => apiClient.post('/portfolio/screener/rules/', data);
export const updateScreenerRule = (id, data) => apiClient.put(`/portfolio/screener/rules/${id}/`, data);
export const deleteScreenerRule = (id) => apiClient.delete(`/portfolio/screener/rules/${id}/`);
export const runScreenerRule = (id) => apiClient.post(`/portfolio/screener/rules/${id}/run/`);

export default apiClient;

