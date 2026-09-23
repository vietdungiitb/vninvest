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
  else if (routeId === 'portfolios') registryId = 'core-portfolios';
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
  const { isAuthenticated, authStateReady } = usePortfolio();
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
        createElement(Route, { path: 'portfolios', element: createElement(resolvePageComponent('portfolios')) }),
        createElement(Route, { path: 'ai-advisory', element: createElement(resolvePageComponent('ai-advisory')) }),
        createElement(Route, { path: 'upgrade', element: createElement(resolvePageComponent('upgrade')) }),
        createElement(Route, { path: 'admin-crawl-control', element: createElement(resolvePageComponent('admin-crawl-control')) }),
        createElement(Route, { path: 'support', element: createElement(resolvePageComponent('support')) }),
        createElement(Route, { path: 'settings', element: createElement(resolvePageComponent('settings')) }),
        createElement(Route, { path: 'settings/ai', element: createElement(resolvePageComponent('ai-command-center')) }),
        createElement(Route, { path: 'settings/ai/agents', element: createElement(resolvePageComponent('ai-agent-federation')) }),
        createElement(Route, { path: 'settings/ai/usage', element: createElement(resolvePageComponent('ai-usage-analytics')) }),
        createElement(Route, { path: 'ai-command-center', element: createElement(RedirectPreserveQuery, { to: '/settings/ai' }) }),
        createElement(Route, { path: 'operations-center', element: createElement(resolvePageComponent('operations-center')) }),
        createElement(Route, { path: 'operations-center/mail-config', element: createElement(resolvePageComponent('operations-center-mail-config')) }),
        ...(isAdvertisingAdminEnabled()
          ? [createElement(Route, { path: 'admin/advertising', element: createElement(resolvePageComponent('advertising-admin')) })]
          : []),
        createElement(Route, { path: 'stocks/:symbol', element: createElement(resolvePageComponent('core-stock-detail')) }),
        createElement(Route, { path: 'tenant-admin', element: createElement(TenantAdminLayout) },
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
