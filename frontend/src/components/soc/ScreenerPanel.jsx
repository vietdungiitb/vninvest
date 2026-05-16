/**
 * ScreenerPanel.jsx — Global screener rules (full CRUD) and alerts
 */
import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { socApi } from '../../api/socApi';
import { ConfigPreviewModal } from './ConfigPreviewModal';

const RULE_TYPES = [
  'price_change_pct', 'volume_spike_ratio', 'cvd_threshold', 'whale_count',
  'dark_pool_ratio', 'rsi_level', 'ma_cross', 'bollinger_band_break', 'custom',
];

const CONFIG_FIELDS = [
  { key: 'scan_interval_seconds', label: 'Scan Interval (s)' },
  { key: 'max_symbols_per_scan', label: 'Max Symbols / Scan' },
  { key: 'alert_cooldown_seconds', label: 'Alert Cooldown (s)' },
  { key: 'max_alerts_per_symbol_per_hour', label: 'Max Alerts / Symbol / Hr' },
  { key: 'result_retention_hours', label: 'Result Retention (hr)' },
];

const DEFAULT_RULE_FORM = { name: '', type: 'custom', value: '', enabled: true };

const ScreenerPanel = ({ t }) => {
  const [config, setConfig] = useState(null);
  const [draftConfig, setDraftConfig] = useState({});
  const [rules, setRules] = useState([]);
  const [results, setResults] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Config preview modal
  const [showConfigPreview, setShowConfigPreview] = useState(false);
  const [isConfigSubmitting, setIsConfigSubmitting] = useState(false);

  // Rule CRUD modal
  const [editingRule, setEditingRule] = useState(null); // null = closed, {} = new, {...} = edit
  const [ruleForm, setRuleForm] = useState(DEFAULT_RULE_FORM);
  const [ruleError, setRuleError] = useState(null);
  const [isSavingRule, setIsSavingRule] = useState(false);

  // Manual scan
  const [scanSymbols, setScanSymbols] = useState('');
  const [scanStatus, setScanStatus] = useState(null);
  const [isScanning, setIsScanning] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [cfg, rls, rslts, alts, mtr] = await Promise.all([
        socApi.getScreenerConfig(),
        socApi.getScreenerRules(),
        socApi.getScreenerResults(),
        socApi.getScreenerAlerts(),
        socApi.getScreenerMetrics(),
      ]);
      const c = cfg.config || {};
      setConfig(c);
      setDraftConfig({ ...c });
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
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ---- Config handlers ---- */
  const handleOpenConfigPreview = () => setShowConfigPreview(true);

  const handleApplyConfig = async () => {
    try {
      setIsConfigSubmitting(true);
      await socApi.applyScreenerConfig(draftConfig);
      setConfig({ ...draftConfig });
      setShowConfigPreview(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsConfigSubmitting(false);
    }
  };

  /* ---- Rule CRUD handlers ---- */
  const openNewRule = () => {
    setRuleForm(DEFAULT_RULE_FORM);
    setRuleError(null);
    setEditingRule('new');
  };

  const openEditRule = (rule) => {
    setRuleForm({
      name: rule.name || '',
      type: rule.type || 'custom',
      value: rule.value ? JSON.stringify(rule.value) : '',
      enabled: rule.enabled !== false,
    });
    setRuleError(null);
    setEditingRule(rule.id);
  };

  const parseRuleValue = (raw) => {
    if (!raw || raw.trim() === '') return null;
    try { return JSON.parse(raw); } catch { return raw; }
  };

  const handleSaveRule = async () => {
    if (!ruleForm.name.trim()) {
      setRuleError(t('soc.screener.rule_name_required'));
      return;
    }
    setIsSavingRule(true);
    setRuleError(null);
    const payload = {
      name: ruleForm.name.trim(),
      type: ruleForm.type,
      value: parseRuleValue(ruleForm.value),
      enabled: ruleForm.enabled,
    };
    try {
      if (editingRule === 'new') {
        await socApi.createScreenerRule(payload);
      } else {
        await socApi.updateScreenerRule(editingRule, payload);
      }
      setEditingRule(null);
      await fetchData();
    } catch (err) {
      setRuleError(err.message);
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm(t('soc.screener.rule_delete_confirm'))) return;
    try {
      await socApi.deleteScreenerRule(ruleId);
      await fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  /* ---- Manual scan handler ---- */
  const handleManualScan = async () => {
    const symbols = scanSymbols.split(/[\s,]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    if (symbols.length === 0) {
      setScanStatus(t('soc.screener.scan_symbols_required'));
      return;
    }
    setIsScanning(true);
    setScanStatus(null);
    try {
      const result = await socApi.manualScan(symbols);
      setScanStatus(result?.status || t('soc.screener.scan_queued'));
    } catch (err) {
      setScanStatus(err.message);
    } finally {
      setIsScanning(false);
    }
  };

  if (loading) return <p className="text-slate-400">{t('soc.pages.status_loading')}</p>;

  const changeSummary = Object.keys(draftConfig).filter(
    (k) => JSON.stringify(config?.[k]) !== JSON.stringify(draftConfig[k]),
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">{t('soc.screener.title')}</h2>
      </div>

      {error && (
        <div className="bg-red-900 border border-red-700 p-4 rounded-lg">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Config Form */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">{t('soc.screener.config')}</h3>
          <button
            onClick={handleOpenConfigPreview}
            className="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-white text-sm"
          >
            {t('soc.actions.preview')}
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CONFIG_FIELDS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-slate-400 mb-1">{label}</label>
              <input
                type="number"
                value={draftConfig[key] ?? ''}
                onChange={(e) => setDraftConfig((prev) => ({ ...prev, [key]: e.target.value === '' ? '' : Number(e.target.value) }))}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Manual Scan */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <h3 className="text-lg font-bold text-white mb-4">{t('soc.screener.manual_scan')}</h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={scanSymbols}
            onChange={(e) => setScanSymbols(e.target.value)}
            placeholder="VCB, VNM, FPT, ..."
            className="flex-1 rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-green-500 focus:outline-none"
          />
          <button
            onClick={handleManualScan}
            disabled={isScanning}
            className="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:opacity-50 rounded text-white text-sm"
          >
            {isScanning ? t('soc.screener.scanning') : t('soc.screener.scan_run')}
          </button>
        </div>
        {scanStatus && <p className="mt-2 text-sm text-green-300">{scanStatus}</p>}
      </div>

      {/* Rules CRUD Table */}
      <div className="p-6 bg-slate-900 rounded-lg border border-slate-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white">
            {t('soc.screener.rules')} ({rules.length})
          </h3>
          <button
            onClick={openNewRule}
            className="px-4 py-2 bg-indigo-700 hover:bg-indigo-600 rounded text-white text-sm"
          >
            {t('soc.screener.rule_add')}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left p-2 text-slate-300">{t('soc.screener.rule_name')}</th>
                <th className="text-left p-2 text-slate-300">{t('soc.screener.rule_type')}</th>
                <th className="text-left p-2 text-slate-300">{t('soc.screener.rule_enabled')}</th>
                <th className="text-right p-2 text-slate-300">{t('soc.actions.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-b border-slate-800 hover:bg-slate-800/40">
                  <td className="p-2 text-slate-100 font-medium">{rule.name}</td>
                  <td className="p-2 text-slate-300">{rule.type}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${rule.enabled ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                      {rule.enabled ? t('soc.screener.rule_active') : t('soc.screener.rule_inactive')}
                    </span>
                  </td>
                  <td className="p-2 text-right space-x-2">
                    <button
                      onClick={() => openEditRule(rule)}
                      className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-white text-xs"
                    >
                      {t('soc.actions.edit')}
                    </button>
                    <button
                      onClick={() => handleDeleteRule(rule.id)}
                      className="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-red-200 text-xs"
                    >
                      {t('soc.actions.delete')}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={4} className="p-4 text-slate-500 text-center">{t('soc.screener.rules_empty')}</td></tr>
              )}
            </tbody>
          </table>
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
          {alerts.length === 0 && <p className="text-slate-500 text-sm">{t('soc.screener.alerts_empty')}</p>}
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

      {/* Config Preview Modal */}
      <ConfigPreviewModal
        isOpen={showConfigPreview}
        before={config}
        after={draftConfig}
        onClose={() => setShowConfigPreview(false)}
        onConfirm={handleApplyConfig}
        changeSummary={changeSummary}
        impactWarnings={[]}
        validationErrors={null}
        domain="screener"
        isSubmitting={isConfigSubmitting}
        t={t}
      />

      {/* Rule Edit Modal */}
      {editingRule !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-4">
              {editingRule === 'new' ? t('soc.screener.rule_add') : t('soc.screener.rule_edit')}
            </h3>

            {ruleError && <p className="text-red-300 text-sm mb-3">{ruleError}</p>}

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('soc.screener.rule_name')}</label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('soc.screener.rule_type')}</label>
                <select
                  value={ruleForm.type}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, type: e.target.value }))}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {RULE_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">{t('soc.screener.rule_value')} (JSON)</label>
                <textarea
                  value={ruleForm.value}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, value: e.target.value }))}
                  rows={3}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  placeholder='[{"field": "...", "op": "gte", "value": 1}]'
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ruleForm.enabled}
                  onChange={(e) => setRuleForm((prev) => ({ ...prev, enabled: e.target.checked }))}
                  className="accent-green-500"
                />
                <span className="text-sm text-slate-200">{t('soc.screener.rule_enabled')}</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-white text-sm"
              >
                {t('soc.actions.cancel')}
              </button>
              <button
                onClick={handleSaveRule}
                disabled={isSavingRule}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 rounded text-white text-sm"
              >
                {isSavingRule ? t('soc.actions.saving') : t('soc.actions.save')}
              </button>
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
