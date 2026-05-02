import { getBuildTarget } from "../../config/buildTarget.js";

function resolveCoreBaseUrl(env = {}) {
  return env.REACT_APP_CORE_BASE_URL || env.VNINVEST_CORE_BASE_URL || "/core/v1";
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
};