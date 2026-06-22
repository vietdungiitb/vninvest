import React, { useEffect, useState, useCallback, MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { coreApiAdapter } from '../adapters/coreApiAdapter.js';
import { useI18n } from '../context/LangContext.js';

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

const EMPTY_COND: Condition = { field: 'rsi_14', op: 'lt', value: '' };

interface Condition {
  field: string;
  op: string;
  value: string | number;
}

interface Rule {
  id?: number;
  name: string;
  rules_json: Condition[];
}

interface ScreenerResult {
  matched: ScreenerRow[];
  matched_count: number;
  total_scanned: number;
  rule_name: string;
  rule_id: number;
}

interface ScreenerRow {
  symbol: string;
  close: number | null;
  rsi_14: number | null;
  sma20: number | null;
  sma50: number | null;
  price_vs_sma20_pct: number | null;
  macd_hist: number | null;
  volume_rvol: number | null;
  momentum_20d_pct: number | null;
  date: string;
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return '\u2014';
  return typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(v);
}

interface ConditionRowProps {
  cond: Condition;
  onChange: (val: Condition) => void;
  onDelete: () => void;
  t: (key: string) => string;
  rowIndex: number;
}

function ConditionRow({ cond, onChange, onDelete, t, rowIndex }: ConditionRowProps) {
  const update = (key: string, val: string) => onChange({ ...cond, [key]: val });
  const fieldId = `screener-condition-field-${rowIndex}`;
  const opId = `screener-condition-op-${rowIndex}`;
  const valueId = `screener-condition-value-${rowIndex}`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      <label htmlFor={fieldId} className="sr-only">Trường điều kiện</label>
      <select
        id={fieldId}
        name={`condition_field_${rowIndex}`}
        value={cond.field}
        onChange={(e) => update('field', e.target.value)}
        style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', fontSize: '12px', borderRadius: '4px',
          padding: '4px 8px', outline: 'none',
        }}
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{t(`screener.fields.${f.key}`)}</option>
        ))}
      </select>
      <label htmlFor={opId} className="sr-only">Toán tử so sánh</label>
      <select
        id={opId}
        name={`condition_operator_${rowIndex}`}
        value={cond.op}
        onChange={(e) => update('op', e.target.value)}
        style={{
          background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', fontSize: '12px', borderRadius: '4px',
          padding: '4px 8px', outline: 'none',
        }}
      >
        {OP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{t(`screener.ops.${o.key}`)}</option>
        ))}
      </select>
      <label htmlFor={valueId} className="sr-only">Giá trị điều kiện</label>
      <input
        id={valueId}
        name={`condition_value_${rowIndex}`}
        type="number"
        value={cond.value}
        onChange={(e) => update('value', e.target.value)}
        placeholder={t('screener.valuePlaceholder')}
        aria-label="Giá trị điều kiện"
        style={{
          width: '112px', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-default)',
          color: 'var(--text-secondary)', fontSize: '12px', borderRadius: '4px',
          padding: '4px 8px', outline: 'none',
        }}
      />
      <button
        onClick={onDelete}
        style={{ color: 'var(--accent-red)', fontSize: '12px', padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
        title={t('screener.deleteCondition')}
      >
        ✕
      </button>
    </div>
  );
}

interface RuleEditorProps {
  initial: Rule | null;
  onSave: (data: Rule) => void;
  onCancel: () => void;
}

function RuleEditor({ initial, onSave, onCancel }: RuleEditorProps) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [conds, setConds] = useState<Condition[]>(
    initial?.rules_json?.length ? initial.rules_json.map((c) => ({ ...c })) : [{ ...EMPTY_COND }]
  );
  const [err, setErr] = useState('');

  const updateCond = (i: number, val: Condition) => setConds((prev) => prev.map((c, idx) => idx === i ? val : c));
  const deleteCond = (i: number) => setConds((prev) => prev.filter((_, idx) => idx !== i));
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
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
      borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px',
    }}>
      <div>
        <label htmlFor="screener-rule-name" style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
          {t('screener.ruleName')}
        </label>
        <input
          id="screener-rule-name"
          name="rule_name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('screener.ruleNamePlaceholder')}
          style={{
            width: '100%', background: 'rgba(15,23,42,0.6)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: '14px', borderRadius: '4px',
            padding: '8px 12px', outline: 'none',
          }}
        />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>
          {t('screener.conditionsLabel')}
        </label>
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
          style={{ fontSize: '12px', color: 'var(--accent-cyan)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', marginTop: '4px' }}
        >
          {t('screener.addCondition')}
        </button>
      </div>
      {err && <p style={{ color: 'var(--accent-red)', fontSize: '12px' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button
          onClick={handleSave}
          style={{
            padding: '6px 16px', background: 'var(--accent-cyan)', color: '#fff', fontSize: '14px',
            borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
          }}
        >
          {t('screener.saveRule')}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 16px', background: 'rgba(15,23,42,0.8)', color: 'var(--text-secondary)', fontSize: '14px',
            borderRadius: '8px', border: '1px solid var(--border-default)', cursor: 'pointer',
          }}
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
}

interface ResultsTableProps {
  results: ScreenerResult;
}

function ResultsTable({ results }: ResultsTableProps) {
  const { t, formatNumber } = useI18n();
  const { matched, matched_count, total_scanned, rule_name } = results;

  return (
    <div style={{
      background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
      borderRadius: '12px', padding: '20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>{rule_name}</h3>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{formatNumber(matched_count)}</span> {t('screener.matched')} /{' '}
          {formatNumber(total_scanned)} {t('screener.scannedSymbols')}
        </div>
      </div>
      {matched.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
          {t('screener.noMatchedSymbols')}
        </p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', fontWeight: 500 }}>{t('screener.columns.symbol')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.price')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.rsi14')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.sma20')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.sma50')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.pctSma20')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.macdHist')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.rvol')}</th>
                <th style={{ paddingBottom: '8px', paddingRight: '16px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.momentum20d')}</th>
                <th style={{ paddingBottom: '8px', textAlign: 'right', fontWeight: 500 }}>{t('screener.columns.date')}</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((row: ScreenerRow) => (
                <tr key={row.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', transition: 'background 0.2s' }}
                    onMouseEnter={(e: MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e: MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '8px 16px 8px 0', fontWeight: 'bold', color: 'var(--accent-cyan)' }}>
                    <Link to={`/stocks/${row.symbol}`} style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
                      {row.symbol}
                    </Link>
                  </td>
                  <td style={{ padding: '8px 16px 8px 0', textAlign: 'right', color: 'var(--text-primary)' }}>{fmtNum(row.close)}</td>
                  <td style={{
                    padding: '8px 16px 8px 0', textAlign: 'right', fontWeight: 500,
                    color: row.rsi_14 !== null && row.rsi_14 < 30 ? '#4ade80' : row.rsi_14 !== null && row.rsi_14 > 70 ? '#f87171' : 'var(--text-secondary)'
                  }}>{fmtNum(row.rsi_14)}</td>
                  <td style={{ padding: '8px 16px 8px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{fmtNum(row.sma20)}</td>
                  <td style={{ padding: '8px 16px 8px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{fmtNum(row.sma50)}</td>
                  <td style={{
                    padding: '8px 16px 8px 0', textAlign: 'right',
                    color: (row.price_vs_sma20_pct ?? 0) > 0 ? '#4ade80' : '#f87171'
                  }}>{fmtNum(row.price_vs_sma20_pct)}%</td>
                  <td style={{
                    padding: '8px 16px 8px 0', textAlign: 'right', fontWeight: 500,
                    color: row.macd_hist == null ? 'var(--text-muted)' : (row.macd_hist ?? 0) > 0 ? '#34d399' : '#fb7185'
                  }}>{row.macd_hist != null ? fmtNum(row.macd_hist) : '\u2014'}</td>
                  <td style={{
                    padding: '8px 16px 8px 0', textAlign: 'right',
                    color: row.volume_rvol == null ? 'var(--text-muted)' : (row.volume_rvol ?? 0) >= 2 ? '#fbbf24' : 'var(--text-muted)',
                    fontWeight: (row.volume_rvol ?? 0) >= 2 ? 600 : 400,
                  }}>{row.volume_rvol != null ? `${fmtNum(row.volume_rvol)}\u00d7` : '\u2014'}</td>
                  <td style={{
                    padding: '8px 16px 8px 0', textAlign: 'right',
                    color: (row.momentum_20d_pct ?? 0) > 0 ? '#4ade80' : '#f87171'
                  }}>{fmtNum(row.momentum_20d_pct)}%</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-muted)' }}>{row.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function ScreenerPage() {
  const { t, formatNumber } = useI18n();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Rule | 'new' | null>(null);
  const [running, setRunning] = useState<number | null>(null);
  const [results, setResults] = useState<ScreenerResult | null>(null);
  const [error, setError] = useState('');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await (coreApiAdapter as any).getScreenerRules();
      setRules(Array.isArray(data) ? data : data.results || []);
    } catch {
      setError(t('screener.errors.loadRulesFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleSave = async (formData: Rule) => {
    try {
      if (editing === 'new') {
        await (coreApiAdapter as any).createScreenerRule(formData);
      } else {
        await (coreApiAdapter as any).updateScreenerRule((editing as Rule).id, formData);
      }
      setEditing(null);
      await loadRules();
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.saveRuleFailed'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('screener.deleteRuleConfirm'))) return;
    try {
      await (coreApiAdapter as any).deleteScreenerRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (results?.rule_id === id) setResults(null);
    } catch {
      setError(t('screener.errors.deleteRuleFailed'));
    }
  };

  const handleRun = async (rule: Rule) => {
    setRunning(rule.id ?? null);
    setResults(null);
    setError('');
    try {
      const data = await (coreApiAdapter as any).runScreenerRule(rule.id);
      setResults(data);
    } catch (err: unknown) {
      const errResp = err as { response?: { data?: { detail?: string } } };
      setError(errResp?.response?.data?.detail || t('screener.errors.runRuleFailed'));
    } finally {
      setRunning(null);
    }
  };

  const pageStyle: React.CSSProperties = {
    padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px',
    maxWidth: '1200px', margin: '0 auto',
  };

  return (
    <div style={pageStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{t('screener.title')}</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {t('screener.subtitle')}
          </p>
        </div>
        {editing == null && (
          <button
            onClick={() => setEditing('new')}
            style={{
              padding: '8px 16px', background: 'var(--accent-cyan)', color: '#fff',
              fontSize: '14px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 600,
            }}
          >
            {t('screener.createRule')}
          </button>
        )}
      </div>

      {error && (
        <div style={{
          background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)',
          color: '#fca5a5', fontSize: '14px', padding: '12px 16px', borderRadius: '8px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError('')}
            style={{ color: '#fca5a5', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            ✕
          </button>
        </div>
      )}

      {editing != null && (
        <RuleEditor
          initial={editing === 'new' ? null : editing as Rule}
          onSave={handleSave}
          onCancel={() => setEditing(null)}
        />
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[1, 2].map((i) => (
            <div key={i} style={{
              height: '64px', background: 'rgba(15,23,42,0.4)', borderRadius: '12px',
              animation: 'pulse 2s infinite',
            }} />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div style={{
          background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
          borderRadius: '12px', padding: '40px', textAlign: 'center',
          color: 'var(--text-muted)', fontSize: '14px',
        }}>
          {t('screener.noRules')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map((rule) => (
            <div key={rule.id} style={{
              background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
              borderRadius: '12px', padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1', minWidth: '0' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleRun(rule)}
                    disabled={running === rule.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                      background: running === rule.id ? 'rgba(74,222,128,0.3)' : 'rgba(74,222,128,0.2)',
                      border: '1px solid rgba(74,222,128,0.3)', color: '#4ade80', fontSize: '12px',
                      borderRadius: '8px', cursor: running === rule.id ? 'not-allowed' : 'pointer',
                      fontWeight: 500, opacity: running === rule.id ? 0.6 : 1,
                    }}
                  >
                    {running === rule.id ? (
                      <>
                        <span style={{
                          width: '12px', height: '12px', border: '2px solid rgba(74,222,128,0.3)',
                          borderTopColor: '#4ade80', borderRadius: '50%', display: 'inline-block',
                          animation: 'spin 1s linear infinite',
                        }} />
                        {t('screener.running')}
                      </>
                    ) : t('screener.run')}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    style={{
                      padding: '6px 12px', background: 'rgba(15,23,42,0.6)',
                      border: '1px solid var(--border-default)', color: 'var(--text-secondary)',
                      fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    {t('common.edit')}
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id!)}
                    style={{
                      padding: '6px 12px', background: 'rgba(239,68,68,0.15)',
                      border: '1px solid rgba(239,68,68,0.3)', color: '#f87171',
                      fontSize: '12px', borderRadius: '8px', cursor: 'pointer',
                    }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {results && <ResultsTable results={results} />}
    </div>
  );
}
