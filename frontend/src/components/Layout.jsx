/**
 * components/Layout.jsx
 * Sidebar + Header bao ngoài tất cả các trang.
 */
import React, { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import LoginModal from './LoginModal';


const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tổng quan' },
  { to: '/transactions', label: 'Giao dịch' },
];

const STOCK_MGMT_ITEMS = [
  { to: '/watchlist', label: 'Nhóm Chứng khoán' },
  // Có thể bổ sung thêm các mục quản lý mã CK khác ở đây
];

export default function Layout() {
  const { isAuthenticated, logout, portfolios, activePortfolioId, setActivePortfolioId } =
    usePortfolio();
  const [showLogin, setShowLogin] = useState(!isAuthenticated);

  if (!isAuthenticated) {
    return <LoginModal onSuccess={() => setShowLogin(false)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-800">
          <span className="text-brand-500 font-bold text-xl tracking-tight">VNInvest</span>
          <p className="text-gray-500 text-xs mt-0.5">Portfolio Tracker</p>
        </div>

        {/* Chọn Portfolio */}
        {portfolios.length > 0 && (
          <div className="px-3 py-3 border-b border-gray-800">
            <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
              Danh mục
            </label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5
                         text-sm text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              value={activePortfolioId || ''}
              onChange={(e) => setActivePortfolioId(Number(e.target.value))}
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        )}


        {/* Nav links */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}

          {/* Divider for Stock Management */}
          <div className="mt-6 mb-1 px-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Quản lý danh mục chứng khoán</span>
          </div>
          {STOCK_MGMT_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-900 text-blue-200'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-gray-800">
          <button
            onClick={logout}
            className="w-full text-left text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1"
          >
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>
    </div>
  );
}
