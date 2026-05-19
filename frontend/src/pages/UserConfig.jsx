import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getPortfolioUserConfig, updatePortfolioUserConfig, getDNSEDataCredential, saveDNSEDataCredential, deleteDNSEDataCredential } from '../api/client';
import { useI18n } from '../context/LangContext';
import { usePortfolio } from '../context/PortfolioContext';
import { useInterface } from '../context/InterfaceContext';

export default function UserConfig() {
  const { t, setLanguage } = useI18n();
  const { isAuthenticated } = usePortfolio();
  const { uiMode, setUiMode } = useInterface();


  const [loading, setLoading] = useState(true);
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // D07: DNSE Data Credential state
  const [dnseCredential, setDnseCredential] = useState(null); // {has_credential, is_verified, is_system_provider}
  const [dnseForm, setDnseForm] = useState({ api_key: '', api_secret: '' });
  const [dnseSaving, setDnseSaving] = useState(false);
  const [dnseDeleting, setDnseDeleting] = useState(false);
  const [dnseMsg, setDnseMsg] = useState('');
  const [dnseError, setDnseError] = useState('');

  const [form, setForm] = useState({
    language: 'vi',
    theme: 'dark',
    whale_alert_threshold: 500,
    advisory_whale_signal_enabled: true,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError('');
      try {
        const userResp = await getPortfolioUserConfig();
        if (!mounted) return;

        const userCfg = userResp?.data || {};

        setForm((prev) => ({
          ...prev,
          language: userCfg.language || prev.language,
          theme: userCfg.theme || prev.theme,
          whale_alert_threshold: Number(userCfg.whale_alert_threshold ?? prev.whale_alert_threshold),
          advisory_whale_signal_enabled: typeof userCfg.advisory_whale_signal_enabled === 'boolean'
            ? userCfg.advisory_whale_signal_enabled
            : prev.advisory_whale_signal_enabled,
        }));
      } catch (err) {
        if (!mounted) return;
        setError(err?.response?.data?.detail || 'Failed to load settings.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [t, isAuthenticated]);

  // D07: load DNSE credential status
  useEffect(() => {
    if (!isAuthenticated) return;
    getDNSEDataCredential()
      .then((resp) => setDnseCredential(resp.data))
      .catch(() => setDnseCredential(null));
  }, [isAuthenticated]);

  const saveDNSECreds = async (e) => {
    e.preventDefault();
    setDnseSaving(true);
    setDnseMsg('');
    setDnseError('');
    try {
      const resp = await saveDNSEDataCredential({ api_key: dnseForm.api_key, api_secret: dnseForm.api_secret });
      setDnseCredential(resp.data);
      setDnseForm({ api_key: '', api_secret: '' });
      setDnseMsg(t('settings.dnse_cred_saved'));
    } catch (err) {
      setDnseError(err?.response?.data?.detail || t('settings.dnse_cred_save_error'));
    } finally {
      setDnseSaving(false);
    }
  };

  const removeDNSECreds = async () => {
    if (!window.confirm(t('settings.dnse_cred_delete_confirm'))) return;
    setDnseDeleting(true);
    setDnseMsg('');
    setDnseError('');
    try {
      await deleteDNSEDataCredential();
      setDnseCredential(null);
      setDnseMsg(t('settings.dnse_cred_deleted'));
    } catch (err) {
      setDnseError(err?.response?.data?.detail || t('settings.dnse_cred_delete_error'));
    } finally {
      setDnseDeleting(false);
    }
  };

  const onField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveGeneralSettings = async () => {
    setSavingGeneral(true);
    setMessage('');
    setError('');
    try {
      await updatePortfolioUserConfig({
        language: form.language,
        theme: form.theme,
        whale_alert_threshold: Math.max(1, Number(form.whale_alert_threshold) || 500),
        advisory_whale_signal_enabled: Boolean(form.advisory_whale_signal_enabled),
      });
      setLanguage(form.language);
      setMessage(t('common.save'));
    } catch (err) {
      setError(err?.response?.data?.detail || 'Save failed.');
    } finally {
      setSavingGeneral(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 xl:px-5">
      <section className="card-section px-5 py-4">
        <h1 className="text-2xl font-semibold text-slate-100">{t('settings.title')}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {t('settings.pageDescription')}
        </p>
      </section>

      {loading ? (
        <section className="card-section px-5 py-6 text-sm text-slate-400">{t('common.loading')}</section>
      ) : null}

      {!loading && (
        <>
          <section className="card-section px-5 py-4 space-y-4">
            <h2 className="text-lg font-semibold text-slate-100">{t('settings.general')}</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-slate-400">
                {t('common.language')}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.language}
                  onChange={(e) => onField('language', e.target.value)}
                >
                  <option value="vi">{t('common.vietnamese')}</option>
                  <option value="en">{t('common.english')}</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {t('settings.theme')}
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.theme}
                  onChange={(e) => onField('theme', e.target.value)}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                </select>
              </label>

              <label className="text-xs text-slate-400">
                {t('settings.whaleThreshold')}
                <input
                  type="number"
                  min="1"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={form.whale_alert_threshold}
                  onChange={(e) => onField('whale_alert_threshold', e.target.value)}
                />
              </label>

              <label className="text-xs text-slate-400">
                Interface Mode
                <select
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  value={uiMode}
                  onChange={(e) => setUiMode(e.target.value)}
                >
                  <option value="legacy">Legacy (Standard)</option>
                  <option value="modern">Modern (Workstation)</option>
                  <option value="decision_hub">Decision Hub (Pro)</option>
                </select>
              </label>
            </div>
          </section>

          <section className="card-section px-5 py-4 space-y-4 border border-cyan-500/20 bg-cyan-500/5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">{t('settings.movedTitle')}</h2>
                <p className="mt-1 text-sm text-slate-400">
                  {t('settings.movedDescription')}
                </p>
              </div>
              <Link
                to="/settings/ai"
                className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
              >
                {t('settings.openAiCommandCenter')}
              </Link>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-slate-950/40 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  aria-label={t('settings.eventBasedAuto')}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-400 focus:ring-cyan-400"
                  checked={Boolean(form.advisory_whale_signal_enabled)}
                  onChange={(e) => onField('advisory_whale_signal_enabled', e.target.checked)}
                />
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-100">{t('settings.eventBasedAuto')}</p>
                  <p className="text-xs leading-5 text-slate-300">{t('settings.eventBasedAutoHelp')}</p>
                  <p className={`text-[11px] font-semibold uppercase tracking-widest ${form.advisory_whale_signal_enabled ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {form.advisory_whale_signal_enabled
                      ? t('settings.eventBasedAutoStateOn')
                      : t('settings.eventBasedAutoStateOff')}
                  </p>
                </div>
              </label>
            </div>
            <p className="text-xs text-cyan-200/80">
              {t('settings.generalOnlyNotice')}
            </p>
          </section>

          <section className="card-section px-5 py-4">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-primary" disabled={savingGeneral} onClick={saveGeneralSettings}>
                {savingGeneral ? t('whaleAdvisory.saving') : t('common.save')}
              </button>
            </div>
            {message ? <p className="mt-2 text-xs text-cyan-300">{message}</p> : null}
            {error ? <p className="mt-2 text-xs text-rose-300">{error}</p> : null}
          </section>
        </>
      )}

      {/* D07: DNSE Data Credential Section */}
      {!loading && (
        <section className="card-section px-5 py-4 space-y-4 border border-orange-700/30 bg-orange-950/10">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">🔑 {t('settings.dnse_cred_title')}</h2>
            <p className="mt-1 text-sm text-slate-400">{t('settings.dnse_cred_desc')}</p>
          </div>

          {dnseCredential?.has_credential ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-900/50 border border-emerald-700 px-2 py-0.5 text-xs text-emerald-300">
                  ✓ {t('settings.dnse_cred_active')}
                </span>
                {dnseCredential.is_verified && (
                  <span className="rounded-full bg-blue-900/50 border border-blue-700 px-2 py-0.5 text-xs text-blue-300">
                    {t('settings.dnse_cred_verified')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={removeDNSECreds}
                disabled={dnseDeleting}
                className="w-fit rounded border border-red-700 bg-red-900/30 px-3 py-2 text-sm font-medium text-red-300 transition hover:bg-red-900/60 disabled:opacity-60"
              >
                {dnseDeleting ? t('settings.dnse_cred_deleting') : t('settings.dnse_cred_delete_btn')}
              </button>
            </div>
          ) : (
            <form onSubmit={saveDNSECreds} className="flex flex-col gap-3 max-w-md">
              <label className="text-xs text-slate-400">
                {t('settings.dnse_cred_api_key')}
                <input
                  type="password"
                  value={dnseForm.api_key}
                  onChange={(e) => setDnseForm((p) => ({ ...p, api_key: e.target.value }))}
                  required
                  autoComplete="new-password"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </label>
              <label className="text-xs text-slate-400">
                {t('settings.dnse_cred_api_secret')}
                <input
                  type="password"
                  value={dnseForm.api_secret}
                  onChange={(e) => setDnseForm((p) => ({ ...p, api_secret: e.target.value }))}
                  required
                  autoComplete="new-password"
                  className="mt-1 w-full rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </label>
              <button
                type="submit"
                disabled={dnseSaving}
                className="w-fit rounded bg-orange-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
              >
                {dnseSaving ? t('settings.dnse_cred_saving') : t('settings.dnse_cred_save_btn')}
              </button>
            </form>
          )}

          {dnseMsg && <p className="text-sm text-emerald-400">{dnseMsg}</p>}
          {dnseError && <p className="text-sm text-red-400">{dnseError}</p>}
        </section>
      )}
    </div>
  );
}
