import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';

function toneClasses(status: any) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'healthy') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'warning') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'critical' || normalized === 'degraded') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function MetricCard({ card }: { card: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
          {card.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p> : null}
        </div>
        {card.status ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(card.status)}`}>
            {card.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

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
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(status)}`}>
          {healthy ? 'Healthy' : component.status}
        </span>
      </div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string | null; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function KeyValue({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

export function AdminCoreOverviewPage() {
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
        ? 'Không đủ quyền để xem tổng quan nền tảng.'
        : 'Không tải được dữ liệu tổng quan nền tảng.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
    const timerId = window.setInterval(loadOverview, 60000);
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
    ? lastFetched.toLocaleString()
    : null;

  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn thêm.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  if (!isStaffGate) {
    return (<p>Không đủ quyền truy cập.</p>);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {'Tổng quan nền tảng'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {'Theo dõi sức khỏe runtime, hàng đợi, jobs và trạng thái materialization theo một chụp nhanh điều hành duy nhất.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin-crawl-control"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Mở trung tâm crawl'}
            </Link>
            <Link
              to="/admin/runtime/jobs"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem jobs'}
            </Link>
            <Link
              to="/admin/audit-trace"
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem audit trace'}
            </Link>
            <button
              type="button"
              onClick={loadOverview}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        </div>
      </section>

      {lastFetchedLabel ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {`Đã chụp lúc ${lastFetchedLabel}`}
        </p>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Panel
        title={'Tổng hợp điều hành'}
        description={'Các chỉ số chính từ chụp nhanh platform overview.'}
      >
        {summaryCards.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {summaryCards.map((card: any) => (
              <MetricCard key={card.key} card={card} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {'Chưa có dữ liệu tổng hợp.'}
          </p>
        )}
      </Panel>

      <Panel
        title={'Sức khỏe runtime'}
        description={'Sự thật vận hành từ health snapshot và các thành phần nền tảng.'}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full border px-3 py-1 font-semibold ${toneClasses(overallStatus)}`}>
            {overallStatus}
          </span>
          <span className="text-slate-500 dark:text-slate-400">
            {`Thành phần suy giảm: ${degradedComponents.length}`}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {healthCards.length > 0 ? (
            healthCards.map((component: any) => (
              <HealthCard key={component.key || component.label} component={component} />
            ))
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {'Chưa có dữ liệu sức khỏe.'}
            </p>
          )}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title={'Phân rã trạng thái'}
          description={'Các thành phần đang suy giảm và độ bao phủ của snapshot.'}
        >
          <KeyValue label={'Trạng thái tổng thể'} value={overallStatus} />
          <KeyValue label={'Thành phần khỏe'} value={String(health?.healthy_component_count ?? overview?.sections?.health?.healthy_component_count ?? '—')} />
          <KeyValue label={'Thành phần suy giảm'} value={String(health?.degraded_component_count ?? overview?.sections?.health?.degraded_component_count ?? degradedComponents.length)} />
          <KeyValue label={'Danh sách suy giảm'} value={degradedComponents.length > 0 ? degradedComponents.join(', ') : '—'} />
        </Panel>

        <Panel
          title={'Chụp nhanh nguồn dữ liệu'}
          description={'Các nguồn điều phối đang nuôi tổng quan nền tảng.'}
        >
          <KeyValue label={'Core service'} value={sources?.service?.status || '—'} />
          <KeyValue label={'Realtime layer'} value={sources?.realtime?.redis_ok ? 'OK' : (sources?.realtime?.channel_layer_type || '—')} />
          <KeyValue label={'Streams layer'} value={sources?.streams?.redis_ok ? 'OK' : 'Degraded'} />
          <KeyValue label={'Prefetch layer'} value={sources?.prefetch?.status || '—'} />
          <KeyValue label={'Market observability'} value={sources?.market_observability?.overall?.http_requests ?? runtimeKpi?.market_observability?.overall?.http_requests ?? '—'} />
          <KeyValue label={'Celery'} value={sources?.admin_runtime_kpi?.celery?.alive ? 'Alive' : (runtimeKpi?.celery?.alive ? 'Alive' : '—')} />
          <KeyValue label={'AI runtime'} value={aiRuntime?.rollout_state?.ready ? 'Ready' : (runtimeKpi?.ai_runtime?.rollout_state?.ready ? 'Ready' : '—')} />
        </Panel>
      </div>
    </div>
  );
}
