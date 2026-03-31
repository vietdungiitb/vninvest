import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Watchlist from './pages/Watchlist';
import { PortfolioProvider } from './context/PortfolioContext';

export default function App() {
  return (
    <BrowserRouter>
      <PortfolioProvider>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="transactions" element={<Transactions />} />
            <Route path="watchlist" element={<Watchlist />} />
          </Route>
        </Routes>
      </PortfolioProvider>
    </BrowserRouter>
  );
}
