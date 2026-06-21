import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { PortfolioProvider } from './context/PortfolioContext.js';
import { LangProvider } from './context/LangContext.js';
import { RealtimeProvider } from './context/RealtimeContext.js';
import { getPageComponent } from './pages/pageRegistry.js';
import { AppShell } from './layouts/AppShell.jsx';
import './index.css';

function resolvePageComponent(routeId) {
  let registryId = routeId;
  if (routeId === 'dashboard') registryId = 'core-dashboard';
  else if (routeId === 'whale-alerts') registryId = 'core-whale-alerts';
  else if (routeId === 'ai-advisory') registryId = 'whale-advisory';
  else if (routeId === 'watchlist') registryId = 'core-watchlist';
  else if (routeId === 'transactions') registryId = 'core-transactions';
  else if (routeId === 'portfolios') registryId = 'core-portfolios';
  else if (routeId === 'settings') registryId = 'core-user-settings';

  const component = getPageComponent(registryId);
  if (!component) {
    console.warn(`Could not resolve page component for registryId: ${registryId}`);
    return () => createElement('div', null, `Page ${registryId} not found`);
  }
  return component;
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, authStateReady } = usePortfolio();
  const location = useLocation();

  if (!authStateReady) {
    return createElement(
      'div',
      {
        className: 'min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 font-sans',
      },
      createElement('p', null, 'Đang xác thực tài khoản...')
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
import { useLocation, useNavigate } from 'react-router-dom';
import { authTokenStorage } from './adapters/coreApiAdapter.js';

function App() {
  return createElement(
    BrowserRouter,
    { future: { v7_startTransition: true, v7_relativeSplatPath: true } },
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
        createElement(Route, { path: 'whale-alerts', element: createElement(resolvePageComponent('whale-alerts')) }),
        createElement(Route, { path: 'ai-advisory', element: createElement(resolvePageComponent('ai-advisory')) }),
        createElement(Route, { path: 'upgrade', element: createElement(resolvePageComponent('upgrade')) }),
        createElement(Route, { path: 'admin-crawl-control', element: createElement(resolvePageComponent('admin-crawl-control')) }),
        createElement(Route, { path: 'support', element: createElement(resolvePageComponent('support')) }),
        createElement(Route, { path: 'settings', element: createElement(resolvePageComponent('settings')) }),
        createElement(Route, { path: 'settings/ai', element: createElement(resolvePageComponent('ai-command-center')) }),
        createElement(Route, { path: 'ai-command-center', element: createElement(resolvePageComponent('shell-ai-command-center')) }),
        createElement(Route, { path: 'operations-center', element: createElement(resolvePageComponent('operations-center')) }),
        createElement(Route, { path: 'operations-center/mail-config', element: createElement(resolvePageComponent('operations-center-mail-config')) }),
        createElement(Route, { path: 'stocks/:symbol', element: createElement(resolvePageComponent('core-stock-detail')) }),
        createElement(Route, { path: 'tenant-admin/home', element: createElement(resolvePageComponent('tenant-admin-home')) }),
        createElement(Route, { path: 'tenant-admin/members', element: createElement(resolvePageComponent('tenant-admin-members')) }),
        createElement(Route, { path: 'tenant-admin/service-accounts', element: createElement(resolvePageComponent('tenant-admin-service-accounts')) }),
        createElement(Route, { path: 'tenant-admin/pats', element: createElement(resolvePageComponent('tenant-admin-pats')) }),
        createElement(Route, { path: 'tenant-admin/usage', element: createElement(resolvePageComponent('tenant-admin-usage')) }),
        createElement(Route, { path: 'tenant-admin/billing', element: createElement(resolvePageComponent('tenant-admin-billing')) }),
        createElement(Route, { path: 'tenant-admin/capabilities', element: createElement(resolvePageComponent('tenant-admin-capabilities')) }),
        createElement(Route, { path: 'tenant-admin/audit-logs', element: createElement(resolvePageComponent('tenant-admin-audit-logs')) }),
        createElement(Route, { path: 'tenant-admin', element: createElement(Navigate, { to: '/tenant-admin/home', replace: true }) }),
        createElement(Route, { path: 'alert-center', element: createElement(resolvePageComponent('alert-center')) }),
        createElement(Route, { path: 'commercial/billing', element: createElement(resolvePageComponent('commercial-billing-center')) }),
        createElement(Route, { path: 'commercial/payment-return', element: createElement(resolvePageComponent('commercial-payment-return')) }),
      ),
      createElement(Route, { path: '*', element: createElement(Navigate, { to: '/dashboard', replace: true }) })
    )
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(
  createElement(
    PortfolioProvider,
    null,
    createElement(
      LangProvider,
      null,
      createElement(
        RealtimeProvider,
        null,
        createElement(App)
      )
    )
  )
);