/**
 * PrefetchPanel.jsx — Prefetch time policy configuration (editable)
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const PROFILE_FIELDS = [
  { name: 'pre_open', field: 'pre_open_interval_seconds' },
  { name: 'market_open', field: 'market_open_interval_seconds' },
  { name: 'lunch_break', field: 'lunch_break_interval_seconds' },
  { name: 'pre_close', field: 'pre_close_interval_seconds' },
  { name: 'post_close', field: 'post_close_interval_seconds' },
  { name: 'offhours', field: 'offhours_interval_seconds' },
];

const CORE_NUMBER_FIELDS = [
  { key: 'batch_size', label: 'Batch Size' },
  { key: 'symbol_limit', label: 'Symbol Limit' },
  { key: 'max_retries', label: 'Max Retries' },
  { key: 'retry_base_delay_seconds', label: 'Retry Base Delay (s)' },
  { key: 'retry_max_delay_seconds', label: 'Retry Max Delay (s)' },
  { key: 'rate_limit_cooldown_seconds', label: 'Rate Limit Cooldown (s)' },
  { key: 'circuit_breaker_window_seconds', label: 'CB Window (s)' },
  { key: 'circuit_breaker_failure_threshold', label: 'CB Failure Threshold' },
  { key: 'circuit_breaker_cooldown_seconds', label: 'CB Cooldown (s)' },
  { key: 'cache_ttl_seconds', label: 'Cache TTL (s)' },
  { key: 'close_history_days', label: 'Close History Days' },
];

const buildChangeSummary = (before, after) => {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return Array.from(keys).filter(
    (k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]),
  );
};

const PrefetchPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [draft, setDraft] = useState({});
  const [cacheStatus, setCacheStatus] = useState(null);
  const [universeGroups, setUniverseGroups] = useState([]);
  const [selectedGroups, setSelectedGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewErrors, setPreviewErrors] = useState(null);
  const [changeSummary, setChangeSummary] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warmStatus, setWarmStatus] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [cfg, cache, groups] = await Promise.all([
        socApi.getPrefetchConfig(),
        socApi.getPrefetchCacheStatus(),
        socApi.getPrefetchUniverseGroups().catch(() => ({ groups: [] })),
      ]);
      const c = cfg.config || {};
      setConfig(c);
      setDraft({ ...c });
      setCacheStatus(cache);
      setUniverseGroups(groups.groups || []);
      // Pre-select groups marked selected in the response (fallback: config's universe_group_ids)
      const preSelected = (groups.groups || [])
        .filter((g) => g.selected)
        .map((g) => g.id);
      setSelectedGroups(preSelected.length > 0 ? preSelected : (c.universe_group_ids || []));
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setGroupsLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleFieldChange = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value === '' ? '' : Number(value) }));
  };

  const handleOpenPreview = () => {
    const draftWithGroups = { ...draft, universe_group_ids: selectedGroups };
    const changed = buildChangeSummary({ ...config, universe_group_ids: config?.universe_group_ids || [] }, draftWithGroups);
    setChangeSummary(changed);
    setPreviewErrors(null);
    setShowPreview(true);
  };

  const handleApply = async () => {
    try {
      setIsSubmitting(true);
      await socApi.applyPrefetchConfig({ ...draft, universe_group_ids: selectedGroups });
      setConfig({ ...draft, universe_group_ids: selectedGroups });
      setShowPreview(false);
      setChangeSummary([]);
      setPreviewErrors(null);
      setError(null);
    } catch (err) {
      setPreviewErrors({ config_payload: [err.message] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePurgeCache = async () => {
    try {
      await socApi.purgePrefetchCache();
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleWarmNow = async (mode) => {
    setWarmStatus(t('soc.prefetch.warm_running'));
    try {
      const result = await socApi.warmPrefetchNow(mode);
      setWarmStatus(result?.message || t('soc.prefetch.warm_queued'));
    } catch (err) {
      setWarmStatus(err.message);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.prefetch.title')}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => handleWarmNow('async')}
            className="px-3 py-2 bg-sky-700 hover:bg-sky-600 rounded text-white text-sm"
          >
            {t('soc.prefetch.warm_async')}
          </button>
          <button
            onClick={() => handleWarmNow('sync')}
            className="px-3 py-2 bg-sky-800 hover:bg-sky-700 rounded text-white text-sm"
          >
            {t('soc.prefetch.warm_sync')}
          </button>
          <button
            onClick={handlePurgeCache}
            className="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded text-white text-sm"
          >
            {t('soc.prefetch.purge')}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {warmStatus && (
        <div className="bg-sky-900 border border-sky-700 p-3 rounded-lg">
          <p className="text-sky-200 text-sm">{warmStatus}</p>
        </div>
      )}

      {/* Universe Groups Multiselect */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-1">{t('soc.prefetch.universe_groups')}</h3>
        <p className="text-xs text-slate-400 mb-4">{t('soc.prefetch.universe_groups_hint')}</p>
        {groupsLoading ? (
          <p className="text-slate-400 text-sm">{t('soc.prefetch.universe_groups_loading')}</p>
        ) : universeGroups.length === 0 ? (
          <p className="text-slate-500 text-sm">{t('soc.prefetch.universe_groups_empty', { defaultValue: 'Chưa có nhóm nào. Tạo nhóm trong tab DataOps.' })}</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {universeGroups.map((g) => {
                const isCustom = g.type === 'custom';
                const isSelected = selectedGroups.includes(g.id);
                const total = g.symbol_count || 0;
                const covered = g.data_count || 0;
                const hasData = covered > 0;
                const pct = total > 0 ? Math.round((covered / total) * 100) : 0;
                const latestDate = g.latest_date
                  ? new Date(g.latest_date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : null;
                return (
                  <label
                    key={g.id}
                    className={`flex flex-col gap-1.5 cursor-pointer p-3 rounded-lg border transition ${
                      isSelected
                        ? isCustom
                          ? 'border-teal-500 bg-teal-900/30'
                          : 'border-blue-500 bg-blue-900/30'
                        : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800/50'
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => setSelectedGroups((prev) =>
                          e.target.checked ? [...prev, g.id] : prev.filter((id) => id !== g.id)
                        )}
                        className={isCustom ? 'accent-teal-500' : 'accent-blue-500'}
                      />
                      <span className={`text-sm font-semibold flex-1 ${isCustom ? 'text-teal-200' : 'text-slate-100'}`}>
                        {isCustom ? `★ ${g.name}` : g.name}
                      </span>
                      {/* Data status dot */}
                      <span
                        title={hasData ? `Có dữ liệu · cập nhật ${latestDate}` : 'Chưa có dữ liệu'}
                        className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${hasData ? 'bg-emerald-400' : 'bg-slate-600'}`}
                      />
                    </div>
                    {/* Coverage bar */}
                    {total > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              pct >= 90 ? 'bg-emerald-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-mono tabular-nums ${
                          pct >= 90 ? 'text-emerald-400' : pct >= 60 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {covered}/{total}
                        </span>
                      </div>
                    )}
                    {/* Latest date */}
                    {latestDate && (
                      <span className="text-[10px] text-slate-500">
                        Cập nhật: {latestDate}
                      </span>
                    )}
                    {!hasData && total > 0 && (
                      <span className="text-[10px] text-slate-600 italic">Chưa có dữ liệu</span>
                    )}
                  </label>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-slate-500">
              {selectedGroups.length} / {universeGroups.length} nhóm được chọn · Lưu qua nút "Xem trước" → Áp dụng
            </p>
          </>
        )}
      </div>

      {/* Config Form */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{t('soc.prefetch.config')}</h3>
          <button
            onClick={handleOpenPreview}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
          >
            {t('soc.actions.preview')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CORE_NUMBER_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                type="number"
                value={draft[key] ?? ''}
                onChange={(e) => handleFieldChange(key, e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Profiles */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.prefetch.profiles')}</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PROFILE_FIELDS.map(({ name, field }) => (
            <div key={name}>
              <label className="block text-xs text-slate-400 mb-1">{name}</label>
              <input
                type="number"
                value={draft[field] ?? ''}
                onChange={(e) => handleFieldChange(field, e.target.value)}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder={t('soc.prefetch.interval_placeholder')}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Cache Status */}
      {cacheStatus && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.prefetch.cache_status')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Hit Rate</p>
              <p className="text-2xl font-bold text-green-400">{cacheStatus.hit_rate || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Cache Size</p>
              <p className="text-2xl font-bold text-blue-400">{cacheStatus.size_mb || 0} MB</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">TTL</p>
              <p className="text-2xl font-bold text-purple-400">{cacheStatus.ttl_minutes || 0} min</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      <ConfigPreviewModal
        isOpen={showPreview}
        before={config}
        after={draft}
        onClose={() => { setShowPreview(false); setPreviewErrors(null); }}
        onConfirm={handleApply}
        changeSummary={changeSummary}
        impactWarnings={[]}
        validationErrors={previewErrors}
        domain="prefetch"
        isSubmitting={isSubmitting}
        t={t}
      />
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
PrefetchPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default PrefetchPanel;
