import { createElement } from 'react';
import { useLocation } from 'react-router-dom';
import { usePortfolio } from '@/context/PortfolioContext.js';
import { useI18n } from '@/context/LangContext.js';
import { sidebarItems, isActivePath } from './sidebaritems';
import { cn } from '@/lib/utils';
import { LucideIcon } from '@/components/ui/lucide-icon';
import { isNewLayoutEnabled } from '@/lib/runtimeConfig';

interface Tenant {
  tenant_id: string;
  public_id: string;
  id: string;
  display_name: string;
  plan: string;
}

const e = createElement;

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed = false, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { userTenants = [] as Tenant[], activeTenantId, switchTenant, userIdentity } = usePortfolio() as any;
  const { t } = useI18n();
  const location = useLocation();
  const newLayout = isNewLayoutEnabled();
  const isStaff = Boolean((userIdentity as any)?.isStaff || (userIdentity as any)?.isSuperuser);

  const handleTenantChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    switchTenant(e.target.value);
  };

  const getIcon = (iconName: string) => {
    return e(LucideIcon, { name: iconName, className: 'h-5 w-5 flex-shrink-0' });
  };

  return e(
    'aside',
    {
      className: cn(
        'fixed top-0 bottom-0 left-0 z-50 flex flex-col h-screen bg-slate-900 border-r border-slate-800 transition-transform duration-300 ease-in-out shadow-2xl',
        newLayout
          ? cn(
              'w-72',
              !mobileOpen ? '-translate-x-full' : 'translate-x-0'
            )
          : cn(
              collapsed && !mobileOpen ? 'w-16 -translate-x-0' : 'w-72 translate-x-0',
              mobileOpen && 'translate-x-0 lg:hidden'
            )
      ),
      role: 'navigation',
      'aria-label': t('layout.nav.group.dashboard') || 'Main navigation'
    },
    // Logo & Workspace Selector
    e(
      'div',
      { className: 'flex flex-col border-b border-slate-800 p-4 sidebar-sticky-header' },
      e(
        'div',
        { className: 'flex items-center justify-between mb-4' },
        e(
          'h1',
          {
            className: cn(
              'text-xl font-bold text-cyan-400 tracking-tight transition-opacity duration-200',
              !newLayout && collapsed && !mobileOpen && 'opacity-0'
            )
          },
          'VNInvest'
        ),
        (!newLayout && collapsed && !mobileOpen) && e(
          'button',
          {
            className: 'p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 focus:outline-none',
            onClick: onToggle,
            'aria-label': t('layout.expandMenu') || 'Open menu'
          },
          e('span', { className: 'h-5 w-5' }, '☰')
        )
      ),
      userTenants.length > 0 && (newLayout || !collapsed || mobileOpen) && e(
        'div',
        { className: 'mt-4' },
        e(
          'label',
          {
            className: 'block text-xs text-slate-500 mb-1',
            htmlFor: 'workspace-select'
          },
          t('layout.workspace') || 'Workspace'
        ),
        e(
          'select',
          {
            id: 'workspace-select',
            value: activeTenantId || '',
            onChange: handleTenantChange,
            className: 'w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:border-cyan-400 focus:outline-none cursor-pointer',
            'aria-label': t('layout.workspace') || 'Select workspace'
          },
          userTenants.map((tenant: any) => e(
            'option',
            {
              key: tenant.tenant_id || tenant.public_id || tenant.id,
              value: tenant.tenant_id || tenant.public_id || tenant.id
            },
            `${tenant.display_name} (${(tenant.plan || 'free').toUpperCase()})`
          ))
        )
      )
    ),
    // Navigation Menu
    e(
      'nav',
      {
        className: 'flex-1 overflow-y-auto p-4 space-y-1',
        role: 'menubar'
      },
      sidebarItems.map((group) => {
        if ((group as any).staffOnly && !isStaff) return null;
        const visibleItems = group.items.filter((item) => !(item as any).staffOnly || isStaff);
        if (visibleItems.length === 0) return null;
        return e(
        'div',
        { key: group.group },
        (newLayout || !collapsed || mobileOpen) && e(
          'h3',
          { className: 'px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider' },
          t(group.group) || group.group
        ),
        e(
          'div',
          { role: 'menu' },
          visibleItems.map((item) => {
            const isActive = isActivePath(location.pathname, item.path);
            return e(
              'a',
              {
                key: item.path,
                href: item.path,
                className: cn(
                  'flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? (newLayout
                        ? 'bg-blue-600 text-white font-semibold shadow-md shadow-blue-600/20'
                        : 'bg-slate-800/60 text-cyan-400 border-l-2 border-cyan-400 font-semibold')
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200',
                  (!newLayout && collapsed && !mobileOpen) && 'justify-center px-2'
                ),
                role: 'menuitem',
                'aria-current': isActive ? 'page' : undefined,
                onClick: () => {
                  onMobileClose();
                },
                title: (!newLayout && collapsed && !mobileOpen) ? t(item.labelKey) || item.labelKey : undefined
              },
              e('span', { className: 'flex-shrink-0' }, getIcon(item.icon)),
              (newLayout || !collapsed || mobileOpen) && e('span', { className: 'truncate' }, t(item.labelKey) || item.labelKey)
            );
          })
        )
      );
      })
    ),
    // Profile Block (bottom)
    (newLayout || !collapsed || mobileOpen) && e(
      'div',
      { className: 'p-4 border-t border-slate-800 bg-slate-950/50' },
      e('div', { className: 'font-medium text-slate-100 truncate' }, 'User'),
      e('div', { className: 'text-xs text-slate-500 truncate mt-1' }, 'user@example.com'),
      e(
        'button',
        {
          onClick: () => {},
          className: 'w-full mt-3 py-2 rounded-lg font-medium transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
          type: 'button'
        },
        t('layout.logout') || 'Đăng xuất'
      )
    )
  );
}

export default Sidebar;
