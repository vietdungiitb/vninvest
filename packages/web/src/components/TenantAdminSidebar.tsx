import { createElement, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/context/LangContext.js';
import {
  LayoutDashboard, Users, Key, Fingerprint, Activity, CreditCard,
  ShieldCheck, FileText, ScrollText, Globe, Lock, Webhook, FileSpreadsheet,
  ChevronLeft,
} from 'lucide-react';

interface SidebarItem {
  path: string;
  labelKey: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { path: 'home', labelKey: 'tenantHome.title', icon: LayoutDashboard },
  { path: 'members', labelKey: 'tenantMembers.title', icon: Users },
  { path: 'service-accounts', labelKey: 'tenantServiceAccounts.title', icon: Key },
  { path: 'pats', labelKey: 'tenantPats.title', icon: Fingerprint },
  { path: 'usage', labelKey: 'tenantUsage.title', icon: Activity },
  { path: 'usage-history', labelKey: 'tenantUsageHistory.title', icon: ScrollText },
  { path: 'billing', labelKey: 'tenantBilling.title', icon: CreditCard },
  { path: 'capabilities', labelKey: 'tenantCapabilities.title', icon: ShieldCheck },
  { path: 'audit-logs', labelKey: 'tenantAuditLogs.title', icon: FileText },
  { path: 'reports', labelKey: 'tenantReports.title', icon: FileSpreadsheet },
  { path: 'sso', labelKey: 'tenantSSO.title', icon: Globe },
  { path: 'security', labelKey: 'tenantSecurity.title', icon: Lock },
  { path: 'webhooks', labelKey: 'tenantWebhooks.title', icon: Webhook },
];

const SIDEBAR_CSS = `
.taSidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--shell-surface);
  border-right: 1px solid var(--shell-border);
  transition: width 0.2s ease;
  overflow: hidden;
  flex-shrink: 0;
  z-index: 40;
}
.taSidebar__logo {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  border-bottom: 1px solid var(--shell-border);
  font-weight: 800;
  font-size: 18px;
  color: var(--shell-accent);
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
.taSidebar__nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.taSidebar__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  border: none;
  background: transparent;
  color: var(--shell-muted);
  cursor: pointer;
  font-size: 13px;
  text-align: left;
  border-left: 3px solid transparent;
  transition: all 0.15s ease;
  padding: 10px 14px;
  border-radius: 0 8px 8px 0;
  font-family: inherit;
  white-space: nowrap;
}
.taSidebar__item:hover {
  color: var(--shell-ink);
  background: rgba(255, 255, 255, 0.04);
}
.taSidebar__item--active {
  color: var(--shell-accent);
  font-weight: 700;
  border-left-color: var(--shell-accent);
  background: rgba(0, 180, 216, 0.08);
}
.taSidebar__item--active:hover {
  background: rgba(0, 180, 216, 0.12);
  color: var(--shell-accent);
}
.taSidebar__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
}
.taSidebar__label {
  overflow: hidden;
  text-overflow: ellipsis;
}
.taSidebar__footer {
  border-top: 1px solid var(--shell-border);
  padding: 8px;
  display: flex;
  justify-content: center;
  flex-shrink: 0;
}
.taSidebar__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--shell-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}
.taSidebar__toggle:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--shell-ink);
}
.taSidebar__toggleIcon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}
`;

export function TenantAdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const toggle = () => setCollapsed((c) => !c);

  const segment = location.pathname.replace('/tenant-admin/', '').split('/')[0];

  const navItems = SIDEBAR_ITEMS.map((item) => {
    const isActive = segment === item.path || (!segment && item.path === 'home');
    return createElement(
      'button',
      {
        key: item.path,
        onClick: () => navigate(`/tenant-admin/${item.path}`),
        className: 'taSidebar__item' + (isActive ? ' taSidebar__item--active' : ''),
        title: collapsed ? (t(item.labelKey) || item.labelKey) : undefined,
      },
      createElement(item.icon, { className: 'taSidebar__icon' }),
      collapsed ? null : createElement('span', { className: 'taSidebar__label' }, t(item.labelKey) || item.labelKey),
    );
  });

  return createElement(
    'aside',
    { className: 'taSidebar', style: { width: collapsed ? '60px' : '240px' } },
    createElement('style', null, SIDEBAR_CSS),
    createElement(
      'div',
      { className: 'taSidebar__logo' },
      collapsed ? createElement('span', null, 'TA') : createElement('span', null, 'Tenant Admin'),
    ),
    createElement('nav', { className: 'taSidebar__nav' }, ...navItems),
    createElement(
      'div',
      { className: 'taSidebar__footer' },
      createElement(
        'button',
        {
          onClick: toggle,
          className: 'taSidebar__toggle',
          title: collapsed ? 'Expand' : 'Collapse',
        },
        createElement(ChevronLeft, {
          className: 'taSidebar__toggleIcon',
          style: { transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' },
        }),
      ),
    ),
  );
}
