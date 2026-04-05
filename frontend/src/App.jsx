import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginModal from './components/LoginModal';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import WhaleAdvisory from './pages/WhaleAdvisory';
import WhaleAlertsHub from './pages/WhaleAlertsHub';
import Upgrade from './pages/Upgrade';
import WhaleAlertsDashboard from './pages/WhaleAlertsDashboard';
import Transactions from './pages/Transactions';
import Watchlist from './pages/Watchlist';
import AdminOps from './pages/AdminOps';
import Screener from './pages/Screener';
import VerifyEmail from './pages/VerifyEmail';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';
import { LangProvider } from './context/LangContext';
import { RealtimeProvider } from './context/RealtimeContext';
import ProtectedRoute from './components/ProtectedRoute';

function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = usePortfolio();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LoginModal onSuccess={() => navigate('/dashboard', { replace: true })} />;
}

function ProtectedLayout() {
  const { isAuthenticated } = usePortfolio();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout />;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PortfolioProvider>
        <LangProvider>
          <RealtimeProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/" element={<ProtectedLayout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="upgrade" element={<Upgrade />} />
                <Route path="stocks/:symbol" element={<StockDetail />} />
                <Route
                  path="whale-advisory"
                  element={(
                    <ProtectedRoute action="read" subject="WhaleAdvisory">
                      <WhaleAdvisory />
                    </ProtectedRoute>
                  )}
                />
                <Route path="whale-alerts" element={<WhaleAlertsHub />} />
                <Route path="whale-alerts/:symbol" element={<WhaleAlertsDashboard />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="watchlist" element={<Watchlist />} />
                <Route path="admin-ops" element={<AdminOps />} />
                <Route path="screener" element={<Screener />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </RealtimeProvider>
        </LangProvider>
      </PortfolioProvider>
    </BrowserRouter>
  );
}
