import { getBuildTarget } from "../../config/buildTarget.js";

function resolveVipAppBaseUrl(env = {}) {
  return env.REACT_APP_VIP_APP_BASE_URL || env.VNINVEST_VIP_APP_BASE_URL || "/vip-app/v1";
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
};