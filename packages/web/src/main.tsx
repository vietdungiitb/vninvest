import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext.js';
import { LangProvider, useI18n } from './context/LangContext.js';
import { RealtimeProvider } from './context/RealtimeContext.js';
import { ToastProvider } from './components/ShellToast.js';
import { ConfirmProvider } from './components/ConfirmModal.js';
import { QueryProvider } from './providers/QueryProvider.js';
import { getPageComponent } from './pages/pageRegistry.js';
import { AppShell } from './layouts/AppShell';
import { TenantAdminLayout } from './components/TenantAdminLayout.js';
import { StaffRoute, TenantRoute } from './components/StaffRoute.js';
import './index.css';

// Feature flag for gradual rollout of the Advertising & Trademark admin page.
// Defaults to enabled; set VITE_FEATURE_ADVERTISING_ADMIN=false to disable.
function isAdvertisingAdminEnabled(): boolean {
  return import.meta.env.VITE_FEATURE_ADVERTISING_ADMIN !== 'false';
}

function resolvePageComponent(routeId: string) {
  let registryId = routeId;
  if (routeId === 'dashboard') registryId = 'core-dashboard';
  else if (routeId === 'whale-alerts') registryId = 'alert-center';
  else if (routeId === 'ai-advisory') registryId = 'whale-advisory';
  else if (routeId === 'watchlist') registryId = 'core-watchlist';
  else if (routeId === 'transactions') registryId = 'core-transactions';
  // D-01 (Owner chốt 2026-10-13): routeId ở đây PHẢI trùng id trong
  // `routeCatalog` để titleKey/requiredCapabilities không bao giờ mù chiều
  // ngược. Registry id (`core-*`) giữ nguyên — resolver là lớp ánh xạ duy nhất.
  else if (routeId === 'portfolios') registryId = 'portfolio-workspace';
    else if (routeId === 'portfolios-manage') registryId = 'core-portfolios';
    // D-36: broker panel tach route rieng. Registry id giu `portfolios-broker`
    // de khong doi 2 chiều với routeId catalog `portfolios-manage-broker`.
    // KHONG bat `routeId.startsWith('portfolio-')` o duoi: rule do chi bat
    // `portfolio-` (so), `portfolios-manage-broker` bat dau bang `portfolios-`.
    else if (routeId === 'portfolios-manage-broker') registryId = 'portfolios-broker';
  else if (routeId === 'admin-tenants') registryId = 'admin-core-tenants';
  else if (routeId === 'admin-tenant-service-accounts') registryId = 'admin-core-service-accounts';
  else if (routeId === 'admin-tenant-pats') registryId = 'admin-core-pats';
  else if (routeId === 'admin-tenant-usage') registryId = 'admin-core-usage';
  else if (routeId === 'admin-tenant-billing') registryId = 'admin-core-billing';
  else if (routeId === 'admin-overview') registryId = 'admin-core-overview';
  else if (routeId === 'admin-jobs') registryId = 'admin-core-jobs';
  else if (routeId === 'admin-audit-trace') registryId = 'admin-core-audit-trace';
  // S-11: 5 route danh muc cung dung MOT entry. Component doc tab tu path.
  else if (routeId.startsWith('portfolio-')) registryId = 'portfolio-workspace';
  else if (routeId === 'settings') registryId = 'core-user-settings';

  const component = getPageComponent(registryId);
  if (!component) {
    console.warn(`Could not resolve page component for registryId: ${registryId}`);
    return () => createElement(MissingPageComponent, { registryId });
  }
  return component;
}

function MissingPageComponent({ registryId }: { registryId: string }) {
  const { t } = useI18n();
  return createElement('div', null, t('shellFallback.pageNotFound', { route: registryId }));
}

// Menu 2026-09-22: redirect giữ query/hash cho URL cũ (whale-alerts, ai-command-center).
// Đặt TRƯỚC route gốc, dùng replace để không tạo vòng lặp lịch sử.
function RedirectPreserveQuery({ to }: { to: string }) {
  const location = useLocation();
  const target = `${to}${location.search || ''}${location.hash || ''}`;
  return createElement(Navigate, { to: target, replace: true });
}

function WhaleAlertsRedirect() {
  const location = useLocation();
  const suffix = location.pathname.startsWith('/whale-alerts/')
    ? location.pathname.slice('/whale-alerts'.length)
    : '';
  const target = `/alert-center${suffix}${location.search || ''}${location.hash || ''}`;
  return createElement(Navigate, { to: target, replace: true });
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, authStateReady, authStateError, retryAuthBootstrap } = usePortfolio();
  const { t } = useI18n();
  const location = useLocation();

  if (!authStateReady) {
    return createElement(
      'div',
      {
        className: 'min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans',
      },
      createElement('p', null, t('shellFallback.verifyingAccount'))
    );
  }

  const hasStoredTokens = authTokenStorage.hasTokens();
  if (!isAuthenticated || !hasStoredTokens) {
    return createElement(Navigate, { to: '/login', replace: true, state: { from: location.pathname } });
  }

  // A failed bootstrap used to release this gate in `finally` and log the failure
  // to the console only, so the user got the full shell with an empty identity, no
  // portfolios and no way to tell anything was wrong. Show it, with a retry.
  // Only reached when the session itself is still valid -- a 401 is handled above
  // by redirecting to /login.
  if (authStateError) {
    const retryable = authStateError.retryable !== false;
    return createElement(
      'div',
      {
        className:
          'min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans px-4',
      },
      createElement(
        'div',
        { className: 'max-w-md text-center', role: 'alert' },
        createElement('p', { className: 'text-base mb-4' }, authStateError.message || t('shellFallback.bootstrapFailed')),
        retryable &&
          createElement(
            'button',
            {
              type: 'button',
              onClick: () => retryAuthBootstrap(),
              className: 'px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium',
            },
            t('shellFallback.bootstrapRetry')
          )
      )
    );
  }

  return children;
}

// Need to import usePortfolio and useLocation for ProtectedRoute
import { usePortfolio } from './context/PortfolioContext.js';
import { useLocation } from 'react-router-dom';
import { authTokenStorage } from './adapters/coreApiAdapter.js';

function App() {
  return createElement(
    BrowserRouter,
    { future: { v7_relativeSplatPath: true } },
    createElement(
      Routes,
      null,
      createElement(Route, { path: '/login', element: createElement(resolvePageComponent('auth-login')) }),
      createElement(Route, { path: '/register', element: createElement(resolvePageComponent('auth-register')) }),
      createElement(Route, { path: '/verify-email', element: createElement(resolvePageComponent('auth-verify-email')) }),
      createElement(Route, { path: '/reset-password', element: createElement(resolvePageComponent('auth-reset-password')) }),

      createElement(
        Route,
        { path: '/', element: createElement(ProtectedRoute, null, createElement(AppShell)) },
        createElement(Route, { index: true, element: createElement(Navigate, { to: '/dashboard', replace: true }) }),
        createElement(Route, { path: 'dashboard', element: createElement(resolvePageComponent('dashboard')) }),
        createElement(Route, { path: 'watchlist', element: createElement(resolvePageComponent('watchlist')) }),
        createElement(Route, { path: 'screener', element: createElement(resolvePageComponent('screener')) }),
        createElement(Route, { path: 'transactions', element: createElement(resolvePageComponent('transactions')) }),
        // /portfolios la entry workspace: neu URL khong co id, trang tu chon
        // danh muc dau tien (PortfolioWorkspacePage). Trang quan ly CRUD chuyen
        // sang /portfolios/manage de khong con la "man hinh chet".
          createElement(Route, { path: 'portfolios', element: createElement(resolvePageComponent('portfolios')) }),
          createElement(Route, { path: 'portfolios/manage', element: createElement(resolvePageComponent('portfolios-manage')) }),
          // D-36 (`PORTFOLIO_EXEC_PLAN_MASTER_20260927.md:83`) "Broker Hub tach rieng".
          // Panel DNSE (nhap credential + sync + DAT LENH) da nam tren cung trang
          // danh muc; tach route rieng cho ranh giinh giua "xem" va "giao dich".
          // Thu tu KHONG duoc doi: phai khai `manage/broker` TRUOC `manage`,
          // neu khong React Router se gan `manage/broker` vao param cua
          // `portfolios/:portfolioId/...` va mo sai trang.
          // B2.6 (Wave 2 Broker Hub): URL cũ redirect về `/broker` (quyết định
          // PLAN §0.6) — giữ query/hash qua `RedirectPreserveQuery`.
          createElement(Route, { path: 'portfolios/manage/broker', element: createElement(RedirectPreserveQuery, { to: '/broker' }) }),
          // B2.1: Broker Hub — route `/broker` (catalog id `broker` ↔ registry
          // `broker`, không qua lớp ánh xạ).
          createElement(Route, { path: 'broker', element: createElement(resolvePageComponent('broker')) }),
          // Follow-up mount: route con `/broker/accounts/:accountId`
          // (catalog `broker-account` ↔ registry `broker-account`) — trang chi
          // tiết tiểu khoản: AccountManager 4 tab + SyncCenter (DATA).
          createElement(Route, { path: 'broker/accounts/:accountId', element: createElement(resolvePageComponent('broker-account')) }),
        // S-11: 5 man hinh danh muc, moi URL rieng de deep-link + F5 giu dung
        // tab. Cung tro toi MOT entry `portfolio-workspace`; tab lay tu path.
        createElement(Route, { path: 'portfolios/:portfolioId/overview', element: createElement(resolvePageComponent('portfolio-overview')) }),
        createElement(Route, { path: 'portfolios/:portfolioId/holdings', element: createElement(resolvePageComponent('portfolio-holdings')) }),
        createElement(Route, { path: 'portfolios/:portfolioId/allocation', element: createElement(resolvePageComponent('portfolio-allocation')) }),
        createElement(Route, { path: 'portfolios/:portfolioId/analytics', element: createElement(resolvePageComponent('portfolio-analytics')) }),
        createElement(Route, { path: 'portfolios/:portfolioId/activity', element: createElement(resolvePageComponent('portfolio-activity')) }),
        createElement(Route, { path: 'ai-advisory', element: createElement(resolvePageComponent('ai-advisory')) }),
        createElement(Route, { path: 'upgrade', element: createElement(resolvePageComponent('upgrade')) }),
        createElement(Route, { path: 'admin-crawl-control', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-crawl-control'))) }),
        createElement(Route, { path: 'support', element: createElement(resolvePageComponent('support')) }),
        createElement(Route, { path: 'tenant/keys', element: createElement(TenantRoute, null, createElement(resolvePageComponent('tenant-keys'))) }),
        createElement(Route, { path: 'tenant/usage', element: createElement(TenantRoute, null, createElement(resolvePageComponent('tenant-usage'))) }),
        createElement(Route, { path: 'settings', element: createElement(resolvePageComponent('settings')) }),
        createElement(Route, { path: 'settings/ai', element: createElement(resolvePageComponent('ai-command-center')) }),
        createElement(Route, { path: 'settings/ai/agents', element: createElement(resolvePageComponent('ai-agent-federation')) }),
        createElement(Route, { path: 'settings/ai/usage', element: createElement(resolvePageComponent('ai-usage-analytics')) }),
    // R3.2: trang Traces — phải khai TRƯỚC `settings/ai/*` khác? không có route
    // anh em nào cạnh tranh, nhưng nhất quán: đặt cạnh hai route AI kia.
    createElement(Route, { path: 'settings/ai/traces', element: createElement(resolvePageComponent('ai-traces')) }),
    // R3.3: dashboard SLO LLM.
    createElement(Route, { path: 'settings/ai/slo', element: createElement(resolvePageComponent('ai-slo')) }),
        createElement(Route, { path: 'ai-command-center', element: createElement(RedirectPreserveQuery, { to: '/settings/ai' }) }),
        createElement(Route, { path: 'operations-center', element: createElement(StaffRoute, null, createElement(resolvePageComponent('operations-center'))) }),
        createElement(Route, { path: 'operations-center/mail-config', element: createElement(StaffRoute, null, createElement(resolvePageComponent('operations-center-mail-config'))) }),
        ...(isAdvertisingAdminEnabled()
          ? [createElement(Route, { path: 'admin/advertising', element: createElement(StaffRoute, null, createElement(resolvePageComponent('advertising-admin'))) })]
          : []),
        createElement(Route, { path: 'admin/users', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-users'))) }),
        createElement(Route, { path: 'admin/billing', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-billing'))) }),
        createElement(Route, { path: 'admin/usage', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-usage'))) }),
        createElement(Route, { path: 'admin/audit', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-audit'))) }),
        createElement(Route, { path: 'admin/analytics', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-analytics'))) }),
        createElement(Route, { path: 'admin/tenants', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenants'))) }),
        createElement(Route, { path: 'admin/tenants/:tenantId', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenants'))) }),
        createElement(Route, { path: 'admin/tenants/:tenantId/service-accounts', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenant-service-accounts'))) }),
        createElement(Route, { path: 'admin/tenants/:tenantId/pats', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenant-pats'))) }),
        createElement(Route, { path: 'admin/tenants/:tenantId/usage', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenant-usage'))) }),
        createElement(Route, { path: 'admin/tenants/:tenantId/billing', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-tenant-billing'))) }),
        createElement(Route, { path: 'admin/overview', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-overview'))) }),
        createElement(Route, { path: 'admin/jobs', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-jobs'))) }),
        createElement(Route, { path: 'admin/audit-trace', element: createElement(StaffRoute, null, createElement(resolvePageComponent('admin-audit-trace'))) }),
        createElement(Route, { path: 'stocks/:symbol', element: createElement(resolvePageComponent('core-stock-detail')) }),
        createElement(Route, { path: 'tenant-admin', element: createElement(TenantRoute, null, createElement(TenantAdminLayout)) },
          createElement(Route, { index: true, element: createElement(Navigate, { to: '/tenant-admin/home', replace: true }) }),
          createElement(Route, { path: 'home', element: createElement(resolvePageComponent('tenant-admin-home')) }),
          createElement(Route, { path: 'members', element: createElement(resolvePageComponent('tenant-admin-members')) }),
          createElement(Route, { path: 'service-accounts', element: createElement(resolvePageComponent('tenant-admin-service-accounts')) }),
          createElement(Route, { path: 'pats', element: createElement(resolvePageComponent('tenant-admin-pats')) }),
          createElement(Route, { path: 'usage', element: createElement(resolvePageComponent('tenant-admin-usage')) }),
          createElement(Route, { path: 'usage-history', element: createElement(resolvePageComponent('tenant-admin-usage-history')) }),
          createElement(Route, { path: 'billing', element: createElement(resolvePageComponent('tenant-admin-billing')) }),
          createElement(Route, { path: 'capabilities', element: createElement(resolvePageComponent('tenant-admin-capabilities')) }),
          createElement(Route, { path: 'audit-logs', element: createElement(resolvePageComponent('tenant-admin-audit-logs')) }),
          createElement(Route, { path: 'reports', element: createElement(resolvePageComponent('tenant-admin-reports')) }),
          createElement(Route, { path: 'sso', element: createElement(resolvePageComponent('tenant-admin-sso')) }),
          createElement(Route, { path: 'security', element: createElement(resolvePageComponent('tenant-admin-security')) }),
          createElement(Route, { path: 'webhooks', element: createElement(resolvePageComponent('tenant-admin-webhooks')) }),
          createElement(Route, { path: 'settings', element: createElement(resolvePageComponent('tenant-admin-settings')) }),
          createElement(Route, { path: 'roles', element: createElement(resolvePageComponent('tenant-admin-roles')) }),
        ),
        createElement(Route, { path: 'alert-center', element: createElement(resolvePageComponent('alert-center')) }),
        createElement(Route, { path: 'whale-alerts', element: createElement(WhaleAlertsRedirect) }),
        createElement(Route, { path: 'whale-alerts/*', element: createElement(WhaleAlertsRedirect) }),
        createElement(Route, { path: 'vip/local-control', element: createElement(resolvePageComponent('vip-local-control')) }),
        createElement(Route, { path: 'commercial/billing', element: createElement(resolvePageComponent('commercial-billing-center')) }),
        createElement(Route, { path: 'commercial/payment-return', element: createElement(resolvePageComponent('commercial-payment-return')) }),
      ),
      createElement(Route, { path: '*', element: createElement(Navigate, { to: '/dashboard', replace: true }) })
    )
  );
}

// Áp theme đã lưu trước first paint để không nháy dark khi user chọn light.
try {
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    const storedTheme = window.localStorage.getItem('vninvest-theme');
    if (storedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }
} catch {
  // private mode — bỏ qua
}

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    createElement(
      QueryProvider,
      null,
      createElement(
        PortfolioProvider,
        null,
        createElement(
          LangProvider,
          null,
          createElement(
            ToastProvider,
            null,
            createElement(
              ConfirmProvider,
              null,
              createElement(
                RealtimeProvider,
                null,
                createElement(App)
              )
            )
          )
        )
      )
    )
  );
}
