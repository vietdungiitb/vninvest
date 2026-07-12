import { BUILD_TARGETS, normalizeBuildTarget } from "../config/buildTarget.js";

const ALL_BUILD_TARGETS = Object.freeze([...BUILD_TARGETS]);

export const navigationCatalog = Object.freeze([
  {
    id: "workspace",
    labelKey: "navigation.workspace",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["workspace.group.read"],
    items: ["dashboard", "watchlist", "transactions", "portfolios", "screener"],
  },
  {
    id: "signals",
    labelKey: "navigation.signals",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["signals.group.read"],
    items: ["alert-center", "ai-advisory", "whale-alerts"],
  },
  {
    id: "system",
    labelKey: "navigation.system",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["system.group.read"],
    items: ["support", "settings", "ai-command-center", "commercial-billing-center"],
  },
  {
    id: "admin",
    labelKey: "layout.nav.soc",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["admin.operator.read"],
    items: ["operations-center", "operations-center-mail-config"],
  },
  {
    id: "vip-local",
    labelKey: "navigation.vipLocal",
    buildTargets: ["vip"],
    requiredCapabilities: ["vip.local_control.read"],
    items: ["vip-local-control"],
  },
]);

export function getNavigationGroupIds() {
  return navigationCatalog.map((group) => group.id);
}

export function getNavigationForBuildTarget(target) {
  const normalizedTarget = normalizeBuildTarget(target);
  return navigationCatalog.filter((group) => group.buildTargets.includes(normalizedTarget));
}