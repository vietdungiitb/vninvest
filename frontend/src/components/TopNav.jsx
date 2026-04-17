import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';

function groupLinkClass(isActive) {
  return `inline-flex items-center rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-emerald-600/20 text-emerald-200' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'
  }`;
}

function NavGroup({ label, items, icon }) {
  return (
    <div className="group relative">
      <button
        type="button"
        className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm font-semibold text-slate-200 transition-colors hover:border-slate-700 hover:bg-slate-800"
      >
        <span className="text-[12px] text-slate-400">{icon}</span>
        {label}
      </button>
      <div className="invisible absolute left-0 top-[110%] z-40 min-w-[220px] rounded-lg border border-slate-800 bg-slate-950/95 p-2 opacity-0 shadow-2xl transition-all group-hover:visible group-hover:opacity-100">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => groupLinkClass(isActive)}>
            {item.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function TopNav() {
  const { t, locale, setLanguage } = useI18n();
  const { ability, userIdentity } = usePortfolio();

  const signalItems = [
    { to: '/ai-advisory', label: t('layout.nav.aiAdvisory') },
    { to: '/whale-alerts', label: t('layout.nav.whaleAlerts') },
    { to: '/watchlist', label: t('layout.nav.watchlist') },
  ].filter((item) => item.to !== '/ai-advisory' || ability.can('read', 'WhaleAdvisory'));

  const portfolioItems = [
    { to: '/transactions', label: t('layout.nav.transactions') },
    { to: '/portfolios', label: t('layout.nav.portfolioManagement') },
    { to: '/watchlist', label: t('layout.nav.watchlist') },
  ];

  const systemItems = [
    { to: '/screener', label: t('layout.nav.screener') },
    { to: '/settings', label: t('layout.nav.settings') },
    { to: '/admin-ops', label: t('layout.nav.adminOps') },
  ].filter((item) => item.to !== '/admin-ops' || ability.can('manage', 'all'));

  return (
    <header className="h-16 shrink-0 border-b border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-4">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <NavLink to="/dashboard" className={({ isActive }) => groupLinkClass(isActive)}>
            {t('layout.nav.group.dashboard')}
          </NavLink>
          <NavGroup icon="◈" label={t('layout.nav.group.signals')} items={signalItems} />
          <NavGroup icon="▦" label={t('layout.nav.group.portfolio')} items={portfolioItems} />
          <NavGroup icon="◌" label={t('layout.nav.group.system')} items={systemItems} />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={locale}
            onChange={(event) => setLanguage(event.target.value)}
            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
          >
            <option value="vi">{t('common.vietnamese')}</option>
            <option value="en">{t('common.english')}</option>
          </select>
          <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">{userIdentity?.username || 'admin'}</p>
            <p className="text-[10px] text-slate-500">{userIdentity?.email || 'local.dev'}</p>
          </div>
          <Link
            to="/settings"
            className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-600 hover:text-white"
          >
            {t('layout.nav.settings')}
          </Link>
        </div>
      </div>
    </header>
  );
}
