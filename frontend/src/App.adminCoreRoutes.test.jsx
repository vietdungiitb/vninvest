import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Outlet } from 'react-router-dom';

import App from './App';
import { useAbility } from './context/AbilityContext';
import { usePortfolio } from './context/PortfolioContext';

function mockPage(testId, label) {
  return function MockPage() {
    return <div data-testid={testId}>{label}</div>;
  };
}

jest.mock('./components/Layout', () => ({
  __esModule: true,
  default: () => {
    const { Outlet: RouterOutlet } = require('react-router-dom');
    return <RouterOutlet />;
  },
}));

jest.mock('./components/LoginModal', () => ({
  __esModule: true,
  default: mockPage('login-modal', 'Login Modal'),
}));

jest.mock('./pages/Dashboard', () => ({
  __esModule: true,
  default: mockPage('dashboard-page', 'Dashboard'),
}));

jest.mock('./pages/StockDetail', () => ({
  __esModule: true,
  default: mockPage('stock-detail-page', 'Stock Detail'),
}));

jest.mock('./pages/WhaleAdvisory', () => ({
  __esModule: true,
  default: mockPage('whale-advisory-page', 'Whale Advisory'),
}));

jest.mock('./pages/AiAdvisoryShellHost', () => ({
  __esModule: true,
  default: mockPage('ai-advisory-shell-host', 'AI Advisory Shell Host'),
}));

jest.mock('./pages/WhaleAlertsHub', () => ({
  __esModule: true,
  default: mockPage('whale-alerts-hub-page', 'Whale Alerts Hub'),
}));

jest.mock('./pages/WhaleAlertsDashboard', () => ({
  __esModule: true,
  default: mockPage('whale-alerts-dashboard-page', 'Whale Alerts Dashboard'),
}));

jest.mock('./pages/WhaleAlertsShellHost', () => ({
  __esModule: true,
  default: mockPage('whale-alerts-shell-host', 'Whale Alerts Shell Host'),
}));

jest.mock('./pages/Transactions', () => ({
  __esModule: true,
  default: mockPage('transactions-page', 'Transactions'),
}));

jest.mock('./pages/Support', () => ({
  __esModule: true,
  default: mockPage('support-page', 'Support'),
}));

jest.mock('./pages/Watchlist', () => ({
  __esModule: true,
  default: mockPage('watchlist-page', 'Watchlist'),
}));

jest.mock('./context/PortfolioContext', () => ({
  PortfolioProvider: ({ children }) => <>{children}</>,
  usePortfolio: jest.fn(),
}));

jest.mock('./context/AbilityContext', () => ({
  useAbility: jest.fn(),
}));

jest.mock('./context/LangContext', () => ({
  LangProvider: ({ children }) => <>{children}</>,
  useI18n: jest.fn(() => ({ t: (key, params) => params?.defaultValue || key, locale: 'vi', setLanguage: jest.fn() })),
}));

jest.mock('./context/RealtimeContext', () => ({
  RealtimeProvider: ({ children }) => <>{children}</>,
}));

jest.mock('./context/InterfaceContext', () => ({
  InterfaceProvider: ({ children }) => <>{children}</>,
  useInterface: jest.fn(() => ({
    uiMode: 'classic',
    toggleUiMode: jest.fn(),
    modernLeftSidebarOpen: false,
    toggleModernLeftSidebar: jest.fn(),
  })),
}));

jest.mock('./pages/AdminOps', () => ({
  __esModule: true,
  default: mockPage('admin-ops-page', 'Admin Ops shell'),
}));

jest.mock('./pages/AdminCoreOverview', () => ({
  __esModule: true,
  default: mockPage('admin-core-overview-page', 'Admin Core Overview shell'),
}));

jest.mock('./pages/AdminCoreTenants', () => ({
  __esModule: true,
  default: mockPage('admin-core-tenants-page', 'Admin Core Tenants shell'),
}));

jest.mock('./pages/AdminCrawlControl', () => ({
  __esModule: true,
  default: mockPage('admin-crawl-control-page', 'Admin Crawl Control shell'),
}));

jest.mock('./pages/Screener', () => ({
  __esModule: true,
  default: mockPage('screener-page', 'Screener'),
}));

jest.mock('./pages/PortfolioManagement', () => ({
  __esModule: true,
  default: mockPage('portfolio-management-page', 'Portfolio Management'),
}));

jest.mock('./pages/UserConfig', () => ({
  __esModule: true,
  default: mockPage('user-config-page', 'User Config'),
}));

jest.mock('./pages/admin/tenant/TenantAdminHome', () => ({
  __esModule: true,
  default: mockPage('tenant-admin-home-page', 'Tenant Admin Home'),
}));

jest.mock('./pages/admin/tenant/TenantBilling', () => ({
  __esModule: true,
  default: mockPage('tenant-billing-page', 'Tenant Billing'),
}));

jest.mock('./pages/admin/tenant/TenantCapabilities', () => ({
  __esModule: true,
  default: mockPage('tenant-capabilities-page', 'Tenant Capabilities'),
}));

jest.mock('./pages/admin/tenant/TenantPATs', () => ({
  __esModule: true,
  default: mockPage('tenant-pats-page', 'Tenant PATs'),
}));

jest.mock('./pages/admin/tenant/TenantServiceAccounts', () => ({
  __esModule: true,
  default: mockPage('tenant-service-accounts-page', 'Tenant Service Accounts'),
}));

jest.mock('./pages/admin/tenant/TenantUsage', () => ({
  __esModule: true,
  default: mockPage('tenant-usage-page', 'Tenant Usage'),
}));

jest.mock('./pages/AICommandCenter', () => ({
  __esModule: true,
  default: mockPage('ai-command-center-page', 'AI Command Center'),
}));

jest.mock('./pages/Upgrade', () => ({
  __esModule: true,
  default: mockPage('upgrade-page', 'Upgrade'),
}));

jest.mock('./pages/VerifyEmail', () => ({
  __esModule: true,
  default: mockPage('verify-email-page', 'Verify Email'),
}));

jest.mock('./pages/ResetPassword', () => ({
  __esModule: true,
  default: mockPage('reset-password-page', 'Reset Password'),
}));

const mockUsePortfolio = jest.requireMock('./context/PortfolioContext').usePortfolio;
const mockUseAbility = jest.requireMock('./context/AbilityContext').useAbility;

function renderAt(pathname) {
  window.history.pushState({}, '', pathname);
  return render(<App />);
}

describe('App admin core route group', () => {
  beforeEach(() => {
    localStorage.setItem('access_token', 'access-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    mockUsePortfolio.mockReturnValue({
      isAuthenticated: true,
      authStateReady: true,
    });
    mockUseAbility.mockReturnValue({
      can: jest.fn((action, subject) => action === 'read' && (subject === 'AdminOps' || subject === 'AdminCrawlControl')),
    });
  });

  afterEach(() => {
    localStorage.clear();
    window.history.pushState({}, '', '/');
    jest.clearAllMocks();
  });

  it('routes the admin core group root to the overview surface', async () => {
    renderAt('/admin/core');

    expect(await screen.findByTestId('admin-core-overview-page')).toBeInTheDocument();
  });

  it('renders the dedicated admin core overview surface directly', async () => {
    renderAt('/admin/core/overview');

    expect(await screen.findByTestId('admin-core-overview-page')).toBeInTheDocument();
  });

  it('renders the tenant registry surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants');

    expect(await screen.findByTestId('admin-core-tenants-page')).toBeInTheDocument();
  });

  it('renders the tenant detail surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants/ten_123');

    expect(await screen.findByTestId('admin-core-tenants-page')).toBeInTheDocument();
  });

  it('renders the crawl-control surface inside the admin core group', async () => {
    renderAt('/admin/core/crawl-control');

    expect(await screen.findByTestId('admin-crawl-control-page')).toBeInTheDocument();
  });

  it('keeps the admin core group guarded by ability checks', async () => {
    mockUseAbility.mockReturnValue({
      can: jest.fn(() => false),
    });

    renderAt('/admin/core');

    expect(await screen.findByTestId('upgrade-page')).toBeInTheDocument();
  });
});