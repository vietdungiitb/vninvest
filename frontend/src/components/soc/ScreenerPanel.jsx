/**
 * ScreenerPanel.jsx — Global screener rules and alerts
 */
import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../api/socApi';

const ScreenerPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [cfg, rls, rslts, alts, mtr] = await Promise.all([
          socApi.getScreenerConfig(),
          socApi.getScreenerRules(),
          socApi.getScreenerResults(),
          socApi.getScreenerAlerts(),
          socApi.getScreenerMetrics(),
        ]);
        setConfig(cfg.config || {});
        setRules(rls.results || []);
        setResults(rslts.results || []);
        setAlerts(alts.results || []);
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

  const handleManualScan = async () => {
    try {
      await socApi.manualScan(rules.map(r => r.id));
      alert(t('soc.actions.success'));
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.screener.title')}</h2>
        <button
          onClick={handleManualScan}
          className="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-white text-sm"
        >
          {t('soc.screener.manual_scan')}
        </button>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.screener.config')}</h3>
        <pre className="bg-slate-800 p-4 rounded text-sm text-slate-300 overflow-auto">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>

      {/* Rules */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">
          {t('soc.screener.rules')} ({rules.length})
        </h3>
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="bg-slate-800 p-3 rounded">
              <div className="flex justify-between items-center">
                <p className="font-bold text-slate-100">{rule.name}</p>
                <span className={`px-2 py-1 rounded text-xs font-bold ${rule.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-900 text-gray-300'}`}>
                  {rule.enabled ? '✓' : '✗'}
                </span>
              </div>
              <p className="text-xs text-slate-400">{rule.type}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Results */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">
          {t('soc.screener.results')} ({results.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-2 text-slate-300">Symbol</th>
                <th className="text-left p-2 text-slate-300">Rule</th>
                <th className="text-left p-2 text-slate-300">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, idx) => (
                <tr key={idx} className="border-b border-slate-800">
                  <td className="p-2 text-slate-100">{result.symbol}</td>
                  <td className="p-2 text-slate-100">{result.rule_name}</td>
                  <td className="p-2 text-slate-400">{result.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Alerts */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">
          {t('soc.screener.alerts')} ({alerts.length})
        </h3>
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div key={idx} className="bg-red-900 bg-opacity-20 border border-red-700 p-3 rounded">
              <p className="text-red-300 font-bold">{alert.symbol}</p>
              <p className="text-xs text-red-200">{alert.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics */}
      {metrics && (
        <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-4">{t('soc.screener.metrics')}</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-slate-400">Avg Scan Duration</p>
              <p className="text-2xl font-bold text-blue-400">{metrics.avg_scan_duration_ms || 0}ms</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Rules Hit Rate</p>
              <p className="text-2xl font-bold text-green-400">{metrics.rules_hit_rate || 0}%</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

ScreenerPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default ScreenerPanel;
