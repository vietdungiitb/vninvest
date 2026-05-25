import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

import App from './App';
import { useAbility } from './context/AbilityContext';
import { usePortfolio } from './context/PortfolioContext';

jest.mock('./components/Layout', () => {
  const { Outlet } = require('react-router-dom');

  return function MockLayout() {
    return (
      <div data-testid="layout-shell">
        <Outlet />
      </div>
    );
  };
});

jest.mock('./components/LoginModal', () => function MockLoginModal() {
  return <div data-testid="login-modal" />;
});

jest.mock('./pages/modern/ModernDashboard', () => function MockDashboard() {
  return <div data-testid="dashboard-page" />;
});

jest.mock('./pages/DashboardShellHost', () => function MockDashboardShellHost() {
  return <div data-testid="dashboard-shell-page" />;
});

jest.mock('./pages/PackageDashboardHost', () => function MockPackageDashboardHost() {
  return <div data-testid="package-dashboard-host-page" />;
});

jest.mock('./pages/StockDetailPageHost', () => function MockStockDetailPageHost() {
  return <div data-testid="stock-detail-host-page" />;
});

jest.mock('./pages/StockDetail', () => function MockStockDetail() {
  return <div data-testid="stock-detail-page" />;
});

jest.mock('./pages/WhaleAdvisory', () => function MockWhaleAdvisory() {
  return <div data-testid="whale-advisory-page" />;
});

jest.mock('./pages/AiAdvisoryShellHost', () => function MockAiAdvisoryShellHost() {
  return <div data-testid="ai-advisory-shell-page" />;
});

jest.mock('@vninvest/web', () => ({
  AlertCenterPage: function MockAlertCenterPage() {
    return <div data-testid="whale-alerts-hub-page" />;
  },
  AuthLoginPage: function MockAuthLoginPage() {
    return <div data-testid="auth-login-page" />;
  },
  AuthRegisterPage: function MockAuthRegisterPage() {
    return <div data-testid="auth-register-page" />;
  },
  AuthVerifyEmailPage: function MockAuthVerifyEmailPage() {
    return <div data-testid="auth-verify-email-page" />;
  },
  AuthResetPasswordPage: function MockAuthResetPasswordPage() {
    return <div data-testid="auth-reset-password-page" />;
  },
  authTokenStorage: {
    hasTokens: () => true,
  },
}));

jest.mock('./pages/WhaleAlertsDashboard', () => function MockWhaleAlertsDashboard() {
  return <div data-testid="whale-alerts-dashboard-page" />;
});

jest.mock('./pages/WhaleAlertsShellHost', () => function MockWhaleAlertsShellHost() {
  return <div data-testid="whale-alerts-shell-page" />;
});

jest.mock('./pages/Transactions', () => function MockTransactions() {
  return <div data-testid="transactions-page" />;
});

jest.mock('./pages/TransactionsShellHost', () => function MockTransactionsShellHost() {
  return <div data-testid="transactions-shell-page" />;
});

jest.mock('./pages/Support', () => function MockSupport() {
  return <div data-testid="support-page" />;
});

jest.mock('./pages/SupportShellHost', () => function MockSupportShellHost() {
  return <div data-testid="support-shell-page" />;
});

jest.mock('./pages/SettingsShellHost', () => function MockSettingsShellHost() {
  return <div data-testid="settings-shell-page" />;
});

jest.mock('./pages/AICommandCenterShellHost', () => function MockAICommandCenterShellHost() {
  return <div data-testid="ai-command-center-shell-page" />;
});

jest.mock('./pages/PortfoliosShellHost', () => function MockPortfoliosShellHost() {
  return <div data-testid="portfolios-shell-page" />;
});

jest.mock('./pages/Watchlist', () => function MockWatchlist() {
  return <div data-testid="watchlist-page" />;
});

jest.mock('./pages/WatchlistShellHost', () => function MockWatchlistShellHost() {
  return <div data-testid="watchlist-shell-page" />;
});

jest.mock('./pages/AdminCoreOverview', () => function MockAdminCoreOverview() {
  return <div data-testid="admin-core-overview-page" />;
});

jest.mock('./pages/AdminCoreTenants', () => function MockAdminCoreTenants() {
  return <div data-testid="admin-core-tenants-page" />;
});

jest.mock('./pages/AdminCoreServiceAccounts', () => function MockAdminCoreServiceAccounts() {
  return <div data-testid="admin-core-service-accounts-page" />;
});

jest.mock('./pages/AdminCorePATs', () => function MockAdminCorePATs() {
  return <div data-testid="admin-core-pats-page" />;
});

jest.mock('./pages/AdminCoreUsage', () => function MockAdminCoreUsage() {
  return <div data-testid="admin-core-usage-page" />;
});

jest.mock('./pages/AdminCoreBilling', () => function MockAdminCoreBilling() {
  return <div data-testid="admin-core-billing-page" />;
});

jest.mock('./pages/AdminCoreJobs', () => function MockAdminCoreJobs() {
  return <div data-testid="admin-core-jobs-page" />;
});

jest.mock('./pages/AdminCoreAuditTrace', () => function MockAdminCoreAuditTrace() {
  return <div data-testid="admin-core-audit-page" />;
});

jest.mock('./pages/AdminCrawlControl', () => function MockAdminCrawlControl() {
  return <div data-testid="admin-crawl-control-page" />;
});

jest.mock('./pages/SOCPage', () => function MockSOCPage() {
  return <div data-testid="soc-page" />;
});

jest.mock('./pages/Screener', () => function MockScreener() {
  return <div data-testid="screener-page" />;
});

jest.mock('./pages/UserConfig', () => function MockUserConfig() {
  return <div data-testid="user-config-page" />;
});

jest.mock('./pages/admin/tenant/TenantAdminHome', () => function MockTenantAdminHome() {
  return <div data-testid="tenant-admin-home-page" />;
});

jest.mock('./pages/admin/tenant/TenantBilling', () => function MockTenantBilling() {
  return <div data-testid="tenant-billing-page" />;
});

jest.mock('./pages/admin/tenant/TenantCapabilities', () => function MockTenantCapabilities() {
  return <div data-testid="tenant-capabilities-page" />;
});

jest.mock('./pages/admin/tenant/TenantMembers', () => function MockTenantMembers() {
  return <div data-testid="tenant-members-page" />;
});

jest.mock('./pages/admin/tenant/TenantPATs', () => function MockTenantPATs() {
  return <div data-testid="tenant-pats-page" />;
});

jest.mock('./pages/admin/tenant/TenantServiceAccounts', () => function MockTenantServiceAccounts() {
  return <div data-testid="tenant-service-accounts-page" />;
});

jest.mock('./pages/admin/tenant/TenantUsage', () => function MockTenantUsage() {
  return <div data-testid="tenant-usage-page" />;
});

jest.mock('./pages/AICommandCenter', () => function MockAICommandCenter() {
  return <div data-testid="ai-command-center-page" />;
});

jest.mock('./pages/Upgrade', () => function MockUpgrade() {
  return <div data-testid="upgrade-page" />;
});

jest.mock('./pages/VerifyEmail', () => function MockVerifyEmail() {
  return <div data-testid="verify-email-page" />;
});

jest.mock('./pages/ResetPassword', () => function MockResetPassword() {
  return <div data-testid="reset-password-page" />;
});

jest.mock('./context/PortfolioContext', () => ({
  PortfolioProvider: ({ children }) => children,
  usePortfolio: jest.fn(),
}));

jest.mock('./context/LangContext', () => ({
  LangProvider: ({ children }) => children,
}));

jest.mock('./context/RealtimeContext', () => ({
  RealtimeProvider: ({ children }) => children,
}));

jest.mock('./context/InterfaceContext', () => ({
  InterfaceProvider: ({ children }) => children,
}));

jest.mock('./context/AbilityContext', () => ({
  useAbility: jest.fn(),
}));

describe('App legacy admin-ops alias', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('access_token', 'test-access-token');
    window.localStorage.setItem('refresh_token', 'test-refresh-token');

    usePortfolio.mockReturnValue({
      isAuthenticated: true,
      authStateReady: true,
    });

    useAbility.mockReturnValue({
      can: jest.fn((action, subject) => action === 'read' && subject === 'ServiceOpsCenter'),
    });
  });

  it('redirects /admin-ops to the SOC route even when legacy AdminOps permission is absent', async () => {
    window.history.pushState({}, '', '/admin-ops');

    render(<App />);

    expect(await screen.findByTestId('soc-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/operations-center');
    });
  });

  it('renders the SOC route directly at /operations-center', async () => {
    window.history.pushState({}, '', '/operations-center');

    render(<App />);

    expect(await screen.findByTestId('soc-page')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.location.pathname).toBe('/operations-center');
    });
  });
});