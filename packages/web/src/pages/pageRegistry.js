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
    import("./system/ShellAiCommandCenterPage.js").then((module) => module.ShellAiCommandCenterPage)),
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
    import("./system/ShellSupportPage.js").then((module) => module.ShellSupportPage)),
  makePageEntry("settings", "baseline", () =>
    import("./system/ShellSettingsPage.js").then((module) => module.ShellSettingsPage)),
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
  makePageEntry("auth-login", "core", () =>
    import("./auth/AuthLoginPage.js").then((module) => module.AuthLoginPage)),
  makePageEntry("auth-register", "core", () =>
    import("./auth/AuthRegisterPage.js").then((module) => module.AuthRegisterPage)),
  makePageEntry("auth-verify-email", "core", () =>
    import("./auth/AuthVerifyEmailPage.js").then((module) => module.AuthVerifyEmailPage)),
  makePageEntry("auth-reset-password", "core", () =>
    import("./auth/AuthResetPasswordPage.js").then((module) => module.AuthResetPasswordPage)),
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