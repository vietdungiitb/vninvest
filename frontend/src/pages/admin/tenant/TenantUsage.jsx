import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantUsageMeters, getTenantUsageQuotas } from '../../../api/client';
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

function formatNumber(value, locale) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value < 0) {
    return '∞';
  }

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN').format(value);
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

function resolveToneClass(riskState) {
  if (riskState === 'critical') {
    return 'bg-rose-500';
  }
  if (riskState === 'warning') {
    return 'bg-amber-400';
  }
  return 'bg-emerald-400';
}

function resolveRiskLabel(t, riskState) {
  if (riskState === 'critical') {
    return t('tenantUsage.risk.critical');
  }
  if (riskState === 'warning') {
    return t('tenantUsage.risk.warning');
  }
  return t('tenantUsage.risk.normal');
}

function UsageBar({ consumedAmount, entitledAmount, riskState }) {
  const ratio = entitledAmount > 0 ? Math.min((consumedAmount / entitledAmount) * 100, 100) : 0;

  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${resolveToneClass(riskState)}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

export default function TenantUsage() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canReadBilling = ability.can('read', 'TenantBillingView');
  const [meters, setMeters] = useState([]);
  const [quotas, setQuotas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [meterResponse, quotaResponse] = await Promise.all([
        getTenantUsageMeters(),
        getTenantUsageQuotas(),
      ]);
      setMeters(Array.isArray(meterResponse.data?.data) ? meterResponse.data.data : []);
      setQuotas(Array.isArray(quotaResponse.data?.data) ? quotaResponse.data.data : []);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantUsage.loadError')));
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
        const [meterResponse, quotaResponse] = await Promise.all([
          getTenantUsageMeters(),
          getTenantUsageQuotas(),
        ]);
        if (cancelled) {
          return;
        }
        setMeters(Array.isArray(meterResponse.data?.data) ? meterResponse.data.data : []);
        setQuotas(Array.isArray(quotaResponse.data?.data) ? quotaResponse.data.data : []);
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantUsage.loadError')));
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

  const quotaByMeterCode = new Map(quotas.map((item) => [item.meter_code, item]));
  const warningCount = meters.filter((item) => item.risk_state === 'warning').length;
  const criticalCount = meters.filter((item) => item.risk_state === 'critical').length;
  const totalRemaining = quotas.reduce((sum, item) => {
    if (typeof item.remaining_amount !== 'number' || item.remaining_amount < 0) {
      return sum;
    }
    return sum + item.remaining_amount;
  }, 0);

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantUsage.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantUsage.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantUsage.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantUsage.refreshAction')}
              </button>
              {canReadBilling ? (
                <Link
                  to="/tenant-admin/billing"
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20"
                >
                  {t('tenantUsage.openBilling')}
                </Link>
              ) : null}
              <Link
                to="/tenant-admin/home"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantUsage.backToHome')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('tenantUsage.metricMeters')} value={String(meters.length)} hint={t('tenantUsage.meterListTitle')} />
            <SummaryCard label={t('tenantUsage.metricWarnings')} value={String(warningCount)} hint={t('tenantUsage.risk.warning')} />
            <SummaryCard label={t('tenantUsage.metricCritical')} value={String(criticalCount)} hint={t('tenantUsage.risk.critical')} />
            <SummaryCard label={t('tenantUsage.metricRemaining')} value={formatNumber(totalRemaining, locale)} hint={t('tenantUsage.quotaListTitle')} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantUsage.meterListTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && meters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantUsage.meterEmpty')}
                </div>
              ) : null}
              {meters.map((item) => {
                const quotaSnapshot = quotaByMeterCode.get(item.meter_code);
                const entitledAmount = quotaSnapshot?.entitled_amount ?? 0;
                return (
                  <div key={item.meter_code} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-white">{item.display_name}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200">{item.meter_code}</p>
                      </div>
                      <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100">
                        {resolveRiskLabel(t, item.risk_state)}
                      </div>
                    </div>

                    <UsageBar consumedAmount={item.consumed_amount} entitledAmount={entitledAmount} riskState={item.risk_state} />

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.consumedLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatNumber(item.consumed_amount, locale)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.remainingLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatNumber(item.remaining_amount, locale)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.resetAtLabel')}</p>
                        <p className="mt-1 text-sm text-slate-100">{formatDateTime(item.reset_at, locale)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantUsage.quotaListTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && quotas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantUsage.quotaEmpty')}
                </div>
              ) : null}
              {quotas.map((item) => (
                <div key={item.meter_code} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{item.display_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-emerald-200">{item.unit}</p>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.hard_stop ? 'border-rose-500/30 bg-rose-500/10 text-rose-100' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'}`}>
                      {item.hard_stop ? t('tenantUsage.hardStop') : resolveRiskLabel(t, item.risk_state)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.limitLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatNumber(item.entitled_amount, locale)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.consumedLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatNumber(item.consumed_amount, locale)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{t('tenantUsage.remainingLabel')}</p>
                      <p className="mt-1 text-sm text-slate-100">{formatNumber(item.remaining_amount, locale)}</p>
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