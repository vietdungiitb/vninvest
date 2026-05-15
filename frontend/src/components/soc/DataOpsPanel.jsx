import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';

import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';
import { OwnershipBadgeRow } from './OwnershipBadgeRow';
import { WriteGuardBanner } from './WriteGuardBanner';

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

const FRESHNESS_LABEL_KEYS = {
  fresh: 'soc.dataops.freshness_fresh',
  warm: 'soc.dataops.freshness_warm',
  stale: 'soc.dataops.freshness_stale',
  missing: 'soc.dataops.freshness_missing',
  error: 'soc.dataops.freshness_error',
  unknown: 'soc.dataops.freshness_unknown',
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

const DataOpsPanel = ({ t }) => {
  const [queueSnapshot, setQueueSnapshot] = useState({ tiers: [], updated_at: null });
  const [coverageSummary, setCoverageSummary] = useState({ datasets: [], top_gaps: [], updated_at: null });
  const [runtimeEnvelope, setRuntimeEnvelope] = useState({ config: {}, ownership: null, updated_at: null });
  const [draftJson, setDraftJson] = useState('{}');
  const [previewConfig, setPreviewConfig] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [tiersPayload, runtimePayload, coveragePayload] = await Promise.all([
        socApi.getDataOpsQueueTiers(),
        socApi.getDataOpsRuntimeConfig(),
        socApi.getDataOpsCoverage(),
      ]);
      setQueueSnapshot(tiersPayload || { tiers: [], updated_at: null });
      setRuntimeEnvelope(runtimePayload || { config: {}, ownership: null, updated_at: null });
      setCoverageSummary(coveragePayload || { datasets: [], top_gaps: [], updated_at: null });
      setDraftJson(JSON.stringify(runtimePayload?.config || {}, null, 2));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePreview = () => {
    try {
      const parsed = JSON.parse(draftJson);
      setPreviewConfig(parsed);
      setPreviewOpen(true);
      setError(null);
      setSuccessMessage(null);
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
      setError(null);

      const tiersPayload = await socApi.getDataOpsQueueTiers();
      setQueueSnapshot(tiersPayload || { tiers: [], updated_at: null });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
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
          onClick={loadData}
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
            <h3 className="text-lg font-bold text-white">{t('soc.dataops.runtime_config')}</h3>
            <p className="mt-1 text-sm text-slate-400">{t('soc.dataops.runtime_config_hint')}</p>
          </div>
          <button
            type="button"
            onClick={handlePreview}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-600"
          >
            {t('soc.actions.preview')}
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
        }}
        onConfirm={handleApply}
        changeSummary={buildChangeSummary(currentConfig, previewConfig || currentConfig, t)}
        impactWarnings={buildImpactWarnings(currentConfig, previewConfig || currentConfig, t)}
        validationErrors={null}
        domain={ownership?.domain || 'dataops_market_data'}
        isSubmitting={isSubmitting}
        t={t}
      />
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
DataOpsPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default DataOpsPanel;