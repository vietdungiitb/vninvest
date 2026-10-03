import { coreAdapter } from "../adapters/core/index.js";
import { vipAppAdapter } from "../adapters/vip-app/index.js";

const ADAPTER_REGISTRY = Object.freeze({
  [coreAdapter.adapterId]: coreAdapter,
  [vipAppAdapter.adapterId]: vipAppAdapter,
});

function resolveFetchImpl(fetchImpl) {
  if (typeof fetchImpl === "function") {
    return fetchImpl;
  }

  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch.bind(globalThis);
  }

  throw new Error("No fetch implementation available for shell bootstrap client");
}

async function requestJson(fetchImpl, url, init = {}) {
  const headers = {
    Accept: "application/json",
    ...(init.headers || {}),
  };

  if (typeof window !== "undefined") {
    const token = window.localStorage?.getItem("access_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetchImpl(url, {
    method: "GET",
    ...init,
    headers,
  });

  if (!response.ok) {
    throw new Error(`Shell bootstrap request failed: ${response.status} ${response.statusText} for ${url}`);
  }

  return response.json();
}

export function resolveShellAdapter(adapterOrId = coreAdapter) {
  if (typeof adapterOrId === "string") {
    const adapter = ADAPTER_REGISTRY[adapterOrId];
    if (!adapter) {
      throw new Error(`Unknown shell adapter: ${adapterOrId}`);
    }
    return adapter;
  }

  if (adapterOrId && typeof adapterOrId === "object" && typeof adapterOrId.adapterId === "string") {
    return adapterOrId;
  }

  throw new Error("A valid shell adapter or adapter id is required");
}

export function createBootstrapClient(options = {}) {
  const { adapter: adapterOrId = coreAdapter, env = {}, fetchImpl } = options;
  const adapter = resolveShellAdapter(adapterOrId);
  const request = resolveFetchImpl(fetchImpl);

  return {
    adapter,
    getBuildMeta() {
      return adapter.getBuildMeta(env);
    },
    getHealth() {
      return requestJson(request, adapter.getHealthcheckEndpoint(env));
    },
    getCapabilities() {
      return requestJson(request, adapter.getCapabilityBootstrapEndpoint(env));
    },
    getSession() {
      return requestJson(request, adapter.getSessionPayloadEndpoint(env));
    },
  };
}

export async function loadShellBootstrap(options = {}) {
  const client = createBootstrapClient(options);
  const [health, capabilities, session] = await Promise.all([
    client.getHealth(),
    client.getCapabilities(),
    client.getSession(),
  ]);

  return {
    adapter: client.adapter,
    buildMeta: client.getBuildMeta(),
    health,
    capabilities,
    session,
  };
}

export function deriveLegacyAuthState(bootstrapPayload) {
  const capabilities = bootstrapPayload?.capabilities || {};
  const principalIdentity = capabilities.principal?.identity || {};
  const session = bootstrapPayload?.session || {};
  const isStaff = Boolean(principalIdentity.is_staff);
  const isSuperuser = Boolean(principalIdentity.is_superuser);

  return {
    userPlan: capabilities.build?.plan || "free",
    userIdentity: {
      id: principalIdentity.user_id ?? session.principal?.user_id ?? null,
      username: principalIdentity.username ?? session.principal?.username ?? null,
      email: principalIdentity.email ?? null,
      isStaff,
      isSuperuser,
      is_staff: isStaff,
      is_superuser: isSuperuser,
    },
    abilities: Array.isArray(capabilities.abilities) ? capabilities.abilities : [],
    buildTarget: capabilities.build?.target ?? session.build_target ?? null,
    navigation: capabilities.navigation || { visible_groups: [], visible_routes: [] },
    surfaces: capabilities.surfaces || {
      show_operations_center: false,
      show_ai_command_center: false,
      show_vip_shell: false,
    },
    session,
    health: bootstrapPayload?.health || null,
  };
}