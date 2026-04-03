/**
 * components/Layout.jsx
 * Sidebar + Header bao ngoài tất cả các trang.
 */
import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';


const NAV_ITEMS = [
  { to: '/dashboard', label: 'Tổng quan' },
  { to: '/transactions', label: 'Giao dịch' },
];

const STOCK_MGMT_ITEMS = [
  { to: '/watchlist', label: 'Radar thị trường' },
  { to: '/whale-alerts', label: 'Whale Alerts' },
  { to: '/screener', label: 'Screener' },
];

const TOOL_ITEMS = [
  { to: '/admin-ops', label: 'Admin Ops' },
];

const PLAN_LABELS = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
  premium: 'Premium',
  admin: 'Admin',
};

export default function Layout() {
  const { logout, portfolios, activePortfolioId, setActivePortfolioId, ability, userPlan } =
    usePortfolio();
  const stockManagementItems = ability.can('read', 'WhaleAdvisory')
    ? [...STOCK_MGMT_ITEMS, { to: '/whale-advisory', label: 'AI Advisory' }]
    : STOCK_MGMT_ITEMS;
  const toolItems = ability.can('manage', 'all') ? TOOL_ITEMS : [];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-800">
          <span className="text-brand-500 font-bold text-xl tracking-tight">VNInvest</span>
          <p className="text-gray-500 text-xs mt-0.5">Portfolio Tracker</p>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-900/70 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            Gói {PLAN_LABELS[userPlan] || 'Free'}
          </div>
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
            <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Market watch và theo dõi cá nhân</span>
          </div>
          {stockManagementItems.map(({ to, label }) => (
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
          {toolItems.length > 0 && (
            <>
              <div className="mt-6 mb-1 px-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Công cụ</span>
              </div>
              {toolItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-gray-700 text-gray-100'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </>
          )}
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
