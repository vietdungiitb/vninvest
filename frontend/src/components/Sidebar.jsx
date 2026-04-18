import React, { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { getTrackedSymbols } from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import SidebarWatchlist from './SidebarWatchlist';

export default function Sidebar() {
  const { t } = useI18n();
  const { logout, portfolios, activePortfolioId, setActivePortfolioId, userPlan, userIdentity } = usePortfolio();
  const [trackedSymbols, setTrackedSymbols] = useState([]);

  useEffect(() => {
    let cancelled = false;
    getTrackedSymbols()
      .then((res) => {
        if (!cancelled) {
          setTrackedSymbols(res.data || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTrackedSymbols([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-slate-800 bg-slate-950">
      <div className="border-b border-slate-800 px-4 py-3">
        <p className="text-2xl font-bold tracking-tight text-emerald-400">VNInvest</p>
        <p className="text-xs text-slate-500">{t('layout.brandSubtitle')}</p>
        <div className="mt-3 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-2.5 py-2 text-[11px] text-emerald-200">
          {t('layout.currentPlan', { plan: t(`plans.${userPlan || 'free'}`) })}
        </div>
      </div>

      <div className="border-b border-slate-800 px-4 py-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('layout.portfolio')}
        </label>
        <select
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-100"
          value={activePortfolioId || ''}
          onChange={(e) => setActivePortfolioId(Number(e.target.value))}
        >
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="border-b border-slate-800 px-3 py-2">
        <NavLink
          to="/watchlist"
          className="btn-pill w-full border-emerald-700 bg-emerald-900/20 px-3 py-2 text-xs text-emerald-200 hover:bg-emerald-900/35"
        >
          {t('layout.openLiveBoard')}
        </NavLink>
        <NavLink
          to="/support"
          className="btn-pill mt-2 w-full border-cyan-700 bg-cyan-900/20 px-3 py-2 text-xs text-cyan-200 hover:bg-cyan-900/35"
        >
          {t('layout.nav.support')}
        </NavLink>
      </div>

      <SidebarWatchlist trackedSymbols={trackedSymbols} />

      <div className="mt-auto border-t border-slate-800 px-3 py-3">
        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
              {String(userIdentity?.username || 'A').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-slate-200">{userIdentity?.username || t('layout.account')}</p>
              <p className="truncate text-[10px] text-slate-500">{userIdentity?.email || ''}</p>
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn-pill mt-2 w-full justify-start border-slate-700 bg-slate-900 px-2 py-1.5 text-left text-xs text-slate-300 hover:border-rose-700 hover:text-rose-300"
        >
          {t('layout.logout')}
        </button>
      </div>
    </aside>
  );
}
