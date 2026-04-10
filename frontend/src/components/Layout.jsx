/**
 * components/Layout.jsx
 * Sidebar + Header bao ngoài tất cả các trang.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { usePortfolio } from '../context/PortfolioContext';
import { useI18n } from '../context/LangContext';
import { fetchLegalPages } from '../api/client';

export default function Layout() {
  const { t, locale, setLanguage } = useI18n();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('layout.sidebarCollapsed') === '1';
    } catch (_) {
      return false;
    }
  });

  // Legal pages state
  const [legalPages, setLegalPages] = useState([]);
  const [legalModal, setLegalModal] = useState(null);

  const loadLegal = useCallback(async () => {
    try {
      const pages = await fetchLegalPages(null, locale || 'vi');
      setLegalPages(pages);
    } catch {
      // fail-soft
    }
  }, [locale]);

  useEffect(() => {
    loadLegal();
  }, [loadLegal]);

  React.useEffect(() => {
    try {
      localStorage.setItem('layout.sidebarCollapsed', isSidebarCollapsed ? '1' : '0');
    } catch (_) {
      // Ignore storage errors (private mode / blocked storage)
    }
  }, [isSidebarCollapsed]);

  const { logout, portfolios, activePortfolioId, setActivePortfolioId, ability, userPlan, userIdentity } =
    usePortfolio();
  const navItems = [
    { to: '/dashboard', label: t('layout.nav.dashboard') },
    { to: '/transactions', label: t('layout.nav.transactions') },
    { to: '/portfolios', label: t('layout.nav.portfolioManagement') },
    { to: '/settings', label: t('layout.nav.settings') },
  ];
  const stockMgmtItems = [
    { to: '/watchlist', label: t('layout.nav.watchlist') },
    { to: '/whale-alerts', label: t('layout.nav.whaleAlerts') },
    { to: '/screener', label: t('layout.nav.screener') },
  ];
  const toolItemsSeed = [{ to: '/admin-ops', label: t('layout.nav.adminOps') }];
  const stockManagementItems = ability.can('read', 'WhaleAdvisory')
    ? [...stockMgmtItems, { to: '/whale-advisory', label: t('layout.nav.aiAdvisory') }]
    : stockMgmtItems;
  const toolItems = ability.can('manage', 'all') ? toolItemsSeed : [];
  const currentPlanLabel = t(`plans.${userPlan || 'free'}`);

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
                <p className="text-gray-500 text-xs mt-0.5">{t('layout.brandSubtitle')}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="rounded-md border border-gray-700 px-2 py-1 text-[10px] text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
              title={isSidebarCollapsed ? t('layout.expandMenu') : t('layout.collapseMenu')}
              aria-label={isSidebarCollapsed ? t('layout.expandMainNav') : t('layout.collapseMainNav')}
            >
              {isSidebarCollapsed ? '»' : '«'}
            </button>
          </div>
          <div
            className={`mt-3 inline-flex items-center gap-2 rounded-full border border-cyan-900/70 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-200 ${
              isSidebarCollapsed ? 'justify-center w-full px-1' : ''
            }`}
            title={t('layout.currentPlan', { plan: currentPlanLabel })}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
            {!isSidebarCollapsed && t('layout.currentPlan', { plan: currentPlanLabel })}
          </div>
          {!isSidebarCollapsed && (userIdentity?.username || userIdentity?.email) && (
            <div className="mt-3 rounded-lg border border-gray-800 bg-gray-950/60 px-2.5 py-2">
              <p className="truncate text-[11px] font-semibold text-gray-200">
                {userIdentity?.username || t('layout.account')}
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
              {t('layout.portfolio')}
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
          {navItems.map(({ to, label }) => (
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
              <span className="text-xs text-emerald-500 uppercase tracking-wider font-semibold">{t('layout.marketTracking')}</span>
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
                  <span className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{t('layout.tools')}</span>
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
          {!isSidebarCollapsed && (
            <div className="mb-3">
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                {t('common.language')}
              </label>
              <select
                value={locale}
                onChange={(event) => setLanguage(event.target.value)}
                className="w-full rounded-md border border-gray-700 bg-gray-800 px-2 py-1.5 text-xs text-gray-100 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="vi">{t('common.vietnamese')}</option>
                <option value="en">{t('common.english')}</option>
              </select>
            </div>
          )}
          <button
            onClick={logout}
            className={`w-full text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 ${
              isSidebarCollapsed ? 'text-center' : 'text-left'
            }`}
            title={t('layout.logout')}
          >
            {isSidebarCollapsed ? '⎋' : t('layout.logout')}
          </button>

          {/* Legal links */}
          {!isSidebarCollapsed && legalPages.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 px-2">
              {legalPages.map((page) => (
                <button
                  key={page.slug}
                  type="button"
                  onClick={() => setLegalModal(page)}
                  className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {page.title || t(`legal.${page.slug}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        <Outlet />
      </main>

      {/* Legal content modal */}
      {legalModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
          onClick={() => setLegalModal(null)}
        >
          <div
            className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <h2 className="text-base font-semibold text-gray-100">{legalModal.title}</h2>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
                aria-label={t('legal.close')}
              >
                ×
              </button>
            </div>
            {legalModal.summary && (
              <p className="px-6 pt-4 text-xs text-gray-400 italic">{legalModal.summary}</p>
            )}
            <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm text-gray-300 leading-relaxed font-sans">
                {legalModal.content_markdown || t('legal.noContent')}
              </pre>
            </div>
            <div className="px-6 py-3 border-t border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                className="px-4 py-1.5 rounded-md bg-brand-600 hover:bg-brand-700 text-sm text-white transition-colors"
              >
                {t('legal.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
