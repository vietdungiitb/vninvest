/**
 * context/PortfolioContext.jsx
 * Global state: danh sách portfolios, portfolio đang chọn, JWT tokens, userconfig, CASL ability.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  getPortfolios,
  createPortfolio as createPortfolioRequest,
  updatePortfolio as updatePortfolioRequest,
  deletePortfolio as deletePortfolioRequest,
  createSubAccount as createSubAccountRequest,
  updateSubAccount as updateSubAccountRequest,
  deleteSubAccount as deleteSubAccountRequest,
} from '../api/client';
import {
  login as loginRequest,
  register as registerRequest,
  resendVerification as resendVerificationRequest,
  refreshToken as refreshTokenRequest,
  getUserConfig,
  updateUserConfig as updateUserConfigRequest,
} from '../api/auth';
import apiClient from '../api/client';
import { AbilityContext, createAbilityFromRules } from './AbilityContext';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const initialAccessToken = localStorage.getItem('access_token');
  const initialRefreshToken = localStorage.getItem('refresh_token');
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [refreshTokenValue, setRefreshTokenValue] = useState(initialRefreshToken);
  const [isAuthenticated, setIsAuthenticated] = useState(!!initialAccessToken && !!initialRefreshToken);
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [userIdentity, setUserIdentity] = useState({ username: '', email: '' });
  const [ability, setAbility] = useState(() => createAbilityFromRules([]));

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

  const saveTokens = useCallback((access, refresh) => {
    const nextRefresh = refresh || localStorage.getItem('refresh_token');
    localStorage.setItem('access_token', access);
    if (nextRefresh) {
      localStorage.setItem('refresh_token', nextRefresh);
    }
    setAccessToken(access);
    setRefreshTokenValue(nextRefresh);
    setIsAuthenticated(true);
  }, []);

  const syncAuthState = useCallback(async () => {
    const [meResult, userConfigResult] = await Promise.allSettled([
      apiClient.get('/auth/me/'),
      getUserConfig(),
    ]);

    let authFailed = false;

    if (meResult.status === 'fulfilled') {
      setUserPlan(meResult.value.data.plan || 'free');
      setAbility(createAbilityFromRules(meResult.value.data.abilities || []));
      setUserIdentity({
        username: meResult.value.data.username || '',
        email: meResult.value.data.email || '',
      });
    } else {
      if (meResult.reason?.response?.status === 401) {
        authFailed = true;
      } else {
        console.error('Sync /auth/me failed:', meResult.reason);
      }
    }

    if (userConfigResult.status === 'fulfilled') {
      setUserConfig(userConfigResult.value.data);
    } else {
      if (userConfigResult.reason?.response?.status === 401) {
        authFailed = true;
      } else {
        console.error('Sync user config failed:', userConfigResult.reason);
      }
    }

    if (authFailed) {
      logout();
      return false;
    }

    return true;
  }, [logout]);

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

  const updateUserConfig = useCallback(async (data) => {
    const response = await updateUserConfigRequest(data);
    setUserConfig(response.data);
    return response;
  }, []);

    const fetchPortfolios = useCallback(async () => {
      setLoading(true);
      try {
        const res = await getPortfolios();
        setPortfolios(res.data);
        if (res.data.length > 0) {
          setActivePortfolioId((prev) => prev || res.data[0].id);
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          logout();
          return;
        }
        console.error('Fetch portfolios failed:', err);
      } finally {
        setLoading(false);
      }
    }, [logout]);

  // ---------- Portfolio mutations ----------
  const createPortfolio = useCallback(async (data) => {
    const response = await createPortfolioRequest(data);
    await fetchPortfolios();
    return response.data;
  }, [fetchPortfolios]);

  const updatePortfolio = useCallback(async (id, data) => {
    const response = await updatePortfolioRequest(id, data);
    setPortfolios((prev) => prev.map((p) => (p.id === id ? response.data : p)));
    return response.data;
  }, []);

  const deletePortfolio = useCallback(async (id) => {
    await deletePortfolioRequest(id);
    setPortfolios((prev) => {
      const next = prev.filter((p) => p.id !== id);
      if (activePortfolioId === id) {
        setActivePortfolioId(next.length > 0 ? next[0].id : null);
      }
      return next;
    });
  }, [activePortfolioId]);

  // ---------- SubAccount mutations ----------
  const createSubAccount = useCallback(async (data) => {
    const response = await createSubAccountRequest(data);
    return response.data;
  }, []);

  const updateSubAccount = useCallback(async (id, data) => {
    const response = await updateSubAccountRequest(id, data);
    return response.data;
  }, []);

  const deleteSubAccount = useCallback(async (id) => {
    await deleteSubAccountRequest(id);
  }, []);

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!isAuthenticated || !accessToken) {
        return;
      }

      const ok = await syncAuthState();
      if (!ok || cancelled) {
        return;
      }

      await fetchPortfolios();
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, syncAuthState, fetchPortfolios]);

  const contextValue = useMemo(() => ({
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
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    createSubAccount,
    updateSubAccount,
    deleteSubAccount,
  }), [
    portfolios, activePortfolioId, isAuthenticated, login, register,
    resendVerification, logout, refreshAccessToken, userConfig,
    updateUserConfig, loading, fetchPortfolios, userPlan, userIdentity,
    ability, createPortfolio, updatePortfolio, deletePortfolio,
    createSubAccount, updateSubAccount, deleteSubAccount,
  ]);

  return (
    <AbilityContext.Provider value={ability}>
      <PortfolioContext.Provider value={contextValue}>
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

