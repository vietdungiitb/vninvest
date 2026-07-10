import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantSSOConfig, updateTenantSSOConfig } from '../../../api/client';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

function SummaryCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function resolveErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.detail || fallback;
}

export default function TenantAdminSSOPage() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canManageTenant = ability.can('manage', 'TenantAdmin');
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    is_enabled: false,
    idp_entity_id: '',
    idp_sso_url: '',
    idp_x509_cert: '',
    domain_hint: '',
    sp_entity_id: '',
    sp_acs_url: '',
  });

  async function loadConfig() {
    setLoading(true);
    setError('');
    try {
      const response = await getTenantSSOConfig();
      const data = response.data;
      setConfig(data);
      setFormData({
        is_enabled: data.is_enabled || false,
        idp_entity_id: data.idp_entity_id || '',
        idp_sso_url: data.idp_sso_url || '',
        idp_x509_cert: data.idp_x509_cert || '',
        domain_hint: data.domain_hint || '',
        sp_entity_id: data.sp_entity_id || '',
        sp_acs_url: data.sp_acs_url || '',
      });
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantSSO.loadError')));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError('');
      try {
        const response = await getTenantSSOConfig();
        if (cancelled) return;
        const data = response.data;
        setConfig(data);
        setFormData({
          is_enabled: data.is_enabled || false,
          idp_entity_id: data.idp_entity_id || '',
          idp_sso_url: data.idp_sso_url || '',
          idp_x509_cert: data.idp_x509_cert || '',
          domain_hint: data.domain_hint || '',
          sp_entity_id: data.sp_entity_id || '',
          sp_acs_url: data.sp_acs_url || '',
        });
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantSSO.loadError')));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function handleSave(event) {
    event.preventDefault();
    if (!canManageTenant) {
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await updateTenantSSOConfig(formData);
      setConfig(response.data);
      setSuccess(t('tenantSSO.savedSuccess'));
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantSSO.saveError')));
    } finally {
      setSaving(false);
    }
  }

  function handleChange(field, value) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  const isEnterprisePlan = config?.tenant?.plan === 'enterprise';

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantSSO.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantSSO.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantSSO.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadConfig}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantSSO.refreshAction')}
              </button>
              <Link
                to="/tenant-admin"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantSSO.backToHome')}
              </Link>
            </div>
          </div>

          {!isEnterprisePlan && (
            <div className="mt-4 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              <p className="font-semibold">{t('tenantSSO.enterpriseOnlyNotice')}</p>
              <p className="mt-1">{t('tenantSSO.currentPlanLabel')}: {config?.tenant?.plan || '—'}</p>
              <p className="mt-1">{t('tenantSSO.upgradeRequired')}</p>
            </div>
          )}
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantSSO.isEnabledLabel')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            
            <form className="mt-4 space-y-5" onSubmit={handleSave}>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={formData.is_enabled}
                  onChange={(e) => handleChange('is_enabled', e.target.checked)}
                  disabled={!isEnterprisePlan || loading || saving}
                  className="h-5 w-5 cursor-pointer rounded border-slate-600 bg-slate-950 text-emerald-600 transition-colors focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <span className="text-sm font-medium text-slate-100">{t('tenantSSO.isEnabledLabel')}</span>
              </label>
              <p className="text-xs text-slate-500 ml-8">{t('tenantSSO.isEnabledHelp')}</p>

              {!isEnterprisePlan ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantSSO.enterpriseOnlyNotice')}
                </div>
              ) : (
                <>
                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.idpEntityIdLabel')}</span>
                    <input
                      type="text"
                      value={formData.idp_entity_id}
                      onChange={(e) => handleChange('idp_entity_id', e.target.value)}
                      placeholder={t('tenantSSO.idpEntityIdPlaceholder')}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.idpEntityIdHelp')}</p>
                  </label>

                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.idpSsoUrlLabel')}</span>
                    <input
                      type="url"
                      value={formData.idp_sso_url}
                      onChange={(e) => handleChange('idp_sso_url', e.target.value)}
                      placeholder={t('tenantSSO.idpSsoUrlPlaceholder')}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.idpSsoUrlHelp')}</p>
                  </label>

                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.idpX509CertLabel')}</span>
                    <textarea
                      value={formData.idp_x509_cert}
                      onChange={(e) => handleChange('idp_x509_cert', e.target.value)}
                      placeholder={t('tenantSSO.idpX509CertPlaceholder')}
                      rows={6}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-xs resize-none"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.idpX509CertHelp')}</p>
                  </label>

                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.domainHintLabel')}</span>
                    <input
                      type="text"
                      value={formData.domain_hint}
                      onChange={(e) => handleChange('domain_hint', e.target.value)}
                      placeholder={t('tenantSSO.domainHintPlaceholder')}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.domainHintHelp')}</p>
                  </label>

                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.spEntityIdLabel')}</span>
                    <input
                      type="text"
                      value={formData.sp_entity_id}
                      onChange={(e) => handleChange('sp_entity_id', e.target.value)}
                      placeholder={t('tenantSSO.spEntityIdPlaceholder')}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.spEntityIdHelp')}</p>
                  </label>

                  <label className="grid gap-1.5 text-sm text-slate-200">
                    <span>{t('tenantSSO.spAcsUrlLabel')}</span>
                    <input
                      type="url"
                      value={formData.sp_acs_url}
                      onChange={(e) => handleChange('sp_acs_url', e.target.value)}
                      placeholder={t('tenantSSO.spAcsUrlPlaceholder')}
                      disabled={loading || saving}
                      className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <p className="text-xs text-slate-500">{t('tenantSSO.spAcsUrlHelp')}</p>
                  </label>

                  <button
                    type="submit"
                    disabled={saving || !canManageTenant || !isEnterprisePlan}
                    className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? t('tenantSSO.saving') : t('tenantSSO.saveAction')}
                  </button>
                </>
              )}
            </form>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">SSO Test</p>
            <div className="mt-4 space-y-3">
              <p className="text-sm text-slate-400">Test your SSO configuration by initiating a login flow.</p>
              <button
                type="button"
                onClick={() => {
                  const baseUrl = window.location.origin;
                  window.location.href = `${baseUrl}/core/v1/auth/sso/login/?domain=${formData.domain_hint}`;
                }}
                disabled={!formData.domain_hint || !formData.is_enabled || loading || saving}
                className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('tenantSSO.testConnectionAction')}
              </button>
              <p className="text-xs text-slate-500">
                {t('tenantSSO.spAcsUrlLabel')}: <code className="text-slate-300">{formData.sp_acs_url || 'Not configured'}</code>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}