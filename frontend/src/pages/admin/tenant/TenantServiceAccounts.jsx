import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createTenantServiceAccount, getTenantServiceAccounts } from '../../../api/client';
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

function normalizeCommaList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveErrorMessage(error, fallback) {
  return error?.response?.data?.error?.message || error?.response?.data?.detail || fallback;
}

function formatDateTime(value, locale) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function TenantServiceAccounts() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canCreate = ability.can('create', 'TenantServiceAccountAdmin');
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState({
    name: '',
    environment: 'prod',
    policyIds: 'pol_market_read, pol_signals_read',
  });

  async function loadServiceAccounts() {
    setLoading(true);
    setError('');
    try {
      const response = await getTenantServiceAccounts();
      setServiceAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantServiceAccounts.loadError')));
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
        const response = await getTenantServiceAccounts();
        if (!cancelled) {
          setServiceAccounts(Array.isArray(response.data?.data) ? response.data.data : []);
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantServiceAccounts.loadError')));
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

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canCreate) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createTenantServiceAccount({
        name: formState.name.trim(),
        environment: formState.environment,
        policy_ids: normalizeCommaList(formState.policyIds),
      });
      setFormState({
        name: '',
        environment: formState.environment,
        policyIds: formState.policyIds,
      });
      await loadServiceAccounts();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantServiceAccounts.submitError')));
    } finally {
      setSubmitting(false);
    }
  }

  const activeCount = serviceAccounts.filter((item) => item.status === 'active').length;
  const environmentCount = new Set(serviceAccounts.map((item) => item.environment)).size;

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantServiceAccounts.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantServiceAccounts.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantServiceAccounts.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadServiceAccounts}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantServiceAccounts.refreshAction')}
              </button>
              <Link
                to="/tenant-admin/home"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantServiceAccounts.backToHome')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('tenantServiceAccounts.metricTotal')} value={String(serviceAccounts.length)} hint={t('tenantServiceAccounts.listTitle')} />
            <SummaryCard label={t('tenantServiceAccounts.metricActive')} value={String(activeCount)} hint={t('tenantServiceAccounts.activeHint')} />
            <SummaryCard label={t('tenantServiceAccounts.metricEnvironment')} value={String(environmentCount)} hint={t('tenantServiceAccounts.environmentHint')} />
            <SummaryCard label={t('tenantServiceAccounts.metricCreate')} value={canCreate ? t('tenantServiceAccounts.createEnabled') : t('tenantServiceAccounts.createDisabled')} hint={t('tenantServiceAccounts.policyIdsLabel')} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantServiceAccounts.createTitle')}</p>
            <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
              <label className="grid gap-1.5 text-sm text-slate-200">
                <span>{t('tenantServiceAccounts.nameLabel')}</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
                  placeholder={t('tenantServiceAccounts.namePlaceholder')}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm text-slate-200">
                <span>{t('tenantServiceAccounts.environmentLabel')}</span>
                <select
                  value={formState.environment}
                  onChange={(event) => setFormState((current) => ({ ...current, environment: event.target.value }))}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                >
                  <option value="prod">prod</option>
                  <option value="staging">staging</option>
                  <option value="dev">dev</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-sm text-slate-200">
                <span>{t('tenantServiceAccounts.policyIdsLabel')}</span>
                <input
                  type="text"
                  value={formState.policyIds}
                  onChange={(event) => setFormState((current) => ({ ...current, policyIds: event.target.value }))}
                  placeholder={t('tenantServiceAccounts.policyIdsPlaceholder')}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                />
                <p className="text-xs text-slate-500">{t('tenantServiceAccounts.policyIdsHelp')}</p>
              </label>
              <button
                type="submit"
                disabled={submitting || !canCreate}
                className="rounded-2xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t('tenantServiceAccounts.submitting') : t('tenantServiceAccounts.createAction')}
              </button>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantServiceAccounts.listTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && serviceAccounts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantServiceAccounts.emptyState')}
                </div>
              ) : null}
              {serviceAccounts.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{item.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200">{item.environment}</p>
                    </div>
                    <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                      {item.status}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantServiceAccounts.policyIdsLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{item.policy_ids.length > 0 ? item.policy_ids.join(', ') : t('tenantServiceAccounts.noPolicies')}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantServiceAccounts.createdAtLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.created_at, locale)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantServiceAccounts.lastRotatedAtLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.last_rotated_at, locale)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Tenant ID</p>
                      <p className="mt-1 text-sm text-slate-100">{item.tenant_id}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}