/**
 * context/PortfolioContext.jsx
 * Global state: danh sách portfolios, portfolio đang chọn, JWT tokens, userconfig.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPortfolios } from '../api/client';
import { login, refreshToken, getUserConfig, updateUserConfig } from '../api/auth';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('access_token'));
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refresh_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'));
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(false);

  const saveTokens = (access, refresh) => {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    setAccessToken(access);
    setRefreshToken(refresh);
    setIsAuthenticated(true);
  };

  const login = useCallback(async (username, password) => {
    const response = await login({ username, password });
    saveTokens(response.data.access, response.data.refresh);
    return response.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setAccessToken(null);
    setRefreshToken(null);
    setIsAuthenticated(false);
    setPortfolios([]);
    setActivePortfolioId(null);
    setUserConfig(null);
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const response = await refreshToken(refreshToken);
      saveTokens(response.data.access, response.data.refresh);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [refreshToken, logout]);

  const fetchPortfolios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPortfolios();
      setPortfolios(res.data);
      if (res.data.length > 0 && !activePortfolioId) {
        setActivePortfolioId(res.data[0].id);
      }
    } catch (err) {
      console.error('Fetch portfolios failed:', err);
    } finally {
      setLoading(false);
    }
  }, [activePortfolioId]);

  const fetchUserConfig = useCallback(async () => {
    try {
      const res = await getUserConfig();
      setUserConfig(res.data);
    } catch (err) {
      console.error('Fetch user config failed:', err);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchPortfolios();
      fetchUserConfig();
    }
  }, [isAuthenticated, accessToken]);

  return (
    <PortfolioContext.Provider value={{
      portfolios,
      activePortfolioId,
      setActivePortfolioId,
      isAuthenticated,
      login,
      logout,
      refreshAccessToken,
      userConfig,
      updateUserConfig,
      loading,
      fetchPortfolios,
    }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}

