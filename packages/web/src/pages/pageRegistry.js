import { createElement, useEffect, useRef, useState } from "react";

function createDeferredPageComponent(loadComponent, routeId) {
  function DeferredPageComponent(props) {
    const [resolvedComponent, setResolvedComponent] = useState(null);
    const [loadError, setLoadError] = useState("");
    const mountedRef = useRef(null);

    useEffect(() => {
      mountedRef.current = true;
      loadComponent()
        .then((component) => {
          if (mountedRef.current) {
            setResolvedComponent(() => component);
            setLoadError("");
          }
        })
        .catch((error) => {
          if (mountedRef.current) {
            setResolvedComponent(null);
            setLoadError(error instanceof Error ? error.message : "Không thể tải trang shell.");
          }
        });

      return () => {
        mountedRef.current = false;
      };
    }, [loadComponent]);

    if (resolvedComponent) {
      return createElement(resolvedComponent, props);
    }

    if (loadError) {
      return createElement(
        "article",
        {
          className: "shellPage__panel",
          role: "alert",
        },
        createElement("h2", { className: "shellPage__panelTitle" }, "Không thể tải trang"),
        createElement("p", { className: "shellPage__panelSubtitle" }, `Route ${routeId}: ${loadError}`),
      );
    }

    return createElement(
      "article",
      {
        className: "shellPage__panel",
        role: "status",
        "aria-live": "polite",
      },
      createElement("h2", { className: "shellPage__panelTitle" }, "Đang tải trang"),
      createElement("p", { className: "shellPage__panelSubtitle" }, `Route ${routeId} đang được nạp động.`),
    );
  }

  return DeferredPageComponent;
}

function makePageEntry(routeId, status, loadComponent) {
  return Object.freeze({
    routeId,
    status,
    loadComponent,
    component: createDeferredPageComponent(loadComponent, routeId),
  });
}

export const pageRegistry = Object.freeze([
  makePageEntry("operations-center", "baseline", () =>
    import("./admin/ShellOperationsCenterPage.js").then((module) => module.ShellOperationsCenterPage)),
  makePageEntry("operations-center-mail-config", "baseline", () =>
    import("./admin/ShellMailConfigPage.js").then((module) => module.ShellMailConfigPage)),
  makePageEntry("ai-command-center", "baseline", () =>
    import("./AICommandCenterPage.js").then((module) => module.AICommandCenterPage)),
  makePageEntry("ai-advisory", "baseline", () =>
    import("./signals/ShellAiAdvisoryPage.js").then((module) => module.ShellAiAdvisoryPage)),
  makePageEntry("whale-alerts", "baseline", () =>
    import("./signals/ShellWhaleAlertsPage.js").then((module) => module.ShellWhaleAlertsPage)),
  makePageEntry("dashboard", "baseline", () =>
    import("./workspace/ShellDashboardPage.js").then((module) => module.ShellDashboardPage)),
  makePageEntry("transactions", "baseline", () =>
    import("./workspace/ShellTransactionsPage.js").then((module) => module.ShellTransactionsPage)),
  makePageEntry("watchlist", "baseline", () =>
    import("./workspace/ShellWatchlistPage.js").then((module) => module.ShellWatchlistPage)),
  makePageEntry("portfolios", "baseline", () =>
    import("./workspace/ShellPortfoliosPage.js").then((module) => module.ShellPortfoliosPage)),
  makePageEntry("support", "baseline", () =>
    import("./SupportPage.js").then((module) => module.SupportPage)),
  makePageEntry("settings", "baseline", () =>
    import("./system/ShellSettingsPage.js").then((module) => module.ShellSettingsPage)),
  makePageEntry("shell-ai-command-center", "baseline", () =>
    import("./system/ShellAiCommandCenterPage.js").then((module) => module.ShellAiCommandCenterPage)),
  makePageEntry("vip-local-control", "baseline", () =>
    import("./vip/VipLocalControlPage.js").then((module) => module.VipLocalControlPage)),
  // SM-P4 core user-facing pages
  makePageEntry("alert-center", "core", () =>
    import("./AlertCenterPage.js").then((module) => module.AlertCenterPage)),
  makePageEntry("core-dashboard", "core", () =>
    import("./DashboardPage.js").then((module) => module.DashboardPage)),
  makePageEntry("core-whale-alerts", "core", () =>
    import("./WhaleAlertsPage.js").then((module) => module.WhaleAlertsPage)),
  makePageEntry("core-stock-detail", "core", () =>
    import("./market/ShellStockDetailPage.js").then((module) => module.ShellStockDetailPage)),
  makePageEntry("core-portfolios", "core", () =>
    import("./PortfoliosPage.js").then((module) => module.PortfoliosPage)),
  makePageEntry("core-transactions", "core", () =>
    import("./TransactionsPage.js").then((module) => module.TransactionsPage)),
  makePageEntry("core-user-settings", "core", () =>
    import("./UserSettingsPage.js").then((module) => module.UserSettingsPage)),
  makePageEntry("core-watchlist", "core", () =>
    import("./WatchlistPage.js").then((module) => module.WatchlistPage)),
  makePageEntry("auth-login", "core", () =>
    import("./auth/AuthLoginPage.js").then((module) => module.AuthLoginPage)),
  makePageEntry("auth-register", "core", () =>
    import("./auth/AuthRegisterPage.js").then((module) => module.AuthRegisterPage)),
  makePageEntry("auth-verify-email", "core", () =>
    import("./auth/AuthVerifyEmailPage.js").then((module) => module.AuthVerifyEmailPage)),
  makePageEntry("auth-reset-password", "core", () =>
    import("./auth/AuthResetPasswordPage.js").then((module) => module.AuthResetPasswordPage)),
  makePageEntry("commercial-billing-center", "core", () =>
    import("./commercial/BillingCenterPage.js").then((module) => module.BillingCenterPage)),
  makePageEntry("commercial-payment-return", "core", () =>
    import("./commercial/PaymentReturnPage.js").then((module) => module.PaymentReturnPage)),
  makePageEntry("screener", "core", () =>
    import("./ScreenerPage.jsx").then((module) => module.ScreenerPage)),
  // Tenant Admin Pages
  makePageEntry("upgrade", "core", () =>
    import("./UpgradePage.jsx").then((module) => module.default)),
  makePageEntry("admin-crawl-control", "core", () =>
    import("./AdminCrawlControlPage.jsx").then((module) => module.default)),
  makePageEntry("whale-advisory", "core", () =>
    import("./signals/WhaleAdvisoryPage.js").then((module) => module.WhaleAdvisoryPage)),
  makePageEntry("tenant-admin-home", "core", () =>
    import("./tenant-admin/TenantAdminHomePage.js").then((module) => module.TenantAdminHomePage)),
  makePageEntry("tenant-admin-members", "core", () =>
    import("./tenant-admin/TenantAdminMembersPage.js").then((module) => module.TenantAdminMembersPage)),
  makePageEntry("tenant-admin-service-accounts", "core", () =>
    import("./tenant-admin/TenantAdminServiceAccountsPage.js").then((module) => module.TenantAdminServiceAccountsPage)),
  makePageEntry("tenant-admin-pats", "core", () =>
    import("./tenant-admin/TenantAdminPATsPage.js").then((module) => module.TenantAdminPATsPage)),
  makePageEntry("tenant-admin-usage", "core", () =>
    import("./tenant-admin/TenantAdminUsagePage.js").then((module) => module.TenantAdminUsagePage)),
  makePageEntry("tenant-admin-billing", "core", () =>
    import("./tenant-admin/TenantAdminBillingPage.js").then((module) => module.TenantAdminBillingPage)),
  makePageEntry("tenant-admin-capabilities", "core", () =>
    import("./tenant-admin/TenantAdminCapabilitiesPage.js").then((module) => module.TenantAdminCapabilitiesPage)),
  makePageEntry("tenant-admin-audit-logs", "core", () =>
    import("./tenant-admin/TenantAdminAuditLogsPage.js").then((module) => module.TenantAdminAuditLogsPage)),
]);

export function getPageRegistryRouteIds() {
  return pageRegistry.map((entry) => entry.routeId);
}

export function getPageComponent(routeId) {
  const pageEntry = pageRegistry.find((entry) => entry.routeId === routeId);
  return pageEntry ? pageEntry.component : null;
}

export function getPageLoader(routeId) {
  const pageEntry = pageRegistry.find((entry) => entry.routeId === routeId);
  return pageEntry ? pageEntry.loadComponent : null;
}