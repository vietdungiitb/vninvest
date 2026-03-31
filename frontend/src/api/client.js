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
          localStorage.setItem('refresh_token', data.refresh);
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

// --- Sync ---
export const syncPrices = (portfolioId, days = 30) =>
  apiClient.post(`/portfolio/portfolios/${portfolioId}/sync/`, { days });

// --- Sync StockProfile (trigger backend sync) ---
export const syncStockProfile = () => apiClient.post('/sync-stockprofile/');

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
export const getSecuritiesGroups = () => apiClient.get('/portfolio/Securities/groups/');
export const createSecuritiesGroup = (data) => apiClient.post('/portfolio/Securities/groups/', data);
export const updateSecuritiesGroup = (id, data) => apiClient.patch(`/portfolio/Securities/groups/${id}/`, data);
export const deleteSecuritiesGroup = (id) => apiClient.delete(`/portfolio/Securities/groups/${id}/`);
export const addSecuritiesItem = (groupId, data) => apiClient.post(`/portfolio/Securities/groups/${groupId}/items/`, data);
export const deleteSecuritiesItem = (itemId) => apiClient.delete(`/portfolio/Securities/items/${itemId}/`);
export const seedSecurities = () => apiClient.post('/portfolio/Securities/seed/');
export const syncSecuritiesPrices = (days = 5) => apiClient.post('/portfolio/Securities/sync/', { days });
export const getStockProfile = (symbol) => apiClient.get(`/portfolio/stockprofile/${symbol}/`);

// --- Mã Theo dõi (personal tracked symbols) ---
export const getTrackedSymbols = () => apiClient.get('/portfolio/tracked-symbols/');
export const addTrackedSymbol = (symbol, sourceGroupId = null) =>
  apiClient.post('/portfolio/tracked-symbols/', { symbol, source_group_id: sourceGroupId });
export const deleteTrackedSymbol = (id) => apiClient.delete(`/portfolio/tracked-symbols/${id}/`);

export default apiClient;

