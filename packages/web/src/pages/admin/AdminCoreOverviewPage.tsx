import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

function HealthCard({ component }: { component: any }) {
  const healthy = Boolean(component?.healthy);
  const status = healthy ? 'healthy' : String(component?.status || 'degraded');
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-950 dark:text-white">{component.label}</p>
          {component.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{typeof component.detail === 'string' ? component.detail : JSON.stringify(component.detail)}</p> : null}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(status)}`}>
          {healthy ? 'Healthy' : component.status}
        </span>
      </div>
    </div>
  );
}

export function AdminCoreOverviewPage() {
  const { t, localeTag } = useI18n();
  const [overview, setOverview] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, healthResponse] = await Promise.all([
        (coreApiAdapter as unknown as { getCoreOperatorOverview: () => Promise<any> }).getCoreOperatorOverview(),
        (coreApiAdapter as unknown as { getCoreOperatorHealth: () => Promise<any> }).getCoreOperatorHealth(),
      ]);
      setOverview(overviewResponse.data || null);
      setHealth(healthResponse.data || null);
      setLastFetched(new Date());
    } catch (err: any) {
      setError(err?.response?.status === 403
        ? t('adminCoreOverview.errorNoPermission')
        : t('adminCoreOverview.errorGeneric'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadOverview();
    const timerId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      loadOverview();
    }, 60000);
    return () => window.clearInterval(timerId);
  }, [loadOverview]);

  const summaryCards = overview?.summary_cards || [];
  const healthCards = health?.components || overview?.health_cards || [];
  const overallStatus = health?.health_status || overview?.health_status || 'degraded';
  const degradedComponents = health?.degraded_components || overview?.sections?.health?.degraded_components || [];
  const runtimeKpi = overview?.sections?.admin_runtime_kpi || {};
  const aiRuntime = overview?.sections?.ai_runtime || {};
  const sources = health?.sources || {};
  const lastFetchedLabel = lastFetched
    ? lastFetched.toLocaleString(localeTag)
    : null;

  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn thêm.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[var(--fs-2xs)] uppercase tracking-[0.24em] text-slate-400">{t('adminCoreTenants.heroEyebrow')}</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCoreOverview.heroTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreOverview.heroDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin-crawl-control"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreOverview.openCrawl')}
            </Link>
            <Link
              to="/admin/jobs"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreOverview.viewJobs')}
            </Link>
            <Link
              to="/admin/audit-trace"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreOverview.viewAuditTrace')}
            </Link>
            <button
              type="button"
              onClick={loadOverview}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('adminCoreOverview.loading') : t('adminCoreOverview.refresh')}
            </button>
          </div>
        </div>
      </section>

      {lastFetchedLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t('adminCoreTenants.snapshotAt', { time: lastFetchedLabel })}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <AdminPanel
        title={t('adminCoreOverview.opsSummaryTitle')}
        description={t('adminCoreOverview.opsSummaryDescription')}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <AdminMetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('adminCoreOverview.opsNoData')}
          </p>
        )}
      </AdminPanel>

      <AdminPanel
        title={t('adminCoreOverview.runtimeHealthTitle')}
        description={t('adminCoreOverview.runtimeHealthDescription')}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 font-semibold ${adminToneClasses(overallStatus)}`}>
            {overallStatus}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {t('adminCoreOverview.degradedCount', { n: degradedComponents.length })}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {healthCards.length > 0 ? (
            healthCards.map((component: any) => (
              <HealthCard key={component.key || component.label} component={component} />
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('adminCoreOverview.healthEmpty')}
            </p>
          )}
        </div>
      </AdminPanel>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminPanel
          title={t('adminCoreOverview.degradedTitle')}
          description={t('adminCoreOverview.degradedDescription')}
        >
          <AdminValueRow label={t('adminCoreOverview.rowOverallStatus')} value={overallStatus} />
          <AdminValueRow label={t('adminCoreOverview.rowHealthyComponents')} value={String(health?.healthy_component_count ?? overview?.sections?.health?.healthy_component_count ?? '—')} />
          <AdminValueRow label={t('adminCoreOverview.rowDegradedComponents')} value={String(health?.degraded_component_count ?? overview?.sections?.health?.degraded_component_count ?? degradedComponents.length)} />
          <AdminValueRow label={t('adminCoreOverview.rowDegradedList')} value={degradedComponents.length > 0 ? degradedComponents.join(', ') : '—'} />
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreOverview.sourcesTitle')}
          description={t('adminCoreOverview.sourcesDescription')}
        >
          <AdminValueRow label={t('adminCoreOverview.sourceCoreService')} value={sources?.service?.status || '—'} />
          <AdminValueRow label={t('adminCoreOverview.sourceRealtime')} value={sources?.realtime?.redis_ok ? 'OK' : (sources?.realtime?.channel_layer_type || '—')} />
          <AdminValueRow label={t('adminCoreOverview.sourceStreams')} value={sources?.streams?.redis_ok ? 'OK' : 'Degraded'} />
          <AdminValueRow label={t('adminCoreOverview.sourcePrefetch')} value={sources?.prefetch?.status || '—'} />
          <AdminValueRow label={t('adminCoreOverview.sourceMarketObservability')} value={sources?.market_observability?.overall?.http_requests ?? runtimeKpi?.market_observability?.overall?.http_requests ?? '—'} />
          <AdminValueRow label={t('adminCoreOverview.sourceCelery')} value={sources?.admin_runtime_kpi?.celery?.alive ? 'Alive' : (runtimeKpi?.celery?.alive ? 'Alive' : '—')} />
          <AdminValueRow label={t('adminCoreOverview.sourceAiRuntime')} value={aiRuntime?.rollout_state?.ready ? 'Ready' : (runtimeKpi?.ai_runtime?.rollout_state?.ready ? 'Ready' : '—')} />
        </AdminPanel>
      </div>
    </div>
  );
}
