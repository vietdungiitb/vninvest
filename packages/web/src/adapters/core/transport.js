/**
 * transport.js
 *
 * Core network transport layer for coreApiAdapter domain modules.
 */

export function resolveCoreApiBase(env = {}) {
  if (env && typeof env.CORE_API_BASE_URL === "string" && env.CORE_API_BASE_URL.trim()) {
    return env.CORE_API_BASE_URL.trim();
  }
  if (env && typeof env.REACT_APP_CORE_API_BASE_URL === "string" && env.REACT_APP_CORE_API_BASE_URL.trim()) {
    return env.REACT_APP_CORE_API_BASE_URL.trim();
  }
  if (typeof window !== "undefined" && window.CORE_API_BASE_URL) {
    return window.CORE_API_BASE_URL;
  }
  if (typeof process !== "undefined" && process.env?.REACT_APP_CORE_API_BASE_URL) {
    return process.env.REACT_APP_CORE_API_BASE_URL;
  }
  return "/core/v1";
}

export function resolvePublicApiBase(env = {}) {
  if (env && typeof env.API_BASE_URL === "string" && env.API_BASE_URL.trim()) {
    return env.API_BASE_URL.trim();
  }
  if (env && typeof env.REACT_APP_API_BASE_URL === "string" && env.REACT_APP_API_BASE_URL.trim()) {
    return env.REACT_APP_API_BASE_URL.trim();
  }
  if (typeof window !== "undefined" && typeof window.API_BASE_URL === "string" && window.API_BASE_URL.trim()) {
    return window.API_BASE_URL.trim();
  }
  if (typeof process !== "undefined" && process.env?.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }
  return "/api";
}

export function generateRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function getBrowserStorageToken(key) {
  if (typeof window === "undefined") return null;
  return window.localStorage?.getItem(key) || null;
}

export function setBrowserStorageToken(key, value) {
  if (typeof window === "undefined") return;
  if (!value) {
    window.localStorage?.removeItem(key);
    return;
  }
  window.localStorage?.setItem(key, value);
}

export function clearBrowserStorageToken(key) {
  if (typeof window === "undefined") return;
  window.localStorage?.removeItem(key);
}

export const authTokenStorage = Object.freeze({
  getAccessToken() {
    return getBrowserStorageToken("access_token");
  },
  getRefreshToken() {
    return getBrowserStorageToken("refresh_token");
  },
  hasTokens() {
    return Boolean(getBrowserStorageToken("access_token") && getBrowserStorageToken("refresh_token"));
  },
  setTokens(tokens = {}) {
    if (!tokens?.access) return;
    setBrowserStorageToken("access_token", tokens.access);
    if (tokens.refresh) {
      setBrowserStorageToken("refresh_token", tokens.refresh);
    }
  },
  clearTokens() {
    clearBrowserStorageToken("access_token");
    clearBrowserStorageToken("refresh_token");
  },
});

export function getAuthorizationHeader(getToken) {
  const token = typeof getToken === "function" ? getToken() : null;
  if (!token) return {};
  return { "Authorization": `Bearer ${token}` };
}

export class CoreApiRequestError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CoreApiRequestError";
    this.status = options.status ?? null;
    this.statusText = options.statusText ?? "";
    this.path = options.path ?? "";
    this.payload = options.payload ?? null;
    this.code = options.code ?? null;
    this.fieldErrors = options.fieldErrors ?? null;
    this.requestId = options.requestId ?? null;
  }
}

export function normalizeRefreshResponsePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const directAccess = typeof payload.access === "string" ? payload.access : null;
  const directRefresh = typeof payload.refresh === "string" ? payload.refresh : null;
  if (directAccess) {
    return { access: directAccess, refresh: directRefresh };
  }
  const nestedData = payload.data;
  if (nestedData && typeof nestedData === "object" && typeof nestedData.access === "string") {
    return {
      access: nestedData.access,
      refresh: typeof nestedData.refresh === "string" ? nestedData.refresh : null,
    };
  }
  return null;
}

export function createCoreTransport(env = {}, options = {}) {
  const {
    getToken = () => null,
    getRefreshToken = () => null,
    setTokens = () => {},
    clearTokens = () => {},
  } = options;
  let refreshPromise = null;

  function toCoreApiRequestError(path, response, payload, fallbackText = "") {
    const detail =
      (payload && typeof payload === "object" && (payload.detail || payload.message)) ||
      fallbackText ||
      response.statusText ||
      "Request failed";
    const fieldErrors =
      (payload && typeof payload === "object" && (payload.field_errors || payload.errors)) || null;
    const requestId =
      (payload && typeof payload === "object" && payload.request_id) || null;
    const code =
      (payload && typeof payload === "object" && payload.code) || null;

    return new CoreApiRequestError(
      `Core API request error ${response.status} ${response.statusText} - ${path}: ${detail}`,
      {
        status: response.status,
        statusText: response.statusText,
        path,
        payload,
        fieldErrors,
        requestId,
        code,
      },
    );
  }

  function shouldTryRefresh(path, responseStatus) {
    return (
      responseStatus === 401
      && path !== "/auth/token/refresh/"
      && typeof getRefreshToken === "function"
      && Boolean(getRefreshToken())
    );
  }

  async function requestTokenRefresh() {
    if (refreshPromise) {
      return refreshPromise;
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    const base = resolveCoreApiBase(env);
    const requestId = generateRequestId();

    refreshPromise = fetch(`${base}/auth/token/refresh/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      credentials: "include",
      body: JSON.stringify({ refresh: refreshToken }),
    })
      .then(async (response) => {
        if (!response.ok) {
          clearTokens();
          return null;
        }
        const payload = await response.json().catch(() => null);
        const tokenPayload = normalizeRefreshResponsePayload(payload);
        if (!tokenPayload || !tokenPayload.access) {
          clearTokens();
          return null;
        }
        setTokens(tokenPayload);
        return tokenPayload.access;
      })
      .catch(() => {
        clearTokens();
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  async function requestWithAuth(path, init = {}, attemptRefresh = true) {
    const base = resolveCoreApiBase(env);
    const requestId = generateRequestId();
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...getAuthorizationHeader(getToken),
        ...(init.headers || {}),
      },
      credentials: "include",
    });

    if (attemptRefresh && shouldTryRefresh(path, response.status)) {
      const nextAccessToken = await requestTokenRefresh();
      if (nextAccessToken) {
        return requestWithAuth(path, init, false);
      }
    }

    return response;
  }

  async function coreGet(path, options = {}) {
    const response = await requestWithAuth(path, options, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return response.json();
  }

  async function corePost(path, body = undefined) {
    const response = await requestWithAuth(path, {
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API POST error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    if (response.status === 204) return null;
    return response.json();
  }

  async function corePatch(path, body = undefined) {
    const response = await requestWithAuth(path, {
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API PATCH error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return response.json();
  }

  async function coreDelete(path) {
    const response = await requestWithAuth(path, {
      method: "DELETE",
    }, true);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(
        `Core API DELETE error ${response.status} ${response.statusText} — ${path}: ${text}`
      );
    }

    return null;
  }

  async function publicPost(path, body = undefined) {
    const base = resolvePublicApiBase(env);
    const requestId = generateRequestId();
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
      },
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const fallbackText = await response.text().catch(() => "");
      throw toCoreApiRequestError(path, response, payload, fallbackText);
    }

    return payload;
  }

  return { coreGet, corePost, corePatch, coreDelete, publicPost };
}