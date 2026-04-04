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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(() => {
    try {
      return localStorage.getItem('layout.sidebarCollapsed') === '1';
    } catch (_) {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('layout.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
    } catch (_) {
      // Ignore storage errors (private mode / blocked storage)
    }
  }, [isSidebarCollapsed]);

  const { logout, portfolios, activePortfolioId, setActivePortfolioId, ability, userPlan, userIdentity } =
    usePortfolio();
  const stockManagementItems = ability.can('read', 'WhaleAdvisory')
    ? [...STOCK_MGMT_ITEMS, { to: '/whale-advisory', label: 'AI Advisory' }]
    : STOCK_MGMT_ITEMS;
  const toolItems = ability.can('manage', 'all') ? TOOL_ITEMS : [];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-300 ${
          isSidebarCollapsed ? 'w-16' : 'w-56'
        }`}
      >
        {/* Logo */}
        <div className={`${isSidebarCollapsed ? 'px-2 py-4' : 'px-5 py-4'} border-b border-gray-800`}>
          <div className="flex items-start justify-between gap-2">
            <div className={isSidebarCollapsed ? 'w-full text-center' : ''}>
              <span className="text-brand-500 font-bold text-xl tracking-tight">
                {isSidebarCollapsed ? 'VI' : 'VNInvest'}
              </span>
              {!isSidebarCollapsed && (
                <p className="text-gray-500 text-xs mt-0.5">Portfolio Tracker</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="rounded-md border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
              title={isSidebarCollapsed ? 'Phóng to menu' : 'Thu nhỏ menu'}
              aria-label={isSidebarCollapsed ? 'Phóng to menu chính' : 'Thu nhỏ menu chính'}
            >
              {isSidebarCollapsed ? '»' : '«'}
            </button>
          </div>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-900/70 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 ${
              isSidebarCollapsed ? 'justify-center w-full px-1' : ''
            }`}
            title={`Gói ${PLAN_LABELS[userPlan] || 'Free'}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {!isSidebarCollapsed && `Gói ${PLAN_LABELS[userPlan] || 'Free'}`}
          </div>
          {!isSidebarCollapsed && (userIdentity?.username || userIdentity?.email) && (
            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-2.5 py-2">
              <p className="truncate text-[11px] font-semibold text-gray-200">
                {userIdentity?.username || 'Tài khoản'}
              </p>
              {userIdentity?.email && (
                <p className="mt-0.5 truncate text-[10px] text-gray-500">{userIdentity.email}</p>
              )}
            </div>
          )}
        </div>

        {/* Chọn Portfolio */}
        {portfolios.length > 0 && !isSidebarCollapsed && (
          <div className="px-3 py-3 border-b border-gray-800">
            <label className="text-xs text-emerald-500 uppercase tracking-wider font-semibold block mb-1">
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
              title={label}
              className={({ isActive }) =>
                `flex items-center rounded-md text-sm font-medium transition-colors ${
                  isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-brand-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {isSidebarCollapsed ? label.slice(0, 1) : label}
            </NavLink>
          ))}

          {/* Divider for Stock Management */}
          {!isSidebarCollapsed && (
            <div className="mt-6 mb-1 px-2">
              <span className="text-xs text-emerald-500 uppercase tracking-wider font-semibold">Theo dõi thị trường</span>
            </div>
          )}
          {stockManagementItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              title={label}
              className={({ isActive }) =>
                `flex items-center rounded-md text-sm font-medium transition-colors ${
                  isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
                } ${
                  isActive
                    ? 'bg-blue-900 text-blue-200'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`
              }
            >
              {isSidebarCollapsed ? label.slice(0, 1) : label}
            </NavLink>
          ))}
          {toolItems.length > 0 && (
            <>
              {!isSidebarCollapsed && (
                <div className="mt-6 mb-1 px-2">
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Công cụ</span>
                </div>
              )}
              {toolItems.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={label}
                  className={({ isActive }) =>
                    `flex items-center rounded-md text-sm font-medium transition-colors ${
                      isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2'
                    } ${
                      isActive
                        ? 'bg-gray-700 text-gray-100'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                    }`
                  }
                >
                  {isSidebarCollapsed ? label.slice(0, 1) : label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Logout */}
        <div className="px-3 py-3 border-t border-gray-800">
          <button
            onClick={logout}
            className={`w-full text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 ${
              isSidebarCollapsed ? 'text-center' : 'text-left'
            }`}
            title="Đăng xuất"
          >
            {isSidebarCollapsed ? '⎋' : 'Đăng xuất'}
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
