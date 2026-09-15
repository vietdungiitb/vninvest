import { getBuildTarget } from "../../config/buildTarget.js";

function resolveCoreBaseUrl(env = {}) {
  return env.REACT_APP_CORE_BASE_URL || env.VNINVEST_CORE_BASE_URL || "/core/v1";
}

function resolvePortfolioApiBaseUrl(env = {}) {
  return env.REACT_APP_API_BASE_URL || env.VNINVEST_API_BASE_URL || "/api";
}

function resolveFetchImpl(fetchImpl) {
  if (typeof fetchImpl === "function") {
    return fetchImpl;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("No fetch implementation available for the core adapter client");
}

class CoreAdapterHttpError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "CoreAdapterHttpError";
    this.status = options.status;
    this.statusText = options.statusText;
    this.url = options.url;
    this.payload = options.payload;
  }
}

async function readJsonBody(response) {
  const contentType = response.headers?.get?.("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
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
    const payload = await readJsonBody(response);
    throw new CoreAdapterHttpError(
      `Core adapter request failed: ${response.status} ${response.statusText} for ${url}`,
      {
        status: response.status,
        statusText: response.statusText,
        url,
        payload,
      },
    );
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
    return `${resolveCoreBaseUrl(env)}/auth/me`;
  },
  getHealthcheckEndpoint(env = {}) {
    return `${resolveCoreBaseUrl(env)}/health`;
  },
  getAiAdvisorySessionEndpoint(env = {}, options = {}) {
    const normalizedSymbol = String(options.symbol || "").trim().toUpperCase();
    const coreBase = resolveCoreBaseUrl(env);

    return appendQuery(
      `${coreBase}/advisory/latest/${encodeURIComponent(normalizedSymbol)}/`,
      {
        date: options.tradeDate,
      },
    );
  },
  getWhaleAnalyticsSnapshotEndpoint(env = {}, options = {}) {
    const normalizedSymbol = String(options.symbol || "").trim().toUpperCase();
    const coreBase = resolveCoreBaseUrl(env);

    // COMPAT-001: legacy /whale-feed-aggregate/ (404) cutover → native workspace route.
    return appendQuery(
      `${coreBase}/workspace/whale-analytics/${encodeURIComponent(normalizedSymbol)}/`,
      {
        timeframe: options.timeframe,
        compact: options.compact === false ? 0 : 1,
        trade_date: options.tradeDate,
        include_baseline: options.includeBaseline ? 1 : 0,
      },
    );
  },
};

export function createCoreAdvisorySessionClient(options = {}) {
  const { env = {}, fetchImpl } = options;
  const request = resolveFetchImpl(fetchImpl);

  async function getAiAdvisorySessionWithFallback(requestOptions = {}) {
    const normalizedRequestOptions = {
      tradeDate: requestOptions.tradeDate,
      symbol: String(requestOptions.symbol || "").trim().toUpperCase(),
    };

    return requestJson(
      request,
      coreAdapter.getAiAdvisorySessionEndpoint(env, normalizedRequestOptions),
    );
  }

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

      return getAiAdvisorySessionWithFallback({
        ...requestOptions,
        symbol: normalizedSymbol,
      });
    },
  };
}

export function createCoreWhaleAnalyticsSnapshotClient(options = {}) {
  const { env = {}, fetchImpl } = options;
  const request = resolveFetchImpl(fetchImpl);

  return {
    adapter: coreAdapter,
    getBuildMeta() {
      return coreAdapter.getBuildMeta(env);
    },
    getWhaleAnalyticsSnapshot(requestOptions = {}) {
      const normalizedSymbol = String(requestOptions.symbol || "").trim().toUpperCase();
      if (!normalizedSymbol) {
        throw new Error("A whale analytics symbol is required");
      }

      return requestJson(
        request,
        coreAdapter.getWhaleAnalyticsSnapshotEndpoint(env, {
          symbol: normalizedSymbol,
          timeframe: requestOptions.timeframe || "session",
          compact: requestOptions.compact !== false,
          tradeDate: requestOptions.tradeDate,
          includeBaseline: Boolean(requestOptions.includeBaseline),
        }),
      );
    },
  };
}