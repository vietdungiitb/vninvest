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

// ─── constants ────────────────────────────────────────────────────────────────

const FIELD_OPTIONS = [
  { value: 'close',               label: 'Giá đóng cửa' },
  { value: 'volume',              label: 'Khối lượng' },
  { value: 'rsi_14',              label: 'RSI(14)' },
  { value: 'sma20',               label: 'SMA 20' },
  { value: 'sma50',               label: 'SMA 50' },
  { value: 'price_vs_sma20_pct',  label: '% so SMA20' },
  { value: 'price_vs_sma50_pct',  label: '% so SMA50' },
  { value: 'momentum_20d_pct',    label: 'Momentum 20 ngày (%)' },
  { value: 'range_position_pct',  label: 'Vị trí trong biên độ 52 tuần (%)' },
  { value: 'avg_volume_20',       label: 'TB khối lượng 20 ngày' },
];

const OP_OPTIONS = [
  { value: 'lt',  label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'gt',  label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'eq',  label: '=' },
];

const EMPTY_COND = { field: 'rsi_14', op: 'lt', value: '' };

// ─── helper ───────────────────────────────────────────────────────────────────

function fmtNum(v) {
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? v.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : v;
}

// ─── sub-components ───────────────────────────────────────────────────────────

function ConditionRow({ cond, onChange, onDelete }) {
  const update = (key, val) => onChange({ ...cond, [key]: val });
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={cond.field}
        onChange={(e) => update('field', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
      <select
        value={cond.op}
        onChange={(e) => update('op', e.target.value)}
        className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      >
        {OP_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <input
        type="number"
        value={cond.value}
        onChange={(e) => update('value', e.target.value)}
        placeholder="Giá trị"
        className="w-28 bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-brand-500"
      />
      <button
        onClick={onDelete}
        className="text-red-500 hover:text-red-400 text-xs px-1"
        title="Xóa điều kiện"
      >
        ✕
      </button>
    </div>
  );
}

function RuleEditor({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [conds, setConds] = useState(
    initial?.rules_json?.length ? initial.rules_json.map((c) => ({ ...c })) : [{ ...EMPTY_COND }]
  );
  const [err, setErr] = useState('');

  const updateCond = (i, val) => setConds((prev) => prev.map((c, idx) => idx === i ? val : c));
  const deleteCond = (i) => setConds((prev) => prev.filter((_, idx) => idx !== i));
  const addCond = () => setConds((prev) => [...prev, { ...EMPTY_COND }]);

  const handleSave = () => {
    if (!name.trim()) { setErr('Tên rule không được để trống.'); return; }
    for (const c of conds) {
      if (c.value === '' || c.value === null) { setErr('Giá trị điều kiện không được để trống.'); return; }
      if (isNaN(Number(c.value))) { setErr('Giá trị điều kiện phải là số.'); return; }
    }
    setErr('');
    onSave({ name: name.trim(), rules_json: conds.map((c) => ({ ...c, value: Number(c.value) })) });
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 space-y-4">
      <div>
        <label className="text-xs text-gray-400 mb-1 block">Tên rule</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="VD: RSI oversold + xu hướng tăng"
          className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-brand-500"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs text-gray-400 block">Điều kiện lọc (AND logic)</label>
        {conds.map((c, i) => (
          <ConditionRow
            key={i}
            cond={c}
            onChange={(val) => updateCond(i, val)}
            onDelete={() => deleteCond(i)}
          />
        ))}
        <button
          onClick={addCond}
          className="text-xs text-brand-400 hover:text-brand-300 mt-1"
        >
          + Thêm điều kiện
        </button>
      </div>
      {err && <p className="text-red-400 text-xs">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
        >
          Lưu rule
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm rounded-lg transition-colors"
        >
          Hủy
        </button>
      </div>
    </div>
  );
}

function ResultsTable({ results }) {
  if (!results) return null;
  const { matched, matched_count, total_scanned, rule_name } = results;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-300">{rule_name}</h3>
        <div className="text-xs text-gray-500">
          <span className="text-green-400 font-bold">{matched_count}</span> khớp /{' '}
          {total_scanned} mã được quét
        </div>
      </div>
      {matched.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-6">Không có mã nào khớp điều kiện.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="pb-2 pr-4 font-medium">Mã</th>
                <th className="pb-2 pr-4 text-right font-medium">Giá</th>
                <th className="pb-2 pr-4 text-right font-medium">RSI(14)</th>
                <th className="pb-2 pr-4 text-right font-medium">SMA20</th>
                <th className="pb-2 pr-4 text-right font-medium">SMA50</th>
                <th className="pb-2 pr-4 text-right font-medium">%SMA20</th>
                <th className="pb-2 pr-4 text-right font-medium">Mom.20d%</th>
                <th className="pb-2 text-right font-medium">Ngày</th>
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
      setError('Không tải được danh sách rule.');
    } finally {
      setLoading(false);
    }
  }, []);

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
      setError(err.response?.data?.detail || 'Lưu rule thất bại.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xóa rule này?')) return;
    try {
      await deleteScreenerRule(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
      if (results?.rule_id === id) setResults(null);
    } catch {
      setError('Xóa rule thất bại.');
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
      setError(err.response?.data?.detail || 'Chạy screener thất bại.');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-100">Screener cổ phiếu</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Tạo bộ lọc theo chỉ số kỹ thuật, quét toàn bộ dữ liệu giá.
          </p>
        </div>
        {editing == null && (
          <button
            onClick={() => setEditing('new')}
            className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm rounded-lg transition-colors"
          >
            + Tạo rule mới
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
          Chưa có rule nào. Nhấn "+ Tạo rule mới" để bắt đầu.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-100">{rule.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {Array.isArray(rule.rules_json) ? rule.rules_json.length : '?'} điều kiện
                    {' · '}
                    {Array.isArray(rule.rules_json) ? rule.rules_json.map((c) => {
                      const f = FIELD_OPTIONS.find((o) => o.value === c.field)?.label ?? c.field;
                      const op = OP_OPTIONS.find((o) => o.value === c.op)?.label ?? c.op;
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
                        Đang quét...
                      </>
                    ) : 'Chạy Screener'}
                  </button>
                  <button
                    onClick={() => setEditing(rule)}
                    className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="px-3 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-400 text-xs rounded-lg transition-colors"
                  >
                    Xóa
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
