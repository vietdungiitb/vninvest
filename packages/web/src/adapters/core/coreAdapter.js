import { getBuildTarget } from "../../config/buildTarget.js";

function resolveCoreBaseUrl(env = {}) {
  return env.REACT_APP_CORE_BASE_URL || env.VNINVEST_CORE_BASE_URL || "/core/v1";
}

function resolveStockWorkspaceBaseUrl(env = {}) {
  return env.REACT_APP_STOCK_WORKSPACE_BASE_URL || env.VNINVEST_STOCK_WORKSPACE_BASE_URL || "/api/stock-management";
}

function resolveFetchImpl(fetchImpl) {
  if (typeof fetchImpl === "function") {
    return fetchImpl;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("No fetch implementation available for the core advisory client");
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
    throw new Error(`Core advisory request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
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

export const coreAdapter = {
  adapterId: "core",
  displayName: "Core API",
  resolveBaseUrl: resolveCoreBaseUrl,
  getBuildMeta(env = {}) {
    return {
      adapterId: "core",
      displayName: "Core API",
      target: getBuildTarget(env),
      baseUrl: resolveCoreBaseUrl(env),
    };
  },
  getCapabilityBootstrapEndpoint(env = {}) {
    return `${resolveCoreBaseUrl(env)}/access/capabilities`;
  },
  getSessionPayloadEndpoint(env = {}) {
    return `${resolveCoreBaseUrl(env)}/session/me`;
  },
  getHealthcheckEndpoint(env = {}) {
    return `${resolveCoreBaseUrl(env)}/health`;
  },
  getAiAdvisorySessionEndpoint(env = {}, options = {}) {
    const normalizedSymbol = String(options.symbol || "").trim().toUpperCase();

    return appendQuery(
      `${resolveStockWorkspaceBaseUrl(env)}/stocks/${encodeURIComponent(normalizedSymbol)}/ai-advisory-session/`,
      {
        contract: options.contract,
        include_benchmarks: options.includeBenchmarks ? 1 : undefined,
        trade_date: options.tradeDate,
      },
    );
  },
};

export function createCoreAdvisorySessionClient(options = {}) {
  const { env = {}, fetchImpl } = options;
  const request = resolveFetchImpl(fetchImpl);

  return {
    adapter: coreAdapter,
    getBuildMeta() {
      return coreAdapter.getBuildMeta(env);
    },
    getAiAdvisorySession(requestOptions = {}) {
      const normalizedSymbol = String(requestOptions.symbol || "").trim().toUpperCase();
      if (!normalizedSymbol) {
        throw new Error("An advisory symbol is required");
      }

      return requestJson(
        request,
        coreAdapter.getAiAdvisorySessionEndpoint(env, {
          contract: requestOptions.contract || "v2",
          includeBenchmarks: requestOptions.includeBenchmarks !== false,
          tradeDate: requestOptions.tradeDate,
          symbol: normalizedSymbol,
        }),
      );
    },
  };
}