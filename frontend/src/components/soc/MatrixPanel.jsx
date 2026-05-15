/**
 * MatrixPanel.jsx — ScrapeMatrix monitoring and operator controls
 */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { MatrixScrapeMonitor } from './MatrixScrapeMonitor';

const ACTIVE_MATRIX_STATUSES = new Set(['active', 'completing']);
const DEFAULT_MATRIX_SYMBOL_GROUPS = [
  { id: 'top100', name: 'Top 100' },
  { id: 'vn30', name: 'VN30' },
];
const MATRIX_MONITOR_POLL_INTERVAL_SECONDS = 5;
const MATRIX_CELL_RETRY_DELAY_SECONDS = 30;
const MATRIX_DISPATCH_TASK = 'service_ops.run_scrape_cycle';
const MATRIX_CELL_TASK = 'service_ops.scrape_cell_task';
const MATRIX_DATA_CONTRACT = ['fetch_listing_symbols()', 'fetch_price_board_snapshot()'];

const normalizeSymbolGroups = (symbolGroups) => {
  const groups = Array.isArray(symbolGroups) ? symbolGroups : [];
  const normalizedGroups = groups
    .map((group) => {
      const groupId = String(group?.id || '').trim();
      if (!groupId) {
        return null;
      }
      return {
        id: groupId,
        name: String(group?.name || groupId).trim(),
      };
    })
    .filter(Boolean);

  return normalizedGroups.length > 0 ? normalizedGroups : DEFAULT_MATRIX_SYMBOL_GROUPS;
};

const getReadyProviderIds = (providerList) => providerList
  .filter((provider) => provider.runtime_ready)
  .map((provider) => provider.provider);

const getSelectedProviders = (providerList, monitorProviders, monitorStatus) => {
  const readyProviderIds = getReadyProviderIds(providerList);
  if (ACTIVE_MATRIX_STATUSES.has(monitorStatus)) {
    const activeCycleProviders = (monitorProviders || []).filter((providerId) => readyProviderIds.includes(providerId));
    if (activeCycleProviders.length > 0) {
      return activeCycleProviders;
    }
  }

  const defaultProviders = providerList
    .filter((provider) => provider.default_selected && provider.runtime_ready)
    .map((provider) => provider.provider);

  return defaultProviders.length > 0 ? defaultProviders : readyProviderIds;
};

const getStatusLabel = (status, t) => {
  const statusKeyByValue = {
    idle: 'soc.matrix.status_idle',
    active: 'soc.matrix.status_active',
    completing: 'soc.matrix.status_completing',
    completed: 'soc.matrix.status_completed',
    aborted: 'soc.matrix.status_aborted',
  };

  const statusKey = statusKeyByValue[status];
  return statusKey ? t(statusKey) : status;
};

const getStatusTone = (status) => {
  const toneByStatus = {
    idle: 'bg-slate-800 text-slate-200',
    active: 'bg-sky-900 text-sky-200',
    completing: 'bg-amber-900 text-amber-200',
    completed: 'bg-emerald-900 text-emerald-200',
    aborted: 'bg-rose-900 text-rose-200',
  };

  return toneByStatus[status] || 'bg-slate-800 text-slate-200';
};

const MatrixPanel = ({ t }) => {
  const [cycleId, setCycleId] = useState('');
  const [providers, setProviders] = useState([]);
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [symbolGroups, setSymbolGroups] = useState(DEFAULT_MATRIX_SYMBOL_GROUPS);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMatrixContext = async () => {
      try {
        const [monitor, providerPayload] = await Promise.all([
          socApi.getMatrixMonitor(),
          socApi.getMatrixProviders(),
        ]);
        const providerList = providerPayload.providers || [];
        const monitorProviders = Array.isArray(monitor.providers) ? monitor.providers : [];
        const nextStatus = monitor.status || 'idle';

        setCycleId(ACTIVE_MATRIX_STATUSES.has(nextStatus) ? (monitor.cycle_id || '') : '');
        setStatus(nextStatus);
        setProviders(providerList);
        setSymbolGroups(normalizeSymbolGroups(monitor.symbol_groups));
        setSelectedProviders(getSelectedProviders(providerList, monitorProviders, nextStatus));
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadMatrixContext();
  }, []);

  const handleStartCycle = async () => {
    if (selectedProviders.length === 0) {
      setError(t('soc.matrix.no_provider_selected'));
      return;
    }

    try {
      const data = await socApi.startMatrixCycle({ providers: selectedProviders });
      setCycleId(data.cycle_id || '');
      setStatus(data.status || 'active');
      setSelectedProviders(Array.isArray(data.providers) ? data.providers : selectedProviders);
      setSymbolGroups(normalizeSymbolGroups(data.symbol_groups));
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAbortCycle = async () => {
    if (!cycleId) {
      return;
    }

    try {
      const data = await socApi.abortMatrixCycle(cycleId);
      setStatus(data.status || 'aborted');
      setError(null);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCycleComplete = (snapshot) => {
    setStatus(snapshot.status || 'completed');
    if (snapshot.cycle_id) {
      setCycleId(snapshot.cycle_id);
    }
    if (snapshot.symbol_groups) {
      setSymbolGroups(normalizeSymbolGroups(snapshot.symbol_groups));
    }
  };

  const handleProviderToggle = (providerId) => {
    setSelectedProviders((currentProviders) => (
      currentProviders.includes(providerId)
        ? currentProviders.filter((currentProviderId) => currentProviderId !== providerId)
        : [...currentProviders, providerId]
    ));
  };

  if (loading) {
    return <p className="text-slate-400">{t('soc.matrix.loading')}</p>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('soc.tabs.matrix')}</h2>

      {error && (
        <div className="rounded-lg border border-red-700 bg-red-900 p-4 text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">{t('soc.matrix.runtime_summary_title')}</h3>
              <p className="mt-1 text-sm text-slate-400">{t('soc.matrix.runtime_summary_description')}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${getStatusTone(status)}`}>
              {getStatusLabel(status, t)}
            </span>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.active_cycle')}</p>
              <p className="mt-2 font-mono text-sm text-slate-100">{cycleId || t('soc.matrix.idle')}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.default_symbol_groups')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {symbolGroups.map((group) => (
                  <span
                    key={group.id}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200"
                  >
                    {group.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.job_dispatcher')}</p>
              <p className="mt-2 font-mono text-sm text-slate-100">{MATRIX_DISPATCH_TASK}</p>
              <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.job_worker')}</p>
              <p className="mt-2 font-mono text-sm text-slate-100">{MATRIX_CELL_TASK}</p>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.data_contract')}</p>
              <p className="mt-2 text-sm text-slate-300">{t('soc.matrix.data_contract_description')}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {MATRIX_DATA_CONTRACT.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-xs text-slate-200"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
          <h3 className="text-lg font-bold text-white">{t('soc.matrix.runtime_cadence')}</h3>
          <p className="mt-1 text-sm text-slate-400">{t('soc.matrix.runtime_cadence_description')}</p>

          <dl className="mt-5 space-y-4">
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.ui_poll_interval')}</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-100">{MATRIX_MONITOR_POLL_INTERVAL_SECONDS}s</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.cell_retry_delay')}</dt>
              <dd className="mt-2 text-sm font-semibold text-slate-100">{MATRIX_CELL_RETRY_DELAY_SECONDS}s</dd>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <dt className="text-xs uppercase tracking-wide text-slate-500">{t('soc.matrix.provider_mode')}</dt>
              <dd className="mt-2 text-sm text-slate-300">{t('soc.matrix.provider_mode_description')}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-slate-400">{t('soc.matrix.monitor_title')}</p>
            <p className="text-sm text-slate-500">
              {t('soc.matrix.active_cycle')}: <span className="font-mono text-slate-200">{cycleId || t('soc.matrix.idle')}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStartCycle}
              disabled={selectedProviders.length === 0}
              className="rounded bg-emerald-700 px-4 py-2 text-sm text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {t('soc.matrix.start_cycle')}
            </button>
            <button
              onClick={handleAbortCycle}
              disabled={!cycleId || status === 'aborted' || status === 'completed'}
              className="rounded bg-rose-700 px-4 py-2 text-sm text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
            >
              {t('soc.matrix.abort_cycle')}
            </button>
          </div>
        </div>

        <div className="mb-6 rounded-lg border border-slate-700 bg-slate-950 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">{t('soc.matrix.available_providers')}</h3>
              <p className="text-xs text-slate-400">{t('soc.matrix.selection_hint')}</p>
            </div>
            <p className="text-xs text-slate-400">
              {t('soc.matrix.selected_count')}: <span className="font-mono text-slate-200">{selectedProviders.length}</span>
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {providers.map((provider) => {
              const isSelected = selectedProviders.includes(provider.provider);
              return (
                <label
                  key={provider.provider}
                  className={`rounded-lg border p-4 ${provider.runtime_ready ? 'border-slate-700 bg-slate-900' : 'border-amber-700 bg-amber-950/40'} ${isSelected ? 'ring-1 ring-sky-500' : ''}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{provider.label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${provider.runtime_ready ? 'bg-emerald-900 text-emerald-200' : 'bg-amber-900 text-amber-200'}`}>
                          {provider.runtime_ready ? t('soc.matrix.runtime_ready') : t('soc.matrix.runtime_blocked')}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">{provider.readiness_reason}</p>
                    </div>
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-sky-500"
                      checked={isSelected}
                      disabled={!provider.runtime_ready}
                      onChange={() => handleProviderToggle(provider.provider)}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </div>

        <MatrixScrapeMonitor
          cycleId={cycleId}
          pollIntervalMs={MATRIX_MONITOR_POLL_INTERVAL_SECONDS * 1000}
          onCycleComplete={handleCycleComplete}
          t={t}
        />
      </div>

      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="mb-4 text-lg font-bold text-white">{t('soc.matrix.providers')}</h3>
        <div className="flex flex-wrap gap-2">
          {providers.map((provider) => (
            <span
              key={provider.provider}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${provider.in_active_cycle ? 'bg-sky-900 text-sky-200' : 'bg-slate-800 text-slate-300'}`}
            >
              {provider.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
MatrixPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default MatrixPanel;
