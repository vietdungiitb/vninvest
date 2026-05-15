/**
 * SignalsPanel.jsx — Signal Intelligence (read-only)
 * Signals domain = bridge-write; cannot apply from SOC
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { OwnershipBadgeRow } from './OwnershipBadgeRow';
import { WriteGuardBanner } from './WriteGuardBanner';

const SignalsPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [ownership, setOwnership] = useState(null);
  const [whaleDetection, setWhaleDetection] = useState(null);
  const [darkPoolDetection, setDarkPoolDetection] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cfg, own, whale, dark, mtr] = await Promise.all([
          socApi.getSignalConfig(),
          socApi.getSignalOwnership(),
          socApi.getWhaleDetection(),
          socApi.getDarkPoolDetection(),
          socApi.getSignalMetrics(),
        ]);
        setConfig(cfg.config || {});
        setOwnership(own);
        setWhaleDetection(whale);
        setDarkPoolDetection(dark);
        setMetrics(mtr);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">{t('soc.signals.title')}</h2>

      {/* Write Guard Banner */}
      <WriteGuardBanner
        reason={t('soc.signals.read_only_notice')}
        writer={ownership?.writer || ownership?.owner_team}
        writeSurface={ownership?.write_surface}
        t={t}
      />

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config (Read-only) */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.signals.config')}</h3>
        <pre className="bg-slate-800 p-4 rounded text-sm text-slate-300 overflow-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
        <p className="text-xs text-amber-400 mt-2">
          {t('soc.signals.read_only_notice')}
        </p>
      </div>

      {/* Whale Detection */}
      {whaleDetection && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.signals.whale_detection')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Min Volume</p>
              <p className="text-2xl font-bold text-blue-400">{whaleDetection.min_volume || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Enabled</p>
              <p className="text-2xl font-bold text-green-400">
                {whaleDetection.enabled ? '✓' : '✗'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Dark Pool Detection */}
      {darkPoolDetection && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.signals.dark_pool')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Min Signal Count</p>
              <p className="text-2xl font-bold text-purple-400">{darkPoolDetection.min_signal_count || 0}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Enabled</p>
              <p className="text-2xl font-bold text-green-400">
                {darkPoolDetection.enabled ? '✓' : '✗'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics */}
      {metrics && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.signals.metrics')}</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Detection Rate</p>
              <p className="text-2xl font-bold text-green-400">{metrics.detection_rate || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">False Positive %</p>
              <p className="text-2xl font-bold text-orange-400">{metrics.false_positive_rate || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Avg Latency</p>
              <p className="text-2xl font-bold text-blue-400">{metrics.avg_signal_latency_ms || 0}ms</p>
            </div>
          </div>
        </div>
      )}

      {/* Ownership Info */}
      {ownership && (
        <OwnershipBadgeRow domain="signals" ownership={ownership} t={t} />
      )}
    </div>
  );
};

// NOTE: React 19 no longer runs propTypes validation at runtime.
// PropTypes kept for documentation and IDE tooling only.
SignalsPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default SignalsPanel;
