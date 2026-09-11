import { createElement } from 'react';
import { useLocation } from 'react-router-dom';
import { usePortfolio } from '@/context/PortfolioContext.js';
import { useI18n } from '@/context/LangContext.js';
import { sidebarItems, isActivePath } from './sidebaritems';
import { cn } from '@/lib/utils';
import { LucideIcon } from '@/components/ui/lucide-icon';

interface Tenant {
  tenant_id: string;
  public_id: string;
  id: string;
  display_name: string;
  plan: string;
}

const e = createElement;

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const { userTenants = [] as Tenant[], activeTenantId, switchTenant } = usePortfolio();
  const { t } = useI18n();
  const location = useLocation();

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
        collapsed && !mobileOpen ? 'w-16 -translate-x-0' : 'w-72 translate-x-0',
        mobileOpen && 'translate-x-0 lg:hidden'
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
              collapsed && !mobileOpen && 'opacity-0'
            )
          },
          'VNInvest'
        ),
        null
      ),
      userTenants.length > 0 && !collapsed && e(
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
      sidebarItems.map((group) => e(
        'div',
        { key: group.group },
        !collapsed && e(
          'h3',
          { className: 'px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-wider' },
          t(group.group) || group.group
        ),
        e(
          'div',
          { role: 'menu' },
          group.items.map((item) => {
            const isActive = isActivePath(location.pathname, item.path);
            return e(
              'a',
              {
                key: item.path,
                href: item.path,
                className: cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-slate-800/60 text-cyan-400 border-l-2 border-cyan-400 font-semibold'
                    : 'text-slate-400 hover:bg-slate-800/30 hover:text-slate-200',
                  collapsed && 'justify-center px-2'
                ),
                role: 'menuitem',
                'aria-current': isActive ? 'page' : undefined,
                onClick: () => {
                  onMobileClose();
                },
                title: collapsed ? t(item.labelKey) || item.labelKey : undefined
              },
              e('span', { className: 'flex-shrink-0' }, getIcon(item.icon)),
              !collapsed && e('span', { className: 'truncate' }, t(item.labelKey) || item.labelKey)
            );
          })
        )
      ))
    ),
    // Profile Block (bottom) - only show when not collapsed
    !collapsed && e(
      'div',
      { className: 'p-4 border-t border-slate-800 bg-slate-950/50' },
      e('div', { className: 'font-medium text-slate-100 truncate' }, 'User'),
      e('div', { className: 'text-xs text-slate-500 truncate mt-1' }, 'user@example.com'),
      e(
        'button',
        {
          onClick: () => {
            // Logout handled by header profile dropdown
          },
          className: 'w-full mt-3 py-2 rounded-lg font-medium transition-colors bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20',
          type: 'button'
        },
        t('layout.logout') || 'Đăng xuất'
      )
    )
  );
}

export default Sidebar;