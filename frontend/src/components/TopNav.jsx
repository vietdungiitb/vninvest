import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useInterface } from '../context/InterfaceContext';

function groupLinkClass(isActive) {
  return `inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
    isActive ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-600/45 shadow-[0_0_0_1px_rgba(16,185,129,0.1)]' : 'text-slate-300 hover:bg-slate-800/85 hover:text-slate-100 border border-transparent'
  }`;
}

function NavGroup({ label, items, icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const location = useLocation();

  // Close dropdown after navigation completes (avoids interrupting React Router's startTransition)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    function handleOutsideClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`btn-pill inline-flex items-center gap-1 border-slate-700/90 bg-slate-900/72 py-1.5 text-sm text-slate-200 hover:border-slate-500 ${open ? 'border-slate-500' : ''}`}
      >
        <span className="text-[12px] text-slate-400">{icon}</span>
        {label}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-[200] mt-1 min-w-[220px] rounded-lg border border-slate-800 bg-slate-950/98 p-2 shadow-2xl">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => groupLinkClass(isActive)}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopNav() {
  const { t, locale, setLanguage } = useI18n();
  const { ability, capabilitySnapshot, userIdentity } = usePortfolio();
  const { uiMode, toggleUiMode, modernLeftSidebarOpen, toggleModernLeftSidebar } = useInterface();
  const capabilityMenus = capabilitySnapshot?.navigation?.menus || [];
  const hasCapabilityMenus = capabilityMenus.length > 0;
  const visibleRoutes = useMemo(
    () => new Set(capabilityMenus.filter((item) => item?.enabled).map((item) => item.route)),
    [capabilityMenus],
  );
  const tenantSurfaceEnabled = capabilitySnapshot?.surfaces?.tenant_admin?.enabled;
  const canNavigateTo = (route, fallback) => (hasCapabilityMenus ? visibleRoutes.has(route) : fallback);
  const canReadAdminOps = canNavigateTo('/admin-ops', ability.can('read', 'AdminOps'));
  const canReadTenantHome = canNavigateTo('/tenant-admin/home', ability.can('read', 'TenantAdminHome'));
  const canReadTenantCapabilities = canNavigateTo('/tenant-admin/capabilities', ability.can('read', 'TenantCapabilityView'));
  const canReadTenantUsage = canNavigateTo('/tenant-admin/usage', ability.can('read', 'TenantUsageView'));
  const canReadTenantBilling = canNavigateTo('/tenant-admin/billing', ability.can('read', 'TenantBillingView'));
  const canReadTenantServiceAccounts = canNavigateTo('/tenant-admin/service-accounts', ability.can('read', 'TenantServiceAccountAdmin'));
  const canReadTenantPATs = canNavigateTo('/tenant-admin/pats', ability.can('read', 'TenantPATAdmin'));

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
    { to: '/support', label: t('layout.nav.support') },
    { to: '/screener', label: t('layout.nav.screener') },
    { to: '/settings', label: t('layout.nav.settings') },
    { to: '/settings/ai', label: t('layout.nav.aiCommandCenter') },
    { to: '/admin-ops', label: t('layout.nav.adminOps') },
  ].filter((item) => item.to !== '/admin-ops' || canReadAdminOps);

  const tenantItems = [
    { to: '/tenant-admin/home', label: t('layout.nav.tenantHome'), visible: canReadTenantHome },
    { to: '/tenant-admin/capabilities', label: t('layout.nav.tenantCapabilities'), visible: canReadTenantCapabilities },
    { to: '/tenant-admin/usage', label: t('layout.nav.tenantUsage'), visible: canReadTenantUsage },
    { to: '/tenant-admin/billing', label: t('layout.nav.tenantBilling'), visible: canReadTenantBilling },
    { to: '/tenant-admin/service-accounts', label: t('layout.nav.tenantServiceAccounts'), visible: canReadTenantServiceAccounts },
    { to: '/tenant-admin/pats', label: t('layout.nav.tenantPats'), visible: canReadTenantPATs },
  ].filter((item) => item.visible);

  return (
    <header className="relative z-[70] h-[62px] shrink-0 overflow-visible border-b border-slate-700/80 bg-gradient-to-r from-slate-950/98 via-slate-900/96 to-slate-950/98 px-4 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {uiMode === 'modern' && (
            <button
              type="button"
              onClick={toggleModernLeftSidebar}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-700/90 bg-slate-900/72 text-slate-200 transition-colors hover:border-emerald-600 hover:text-emerald-300"
              aria-label={modernLeftSidebarOpen ? t('layout.collapseMenu') : t('layout.expandMenu')}
              title={modernLeftSidebarOpen ? t('layout.collapseMenu') : t('layout.expandMenu')}
            >
              <span className="text-sm leading-none">{modernLeftSidebarOpen ? '◀' : '▶'}</span>
            </button>
          )}
          <NavLink to="/dashboard" className={({ isActive }) => groupLinkClass(isActive)}>
            {t('layout.nav.group.dashboard')}
          </NavLink>
          <NavGroup icon="◈" label={t('layout.nav.group.signals')} items={signalItems} />
          <NavGroup icon="▦" label={t('layout.nav.group.portfolio')} items={portfolioItems} />
          {tenantSurfaceEnabled !== false && tenantItems.length > 0 ? <NavGroup icon="◫" label={t('layout.nav.group.tenant')} items={tenantItems} /> : null}
          <NavGroup icon="◌" label={t('layout.nav.group.system')} items={systemItems} />
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleUiMode}
            className={`btn-pill gap-1.5 border-slate-700/90 px-3 py-1 text-xs transition-all ${
              uiMode === 'modern' ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/50' : 'bg-slate-900 text-slate-300'
            }`}
            title={uiMode === 'modern' ? 'Switch to Classic' : 'Switch to Modern Workstation'}
          >
            <span>{uiMode === 'modern' ? '📊' : '🖥️'}</span>
            <span className="font-bold">{uiMode === 'modern' ? 'WORKSTATION' : 'CLASSIC'}</span>
          </button>

          <button
            type="button"
            onClick={() => setLanguage(locale === 'vi' ? 'en' : 'vi')}
            className="btn-pill gap-1.5 border-slate-700/90 bg-slate-900 px-3 py-1 text-xs text-slate-100"
            title={t('common.language')}
          >
            <span>🌐</span>
            <span className="font-bold">{locale === 'vi' ? 'VI' : 'EN'}</span>
          </button>
          <div className="rounded-full border border-slate-700/90 bg-slate-900 px-3 py-1 text-xs text-slate-300">
            <p className="font-semibold text-slate-100">{userIdentity?.username || 'admin'}</p>
            <p className="text-[10px] text-slate-500">{userIdentity?.email || 'local.dev'}</p>
          </div>
          <Link
            to="/settings"
            className="btn-pill border-slate-700/90 bg-slate-900 px-2.5 py-1 text-xs text-slate-200 hover:border-slate-600 hover:text-white"
          >
            {t('layout.nav.settings')}
          </Link>
        </div>
      </div>
    </header>
  );
}
