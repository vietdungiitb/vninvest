import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

function formatQuotaValue(value, fallbackLabel, locale) {
  if (value === null || value === undefined) {
    return fallbackLabel;
  }

  if (value < 0) {
    return fallbackLabel;
  }

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(value);
}

export default function TenantAdminHome() {
  const { t, locale } = useI18n();
  const { ability, userIdentity, userPlan, userEntitlements } = usePortfolio();

  const entitlements = userEntitlements || {};
  const quotaCaps = entitlements.quota_caps || {};
  const planLabel = t(`plans.${userPlan || 'free'}`);
  const tenantCanOpen = ability.can('read', 'TenantAdminHome');
  const tenantCanInspect = ability.can('read', 'TenantCapabilityView');
  const tenantCanReadUsage = ability.can('read', 'TenantUsageView');
  const tenantCanReadBilling = ability.can('read', 'TenantBillingView');
  const tenantCanManageServiceAccounts = ability.can('read', 'TenantServiceAccountAdmin');
  const tenantCanManagePATs = ability.can('read', 'TenantPATAdmin');
  const abilityCount = Array.isArray(entitlements.abilities) ? entitlements.abilities.length : 0;
  const quotaCount = Object.keys(quotaCaps).length;

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantHome.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantHome.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantHome.description')}</p>
            </div>
            <Link
              to="/tenant-admin/capabilities"
              className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
            >
              {t('tenantHome.openCapabilities')}
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t('tenantHome.metricPlan')} value={planLabel} hint={t('tenantHome.metricTier')} />
            <MetricCard label={t('tenantHome.metricAbility')} value={String(abilityCount)} hint={t('tenantHome.metricTrial')} />
            <MetricCard label={t('tenantHome.metricQuota')} value={String(quotaCount)} hint={t('tenantHome.accessPreview')} />
            <MetricCard
              label={t('tenantHome.accessTitle')}
              value={tenantCanOpen ? t('tenantHome.readAccess') : t('tenantHome.noReadAccess')}
              hint={tenantCanInspect ? t('tenantHome.capabilitiesRoute') : t('tenantHome.noTenantContext')}
            />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantHome.identityTitle')}</p>
                <h2 className="mt-1 text-lg font-semibold text-white">{userIdentity?.username || t('layout.account')}</h2>
              </div>
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-100">
                {t(`plans.${userPlan || 'free'}`)}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoRow label={t('tenantHome.usernameLabel')} value={userIdentity?.username || t('common.notAvailable')} />
              <InfoRow label={t('tenantHome.emailLabel')} value={userIdentity?.email || t('common.notAvailable')} />
              <InfoRow label={t('tenantHome.metricPlan')} value={planLabel} />
              <InfoRow label={t('tenantHome.metricTier')} value={entitlements.tier || t('common.notAvailable')} />
              <InfoRow label={t('tenantHome.metricTrial')} value={entitlements.trial_state || t('common.notAvailable')} />
              <InfoRow label={t('tenantHome.accessTitle')} value={tenantCanOpen ? t('tenantHome.readAccess') : t('tenantHome.noReadAccess')} />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantHome.quotaTitle')}</p>
            <div className="mt-4 grid gap-3">
              <InfoRow label={t('tenantHome.apiCallsPerDayLabel')} value={formatQuotaValue(quotaCaps.api_calls_per_day, t('tenantHome.unlimited'), locale)} />
              <InfoRow label={t('tenantHome.aiRegeneratePerDayLabel')} value={formatQuotaValue(quotaCaps.ai_regenerate_per_day, t('tenantHome.unlimited'), locale)} />
              <InfoRow label={t('tenantHome.whaleSymbolsMaxLabel')} value={formatQuotaValue(quotaCaps.whale_symbols_max, t('tenantHome.unlimited'), locale)} />
              <InfoRow label={t('tenantHome.exportsPerDayLabel')} value={formatQuotaValue(quotaCaps.exports_per_day, t('tenantHome.unlimited'), locale)} />
              <InfoRow label={t('tenantHome.metricAbility')} value={String(abilityCount)} />
            </div>
          </section>
        </div>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantHome.linksTitle')}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {tenantCanInspect ? (
              <Link
                to="/tenant-admin/capabilities"
                className="rounded-2xl border border-violet-500/25 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/50 hover:bg-violet-500/20"
              >
                {t('tenantHome.capabilitiesRoute')}
              </Link>
            ) : null}
            {tenantCanReadUsage ? (
              <Link
                to="/tenant-admin/usage"
                className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20"
              >
                {t('tenantHome.usageRoute')}
              </Link>
            ) : null}
            {tenantCanReadBilling ? (
              <Link
                to="/tenant-admin/billing"
                className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-100 transition-colors hover:border-amber-400/50 hover:bg-amber-500/20"
              >
                {t('tenantHome.billingRoute')}
              </Link>
            ) : null}
            {tenantCanManageServiceAccounts ? (
              <Link
                to="/tenant-admin/service-accounts"
                className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/50 hover:bg-cyan-500/20"
              >
                {t('tenantHome.serviceAccountsRoute')}
              </Link>
            ) : null}
            {tenantCanManagePATs ? (
              <Link
                to="/tenant-admin/pats"
                className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/50 hover:bg-emerald-500/20"
              >
                {t('tenantHome.patsRoute')}
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}