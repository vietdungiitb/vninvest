/**
 * DNSEBackfillPanel — SOC Admin panel để trigger DNSE intraday tick backfill.
 * D07 implementation: system backfill (admin-only) + user backfill trigger.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { triggerSystemBackfill, triggerUserBackfill } from '../../api/client';

const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_SYSTEM_FORM = {
  symbol: '',
  trade_date: TODAY,
};

const DEFAULT_USER_FORM = {
  symbol: '',
  trade_date: TODAY,
};

// ── System Backfill Section ─────────────────────────────────────────────────
const SystemBackfillSection = ({ t }) => {
  const [form, setForm] = useState(DEFAULT_SYSTEM_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await triggerSystemBackfill({ symbol: form.symbol.toUpperCase(), trade_date: form.trade_date });
      setResult(resp.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || t('dnse_backfill.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <h3 className="mb-4 text-base font-bold text-white">
        🖥️ {t('dnse_backfill.system_section_title')}
      </h3>
      <p className="mb-4 text-sm text-slate-400">{t('dnse_backfill.system_section_desc')}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">{t('dnse_backfill.field_symbol')}</label>
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
            placeholder="HPG"
            maxLength={10}
            required
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">{t('dnse_backfill.field_trade_date')}</label>
          <input
            type="date"
            value={form.trade_date}
            onChange={(e) => setForm((p) => ({ ...p, trade_date: e.target.value }))}
            required
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !form.symbol}
          className="rounded bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('dnse_backfill.btn_triggering') : t('dnse_backfill.btn_trigger_system')}
        </button>
      </form>

      {result && (
        <div className={`mt-4 rounded border p-3 text-sm ${
          result.status === 'ok' ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300' :
          result.status === 'accepted' ? 'border-blue-700 bg-blue-900/30 text-blue-300' :
          'border-slate-600 bg-slate-800 text-slate-300'
        }`}>
          <span className="font-semibold">{t('dnse_backfill.result_status')}: {result.status}</span>
          {result.ticks !== undefined && (
            <span className="ml-3">{t('dnse_backfill.result_ticks')}: {result.ticks}</span>
          )}
          {result.reason && (
            <span className="ml-3 text-slate-400">({result.reason})</span>
          )}
          {result.task_id && (
            <span className="ml-3 text-slate-400">task: {result.task_id}</span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

// ── User Backfill Section ───────────────────────────────────────────────────
const UserBackfillSection = ({ t }) => {
  const [form, setForm] = useState(DEFAULT_USER_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await triggerUserBackfill({ symbol: form.symbol.toUpperCase(), trade_date: form.trade_date });
      setResult(resp.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || t('dnse_backfill.error_generic'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <h3 className="mb-4 text-base font-bold text-white">
        👤 {t('dnse_backfill.user_section_title')}
      </h3>
      <p className="mb-4 text-sm text-slate-400">{t('dnse_backfill.user_section_desc')}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">{t('dnse_backfill.field_symbol')}</label>
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
            placeholder="HPG"
            maxLength={10}
            required
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 w-32"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">{t('dnse_backfill.field_trade_date')}</label>
          <input
            type="date"
            value={form.trade_date}
            onChange={(e) => setForm((p) => ({ ...p, trade_date: e.target.value }))}
            required
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !form.symbol}
          className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? t('dnse_backfill.btn_triggering') : t('dnse_backfill.btn_trigger_user')}
        </button>
      </form>

      {result && (
        <div className={`mt-4 rounded border p-3 text-sm ${
          result.status === 'ok' ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300' :
          result.status === 'accepted' ? 'border-blue-700 bg-blue-900/30 text-blue-300' :
          'border-slate-600 bg-slate-800 text-slate-300'
        }`}>
          <span className="font-semibold">{t('dnse_backfill.result_status')}: {result.status}</span>
          {result.ticks !== undefined && (
            <span className="ml-3">{t('dnse_backfill.result_ticks')}: {result.ticks}</span>
          )}
          {result.reason && (
            <span className="ml-3 text-slate-400">({result.reason})</span>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded border border-red-700 bg-red-900/30 p-3 text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const DNSEBackfillPanel = ({ t }) => {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-4">
        <p className="text-sm text-blue-300">
          ℹ️ {t('dnse_backfill.info_banner')}
        </p>
      </div>

      <SystemBackfillSection t={t} />
      <UserBackfillSection t={t} />
    </div>
  );
};

DNSEBackfillPanel.propTypes = {
  t: PropTypes.func.isRequired,
};

export default DNSEBackfillPanel;
