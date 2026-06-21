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
  // Signals group
  {
    group: 'layout.nav.group.signals',
    items: [
      { labelKey: 'layout.nav.whaleAlerts', path: '/whale-alerts', icon: 'Whale' },
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
  // Admin group (conditional)
  {
    group: 'layout.nav.group.admin',
    items: [
      { labelKey: 'layout.nav.soc', path: '/operations-center', icon: 'Wrench' },
      { labelKey: 'layout.nav.adminCrawlControl', path: '/admin-crawl-control', icon: 'RefreshCw' },
      { labelKey: 'layout.nav.alertCenter', path: '/alert-center', icon: 'Bell' },
      { labelKey: 'layout.nav.tenantAdmin', path: '/tenant-admin', icon: 'Building2' },
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