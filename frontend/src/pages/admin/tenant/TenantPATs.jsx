import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantPATs, getTenantServiceAccounts, issueTenantPAT, revokeTenantPAT, rotateTenantPAT } from '../../../api/client';
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

export default function TenantPATs() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canIssue = ability.can('issue', 'TenantPATAdmin');
  const canRotate = ability.can('rotate', 'TenantPATAdmin');
  const canRevoke = ability.can('revoke', 'TenantPATAdmin');
  const [serviceAccounts, setServiceAccounts] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState('');
  const [secretReveal, setSecretReveal] = useState(null);
  const [issueForm, setIssueForm] = useState({
    serviceAccountId: '',
    scopeCodes: 'market:read, signals:read',
    expiresAt: '',
    displayName: '',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [serviceAccountResponse, tokenResponse] = await Promise.all([
        getTenantServiceAccounts(),
        getTenantPATs(),
      ]);
      const nextServiceAccounts = Array.isArray(serviceAccountResponse.data?.data) ? serviceAccountResponse.data.data : [];
      const nextTokens = Array.isArray(tokenResponse.data?.data) ? tokenResponse.data.data : [];
      setServiceAccounts(nextServiceAccounts);
      setTokens(nextTokens);
      if (nextServiceAccounts.length > 0 && !issueForm.serviceAccountId) {
        setIssueForm((current) => ({ ...current, serviceAccountId: nextServiceAccounts[0].id }));
      }
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantPats.loadError')));
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
        const [serviceAccountResponse, tokenResponse] = await Promise.all([
          getTenantServiceAccounts(),
          getTenantPATs(),
        ]);
        if (cancelled) {
          return;
        }
        const nextServiceAccounts = Array.isArray(serviceAccountResponse.data?.data) ? serviceAccountResponse.data.data : [];
        const nextTokens = Array.isArray(tokenResponse.data?.data) ? tokenResponse.data.data : [];
        setServiceAccounts(nextServiceAccounts);
        setTokens(nextTokens);
        if (nextServiceAccounts.length > 0) {
          setIssueForm((current) => ({
            ...current,
            serviceAccountId: current.serviceAccountId || nextServiceAccounts[0].id,
          }));
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantPats.loadError')));
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

  async function handleIssue(event) {
    event.preventDefault();
    if (!canIssue) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await issueTenantPAT({
        service_account_id: issueForm.serviceAccountId,
        scope_codes: normalizeCommaList(issueForm.scopeCodes),
        expires_at: issueForm.expiresAt ? new Date(issueForm.expiresAt).toISOString() : null,
        display_name: issueForm.displayName.trim(),
      });
      setSecretReveal(response.data);
      setIssueForm((current) => ({
        ...current,
        displayName: '',
        expiresAt: '',
      }));
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantPats.issueError')));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRotate(tokenId) {
    if (!canRotate) {
      return;
    }

    setActiveTokenId(tokenId);
    setError('');
    try {
      const response = await rotateTenantPAT(tokenId, { grace_period_seconds: 3600 });
      setSecretReveal(response.data.new_token);
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantPats.rotateError')));
    } finally {
      setActiveTokenId('');
    }
  }

  async function handleRevoke(tokenId) {
    if (!canRevoke) {
      return;
    }

    setActiveTokenId(tokenId);
    setError('');
    try {
      await revokeTenantPAT(tokenId, { reason: 'tenant_admin_manual_revoke' });
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantPats.revokeError')));
    } finally {
      setActiveTokenId('');
    }
  }

  const serviceAccountMap = new Map(serviceAccounts.map((item) => [item.id, item]));
  const activeCount = tokens.filter((item) => item.status === 'active').length;
  const rotatingCount = tokens.filter((item) => item.status === 'rotating').length;

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantPats.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantPats.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantPats.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantPats.refreshAction')}
              </button>
              <Link
                to="/tenant-admin/service-accounts"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantPats.backToServiceAccounts')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('tenantPats.metricTotal')} value={String(tokens.length)} hint={t('tenantPats.listTitle')} />
            <SummaryCard label={t('tenantPats.metricActive')} value={String(activeCount)} hint={t('tenantPats.activeHint')} />
            <SummaryCard label={t('tenantPats.metricRotating')} value={String(rotatingCount)} hint={t('tenantPats.rotatingHint')} />
            <SummaryCard label={t('tenantPats.metricIssue')} value={canIssue ? t('tenantPats.issueEnabled') : t('tenantPats.issueDisabled')} hint={t('tenantPats.secretHint')} />
          </div>
        </section>

        {secretReveal?.secret ? (
          <section className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200">{t('tenantPats.secretTitle')}</p>
            <p className="mt-2 text-sm text-emerald-50">{t('tenantPats.secretHint')}</p>
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-slate-950/70 p-4">
              <p className="break-all font-mono text-sm text-emerald-100">{secretReveal.secret}</p>
            </div>
          </section>
        ) : null}

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantPats.issueTitle')}</p>
            {serviceAccounts.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                {t('tenantPats.noServiceAccounts')}
              </div>
            ) : (
              <form className="mt-4 grid gap-3" onSubmit={handleIssue}>
                <label className="grid gap-1.5 text-sm text-slate-200">
                  <span>{t('tenantPats.serviceAccountLabel')}</span>
                  <select
                    value={issueForm.serviceAccountId}
                    onChange={(event) => setIssueForm((current) => ({ ...current, serviceAccountId: event.target.value }))}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400"
                  >
                    {serviceAccounts.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} ({item.environment})</option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm text-slate-200">
                  <span>{t('tenantPats.scopesLabel')}</span>
                  <input
                    type="text"
                    value={issueForm.scopeCodes}
                    onChange={(event) => setIssueForm((current) => ({ ...current, scopeCodes: event.target.value }))}
                    placeholder={t('tenantPats.scopesPlaceholder')}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400"
                    required
                  />
                  <p className="text-xs text-slate-500">{t('tenantPats.scopesHelp')}</p>
                </label>
                <label className="grid gap-1.5 text-sm text-slate-200">
                  <span>{t('tenantPats.displayNameLabel')}</span>
                  <input
                    type="text"
                    value={issueForm.displayName}
                    onChange={(event) => setIssueForm((current) => ({ ...current, displayName: event.target.value }))}
                    placeholder={t('tenantPats.displayNamePlaceholder')}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400"
                  />
                </label>
                <label className="grid gap-1.5 text-sm text-slate-200">
                  <span>{t('tenantPats.expiresAtLabel')}</span>
                  <input
                    type="datetime-local"
                    value={issueForm.expiresAt}
                    onChange={(event) => setIssueForm((current) => ({ ...current, expiresAt: event.target.value }))}
                    className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400"
                  />
                </label>
                <button
                  type="submit"
                  disabled={submitting || !canIssue}
                  className="rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? t('tenantPats.submitting') : t('tenantPats.issueAction')}
                </button>
              </form>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantPats.listTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && tokens.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantPats.emptyState')}
                </div>
              ) : null}
              {tokens.map((item) => {
                const serviceAccount = serviceAccountMap.get(item.service_account_id);
                const rotating = activeTokenId === item.id;
                return (
                  <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-sm text-emerald-100">{item.token_prefix}</p>
                        <p className="mt-1 text-xs text-slate-500">{serviceAccount?.name || item.service_account_id}</p>
                      </div>
                      <div className="rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100">
                        {item.status}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantPats.scopesLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{item.scope_codes.length > 0 ? item.scope_codes.join(', ') : '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantPats.expiresAtLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.expires_at, locale)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantPats.createdAtLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.created_at, locale)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantPats.lastUsedAtLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.last_used_at, locale)}</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {canRotate && item.status !== 'revoked' ? (
                        <button
                          type="button"
                          onClick={() => handleRotate(item.id)}
                          disabled={rotating}
                          className="rounded-full border border-cyan-500/35 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {rotating ? t('tenantPats.rotatingAction') : t('tenantPats.rotateAction')}
                        </button>
                      ) : null}
                      {canRevoke && item.status !== 'revoked' ? (
                        <button
                          type="button"
                          onClick={() => handleRevoke(item.id)}
                          disabled={rotating}
                          className="rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t('tenantPats.revokeAction')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}