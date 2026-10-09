import styles from "../components/ShellPageTemplate.module.css";
import { createElement, useEffect, useRef, useState } from "react";
import { useI18n } from "../context/LangContext.js";
function createDeferredPageComponent(loadComponent, routeId) {
  function DeferredPageComponent(props) {
    const { t } = useI18n();
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
            setLoadError(error instanceof Error ? error.message : t("shellFallback.loadErrorDefault"));
          }
        });

      return () => {
        mountedRef.current = false;
      };
    }, [loadComponent]); // eslint-disable-line react-hooks/exhaustive-deps

    if (resolvedComponent) {
      return createElement(resolvedComponent, props);
    }

    if (loadError) {
      return createElement(
        "article",
        {
          className: `${styles.panel}`,
          role: "alert",
        },
        createElement("h2", { className: `${styles.panelTitle}` }, t("shellFallback.loadFailedTitle")),
        createElement("p", { className: `${styles.panelSubtitle}` }, `Route ${routeId}: ${loadError}`),
      );
    }

    return createElement(
      "article",
      {
        className: `${styles.panel}`,
        role: "status",
        "aria-live": "polite",
      },
      createElement(
        "div",
        { className: "clock-container" },
        createElement(
          "style",
          null,
          `
            @keyframes spin-hour {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @keyframes spin-minute {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            .clock-hour {
              transform-origin: 32px 32px;
              animation: spin-hour 12s linear infinite;
            }
            .clock-minute {
              transform-origin: 32px 32px;
              animation: spin-minute 1s linear infinite;
            }
            .clock-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 40px 20px;
              text-align: center;
            }
            .clock-glow {
              filter: drop-shadow(0 0 10px rgba(0, 180, 216, 0.55));
            }
            .loading-text {
              font-size: 18px;
              font-weight: 600;
              color: var(--text-primary, #f1f5f9);
              margin-top: 20px;
              letter-spacing: 0.05em;
            }
            .loading-subtext {
              font-size: 13px;
              color: var(--text-secondary, #94a3b8);
              margin-top: 6px;
            }
          `
        ),
        createElement(
          "svg",
          {
            className: "clock-glow",
            xmlns: "http://www.w3.org/2000/svg",
            viewBox: "0 0 64 64",
            width: "64",
            height: "64",
            style: { display: "block" }
          },
          createElement("circle", {
            cx: "32",
            cy: "32",
            r: "28",
            fill: "none",
            stroke: "url(#clock-grad)",
            strokeWidth: "3.5",
            strokeLinecap: "round"
          }),
          createElement("line", { x1: "32", y1: "8", x2: "32", y2: "11", stroke: "#00b4d8", strokeWidth: "2", strokeLinecap: "round" }),
          createElement("line", { x1: "56", y1: "32", x2: "53", y2: "32", stroke: "#00b4d8", strokeWidth: "2", strokeLinecap: "round" }),
          createElement("line", { x1: "32", y1: "56", x2: "32", y2: "53", stroke: "#00b4d8", strokeWidth: "2", strokeLinecap: "round" }),
          createElement("line", { x1: "8", y1: "32", x2: "11", y2: "32", stroke: "#00b4d8", strokeWidth: "2", strokeLinecap: "round" }),
          createElement("circle", { cx: "32", cy: "32", r: "3", fill: "#ffffff" }),
          createElement("line", {
            className: "clock-hand clock-hour",
            x1: "32",
            y1: "32",
            x2: "32",
            y2: "18",
            stroke: "#ffffff",
            strokeWidth: "2.5",
            strokeLinecap: "round"
          }),
          createElement("line", {
            className: "clock-hand clock-minute",
            x1: "32",
            y1: "32",
            x2: "32",
            y2: "12",
            stroke: "#00b4d8",
            strokeWidth: "2",
            strokeLinecap: "round"
          }),
          createElement(
            "defs",
            null,
            createElement(
              "linearGradient",
              { id: "clock-grad", x1: "0%", y1: "0%", x2: "100%", y2: "100%" },
              createElement("stop", { offset: "0%", stopColor: "#00b4d8" }),
              createElement("stop", { offset: "100%", stopColor: "#ff7f50" })
            )
          )
        ),
        createElement("div", { className: "loading-text" }, t("shellFallback.loadingTitle")),
        createElement("div", { className: "loading-subtext" }, t("shellFallback.loadingSub", { route: routeId }))
      )
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
    import("./admin/ShellOperationsCenterPage.tsx").then((module) => module.ShellOperationsCenterPage)),
  makePageEntry("operations-center-mail-config", "baseline", () =>
    import("./admin/ShellMailConfigPage.tsx").then((module) => module.ShellMailConfigPage)),
  makePageEntry("advertising-admin", "baseline", () =>
    import("../features/advertising/pages/AdvertisingAdminPage.jsx").then((module) => module.default)),
  makePageEntry("ai-command-center", "baseline", () =>
    import("./AICommandCenterPage.tsx").then((module) => module.AICommandCenterPage)),
  makePageEntry("ai-agent-federation", "baseline", () =>
    import("./AIAgentFederationPage.tsx").then((module) => module.AIAgentFederationPage)),
  makePageEntry("ai-usage-analytics", "baseline", () =>
    import("./AIUsageAnalyticsPage.tsx").then((module) => module.AIUsageAnalyticsPage)),
  makePageEntry("dashboard", "baseline", () =>
    import("./workspace/ShellDashboardPage.tsx").then((module) => module.ShellDashboardPage)),
  makePageEntry("transactions", "baseline", () =>
    import("./workspace/ShellTransactionsPage.tsx").then((module) => module.ShellTransactionsPage)),
  makePageEntry("watchlist", "baseline", () =>
    import("./workspace/ShellWatchlistPage.tsx").then((module) => module.ShellWatchlistPage)),
  makePageEntry("portfolios", "baseline", () =>
    import("./workspace/ShellPortfoliosPage.tsx").then((module) => module.ShellPortfoliosPage)),
  makePageEntry("support", "baseline", () =>
    import("./SupportPage.tsx").then((module) => module.SupportPage)),
  makePageEntry("settings", "baseline", () =>
    import("./system/ShellSettingsPage.tsx").then((module) => module.ShellSettingsPage)),
  // GỠ 2026-10-09 (wave 6): entry `shell-ai-command-center` đã bị xoá khỏi
  // registry. Lý do: `main.tsx` KHÔNG route nào dùng id này ⇒ entry chết, và
  // `check-h1-graph --gate` báo đúng 1 vi phạm `unreferenced-registry-entry`
  // từ wave 4 (treo 2 session vì chờ Owner quyết).
  //
  // Phạm vi CỐ Ý HẸP — KHÔNG xoá `ShellAiCommandCenterPage.tsx`:
  //   - file vẫn được export ở `src/index.js:20` (public API của package)
  //   - `check-shell.mjs:37,454` vẫn import nó
  //   - `__tests__/ai-cc-form-parity.component.test.ts:102` vẫn assert parity
  // Việc xoá file thuộc R0.8 của plan AI Command Center (P0 chưa mở), KHÔNG
  // thuộc wave UI/UX này. Xoá file là việc không khả đảo ngược cho review.
  //
  // Nếu sau này cần route lại: thêm entry + <Route> CÙNG một PR.
  makePageEntry("vip-local-control", "baseline", () =>
    import("./vip/VipLocalControlPage.tsx").then((module) => module.VipLocalControlPage)),
  // SM-P4 core user-facing pages
  makePageEntry("alert-center", "core", () =>
    import("./AlertCenterPage.tsx").then((module) => module.AlertCenterPage)),
  makePageEntry("core-dashboard", "core", () =>
    import("./DashboardPage.tsx").then((module) => module.default)),
  makePageEntry("core-portfolios", "core", () =>
    import("./PortfoliosPage.tsx").then((module) => module.PortfoliosPage)),
  // S-04/S-11: 5 man hinh danh muc dung chung 1 entry. `routeId` trong
  // routeCatalog quyet dinh tab nao duoc mo; component doc `tab` tu path.
  makePageEntry("portfolio-workspace", "core", () =>
    import("./portfolio/PortfolioWorkspacePage.tsx").then((module) => module.PortfolioWorkspacePage)),
  makePageEntry("core-transactions", "core", () =>
    import("./TransactionsPage.tsx").then((module) => module.TransactionsPage)),
  makePageEntry("core-user-settings", "core", () =>
    import("./UserSettingsPage.tsx").then((module) => module.UserSettingsPage)),
  makePageEntry("core-watchlist", "core", () =>
    import("./WatchlistPage.tsx").then((module) => module.WatchlistPage)),
  makePageEntry("auth-login", "core", () =>
    import("./auth/AuthLoginPage.tsx").then((module) => module.AuthLoginPage)),
  makePageEntry("auth-register", "core", () =>
    import("./auth/AuthRegisterPage.tsx").then((module) => module.AuthRegisterPage)),
  makePageEntry("auth-verify-email", "core", () =>
    import("./auth/AuthVerifyEmailPage.tsx").then((module) => module.AuthVerifyEmailPage)),
  makePageEntry("auth-reset-password", "core", () =>
    import("./auth/AuthResetPasswordPage.tsx").then((module) => module.AuthResetPasswordPage)),
  makePageEntry("commercial-billing-center", "core", () =>
    import("./commercial/BillingCenterPage.tsx").then((module) => module.BillingCenterPage)),
  makePageEntry("commercial-payment-return", "core", () =>
    import("./commercial/PaymentReturnPage.tsx").then((module) => module.PaymentReturnPage)),
  makePageEntry("core-stock-detail", "core", () =>
    import("./market/ShellStockDetailPage.js").then((module) => module.ShellStockDetailPage)),
  makePageEntry("screener", "core", () =>
    import("./ScreenerPage.tsx").then((module) => module.ScreenerPage)),
  // Tenant Admin Pages
  makePageEntry("upgrade", "core", () =>
    import("./UpgradePage.tsx").then((module) => module.default)),
  makePageEntry("admin-crawl-control", "core", () =>
    import("./AdminCrawlControlPage.tsx").then((module) => module.default)),
  // AdminCore Pages (SaaS Operator Console)
  makePageEntry("admin-core-overview", "core", () =>
    import("./admin/AdminCoreOverviewPage.tsx").then((module) => module.AdminCoreOverviewPage)),
  makePageEntry("admin-core-tenants", "core", () =>
    import("./admin/AdminCoreTenantsPage.tsx").then((module) => module.AdminCoreTenantsPage)),
  makePageEntry("admin-core-service-accounts", "core", () =>
    import("./admin/AdminCoreServiceAccountsPage.tsx").then((module) => module.AdminCoreServiceAccountsPage)),
  makePageEntry("admin-core-pats", "core", () =>
    import("./admin/AdminCorePATsPage.tsx").then((module) => module.AdminCorePATsPage)),
  makePageEntry("admin-core-usage", "core", () =>
    import("./admin/AdminCoreUsagePage.tsx").then((module) => module.AdminCoreUsagePage)),
  makePageEntry("admin-core-billing", "core", () =>
    import("./admin/AdminCoreBillingPage.tsx").then((module) => module.AdminCoreBillingPage)),
  makePageEntry("admin-core-jobs", "core", () =>
    import("./admin/AdminCoreJobsPage.tsx").then((module) => module.AdminCoreJobsPage)),
  makePageEntry("admin-core-audit-trace", "core", () =>
    import("./admin/AdminCoreAuditTracePage.tsx").then((module) => module.AdminCoreAuditTracePage)),
  makePageEntry("whale-advisory", "core", () =>
    import("./signals/WhaleAdvisoryPage.tsx").then((module) => module.WhaleAdvisoryPage)),
  makePageEntry("tenant-admin-home", "core", () =>
    import("./tenant-admin/TenantAdminHomePage.tsx").then((module) => module.TenantAdminHomePage)),
  makePageEntry("tenant-admin-members", "core", () =>
    import("./tenant-admin/TenantAdminMembersPage.tsx").then((module) => module.TenantAdminMembersPage)),
  makePageEntry("tenant-admin-service-accounts", "core", () =>
    import("./tenant-admin/TenantAdminServiceAccountsPage.tsx").then((module) => module.TenantAdminServiceAccountsPage)),
  makePageEntry("tenant-admin-pats", "core", () =>
    import("./tenant-admin/TenantAdminPATsPage.tsx").then((module) => module.TenantAdminPATsPage)),
  makePageEntry("tenant-admin-usage", "core", () =>
    import("./tenant-admin/TenantAdminUsagePage.tsx").then((module) => module.TenantAdminUsagePage)),
  makePageEntry("tenant-admin-billing", "core", () =>
    import("./tenant-admin/TenantAdminBillingPage.tsx").then((module) => module.TenantAdminBillingPage)),
  makePageEntry("tenant-admin-capabilities", "core", () =>
    import("./tenant-admin/TenantAdminCapabilitiesPage.tsx").then((module) => module.TenantAdminCapabilitiesPage)),
  makePageEntry("tenant-admin-audit-logs", "core", () =>
    import("./tenant-admin/TenantAdminAuditLogsPage.tsx").then((module) => module.TenantAdminAuditLogsPage)),
  makePageEntry("tenant-admin-sso", "core", () =>
    import("./tenant-admin/TenantAdminSSOPage.tsx").then((module) => module.TenantAdminSSOPage)),
  makePageEntry("tenant-admin-usage-history", "core", () =>
    import("./tenant-admin/TenantAdminUsageHistoryPage.tsx").then((module) => module.TenantAdminUsageHistoryPage)),
  makePageEntry("tenant-admin-reports", "core", () =>
    import("./tenant-admin/TenantAdminReportsPage.tsx").then((module) => module.TenantAdminReportsPage)),
  makePageEntry("tenant-admin-security", "core", () =>
    import("./tenant-admin/TenantAdminSecurityPage.tsx").then((module) => module.TenantAdminSecurityPage)),
  makePageEntry("tenant-admin-webhooks", "core", () =>
    import("./tenant-admin/TenantAdminWebhooksPage.tsx").then((module) => module.TenantAdminWebhooksPage)),
  makePageEntry("tenant-admin-settings", "core", () =>
    import("./tenant-admin/TenantAdminSettingsPage.tsx").then((module) => module.TenantAdminSettingsPage)),
  makePageEntry("tenant-admin-roles", "core", () =>
    import("./tenant-admin/TenantAdminRolesPage.tsx").then((module) => module.TenantAdminRolesPage)),
  makePageEntry("admin-users", "core", () =>
    import("./admin/AdminUsersPage.tsx").then((module) => module.AdminUsersPage)),
  makePageEntry("admin-billing", "core", () =>
    import("./admin/AdminBillingFleetPage.tsx").then((module) => module.AdminBillingFleetPage)),
  makePageEntry("admin-usage", "core", () =>
    import("./admin/AdminUsageFleetPage.tsx").then((module) => module.AdminUsageFleetPage)),
  makePageEntry("admin-audit", "core", () =>
    import("./admin/AdminAuditPage.tsx").then((module) => module.AdminAuditPage)),
  makePageEntry("admin-analytics", "core", () =>
    import("./admin/AdminAnalyticsPage.tsx").then((module) => module.AdminAnalyticsPage)),
  makePageEntry("tenant-keys", "core", () =>
    import("./tenant/TenantKeysPage.tsx").then((module) => module.TenantKeysPage)),
  makePageEntry("tenant-usage", "core", () =>
    import("./tenant/TenantUsageSummaryPage.tsx").then((module) => module.TenantUsageSummaryPage)),
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