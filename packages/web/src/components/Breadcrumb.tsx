import { createElement } from 'react';
import { useLocation } from 'react-router-dom';
import { useI18n } from '@/context/LangContext.js';

const BREADCRUMB_CSS = `
.breadcrumb {
  font-size: 12px;
  color: var(--shell-muted);
  margin-bottom: 16px;
  display: flex;
  gap: 6px;
  align-items: center;
}
.breadcrumb__link {
  color: var(--shell-accent);
  text-decoration: none;
}
.breadcrumb__link:hover {
  text-decoration: underline;
}
.breadcrumb__sep {
  color: var(--shell-border);
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
    const label = raw.startsWith('tenant') || raw.startsWith('shell') ? (t(raw) || raw) : raw;
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
