import { createContext, useContext, useState, useEffect, useCallback, useMemo, createElement } from 'react';
import { authTokenStorage, coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { AbilityContext, createAbilityFromRules } from './AbilityContext.js';

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [portfolios, setPortfolios] = useState([]);
  const [activePortfolioId, setActivePortfolioId] = useState(null);
  const initialAccessToken = authTokenStorage.getAccessToken();
  const initialRefreshToken = authTokenStorage.getRefreshToken();
  const hasInitialTokens = Boolean(initialAccessToken && initialRefreshToken);
  const [accessToken, setAccessToken] = useState(initialAccessToken);
  const [refreshTokenValue, setRefreshTokenValue] = useState(initialRefreshToken);
  const [isAuthenticated, setIsAuthenticated] = useState(hasInitialTokens);
  const [authStateReady, setAuthStateReady] = useState(!hasInitialTokens);
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [userIdentity, setUserIdentity] = useState({ id: null, username: '', email: '', isStaff: false, isSuperuser: false });
  const [userEntitlements, setUserEntitlements] = useState(null);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState(null);
  const [ability, setAbility] = useState(() => createAbilityFromRules([]));
  const [userTenants, setUserTenants] = useState([]);

  const logout = useCallback(() => {
    authTokenStorage.clearTokens();
    setAccessToken(null);
    setRefreshTokenValue(null);
    setIsAuthenticated(false);
    setPortfolios([]);
    setActivePortfolioId(null);
    setUserConfig(null);
    setUserPlan('free');
    setUserIdentity({ id: null, username: '', email: '', isStaff: false, isSuperuser: false });
    setUserEntitlements(null);
    setCapabilitySnapshot(null);
    setAbility(createAbilityFromRules([]));
    setUserTenants([]);
    setAuthStateReady(true);
  }, []);

  const saveTokens = useCallback((access, refresh) => {
    const nextRefresh = refresh || authTokenStorage.getRefreshToken();
    authTokenStorage.setTokens({ access, refresh: nextRefresh });
    setAccessToken(access);
    setRefreshTokenValue(nextRefresh);
    setIsAuthenticated(true);
    setAuthStateReady(false);
  }, []);

  const syncAuthState = useCallback(async () => {
    try {
      const [profile, tenantLifecycle] = await Promise.all([
        coreApiAdapter.getUserProfile(),
        coreApiAdapter.getTenantLifecycle().catch(() => ({ plan: 'free' })),
      ]);

      setUserPlan(tenantLifecycle?.plan || profile?.plan || 'free');
      setUserIdentity({
        id: profile?.id || profile?.user_id || null,
        username: profile?.username || '',
        email: profile?.email || '',
        isStaff: Boolean(profile?.is_staff || profile?.isStaff),
        isSuperuser: Boolean(profile?.is_superuser || profile?.isSuperuser),
      });

      // Map user profile to userConfig structure
      const mappedConfig = {
        language: profile?.language || 'vi',
        theme: profile?.theme || 'dark',
        whale_alert_threshold: profile?.whale_alert_threshold || '500000000',
      };
      setUserConfig(mappedConfig);

      // Simple capability / ability mapping
      const rules = profile?.abilities || profile?.rules || [];
      setAbility(createAbilityFromRules(rules));
      setUserEntitlements(profile?.entitlements || null);
      setCapabilitySnapshot({
        abilities: rules,
        entitlements: profile?.entitlements || null,
        actor: { plan: tenantLifecycle?.plan || 'free' },
      });
      setUserTenants(profile?.tenants || []);
      if (typeof window !== "undefined" && window.localStorage) {
        const storedTenantId = window.localStorage.getItem("tenant_id");
        if (!storedTenantId && profile?.tenant?.tenant_id) {
          window.localStorage.setItem("tenant_id", profile.tenant.tenant_id);
        }
      }

      return true;
    } catch (error) {
      if (error?.status === 401 || error?.statusCode === 401) {
        logout();
        return false;
      }
      console.error('Sync auth state failed:', error);
      return false;
    }
  }, [logout]);

  const login = useCallback(async (username, password) => {
    const payload = await coreApiAdapter.loginUser({ username: username.trim(), password });
    const tokenPayload = payload?.data?.access ? payload.data : payload;
    if (!tokenPayload?.access) {
      throw new Error('Không nhận được access token hợp lệ từ phiên đăng nhập.');
    }
    saveTokens(tokenPayload?.access, tokenPayload?.refresh);
    await syncAuthState();
    return tokenPayload;
  }, [syncAuthState, saveTokens]);

  const register = useCallback(async ({ username, email, password, passwordConfirm }) => {
    return coreApiAdapter.registerUser({
      username: username.trim(),
      email: email.trim(),
      password,
      password_confirm: passwordConfirm,
    });
  }, []);

  const resendVerification = useCallback(async (identifier) => {
    return coreApiAdapter.resendVerificationEmail(identifier.trim());
  }, []);

  const refreshAccessToken = useCallback(async () => {
    try {
      const activeRefreshToken = refreshTokenValue || authTokenStorage.getRefreshToken();
      if (!activeRefreshToken) {
        logout();
        return false;
      }
      const payload = await coreApiAdapter.refreshAuthToken(activeRefreshToken);
      const tokenPayload = payload?.data?.access ? payload.data : payload;
      if (!tokenPayload?.access) {
        throw new Error('Không nhận được access token hợp lệ khi làm mới phiên.');
      }
      saveTokens(tokenPayload?.access, tokenPayload?.refresh);
      return true;
    } catch {
      logout();
      return false;
    }
  }, [refreshTokenValue, logout, saveTokens]);

  const updateUserConfig = useCallback(async (data) => {
    // Map settings update back to profile update
    const profilePayload = {};
    if (data.language) profilePayload.language = data.language;
    if (data.theme) profilePayload.theme = data.theme;
    if (data.whale_alert_threshold) profilePayload.whale_alert_threshold = Number(data.whale_alert_threshold);

    const response = await coreApiAdapter.updateUserProfile(profilePayload);
    const updatedConfig = {
      language: response?.language || 'vi',
      theme: response?.theme || 'dark',
      whale_alert_threshold: response?.whale_alert_threshold || '500000000',
    };
    setUserConfig(updatedConfig);
    return { data: updatedConfig };
  }, []);

  const fetchPortfolios = useCallback(async () => {
    setLoading(true);
    try {
      const res = await coreApiAdapter.getPortfolios();
      const nextPortfolios = Array.isArray(res)
        ? res
        : Array.isArray(res?.results)
          ? res.results
          : Array.isArray(res?.data)
            ? res.data
            : [];
      setPortfolios(nextPortfolios);
      if (nextPortfolios.length > 0) {
        setActivePortfolioId((prev) => prev || nextPortfolios[0].id);
      }
    } catch (err) {
      if (err?.status === 401 || err?.statusCode === 401) {
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
    const response = await coreApiAdapter.createPortfolio(data);
    await fetchPortfolios();
    return response;
  }, [fetchPortfolios]);

  const updatePortfolio = useCallback(async (id, data) => {
    const response = await coreApiAdapter.updatePortfolio(id, data);
    setPortfolios((prev) => prev.map((p) => (p.id === id ? response : p)));
    return response;
  }, []);

  const deletePortfolio = useCallback(async (id) => {
    await coreApiAdapter.deletePortfolio(id);
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
    const response = await coreApiAdapter.createSubAccount(data);
    return response;
  }, []);

  const updateSubAccount = useCallback(async (id, data) => {
    const response = await coreApiAdapter.updateSubAccount(id, data);
    return response;
  }, []);

  const deleteSubAccount = useCallback(async (id) => {
    await coreApiAdapter.deleteSubAccount(id);
  }, []);

  // Load initial data
  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!isAuthenticated || !accessToken) {
        setAuthStateReady(true);
        return;
      }

      setAuthStateReady(false);

      const ok = await syncAuthState();
      if (!ok || cancelled) {
        if (!cancelled) {
          setAuthStateReady(true);
        }
        return;
      }

      await fetchPortfolios();
      if (!cancelled) {
        setAuthStateReady(true);
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, accessToken, syncAuthState, fetchPortfolios]);

  const switchTenant = useCallback((tenantId) => {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("tenant_id", tenantId);
      window.location.reload();
    }
  }, []);

  const contextValue = useMemo(() => ({
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    isAuthenticated,
    authStateReady,
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
    userEntitlements,
    capabilitySnapshot,
    ability,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    createSubAccount,
    updateSubAccount,
    deleteSubAccount,
    userTenants,
    switchTenant,
    activeTenantId: typeof window !== "undefined" && window.localStorage ? window.localStorage.getItem("tenant_id") : null,
  }), [
    portfolios, activePortfolioId, isAuthenticated, authStateReady, login, register,
    resendVerification, logout, refreshAccessToken, userConfig,
    updateUserConfig, loading, fetchPortfolios, userPlan, userIdentity,
    userEntitlements,
    capabilitySnapshot,
    ability, createPortfolio, updatePortfolio, deletePortfolio,
    createSubAccount, updateSubAccount, deleteSubAccount,
    userTenants, switchTenant,
  ]);

  return createElement(
    AbilityContext.Provider,
    { value: ability },
    createElement(PortfolioContext.Provider, { value: contextValue }, children)
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error('usePortfolio must be used inside PortfolioProvider');
  return ctx;
}
