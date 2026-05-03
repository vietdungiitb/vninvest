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

jest.mock('./pages/DashboardShellHost', () => ({
  __esModule: true,
  default: mockPage('dashboard-shell-host', 'Dashboard Shell Host'),
}));

jest.mock('./pages/StockDetail', () => ({
  __esModule: true,
  default: mockPage('stock-detail-page', 'Stock Detail'),
}));

jest.mock('./pages/WhaleAdvisory', () => ({
  __esModule: true,
  default: mockPage('ai-advisory-page', 'Whale Advisory'),
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

jest.mock('./pages/TransactionsShellHost', () => ({
  __esModule: true,
  default: mockPage('transactions-shell-host', 'Transactions Shell Host'),
}));

jest.mock('./pages/Support', () => ({
  __esModule: true,
  default: mockPage('support-page', 'Support'),
}));

jest.mock('./pages/SupportShellHost', () => ({
  __esModule: true,
  default: mockPage('support-shell-host', 'Support Shell Host'),
}));

jest.mock('./pages/SettingsShellHost', () => ({
  __esModule: true,
  default: mockPage('settings-shell-host', 'Settings Shell Host'),
}));

jest.mock('./pages/PortfoliosShellHost', () => ({
  __esModule: true,
  default: mockPage('portfolios-shell-host', 'Portfolios Shell Host'),
}));

jest.mock('./pages/Watchlist', () => ({
  __esModule: true,
  default: mockPage('watchlist-page', 'Watchlist'),
}));

jest.mock('./pages/WatchlistShellHost', () => ({
  __esModule: true,
  default: mockPage('watchlist-shell-host', 'Watchlist Shell Host'),
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

jest.mock('./pages/AdminOpsShellHost', () => ({
  __esModule: true,
  default: mockPage('admin-ops-shell-host', 'Admin Ops Shell Host'),
}));

jest.mock('./pages/AdminCoreOverview', () => ({
  __esModule: true,
  default: mockPage('admin-core-overview-page', 'Admin Core Overview shell'),
}));

jest.mock('./pages/AdminCoreTenants', () => ({
  __esModule: true,
  default: mockPage('admin-core-tenants-page', 'Admin Core Tenants shell'),
}));

jest.mock('./pages/AdminCoreServiceAccounts', () => ({
  __esModule: true,
  default: mockPage('admin-core-service-accounts-page', 'Admin Core Service Accounts shell'),
}));

jest.mock('./pages/AdminCorePATs', () => ({
  __esModule: true,
  default: mockPage('admin-core-pats-page', 'Admin Core PATs shell'),
}));

jest.mock('./pages/AdminCoreUsage', () => ({
  __esModule: true,
  default: mockPage('admin-core-usage-page', 'Admin Core Usage shell'),
}));

jest.mock('./pages/AdminCoreBilling', () => ({
  __esModule: true,
  default: mockPage('admin-core-billing-page', 'Admin Core Billing shell'),
}));

jest.mock('./pages/AdminCoreJobs', () => ({
  __esModule: true,
  default: mockPage('admin-core-jobs-page', 'Admin Core Jobs shell'),
}));

jest.mock('./pages/AdminCoreAuditTrace', () => ({
  __esModule: true,
  default: mockPage('admin-core-audit-trace-page', 'Admin Core Audit Trace shell'),
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

jest.mock('./pages/AICommandCenterShellHost', () => ({
  __esModule: true,
  default: mockPage('ai-command-center-shell-host', 'AI Command Center Shell Host'),
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

function renderAt(pathname, AppComponent = App) {
  window.history.pushState({}, '', pathname);
  return render(<AppComponent />);
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
      can: jest.fn((action, subject) => action === 'read' && (
        subject === 'AdminOps'
        || subject === 'AdminCrawlControl'
        || subject === 'CoreJobOps'
        || subject === 'CoreAuditTrace'
      )),
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

  it('renders the tenant service-account surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants/ten_123/service-accounts');

    expect(await screen.findByTestId('admin-core-service-accounts-page')).toBeInTheDocument();
  });

  it('renders the tenant PAT surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants/ten_123/pats');

    expect(await screen.findByTestId('admin-core-pats-page')).toBeInTheDocument();
  });

  it('renders the tenant usage surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants/ten_123/usage');

    expect(await screen.findByTestId('admin-core-usage-page')).toBeInTheDocument();
  });

  it('renders the tenant billing surface inside the admin core group', async () => {
    renderAt('/admin/core/tenants/ten_123/billing');

    expect(await screen.findByTestId('admin-core-billing-page')).toBeInTheDocument();
  });

  it('renders the crawl-control surface inside the admin core group', async () => {
    renderAt('/admin/core/crawl-control');

    expect(await screen.findByTestId('admin-crawl-control-page')).toBeInTheDocument();
  });

  it('renders the jobs surface inside the admin core group', async () => {
    renderAt('/admin/core/runtime/jobs');

    expect(await screen.findByTestId('admin-core-jobs-page')).toBeInTheDocument();
  });

  it('renders the audit-trace surface inside the admin core group', async () => {
    renderAt('/admin/core/audit/requests');

    expect(await screen.findByTestId('admin-core-audit-trace-page')).toBeInTheDocument();
  });

  it('keeps the admin core group guarded by ability checks', async () => {
    mockUseAbility.mockReturnValue({
      can: jest.fn(() => false),
    });

    renderAt('/admin/core');

    expect(await screen.findByTestId('upgrade-page')).toBeInTheDocument();
  });

  it('falls back to the dashboard when package shell routes are disabled', async () => {
    renderAt('/ai-advisory/shell?symbol=BCM&trade_date=2026-04-15');

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-advisory-shell-host')).not.toBeInTheDocument();
    expect(screen.queryByTestId('whale-alerts-shell-host')).not.toBeInTheDocument();
  });

  it('keeps dashboard on the legacy page when the shell flag is disabled', async () => {
    renderAt('/dashboard');

    expect(await screen.findByTestId('dashboard-page')).toBeInTheDocument();
    expect(screen.queryByTestId('dashboard-shell-host')).not.toBeInTheDocument();
  });

  it('routes dashboard to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/dashboard');

      expect(await screen.findByTestId('dashboard-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('routes support to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/support');

      expect(await screen.findByTestId('support-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('support-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('routes settings to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/settings');

      expect(await screen.findByTestId('settings-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('user-config-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('keeps portfolios on the legacy page when the shell flag is disabled', async () => {
    renderAt('/portfolios');

    expect(await screen.findByTestId('portfolio-management-page')).toBeInTheDocument();
    expect(screen.queryByTestId('portfolios-shell-host')).not.toBeInTheDocument();
  });

  it('routes portfolios to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/portfolios');

      expect(await screen.findByTestId('portfolios-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('portfolio-management-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('keeps admin ops on the legacy page when the shell flag is disabled', async () => {
    renderAt('/admin-ops');

    expect(await screen.findByTestId('admin-ops-page')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-ops-shell-host')).not.toBeInTheDocument();
  });

  it('routes admin ops to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/admin-ops');

      expect(await screen.findByTestId('admin-ops-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('admin-ops-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('keeps settings AI on the legacy page when the shell flag is disabled', async () => {
    renderAt('/settings/ai');

    expect(await screen.findByTestId('ai-command-center-page')).toBeInTheDocument();
    expect(screen.queryByTestId('ai-command-center-shell-host')).not.toBeInTheDocument();
  });

  it('routes settings AI to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/settings/ai');

      expect(await screen.findByTestId('ai-command-center-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('ai-command-center-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('keeps watchlist on the legacy page when the shell flag is disabled', async () => {
    renderAt('/watchlist');

    expect(await screen.findByTestId('watchlist-page')).toBeInTheDocument();
    expect(screen.queryByTestId('watchlist-shell-host')).not.toBeInTheDocument();
  });

  it('keeps transactions on the legacy page when the shell flag is disabled', async () => {
    renderAt('/transactions');

    expect(await screen.findByTestId('transactions-page')).toBeInTheDocument();
    expect(screen.queryByTestId('transactions-shell-host')).not.toBeInTheDocument();
  });

  it('routes transactions to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/transactions');

      expect(await screen.findByTestId('transactions-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('transactions-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

  it('routes watchlist to the package shell host when the shell flag is enabled', async () => {
    const previousFlag = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST;
    process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = '1';

    try {
      renderAt('/watchlist');

      expect(await screen.findByTestId('watchlist-shell-host')).toBeInTheDocument();
      expect(screen.queryByTestId('watchlist-page')).not.toBeInTheDocument();
    } finally {
      process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST = previousFlag;
    }
  });

});