/**
 * PrefetchPanel.jsx — Prefetch time policy configuration
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';

const PROFILE_FIELDS = [
  { name: 'pre_open', field: 'pre_open_interval_seconds' },
  { name: 'market_open', field: 'market_open_interval_seconds' },
  { name: 'lunch_break', field: 'lunch_break_interval_seconds' },
  { name: 'pre_close', field: 'pre_close_interval_seconds' },
  { name: 'post_close', field: 'post_close_interval_seconds' },
  { name: 'offhours', field: 'offhours_interval_seconds' },
];

const PrefetchPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [cacheStatus, setCacheStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cfg, cache] = await Promise.all([
          socApi.getPrefetchConfig(),
          socApi.getPrefetchCacheStatus(),
        ]);
        setConfig(cfg.config || {});
        setCacheStatus(cache);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handlePurgeCache = async () => {
    try {
      await socApi.purgePrefetchCache();
      alert(t('soc.actions.success'));
    } catch (err) {
      setError(err.message);
    }
  };

  const profiles = PROFILE_FIELDS.map((profile) => ({
    name: profile.name,
    interval_seconds: Number(config?.[profile.field] || 0),
    enabled: Boolean(config?.enabled),
  }));

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.prefetch.title')}</h2>
        <button
          onClick={handlePurgeCache}
          className="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-white text-sm"
        >
          {t('soc.prefetch.purge')}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.prefetch.config')}</h3>
        <pre className="bg-slate-800 p-4 rounded text-sm text-slate-300 overflow-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>

      {/* Profiles */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.prefetch.profiles')}</h3>
        <div className="grid grid-cols-2 gap-4">
          {profiles.map(profile => (
            <div key={profile.name} className="bg-slate-800 p-3 rounded">
              <p className="font-bold text-slate-100">{profile.name}</p>
              <p className="text-xs text-slate-400">Interval: {profile.interval_seconds}s</p>
              <p className="text-xs text-slate-400">Enabled: {profile.enabled ? '✓' : '✗'}</p>
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
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
PrefetchPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default PrefetchPanel;
