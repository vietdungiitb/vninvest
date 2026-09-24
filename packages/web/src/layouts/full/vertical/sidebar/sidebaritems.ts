import type { NavGroup } from '@/types/navigation';

export const sidebarItems: NavGroup[] = [
  // Dashboard group
  {
    group: 'layout.nav.group.dashboard',
    items: [
      { labelKey: 'layout.nav.dashboard', path: '/dashboard', icon: 'LayoutDashboard' },
      { labelKey: 'layout.nav.watchlist', path: '/watchlist', icon: 'Star' },
      { labelKey: 'layout.nav.screener', path: '/screener', icon: 'Search' },
    ],
  },
  // Trading group
  {
    group: 'layout.nav.group.trading',
    items: [
      { labelKey: 'layout.nav.transactions', path: '/transactions', icon: 'ArrowUpDown' },
      { labelKey: 'layout.nav.portfolios', path: '/portfolios', icon: 'Briefcase' },
    ],
  },
  // Signals group — single Alert Center entry (legacy alias redirects to /alert-center)
  {
    group: 'layout.nav.group.signals',
    items: [
      { labelKey: 'layout.nav.alertCenter', path: '/alert-center', icon: 'Bell' },
      { labelKey: 'layout.nav.aiAdvisory', path: '/ai-advisory', icon: 'Brain' },
    ],
  },
  // Account group
  {
    group: 'layout.nav.group.account',
    items: [
      { labelKey: 'layout.nav.upgrade', path: '/upgrade', icon: 'Rocket' },
      { labelKey: 'layout.nav.support', path: '/support', icon: 'MessageCircle' },
      { labelKey: 'layout.nav.settings', path: '/settings', icon: 'Settings' },
      { labelKey: 'layout.nav.aiCommandCenter', path: '/settings/ai', icon: 'Cpu' },
    ],
  },
  // Tenant self-service group (B+A — mọi user có tenant, không cần staff)
  {
    group: 'layout.nav.group.tenantSelf',
    requiresTenant: true,
    items: [
      { labelKey: 'layout.nav.tenantKeys', path: '/tenant/keys', icon: 'Key', requiresTenant: true },
      { labelKey: 'layout.nav.tenantUsageSummary', path: '/tenant/usage', icon: 'Activity', requiresTenant: true },
    ],
  },
  // Admin group (conditional, staff-only — filtered in Sidebar.tsx via userIdentity)
  {
    group: 'layout.nav.group.admin',
    staffOnly: true,
    items: [
      { labelKey: 'layout.nav.soc', path: '/operations-center', icon: 'Wrench', staffOnly: true },
      { labelKey: 'layout.nav.adminCrawlControl', path: '/admin-crawl-control', icon: 'RefreshCw', staffOnly: true },
      { labelKey: 'layout.nav.tenantAdmin', path: '/tenant-admin', icon: 'Building2', staffOnly: true },
      { labelKey: 'layout.nav.adminUsers', path: '/admin/users', icon: 'User', staffOnly: true },
      { labelKey: 'layout.nav.adminTenants', path: '/admin/tenants', icon: 'Layers', staffOnly: true },
      { labelKey: 'layout.nav.adminBilling', path: '/admin/billing', icon: 'TrendingUp', staffOnly: true },
      { labelKey: 'layout.nav.adminUsage', path: '/admin/usage', icon: 'Activity', staffOnly: true },
      { labelKey: 'layout.nav.adminAudit', path: '/admin/audit', icon: 'ClipboardList', staffOnly: true },
      { labelKey: 'layout.nav.adminAnalytics', path: '/admin/analytics', icon: 'LineChart', staffOnly: true },
      ...(import.meta.env.VITE_FEATURE_ADVERTISING_ADMIN !== 'false'
        ? [{ labelKey: 'layout.nav.advertisingAdmin', path: '/admin/advertising', icon: 'Megaphone', staffOnly: true }]
        : []),
    ],
  },
];

// Helper to get flat list of all items
export function getAllSidebarItems() {
  return sidebarItems.flatMap(group => group.items);
}

// Helper to check if path matches
export function isActivePath(pathname: string, itemPath: string): boolean {
  if (itemPath === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/';
  }
  return pathname === itemPath || pathname.startsWith(itemPath + '/');
}