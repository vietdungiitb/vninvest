import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { API_PREFIX } from '../runtimeConfig.js';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  saveAccessToken,
  saveRefreshToken,
} from './tokenStorage';

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

const authClient = axios.create({
  baseURL: API_PREFIX,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

const drainRefreshQueue = (token: string | null) => {
  refreshQueue.forEach((resolve) => resolve(token));
  refreshQueue = [];
};

authClient.interceptors.request.use(async (config) => {
  const accessToken = await getAccessToken();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

authClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const statusCode = error.response?.status;
    const originalRequest = error.config as RetryableRequest | undefined;

    if (!originalRequest || statusCode !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(authClient(originalRequest));
        });
      });
    }

    isRefreshing = true;
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        await clearTokens();
        drainRefreshQueue(null);
        return Promise.reject(error);
      }

      const refreshResponse = await axios.post<{ access: string; refresh?: string }>(
        `${API_PREFIX}/auth/token/refresh/`,
        { refresh: refreshToken },
      );

      const newAccessToken = refreshResponse.data.access;
      await saveAccessToken(newAccessToken);
      if (refreshResponse.data.refresh) {
        await saveRefreshToken(refreshResponse.data.refresh);
      }

      drainRefreshQueue(newAccessToken);
      originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
      return authClient(originalRequest);
    } catch (refreshError) {
      await clearTokens();
      drainRefreshQueue(null);
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);

export default authClient;
