import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/context/LangContext.js';
import { usePortfolio } from '@/context/PortfolioContext.js';
import {
  LayoutDashboard, Users, Key, Fingerprint, Activity, CreditCard,
  ShieldCheck, FileText, ScrollText, Globe, Lock, Webhook, FileSpreadsheet,
  Settings, ChevronLeft, UserCog, Bot,
} from 'lucide-react';

interface SidebarItem {
  path: string;
  labelKey: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  subject?: string;
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  { path: 'home', labelKey: 'tenantHome.title', icon: LayoutDashboard },
  { path: 'members', labelKey: 'tenantMembers.title', icon: Users, subject: 'TenantMemberAdmin' },
  { path: 'service-accounts', labelKey: 'tenantServiceAccounts.title', icon: Key, subject: 'TenantServiceAccountAdmin' },
  { path: 'pats', labelKey: 'tenantPats.title', icon: Fingerprint, subject: 'TenantPATAdmin' },
  { path: 'usage', labelKey: 'tenantUsage.title', icon: Activity, subject: 'TenantUsageView' },
  { path: 'usage-history', labelKey: 'tenantUsageHistory.title', icon: ScrollText, subject: 'TenantUsageView' },
  { path: 'billing', labelKey: 'tenantBilling.title', icon: CreditCard, subject: 'TenantBillingView' },
  { path: 'capabilities', labelKey: 'tenantCapabilities.title', icon: ShieldCheck, subject: 'TenantCapabilityView' },
  { path: 'audit-logs', labelKey: 'tenantAuditLogs.title', icon: FileText, subject: 'TenantAuditAdmin' },
  { path: 'reports', labelKey: 'tenantReports.title', icon: FileSpreadsheet, subject: 'TenantReportsView' },
  { path: 'sso', labelKey: 'tenantSSO.title', icon: Globe, subject: 'TenantSSOAdmin' },
  { path: 'security', labelKey: 'tenantSecurity.title', icon: Lock, subject: 'TenantSecurityView' },
  { path: 'webhooks', labelKey: 'tenantWebhooks.title', icon: Webhook, subject: 'TenantWebhookView' },
  { path: 'settings', labelKey: 'tenantSettings.title', icon: Settings },
  { path: 'roles', labelKey: 'tenantRoles.title', icon: UserCog, subject: 'TenantRoleAdmin' },
  // R4.1 AC1: policy AI cấp tenant. Cố ý KHÔNG gắn `subject` — `_build_abilities`
  // (identity_access/views/helpers.py:107) cấp `read` cho **mọi** thành viên
  // tenant, nên một subject mới cũng không phân biệt được admin với editor. Quyền
  // ghi thật do BE chặn (`settings:write` = admin/owner), không giả ở menu.
  { path: 'ai-policy', labelKey: 'tenantAIPolicy.title', icon: Bot },
];

const SIDEBAR_CSS = `
.taSidebar {
  display: flex;
  flex-direction: column;
  height: 100vh;
  position: sticky;
  top: 0;
  background: var(--bg-shell-surface);
  border-right: 1px solid var(--border-shell);
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
  border-bottom: 1px solid var(--border-shell);
  font-weight: 800;
  font-size: 18px;
  color: var(--accent-shell);
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
  color: var(--text-secondary);
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
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.04);
}
.taSidebar__item--active {
  color: var(--accent-shell);
  font-weight: 700;
  border-left-color: var(--accent-shell);
  background: rgba(0, 180, 216, 0.08);
}
.taSidebar__item--active:hover {
  background: rgba(0, 180, 216, 0.12);
  color: var(--accent-shell);
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
  border-top: 1px solid var(--border-shell);
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
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}
.taSidebar__toggle:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-primary);
}
.taSidebar__toggleIcon {
  width: 18px;
  height: 18px;
  transition: transform 0.2s ease;
}
`;

export function TenantAdminSidebar() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("taSidebarCollapsed") === "1";
    } catch {
      return false;
    }
  });
  const { t } = useI18n();
  const { ability } = usePortfolio();
  const location = useLocation();
  const navigate = useNavigate();

  const toggle = () => setCollapsed((c) => {
    const next = !c;
    try { localStorage.setItem("taSidebarCollapsed", next ? "1" : "0"); } catch {}
    return next;
  });

  const segment = location.pathname.replace('/tenant-admin/', '').split('/')[0];

  const navItems = SIDEBAR_ITEMS
    .filter((item) => !item.subject || ability?.can?.('read', item.subject))
    .map((item) => {
    const isActive = segment === item.path || (!segment && item.path === 'home');
    return (
      <button
        key={item.path}
        onClick={() => navigate(`/tenant-admin/${item.path}`)}
        className={'taSidebar__item' + (isActive ? ' taSidebar__item--active' : '')}
        title={collapsed ? (t(item.labelKey) || item.labelKey) : undefined}
      >
        <item.icon className="taSidebar__icon" />
        {collapsed ? null : <span className="taSidebar__label">{t(item.labelKey) || item.labelKey}</span>}
      </button>
    );
  });

  return (
    <aside className="taSidebar" style={{ width: collapsed ? '60px' : '240px' }}>
      <style>{SIDEBAR_CSS}</style>
      <div className="taSidebar__logo">
        {collapsed ? <span>TA</span> : <span>Tenant Admin</span>}
      </div>
      <nav className="taSidebar__nav">{navItems}</nav>
      <div className="taSidebar__footer">
        <button
          onClick={toggle}
          className="taSidebar__toggle"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <ChevronLeft
            className="taSidebar__toggleIcon"
            style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>
      </div>
    </aside>
  );
}
