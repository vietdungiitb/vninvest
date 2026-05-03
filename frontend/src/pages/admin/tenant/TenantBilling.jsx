import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTenantBillingInvoices, getTenantBillingSubscription } from '../../../api/client';
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

function formatCurrency(value, locale) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatDate(value, locale) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'vi-VN', {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function resolveSubscriptionStatusLabel(t, status) {
  if (status === 'past_due') {
    return t('tenantBilling.status.past_due');
  }
  if (status === 'trialing') {
    return t('tenantBilling.status.trialing');
  }
  if (status === 'canceled') {
    return t('tenantBilling.status.canceled');
  }
  return t('tenantBilling.status.active');
}

function resolveInvoiceStateLabel(t, invoiceState) {
  if (invoiceState === 'past_due') {
    return t('tenantBilling.invoiceState.past_due');
  }
  if (invoiceState === 'issued') {
    return t('tenantBilling.invoiceState.issued');
  }
  return t('tenantBilling.invoiceState.current');
}

function resolveBillingCycleLabel(t, billingCycle) {
  if (billingCycle === 'annual') {
    return t('tenantBilling.billingCycle.annual');
  }
  return t('tenantBilling.billingCycle.monthly');
}

function FieldCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800/90 bg-slate-950/60 px-3 py-2.5">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-100">{value}</p>
    </div>
  );
}

export default function TenantBilling() {
  const { t, locale } = useI18n();
  const { ability } = usePortfolio();
  const canReadUsage = ability.can('read', 'TenantUsageView');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [subscriptionResponse, invoicesResponse] = await Promise.all([
        getTenantBillingSubscription(),
        getTenantBillingInvoices(),
      ]);
      setSubscription(subscriptionResponse.data || null);
      setInvoices(Array.isArray(invoicesResponse.data?.data) ? invoicesResponse.data.data : []);
    } catch (nextError) {
      setError(resolveErrorMessage(nextError, t('tenantBilling.loadError')));
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
        const [subscriptionResponse, invoicesResponse] = await Promise.all([
          getTenantBillingSubscription(),
          getTenantBillingInvoices(),
        ]);
        if (cancelled) {
          return;
        }
        setSubscription(subscriptionResponse.data || null);
        setInvoices(Array.isArray(invoicesResponse.data?.data) ? invoicesResponse.data.data : []);
      } catch (nextError) {
        if (!cancelled) {
          setError(resolveErrorMessage(nextError, t('tenantBilling.loadError')));
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

  const statusLabel = resolveSubscriptionStatusLabel(t, subscription?.status);
  const invoiceStateLabel = resolveInvoiceStateLabel(t, subscription?.invoice_state);
  const renewalLabel = subscription?.next_invoice_date ? formatDate(subscription.next_invoice_date, locale) : t('common.notAvailable');
  const pastDueCount = invoices.filter((item) => item.status === 'overdue').length;

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-5 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">{t('tenantBilling.eyebrow')}</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{t('tenantBilling.title')}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">{t('tenantBilling.description')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={loadData}
                className="rounded-full border border-slate-700/80 bg-slate-900/70 px-4 py-2 text-sm font-semibold text-slate-100 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                {t('tenantBilling.refreshAction')}
              </button>
              {canReadUsage ? (
                <Link
                  to="/tenant-admin/usage"
                  className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition-colors hover:border-cyan-400/60 hover:bg-cyan-500/20"
                >
                  {t('tenantBilling.openUsage')}
                </Link>
              ) : null}
              <Link
                to="/tenant-admin/home"
                className="rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-400/60 hover:bg-violet-500/20"
              >
                {t('tenantBilling.backToHome')}
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard label={t('tenantBilling.metricPlan')} value={subscription?.plan_code || t('common.notAvailable')} hint={t('tenantBilling.subscriptionTitle')} />
            <SummaryCard label={t('tenantBilling.metricStatus')} value={statusLabel} hint={invoiceStateLabel} />
            <SummaryCard label={t('tenantBilling.metricInvoices')} value={String(invoices.length)} hint={pastDueCount > 0 ? `${pastDueCount} ${t('tenantBilling.invoiceState.past_due')}` : t('tenantBilling.invoiceState.current')} />
            <SummaryCard label={t('tenantBilling.metricRenewal')} value={renewalLabel} hint={resolveBillingCycleLabel(t, subscription?.billing_cycle)} />
          </div>
        </section>

        {error ? (
          <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantBilling.subscriptionTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            {!loading && !subscription ? (
              <div className="mt-4 rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                {t('tenantBilling.subscriptionEmpty')}
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <FieldCard label={t('tenantBilling.planLabel')} value={subscription?.plan_code || t('common.notAvailable')} />
                <FieldCard label={t('tenantBilling.statusLabel')} value={statusLabel} />
                <FieldCard label={t('tenantBilling.billingCycleLabel')} value={resolveBillingCycleLabel(t, subscription?.billing_cycle)} />
                <FieldCard label={t('tenantBilling.invoiceStateLabel')} value={invoiceStateLabel} />
                <FieldCard label={t('tenantBilling.currentPeriodLabel')} value={subscription?.current_period_end ? `${formatDate(subscription.current_period_start, locale)} → ${formatDate(subscription.current_period_end, locale)}` : t('common.notAvailable')} />
                <FieldCard label={t('tenantBilling.nextInvoiceDateLabel')} value={renewalLabel} />
                <FieldCard label={t('tenantBilling.autoRenewLabel')} value={subscription?.auto_renew ? t('tenantBilling.autoRenew.enabled') : t('tenantBilling.autoRenew.disabled')} />
                <FieldCard label={t('tenantBilling.creditBalanceLabel')} value={formatCurrency(subscription?.credit_balance, locale)} />
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">{t('tenantBilling.invoiceTitle')}</p>
              {loading ? <span className="text-xs text-slate-500">{t('common.loading')}</span> : null}
            </div>
            <div className="mt-4 space-y-3">
              {!loading && invoices.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-4 py-5 text-sm text-slate-500">
                  {t('tenantBilling.invoiceEmpty')}
                </div>
              ) : null}
              {invoices.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-white">{item.invoice_number}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-cyan-200">{resolveInvoiceStateLabel(t, item.status === 'overdue' ? 'past_due' : item.status === 'issued' ? 'issued' : 'current')}</p>
                    </div>
                    <div className="rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-xs font-semibold text-slate-100">
                      {formatCurrency(item.total_amount, locale)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <FieldCard label={t('tenantBilling.totalAmountLabel')} value={formatCurrency(item.total_amount, locale)} />
                    <FieldCard label={t('tenantBilling.subscriptionAmountLabel')} value={formatCurrency(item.subscription_amount, locale)} />
                    <FieldCard label={t('tenantBilling.usageAmountLabel')} value={formatCurrency(item.usage_based_amount, locale)} />
                    <FieldCard label={t('tenantBilling.issueDateLabel')} value={formatDate(item.issue_date, locale)} />
                    <FieldCard label={t('tenantBilling.dueDateLabel')} value={formatDate(item.due_date, locale)} />
                    <FieldCard label={t('tenantBilling.paidDateLabel')} value={formatDate(item.paid_date, locale)} />
                    <FieldCard label={t('tenantBilling.paymentMethodLabel')} value={item.payment_method || t('common.notAvailable')} />
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