import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTenantInvite,
  getTenantInvites,
  getTenantMembers,
  removeTenantMember,
} from '../../../api/client';
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
  return error?.response?.data?.error || error?.response?.data?.detail || fallback;
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

export default function TenantMembers() {
  const { t, locale } = useI18n();
  const { ability, userIdentity } = usePortfolio();
  const canRead = ability.can('read', 'TenantMemberAdmin');
  const canManage = ability.can('manage', 'TenantMemberAdmin');

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [formState, setFormState] = useState({
    invitedEmail: '',
    role: 'viewer',
  });

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [membersResponse, invitesResponse] = await Promise.all([
        getTenantMembers(),
        getTenantInvites(),
      ]);
      setMembers(Array.isArray(membersResponse?.data?.members) ? membersResponse.data.members : []);
      setInvites(Array.isArray(invitesResponse?.data?.invites) ? invitesResponse.data.invites : []);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantMembers.loadError')));
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
        const [membersResponse, invitesResponse] = await Promise.all([
          getTenantMembers(),
          getTenantInvites(),
        ]);
        if (cancelled) {
          return;
        }
        setMembers(Array.isArray(membersResponse?.data?.members) ? membersResponse.data.members : []);
        setInvites(Array.isArray(invitesResponse?.data?.invites) ? invitesResponse.data.invites : []);
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantMembers.loadError')));
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

  async function handleInviteSubmit(event) {
    event.preventDefault();
    if (!canManage) {
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await createTenantInvite({
        invited_email: formState.invitedEmail.trim(),
        role: formState.role,
      });
      setFormState((current) => ({
        ...current,
        invitedEmail: '',
      }));
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantMembers.inviteError')));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(memberId) {
    if (!canManage || !memberId) {
      return;
    }

    const confirmed = window.confirm(t('tenantMembers.removeConfirm'));
    if (!confirmed) {
      return;
    }

    setRemovingId(memberId);
    setError('');
    try {
      await removeTenantMember(memberId);
      await loadData();
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantMembers.removeError')));
    } finally {
      setRemovingId('');
    }
  }

  const ownerEmail = (userIdentity?.email || '').toLowerCase();
  const removableMembers = members.filter((item) => (item?.email || '').toLowerCase() !== ownerEmail);

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantMembers.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantMembers.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantMembers.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantMembers.refreshAction')}
              </button>
              <Link
                to="/tenant-admin/home"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantMembers.backToHome')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('tenantMembers.metricMembers')} value={String(members.length)} hint={t('tenantMembers.membersListTitle')} />
            <SummaryCard label={t('tenantMembers.metricInvites')} value={String(invites.length)} hint={t('tenantMembers.invitesListTitle')} />
            <SummaryCard label={t('tenantMembers.metricRoles')} value={String(new Set(members.map((item) => item.role)).size)} hint={t('tenantMembers.rolesHint')} />
            <SummaryCard label={t('tenantMembers.metricManage')} value={canManage ? t('tenantMembers.manageEnabled') : t('tenantMembers.manageDisabled')} hint={t('tenantMembers.inviteTitle')} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantMembers.inviteTitle')}</p>
            <form className="mt-4 grid gap-3" onSubmit={handleInviteSubmit}>
              <label className="grid gap-1.5 text-sm text-slate-200">
                <span>{t('tenantMembers.invitedEmailLabel')}</span>
                <input
                  type="email"
                  value={formState.invitedEmail}
                  onChange={(event) => setFormState((current) => ({ ...current, invitedEmail: event.target.value }))}
                  placeholder={t('tenantMembers.invitedEmailPlaceholder')}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                  required
                />
              </label>
              <label className="grid gap-1.5 text-sm text-slate-200">
                <span>{t('tenantMembers.roleLabel')}</span>
                <select
                  value={formState.role}
                  onChange={(event) => setFormState((current) => ({ ...current, role: event.target.value }))}
                  className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-cyan-400"
                >
                  <option value="viewer">viewer</option>
                  <option value="admin">admin</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={submitting || !canManage}
                className="rounded-2xl border border-cyan-500/40 bg-cyan-500/15 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? t('tenantMembers.submitting') : t('tenantMembers.inviteAction')}
              </button>
            </form>

            <div className="mt-6 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantMembers.invitesListTitle')}</p>
              {loading ? <p className="text-xs text-slate-500">{t('common.loading')}</p> : null}
              {!loading && invites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantMembers.invitesEmpty')}
                </div>
              ) : null}
              {invites.map((item) => (
                <div key={item.invite_id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <p className="text-sm font-semibold text-white">{item.invited_email}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-amber-200">{item.role} • {item.status}</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantMembers.inviterLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{item.inviter_username || '—'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantMembers.expiresAtLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.expires_at, locale)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantMembers.membersListTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && members.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantMembers.membersEmpty')}
                </div>
              ) : null}
              {members.map((item) => {
                const canRemove = canManage && removableMembers.some((member) => member.member_id === item.member_id);
                return (
                  <div key={item.member_id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{item.username || item.email}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-200">{item.role}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!canRemove || removingId === item.member_id}
                        onClick={() => handleRemoveMember(item.member_id)}
                        className="rounded-full border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-100 transition-colors hover:border-rose-400/60 hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {removingId === item.member_id ? t('tenantMembers.removing') : t('tenantMembers.removeAction')}
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantMembers.emailLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{item.email || '—'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantMembers.joinedAtLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.joined_at, locale)}</p>
                      </div>
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