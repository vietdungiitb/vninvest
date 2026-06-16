import { createElement, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet, Link } from 'react-router-dom';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext.js';
import { LangProvider, useI18n } from './context/LangContext.js';
import { RealtimeProvider } from './context/RealtimeContext.js';
import { routeCatalog } from './app/routeCatalog.js';
import { getPageComponent } from './pages/pageRegistry.js';
import { authTokenStorage } from './adapters/coreApiAdapter.js';
import './index.css';

const layoutStyles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    fontFamily: '"IBM Plex Sans", sans-serif',
  },
  sidebar: {
    width: '260px',
    backgroundColor: 'var(--bg-panel)',
    borderRight: '1px solid var(--border-default)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  logoContainer: {
    padding: '24px',
    borderBottom: '1px solid var(--border-default)',
  },
  logo: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'var(--accent-cyan)',
    letterSpacing: '-0.5px',
  },
  nav: {
    flex: 1,
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  navLink: (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: '12px',
    textDecoration: 'none',
    color: isActive ? 'var(--accent-cyan)' : 'var(--text-secondary)',
    backgroundColor: isActive ? 'rgba(18, 199, 232, 0.08)' : 'transparent',
    border: isActive ? '1px solid rgba(18, 199, 232, 0.2)' : '1px solid transparent',
    transition: 'all 0.2s ease',
    fontWeight: '600',
  }),
  profileSection: {
    padding: '16px',
    borderTop: '1px solid var(--border-default)',
    backgroundColor: 'rgba(8, 23, 52, 0.3)',
  },
  username: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    marginBottom: '2px',
  },
  email: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    marginBottom: '12px',
  },
  logoutBtn: {
    width: '100%',
    padding: '10px',
    borderRadius: '10px',
    border: '1px solid rgba(255, 94, 126, 0.3)',
    backgroundColor: 'rgba(255, 94, 126, 0.08)',
    color: '#ff5e7e',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  main: {
    flex: 1,
    padding: '32px',
    overflowY: 'auto',
  }
};

function resolvePageComponent(routeId) {
  let registryId = routeId;
  if (routeId === 'dashboard') registryId = 'core-dashboard';
  else if (routeId === 'whale-alerts') registryId = 'alert-center';
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

export function Layout() {
  const { userIdentity, logout } = usePortfolio();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarItems = [
    { label: 'Dashboard', path: '/dashboard', icon: '📊' },
    { label: 'Watchlist', path: '/watchlist', icon: '⭐️' },
    { label: 'Giao dịch', path: '/transactions', icon: '💸' },
    { label: 'Danh mục', path: '/portfolios', icon: '💼' },
    { label: 'Whale Alerts', path: '/whale-alerts', icon: '🐋' },
    { label: 'Support', path: '/support', icon: '💬' },
    { label: 'Cài đặt', path: '/settings', icon: '⚙️' },
    { label: 'AI Control', path: '/settings/ai', icon: '🧠' },
    { label: 'SOC Operator', path: '/operations-center', icon: '🛠️' },
  ];

  return createElement(
    'div',
    { style: layoutStyles.container },
    createElement(
      'aside',
      { style: layoutStyles.sidebar },
      createElement(
        'div',
        { style: layoutStyles.logoContainer },
        createElement('h1', { style: layoutStyles.logo }, 'VNInvest')
      ),
      createElement(
        'nav',
        { style: layoutStyles.nav },
        sidebarItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
          return createElement(
            Link,
            {
              key: item.path,
              to: item.path,
              style: layoutStyles.navLink(isActive),
            },
            createElement('span', null, item.icon),
            createElement('span', null, item.label)
          );
        })
      ),
      createElement(
        'div',
        { style: layoutStyles.profileSection },
        createElement('div', { style: layoutStyles.username }, userIdentity.username || 'User'),
        createElement('div', { style: layoutStyles.email }, userIdentity.email || ''),
        createElement(
          'button',
          {
            onClick: handleLogout,
            style: layoutStyles.logoutBtn,
          },
          'Đăng xuất'
        )
      )
    ),
    createElement(
      'main',
      { style: layoutStyles.main },
      createElement(Outlet)
    )
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated, authStateReady } = usePortfolio();
  const location = useLocation();

  if (!authStateReady) {
    return createElement(
      'div',
      {
        style: {
          display: 'flex',
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-primary)',
          fontFamily: '"IBM Plex Sans", sans-serif',
        },
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
        { path: '/', element: createElement(ProtectedRoute, null, createElement(Layout)) },
        createElement(Route, { index: true, element: createElement(Navigate, { to: '/dashboard', replace: true }) }),
        createElement(Route, { path: 'dashboard', element: createElement(resolvePageComponent('dashboard')) }),
        createElement(Route, { path: 'watchlist', element: createElement(resolvePageComponent('watchlist')) }),
        createElement(Route, { path: 'transactions', element: createElement(resolvePageComponent('transactions')) }),
        createElement(Route, { path: 'portfolios', element: createElement(resolvePageComponent('portfolios')) }),
        createElement(Route, { path: 'whale-alerts', element: createElement(resolvePageComponent('whale-alerts')) }),
        createElement(Route, { path: 'support', element: createElement(resolvePageComponent('support')) }),
        createElement(Route, { path: 'settings', element: createElement(resolvePageComponent('settings')) }),
        createElement(Route, { path: 'settings/ai', element: createElement(resolvePageComponent('ai-command-center')) }),
        createElement(Route, { path: 'operations-center', element: createElement(resolvePageComponent('operations-center')) }),
        createElement(Route, { path: 'operations-center/mail-config', element: createElement(resolvePageComponent('operations-center-mail-config')) }),
        createElement(Route, { path: 'stocks/:symbol', element: createElement(resolvePageComponent('core-stock-detail')) }),
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
