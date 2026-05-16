import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';
import { OwnershipBadgeRow } from './OwnershipBadgeRow';
import { WriteGuardBanner } from './WriteGuardBanner';

const BACKFILL_DATASETS = [
  { key: 'daily_prices', labelKey: 'soc.dataops.dataset_daily_prices' },
  { key: 'intraday_bars', labelKey: 'soc.dataops.dataset_intraday_bars' },
  { key: 'session_facts', labelKey: 'soc.dataops.dataset_session_facts' },
  { key: 'whale_events', labelKey: 'soc.dataops.dataset_whale_events' },
  { key: 'order_flow', labelKey: 'soc.dataops.dataset_order_flow' },
  { key: 'dark_flow', labelKey: 'soc.dataops.dataset_dark_flow' },
  { key: 'intraday_tick', labelKey: 'soc.dataops.dataset_intraday_ticks' },
];

const BACKFILL_SYMBOL_GROUPS = [
  { key: 'VN30', label: 'VN30' },
  { key: 'VN100', label: 'VN100' },
  { key: 'all', label: 'All' },
  { key: 'custom', label: 'Custom' },
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

const BackfillCenterSection = ({ t, canApply }) => {
  const [form, setForm] = useState(DEFAULT_BACKFILL_FORM);
  const [status, setStatus] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const toggleDataset = (key) => {
    setForm((prev) => ({
      ...prev,
      datasets: prev.datasets.includes(key)
        ? prev.datasets.filter((d) => d !== key)
        : [...prev.datasets, key],
    }));
  };

  const handleRun = async () => {
    if (!canApply) return;
    setIsRunning(true);
    setStatus(null);
    const symbols = form.symbolGroup === 'custom'
      ? form.customSymbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean)
      : [];
    try {
      const payload = {
        datasets: form.datasets,
        ...(symbols.length ? { symbols } : { symbol_group: form.symbolGroup }),
        from_date: form.fromDate || undefined,
        to_date: form.toDate || undefined,
        mode: form.mode,
        dry_run: form.dryRun,
        execution_mode: form.executionMode,
        reason: 'backfill_center_soc',
      };
      const result = await socApi.runDataOpsPlanner(payload);
      setStatus(result?.message || t('soc.dataops.backfill_queued'));
    } catch (err) {
      setStatus(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="rounded-lg border border-indigo-800 bg-slate-900 p-6">
      <h3 className="text-lg font-bold text-white mb-4">{t('soc.dataops.backfill_center')}</h3>

      {/* Dataset Checkboxes */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">{t('soc.dataops.backfill_datasets')}</p>
        <div className="flex flex-wrap gap-3">
          {BACKFILL_DATASETS.map(({ key, labelKey }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.datasets.includes(key)}
                onChange={() => toggleDataset(key)}
                className="accent-indigo-500"
              />
              <span className="text-sm text-slate-200">{t(labelKey)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Symbol Group */}
      <div className="mb-4">
        <p className="text-xs text-slate-400 mb-2">{t('soc.dataops.backfill_symbol_group')}</p>
        <div className="flex gap-3">
          {BACKFILL_SYMBOL_GROUPS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="symbolGroup"
                value={key}
                checked={form.symbolGroup === key}
                onChange={() => setForm((prev) => ({ ...prev, symbolGroup: key }))}
                className="accent-indigo-500"
              />
              <span className="text-sm text-slate-200">{label}</span>
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
          disabled={isRunning || !canApply || form.datasets.length === 0}
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

const DataOpsPanel = ({ t }) => {
  const [queueSnapshot, setQueueSnapshot] = useState({ tiers: [], updated_at: null });
  const [coverageSummary, setCoverageSummary] = useState({ datasets: [], top_gaps: [], updated_at: null });
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

  const loadData = async (page = runLogsPage) => {
    try {
      setLoading(true);
      const [tiersPayload, runtimePayload, coveragePayload, runLogsPayload, auditPayload] = await Promise.all([
        socApi.getDataOpsQueueTiers(),
        socApi.getDataOpsRuntimeConfig(),
        socApi.getDataOpsCoverage(),
        socApi.getDataOpsRunLogs(page),
        socApi.getDataOpsRuntimeConfigAudit(1),
      ]);
      setQueueSnapshot(tiersPayload || { tiers: [], updated_at: null });
      setRuntimeEnvelope(runtimePayload || { config: {}, ownership: null, updated_at: null });
      setCoverageSummary(coveragePayload || { datasets: [], top_gaps: [], updated_at: null });
      setRunLogsEnvelope(runLogsPayload || DEFAULT_RUN_LOGS_ENVELOPE);
      setRunLogsPage(page);
      setAuditEnvelope(auditPayload || DEFAULT_AUDIT_ENVELOPE);
      setAuditPage(1);
      setDraftJson(JSON.stringify(runtimePayload?.config || {}, null, 2));
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

      <BackfillCenterSection t={t} canApply={!ownership?.write_block_reason} />

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

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.queue_tiers')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.queue_tiers_description')}</p>
          </div>
        </div>
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

        <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(coverageSummary.datasets || []).map((dataset) => (
              <div key={dataset.dataset} className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-semibold text-white">
                    {t(DATASET_LABEL_KEYS[dataset.dataset] || 'soc.dataops.dataset_unknown')}
                  </h4>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-xs font-semibold text-slate-200">
                    {COVERAGE_STATE_ORDER.reduce((sum, stateKey) => sum + Number(dataset[stateKey] || 0), 0)}
                  </span>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  {COVERAGE_STATE_ORDER.map((stateKey) => (
                    <div key={stateKey} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <dt className="text-xs uppercase tracking-wide text-slate-500">
                        {t(FRESHNESS_LABEL_KEYS[stateKey] || 'soc.dataops.freshness_unknown')}
                      </dt>
                      <dd className="mt-1 text-lg font-semibold text-slate-100">{Number(dataset[stateKey] || 0)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
            <h4 className="text-sm font-semibold text-white">{t('soc.dataops.top_gaps')}</h4>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.top_gaps_description')}</p>

            {(coverageSummary.top_gaps || []).length > 0 ? (
              <ul className="mt-4 space-y-3">
                {(coverageSummary.top_gaps || []).map((gap) => (
                  <li key={`${gap.symbol}-${gap.dataset}`} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-white">{gap.symbol}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {t(DATASET_LABEL_KEYS[gap.dataset] || 'soc.dataops.dataset_unknown')}
                        </p>
                      </div>
                      <span className="rounded-full border border-amber-700/60 bg-amber-950/60 px-2 py-1 text-xs font-semibold text-amber-200">
                        {t(FRESHNESS_LABEL_KEYS[gap.freshness_state] || 'soc.dataops.freshness_unknown')}
                      </span>
                    </div>
                    {gap.next_recommended_action ? (
                      <p className="mt-3 text-xs text-slate-300">
                        {t('soc.dataops.next_action')}: {t(getNextActionLabelKey(gap.next_recommended_action))}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-500">{t('soc.dataops.no_top_gaps')}</p>
            )}
          </div>
        </div>
      </div>

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
              <h4 className="text-sm font-semibold text-white">{t('soc.dataops.planner_items_title')}</h4>
              {(plannerPreview?.items || []).length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {plannerPreview.items.map((item) => (
                    <li key={`${item.symbol}-${item.dataset}`} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{item.symbol}</p>
                          <p className="mt-1 text-xs text-slate-400">{t(DATASET_LABEL_KEYS[item.dataset] || 'soc.dataops.dataset_unknown')}</p>
                        </div>
                        <span className="rounded-full border border-cyan-700/60 bg-cyan-950/50 px-2 py-1 text-xs font-semibold text-cyan-200">
                          {t(FRESHNESS_LABEL_KEYS[item.coverage_before] || 'soc.dataops.freshness_unknown')}
                        </span>
                      </div>
                      {item.reason ? (
                        <p className="mt-3 text-xs text-slate-300">{t('soc.dataops.planner_reason_label')}: {item.reason}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{t('soc.dataops.planner_items_empty')}</p>
              )}
            </div>

            <div className="rounded-lg border border-slate-700 bg-slate-950/70 p-4">
              <h4 className="text-sm font-semibold text-white">{t('soc.dataops.planner_skipped_title')}</h4>
              {(plannerPreview?.skipped || []).length > 0 ? (
                <ul className="mt-4 space-y-3">
                  {plannerPreview.skipped.map((item) => (
                    <li key={`${item.symbol}-${item.dataset}-skipped`} className="rounded-lg border border-slate-800 bg-slate-900/80 p-3">
                      <p className="text-sm font-semibold text-white">{item.symbol}</p>
                      <p className="mt-1 text-xs text-slate-400">{t(DATASET_LABEL_KEYS[item.dataset] || 'soc.dataops.dataset_unknown')}</p>
                      <p className="mt-3 text-xs text-slate-300">{t('soc.dataops.planner_reason_label')}: {item.reason}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-slate-500">{t('soc.dataops.planner_skipped_empty')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

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

      <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.run_history_title')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.run_history_description')}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/70 px-4 py-3 text-right">
            <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.dataops.run_history_total')}</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">{runLogsEnvelope.count || 0}</p>
          </div>
        </div>

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

      {ownership && (
        <OwnershipBadgeRow domain={ownership.domain || 'dataops_market_data'} ownership={ownership} t={t} />
      )}

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
};

DataOpsPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default DataOpsPanel;