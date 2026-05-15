import { ShellOperationsCenterPage } from "./admin/ShellOperationsCenterPage.js";
import { ShellAiAdvisoryPage } from "./signals/ShellAiAdvisoryPage.js";
import { ShellWhaleAlertsPage } from "./signals/ShellWhaleAlertsPage.js";
import { ShellAiCommandCenterPage } from "./system/ShellAiCommandCenterPage.js";
import { ShellSettingsPage } from "./system/ShellSettingsPage.js";
import { ShellSupportPage } from "./system/ShellSupportPage.js";
import { VipLocalControlPage } from "./vip/VipLocalControlPage.js";
import { ShellDashboardPage } from "./workspace/ShellDashboardPage.js";
import { ShellPortfoliosPage } from "./workspace/ShellPortfoliosPage.js";
import { ShellTransactionsPage } from "./workspace/ShellTransactionsPage.js";
import { ShellWatchlistPage } from "./workspace/ShellWatchlistPage.js";
// SM-P4 new core user-facing pages
import { DashboardPage } from "./DashboardPage.js";
import { WhaleAlertsPage } from "./WhaleAlertsPage.js";
import { StockDetailPage } from "./StockDetailPage.js";
import { PortfoliosPage } from "./PortfoliosPage.js";
import { TransactionsPage } from "./TransactionsPage.js";
import { UserSettingsPage } from "./UserSettingsPage.js";

export const pageRegistry = Object.freeze([
  {
    routeId: "operations-center",
    component: ShellOperationsCenterPage,
    status: "baseline",
  },
  {
    routeId: "ai-command-center",
    component: ShellAiCommandCenterPage,
    status: "baseline",
  },
  {
    routeId: "ai-advisory",
    component: ShellAiAdvisoryPage,
    status: "baseline",
  },
  {
    routeId: "whale-alerts",
    component: ShellWhaleAlertsPage,
    status: "baseline",
  },
  {
    routeId: "dashboard",
    component: ShellDashboardPage,
    status: "baseline",
  },
  {
    routeId: "transactions",
    component: ShellTransactionsPage,
    status: "baseline",
  },
  {
    routeId: "watchlist",
    component: ShellWatchlistPage,
    status: "baseline",
  },
  {
    routeId: "portfolios",
    component: ShellPortfoliosPage,
    status: "baseline",
  },
  {
    routeId: "support",
    component: ShellSupportPage,
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
  // SM-P4 core user-facing pages
  {
    routeId: "core-dashboard",
    component: DashboardPage,
    status: "core",
  },
  {
    routeId: "core-whale-alerts",
    component: WhaleAlertsPage,
    status: "core",
  },
  {
    routeId: "core-stock-detail",
    component: StockDetailPage,
    status: "core",
  },
  {
    routeId: "core-portfolios",
    component: PortfoliosPage,
    status: "core",
  },
  {
    routeId: "core-transactions",
    component: TransactionsPage,
    status: "core",
  },
  {
    routeId: "core-user-settings",
    component: UserSettingsPage,
    status: "core",
  },
]);

export function getPageRegistryRouteIds() {
  return pageRegistry.map((entry) => entry.routeId);
}

export function getPageComponent(routeId) {
  const pageEntry = pageRegistry.find((entry) => entry.routeId === routeId);
  return pageEntry ? pageEntry.component : null;
}