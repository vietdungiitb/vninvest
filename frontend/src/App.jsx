import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LoginModal from './components/LoginModal';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import WhaleAdvisory from './pages/WhaleAdvisory';
import AiAdvisoryShellHost from './pages/AiAdvisoryShellHost';
import WhaleAlertsHub from './pages/WhaleAlertsHub';
import WhaleAlertsDashboard from './pages/WhaleAlertsDashboard';
import WhaleAlertsShellHost from './pages/WhaleAlertsShellHost';
import Transactions from './pages/Transactions';
import Support from './pages/Support';
import Watchlist from './pages/Watchlist';
import AdminOps from './pages/AdminOps';
import AdminCoreOverview from './pages/AdminCoreOverview';
import AdminCoreTenants from './pages/AdminCoreTenants';
import AdminCoreServiceAccounts from './pages/AdminCoreServiceAccounts';
import AdminCrawlControl from './pages/AdminCrawlControl';
import Screener from './pages/Screener';
import PortfolioManagement from './pages/PortfolioManagement';
import UserConfig from './pages/UserConfig';
import TenantAdminHome from './pages/admin/tenant/TenantAdminHome';
import TenantBilling from './pages/admin/tenant/TenantBilling';
import TenantCapabilities from './pages/admin/tenant/TenantCapabilities';
import TenantPATs from './pages/admin/tenant/TenantPATs';
import TenantServiceAccounts from './pages/admin/tenant/TenantServiceAccounts';
import TenantUsage from './pages/admin/tenant/TenantUsage';
import AICommandCenter from './pages/AICommandCenter';
import Upgrade from './pages/Upgrade';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { LangProvider } from './context/LangContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { InterfaceProvider } from './context/InterfaceContext';
import ProtectedRoute from './components/ProtectedRoute';

const packageShellHostEnabled = process.env.REACT_APP_ENABLE_PACKAGE_SHELL_HOST === '1';

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = usePortfolio();
  const hasStoredTokens = Boolean(
    localStorage.getItem('access_token') && localStorage.getItem('refresh_token'),
  );

  if (isAuthenticated && hasStoredTokens) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginModal onSuccess={() => navigate('/dashboard', { replace: true })} />;
}

function ProtectedLayout() {
  const location = useLocation();
  const { isAuthenticated } = usePortfolio();
  const hasStoredTokens = Boolean(
    localStorage.getItem('access_token') && localStorage.getItem('refresh_token'),
  );

  if (!isAuthenticated || !hasStoredTokens) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Layout />;
}

function AdminCoreShell() {
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <PortfolioProvider>
        <LangProvider>
          <InterfaceProvider>
            <RealtimeProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="reset-password" element={<ResetPassword />} />
                <Route path="/" element={<ProtectedLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="upgrade" element={<Upgrade />} />
                  <Route path="stocks/:symbol" element={<StockDetail />} />
                  <Route
                    path="ai-advisory"
                    element={(
                      <ProtectedRoute action="read" subject="WhaleAdvisory">
                        <WhaleAdvisory />
                      </ProtectedRoute>
                    )}
                  />
                  {packageShellHostEnabled ? (
                    <Route
                      path="ai-advisory/shell"
                      element={(
                        <ProtectedRoute action="read" subject="WhaleAdvisory">
                          <AiAdvisoryShellHost />
                        </ProtectedRoute>
                      )}
                    />
                  ) : null}
                  <Route path="whale-advisory" element={<Navigate to="/ai-advisory" replace />} />
                  <Route path="whale-alerts" element={<WhaleAlertsHub />} />
                  {packageShellHostEnabled ? (
                    <Route
                      path="whale-alerts/shell"
                      element={(
                        <ProtectedRoute action="read" subject="WhaleAdvisory">
                          <WhaleAlertsShellHost />
                        </ProtectedRoute>
                      )}
                    />
                  ) : null}
                  <Route path="whale-alerts/:symbol" element={<WhaleAlertsDashboard />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="support" element={<Support />} />
                  <Route path="watchlist" element={<Watchlist />} />
                  <Route path="admin/core" element={<AdminCoreShell />}>
                    <Route
                      index
                      element={(
                        <ProtectedRoute action="read" subject="AdminOps">
                          <Navigate to="/admin/core/overview" replace />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="overview"
                      element={(
                        <ProtectedRoute action="read" subject="AdminOps">
                          <AdminCoreOverview />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="tenants"
                      element={(
                        <ProtectedRoute action="read" subject="AdminOps">
                          <AdminCoreTenants />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="tenants/:tenantId"
                      element={(
                        <ProtectedRoute action="read" subject="AdminOps">
                          <AdminCoreTenants />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="tenants/:tenantId/service-accounts"
                      element={(
                        <ProtectedRoute action="read" subject="AdminOps">
                          <AdminCoreServiceAccounts />
                        </ProtectedRoute>
                      )}
                    />
                    <Route
                      path="crawl-control"
                      element={(
                        <ProtectedRoute action="read" subject="AdminCrawlControl">
                          <AdminCrawlControl />
                        </ProtectedRoute>
                      )}
                    />
                    <Route path="*" element={<Navigate to="/admin/core/overview" replace />} />
                  </Route>
                  <Route
                    path="admin-ops"
                    element={(
                      <ProtectedRoute action="read" subject="AdminOps">
                        <AdminOps />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="admin-crawl-control"
                    element={(
                      <ProtectedRoute action="read" subject="AdminCrawlControl">
                        <AdminCrawlControl />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/home"
                    element={(
                      <ProtectedRoute action="read" subject="TenantAdminHome">
                        <TenantAdminHome />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/capabilities"
                    element={(
                      <ProtectedRoute action="read" subject="TenantCapabilityView">
                        <TenantCapabilities />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/usage"
                    element={(
                      <ProtectedRoute action="read" subject="TenantUsageView">
                        <TenantUsage />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/billing"
                    element={(
                      <ProtectedRoute action="read" subject="TenantBillingView">
                        <TenantBilling />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/service-accounts"
                    element={(
                      <ProtectedRoute action="read" subject="TenantServiceAccountAdmin">
                        <TenantServiceAccounts />
                      </ProtectedRoute>
                    )}
                  />
                  <Route
                    path="tenant-admin/pats"
                    element={(
                      <ProtectedRoute action="read" subject="TenantPATAdmin">
                        <TenantPATs />
                      </ProtectedRoute>
                    )}
                  />
                  <Route path="tenant-admin" element={<Navigate to="/tenant-admin/home" replace />} />
                  <Route path="screener" element={<Screener />} />
                  <Route path="portfolios" element={<PortfolioManagement />} />
                  <Route path="settings" element={<UserConfig />} />
                  <Route path="settings/ai" element={<AICommandCenter />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </RealtimeProvider>
          </InterfaceProvider>
        </LangProvider>
      </PortfolioProvider>
    </BrowserRouter>
  );
}
