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

function resolvePatSecret(payload) {
  if (!payload) {
    return '';
  }

  if (typeof payload === 'string') {
    return payload.trim();
  }

  if (typeof payload.secret === 'string' && payload.secret.trim()) {
    return payload.secret.trim();
  }

  if (typeof payload.token === 'string' && payload.token.trim()) {
    return payload.token.trim();
  }

  if (typeof payload.access === 'string' && payload.access.trim()) {
    return payload.access.trim();
  }

  if (payload.new_token) {
    return resolvePatSecret(payload.new_token);
  }

  return '';
}

function normalizeSecretReveal(payload) {
  if (!payload) {
    return null;
  }

  const secret = resolvePatSecret(payload);
  if (!secret) {
    return null;
  }

  const tokenPrefix =
    typeof payload.token_prefix === 'string' && payload.token_prefix.trim()
      ? payload.token_prefix.trim()
      : typeof payload.new_token_prefix === 'string' && payload.new_token_prefix.trim()
        ? payload.new_token_prefix.trim()
        : '';

  return {
    secret,
    token_prefix: tokenPrefix,
  };
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
  const [selectedTokenIds, setSelectedTokenIds] = useState(new Set());
  const [revoking, setRevoking] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [hideRevoked, setHideRevoked] = useState(true);
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

  const revokedCount = tokens.filter((item) => item.status === 'revoked').length;
  const visibleTokens = hideRevoked
    ? tokens.filter((item) => item.status !== 'revoked')
    : tokens;
  const paginatedTokens = visibleTokens.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const currentPageSelectableTokens = paginatedTokens.filter((item) => item.status !== 'revoked');
  const allCurrentPageSelectableSelected = currentPageSelectableTokens.length > 0
    && currentPageSelectableTokens.every((item) => selectedTokenIds.has(item.id));

  useEffect(() => {
    setSelectedTokenIds(new Set());
  }, [tokens]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(visibleTokens.length / itemsPerPage));
    setCurrentPage((current) => Math.min(current, totalPages));
  }, [itemsPerPage, visibleTokens.length]);

  useEffect(() => {
    setSelectedTokenIds(new Set());
  }, [currentPage, itemsPerPage, hideRevoked]);

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
      const nextSecretReveal = normalizeSecretReveal(response.data);
      if (!nextSecretReveal) {
        throw new Error('Backend không trả về secret PAT hợp lệ');
      }
      setSecretReveal(nextSecretReveal);
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
      const nextSecretReveal = normalizeSecretReveal(response.data?.new_token || response.data);
      if (!nextSecretReveal) {
        throw new Error('Backend không trả về secret PAT hợp lệ');
      }
      setSecretReveal(nextSecretReveal);
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

  async function handleBulkRevoke() {
    if (!canRevoke || selectedTokenIds.size === 0) {
      setError(t('tenantPats.noTokensSelected'));
      return;
    }

    const confirmed = window.confirm(
      t('tenantPats.bulkRevokeWarning').replace('{{count}}', selectedTokenIds.size.toString())
    );
    if (!confirmed) {
      return;
    }

    setRevoking(true);
    setError('');
    try {
      const tokenIdsList = Array.from(selectedTokenIds);
      await Promise.all(
        tokenIdsList.map((tokenId) =>
          revokeTenantPAT(tokenId, { reason: 'tenant_admin_bulk_revoke' })
        )
      );
      setSelectedTokenIds(new Set());
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantPats.bulkRevokeError')));
    } finally {
      setRevoking(false);
    }
  }

  function handleCopyToken(token) {
    const tokenValue = String(token || '').trim();
    if (!tokenValue) {
      return;
    }

    navigator.clipboard.writeText(tokenValue).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  }

  function toggleTokenSelection(tokenId) {
    const newSelected = new Set(selectedTokenIds);
    if (newSelected.has(tokenId)) {
      newSelected.delete(tokenId);
    } else {
      newSelected.add(tokenId);
    }
    setSelectedTokenIds(newSelected);
  }

  function toggleSelectAll() {
    setSelectedTokenIds((current) => {
      const nextSelected = new Set(current);

      if (allCurrentPageSelectableSelected) {
        currentPageSelectableTokens.forEach((item) => nextSelected.delete(item.id));
      } else {
        currentPageSelectableTokens.forEach((item) => nextSelected.add(item.id));
      }

      return nextSelected;
    });
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-emerald-200">{t('tenantPats.secretTitle')}</p>
                <p className="mt-2 text-sm text-emerald-50">{t('tenantPats.secretHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setSecretReveal(null)}
                className="rounded-full border border-slate-500/40 bg-slate-700/30 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-400 hover:bg-slate-600/40"
              >
                {t('tenantPats.closeAction')}
              </button>
            </div>
            <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-slate-950/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="break-all font-mono text-sm text-emerald-100">{secretReveal.secret}</p>
                <button
                  type="button"
                  onClick={() => handleCopyToken(secretReveal.secret)}
                  className="flex-shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-500/25"
                >
                  {copySuccess ? t('tenantPats.copySuccess') : t('tenantPats.copyTokenAction')}
                </button>
              </div>
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
              <div className="flex flex-wrap items-center gap-2">
                {revokedCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setHideRevoked((current) => !current)}
                    className="rounded-full border border-slate-700/80 bg-slate-900/70 px-3 py-1.5 text-xs font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
                  >
                    {hideRevoked ? t('tenantPats.showRevokedAction') : t('tenantPats.hideRevokedAction')} ({revokedCount})
                  </button>
                ) : null}
                {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
              </div>
            </div>
            {hideRevoked && revokedCount > 0 ? (
              <div className="mt-2 text-xs text-slate-500">
                {t('tenantPats.revokedHiddenHint').replace('{{count}}', revokedCount.toString())}
              </div>
            ) : null}
            {(currentPageSelectableTokens.length > 0 || selectedTokenIds.size > 0) && canRevoke ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-slate-800 pb-4">
                {currentPageSelectableTokens.length > 0 ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelectableSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-950 text-emerald-600 transition-colors focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-semibold text-slate-300">{t('tenantPats.selectAllLabel')}</span>
                  </label>
                ) : null}
                {selectedTokenIds.size > 0 ? (
                  <button
                    type="button"
                    onClick={handleBulkRevoke}
                    disabled={revoking}
                    className="ml-auto rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {revoking ? t('tenantPats.submitting') : t('tenantPats.bulkRevokeAction')} ({selectedTokenIds.size})
                  </button>
                ) : null}
              </div>
            ) : null}
            {visibleTokens.length > 0 && !loading ? (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <label className="flex items-center gap-2 text-xs text-slate-300">
                  <span>{t('tenantPats.itemsPerPageLabel')}:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-100 outline-none transition-colors focus:border-emerald-400"
                  >
                    <option value={5}>{t('tenantPats.pageSize5')}</option>
                    <option value={10}>{t('tenantPats.pageSize10')}</option>
                    <option value={15}>{t('tenantPats.pageSize15')}</option>
                    <option value={20}>{t('tenantPats.pageSize20')}</option>
                  </select>
                </label>
                <span className="text-xs text-slate-400">
                  {t('tenantPats.showing')} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, visibleTokens.length)} {t('tenantPats.of')} {visibleTokens.length}
                </span>
              </div>
            ) : null}
            <div className="mt-4 space-y-3">
              {!loading && visibleTokens.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {hideRevoked && revokedCount > 0 ? t('tenantPats.onlyRevokedHiddenState') : t('tenantPats.emptyState')}
                </div>
              ) : null}
              {paginatedTokens
                .map((item) => {
                const serviceAccount = serviceAccountMap.get(item.service_account_id);
                const rotating = activeTokenId === item.id;
                const isSelected = selectedTokenIds.has(item.id);
                return (
                  <div key={item.id} className={`rounded-2xl border p-4 ${
                    isSelected ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/60'
                  }`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {canRevoke && item.status !== 'revoked' ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleTokenSelection(item.id)}
                            className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-600 bg-slate-950 text-emerald-600 transition-colors focus:ring-2 focus:ring-emerald-500"
                          />
                        ) : null}
                        <div>
                          <p className="font-mono text-sm text-emerald-100">{item.token_prefix}</p>
                          <p className="mt-1 text-xs text-slate-500">{serviceAccount?.name || item.service_account_id}</p>
                        </div>
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
            {visibleTokens.length > itemsPerPage && !loading ? (
              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="rounded-full border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('tenantPats.previousPage')}
                </button>
                <span className="text-xs text-slate-400">
                  {t('tenantPats.showing')} {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, visibleTokens.length)} {t('tenantPats.of')} {visibleTokens.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const totalPages = Math.ceil(visibleTokens.length / itemsPerPage);
                    setCurrentPage((p) => Math.min(totalPages, p + 1));
                  }}
                  disabled={currentPage >= Math.ceil(visibleTokens.length / itemsPerPage)}
                  className="rounded-full border border-slate-700/50 bg-slate-900/60 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t('tenantPats.nextPage')}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}