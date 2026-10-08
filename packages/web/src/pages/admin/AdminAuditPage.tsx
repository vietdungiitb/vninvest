import { useCallback, useEffect, useState } from 'react';
import { defaultCoreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { downloadSocCsv } from './socCsv.js';
import { useI18n } from '../../context/LangContext.js';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { AdminPageHeader, AdminEmptyState } from './adminUi.js';
import { useUrlState, intCodec, stringCodec, type UrlStateCodec } from '../../hooks/useUrlState';

const ACTIONS = ['create', 'update', 'delete', 'access', 'auth', 'revoke'];

type AuditUrlState = {
  page: number; tenantId: string; actor: string; action: string;
  resourceType: string; dateFrom: string; dateTo: string;
};

// W3-2 (AC-2.3): `spec` + `defaults` khai o CAP MODULE de identity khong doi
// giua cac lan render. Truoc day truyen object literal trong render lam
// `useMemo([params, spec, defaults])` (useUrlState.ts:117) luon tinh lai.
const AUDIT_URL_SPEC: { [K in keyof AuditUrlState]: UrlStateCodec<AuditUrlState[K]> } = {
  page: intCodec,
  tenantId: stringCodec,
  actor: stringCodec,
  action: stringCodec,
  resourceType: stringCodec,
  dateFrom: stringCodec,
  dateTo: stringCodec,
};
const AUDIT_URL_DEFAULTS: AuditUrlState = {
  page: 1, tenantId: '', actor: '', action: '', resourceType: '', dateFrom: '', dateTo: '',
};

export function AdminAuditPage() {
  const { t } = useI18n();
  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn + không fetch.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  const [rows, setRows] = useState<any[]>([]);
  const [count, setCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);
  // W3-2 (AC-2.1): 7 state nay la bo loc + phan trang cua bang audit. Truoc day
  // chi nam trong RAM nen gui link cho nguoi khac thi ho thay man hinh CHUA loc.
  const [{ page, tenantId, actor, action, resourceType, dateFrom, dateTo }, setUrlState] =
    useUrlState(AUDIT_URL_SPEC, AUDIT_URL_DEFAULTS);
  const setPage = (v: number) => setUrlState({ page: v });
  const setTenantId = (v: string) => setUrlState({ tenantId: v });
  const setActor = (v: string) => setUrlState({ actor: v });
  const setAction = (v: string) => setUrlState({ action: v });
  const setResourceType = (v: string) => setUrlState({ resourceType: v });
  const setDateFrom = (v: string) => setUrlState({ dateFrom: v });
  const setDateTo = (v: string) => setUrlState({ dateTo: v });
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!isStaffGate) return;
    setLoading(true);
    setError(null);
    try {
      const api = defaultCoreApiAdapter as unknown as {
        getSocAuditEvents: (p: any) => Promise<any>;
      };
      const res = await api.getSocAuditEvents({
        page, tenant_id: tenantId || undefined, actor: actor || undefined,
        action: action || undefined, resource_type: resourceType || undefined,
        from: dateFrom || undefined, to: dateTo || undefined,
      });
      setRows(res?.results || []);
      setCount(Number(res?.count || 0));
      setHasNext(Boolean(res?.next));
      setHasPrev(Boolean(res?.previous));
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('common.noPermission')
        : t('adminAudit.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [page, tenantId, actor, action, resourceType, dateFrom, dateTo, t, isStaffGate]);

  useEffect(() => { load(); }, [load]);

  if (!isStaffGate) {
    // FU-02c: nhanh "khong co quyen" truoc day tra ve mot `<p>` TRON — khong
  // co `<h1>` ⇒ screen reader khong biet dang o trang nao. Dung
  // `AdminPageHeader` nhu 4 trang admin con lai de moi trang luon co 1 h1.
  return (
    <div className="admin-no-permission">
      <AdminPageHeader title={t("routes.adminAuditPage")} />
      <p>{t("common.noPermission")}</p>
    </div>
  );
  }

  const totalPages = Math.max(1, Math.ceil(count / 20));
  const openRow = rows.find((r: any) => r.event_id === openId) || null;
  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <AdminPageHeader
        eyebrow={t('adminAudit.eyebrow')}
        title={t('adminAudit.title')}
        description={t('adminAudit.description')}
      />
      {error ? <p className="text-sm text-rose-600">{String(error?.message || error)}</p> : null}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <input aria-label={t('adminAudit.filterTenant')} value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder={t('adminAudit.filterTenant')} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <input aria-label={t('adminAudit.filterActor')} value={actor} onChange={(e) => setActor(e.target.value)} placeholder={t('adminAudit.filterActor')} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <select aria-label={t('adminAudit.filterAction')} value={action} onChange={(e) => setAction(e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950">
            <option value="">{t('adminAudit.filterAction')}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <input aria-label={t('adminAudit.filterResource')} value={resourceType} onChange={(e) => setResourceType(e.target.value)} placeholder={t('adminAudit.filterResource')} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <input aria-label={t('adminAudit.filterDateFrom')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <input aria-label={t('adminAudit.filterDateTo')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm dark:bg-slate-950" />
          <button type="button" onClick={() => setPage(1)} className="rounded-full border px-3 py-1.5 text-xs font-semibold">{t('adminAudit.apply')}</button>
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadSocCsv('/operator/soc/audit-events/',
                  { tenant_id: tenantId, actor, action, resource_type: resourceType,
                    from: dateFrom, to: dateTo }, 'soc-audit-events.csv');
              } catch (err: any) {
                setError(err?.message || t('adminAudit.errorGeneric'));
              } finally {
                setExporting(false);
              }
            }}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            {t('adminAudit.export')}
          </button>
        </div>
        {rows.length > 0 ? (
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead><tr className="text-left text-xs uppercase tracking-widest text-slate-500">
              <th className="px-3 py-2">{t('adminAudit.thTime')}</th>
              <th className="px-3 py-2">{t('adminAudit.thActor')}</th>
              <th className="px-3 py-2">{t('adminAudit.thAction')}</th>
              <th className="px-3 py-2">{t('adminAudit.thResource')}</th>
              <th className="px-3 py-2">{t('adminAudit.thTenant')}</th>
              <th className="px-3 py-2" />
            </tr></thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {rows.map((r: any) => (
                <tr key={r.event_id}>
                  <td className="px-3 py-2 font-mono text-xs">{r.occurred_at || '—'}</td>
                  <td className="px-3 py-2">{r.actor_label || `#${r.actor_user_id ?? '—'}`}</td>
                  <td className="px-3 py-2">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.resource_type}/{r.resource_id}</td>
                  <td className="px-3 py-2 font-mono text-xs">{(r.tenant_id || '').slice(0, 8) || '—'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => setOpenId(openId === r.event_id ? null : r.event_id)} className="text-xs font-semibold text-blue-600 hover:underline">{t('adminAudit.detail')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <AdminEmptyState>{loading ? t('adminAudit.loading') : t('adminAudit.empty')}</AdminEmptyState>
        )}
        {openRow ? (
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs text-slate-200">{JSON.stringify(openRow, null, 2)}</pre>
        ) : null}
        <div className="mt-3 flex items-center justify-between">
          <button type="button" disabled={!hasPrev || loading} onClick={() => setPage(Math.max(1, page - 1))} className="rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40">‹</button>
          <span className="text-xs text-slate-500">{t('adminAudit.pageOf', { page, pages: totalPages, total: count })}</span>
          <button type="button" disabled={!hasNext || loading} onClick={() => setPage(page + 1)} className="rounded-full border px-3 py-1 text-xs font-semibold disabled:opacity-40">›</button>
        </div>
      </div>
    </div>
  );
}
