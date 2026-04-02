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

// --- Portfolio APIs (prefix portfolio/ theo urls.py) ---
export const getPortfolios = () => apiClient.get('/portfolio/portfolios/');
export const createPortfolio = (data) => apiClient.post('/portfolio/portfolios/', data);
export const getPortfolio = (id) => apiClient.get(`/portfolio/portfolios/${id}/`);
export const updatePortfolio = (id, data) => apiClient.put(`/portfolio/portfolios/${id}/`, data);
export const deletePortfolio = (id) => apiClient.delete(`/portfolio/portfolios/${id}/`);

// --- Transaction APIs ---

export const getSubAccounts = () => apiClient.get('/portfolio/subaccounts/');
export const getTransactions = (subAccountId) =>
  apiClient.get(`/portfolio/subaccounts/${subAccountId}/transactions/`);
export const createTransaction = (subAccountId, data) =>
  apiClient.post(`/portfolio/subaccounts/${subAccountId}/transactions/`, data);

export const updateTransaction = (id, data) =>
  apiClient.put(`/portfolio/transactions/${id}/`, data);
export const deleteTransaction = (id) =>
  apiClient.delete(`/portfolio/transactions/${id}/`);

// --- Analytics APIs ---
export const getHoldings = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/holdings/`);
export const getSummary = (portfolioId) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/summary/`);
export const getChartData = (portfolioId, days = 90) =>
  apiClient.get(`/portfolio/portfolios/${portfolioId}/chart/?days=${days}`);
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
export const getRealtimeTicker = (symbol) => apiClient.get(`/realtime/ticker/${symbol}/`);

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

export default apiClient;

