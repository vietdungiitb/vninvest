import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginModal from './components/LoginModal';
import Dashboard from './pages/Dashboard';
import StockDetail from './pages/StockDetail';
import Transactions from './pages/Transactions';
import Watchlist from './pages/Watchlist';
import AdminOps from './pages/AdminOps';
import Screener from './pages/Screener';
import { PortfolioProvider, usePortfolio } from './context/PortfolioContext';

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
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="stocks/:symbol" element={<StockDetail />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="watchlist" element={<Watchlist />} />
            <Route path="admin-ops" element={<AdminOps />} />
            <Route path="screener" element={<Screener />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </PortfolioProvider>
    </BrowserRouter>
  );
}
