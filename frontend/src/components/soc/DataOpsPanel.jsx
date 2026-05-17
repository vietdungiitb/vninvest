import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';
import { MatrixScrapeMonitor } from './MatrixScrapeMonitor';
import { OwnershipBadgeRow } from './OwnershipBadgeRow';
import { WriteGuardBanner } from './WriteGuardBanner';

const BACKFILL_DATASETS = [
  { key: 'daily_prices', labelKey: 'soc.dataops.dataset_daily_prices', supportedByPlanner: true },
  { key: 'price_board_snapshot', labelKey: 'soc.dataops.dataset_price_board_snapshot', supportedByPlanner: true },
  { key: 'intraday_bars', labelKey: 'soc.dataops.dataset_intraday_bars', supportedByPlanner: true },
  { key: 'intraday_ticks', labelKey: 'soc.dataops.dataset_intraday_ticks', supportedByPlanner: true },
  { key: 'session_facts', labelKey: 'soc.dataops.dataset_session_facts', supportedByPlanner: true },
  { key: 'whale_events', labelKey: 'soc.dataops.dataset_whale_events', supportedByPlanner: false },
  { key: 'order_flow', labelKey: 'soc.dataops.dataset_order_flow', supportedByPlanner: false },
  { key: 'dark_flow', labelKey: 'soc.dataops.dataset_dark_flow', supportedByPlanner: false },
];

const PLANNER_SUPPORTED_DATASET_KEYS = new Set(
  BACKFILL_DATASETS.filter((dataset) => dataset.supportedByPlanner).map((dataset) => dataset.key),
);

const BACKFILL_SYMBOL_GROUPS = [
  { key: 'VN30',  label: 'VN30' },
  { key: 'VN50',  label: 'VN50' },
  { key: 'VN100', label: 'VN100' },
  { key: 'HOSE',  label: 'HOSE' },
  { key: 'HNX',   label: 'HNX' },
  { key: 'UPCOM', label: 'UPCOM' },
  { key: 'all',   label: 'Tất cả' },
  { key: 'custom', label: 'Tuỳ chỉnh' },
];

const DEFAULT_BACKFILL_FORM = {
  datasets: ['daily_prices'],
  symbolGroup: 'VN30',
  customSymbols: '',
  fromDate: '',
  toDate: '',
  mode: 'missing_only',
  dryRun: true,
  executionMode: 'async',
};

const BACKFILL_DATASET_FIELDS = {
  daily_prices:   'soc.dataops.dataset_field_daily_prices',
  price_board_snapshot: 'soc.dataops.dataset_field_price_board_snapshot',
  intraday_bars:  'soc.dataops.dataset_field_intraday_bars',
  session_facts:  'soc.dataops.dataset_field_session_facts',
  whale_events:   'soc.dataops.dataset_field_whale_events',
  order_flow:     'soc.dataops.dataset_field_order_flow',
  dark_flow:      'soc.dataops.dataset_field_dark_flow',
  intraday_ticks:  'soc.dataops.dataset_field_intraday_tick',
};

const DATAOPS_SUB_TABS = [
  { id: 'data',    label: '\uD83D\uDCE6 Kho d\u1EEF li\u1EC7u' },
  { id: 'ops',     label: '\u26A1 \u0110i\u1EC1u ph\u1ED1i' },
  { id: 'monitor', label: '\uD83D\uDD0D Gi\u00E1m s\u00E1t' },
  { id: 'config',  label: '\u2699\uFE0F C\u1EA5u h\u00ECnh' },
];
const GAPS_PAGE_SIZE = 20;
const PLANNER_PREVIEW_PAGE_SIZE = 12;

// ── Data Inventory Section ─────────────────────────────────────────────────
const DataInventorySection = ({ inventory, loading }) => {
  const [open, setOpen] = useState(false);

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';
  const fmtNum = (n) => (n ?? 0).toLocaleString('vi-VN');

  const maxRows = inventory?.by_year?.length
    ? Math.max(...inventory.by_year.map((y) => y.rows))
    : 1;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-bold text-white">📦 Kho dữ liệu thị trường</span>
          {!loading && inventory?.summary && (
            <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-300">
              {fmtNum(inventory.summary.total_rows)} bản ghi · {fmtNum(inventory.summary.total_symbols)} mã
            </span>
          )}
        </div>
        <span className="text-slate-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-slate-700 px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-slate-400 text-sm">Đang tải...</p>
          ) : !inventory?.summary ? (
            <p className="text-slate-500 text-sm">Không có dữ liệu.</p>
          ) : (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Tổng bản ghi', value: fmtNum(inventory.summary.total_rows) },
                  { label: 'Số mã', value: fmtNum(inventory.summary.total_symbols) },
                  { label: 'Ngày đầu tiên', value: fmtDate(inventory.summary.earliest_date) },
                  { label: 'Ngày gần nhất', value: fmtDate(inventory.summary.latest_date) },
                ].map((c) => (
                  <div key={c.label} className="rounded bg-slate-800 p-3 border border-slate-700">
                    <p className="text-[11px] text-slate-500 mb-1">{c.label}</p>
                    <p className="text-base font-bold text-white">{c.value}</p>
                  </div>
                ))}
              </div>

              {/* Phân bổ theo năm */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Phân bổ theo năm (DailyPrice)</p>
                <div className="space-y-1.5">
                  {(inventory.by_year || []).map((y) => {
                    const pct = maxRows > 0 ? Math.round((y.rows / maxRows) * 100) : 0;
                    return (
                      <div key={y.year} className="flex items-center gap-3">
                        <span className="w-10 text-right text-xs text-slate-400 font-mono">{y.year}</span>
                        <div className="flex-1 h-4 bg-slate-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-28 text-right text-[11px] text-slate-300 font-mono tabular-nums">
                          {fmtNum(y.rows)} · {y.symbols} mã
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coverage theo nhóm */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Coverage theo nhóm</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-slate-300">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left py-1.5 pr-3 font-medium">Nhóm</th>
                        <th className="text-right py-1.5 px-2 font-medium">Bản ghi</th>
                        <th className="text-right py-1.5 px-2 font-medium">Mã có data</th>
                        <th className="text-right py-1.5 px-2 font-medium">Ngày đầu</th>
                        <th className="text-right py-1.5 pl-2 font-medium">Ngày cuối</th>
                        <th className="text-right py-1.5 pl-2 font-medium">Ngày lịch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(inventory.by_group || []).map((g) => {
                        const hasFull = g.covered_symbols > 0 && g.covered_symbols >= g.symbol_count;
                        const hasPartial = g.covered_symbols > 0;
                        return (
                          <tr key={g.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                            <td className="py-1.5 pr-3">
                              <span className={`font-semibold ${g.type === 'custom' ? 'text-teal-300' : 'text-slate-100'}`}>
                                {g.type === 'custom' ? `★ ${g.name}` : g.name}
                              </span>
                            </td>
                            <td className="text-right px-2 font-mono">{fmtNum(g.total_rows)}</td>
                            <td className="text-right px-2">
                              <span className={hasFull ? 'text-emerald-400' : hasPartial ? 'text-yellow-400' : 'text-slate-600'}>
                                {g.covered_symbols}/{g.symbol_count}
                              </span>
                            </td>
                            <td className="text-right px-2 text-slate-400">{fmtDate(g.earliest_date)}</td>
                            <td className="text-right pl-2 text-slate-400">{fmtDate(g.latest_date)}</td>
                            <td className="text-right pl-2">
                              {g.calendar_days
                                ? <span className={g.calendar_days < 30 ? 'text-amber-400 font-semibold' : 'text-slate-400'}>
                                    {g.calendar_days.toLocaleString('vi-VN')} ngày{g.calendar_days < 30 ? ' ⚠' : ''}
                                  </span>
                                : <span className="text-slate-600">—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Data types */}
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">Loại dữ liệu</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {(inventory.data_types || []).map((dt) => (
                    <div key={dt.name} className={`rounded border p-3 flex justify-between items-center ${dt.total_rows > 0 ? 'border-emerald-800 bg-emerald-950/30' : 'border-slate-700 bg-slate-800/40'}`}>
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{dt.label}</p>
                        <p className="text-[11px] text-slate-500">{dt.name}</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold ${dt.total_rows > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {fmtNum(dt.total_rows)}
                        </p>
                        <p className="text-[10px] text-slate-500">{dt.symbols} mã</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const BackfillCenterSection = ({ t, canApply, customGroups }) => {
  const [form, setForm] = useState(DEFAULT_BACKFILL_FORM);
  const [status, setStatus] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [activeRun, setActiveRun] = useState(null);

  // Combine static predefined groups + dynamic custom groups
  const allGroups = [
    ...BACKFILL_SYMBOL_GROUPS,
    ...(customGroups || []).map((g) => ({
      key: g.group_id,
      label: g.name,
      isCustom: true,
    })),
  ];

  const toggleDataset = (key) => {
    if (!PLANNER_SUPPORTED_DATASET_KEYS.has(key)) {
      return;
    }
    setForm((prev) => ({
      ...prev,
      datasets: prev.datasets.includes(key)
        ? prev.datasets.filter((d) => d !== key)
        : [...prev.datasets, key],
    }));
  };

  const loadActiveRun = async () => {
    try {
      const payload = await socApi.getDataOpsRunLogs(1);
      const latestRun = Array.isArray(payload?.results) && payload.results.length > 0
        ? payload.results[0]
        : null;
      if (latestRun && ['queued', 'running'].includes(String(latestRun.status || '').toLowerCase())) {
        setActiveRun({
          runId: latestRun.run_id,
          serviceRunLogId: latestRun.service_run_log_id,
          status: latestRun.status,
          startedAt: latestRun.started_at,
        });
      } else {
        setActiveRun(null);
      }
    } catch {
      // Keep UI resilient if run-log fetch fails.
    }
  };

  useEffect(() => {
    loadActiveRun();
    const intervalId = setInterval(loadActiveRun, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const handleRun = async () => {
    if (!canApply) return;

    if (activeRun?.runId) {
      setStatus(t('soc.dataops.backfill_active_run_blocked', { run_id: activeRun.runId }));
      return;
    }

    const plannerDatasets = form.datasets.filter((dataset) => PLANNER_SUPPORTED_DATASET_KEYS.has(dataset));
    if (plannerDatasets.length === 0) {
      setStatus(t('soc.dataops.backfill_dataset_not_supported'));
      return;
    }

    setIsRunning(true);
    setStatus(null);
    const symbols = form.symbolGroup === 'custom'
      ? form.customSymbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];
    try {
      const payload = {
        datasets: plannerDatasets,
        ...(symbols.length ? { symbols } : { symbol_group: form.symbolGroup }),
        from_date: form.fromDate || undefined,
        to_date: form.toDate || undefined,
        mode: form.mode,
        dry_run: form.dryRun,
        execution_mode: form.executionMode,
        reason: 'backfill_center_soc',
      };
      const result = await socApi.runDataOpsPlanner(payload);
      const runId = result?.run_id || '';
      setStatus(runId ? t('soc.dataops.backfill_queued_with_run', { run_id: runId }) : t('soc.dataops.backfill_queued'));
      setActiveRun({
        runId,
        serviceRunLogId: result?.service_run_log_id || null,
        status: result?.status || 'queued',
        startedAt: null,
      });
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleAbortActiveRun = async () => {
    if (!activeRun?.runId || !canApply) {
      return;
    }
    try {
      setIsStopping(true);
      setStatus(null);
      const result = await socApi.abortDataOpsPlannerRun(activeRun.runId);
      setStatus(t('soc.dataops.backfill_stopped_with_run', { run_id: result?.run_id || activeRun.runId }));
      setActiveRun(null);
      await loadActiveRun();
    } catch (err) {
      setStatus(err.message || t('soc.dataops.backfill_stop_failed'));
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-800 bg-slate-900 p-6">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-lg font-bold text-white">{t('soc.dataops.backfill_center')}</h3>
        <span className="rounded bg-amber-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-100">
          {t('soc.dataops.backfill_context_badge')}
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-400">{t('soc.dataops.backfill_context_purpose')}</p>

      {/* Dataset Checkboxes */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">{t('soc.dataops.backfill_datasets')}</p>
        <div className="flex flex-wrap gap-x-5 gap-y-3">
          {BACKFILL_DATASETS.map(({ key, labelKey, supportedByPlanner }) => (
            <label key={key} className="flex items-start gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.datasets.includes(key)}
                disabled={!supportedByPlanner}
                onChange={() => toggleDataset(key)}
                className="mt-0.5 accent-indigo-500"
              />
              <span>
                <span className={`block text-sm ${supportedByPlanner ? 'text-slate-200' : 'text-slate-500'}`}>
                  {t(labelKey)}
                </span>
                <span className="block text-[11px] text-slate-500">{t(BACKFILL_DATASET_FIELDS[key] || 'soc.dataops.dataset_unknown')}</span>
                {!supportedByPlanner && (
                  <span className="block text-[10px] text-amber-400">{t('soc.dataops.backfill_dataset_coming_soon')}</span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      {activeRun?.runId && (
        <div className="mb-4 rounded border border-amber-700 bg-amber-950/30 p-3 text-xs text-amber-200">
          <p>
            {t('soc.dataops.backfill_active_run_label')}: <span className="font-semibold">{activeRun.runId}</span>
            {' · '}
            {t(RUN_STATUS_LABEL_KEYS[String(activeRun.status || '').toLowerCase()] || 'soc.dataops.run_status_unknown')}
          </p>
          {activeRun?.startedAt && (
            <p className="mt-1 text-amber-300">
              {t('soc.dataops.backfill_started_at')}: {new Date(activeRun.startedAt).toLocaleString()}
            </p>
          )}
          <div className="mt-2">
            <button
              type="button"
              onClick={handleAbortActiveRun}
              disabled={isStopping || !canApply}
              className="rounded bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50"
            >
              {isStopping ? t('soc.dataops.backfill_stopping') : t('soc.dataops.backfill_stop_run')}
            </button>
          </div>
        </div>
      )}

      {/* Symbol Group */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">{t('soc.dataops.backfill_symbol_group')}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {allGroups.map(({ key, label, isCustom }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="symbolGroup"
                value={key}
                checked={form.symbolGroup === key}
                onChange={() => setForm((prev) => ({ ...prev, symbolGroup: key }))}
                className="accent-indigo-500"
              />
              <span className={`text-sm ${isCustom ? 'text-teal-300' : 'text-slate-200'}`}>{label}</span>
            </label>
          ))}
        </div>
        {form.symbolGroup === 'custom' && (
          <input
            type="text"
            value={form.customSymbols}
            onChange={(e) => setForm((prev) => ({ ...prev, customSymbols: e.target.value }))}
            placeholder="VCB, VNM, ..."
            className="mt-2 w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        )}
      </div>

      {/* Date Range + Mode */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('soc.dataops.backfill_from_date')}</label>
          <input
            type="date"
            value={form.fromDate}
            onChange={(e) => setForm((prev) => ({ ...prev, fromDate: e.target.value }))}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('soc.dataops.backfill_to_date')}</label>
          <input
            type="date"
            value={form.toDate}
            onChange={(e) => setForm((prev) => ({ ...prev, toDate: e.target.value }))}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('soc.dataops.backfill_mode')}</label>
          <select
            value={form.mode}
            onChange={(e) => setForm((prev) => ({ ...prev, mode: e.target.value }))}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="missing_only">{t('soc.dataops.backfill_mode_missing_only')}</option>
            <option value="force_refresh">{t('soc.dataops.backfill_mode_force_refresh')}</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1">{t('soc.dataops.backfill_execution')}</label>
          <select
            value={form.executionMode}
            onChange={(e) => setForm((prev) => ({ ...prev, executionMode: e.target.value }))}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          >
            <option value="async">{t('soc.dataops.backfill_exec_async')}</option>
            <option value="sync">{t('soc.dataops.backfill_exec_sync')}</option>
          </select>
        </div>
      </div>

      {/* Dry-run + Run Button */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.dryRun}
            onChange={(e) => setForm((prev) => ({ ...prev, dryRun: e.target.checked }))}
            className="accent-amber-500"
          />
          <span className="text-sm text-amber-300">{t('soc.dataops.backfill_dry_run')}</span>
        </label>
        <button
          type="button"
          onClick={handleRun}
          disabled={isRunning || !canApply || form.datasets.filter((dataset) => PLANNER_SUPPORTED_DATASET_KEYS.has(dataset)).length === 0 || Boolean(activeRun?.runId)}
          className="rounded bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition"
        >
          {isRunning ? t('soc.dataops.backfill_running') : t('soc.dataops.backfill_run')}
        </button>
      </div>

      {status && (
        <p className="mt-3 text-sm text-indigo-300">{status}</p>
      )}
    </div>
  );
};

const TIER_LABEL_KEYS = {
  hot_user_demand: 'soc.dataops.tier_hot_user_demand',
  warm_liquid_market: 'soc.dataops.tier_warm_liquid_market',
  cold_full_market: 'soc.dataops.tier_cold_full_market',
  recovery_backlog: 'soc.dataops.tier_recovery_backlog',
};

const DATASET_LABEL_KEYS = {
  daily_prices: 'soc.dataops.dataset_daily_prices',
  price_board_snapshot: 'soc.dataops.dataset_price_board_snapshot',
  intraday_bars: 'soc.dataops.dataset_intraday_bars',
  intraday_ticks: 'soc.dataops.dataset_intraday_ticks',
  session_facts: 'soc.dataops.dataset_session_facts',
};

const MANUAL_RUN_DATASET_OPTIONS = [
  'daily_prices',
  'price_board_snapshot',
  'intraday_bars',
  'intraday_ticks',
];

const FRESHNESS_LABEL_KEYS = {
  fresh: 'soc.dataops.freshness_fresh',
  warm: 'soc.dataops.freshness_warm',
  stale: 'soc.dataops.freshness_stale',
  missing: 'soc.dataops.freshness_missing',
  error: 'soc.dataops.freshness_error',
  unknown: 'soc.dataops.freshness_unknown',
};

const RUN_STATUS_LABEL_KEYS = {
  queued: 'soc.dataops.run_status_queued',
  running: 'soc.dataops.run_status_running',
  success: 'soc.dataops.run_status_success',
  partial: 'soc.dataops.run_status_partial',
  failed: 'soc.dataops.run_status_failed',
  skipped: 'soc.dataops.run_status_skipped',
};

const NEXT_ACTION_LABEL_KEYS = {
  hydrate_daily_prices: 'soc.dataops.action_hydrate_daily_prices',
  refresh_daily_prices: 'soc.dataops.action_refresh_daily_prices',
  investigate_daily_prices: 'soc.dataops.action_investigate_daily_prices',
  hydrate_price_board_snapshot: 'soc.dataops.action_hydrate_price_board_snapshot',
  refresh_price_board_snapshot: 'soc.dataops.action_refresh_price_board_snapshot',
  investigate_price_board_snapshot: 'soc.dataops.action_investigate_price_board_snapshot',
  hydrate_intraday_bars: 'soc.dataops.action_hydrate_intraday_bars',
  refresh_intraday_bars: 'soc.dataops.action_refresh_intraday_bars',
  investigate_intraday_bars: 'soc.dataops.action_investigate_intraday_bars',
  hydrate_intraday_ticks: 'soc.dataops.action_hydrate_intraday_ticks',
  refresh_intraday_ticks: 'soc.dataops.action_refresh_intraday_ticks',
  investigate_intraday_ticks: 'soc.dataops.action_investigate_intraday_ticks',
  materialize_session_facts: 'soc.dataops.action_materialize_session_facts',
  refresh_session_facts: 'soc.dataops.action_refresh_session_facts',
  investigate_session_facts: 'soc.dataops.action_investigate_session_facts',
};

const COVERAGE_STATE_ORDER = ['fresh', 'warm', 'stale', 'missing', 'error', 'unknown'];
const DEFAULT_RUN_LOGS_ENVELOPE = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};
const DEFAULT_OBSERVABILITY_SUMMARY = {
  backlog: {
    by_dataset: [],
    by_tier: [],
  },
  fail_rates: {
    window_1h: {
      total_runs: 0,
      failed_runs: 0,
      partial_runs: 0,
      fail_rate_pct: 0,
      degraded_rate_pct: 0,
    },
    window_24h: {
      total_runs: 0,
      failed_runs: 0,
      partial_runs: 0,
      fail_rate_pct: 0,
      degraded_rate_pct: 0,
    },
  },
  starvation: [],
  updated_at: null,
};
const DEFAULT_AUDIT_ENVELOPE = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};
const DEFAULT_MANUAL_RUN_FORM = {
  symbolsText: '',
  datasets: ['daily_prices'],
  executionMode: 'async',
  forceRefresh: false,
  reason: '',
};

const CONFIG_LABEL_KEYS = {
  decay_days: 'soc.dataops.decay_days',
  hot_user_demand: 'soc.dataops.tier_hot_user_demand',
  warm_liquid_market: 'soc.dataops.tier_warm_liquid_market',
  cold_full_market: 'soc.dataops.tier_cold_full_market',
  recovery_backlog: 'soc.dataops.tier_recovery_backlog',
};

const hasTierRuntimeChange = (before, after) => {
  const tierNames = ['hot_user_demand', 'warm_liquid_market', 'cold_full_market', 'recovery_backlog'];
  return tierNames.some((tierName) => {
    const previousTier = before?.[tierName] || {};
    const nextTier = after?.[tierName] || {};
    return (
      Number(previousTier.poll_interval_seconds || 0) !== Number(nextTier.poll_interval_seconds || 0)
      || Number(previousTier.max_batch_size || 0) !== Number(nextTier.max_batch_size || 0)
    );
  });
};

const buildChangeSummary = (before, after, t) => Object.entries(CONFIG_LABEL_KEYS)
  .filter(([key]) => JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key]))
  .map(([, translationKey]) => t(translationKey));

const buildImpactWarnings = (before, after, t) => {
  const warnings = [];

  if (hasTierRuntimeChange(before, after)) {
    warnings.push(t('soc.dataops.preview_runtime_warning'));
  }

  if (JSON.stringify(before?.recovery_backlog) !== JSON.stringify(after?.recovery_backlog)) {
    warnings.push(t('soc.dataops.preview_recovery_warning'));
  }

  return warnings;
};

const getNextActionLabelKey = (nextAction) => NEXT_ACTION_LABEL_KEYS[nextAction] || 'soc.dataops.action_unknown';

const parseSymbolsInput = (symbolsText) => {
  const uniqueSymbols = [];
  const seenSymbols = new Set();
  String(symbolsText || '')
    .split(/[\s,]+/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean)
    .forEach((symbol) => {
      if (seenSymbols.has(symbol)) {
        return;
      }
      seenSymbols.add(symbol);
      uniqueSymbols.push(symbol);
    });
  return uniqueSymbols;
};

const buildPlannerPayload = (manualRunForm, { forPreview = false } = {}) => ({
  symbols: parseSymbolsInput(manualRunForm.symbolsText),
  datasets: [...(manualRunForm.datasets || [])],
  mode: 'missing_only',
  force_refresh: Boolean(manualRunForm.forceRefresh),
  execution_mode: manualRunForm.executionMode || 'async',
  reason: String(manualRunForm.reason || '').trim() || (forPreview ? 'manual_preview' : 'operator_manual_run'),
});

// ─── Matrix "Snapshot Trực tiếp" utilities (inlined from MatrixPanel) ────────
const ACTIVE_MATRIX_STATUSES = new Set(['active', 'completing']);
const DEFAULT_MATRIX_SYMBOL_GROUPS = [
  { id: 'top100', name: 'Top 100' },
  { id: 'vn30', name: 'VN30' },
];
// Danh sách nhóm mã mà backend hỗ trợ cho Matrix cycle (predefined + custom)
const MATRIX_SYMBOL_GROUPS_OPTIONS = [
  { id: 'vn30',  name: 'VN30',  type: 'index' },
  { id: 'vn50',  name: 'VN50',  type: 'index' },
  { id: 'vn100', name: 'VN100', type: 'index' },
  { id: 'hose',  name: 'HOSE',  type: 'exchange' },
  { id: 'hnx',   name: 'HNX',   type: 'exchange' },
  { id: 'upcom', name: 'UPCOM', type: 'exchange' },
];
const MATRIX_POLL_MS = 5000;

const normalizeMatrixSymbolGroups = (symbolGroups) => {
  const groups = Array.isArray(symbolGroups) ? symbolGroups : [];
  const normalized = groups
    .map((g) => {
      const gId = String(g?.id || '').trim();
      return gId ? { id: gId, name: String(g?.name || gId).trim() } : null;
    })
    .filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_MATRIX_SYMBOL_GROUPS;
};

const getMatrixReadyProviderIds = (providerList) =>
  providerList.filter((p) => p.runtime_ready).map((p) => p.provider);

const getMatrixSelectedProviders = (providerList, monitorProviders, monitorStatus) => {
  const readyIds = getMatrixReadyProviderIds(providerList);
  if (ACTIVE_MATRIX_STATUSES.has(monitorStatus)) {
    const active = (monitorProviders || []).filter((id) => readyIds.includes(id));
    if (active.length > 0) return active;
  }
  const defaults = providerList
    .filter((p) => p.default_selected && p.runtime_ready)
    .map((p) => p.provider);
  return defaults.length > 0 ? defaults : readyIds;
};

const getMatrixStatusLabel = (status, t) => {
  const keys = {
    idle: 'soc.matrix.status_idle',
    active: 'soc.matrix.status_active',
    completing: 'soc.matrix.status_completing',
    completed: 'soc.matrix.status_completed',
    aborted: 'soc.matrix.status_aborted',
  };
  return keys[status] ? t(keys[status]) : status;
};

const getMatrixStatusTone = (status) => {
  const tones = {
    idle: 'bg-slate-800 text-slate-200',
    active: 'bg-sky-900 text-sky-200',
    completing: 'bg-amber-900 text-amber-200',
    completed: 'bg-emerald-900 text-emerald-200',
    aborted: 'bg-rose-900 text-rose-200',
  };
  return tones[status] || tones.idle;
};
// ─────────────────────────────────────────────────────────────────────────────

const DataOpsPanel = ({ t }) => {
  const [queueSnapshot, setQueueSnapshot] = useState({ tiers: [], updated_at: null });
  const [coverageSummary, setCoverageSummary] = useState({ datasets: [], top_gaps: [], updated_at: null });
  const [observabilitySummary, setObservabilitySummary] = useState(DEFAULT_OBSERVABILITY_SUMMARY);
  const [runtimeEnvelope, setRuntimeEnvelope] = useState({ config: {}, ownership: null, updated_at: null });
  const [runLogsEnvelope, setRunLogsEnvelope] = useState(DEFAULT_RUN_LOGS_ENVELOPE);
  const [runLogsPage, setRunLogsPage] = useState(1);
  const [auditEnvelope, setAuditEnvelope] = useState(DEFAULT_AUDIT_ENVELOPE);
  const [auditPage, setAuditPage] = useState(1);
  const [manualRunForm, setManualRunForm] = useState(DEFAULT_MANUAL_RUN_FORM);
  const [plannerPreview, setPlannerPreview] = useState(null);
  const [plannerRunResult, setPlannerRunResult] = useState(null);
  const [draftJson, setDraftJson] = useState('{}');
  const [previewConfig, setPreviewConfig] = useState(null);
  const [previewValidationErrors, setPreviewValidationErrors] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfigPreviewing, setIsConfigPreviewing] = useState(false);
  const [isRunLogsLoading, setIsRunLogsLoading] = useState(false);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [isPlannerPreviewing, setIsPlannerPreviewing] = useState(false);
  const [isPlannerRunning, setIsPlannerRunning] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // ── Matrix "Snapshot Trực tiếp" state ──────────────────────────────────────
  const [matrixCycleId, setMatrixCycleId] = useState('');
  const [matrixProviders, setMatrixProviders] = useState([]);
  const [matrixSelectedProviders, setMatrixSelectedProviders] = useState([]);
  const [matrixSymbolGroups, setMatrixSymbolGroups] = useState(DEFAULT_MATRIX_SYMBOL_GROUPS);
  const [matrixSelectedGroups, setMatrixSelectedGroups] = useState(['vn30', 'vn100']);
  const [matrixStatus, setMatrixStatus] = useState('idle');
  const [matrixError, setMatrixError] = useState(null);
  const [matrixLoading, setMatrixLoading] = useState(true);
  // ── Custom Symbol Groups state ──────────────────────────────────────────────
  const [customGroups, setCustomGroups] = useState([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({ name: '', symbolsText: '', description: '' });
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupManagerError, setGroupManagerError] = useState(null);
  // ── Data Inventory state ────────────────────────────────────────────────────
  const [inventory, setInventory] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  // ── UI accordion / toggle state ─────────────────────────────────────────────
  const [subTab, setSubTab] = useState('data');
  const [showQueueTier, setShowQueueTier] = useState(false);
  const [showRunHistory, setShowRunHistory] = useState(false);
  const [gapsPage, setGapsPage] = useState(1);
  const [plannerItemsPage, setPlannerItemsPage] = useState(1);
  const [plannerSkippedPage, setPlannerSkippedPage] = useState(1);
  const [plannerItemsExpanded, setPlannerItemsExpanded] = useState(false);
  const [plannerSkippedExpanded, setPlannerSkippedExpanded] = useState(false);
  // ──────────────────────────────────────────────────────────────────────────────

  const loadData = async (page = runLogsPage) => {
    try {
      setLoading(true);
      const [
        tiersPayload,
        runtimePayload,
        coveragePayload,
        observabilityPayload,
        runLogsPayload,
        auditPayload,
        matrixMonitor,
        matrixProviderPayload,
        symbolGroupsPayload,
      ] = await Promise.all([
        socApi.getDataOpsQueueTiers(),
        socApi.getDataOpsRuntimeConfig(),
        socApi.getDataOpsCoverage(),
        socApi.getDataOpsObservability(),
        socApi.getDataOpsRunLogs(page),
        socApi.getDataOpsRuntimeConfigAudit(1),
        socApi.getMatrixMonitor().catch(() => ({ status: 'idle', cycle_id: '', providers: [], symbol_groups: [] })),
        socApi.getMatrixProviders().catch(() => ({ providers: [] })),
        socApi.getSymbolGroups().catch(() => ({ predefined: [], custom: [] })),
      ]);
      // Inventory loads separately (can be slow) — fire-and-forget
      setInventoryLoading(true);
      socApi.getDataOpsInventory().then((inv) => { setInventory(inv); setInventoryLoading(false); }).catch(() => setInventoryLoading(false));
      setQueueSnapshot(tiersPayload || { tiers: [], updated_at: null });
      setRuntimeEnvelope(runtimePayload || { config: {}, ownership: null, updated_at: null });
      setCoverageSummary(coveragePayload || { datasets: [], top_gaps: [], updated_at: null });
      setObservabilitySummary(observabilityPayload || DEFAULT_OBSERVABILITY_SUMMARY);
      setRunLogsEnvelope(runLogsPayload || DEFAULT_RUN_LOGS_ENVELOPE);
      setRunLogsPage(page);
      setAuditEnvelope(auditPayload || DEFAULT_AUDIT_ENVELOPE);
      setAuditPage(1);
      setDraftJson(JSON.stringify(runtimePayload?.config || {}, null, 2));
      setCustomGroups(symbolGroupsPayload?.custom || []);
      // Matrix context
      const providerList = matrixProviderPayload.providers || [];
      const monitorProviders = Array.isArray(matrixMonitor.providers) ? matrixMonitor.providers : [];
      const nextMatrixStatus = matrixMonitor.status || 'idle';
      setMatrixProviders(providerList);
      setMatrixCycleId(ACTIVE_MATRIX_STATUSES.has(nextMatrixStatus) ? (matrixMonitor.cycle_id || '') : '');
      setMatrixStatus(nextMatrixStatus);
      setMatrixSymbolGroups(normalizeMatrixSymbolGroups(matrixMonitor.symbol_groups));
      setMatrixSelectedProviders(getMatrixSelectedProviders(providerList, monitorProviders, nextMatrixStatus));
      setMatrixLoading(false);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(1);
  }, []);

  useEffect(() => {
    setPlannerItemsPage(1);
    setPlannerSkippedPage(1);
    setPlannerItemsExpanded(false);
    setPlannerSkippedExpanded(false);
  }, [plannerPreview]);

  const handleRunLogsPageChange = async (page) => {
    try {
      setIsRunLogsLoading(true);
      const runLogsPayload = await socApi.getDataOpsRunLogs(page);
      setRunLogsEnvelope(runLogsPayload || DEFAULT_RUN_LOGS_ENVELOPE);
      setRunLogsPage(page);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunLogsLoading(false);
    }
  };

  // ── Matrix cycle handlers ────────────────────────────────────────────────────
  const handleMatrixStartCycle = async () => {
    if (matrixSelectedProviders.length === 0) {
      setMatrixError(t('soc.matrix.no_provider_selected'));
      return;
    }
    try {
      setMatrixError(null);
      const data = await socApi.startMatrixCycle({
        providers: matrixSelectedProviders,
        symbol_group_ids: matrixSelectedGroups,
      });
      setMatrixCycleId(data.cycle_id || '');
      setMatrixStatus(data.status || 'active');
      setMatrixSelectedProviders(Array.isArray(data.providers) ? data.providers : matrixSelectedProviders);
      setMatrixSymbolGroups(normalizeMatrixSymbolGroups(data.symbol_groups));
    } catch (err) {
      setMatrixError(err.message);
    }
  };

  const handleMatrixAbortCycle = async () => {
    if (!matrixCycleId) return;
    try {
      setMatrixError(null);
      const data = await socApi.abortMatrixCycle(matrixCycleId);
      setMatrixStatus(data.status || 'aborted');
    } catch (err) {
      setMatrixError(err.message);
    }
  };

  const handleMatrixCycleComplete = (snapshot) => {
    setMatrixStatus(snapshot.status || 'completed');
    if (snapshot.cycle_id) setMatrixCycleId(snapshot.cycle_id);
    if (snapshot.symbol_groups) setMatrixSymbolGroups(normalizeMatrixSymbolGroups(snapshot.symbol_groups));
  };

  const handleMatrixProviderToggle = (providerId) => {
    if (ACTIVE_MATRIX_STATUSES.has(matrixStatus)) return;
    setMatrixSelectedProviders((prev) =>
      prev.includes(providerId) ? prev.filter((id) => id !== providerId) : [...prev, providerId],
    );
  };

  const handleMatrixGroupToggle = (groupId) => {
    if (ACTIVE_MATRIX_STATUSES.has(matrixStatus)) return;
    setMatrixSelectedGroups((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId],
    );
  };
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Custom Symbol Group CRUD handlers ────────────────────────────────────────
  const handleCreateGroup = async () => {
    const name = newGroupForm.name.trim();
    if (!name) { setGroupManagerError('Tên nhóm không được để trống.'); return; }
    const symbols = newGroupForm.symbolsText
      .split(/[\s,]+/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
    if (symbols.length === 0) { setGroupManagerError('Cần ít nhất 1 mã cổ phiếu.'); return; }
    try {
      setIsCreatingGroup(true);
      setGroupManagerError(null);
      const created = await socApi.createSymbolGroup({
        name,
        description: newGroupForm.description.trim(),
        symbols,
      });
      setCustomGroups((prev) => [...prev, created]);
      setNewGroupForm({ name: '', symbolsText: '', description: '' });
    } catch (err) {
      setGroupManagerError(err.message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleDeleteGroup = async (slug) => {
    try {
      setGroupManagerError(null);
      await socApi.deleteSymbolGroup(slug);
      setCustomGroups((prev) => prev.filter((g) => g.slug !== slug));
      // Deselect from matrix if it was selected
      setMatrixSelectedGroups((prev) => prev.filter((id) => id !== `custom_${slug}`));
    } catch (err) {
      setGroupManagerError(err.message);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────────

  const updateManualRunForm = (updater) => {
    setManualRunForm((currentValue) => {
      const nextValue = typeof updater === 'function' ? updater(currentValue) : updater;
      return nextValue;
    });
    setPlannerPreview(null);
    setPlannerRunResult(null);
    setError(null);
    setSuccessMessage(null);
  };

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(draftJson);
      setIsConfigPreviewing(true);
      setPreviewValidationErrors(null);
      setError(null);
      setSuccessMessage(null);
      socApi.previewDataOpsRuntimeConfig(parsed)
        .then((previewPayload) => {
          const nextConfig = previewPayload?.projected_config || parsed;
          const nextValidationErrors = Array.isArray(previewPayload?.validation_errors) && previewPayload.validation_errors.length > 0
            ? { config_payload: previewPayload.validation_errors }
            : null;
          setPreviewConfig(nextConfig);
          setPreviewValidationErrors(nextValidationErrors);
          setPreviewOpen(true);
        })
        .catch((err) => {
          setError(err.message);
        })
        .finally(() => {
          setIsConfigPreviewing(false);
        });
    } catch {
      setError(t('soc.dataops.invalid_json'));
    }
  };

  const handleApply = async () => {
    if (!previewConfig) {
      return;
    }

    try {
      setIsSubmitting(true);
      const appliedPayload = await socApi.applyDataOpsRuntimeConfig(previewConfig);
      setRuntimeEnvelope(appliedPayload || { config: {}, ownership: null, updated_at: null });
      setDraftJson(JSON.stringify(appliedPayload?.config || {}, null, 2));
      setSuccessMessage(t('soc.dataops.apply_success'));
      setPreviewOpen(false);
      setPreviewConfig(null);
      setPreviewValidationErrors(null);
      setError(null);

      const [tiersPayload, auditPayload] = await Promise.all([
        socApi.getDataOpsQueueTiers(),
        socApi.getDataOpsRuntimeConfigAudit(1),
      ]);
      setQueueSnapshot(tiersPayload || { tiers: [], updated_at: null });
      setAuditEnvelope(auditPayload || DEFAULT_AUDIT_ENVELOPE);
      setAuditPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuditPageChange = async (page) => {
    try {
      setIsAuditLoading(true);
      const auditPayload = await socApi.getDataOpsRuntimeConfigAudit(page);
      setAuditEnvelope(auditPayload || DEFAULT_AUDIT_ENVELOPE);
      setAuditPage(page);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAuditLoading(false);
    }
  };

  const handlePlannerPreview = async () => {
    try {
      setIsPlannerPreviewing(true);
      const previewPayload = await socApi.previewDataOpsPlanner(buildPlannerPayload(manualRunForm, { forPreview: true }));
      setPlannerPreview(previewPayload);
      setPlannerRunResult(null);
      setError(null);
      setSuccessMessage(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPlannerPreviewing(false);
    }
  };

  const handlePlannerRun = async () => {
    try {
      setIsPlannerRunning(true);
      const runPayload = await socApi.runDataOpsPlanner(buildPlannerPayload(manualRunForm));
      setPlannerRunResult(runPayload);
      setError(null);
      setSuccessMessage(`${t('soc.dataops.planner_run_success')} ${runPayload.run_id || ''}`.trim());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsPlannerRunning(false);
    }
  };

  const totalSymbols = (queueSnapshot.tiers || []).reduce(
    (sum, tier) => sum + Number(tier.symbol_count || 0),
    0,
  );
  const currentConfig = runtimeEnvelope.config || {};
  const ownership = runtimeEnvelope.ownership;
  const lastUpdated = runtimeEnvelope.updated_at || queueSnapshot.updated_at || t('common.notAvailable');
  const coverageUpdatedAt = coverageSummary.updated_at || t('common.notAvailable');

  if (loading) {
    return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{t('soc.dataops.title')}</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-400">{t('soc.dataops.description')}</p>
        </div>
        <button
          type="button"
          onClick={() => loadData(runLogsPage)}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700"
        >
          {t('soc.dataops.refresh')}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900 p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-emerald-700 bg-emerald-950/50 p-4">
          <p className="text-emerald-200">{successMessage}</p>
        </div>
      )}

      {ownership?.write_block_reason && (
        <WriteGuardBanner
          reason={ownership.write_block_reason || t('soc.dataops.write_guard_reason')}
          writer={ownership.writer || ownership.owner_team}
          writeSurface={ownership.write_surface}
          t={t}
        />
      )}

      {/* ── Sub-tab nav ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-slate-800/50 p-1">
        {DATAOPS_SUB_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 min-w-max rounded px-4 py-2 text-sm font-semibold transition ${
              subTab === tab.id
                ? 'bg-slate-700 text-white shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Kho dữ liệu ─────────────────────────────────────────────── */}
      {subTab === 'data' && (
        <>
          <DataInventorySection inventory={inventory} loading={inventoryLoading} />
        </>
      )}

      {/* ── Tab: Điều phối ───────────────────────────────────────────────── */}
      {subTab === 'ops' && (
        <>
          <BackfillCenterSection t={t} canApply={!ownership?.write_block_reason} customGroups={customGroups} />
        </>
      )}

      {/* ── Snapshot Trực tiếp (Matrix) — Tab: Giám sát ─────────────────── */}
      {subTab === 'monitor' && (
      <div className="rounded-lg border border-indigo-800 bg-slate-900 p-6">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{t('soc.dataops.live_snapshot_title')}</h3>
              <span className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100">
                {t('soc.dataops.snapshot_context_badge')}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.live_snapshot_description')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getMatrixStatusTone(matrixStatus)}`}>
              {getMatrixStatusLabel(matrixStatus, t)}
            </span>
            {ACTIVE_MATRIX_STATUSES.has(matrixStatus) ? (
              <button
                type="button"
                onClick={handleMatrixAbortCycle}
                className="rounded border border-rose-700 bg-rose-950/60 px-4 py-2 text-sm font-semibold text-rose-200 transition hover:bg-rose-900/80"
              >
                {t('soc.matrix.abort_cycle')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleMatrixStartCycle}
                disabled={matrixLoading || matrixSelectedProviders.length === 0}
                className="rounded border border-indigo-600 bg-indigo-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('soc.matrix.start_cycle')}
              </button>
            )}
          </div>
        </div>

        {/* Operational context: fields / scope / time constraint */}
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-slate-700 bg-slate-800/50 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t('soc.dataops.snapshot_context_fields_label')}
            </p>
            <p className="text-xs leading-5 text-slate-300">
              {t('soc.dataops.snapshot_context_fields_value')}
            </p>
          </div>
          <div className="rounded border border-indigo-800/50 bg-slate-800/50 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-indigo-400">
              {t('soc.dataops.snapshot_context_scope_label')}
            </p>
            <div className="flex flex-wrap gap-1">
              {[
                ...MATRIX_SYMBOL_GROUPS_OPTIONS,
                ...customGroups.map((g) => ({ id: g.group_id, name: g.name, type: 'custom' })),
              ].map((g) => {
                const isSelected = matrixSelectedGroups.includes(g.id);
                const isActive = ACTIVE_MATRIX_STATUSES.has(matrixStatus);
                const isExchange = g.type === 'exchange';
                const isCustom = g.type === 'custom';
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={isActive}
                    onClick={() => handleMatrixGroupToggle(g.id)}
                    className={`rounded-full border px-2 py-0.5 text-xs font-semibold transition ${
                      isSelected
                        ? isCustom
                          ? 'border-teal-500 bg-teal-700 text-teal-100'
                          : isExchange
                            ? 'border-teal-600 bg-teal-800 text-teal-100'
                            : 'border-indigo-600 bg-indigo-800 text-indigo-100'
                        : 'border-slate-600 bg-slate-900 text-slate-400 hover:border-indigo-500 hover:text-indigo-200'
                    } ${isActive ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                  >
                    {isCustom ? `★ ${g.name}` : g.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded border border-amber-800/40 bg-amber-950/20 p-3">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
              {t('soc.dataops.snapshot_context_time_label')}
            </p>
            <p className="text-xs font-semibold text-amber-200">
              {t('soc.dataops.snapshot_context_time_value')}
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              {t('soc.dataops.snapshot_context_time_warn')}
            </p>
          </div>
        </div>

        {/* F3: Manual operation note */}
        <p className="mb-4 text-[11px] text-slate-500">
          {t('soc.dataops.snapshot_manual_note')}
        </p>

        {matrixError && (
          <div className="mb-4 rounded-lg border border-red-700 bg-red-900/50 p-3 text-sm text-red-200">
            {matrixError}
          </div>
        )}

        {/* Provider selection */}
        {!matrixLoading && (
          <div className="mb-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t('soc.matrix.providers')}
            </p>
            <div className="flex flex-wrap gap-2">
              {matrixProviders.map((provider) => {
                const isSelected = matrixSelectedProviders.includes(provider.provider);
                const isActive = ACTIVE_MATRIX_STATUSES.has(matrixStatus);
                return (
                  <button
                    key={provider.provider}
                    type="button"
                    disabled={!provider.runtime_ready || isActive}
                    onClick={() => handleMatrixProviderToggle(provider.provider)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      !provider.runtime_ready
                        ? 'cursor-not-allowed border-slate-700 bg-slate-900 text-slate-500'
                        : isSelected
                          ? 'border-indigo-600 bg-indigo-800 text-indigo-100'
                          : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-indigo-600 hover:text-indigo-200'
                    }`}
                  >
                    {provider.provider}
                    {!provider.runtime_ready && (
                      <span className="ml-1 opacity-60">✕</span>
                    )}
                  </button>
                );
              })}
              {matrixProviders.length === 0 && (
                <p className="text-sm text-slate-500">{t('soc.matrix.no_providers')}</p>
              )}
            </div>
          </div>
        )}

        {/* Heatmap monitor — centerpiece */}
        <MatrixScrapeMonitor
          cycleId={matrixCycleId}
          pollIntervalMs={MATRIX_POLL_MS}
          onCycleComplete={handleMatrixCycleComplete}
          t={t}
        />
      </div>
      )} {/* end subTab === 'monitor' — matrix */}

      {/* ── Tab: Kho dữ liệu — stats grid + Queue Tiers ─────────────────── */}
      {subTab === 'data' && (
      <>
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t('soc.dataops.total_symbols')}</p>
          <p className="mt-2 text-3xl font-bold text-white">{totalSymbols}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t('soc.dataops.queue_tiers')}</p>
          <p className="mt-2 text-3xl font-bold text-white">{(queueSnapshot.tiers || []).length}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t('soc.dataops.decay_days')}</p>
          <p className="mt-2 text-3xl font-bold text-white">{currentConfig.decay_days ?? t('common.notAvailable')}</p>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">{t('soc.dataops.last_updated')}</p>
          <p className="mt-2 text-sm font-semibold text-slate-100">{lastUpdated}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <button
          type="button"
          onClick={() => setShowQueueTier((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-6 text-left"
        >
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.queue_tiers')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.queue_tiers_description')}</p>
          </div>
          <span className="text-slate-400 transition-transform" style={{ transform: showQueueTier ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </button>
        {showQueueTier && (
          <div className="px-6 pb-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {(queueSnapshot.tiers || []).map((tier) => (
                <div key={tier.tier} className="rounded-lg border border-slate-700 bg-slate-950/80 p-4">
                  <p className="text-sm font-semibold text-white">{t(TIER_LABEL_KEYS[tier.tier] || 'soc.dataops.unknown_tier')}</p>
                  <dl className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-400">{t('soc.dataops.symbol_count')}</dt>
                      <dd className="font-semibold text-slate-100">{tier.symbol_count}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-400">{t('soc.dataops.poll_interval')}</dt>
                      <dd className="font-semibold text-slate-100">{tier.poll_interval_seconds}s</dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-slate-400">{t('soc.dataops.max_batch_size')}</dt>
                      <dd className="font-semibold text-slate-100">{tier.max_batch_size}</dd>
                    </div>
                  </dl>
                  <div className="mt-4 border-t border-slate-800 pt-4">
                    <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.examples')}</p>
                    <div className="flex flex-wrap gap-2">
                      {(tier.examples || []).length > 0 ? (
                        tier.examples.map((symbol) => (
                          <span key={symbol} className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200">
                            {symbol}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">{t('soc.dataops.empty_examples')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </> )} {/* end subTab === 'data' */}

      {/* ── Tab: Giám sát — Coverage ─────────────────────────────────────── */}
      {subTab === 'monitor' && (
      <>
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.observability_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.observability_description')}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.observability_updated_at')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {observabilitySummary?.updated_at ? new Date(observabilitySummary.updated_at).toLocaleString() : t('common.notAvailable')}
            </p>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          {[
            {
              key: 'window_1h',
              titleKey: 'soc.dataops.fail_rate_1h',
            },
            {
              key: 'window_24h',
              titleKey: 'soc.dataops.fail_rate_24h',
            },
          ].map((windowConfig) => {
            const windowData = observabilitySummary?.fail_rates?.[windowConfig.key] || {};
            return (
              <div key={windowConfig.key} className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-400">{t(windowConfig.titleKey)}</p>
                <p className="mt-2 text-2xl font-bold text-white">{Number(windowData.fail_rate_pct || 0).toFixed(2)}%</p>
                <p className="mt-1 text-xs text-slate-400">
                  {t('soc.dataops.fail_rate_runs', {
                    failed: Number(windowData.failed_runs || 0),
                    total: Number(windowData.total_runs || 0),
                  })}
                </p>
                <p className="mt-1 text-xs text-amber-300">
                  {t('soc.dataops.degraded_rate_pct', {
                    rate: Number(windowData.degraded_rate_pct || 0).toFixed(2),
                    partial: Number(windowData.partial_runs || 0),
                  })}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,1fr)]">
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold text-white">{t('soc.dataops.backlog_by_dataset')}</h4>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-4">{t('soc.dataops.dataset')}</th>
                    <th className="py-2 text-right">{t('soc.dataops.backlog_count')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(observabilitySummary?.backlog?.by_dataset || []).map((item) => (
                    <tr key={item.dataset}>
                      <td className="py-2 pr-4 text-slate-200">{t(DATASET_LABEL_KEYS[item.dataset] || 'soc.dataops.dataset_unknown')}</td>
                      <td className="py-2 text-right font-mono text-slate-100">{Number(item.backlog_count || 0)}</td>
                    </tr>
                  ))}
                  {(observabilitySummary?.backlog?.by_dataset || []).length === 0 && (
                    <tr>
                      <td colSpan={2} className="py-4 text-center text-xs text-slate-500">{t('soc.dataops.no_backlog')}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold text-white">{t('soc.dataops.starvation_indicator')}</h4>
            <div className="mt-3 space-y-2">
              {(observabilitySummary?.starvation || []).map((item) => {
                const isStarved = Boolean(item.is_starved);
                const secondsSince = item.seconds_since_last_progress;
                return (
                  <div key={item.tier} className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">{t(TIER_LABEL_KEYS[item.tier] || 'soc.dataops.unknown_tier')}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t('soc.dataops.starvation_last_progress_seconds', {
                            seconds: secondsSince == null ? '-' : Number(secondsSince || 0),
                            threshold: Number(item.threshold_seconds || 0),
                          })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${isStarved ? 'bg-rose-900 text-rose-200' : 'bg-emerald-900 text-emerald-200'}`}>
                        {isStarved ? t('soc.dataops.starved_yes') : t('soc.dataops.starved_no')}
                      </span>
                    </div>
                  </div>
                );
              })}
              {(observabilitySummary?.starvation || []).length === 0 && (
                <p className="text-xs text-slate-500">{t('soc.dataops.no_starvation_data')}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-slate-700 bg-slate-950/70 p-4">
          <h4 className="text-sm font-semibold text-white">{t('soc.dataops.backlog_by_tier')}</h4>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">{t('soc.dataops.queue_tier')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.dataops.symbol_count')}</th>
                  <th className="px-3 py-2 text-right">{t('soc.dataops.backlog_symbols')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(observabilitySummary?.backlog?.by_tier || []).map((item) => (
                  <tr key={item.tier}>
                    <td className="py-2 pr-4 text-slate-200">{t(TIER_LABEL_KEYS[item.tier] || 'soc.dataops.unknown_tier')}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-100">{Number(item.symbol_count || 0)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-100">{Number(item.backlog_symbols || 0)}</td>
                  </tr>
                ))}
                {(observabilitySummary?.backlog?.by_tier || []).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-4 text-center text-xs text-slate-500">{t('soc.dataops.no_backlog')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.coverage_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.coverage_description')}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.coverage_updated_at')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{coverageUpdatedAt}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
          {/* Coverage compact table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-4">Dataset</th>
                  {COVERAGE_STATE_ORDER.map((stateKey) => (
                    <th key={stateKey} className="px-3 py-2 text-center">
                      {t(FRESHNESS_LABEL_KEYS[stateKey] || 'soc.dataops.freshness_unknown')}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {(coverageSummary.datasets || []).map((dataset) => (
                  <tr key={dataset.dataset} className="align-middle">
                    <td className="py-3 pr-4 font-semibold text-slate-200">
                      {t(DATASET_LABEL_KEYS[dataset.dataset] || 'soc.dataops.dataset_unknown')}
                    </td>
                    {COVERAGE_STATE_ORDER.map((stateKey) => (
                      <td key={stateKey} className="px-3 py-3 text-center font-mono text-slate-300">
                        {Number(dataset[stateKey] || 0)}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-center font-mono font-semibold text-slate-100">
                      {COVERAGE_STATE_ORDER.reduce((sum, stateKey) => sum + Number(dataset[stateKey] || 0), 0)}
                    </td>
                  </tr>
                ))}
                {(coverageSummary.datasets || []).length === 0 && (
                  <tr>
                    <td colSpan={COVERAGE_STATE_ORDER.length + 2} className="py-6 text-center text-sm text-slate-500">
                      {t('soc.dataops.no_top_gaps')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top gaps — paginated */}
          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold text-white">{t('soc.dataops.top_gaps')}</h4>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.top_gaps_description')}</p>

            {(coverageSummary.top_gaps || []).length > 0 ? (
              <>
                <ul className="mt-4 space-y-2">
                  {(coverageSummary.top_gaps || [])
                    .slice((gapsPage - 1) * GAPS_PAGE_SIZE, gapsPage * GAPS_PAGE_SIZE)
                    .map((gap) => (
                    <li key={`${gap.symbol}-${gap.dataset}`} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{gap.symbol}</p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {t(DATASET_LABEL_KEYS[gap.dataset] || 'soc.dataops.dataset_unknown')}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-700/60 bg-amber-950/60 px-2 py-1 text-xs font-semibold text-amber-200">
                          {t(FRESHNESS_LABEL_KEYS[gap.freshness_state] || 'soc.dataops.freshness_unknown')}
                        </span>
                      </div>
                      {gap.next_recommended_action ? (
                        <p className="mt-2 text-xs text-slate-300">
                          {t('soc.dataops.next_action')}: {t(getNextActionLabelKey(gap.next_recommended_action))}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {(coverageSummary.top_gaps || []).length > GAPS_PAGE_SIZE && (
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500">
                      Trang {gapsPage} / {Math.ceil((coverageSummary.top_gaps || []).length / GAPS_PAGE_SIZE)}
                      {' '}· {(coverageSummary.top_gaps || []).length} mục
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setGapsPage((p) => Math.max(1, p - 1))}
                        disabled={gapsPage <= 1}
                        className="rounded border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                      >← Trước</button>
                      <button
                        type="button"
                        onClick={() => setGapsPage((p) => Math.min(Math.ceil((coverageSummary.top_gaps || []).length / GAPS_PAGE_SIZE), p + 1))}
                        disabled={gapsPage >= Math.ceil((coverageSummary.top_gaps || []).length / GAPS_PAGE_SIZE)}
                        className="rounded border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                      >Tiếp →</button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">{t('soc.dataops.no_top_gaps')}</p>
            )}
          </div>
        </div>
      </div>
      </> )} {/* end subTab === 'monitor' — coverage */}

      {/* ── Tab: Điều phối — Planner ─────────────────────────────────────── */}
      {subTab === 'ops' && (
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.planner_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.planner_description')}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.planner_policy')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{t('soc.dataops.planner_mode_missing_only')}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(340px,1fr)]">
          <div className="space-y-4">
            <div>
              <label htmlFor="soc-dataops-planner-symbols" className="mb-2 block text-sm font-medium text-slate-200">
                {t('soc.dataops.planner_symbols')}
              </label>
              <textarea
                id="soc-dataops-planner-symbols"
                value={manualRunForm.symbolsText}
                onChange={(event) => {
                  updateManualRunForm((currentValue) => ({
                    ...currentValue,
                    symbolsText: event.target.value,
                  }));
                }}
                rows={4}
                spellCheck={false}
                placeholder={t('soc.dataops.planner_symbols_placeholder')}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200 outline-none transition focus:border-emerald-500"
              />
              <p className="mt-2 text-xs text-slate-500">{t('soc.dataops.planner_symbols_hint')}</p>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-slate-200">{t('soc.dataops.planner_datasets')}</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {MANUAL_RUN_DATASET_OPTIONS.map((dataset) => {
                  const checked = manualRunForm.datasets.includes(dataset);
                  return (
                    <label key={dataset} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          updateManualRunForm((currentValue) => ({
                            ...currentValue,
                            datasets: checked
                              ? currentValue.datasets.filter((item) => item !== dataset)
                              : [...currentValue.datasets, dataset],
                          }));
                        }}
                        className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>{t(DATASET_LABEL_KEYS[dataset] || 'soc.dataops.dataset_unknown')}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="soc-dataops-planner-execution-mode" className="mb-2 block text-sm font-medium text-slate-200">
                  {t('soc.dataops.planner_execution_mode')}
                </label>
                <select
                  id="soc-dataops-planner-execution-mode"
                  value={manualRunForm.executionMode}
                  onChange={(event) => {
                    updateManualRunForm((currentValue) => ({
                      ...currentValue,
                      executionMode: event.target.value,
                    }));
                  }}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-emerald-500"
                >
                  <option value="async">{t('soc.dataops.planner_execution_mode_async')}</option>
                  <option value="sync">{t('soc.dataops.planner_execution_mode_sync')}</option>
                </select>
              </div>

              <div>
                <label htmlFor="soc-dataops-planner-reason" className="mb-2 block text-sm font-medium text-slate-200">
                  {t('soc.dataops.planner_reason')}
                </label>
                <input
                  id="soc-dataops-planner-reason"
                  type="text"
                  value={manualRunForm.reason}
                  onChange={(event) => {
                    updateManualRunForm((currentValue) => ({
                      ...currentValue,
                      reason: event.target.value,
                    }));
                  }}
                  placeholder={t('soc.dataops.planner_reason_placeholder')}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-200 outline-none transition focus:border-emerald-500"
                />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={manualRunForm.forceRefresh}
                onChange={(event) => {
                  updateManualRunForm((currentValue) => ({
                    ...currentValue,
                    forceRefresh: event.target.checked,
                  }));
                }}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              <span>
                <span className="font-medium text-slate-100">{t('soc.dataops.planner_force_refresh')}</span>
                <span className="mt-1 block text-xs text-slate-500">{t('soc.dataops.planner_force_refresh_hint')}</span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handlePlannerPreview}
                disabled={isPlannerPreviewing || manualRunForm.datasets.length === 0}
                className="rounded bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPlannerPreviewing ? t('soc.dataops.planner_preview_loading') : t('soc.dataops.planner_preview')}
              </button>
              <button
                type="button"
                onClick={handlePlannerRun}
                disabled={!plannerPreview || isPlannerRunning || manualRunForm.datasets.length === 0 || !ownership?.can_apply}
                className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPlannerRunning ? t('soc.dataops.planner_run_loading') : t('soc.dataops.planner_run')}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
              <h4 className="text-sm font-semibold text-white">{t('soc.dataops.planner_preview_summary')}</h4>
              {plannerPreview ? (
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.planner_planned_items')}</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-100">{plannerPreview.summary?.planned_items || 0}</dd>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                    <dt className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.planner_skipped_items')}</dt>
                    <dd className="mt-1 text-lg font-semibold text-slate-100">{plannerPreview.summary?.skipped_items || 0}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{t('soc.dataops.planner_preview_empty')}</p>
              )}
            </div>

            {plannerRunResult && (
              <div className="rounded-lg border border-emerald-700/60 bg-emerald-950/40 p-4">
                <h4 className="text-sm font-semibold text-emerald-100">{t('soc.dataops.planner_run_result')}</h4>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-emerald-300/70">{t('soc.dataops.planner_run_id')}</dt>
                    <dd className="mt-1 font-semibold text-emerald-100">{plannerRunResult.run_id}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-emerald-300/70">{t('soc.dataops.planner_status')}</dt>
                    <dd className="mt-1 font-semibold text-emerald-100">{plannerRunResult.status}</dd>
                  </div>
                </dl>
              </div>
            )}

            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
              <button
                type="button"
                onClick={() => setPlannerItemsExpanded((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-semibold text-white">{t('soc.dataops.planner_items_title')}</h4>
                  {(plannerPreview?.items || []).length > 0 && (
                    <span className="rounded-full bg-cyan-900/50 border border-cyan-700 px-2 py-0.5 text-[11px] text-cyan-300">
                      {plannerPreview.items.length} mục
                    </span>
                  )}
                </div>
                {(plannerPreview?.items || []).length > 0 && (
                  <span className="text-slate-400 text-sm transition-transform" style={{ transform: plannerItemsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                )}
              </button>

              {plannerItemsExpanded && (plannerPreview?.items || []).length > 0 && (() => {
                const total = plannerPreview.items.length;
                const maxPage = Math.max(1, Math.ceil(total / PLANNER_PREVIEW_PAGE_SIZE));
                const currentPage = Math.min(plannerItemsPage, maxPage);
                const visibleItems = plannerPreview.items.slice(
                  (currentPage - 1) * PLANNER_PREVIEW_PAGE_SIZE,
                  currentPage * PLANNER_PREVIEW_PAGE_SIZE,
                );
                return (
                  <>
                    <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-800">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-800">
                          {visibleItems.map((item) => (
                            <tr key={`${item.symbol}-${item.dataset}`} className="bg-slate-900/70 align-top">
                              <td className="px-3 py-2">
                                <p className="font-semibold text-white">{item.symbol}</p>
                                <p className="text-xs text-slate-400">{t(DATASET_LABEL_KEYS[item.dataset] || 'soc.dataops.dataset_unknown')}</p>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <span className="rounded-full border border-cyan-700/60 bg-cyan-950/50 px-2 py-1 text-xs font-semibold text-cyan-200">
                                  {t(FRESHNESS_LABEL_KEYS[item.coverage_before] || 'soc.dataops.freshness_unknown')}
                                </span>
                                {item.reason ? (
                                  <p className="mt-1 text-xs text-slate-400">{item.reason}</p>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {total > PLANNER_PREVIEW_PAGE_SIZE && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{currentPage}/{maxPage} · {total}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPlannerItemsPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                          >◀</button>
                          <button
                            type="button"
                            onClick={() => setPlannerItemsPage((p) => Math.min(maxPage, p + 1))}
                            disabled={currentPage >= maxPage}
                            className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                          >▶</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {!(plannerPreview?.items || []).length && (
                <p className="mt-3 text-sm text-slate-500">{t('soc.dataops.planner_items_empty')}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
              <button
                type="button"
                onClick={() => setPlannerSkippedExpanded((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <h4 className="text-sm font-semibold text-white">{t('soc.dataops.planner_skipped_title')}</h4>
                  {(plannerPreview?.skipped || []).length > 0 && (
                    <span className="rounded-full bg-amber-900/50 border border-amber-700 px-2 py-0.5 text-[11px] text-amber-300">
                      {plannerPreview.skipped.length} mục
                    </span>
                  )}
                </div>
                {(plannerPreview?.skipped || []).length > 0 && (
                  <span className="text-slate-400 text-sm transition-transform" style={{ transform: plannerSkippedExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                )}
              </button>

              {plannerSkippedExpanded && (plannerPreview?.skipped || []).length > 0 && (() => {
                const total = plannerPreview.skipped.length;
                const maxPage = Math.max(1, Math.ceil(total / PLANNER_PREVIEW_PAGE_SIZE));
                const currentPage = Math.min(plannerSkippedPage, maxPage);
                const visibleItems = plannerPreview.skipped.slice(
                  (currentPage - 1) * PLANNER_PREVIEW_PAGE_SIZE,
                  currentPage * PLANNER_PREVIEW_PAGE_SIZE,
                );
                return (
                  <>
                    <div className="mt-4 max-h-72 overflow-auto rounded-lg border border-slate-800">
                      <table className="w-full text-sm">
                        <tbody className="divide-y divide-slate-800">
                          {visibleItems.map((item) => (
                            <tr key={`${item.symbol}-${item.dataset}-skipped`} className="bg-slate-900/70 align-top">
                              <td className="px-3 py-2">
                                <p className="font-semibold text-white">{item.symbol}</p>
                                <p className="text-xs text-slate-400">{t(DATASET_LABEL_KEYS[item.dataset] || 'soc.dataops.dataset_unknown')}</p>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <p className="text-xs text-slate-300">{item.reason}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {total > PLANNER_PREVIEW_PAGE_SIZE && (
                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-500">{currentPage}/{maxPage} · {total}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setPlannerSkippedPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage <= 1}
                            className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                          >◀</button>
                          <button
                            type="button"
                            onClick={() => setPlannerSkippedPage((p) => Math.min(maxPage, p + 1))}
                            disabled={currentPage >= maxPage}
                            className="rounded border border-slate-700 px-2 py-1 font-semibold text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
                          >▶</button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {!(plannerPreview?.skipped || []).length && (
                <p className="mt-3 text-sm text-slate-500">{t('soc.dataops.planner_skipped_empty')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
      )} {/* end subTab === 'ops' — planner */}

      {/* ── Tab: Cấu hình — Runtime Config + Audit ──────────────────────── */}
      {subTab === 'config' && (
      <>
      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.runtime_config')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.runtime_config_hint')}</p>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            disabled={isConfigPreviewing}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            {isConfigPreviewing ? t('soc.dataops.preview_loading') : t('soc.actions.preview')}
          </button>
        </div>
        <label htmlFor="soc-dataops-runtime-config" className="mb-2 block text-sm font-medium text-slate-200">
          {t('soc.dataops.runtime_config')}
        </label>
        <textarea
          id="soc-dataops-runtime-config"
          value={draftJson}
          onChange={(event) => {
            setDraftJson(event.target.value);
            setError(null);
            setSuccessMessage(null);
          }}
          rows={18}
          spellCheck={false}
          className="w-full rounded-lg border border-slate-700 bg-slate-950 p-4 font-mono text-sm text-slate-200 outline-none transition focus:border-emerald-500"
        />
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.audit_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.audit_description')}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.audit_total')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{auditEnvelope.count || 0}</p>
          </div>
        </div>

        {(auditEnvelope.results || []).length > 0 ? (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800 text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-3">{t('soc.dataops.audit_timestamp')}</th>
                    <th className="px-3 py-3">{t('soc.dataops.audit_actor')}</th>
                    <th className="px-3 py-3">{t('soc.dataops.audit_service_key')}</th>
                    <th className="px-3 py-3">{t('soc.dataops.audit_change_summary')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(auditEnvelope.results || []).map((auditItem) => (
                    <tr key={auditItem.id} className="align-top">
                      <td className="px-3 py-4 text-slate-300">{auditItem.timestamp || t('common.notAvailable')}</td>
                      <td className="px-3 py-4 text-slate-300">{auditItem.actor || t('common.notAvailable')}</td>
                      <td className="px-3 py-4 font-mono text-xs text-slate-300">{auditItem.service_key || t('common.notAvailable')}</td>
                      <td className="px-3 py-4 text-slate-300">{auditItem.change_summary || t('common.notAvailable')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-400">
                {t('soc.dataops.audit_page')} {auditPage}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleAuditPageChange(Math.max(auditPage - 1, 1))}
                  disabled={!auditEnvelope.previous || isAuditLoading}
                  className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('soc.dataops.audit_previous')}
                </button>
                <button
                  type="button"
                  onClick={() => handleAuditPageChange(auditPage + 1)}
                  disabled={!auditEnvelope.next || isAuditLoading}
                  className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t('soc.dataops.audit_next')}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t('soc.dataops.audit_empty')}</p>
        )}
      </div>
      </> )} {/* end subTab === 'config' */}

      {/* ── Tab: Giám sát — Run History ──────────────────────────────────── */}
      {subTab === 'monitor' && (
      <div className="rounded-lg border border-slate-700 bg-slate-900">
        <button
          type="button"
          onClick={() => setShowRunHistory((v) => !v)}
          className="flex w-full items-center justify-between gap-3 p-6 text-left"
        >
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.run_history_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.run_history_description')}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
              {runLogsEnvelope.count || 0}
            </span>
            <span className="text-slate-400 transition-transform" style={{ transform: showRunHistory ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
          </div>
        </button>
        {showRunHistory && (
          <div className="px-6 pb-6">
            {(runLogsEnvelope.results || []).length > 0 ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-800 text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="px-3 py-3">{t('soc.dataops.run_history_run_id')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_status')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_mode')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_reason')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_started_at')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_finished_at')}</th>
                        <th className="px-3 py-3">{t('soc.dataops.run_history_summary')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {(runLogsEnvelope.results || []).map((runLog) => (
                        <tr key={runLog.run_id} className="align-top">
                          <td className="px-3 py-4 font-mono text-sm text-white">{runLog.run_id}</td>
                          <td className="px-3 py-4">
                            <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-xs font-semibold text-slate-200">
                              {t(RUN_STATUS_LABEL_KEYS[runLog.status] || 'soc.dataops.run_status_unknown')}
                            </span>
                          </td>
                          <td className="px-3 py-4 text-slate-300">{runLog.mode || 'missing_only'}</td>
                          <td className="px-3 py-4 font-mono text-xs text-slate-300">{runLog.reason || 'operator_manual_run'}</td>
                          <td className="px-3 py-4 text-slate-300">{runLog.started_at || t('common.notAvailable')}</td>
                          <td className="px-3 py-4 text-slate-300">{runLog.finished_at || t('common.notAvailable')}</td>
                          <td className="px-3 py-4">
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                              <span className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                                {t('soc.dataops.planner_planned_items')}: {runLog.summary?.planned_items || 0}
                              </span>
                              <span className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                                {t('soc.dataops.run_history_inserted')}: {runLog.summary?.inserted || 0}
                              </span>
                              <span className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                                {t('soc.dataops.run_history_updated')}: {runLog.summary?.updated || 0}
                              </span>
                              <span className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                                {t('soc.dataops.run_history_skipped_existing')}: {runLog.summary?.skipped_existing || 0}
                              </span>
                              <span className="rounded border border-slate-800 bg-slate-950/70 px-2 py-1 text-xs text-slate-300">
                                {t('soc.dataops.run_history_failed')}: {runLog.summary?.failed || 0}
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-slate-400">
                    {t('soc.dataops.run_history_page')} {runLogsPage}
                  </p>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => handleRunLogsPageChange(Math.max(runLogsPage - 1, 1))}
                      disabled={!runLogsEnvelope.previous || isRunLogsLoading}
                      className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t('soc.dataops.run_history_previous')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRunLogsPageChange(runLogsPage + 1)}
                      disabled={!runLogsEnvelope.next || isRunLogsLoading}
                      className="rounded border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {t('soc.dataops.run_history_next')}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">{t('soc.dataops.run_history_empty')}</p>
            )}
          </div>
        )}
      </div>
      )} {/* end subTab === 'monitor' — run history */}

      {ownership && (
        <OwnershipBadgeRow domain={ownership.domain || 'dataops_market_data'} ownership={ownership} t={t} />
      )}

      {/* ── Tab: Điều phối — Custom Group Manager ────────────────────────── */}
      {subTab === 'ops' && (
      <div className="rounded-lg border border-teal-800 bg-slate-900 p-6">
        <button
          type="button"
          onClick={() => setShowGroupManager((v) => !v)}
          className="flex w-full items-center justify-between text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white">
              {t('soc.dataops.group_manager_title')}
            </span>
            <span className="rounded bg-teal-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-100">
              {customGroups.length} {t('soc.dataops.group_manager_count_label')}
            </span>
          </div>
          <span className="text-slate-400">{showGroupManager ? '▲' : '▼'}</span>
        </button>

        {showGroupManager && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-400">{t('soc.dataops.group_manager_description')}</p>

            {/* Existing custom groups */}
            {customGroups.length > 0 && (
              <div className="space-y-2">
                {customGroups.map((g) => (
                  <div
                    key={g.slug}
                    className="flex items-center justify-between rounded border border-teal-800/50 bg-slate-800 px-3 py-2 gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-teal-200">{g.name}</span>
                        <span className="text-[11px] text-slate-500">{g.slug}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400 truncate">
                        {(g.symbols || []).slice(0, 8).join(', ')}{g.symbols?.length > 8 ? ` +${g.symbols.length - 8}` : ''}
                        {' '}
                        <span className="text-slate-500">({g.symbol_count ?? g.symbols?.length ?? 0} mã)</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGroup(g.slug)}
                      className="shrink-0 rounded border border-red-700 px-2 py-0.5 text-xs font-semibold text-red-400 hover:bg-red-900/50 transition"
                    >
                      {t('soc.dataops.group_manager_delete')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Create new group form */}
            <div className="rounded border border-teal-700/40 bg-slate-800/60 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-400">
                {t('soc.dataops.group_manager_add_title')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('soc.dataops.group_manager_name_label')}
                  </label>
                  <input
                    type="text"
                    value={newGroupForm.name}
                    onChange={(e) => setNewGroupForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Ngân hàng lớn, Blue-chip..."
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    {t('soc.dataops.group_manager_desc_label')}
                  </label>
                  <input
                    type="text"
                    value={newGroupForm.description}
                    onChange={(e) => setNewGroupForm((p) => ({ ...p, description: e.target.value }))}
                    placeholder={t('soc.dataops.group_manager_desc_placeholder')}
                    className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  {t('soc.dataops.group_manager_symbols_label')}
                </label>
                <textarea
                  value={newGroupForm.symbolsText}
                  onChange={(e) => setNewGroupForm((p) => ({ ...p, symbolsText: e.target.value }))}
                  placeholder="VCB, BID, CTG, TCB, MBB..."
                  rows={3}
                  className="w-full rounded border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-white focus:border-teal-500 focus:outline-none resize-y"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  {t('soc.dataops.group_manager_symbols_hint')}
                </p>
              </div>
              {groupManagerError && (
                <p className="text-sm text-red-400">{groupManagerError}</p>
              )}
              <button
                type="button"
                onClick={handleCreateGroup}
                disabled={isCreatingGroup || !newGroupForm.name.trim() || !newGroupForm.symbolsText.trim()}
                className="rounded bg-teal-700 hover:bg-teal-600 disabled:opacity-50 px-4 py-1.5 text-sm font-semibold text-white transition"
              >
                {isCreatingGroup ? t('soc.dataops.group_manager_creating') : t('soc.dataops.group_manager_create_btn')}
              </button>
            </div>
          </div>
        )}
      </div>
      )} {/* end subTab === 'ops' — group manager */}

      <ConfigPreviewModal
        isOpen={previewOpen}
        before={currentConfig}
        after={previewConfig || currentConfig}
        onClose={() => {
          setPreviewOpen(false);
          setPreviewConfig(null);
          setPreviewValidationErrors(null);
        }}
        onConfirm={handleApply}
        changeSummary={buildChangeSummary(currentConfig, previewConfig || currentConfig, t)}
        impactWarnings={buildImpactWarnings(currentConfig, previewConfig || currentConfig, t)}
        validationErrors={previewValidationErrors}
        domain={ownership?.domain || 'dataops_market_data'}
        isSubmitting={isSubmitting}
        t={t}
      />
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
BackfillCenterSection.propTypes = {
  t: PropTypes.func.isRequired,
  canApply: PropTypes.bool.isRequired,
  customGroups: PropTypes.arrayOf(PropTypes.shape({
    group_id: PropTypes.string,
    name: PropTypes.string,
  })),
};

DataOpsPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default DataOpsPanel;