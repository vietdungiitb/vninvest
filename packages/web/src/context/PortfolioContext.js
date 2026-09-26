import { createContext, useContext, useState, useEffect, useCallback, useMemo, createElement, useRef } from 'react';
import { authTokenStorage, coreApiAdapter, tenantIdStorage } from '../adapters/coreApiAdapter.js';
import { clearStaffSwitchSession, CORE_TOKENS_CLEARED_EVENT } from '../adapters/core/transport.js';
import { AbilityContext, createAbilityFromRules } from './AbilityContext.js';

const PortfolioContext = createContext(null);

const BOOTSTRAP_TIMEOUT_MS = 15000;
const LOGOUT_REVOKE_TIMEOUT_MS = 5000;

/**
 * E6 (P1) — unit is **millions of VND**, not raw VND.
 * Backend evidence:
 *   - `UserProfile.whale_alert_threshold = DecimalField(max_digits=12,
 *     decimal_places=0, default=500, verbose_name='Ngưỡng lệnh cá mập (triệu
 *     VNĐ)')` — identity_access/models.py:507-512 (i.e. 500 = 500 triệu).
 *   - `GET /identity/profile/` returns it verbatim as a string —
 *     identity_access/views_tenant.py:290.
 *   - `PATCH` stores `max(1, int(value))` unchanged —
 *     identity_access/views/helpers.py:311-316, so a wrong unit is persisted
 *     as-is and there is no server-side unit conversion to absorb it.
 * The old fallback `'500000000'` was raw VND: 6 orders of magnitude out, and it
 * would have been written straight back by `updateUserConfig`.
 */
const DEFAULT_WHALE_ALERT_THRESHOLD_MILLIONS = 500;

const EMPTY_IDENTITY = Object.freeze({
  id: null,
  username: '',
  email: '',
  isStaff: false,
  isSuperuser: false,
  display_name: '',
  avatar_url: null,
});

/**
 * Cross-tab signal that the local session is gone (E10). main.tsx /
 * ProtectedRoute is not in this slice's file set, so the error is published two
 * ways: on the context (`authStateError`) and as a window event the shell can
 * subscribe to. Slice D / coordinator wiring is listed in the slice-E report.
 */
const AUTH_STATE_ERROR_EVENT = 'core-auth-state-error';

function emitWindowEvent(name, detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  if (typeof CustomEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

function withTimeout(promise, ms, label) {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function errorStatus(error) {
  const status = error?.status ?? error?.statusCode ?? null;
  return Number.isFinite(Number(status)) ? Number(status) : null;
}

/**
 * E1 (P0) + slice B: `TenantScopePermission` now READS `X-Tenant-ID` and
 * resolves by `public_id`, and a malformed value is a 403. So a tenant id left
 * behind by a previous session (or by a user who has since lost membership) is
 * no longer silently ignored — it 403s every request that carries the header.
 * `tenants` comes from the backend's own membership query
 * (`Q(owner_user=user) | Q(members__user=user)`, views_tenant.py:278) and is
 * therefore authoritative, so a mismatch is repaired here instead of wedging
 * the account.
 */
function reconcileActiveTenantId(authoritativeTenants) {
  const membership = (Array.isArray(authoritativeTenants) ? authoritativeTenants : [])
    .map((tenant) => (tenant && (tenant.tenant_id || tenant.public_id || tenant.id)) || null)
    .filter(Boolean)
    .map(String);

  const stored = tenantIdStorage.getTenantId();
  const storedKey = stored ? String(stored) : null;

  if (membership.length === 0) {
    // Authoritative: this account has no workspace. Any stored id is stale.
    if (storedKey) tenantIdStorage.clearTenantId();
    return null;
  }

  if (storedKey && membership.includes(storedKey)) return storedKey;

  const next = membership[0];
  if (storedKey) {
    console.warn(
      `[auth] stored workspace "${storedKey}" is not a member of this account; resetting to "${next}"`,
    );
  }
  tenantIdStorage.setTenantId(next);
  return next;
}

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
  const [authStateError, setAuthStateError] = useState(null);
  const [authBootstrapNonce, setAuthBootstrapNonce] = useState(0);
  const [userConfig, setUserConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [userPlan, setUserPlan] = useState('free');
  const [userIdentity, setUserIdentity] = useState(EMPTY_IDENTITY);
  const [userEntitlements, setUserEntitlements] = useState(null);
  const [capabilitySnapshot, setCapabilitySnapshot] = useState(null);
  const [ability, setAbility] = useState(() => createAbilityFromRules([]));
  const [userTenants, setUserTenants] = useState([]);
  const [activeTenantId, setActiveTenantIdState] = useState(() => tenantIdStorage.getTenantId());

  /**
   * E7 (P1) — a late bootstrap/refresh response must never write state after
   * the session ended. `logout` bumps the epoch; every async writer captures
   * the epoch it started with and drops its result if the epoch moved on.
   *
   * Deliberately NOT an `AbortController`: `coreGet` dedupes in-flight GETs by
   * path (`inflightGetCache`, transport.js:381-415), so a per-caller signal
   * would abort a request that other components are also awaiting. Dropping the
   * result is equivalent from the user's point of view and has no cross-talk.
   */
  const sessionEpochRef = useRef(0);
  const isStaleEpoch = (epoch) => epoch !== null && epoch !== undefined && sessionEpochRef.current !== epoch;

  const publishAuthError = useCallback((payload) => {
    setAuthStateError(payload);
    emitWindowEvent(AUTH_STATE_ERROR_EVENT, payload);
  }, []);

  const retryAuthBootstrap = useCallback(() => {
    setAuthStateError(null);
    setAuthBootstrapNonce((nonce) => nonce + 1);
  }, []);

  /**
   * Everything that must happen when the session ends, regardless of *why*.
   * Idempotent and unconditional — a failed server-side revoke must never leave
   * the user stuck in a half-authenticated shell.
   */
  const clearLocalSession = useCallback(() => {
    sessionEpochRef.current += 1;
    authTokenStorage.clearTokens();
    // E2 (P0): a stale tenant id left in storage used to be silently ignored by
    // the backend; after slice B it is a hard 403 on every request, so user B
    // logging in on a shared browser would inherit user A's workspace id.
    tenantIdStorage.clearTenantId();
    // E2: the R5 view-as-tenant token is per-tab sessionStorage; leaving it
    // behind would silently re-apply the previous user's impersonation.
    clearStaffSwitchSession();
    setAccessToken(null);
    setRefreshTokenValue(null);
    setIsAuthenticated(false);
    setPortfolios([]);
    setActivePortfolioId(null);
    setUserConfig(null);
    setUserPlan('free');
    setUserIdentity(EMPTY_IDENTITY);
    setUserEntitlements(null);
    setCapabilitySnapshot(null);
    setAbility(createAbilityFromRules([]));
    setUserTenants([]);
    setActiveTenantIdState(null);
    setAuthStateReady(true);
  }, []);

  /**
   * E2 (P0) — logout never revoked the PAT, so the raw credential stayed valid
   * server-side for `CORE_HUMAN_SESSION_PAT_HOURS` (default 12,
   * views/helpers.py:36,45), and it never cleared `tenant_id` / `staff_switch`.
   *
   * The revoke is attempted BEFORE the local clear (so the request is built
   * while the token is still in storage) but bounded, and the local clear runs
   * in `finally` — a dead network must not strand the user. Never rejects, so
   * fire-and-forget callers are safe.
   */
  const logout = useCallback(async () => {
    try {
      if (authTokenStorage.hasTokens()) {
        await withTimeout(
          coreApiAdapter.corePost('/auth/logout/'),
          LOGOUT_REVOKE_TIMEOUT_MS,
          'logout revoke',
        );
      }
    } catch (error) {
      console.warn(
        '[auth] server-side session revoke failed; clearing the local session anyway:',
        error?.message || error,
      );
    } finally {
      clearLocalSession();
    }
  }, [clearLocalSession]);

  // E10: another tab removed the token. Clear local state only — the token is
  // already gone, so there is nothing left to revoke. Deliberately writes
  // nothing to storage: that would fire a fresh `storage` event back at the tab
  // that cleared it and could ping-pong.
  useEffect(() => {
    const onTokensCleared = () => clearLocalSession();
    window.addEventListener(CORE_TOKENS_CLEARED_EVENT, onTokensCleared);
    return () => window.removeEventListener(CORE_TOKENS_CLEARED_EVENT, onTokensCleared);
  }, [clearLocalSession]);

  // Sync activeTenantId across tabs, and re-broadcast so the other tab's query
  // caches are invalidated too — a switch in tab A changes the tenant every
  // request from tab B will be sent with.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const handleStorage = (e) => {
      if (e.key !== 'tenant_id') return;
      const next = e.newValue || null;
      setActiveTenantIdState(next);
      emitWindowEvent('tenant-changed', { tenantId: next, crossTab: true });
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const saveTokens = useCallback((access, refresh) => {
    const nextRefresh = refresh || authTokenStorage.getRefreshToken();
    authTokenStorage.setTokens({ access, refresh: nextRefresh });
    setAccessToken(access);
    setRefreshTokenValue(nextRefresh);
    setIsAuthenticated(true);
    setAuthStateReady(false);
  }, []);

  const syncAuthState = useCallback(async (options = {}) => {
    const epoch = options?.epoch;
    const authPayload = options?.authPayload || null;
    const isStale = () => isStaleEpoch(epoch);

    let session = null;
    let profile = null;
    let firstError = null;

    try {
      /**
       * E5 (P1) — the FE read five keys the backend never returns.
       * `GET /identity/profile/` (views_tenant.py:281-294) returns exactly
       * {username, email, is_staff, is_superuser, display_name, avatar_url,
       * language, theme, whale_alert_threshold, preferences, tenants[],
       * abilities[]} — no `id`, no `entitlements`, no `plan`, no `tenant`. So
       * `userIdentity.id` was always null, `userEntitlements` /
       * `capabilitySnapshot.entitlements` were always null (the tenant
       * capabilities page renders an empty table), and because the tenant id was
       * seeded only from the non-existent `profile.tenant.tenant_id`, the
       * workspace <select> rendered `value=''` with no matching option.
       *
       * `GET /auth/me/` (views/profile.py:64-80) returns all of them — `id`,
       * `entitlements`, `plan`, `tenant`, `tenants[]`, `abilities` — and is
       * already routed (urls.py:20-21) and throttled for exactly this bootstrap
       * (`auth_bootstrap` bucket, helpers.py:21-26 / settings.py:325).
       * Both are fetched: the session payload carries identity + entitlements,
       * the profile carries display_name / avatar_url / language / theme /
       * whale_alert_threshold, which `/auth/me/` does not return.
       */
      const [sessionResult, profileResult] = await Promise.allSettled([
        coreApiAdapter.coreGet('/auth/me/'),
        coreApiAdapter.getUserProfile(),
      ]);
      if (isStale()) return false;
      if (sessionResult.status === 'fulfilled') session = sessionResult.value;
      else firstError = sessionResult.reason;
      if (profileResult.status === 'fulfilled') profile = profileResult.value;
      else if (!firstError) firstError = profileResult.reason;

      /**
       * E1 + slice B, second-order effect: `IsTenantActive` reads
       * `request.tenant`, and the resolver answers **403** for a `X-Tenant-ID`
       * it cannot resolve. So a workspace id left behind by a previous session
       * (or by another user of a shared browser) makes BOTH identity calls 403
       * on a plain page reload. That is not an auth failure — logging out here
       * would strand a signed-in user who merely has a stale id.
       *
       * Drop the id and retry once, unauthenticated-by-tenant. Only a 401 is
       * treated as a dead session.
       */
      if (
        !session
        && !profile
        && errorStatus(firstError) === 403
        && tenantIdStorage.getTenantId()
      ) {
        console.warn(
          '[auth] identity call rejected with 403; dropping the stored workspace id and retrying',
        );
        tenantIdStorage.clearTenantId();
        setActiveTenantIdState(null);
        const retry = await Promise.allSettled([
          coreApiAdapter.coreGet('/auth/me/'),
          coreApiAdapter.getUserProfile(),
        ]);
        if (isStale()) return false;
        session = retry[0].status === 'fulfilled' ? retry[0].value : null;
        profile = retry[1].status === 'fulfilled' ? retry[1].value : null;
        firstError = session
          ? null
          : retry[0].status === 'rejected'
            ? retry[0].reason
            : retry[1].status === 'rejected'
              ? retry[1].reason
              : firstError;
      }

      if (!session && !profile) {
        const status = errorStatus(firstError);
        if (status === 401) {
          // Publish BEFORE logout: `logout` bumps the session epoch, so an
          // `isStale()` check after it would always be true and swallow this.
          publishAuthError({
            reason: 'session-expired',
            retryable: false,
            i18nKey: 'shellFallback.sessionExpired',
            defaultMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
          });
          await logout();
          return false;
        }
        publishAuthError({
          // 403 after the retry means the account genuinely has no usable
          // workspace — visible and retryable, but never a silent logout.
          reason: status === 403 ? 'tenant-forbidden' : 'bootstrap-failed',
          retryable: true,
          i18nKey: 'shellFallback.bootstrapFailed',
          defaultMessage: 'Không tải được thông tin tài khoản.',
        });
        return false;
      }

      const sessionUser = session?.user && typeof session.user === 'object' ? session.user : (session || {});
      const tenantList = Array.isArray(session?.tenants)
        ? session.tenants
        : Array.isArray(profile?.tenants)
          ? profile.tenants
          : [];

      // Repair/seed the workspace id BEFORE any tenant-scoped call, so
      // /tenant/lifecycle/ cannot 403 on a stale header and silently degrade the
      // plan to 'free'.
      const nextTenantId = reconcileActiveTenantId(tenantList);
      const lifecycle = await coreApiAdapter
        .getTenantLifecycle()
        .catch(() => null);
      if (isStale()) return false;

      const plan = lifecycle?.plan || session?.plan || authPayload?.plan || 'free';

      setUserTenants(tenantList);
      setActiveTenantIdState(nextTenantId);
      setUserPlan(plan);
      setUserIdentity({
        id: session?.id ?? sessionUser.id ?? profile?.id ?? profile?.user_id ?? null,
        username: profile?.username || sessionUser.username || '',
        email: profile?.email || sessionUser.email || '',
        isStaff: Boolean(profile?.is_staff ?? session?.is_staff ?? sessionUser.is_staff),
        isSuperuser: Boolean(profile?.is_superuser ?? session?.is_superuser ?? sessionUser.is_superuser),
        display_name: profile?.display_name || session?.display_name || '',
        avatar_url: profile?.avatar_url || null,
      });

      // Map user profile to userConfig structure
      setUserConfig({
        language: profile?.language || 'vi',
        theme: profile?.theme || 'dark',
        whale_alert_threshold: profile?.whale_alert_threshold
          || String(DEFAULT_WHALE_ALERT_THRESHOLD_MILLIONS),
      });

      // Simple capability / ability mapping
      const rules = profile?.abilities || session?.abilities || session?.capabilities?.abilities || [];
      const entitlements = session?.entitlements
        ?? session?.capabilities?.entitlements
        ?? authPayload?.entitlements
        ?? authPayload?.capabilities?.entitlements
        ?? null;
      setAbility(createAbilityFromRules(rules));
      setUserEntitlements(entitlements);
      setCapabilitySnapshot({
        abilities: rules,
        entitlements,
        plan,
        actor: { plan },
      });
      setAuthStateError(null);

      return true;
    } catch (error) {
      if (isStale()) return false;
      if (errorStatus(error) === 401) {
        publishAuthError({
          reason: 'session-expired',
          retryable: false,
          i18nKey: 'shellFallback.sessionExpired',
          defaultMessage: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        });
        await logout();
        return false;
      }
      console.error('Sync auth state failed:', error);
      publishAuthError({
        reason: 'bootstrap-failed',
        retryable: true,
        i18nKey: 'shellFallback.bootstrapFailed',
        defaultMessage: 'Không tải được thông tin tài khoản.',
      });
      return false;
    }
  }, [logout, publishAuthError]);

  const login = useCallback(async (username, password) => {
    const payload = await coreApiAdapter.loginUser({ username: username.trim(), password });
    const tokenPayload = payload?.data?.access ? payload.data : payload;
    if (!tokenPayload?.access) {
      throw new Error('Không nhận được access token hợp lệ từ phiên đăng nhập.');
    }
    saveTokens(tokenPayload?.access, tokenPayload?.refresh);
    // The login payload is the only place `id` and `entitlements` appear
    // pre-slice-B (`_build_auth_payload`, views/helpers.py:268-288); passing it
    // through keeps `userIdentity.id` and `userEntitlements` populated on the
    // first paint after sign-in instead of waiting for a re-fetch.
    await syncAuthState({ authPayload: tokenPayload });
    return tokenPayload;
  }, [syncAuthState, saveTokens]);

  /**
   * @deprecated E8 (P2) — contract-lying, kept only because
   * `context/PortfolioContext.d.ts:44` still declares it and that file is not in
   * this slice. It sends no `website` / `turnstile_token`, so it 400s on every
   * deployment with Turnstile enabled. The registration flow lives in
   * `pages/auth/*` (slice D). Remove this method together with the `.d.ts`
   * declaration.
   */
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
        await logout();
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
      await logout();
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
      whale_alert_threshold: response?.whale_alert_threshold
        || String(DEFAULT_WHALE_ALERT_THRESHOLD_MILLIONS),
    };
    setUserConfig(updatedConfig);
    return { data: updatedConfig };
  }, []);

  const fetchPortfolios = useCallback(async (epoch) => {
    setLoading(true);
    try {
      const res = await coreApiAdapter.getPortfolios();
      if (isStaleEpoch(epoch)) return;
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
      if (isStaleEpoch(epoch)) return;
      if (errorStatus(err) === 401) {
        await logout();
        return;
      }
      console.error('Fetch portfolios failed:', err);
    } finally {
      if (!isStaleEpoch(epoch)) setLoading(false);
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
  // W1 FIX (E2E bootstrap hang): bound bootstrap by timeout so a hanging
  // API (stored-state reload with slow backend) can never leave
  // `authStateReady=false` forever ("Đang xác thực tài khoản..." spinner).
  // Fail-open: release the gate, ProtectedRoute redirects to /login if needed.
  //
  // E7 FIX: a failed bootstrap no longer ends in a silently empty shell. The
  // error is published on the context (`authStateError`, with `retryable`) and
  // as a `core-auth-state-error` window event, and `retryAuthBootstrap()` re-runs
  // it. Previously the only trace was a `console.error` and the gate was
  // released anyway, so the user got the full shell with empty identity, no
  // portfolios and no indication anything was wrong.
  useEffect(() => {
    let cancelled = false;
    const epoch = sessionEpochRef.current;

    const bootstrap = async () => {
      if (!isAuthenticated || !accessToken) {
        setAuthStateReady(true);
        return;
      }

      setAuthStateReady(false);

      try {
        const ok = await withTimeout(
          syncAuthState({ epoch }),
          BOOTSTRAP_TIMEOUT_MS,
          'syncAuthState',
        );
        if (!ok || cancelled || isStaleEpoch(epoch)) {
          return;
        }

        await withTimeout(
          fetchPortfolios(epoch),
          BOOTSTRAP_TIMEOUT_MS,
          'fetchPortfolios',
        );
      } catch (error) {
        if (cancelled || isStaleEpoch(epoch)) return;
        console.error('Bootstrap failed:', error?.message || error);
        publishAuthError({
          reason: 'bootstrap-failed',
          retryable: true,
          i18nKey: 'shellFallback.bootstrapFailed',
          defaultMessage: 'Không tải được thông tin tài khoản.',
        });
      } finally {
        if (!cancelled && !isStaleEpoch(epoch)) {
          setAuthStateReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    isAuthenticated,
    accessToken,
    authBootstrapNonce,
    syncAuthState,
    fetchPortfolios,
    publishAuthError,
  ]);

  /**
   * E1 (P0) — writes through `tenantIdStorage`, the same object the transport
   * reads when building `X-Tenant-ID`, instead of poking localStorage directly
   * and hoping. Accepts `null` to clear the selection.
   */
  const switchTenant = useCallback((tenantId) => {
    const next = tenantId ? String(tenantId) : null;
    tenantIdStorage.setTenantId(next);
    setActiveTenantIdState(next);
    emitWindowEvent('tenant-changed', { tenantId: next });
  }, []);

  const contextValue = useMemo(() => ({
    portfolios,
    activePortfolioId,
    setActivePortfolioId,
    isAuthenticated,
    authStateReady,
    authStateError,
    retryAuthBootstrap,
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
    activeTenantId,
  }), [
    portfolios, activePortfolioId, isAuthenticated, authStateReady,
    authStateError, retryAuthBootstrap, login, register,
    resendVerification, logout, refreshAccessToken, userConfig,
    updateUserConfig, loading, fetchPortfolios, userPlan, userIdentity,
    userEntitlements,
    capabilitySnapshot,
    ability, createPortfolio, updatePortfolio, deletePortfolio,
    createSubAccount, updateSubAccount, deleteSubAccount,
    userTenants, switchTenant, activeTenantId,
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
