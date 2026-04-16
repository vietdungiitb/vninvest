/**
 * RuntimeKPIPanel.jsx — S24-04 Telemetry / Runtime KPI Panel
 * Hiển thị market observability snapshot, prefetch health, và Celery status.
 * Chỉ dành cho admin (route /admin-ops đã bảo vệ ở router level).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { getAdminRuntimeKPI } from '../api/client';
import { useI18n } from '../context/LangContext';

function fmtMs(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(1)}ms`;
}

function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function fmtCount(value) {
  if (value === null || value === undefined) return '—';
  return Number(value).toLocaleString();
}

function StatusDot({ ok }) {
  if (ok === null || ok === undefined) return <span className="text-gray-500">—</span>;
  return ok
    ? <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
    : <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />;
}

function KPIRow({ label, value, tone }) {
  const toneClass =
    tone === 'red' ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
    tone === 'green' ? 'text-emerald-400' :
    'text-gray-200';

  return (
    <div className="flex items-baseline justify-between gap-2 text-xs py-1 border-b border-gray-800 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono font-semibold ${toneClass}`}>{value}</span>
    </div>
  );
}

function toneFor5xx(ratio) {
  if (ratio === null || ratio === undefined) return undefined;
  if (ratio >= 5) return 'red';
  if (ratio >= 1) return 'amber';
  return 'green';
}

function toneForP95(ms) {
  if (ms === null || ms === undefined) return undefined;
  if (ms >= 2000) return 'red';
  if (ms >= 800) return 'amber';
  return 'green';
}

export default function RuntimeKPIPanel() {
  const { t, formatDateTime } = useI18n();
  const [kpi, setKpi] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastFetched, setLastFetched] = useState(null);

  const fetchKPI = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getAdminRuntimeKPI();
      setKpi(res.data);
      setLastFetched(new Date());
    } catch (err) {
      setError(err?.response?.status === 403 ? 'Không đủ quyền (is_staff required).' : 'Lỗi tải KPI.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKPI();
    const id = window.setInterval(fetchKPI, 60000);
    return () => window.clearInterval(id);
  }, [fetchKPI]);

  const obs = kpi?.market_observability;
  const overall = obs?.overall;
  const intradayFreshness = obs?.intraday_freshness;
  const prefetch = kpi?.prefetch_health;
  const celery = kpi?.celery;

  // Tổng hợp top endpoints theo p95
  const topEndpoints = obs?.endpoints
    ? Object.entries(obs.endpoints)
        .map(([key, val]) => ({ key, ...val }))
        .sort((a, b) => (b.latency_ms?.p95 ?? 0) - (a.latency_ms?.p95 ?? 0))
        .slice(0, 5)
    : [];

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
            {t('runtimeKPI.title')}
          </h2>
          {lastFetched && (
            <p className="text-[11px] text-gray-600 mt-0.5">
              {t('runtimeKPI.lastSampled', { time: formatDateTime(lastFetched, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) })}
            </p>
          )}
        </div>
        <button
          onClick={fetchKPI}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded border border-gray-700 bg-gray-800 text-gray-400 hover:text-gray-200 hover:border-gray-600 disabled:opacity-50 transition-colors"
        >
          {loading ? '…' : t('runtimeKPI.refresh')}
        </button>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-800 rounded px-3 py-2">{error}</p>
      )}

      {kpi && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Market Observability */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-0.5">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('runtimeKPI.marketObs')}
            </p>
            <KPIRow
              label={t('runtimeKPI.httpRequests')}
              value={fmtCount(overall?.http_requests)}
            />
            <KPIRow
              label={t('runtimeKPI.http5xxRatio')}
              value={fmtPct(overall?.http_5xx_ratio_pct)}
              tone={toneFor5xx(overall?.http_5xx_ratio_pct)}
            />
            <KPIRow
              label={t('runtimeKPI.fallbackHits')}
              value={fmtCount(overall?.fallback_hits)}
              tone={(overall?.fallback_hits ?? 0) > 0 ? 'amber' : 'green'}
            />
            <KPIRow
              label={t('runtimeKPI.externalTimeouts')}
              value={fmtCount(overall?.external_timeouts)}
              tone={(overall?.external_timeouts ?? 0) > 0 ? 'red' : 'green'}
            />
          </div>

          {/* Intraday Freshness */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-0.5">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('runtimeKPI.intradayFreshness')}
            </p>
            <KPIRow
              label={t('runtimeKPI.intradayAgeP50')}
              value={intradayFreshness?.age_seconds?.p50 != null ? `${intradayFreshness.age_seconds.p50}s` : '—'}
              tone={toneForP95((intradayFreshness?.age_seconds?.p50 ?? 0) * 1000)}
            />
            <KPIRow
              label={t('runtimeKPI.intradayAgeP95')}
              value={intradayFreshness?.age_seconds?.p95 != null ? `${intradayFreshness.age_seconds.p95}s` : '—'}
              tone={toneForP95((intradayFreshness?.age_seconds?.p95 ?? 0) * 1000)}
            />
            <KPIRow
              label={t('runtimeKPI.intradayStaleServed')}
              value={fmtCount(intradayFreshness?.stale_served_total)}
              tone={(intradayFreshness?.stale_served_total ?? 0) > 0 ? 'amber' : 'green'}
            />
            <KPIRow
              label={t('runtimeKPI.intradayStaleOverThreshold')}
              value={fmtCount(intradayFreshness?.stale_over_threshold_total)}
              tone={(intradayFreshness?.stale_over_threshold_total ?? 0) > 0 ? 'red' : 'green'}
            />
            <KPIRow
              label={t('runtimeKPI.intradayRetry3s')}
              value={fmtCount(intradayFreshness?.realtime_refresh_trigger_total)}
            />
          </div>

          {/* Top Endpoints P95 */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('runtimeKPI.topEndpoints')}
            </p>
            {topEndpoints.length === 0 ? (
              <p className="text-xs text-gray-600">{t('runtimeKPI.noData')}</p>
            ) : (
              <div className="space-y-0.5">
                {topEndpoints.map((ep) => (
                  <div key={ep.key} className="flex items-baseline justify-between gap-1 text-[11px] py-1 border-b border-gray-800 last:border-0">
                    <span className="text-gray-500 truncate max-w-[100px]" title={ep.key}>{ep.key}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`font-mono font-semibold ${toneForP95(ep.latency_ms?.p95) === 'red' ? 'text-red-400' : toneForP95(ep.latency_ms?.p95) === 'amber' ? 'text-amber-400' : 'text-emerald-400'}`}>
                        p95: {fmtMs(ep.latency_ms?.p95)}
                      </span>
                      <span className={`font-mono ${(ep.five_xx_ratio_pct ?? 0) >= 1 ? 'text-red-400' : 'text-gray-600'}`}>
                        5xx: {fmtPct(ep.five_xx_ratio_pct)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Prefetch + Celery */}
          <div className="rounded-lg border border-gray-800 bg-gray-950 p-3 space-y-0.5">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              {t('runtimeKPI.infraHealth')}
            </p>
            <KPIRow
              label={t('runtimeKPI.prefetchHealthy')}
              value={
                prefetch?.healthy === undefined ? '—'
                  : prefetch.healthy
                    ? <><StatusDot ok />{t('runtimeKPI.ok')}</>
                    : <><StatusDot ok={false} />{t('runtimeKPI.degraded')}</>
              }
              tone={prefetch?.healthy === false ? 'red' : prefetch?.healthy ? 'green' : undefined}
            />
            <KPIRow
              label={t('runtimeKPI.prefetchFreshness')}
              value={prefetch?.freshness_seconds != null ? `${prefetch.freshness_seconds}s` : '—'}
              tone={(prefetch?.freshness_seconds ?? 0) > 90 ? 'amber' : 'green'}
            />
            <KPIRow
              label={t('runtimeKPI.cacheHits')}
              value={
                prefetch?.sample_cache_total > 0
                  ? `${prefetch.sample_cache_hits}/${prefetch.sample_cache_total}`
                  : '—'
              }
            />
            <KPIRow
              label={t('runtimeKPI.celery')}
              value={
                celery?.alive === undefined ? '—'
                  : celery.alive
                    ? <><StatusDot ok />{t('runtimeKPI.alive')}</>
                    : <><StatusDot ok={false} />{t('runtimeKPI.down')}</>
              }
              tone={celery?.alive === false ? 'red' : celery?.alive ? 'green' : undefined}
            />
          </div>
        </div>
      )}

      {!kpi && !loading && !error && (
        <p className="text-xs text-gray-600">{t('runtimeKPI.noData')}</p>
      )}
    </div>
  );
}
