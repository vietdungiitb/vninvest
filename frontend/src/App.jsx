import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import LoginModal from './components/LoginModal';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import WhaleAdvisory from './pages/WhaleAdvisory';
import WhaleAlertsHub from './pages/WhaleAlertsHub';
import Upgrade from './pages/Upgrade';
import WhaleAlertsDashboard from './pages/WhaleAlertsDashboard';
import Transactions from './pages/Transactions';
import Support from './pages/Support';
import Watchlist from './pages/Watchlist';
import AdminOps from './pages/AdminOps';
import Screener from './pages/Screener';
import VerifyEmail from './pages/VerifyEmail';
import ResetPassword from './pages/ResetPassword';
import PortfolioManagement from './pages/PortfolioManagement';
import UserConfig from './pages/UserConfig';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { LangProvider } from './context/LangContext';
import { RealtimeProvider } from './context/RealtimeContext';
import { InterfaceProvider } from './context/InterfaceContext';
import ProtectedRoute from './components/ProtectedRoute';

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
                  <Route path="whale-advisory" element={<Navigate to="/ai-advisory" replace />} />
                  <Route path="whale-alerts" element={<WhaleAlertsHub />} />
                  <Route path="whale-alerts/:symbol" element={<WhaleAlertsDashboard />} />
                  <Route path="transactions" element={<Transactions />} />
                  <Route path="support" element={<Support />} />
                  <Route path="watchlist" element={<Watchlist />} />
                  <Route path="admin-ops" element={<AdminOps />} />
                  <Route path="screener" element={<Screener />} />
                  <Route path="portfolios" element={<PortfolioManagement />} />
                  <Route path="settings" element={<UserConfig />} />
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
