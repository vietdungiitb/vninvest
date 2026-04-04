/**
 * context/PortfolioContext.jsx
 * Global state: danh sách portfolios, portfolio đang chọn, JWT tokens, userconfig, CASL ability.
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getPortfolios } from '../api/client';
import {
  login as loginRequest,
  register as registerRequest,
  resendVerification as resendVerificationRequest,
  refreshToken as refreshTokenRequest,
  getUserConfig,
  updateUserConfig,
} from '../api/auth';
import apiClient from '../api/client';
import { AbilityContext, createAbilityFromRules } from './AbilityContext';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const [accessToken, setAccessToken] = useState(localStorage.getItem('access_token'));
  const [refreshTokenValue, setRefreshTokenValue] = useState(localStorage.getItem('refresh_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('access_token'));
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [userIdentity, setUserIdentity] = useState({ username: '', email: '' });
  const [ability, setAbility] = useState(() => createAbilityFromRules([]));

  const _fetchMe = useCallback(async () => {
    try {
      const res = await apiClient.get('/auth/me/');
      setUserPlan(res.data.plan || 'free');
      setAbility(createAbilityFromRules(res.data.abilities || []));
      setUserIdentity({
        username: res.data.username || '',
        email: res.data.email || '',
      });
    } catch (err) {
      console.error('Fetch /auth/me failed:', err);
    }
  }, []);

  const saveTokens = (access, refresh) => {
    const nextRefresh = refresh || localStorage.getItem('refresh_token');
    localStorage.setItem('access_token', access);
    if (nextRefresh) {
      localStorage.setItem('refresh_token', nextRefresh);
    }
    setAccessToken(access);
    setRefreshTokenValue(nextRefresh);
    setIsAuthenticated(true);
  };

  const syncAuthState = useCallback(async () => {
    const [meResult, userConfigResult] = await Promise.allSettled([
      apiClient.get('/auth/me/'),
      getUserConfig(),
    ]);

    if (meResult.status === 'fulfilled') {
      setUserPlan(meResult.value.data.plan || 'free');
      setAbility(createAbilityFromRules(meResult.value.data.abilities || []));
      setUserIdentity({
        username: meResult.value.data.username || '',
        email: meResult.value.data.email || '',
      });
    } else {
      console.error('Sync /auth/me failed:', meResult.reason);
    }

    if (userConfigResult.status === 'fulfilled') {
      setUserConfig(userConfigResult.value.data);
    } else {
      console.error('Sync user config failed:', userConfigResult.reason);
    }
  }, []);

  const login = useCallback(async (username, password) => {
    const response = await loginRequest(username.trim(), password);
    saveTokens(response.data.access, response.data.refresh);
    await syncAuthState();
    return response.data;
  }, [syncAuthState]);

  const register = useCallback(async ({ username, email, password, passwordConfirm }) => {
    const response = await registerRequest({
      username: username.trim(),
      email: email.trim(),
      password,
      password_confirm: passwordConfirm,
    });
    return response.data;
  }, []);

  const resendVerification = useCallback(async (identifier) => {
    const response = await resendVerificationRequest(identifier.trim());
    return response.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setAccessToken(null);
    setRefreshTokenValue(null);
    setIsAuthenticated(false);
    setPortfolios([]);
    setActivePortfolioId(null);
    setUserConfig(null);
    setUserPlan('free');
    setUserIdentity({ username: '', email: '' });
    setAbility(createAbilityFromRules([]));
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const activeRefreshToken = refreshTokenValue || localStorage.getItem('refresh_token');
      if (!activeRefreshToken) {
        logout();
        return false;
      }
      const response = await refreshTokenRequest(activeRefreshToken);
      saveTokens(response.data.access, response.data.refresh);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [refreshTokenValue, logout]);

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
      _fetchMe();
    }
  }, [isAuthenticated, accessToken, fetchPortfolios, fetchUserConfig, _fetchMe]);

  return (
    <AbilityContext.Provider value={ability}>
      <PortfolioContext.Provider value={{
        portfolios,
        activePortfolioId,
        setActivePortfolioId,
        isAuthenticated,
        login,
        register,
        resendVerification,
        logout,
        refreshAccessToken,
        userConfig,
        updateUserConfig,
        loading,
        fetchPortfolios,
        userPlan,
        userIdentity,
        ability,
      }}>
        {children}
      </PortfolioContext.Provider>
    </AbilityContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}

