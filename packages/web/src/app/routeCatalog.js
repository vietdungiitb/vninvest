import { BUILD_TARGETS, normalizeBuildTarget } from "../config/buildTarget.js";

const ALL_BUILD_TARGETS = Object.freeze([...BUILD_TARGETS]);

export const routeCatalog = Object.freeze([
  {
    id: "dashboard",
    path: "/dashboard",
    titleKey: "routes.dashboard",
    group: "workspace",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["workspace.dashboard.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "ai-advisory",
    path: "/ai-advisory",
    titleKey: "routes.aiAdvisory",
    group: "signals",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["signals.ai_advisory.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "whale-alerts",
    path: "/whale-alerts",
    titleKey: "routes.whaleAlerts",
    group: "signals",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["signals.whale_alerts.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "watchlist",
    path: "/watchlist",
    titleKey: "routes.watchlist",
    group: "workspace",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["workspace.watchlist.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "transactions",
    path: "/transactions",
    titleKey: "routes.transactions",
    group: "workspace",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["workspace.transactions.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "portfolios",
    path: "/portfolios",
    titleKey: "routes.portfolios",
    group: "workspace",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["workspace.portfolios.manage"],
    adapter: "core",
    status: "planned",
  },
  {
    id: "support",
    path: "/support",
    titleKey: "routes.support",
    group: "system",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["system.support.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "settings",
    path: "/settings",
    titleKey: "routes.settings",
    group: "system",
    buildTargets: ALL_BUILD_TARGETS,
    requiredCapabilities: ["system.settings.read"],
    adapter: "core",
    status: "baseline",
  },
  {
    id: "ai-command-center",
    path: "/settings/ai",
    titleKey: "routes.aiCommandCenter",
    group: "system",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["system.ai_command_center.manage"],
    adapter: "core",
    status: "planned",
  },
  {
    id: "admin-ops",
    path: "/admin/core",
    titleKey: "routes.adminOps",
    group: "admin",
    buildTargets: ["saas", "vip"],
    requiredCapabilities: ["admin.operator.read"],
    adapter: "core",
    status: "planned",
  },
  {
    id: "vip-local-control",
    path: "/vip/local-control",
    titleKey: "routes.vipLocalControl",
    group: "vip-local",
    buildTargets: ["vip"],
    requiredCapabilities: ["vip.local_control.read"],
    adapter: "vip-app",
    status: "baseline",
  },
]);

export function getRouteCatalogIds() {
  return routeCatalog.map((route) => route.id);
}

export function getRoutesForBuildTarget(target) {
  const normalizedTarget = normalizeBuildTarget(target);
  return routeCatalog.filter((route) => route.buildTargets.includes(normalizedTarget));
}