import { createElement } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/context/LangContext.js';
const BREADCRUMB_CSS = `
.breadcrumb {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.breadcrumb__link {
  color: var(--accent-shell);
  text-decoration: none;
}
.breadcrumb__link:hover {
  text-decoration: underline;
}
.breadcrumb__sep {
  color: var(--border-shell);
}
`;

const DEFAULT_MAP: Record<string, string> = {
  'tenant-admin': 'Tenant Admin',
  home: 'Home',
};

const I18N_MAP: Record<string, string> = {
  home: 'tenantHome.title',
  members: 'tenantMembers.title',
  'service-accounts': 'tenantServiceAccounts.title',
  pats: 'tenantPats.title',
  usage: 'tenantUsage.title',
  'usage-history': 'tenantUsageHistory.title',
  billing: 'tenantBilling.title',
  capabilities: 'tenantCapabilities.title',
  'audit-logs': 'tenantAuditLogs.title',
  reports: 'tenantReports.title',
  sso: 'tenantSSO.title',
  security: 'tenantSecurity.title',
  webhooks: 'tenantWebhooks.title',
  // R4.4 AC2: các mục `settings`/`ai` trước đây rơi về **chuỗi thô** (`settings`,
  // `ai`) vì không có ánh xạ — người dùng thấy breadcrumb toàn ký tự tiếng Anh.
  // Dùng **cùng nhãn** với nhóm "Trí tuệ nhân tạo" trong `/settings` để hai nơi
  // gọi cùng một tên, đừng để breadcrumb gọi "Trung tâm điều hành AI" còn menu
  // gọi "Trí tuệ nhân tạo" — hai tên cho một chỗ là bug nhãn.
  settings: 'userSettings.title',
  ai: 'userSettings.aiGroup.title',
};

export function Breadcrumb({ labelMap }: { labelMap?: Record<string, string> }) {
  const { t } = useI18n();
  const location = useLocation();

  const pathname = location.pathname.replace(/\/$/, '');
  const segments = pathname.split('/').filter(Boolean);
  const map = labelMap || I18N_MAP;

  const crumbs: { label: string; to: string }[] = [];
  let accumulated = '';

  for (const segment of segments) {
    accumulated += '/' + segment;
    const raw = map[segment] || DEFAULT_MAP[segment] || segment;
    // R4.4: coi `raw` là **khoá i18n** khi nó có dấu chấm (khoá dạng `a.b.c`) hoặc
    // bắt đầu bằng `tenant`/`shell`. Trước đây chỉ nhận `tenant*`/`shell*`, nên mọi
    // ánh xạ dạng `userSettings.title` rơi về in ra **tên khoá** thay vì nhãn.
    const isI18nKey = raw.includes('.') || raw.startsWith('tenant') || raw.startsWith('shell');
    const label = isI18nKey ? (t(raw) || raw) : raw;
    crumbs.push({ label, to: accumulated });
  }

  if (crumbs.length === 0) return null;

  return createElement(
    'nav',
    { className: 'breadcrumb' },
    createElement('style', null, BREADCRUMB_CSS),
    ...crumbs.map((crumb, i) => {
      const isLast = i === crumbs.length - 1;
      const parts: React.ReactNode[] = [];

      if (i > 0) {
        parts.push(createElement('span', { key: `sep-${i}`, className: 'breadcrumb__sep' }, '/'));
      }

      if (isLast) {
        parts.push(createElement('span', { key: `label-${i}` }, crumb.label));
      } else {
        parts.push(
          createElement(
            'a',
            { key: `link-${i}`, href: crumb.to, className: 'breadcrumb__link' },
            crumb.label,
          ),
        );
      }

      return parts;
    }).flat(),
  );
}
