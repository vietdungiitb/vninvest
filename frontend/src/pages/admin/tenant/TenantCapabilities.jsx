import React from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../../../context/LangContext';
import { usePortfolio } from '../../../context/PortfolioContext';

function SummaryTile({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

function ListPanel({ title, emptyLabel, items, renderItem }) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{title}</p>
      <div className="mt-4 space-y-2">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 px-3 py-4 text-sm text-slate-500">{emptyLabel}</div>
        ) : (
          items.map((item) => renderItem(item))
        )}
      </div>
    </section>
  );
}

function formatQuotaValue(value, fallbackLabel, locale) {
  if (value === null || value === undefined || value < 0) {
    return fallbackLabel;
  }

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(value);
}

export default function TenantCapabilities() {
  const { t, locale } = useI18n();
  const { ability, userIdentity, userPlan, userEntitlements } = usePortfolio();

  const entitlements = userEntitlements || {};
  const abilities = Array.isArray(entitlements.abilities) ? entitlements.abilities : [];
  const quotaCaps = entitlements.quota_caps || {};
  const abilityCount = abilities.length;
  const quotaCount = Object.keys(quotaCaps).length;
  const accessFlag = ability.can('read', 'TenantAdminHome');

  const abilityItems = abilities.map((item) => ({
    key: `${item.action}:${item.subject}`,
    action: item.action,
    subject: item.subject,
  }));

  const quotaItems = Object.entries(quotaCaps).map(([key, value]) => ({ key, value }));

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantCapabilities.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantCapabilities.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantCapabilities.description')}</p>
            </div>
            <Link
              to="/tenant-admin/home"
              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition-colors hover:border-emerald-400/60 hover:bg-emerald-500/20"
            >
              {t('tenantCapabilities.backToHome')}
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryTile label={t('tenantCapabilities.metricPlan')} value={t(`plans.${userPlan || 'free'}`)} detail={entitlements.tier || t('common.notAvailable')} />
            <SummaryTile label={t('tenantCapabilities.metricAbilityCount')} value={String(abilityCount)} detail={t('tenantCapabilities.abilityTitle')} />
            <SummaryTile label={t('tenantCapabilities.metricQuotaCount')} value={String(quotaCount)} detail={t('tenantCapabilities.quotaTitle')} />
            <SummaryTile
              label={t('tenantCapabilities.metricAccessFlag')}
              value={accessFlag ? t('tenantHome.readAccess') : t('tenantHome.noReadAccess')}
              detail={userIdentity?.username || t('common.notAvailable')}
            />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ListPanel
            title={t('tenantCapabilities.abilityTitle')}
            emptyLabel={t('tenantCapabilities.noAbilities')}
            items={abilityItems}
            renderItem={(item) => (
              <div key={item.key} className="rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-200">{item.action}</p>
                <p className="mt-1 text-sm text-slate-100">{item.subject}</p>
              </div>
            )}
          />

          <ListPanel
            title={t('tenantCapabilities.quotaTitle')}
            emptyLabel={t('tenantCapabilities.noQuota')}
            items={quotaItems}
            renderItem={(item) => (
              <div key={item.key} className="rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-2.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">{item.key}</p>
                <p className="mt-1 text-sm text-slate-100">{formatQuotaValue(item.value, t('tenantHome.unlimited'), locale)}</p>
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}