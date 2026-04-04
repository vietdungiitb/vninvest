/**
 * AdminOps.jsx — Trang quản trị hệ thống (chỉ dành cho is_staff).
 * Route: /admin-ops
 *
 * Panels:
 *  - Thống kê hệ thống: user/portfolio/symbol/watchlist counts
 *  - Trạng thái realtime: channel layer, redis health
 *  - Lần sync cuối: market groups, stock profiles
 *  - Shortcuts đồng bộ nhanh
 */
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminOpsStats, syncMarketGroups, syncStockProfile, syncWatchlistPrices, warmTickerPrefetch } from '../api/client';

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString('vi-VN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

function fmtNumber(value, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return new Intl.NumberFormat('vi-VN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value));
}

function toneClasses(tone) {
  const tones = {
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/70 dark:text-amber-300',
    red: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    slate: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  };
  return tones[tone] || tones.slate;
}

function Pill({ children, tone = 'slate' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses(tone)}`}>
      {children}
    </span>
  );
}

function SignalBadge({ signal }) {
  if (!signal) return <Pill>Chưa có</Pill>;
  const normalized = String(signal).toLowerCase();
  const tone = normalized === 'green' ? 'green' : normalized === 'amber' ? 'amber' : 'red';
  return <Pill tone={tone}>{normalized.toUpperCase()}</Pill>;
}

function RolloutStatusBadge({ status }) {
  if (!status) return <Pill>Chưa có</Pill>;
  const normalized = String(status).toLowerCase();
  const toneMap = {
    running: 'blue',
    completed: 'green',
    pending: 'amber',
    failed: 'red',
    rolled_back: 'red',
  };
  return <Pill tone={toneMap[normalized] || 'slate'}>{normalized}</Pill>;
}

function MiniMetric({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/40">
      <p className="text-xs uppercase tracking-wider text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

function KeyValueRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-gray-100 text-right">{value ?? '—'}</span>
    </div>
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-3xl font-bold text-gray-900 dark:text-white">{value ?? '—'}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function StatusBadge({ ok }) {
  if (ok === null || ok === undefined)
    return <span className="text-xs text-gray-400">N/A</span>;
  return ok
    ? <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">OK</span>
    : <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300">FAIL</span>;
}

function PrefetchHealthBadge({ snapshot }) {
  if (!snapshot || !snapshot.meta_present) {
    return <Pill>Chưa có meta</Pill>;
  }
  if (snapshot.healthy) {
    return <Pill tone="green">HEALTHY</Pill>;
  }
  const statusValue = String(snapshot.prefetch?.status || '').toLowerCase();
  if (statusValue === 'retrying') {
    return <Pill tone="amber">RETRYING</Pill>;
  }
  return <Pill tone="red">DEGRADED</Pill>;
}

function SyncRow({ label, log }) {
  if (!log) return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
      <span className="text-xs text-gray-400">Chưa có dữ liệu</span>
    </div>
  );
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div>
        <p className="text-sm text-gray-700 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400">Mode: {log.mode} · {fmtDateTime(log.started_at)}</p>
        {log.message && <p className="text-xs text-gray-400 truncate max-w-xs">{log.message}</p>}
      </div>
      <StatusBadge ok={log.success} />
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function AdminOps() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStates, setSyncStates] = useState({});

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
    }
    setError(null);
    try {
      const res = await getAdminOpsStats();
      setStats(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 403 || status === 401) {
        setError('403');
      } else if (status === 429) {
        setError('429');
      } else {
        setError(err.message || 'Lỗi không xác định');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(() => {
      load({ silent: true });
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [load]);

  const handleSync = useCallback(async (key, apiFn, ...args) => {
    setSyncStates((s) => ({ ...s, [key]: 'loading' }));
    try {
      await apiFn(...args);
      setSyncStates((s) => ({ ...s, [key]: 'ok' }));
      await load();
    } catch {
      setSyncStates((s) => ({ ...s, [key]: 'error' }));
    }
  }, [load]);

  // ─── Render states ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (error === '403') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-lg font-semibold text-red-500">Bạn không có quyền truy cập trang này.</p>
        <button
          className="text-blue-500 hover:underline text-sm"
          onClick={() => navigate('/dashboard')}
        >
          ← Trở về Dashboard
        </button>
      </div>
    );
  }

  if (error === '429') {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-yellow-600 dark:text-yellow-400 font-semibold">429 — Quá nhiều yêu cầu</p>
        <p className="text-sm text-gray-500">Server đang bận hoặc rate limit tạm thời. Vui lòng chờ vài giây rồi thử lại.</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-red-500 text-sm">{error}</p>
        <button className="text-blue-500 hover:underline text-sm" onClick={load}>Thử lại</button>
      </div>
    );
  }

  if (!stats) return null;

  const dashboard = stats.whale_config_dashboard || {};
  const propagation = dashboard.propagation || stats.whale_config_propagation;
  const anomaly = dashboard.anomaly || stats.whale_config_anomaly;
  const alerts = dashboard.alerts || {};
  const workerSummary = dashboard.worker_summary || {};
  const workerRows = Array.isArray(workerSummary.workers) ? workerSummary.workers.slice(0, 5) : [];
  const prefetch = stats.ticker_prefetch || {};

  const syncBtn = (key, label, fn, ...args) => {
    const st = syncStates[key];
    return (
      <button
        disabled={st === 'loading'}
        onClick={() => handleSync(key, fn, ...args)}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
          st === 'loading'
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
            : st === 'ok'
            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
            : st === 'error'
            ? 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        {st === 'loading' ? 'Đang sync...' : st === 'ok' ? 'Xong ✓' : st === 'error' ? 'Lỗi ✗' : label}
      </button>
    );
  };

  // ─── Full render ──────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin Ops</h1>
        <button
          onClick={load}
          className="text-xs text-blue-500 hover:underline"
        >
          Làm mới
        </button>
      </div>

      {/* Thống kê hệ thống */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Thống kê hệ thống</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Người dùng" value={stats.user_count} />
          <StatCard label="Danh mục" value={stats.portfolio_count} />
          <StatCard label="Mã theo dõi" value={stats.tracked_symbol_count} />
          <StatCard label="Watchlist items" value={stats.watchlist_item_count} />
        </div>
      </section>

      {/* Trạng thái Realtime */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Trạng thái Realtime</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Channel layer</span>
            <span className="text-sm font-mono text-gray-800 dark:text-gray-200">{stats.channel_layer_type}</span>
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Realtime enabled</span>
            <StatusBadge ok={stats.realtime_enabled} />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Redis</span>
            <StatusBadge ok={stats.redis_ok} />
          </div>
          <div className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Prefetch health</span>
            <PrefetchHealthBadge snapshot={prefetch} />
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMetric label="Freshness" value={prefetch.freshness_seconds != null ? `${fmtNumber(prefetch.freshness_seconds)}s` : '—'} />
              <MiniMetric label="Cache hits" value={`${fmtNumber(prefetch.sample_cache_hits || 0)}/${fmtNumber(prefetch.sample_cache_total || 0)}`} />
              <MiniMetric label="Prefetch status" value={prefetch.prefetch?.status || '—'} hint={prefetch.prefetch?.retry_after_seconds ? `retry in ${fmtNumber(prefetch.prefetch.retry_after_seconds)}s` : (prefetch.prefetch?.reason || '—')} />
            </div>
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Ticker Prefetch</h3>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Last run {fmtDateTime(prefetch.prefetch?.generated_at)} · symbols {fmtNumber(prefetch.prefetch?.symbols)} · cached {fmtNumber(prefetch.prefetch?.cached)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <PrefetchHealthBadge snapshot={prefetch} />
                  {prefetch.prefetch?.batch_size ? <Pill tone="blue">batch {prefetch.prefetch.batch_size}</Pill> : null}
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <KeyValueRow label="Tracked" value={fmtNumber(prefetch.prefetch?.source_counts?.tracked_symbols)} />
                <KeyValueRow label="Watchlist" value={fmtNumber(prefetch.prefetch?.source_counts?.watchlist_items)} />
                <KeyValueRow label="Alerts" value={fmtNumber(prefetch.prefetch?.source_counts?.price_alerts)} />
                <KeyValueRow label="Transactions" value={fmtNumber(prefetch.prefetch?.source_counts?.portfolio_transactions)} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lần sync cuối */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Lần đồng bộ cuối</h2>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 px-5">
          <SyncRow label="Market Groups" log={stats.last_market_group_sync} />
          <SyncRow label="Stock Profiles" log={stats.last_stock_profile_sync} />
        </div>
      </section>

      {/* Shortcuts đồng bộ */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Đồng bộ nhanh</h2>
        <div className="flex flex-wrap gap-3">
          {syncBtn('stockprofile', 'Sync Stock Profiles', syncStockProfile)}
          {syncBtn('watchlist', 'Sync Watchlist Prices', syncWatchlistPrices, 5)}
          {syncBtn('marketgroups', 'Đồng bộ Nhóm Thị trường', syncMarketGroups)}
          {syncBtn('prefetchwarm', 'Warm Ticker Cache', warmTickerPrefetch, 'async')}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Mission Control</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Auto-refresh mỗi 15 giây để hậu kiểm propagation, anomaly và auto-revert.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/admin/portfolio/whaleconfigversion/"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Mở Versions
            </a>
            <a
              href="/admin/portfolio/whaleconfigrollout/"
              className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Mở Rollouts
            </a>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Active Version"
            value={dashboard.active_version?.version_code || '—'}
            sub={dashboard.active_version?.activated_at ? `Activated ${fmtDateTime(dashboard.active_version.activated_at)}` : 'Chưa có version active'}
          />
          <StatCard
            label="Pending Rollout"
            value={dashboard.pending_rollout?.version_code || '—'}
            sub={dashboard.pending_rollout?.effective_from ? `ETA ${fmtDateTime(dashboard.pending_rollout.effective_from)}` : 'Không có rollout chờ'}
          />
          <StatCard
            label="Propagation"
            value={propagation?.summary || 'Chưa có rollout'}
            sub={propagation?.version_code ? `Version ${propagation.version_code}` : 'Không có active rollout'}
          />
          <StatCard
            label="Auto-Revert Guard"
            value={anomaly ? (anomaly.healthy ? 'Healthy' : 'Alert') : '—'}
            sub={anomaly?.summary || 'Chưa có snapshot anomaly'}
          />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Rollout Post-check</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Nhìn nhanh active version, rollout status và anomaly gần live.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <RolloutStatusBadge status={dashboard.active_rollout?.status || dashboard.pending_rollout?.status} />
                <SignalBadge signal={propagation?.signal} />
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniMetric
                label="Alerts 5m"
                value={fmtNumber(alerts.last_5m_count)}
                hint={`${fmtNumber(alerts.unique_symbols_last_5m)} symbols`}
              />
              <MiniMetric
                label="Alerts 10m"
                value={fmtNumber(alerts.last_10m_count)}
                hint={`${fmtNumber(alerts.unique_symbols_last_10m)} symbols`}
              />
              <MiniMetric
                label="ACK Workers"
                value={`${fmtNumber(workerSummary.acknowledged_count || 0)}/${fmtNumber(workerSummary.ack_expected_count || 0)}`}
                hint={`stale ${fmtNumber(workerSummary.stale_ack_count || 0)}`}
              />
              <MiniMetric
                label="Workers Live"
                value={fmtNumber(workerSummary.live_count)}
                hint={workerSummary.source || '—'}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Versions & rollout</h4>
                <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                  <KeyValueRow label="Active version" value={dashboard.active_version?.version_code || '—'} />
                  <KeyValueRow label="Pending rollout" value={dashboard.pending_rollout?.version_code || '—'} />
                  <KeyValueRow label="Rollout mode" value={dashboard.active_rollout?.mode || dashboard.pending_rollout?.mode || '—'} />
                  <KeyValueRow label="Propagation" value={propagation?.summary || 'Chưa có'} />
                  <KeyValueRow label="Anomaly reason" value={anomaly?.reason_codes?.join(', ') || 'Không có'} />
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-700">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Anomaly snapshot</h4>
                <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-700">
                  <KeyValueRow label="Observed" value={fmtDateTime(anomaly?.observed_at)} />
                  <KeyValueRow label="Current advisory rate" value={anomaly ? `${fmtNumber(anomaly.current_advisory_rate, 2)}/m` : '—'} />
                  <KeyValueRow label="Advisory ratio" value={anomaly?.advisory_rate_ratio ?? '—'} />
                  <KeyValueRow label="Tick ratio" value={anomaly?.tick_rate_ratio ?? '—'} />
                  <KeyValueRow label="Auto-revert" value={anomaly ? (anomaly.should_auto_revert ? 'Đã sẵn sàng trigger' : 'Chưa trigger') : '—'} />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Worker Summary</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Tổng hợp worker Mission Control để phát hiện backlog hoặc worker stale.</p>
              </div>
              <Pill tone={workerSummary.ok ? 'green' : 'red'}>{workerSummary.detail || 'no workers'}</Pill>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <MiniMetric label="CPU total" value={workerSummary.total_cpu_seconds != null ? `${fmtNumber(workerSummary.total_cpu_seconds, 2)}s` : '—'} />
              <MiniMetric label="RAM total" value={workerSummary.total_maxrss_mb != null ? `${fmtNumber(workerSummary.total_maxrss_mb, 1)} MB` : '—'} />
              <MiniMetric label="Pool proc" value={fmtNumber(workerSummary.pool_process_count || 0)} />
              <MiniMetric label="Stats ready" value={fmtNumber(workerSummary.reporting_stats_count || 0)} />
            </div>

            <div className="mt-4 space-y-3">
              {workerRows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                  Chưa có worker report hoặc ACK record.
                </div>
              ) : workerRows.map((worker) => (
                <div key={worker.worker_name} className="rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{worker.worker_name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{worker.worker_version || 'no version reported'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={worker.live ? 'green' : 'red'}>{worker.live ? 'live' : 'offline'}</Pill>
                      <Pill tone={worker.ack_state === 'acked' ? 'green' : worker.ack_state === 'pending' ? 'amber' : worker.ack_state === 'stale' ? 'red' : 'slate'}>
                        {worker.ack_state}
                      </Pill>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>CPU {worker.cpu_user_seconds != null ? `${fmtNumber(worker.cpu_user_seconds, 2)}s` : '—'}</span>
                    <span>SYS {worker.cpu_system_seconds != null ? `${fmtNumber(worker.cpu_system_seconds, 2)}s` : '—'}</span>
                    <span>RAM {worker.maxrss_mb != null ? `${fmtNumber(worker.maxrss_mb, 1)} MB` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>

            {alerts.latest_advisory ? (
              <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                Advisory mới nhất: {alerts.latest_advisory.symbol} · {alerts.latest_advisory.side} · {fmtDateTime(alerts.latest_advisory.created_at)}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
