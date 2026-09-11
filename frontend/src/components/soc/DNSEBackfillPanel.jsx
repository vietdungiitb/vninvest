/**
 * DNSEBackfillPanel — SOC Admin panel để trigger DNSE intraday tick backfill.
 * D07 v2: system backfill (admin-only, multi-criteria) + user backfill trigger.
 */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { triggerSystemBackfill, triggerUserBackfill } from '../../api/client';

const TODAY = new Date().toISOString().slice(0, 10);

// ── Dataset registry (DNSE system scope) ───────────────────────────────────
const DNSE_DATASETS = [
  { key: 'tape_intraday', supported: true },
  { key: 'session_facts', supported: false },
  { key: 'candle_intraday', supported: false },
];

// ── Symbol groups ───────────────────────────────────────────────────────────
const SYMBOL_GROUPS = ['vn30', 'vn50', 'vn100', 'hose', 'hnx', 'upcom', 'all', 'custom'];

const DEFAULT_SYSTEM_FORM = {
  datasets: ['tape_intraday'],
  symbols_group: 'vn30',
  symbol: '',
  from_date: TODAY,
  to_date: TODAY,
  mode: 'missing_only',
  dry_run: true,
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

  const toggleDataset = (key) => {
    setForm((prev) => {
      const active = prev.datasets.includes(key)
        ? prev.datasets.filter((d) => d !== key)
        : [...prev.datasets, key];
      return { ...prev, datasets: active };
    });
  };

  const validate = () => {
    const supportedSelected = form.datasets.filter((d) =>
      DNSE_DATASETS.find((ds) => ds.key === d && ds.supported),
    );
    if (supportedSelected.length === 0) return t('soc.dnse_backfill.error_no_dataset');
    if (form.from_date > form.to_date) return t('soc.dnse_backfill.error_date_range');
    if (form.symbols_group === 'custom' && !form.symbol.trim()) {
      return `${t('soc.dnse_backfill.field_symbol_custom')} là bắt buộc.`;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        datasets: form.datasets.filter((d) =>
          DNSE_DATASETS.find((ds) => ds.key === d && ds.supported),
        ),
        symbols_group: form.symbols_group,
        from_date: form.from_date,
        to_date: form.to_date,
        mode: form.mode,
        dry_run: form.dry_run,
      };
      if (form.symbols_group === 'custom') {
        payload.symbol = form.symbol.trim().toUpperCase();
      }
      const resp = await triggerSystemBackfill(payload);
      setResult(resp.data);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.message || t('soc.dnse_backfill.error_generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <h3 className="mb-1 text-base font-bold text-white">
        🖥️ {t('soc.dnse_backfill.system_section_title')}
      </h3>
      <p className="mb-5 text-sm text-slate-400">{t('soc.dnse_backfill.system_section_desc')}</p>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── Dataset checkboxes ──────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-300">
            {t('soc.dnse_backfill.field_datasets')}
          </p>
          <div className="flex flex-wrap gap-3">
            {DNSE_DATASETS.map(({ key, supported }) => (
              <label
                key={key}
                className={`flex items-start gap-2 rounded border px-3 py-2 text-sm select-none transition ${
                  supported
                    ? 'border-slate-600 bg-slate-800 hover:border-blue-500 cursor-pointer'
                    : 'border-slate-700 bg-slate-900 opacity-60 cursor-not-allowed'
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!supported}
                  checked={form.datasets.includes(key)}
                  onChange={() => supported && toggleDataset(key)}
                  className="mt-0.5 accent-blue-500"
                />
                <span>
                  <span className={supported ? 'text-white' : 'text-slate-400'}>
                    {t(`soc.dnse_backfill.dataset_${key}`)}
                  </span>
                  {key === 'tape_intraday' && (
                    <span className="block text-[11px] text-slate-400 mt-0.5">
                      {t('soc.dnse_backfill.dataset_tape_intraday_desc')}
                    </span>
                  )}
                  {!supported && (
                    <span className="block text-[11px] text-amber-400 mt-0.5">
                      {t('soc.dnse_backfill.dataset_coming_soon')}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* ── Symbol group radios ─────────────────────────────────────── */}
        <div>
          <p className="mb-2 text-xs font-medium text-slate-300">
            {t('soc.dnse_backfill.field_symbol_group')}
          </p>
          <div className="flex flex-wrap gap-2">
            {SYMBOL_GROUPS.map((g) => (
              <label
                key={g}
                className={`flex items-center gap-1.5 rounded border px-3 py-1.5 text-sm cursor-pointer transition ${
                  form.symbols_group === g
                    ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-400'
                }`}
              >
                <input
                  type="radio"
                  name="symbols_group"
                  value={g}
                  checked={form.symbols_group === g}
                  onChange={() => setForm((p) => ({ ...p, symbols_group: g, symbol: '' }))}
                  className="accent-blue-500"
                />
                {t(`soc.dnse_backfill.group_${g}`)}
              </label>
            ))}
          </div>
          {form.symbols_group === 'custom' && (
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">
                {t('soc.dnse_backfill.field_symbol_custom')}
              </label>
              <input
                type="text"
                value={form.symbol}
                onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
                placeholder="HPG"
                maxLength={10}
                className="w-36 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* ── Date range + Mode ───────────────────────────────────────── */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              {t('soc.dnse_backfill.field_from_date')}
            </label>
            <input
              type="date"
              value={form.from_date}
              onChange={(e) => setForm((p) => ({ ...p, from_date: e.target.value }))}
              onClick={(e) => { try { e.target.showPicker(); } catch {} }}
              onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              {t('soc.dnse_backfill.field_to_date')}
            </label>
            <input
              type="date"
              value={form.to_date}
              onChange={(e) => setForm((p) => ({ ...p, to_date: e.target.value }))}
              onClick={(e) => { try { e.target.showPicker(); } catch {} }}
              onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-300">
              {t('soc.dnse_backfill.field_mode')}
            </label>
            <select
              value={form.mode}
              onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}
              className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="missing_only">{t('soc.dnse_backfill.mode_missing_only')}</option>
              <option value="force_refresh">{t('soc.dnse_backfill.mode_force_refresh')}</option>
            </select>
          </div>
        </div>

        {/* ── Dry-run + Submit ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-amber-300">
            <input
              type="checkbox"
              checked={form.dry_run}
              onChange={(e) => setForm((p) => ({ ...p, dry_run: e.target.checked }))}
              className="accent-amber-400"
            />
            {t('soc.dnse_backfill.field_dry_run')}
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-700 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading
              ? t('soc.dnse_backfill.btn_triggering')
              : t('soc.dnse_backfill.btn_trigger_system')}
          </button>
        </div>
      </form>

      {/* ── Result ─────────────────────────────────────────────────────── */}
      {result && (
        <div
          className={`mt-4 rounded border p-3 text-sm ${
            result.dry_run
              ? 'border-amber-700 bg-amber-900/20 text-amber-200'
              : 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
          }`}
        >
          {result.dry_run ? (
            <>
              <span className="font-semibold">Dry-run — </span>
              <span>
                {t('soc.dnse_backfill.result_slots_preview')}:{' '}
                <strong>{result.slots_preview}</strong>
              </span>
              {result.skipped_preview > 0 && (
                <span className="ml-3 text-slate-400">
                  {t('soc.dnse_backfill.result_skipped')}: {result.skipped_preview}
                </span>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold">
                {t('soc.dnse_backfill.result_tasks_queued')}:{' '}
                <strong>{result.tasks_queued}</strong>
              </span>
              {result.skipped > 0 && (
                <span className="ml-3 text-slate-400">
                  {t('soc.dnse_backfill.result_skipped')}: {result.skipped}
                </span>
              )}
            </>
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
      const resp = await triggerUserBackfill({
        symbol: form.symbol.toUpperCase(),
        trade_date: form.trade_date,
      });
      setResult(resp.data);
    } catch (err) {
      setError(
        err?.response?.data?.detail || err?.message || t('soc.dnse_backfill.error_generic'),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-5">
      <h3 className="mb-4 text-base font-bold text-white">
        👤 {t('soc.dnse_backfill.user_section_title')}
      </h3>
      <p className="mb-4 text-sm text-slate-400">{t('soc.dnse_backfill.user_section_desc')}</p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">
            {t('soc.dnse_backfill.field_symbol')}
          </label>
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value }))}
            placeholder="HPG"
            maxLength={10}
            required
            className="w-32 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-300">
            {t('soc.dnse_backfill.field_trade_date')}
          </label>
          <input
            type="date"
            value={form.trade_date}
            onChange={(e) => setForm((p) => ({ ...p, trade_date: e.target.value }))}
            onClick={(e) => { try { e.target.showPicker(); } catch {} }}
            onFocus={(e) => { try { e.target.showPicker(); } catch {} }}
            required
            className="rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-teal-500 cursor-pointer"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !form.symbol}
          className="rounded bg-teal-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading
            ? t('soc.dnse_backfill.btn_triggering')
            : t('soc.dnse_backfill.btn_trigger_user')}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 rounded border p-3 text-sm ${
            result.status === 'ok'
              ? 'border-emerald-700 bg-emerald-900/30 text-emerald-300'
              : result.status === 'accepted'
              ? 'border-blue-700 bg-blue-900/30 text-blue-300'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="font-semibold">
            {t('soc.dnse_backfill.result_status')}: {result.status}
          </span>
          {result.ticks !== undefined && (
            <span className="ml-3">
              {t('soc.dnse_backfill.result_ticks')}: {result.ticks}
            </span>
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
          ℹ️ {t('soc.dnse_backfill.info_banner')}
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
