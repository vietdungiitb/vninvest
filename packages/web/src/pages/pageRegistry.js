import { ShellAdminOpsPage } from "./admin/ShellAdminOpsPage.js";
import { ShellSettingsPage } from "./system/ShellSettingsPage.js";
import { VipLocalControlPage } from "./vip/VipLocalControlPage.js";

export const pageRegistry = Object.freeze([
  {
    routeId: "admin-ops",
    component: ShellAdminOpsPage,
    status: "baseline",
  },
  {
    routeId: "settings",
    component: ShellSettingsPage,
    status: "baseline",
  },
  {
    routeId: "vip-local-control",
    component: VipLocalControlPage,
    status: "baseline",
  },
]);

export function getPageRegistryRouteIds() {
  return pageRegistry.map((entry) => entry.routeId);
}

export function getPageComponent(routeId) {
  const pageEntry = pageRegistry.find((entry) => entry.routeId === routeId);
  return pageEntry ? pageEntry.component : null;
}