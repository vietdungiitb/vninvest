/**
 * pages/Screener.jsx
 * Trang Screener cổ phiếu — tạo/quản lý rule và chạy quét toàn thị trường.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  getScreenerRules,
  createScreenerRule,
  updateScreenerRule,
  deleteScreenerRule,
  runScreenerRule,
} from '../api/client';
import { useI18n } from '../context/LangContext';

// ─── constants ────────────────────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: 'close', key: 'close' },
  { value: 'volume', key: 'volume' },
  { value: 'rsi_14', key: 'rsi14' },
  { value: 'sma20', key: 'sma20' },
  { value: 'sma50', key: 'sma50' },
  { value: 'price_vs_sma20_pct', key: 'priceVsSma20Pct' },
  { value: 'price_vs_sma50_pct', key: 'priceVsSma50Pct' },
  { value: 'sma20_vs_sma50_pct', key: 'sma20VsSma50Pct' },
  { value: 'macd_hist', key: 'macdHist' },
  { value: 'volume_rvol', key: 'volumeRvol' },
  { value: 'momentum_20d_pct', key: 'momentum20dPct' },
  { value: 'range_position_pct', key: 'rangePositionPct' },
  { value: 'avg_volume_20', key: 'avgVolume20' },
];

const OP_OPTIONS = [
  { value: 'lt', key: 'lt' },
  { value: 'lte', key: 'lte' },
  { value: 'gt', key: 'gt' },
  { value: 'gte', key: 'gte' },
  { value: 'eq', key: 'eq' },
];

const EMPTY_COND = { field: 'rsi_14', op: 'lt', value: '' };

// ─── helper ───────────────────────────────────────────────────────────────────

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ConditionRow({ cond, onChange, onDelete, t, rowIndex }) {
  const update = (key, val) => onChange({ ...cond, [key]: val });
  const fieldId = `screener-condition-field-${rowIndex}`;
  const opId = `screener-condition-op-${rowIndex}`;
  const valueId = `screener-condition-value-${rowIndex}`;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <label htmlFor={fieldId} className="sr-only">Truong dieu kien</label>
      <select
        id={fieldId}
        name={`condition_field_${rowIndex}`}
        value={cond.field}
        onChange={(e) => update('field', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{t(`screener.fields.${f.key}`)}</option>
        ))}
      </select>
      <label htmlFor={opId} className="sr-only">Toan tu so sanh</label>
      <select
        id={opId}
        name={`condition_operator_${rowIndex}`}
        value={cond.op}
        onChange={(e) => update('op', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      >
        {OP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{t(`screener.ops.${o.key}`)}</option>
        ))}
      </select>
      <label htmlFor={valueId} className="sr-only">Gia tri dieu kien</label>
      <input
        id={valueId}
        name={`condition_value_${rowIndex}`}
        type="number"
        value={cond.value}
        onChange={(e) => update('value', e.target.value)}
        placeholder={t('screener.valuePlaceholder')}
        aria-label="Gia tri dieu kien"
        className="w-28 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      />
      <button
        onClick={onDelete}
        className="text-red-500 hover:text-red-400 text-xs px-1"
        title={t('screener.deleteCondition')}
      >
        ✕
      </button>
    </div>
  );
}

function RuleEditor({ initial, onSave, onCancel }) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [conds, setConds] = useState(
    initial?.rules_json?.length ? initial.rules_json.map((c) => ({ ...c })) : [{ ...EMPTY_COND }]
  );
  const [err, setErr] = useState('');

  const updateCond = (i, val) => setConds((prev) => prev.map((c, idx) => idx === i ? val : c));
  const deleteCond = (i) => setConds((prev) => prev.filter((_, idx) => idx !== i));
  const addCond = () => setConds((prev) => [...prev, { ...EMPTY_COND }]);

  const handleSave = () => {
    if (!name.trim()) { setErr(t('screener.errors.nameRequired')); return; }
    for (const c of conds) {
      if (c.value === '' || c.value === null) { setErr(t('screener.errors.valueRequired')); return; }
      if (isNaN(Number(c.value))) { setErr(t('screener.errors.valueNumber')); return; }
    }
    setErr('');
    onSave({ name: name.trim(), rules_json: conds.map((c) => ({ ...c, value: Number(c.value) })) });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <div>
        <label htmlFor="screener-rule-name" className="text-xs text-gray-400 mb-1 block">{t('screener.ruleName')}</label>
        <input
          id="screener-rule-name"
          name="rule_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('screener.ruleNamePlaceholder')}
          className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-gray-400 block">{t('screener.conditionsLabel')}</label>
        {conds.map((c, i) => (
          <ConditionRow
            key={i}
            cond={c}
            rowIndex={i}
            onChange={(val) => updateCond(i, val)}
            onDelete={() => deleteCond(i)}
            t={t}
          />
        ))}
        <button
          onClick={addCond}
          className="text-xs text-brand-400 hover:text-brand-300 mt-1"
        >
          {t('screener.addCondition')}
        </button>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
        >
          {t('screener.saveRule')}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

function ResultsTable({ results }) {
  const { t, formatNumber } = useI18n();
  if (!results) return null;
  const { matched, matched_count, total_scanned, rule_name } = results;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">{rule_name}</h3>
        <div className="text-xs text-gray-500">
          <span className="text-green-400 font-bold">{formatNumber(matched_count)}</span> {t('screener.matched')} /{' '}
          {formatNumber(total_scanned)} {t('screener.scannedSymbols')}
        </div>
      </div>
      {matched.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">{t('screener.noMatchedSymbols')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">{t('screener.columns.symbol')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.price')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.rsi14')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.sma20')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.sma50')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.pctSma20')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.macdHist')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.rvol')}</th>
                <th className="pb-2 pr-4 text-right font-medium">{t('screener.columns.momentum20d')}</th>
                <th className="pb-2 text-right font-medium">{t('screener.columns.date')}</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((row) => (
                <tr key={row.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                  <td className="py-2 pr-4 font-bold text-brand-400">
                    <Link to={`/stocks/${row.symbol}`} className="hover:text-cyan-300 transition-colors">{row.symbol}</Link>
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-100">{fmtNum(row.close)}</td>
                  <td className={`py-2 pr-4 text-right font-medium ${
                    row.rsi_14 < 30 ? 'text-green-400' : row.rsi_14 > 70 ? 'text-red-400' : 'text-gray-300'
                  }`}>{fmtNum(row.rsi_14)}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{fmtNum(row.sma20)}</td>
                  <td className="py-2 pr-4 text-right text-gray-400">{fmtNum(row.sma50)}</td>
                  <td className={`py-2 pr-4 text-right ${
                    (row.price_vs_sma20_pct ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>{fmtNum(row.price_vs_sma20_pct)}%</td>
                  <td className={`py-2 pr-4 text-right font-medium ${
                    row.macd_hist == null ? 'text-gray-500' : (row.macd_hist ?? 0) > 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>{row.macd_hist != null ? fmtNum(row.macd_hist) : '—'}</td>
                  <td className={`py-2 pr-4 text-right ${
                    row.volume_rvol == null ? 'text-gray-500' : (row.volume_rvol ?? 0) >= 2 ? 'text-amber-400 font-semibold' : 'text-gray-400'
                  }`}>{row.volume_rvol != null ? `${fmtNum(row.volume_rvol)}×` : '—'}</td>
                  <td className={`py-2 pr-4 text-right ${
                    (row.momentum_20d_pct ?? 0) > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>{fmtNum(row.momentum_20d_pct)}%</td>
                  <td className="py-2 text-right text-gray-500">{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function Screener() {
  const { t, formatNumber } = useI18n();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);     // null | 'new' | rule object
  const [running, setRunning] = useState(null);     // rule id being run
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getScreenerRules();
      setRules(res.data);
    } catch {
      setError(t('screener.errors.loadRulesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSave = async (formData) => {
    try {
      if (editing === 'new') {
        await createScreenerRule(formData);
      } else {
        await updateScreenerRule(editing.id, formData);
      }
      setEditing(null);
      await loadRules();
    } catch (err) {
      setError(err.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('screener.deleteRuleConfirm'))) return;
    try {
      await deleteScreenerRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (results?.rule_id === id) setResults(null);
    } catch {
      setError(t('screener.errors.deleteRuleFailed'));
    }
  };

  const handleRun = async (rule) => {
    setRunning(rule.id);
    setResults(null);
    setError('');
    try {
      const res = await runScreenerRule(rule.id);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || t('screener.errors.runRuleFailed'));
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">{t('screener.title')}</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {t('screener.subtitle')}
          </p>
        </div>
        {editing == null && (
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            {t('screener.createRule')}
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm px-4 py-3 rounded-lg">
          {error}
          <button className="ml-3 text-red-400 hover:text-red-200 text-xs" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* Editor */}
      {editing != null && (
        <RuleEditor
          initial={editing === 'new' ? null : editing}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Rule list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-16 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-10 text-center text-gray-500 text-sm">
          {t('screener.noRules')}
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-100">{rule.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Array.isArray(rule.rules_json) ? formatNumber(rule.rules_json.length) : '?'} {t('screener.conditionsCount')}
                    {' · '}
                    {Array.isArray(rule.rules_json) ? rule.rules_json.map((c) => {
                      const fKey = FIELD_OPTIONS.find((o) => o.value === c.field)?.key;
                      const opKey = OP_OPTIONS.find((o) => o.value === c.op)?.key;
                      const f = fKey ? t(`screener.fields.${fKey}`) : c.field;
                      const op = opKey ? t(`screener.ops.${opKey}`) : c.op;
                      return `${f} ${op} ${c.value}`;
                    }).join(' AND ') : JSON.stringify(rule.rules_json)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleRun(rule)}
                    disabled={running === rule.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-50
                               text-white text-xs rounded-lg transition-colors font-medium"
                  >
                    {running === rule.id ? (
                      <>
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        {t('screener.running')}
                      </>
                    ) : t('screener.run')}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-400 text-xs rounded-lg transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {results && <ResultsTable results={results} />}
    </div>
  );
}
