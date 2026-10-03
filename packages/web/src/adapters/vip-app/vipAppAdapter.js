import { getBuildTarget } from "../../config/buildTarget.js";

function resolveVipAppBaseUrl(env = {}) {
  return env.REACT_APP_VIP_APP_BASE_URL || env.VNINVEST_VIP_APP_BASE_URL || "/vip-app/v1";
}

function resolveFetchImpl(fetchImpl) {
  if (typeof fetchImpl === "function") {
    return fetchImpl;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("No fetch implementation available for vip-app control client");
}

async function requestJson(fetchImpl, url, init = {}) {
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      ...(init.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`VIP app control request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

function buildJsonRequest(method, payload) {
  if (payload === undefined) {
    return { method };
  }

  return {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  };
}

function appendQuery(url, query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

export const vipAppAdapter = {
  adapterId: "vip-app",
  displayName: "VIP App Local API",
  resolveBaseUrl: resolveVipAppBaseUrl,
  getBuildMeta(env = {}) {
    return {
      adapterId: "vip-app",
      displayName: "VIP App Local API",
      target: getBuildTarget(env),
      baseUrl: resolveVipAppBaseUrl(env),
    };
  },
  getCapabilityBootstrapEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/access/capabilities`;
  },
  getSessionPayloadEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/session/bootstrap`;
  },
  getHealthcheckEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/health`;
  },
  getAuthLoginEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/auth/login`;
  },
  getAuthLogoutEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/auth/logout`;
  },
  getAuthResetEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/auth/reset`;
  },
  getRbacUsersEndpoint(env = {}) {
    return `${resolveVipAppBaseUrl(env)}/rbac/users`;
  },
  getAuditLogsEndpoint(env = {}, options = {}) {
    return appendQuery(`${resolveVipAppBaseUrl(env)}/audit/logs`, {
      limit: options.limit,
    });
  },
};

export function createVipAppControlClient(options = {}) {
  const { env = {}, fetchImpl } = options;
  const request = resolveFetchImpl(fetchImpl);

  return {
    adapter: vipAppAdapter,
    getBuildMeta() {
      return vipAppAdapter.getBuildMeta(env);
    },
    login(credentials) {
      return requestJson(
        request,
        vipAppAdapter.getAuthLoginEndpoint(env),
        buildJsonRequest("POST", credentials),
      );
    },
    logout() {
      return requestJson(
        request,
        vipAppAdapter.getAuthLogoutEndpoint(env),
        buildJsonRequest("POST", {}),
      );
    },
    resetSession() {
      return requestJson(
        request,
        vipAppAdapter.getAuthResetEndpoint(env),
        buildJsonRequest("POST", {}),
      );
    },
    listUsers() {
      return requestJson(request, vipAppAdapter.getRbacUsersEndpoint(env), buildJsonRequest("GET"));
    },
    upsertUser(userPayload) {
      return requestJson(
        request,
        vipAppAdapter.getRbacUsersEndpoint(env),
        buildJsonRequest("POST", userPayload),
      );
    },
    listAuditLogs(options = {}) {
      return requestJson(
        request,
        vipAppAdapter.getAuditLogsEndpoint(env, options),
        buildJsonRequest("GET"),
      );
    },
  };
}