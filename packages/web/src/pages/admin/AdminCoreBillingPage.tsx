import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { useI18n } from '../../context/LangContext.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

function formatDateTime(value: any) {
  if (!value) {
    return '—';
  }
  return value || '—';
}

function formatCurrency(value: any, localeTag = 'vi-VN') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat(localeTag, {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function AdminCoreBillingPage() {
  const { t, localeTag } = useI18n();
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenantDetail, setTenantDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const response = await (coreApiAdapter as unknown as { getCoreOperatorTenantDetail: (id: string) => Promise<any> }).getCoreOperatorTenantDetail(tenantId!);
        if (cancelled) {
          return;
        }
        setTenantDetail(response.data || null);
      } catch (nextError: any) {
        if (!cancelled) {
          setError(nextError?.response?.status === 404
            ? t('adminCoreBilling.errorNotFound')
            : t('adminCoreBilling.errorGeneric'));
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
  }, [refreshTick, tenantId, t]);

  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const usageMeters = Array.isArray(tenantDetail?.usage_meters) ? tenantDetail.usage_meters : [];
  const securitySummary = tenantDetail?.security_summary || null;
  const currentUsageRisk = securitySummary?.anomaly_state || tenantSummary?.current_usage_risk || 'normal';
  const pastDueMeterCount = usageMeters.filter((item: any) => item.risk_state === 'critical').length;
  const nextInvoiceDate = commercialSummary?.next_invoice_date || null;
  const renewalLabel = nextInvoiceDate ? formatDateTime(nextInvoiceDate) : '—';

  const refresh = () => {
    setRefreshTick((current) => current + 1);
  };

  // R0 defense-in-depth: route đã bọc StaffRoute, page tự chặn thêm.
  const { userIdentity } = usePortfolio() as any;
  const isStaffGate = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);
  if (!isStaffGate) {
    return (<p>{t('common.noPermission')}</p>);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{t('adminCoreTenants.heroEyebrow')}</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCoreBilling.heroTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreBilling.heroDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.backToTenant')}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/usage`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.viewUsage')}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/service-accounts`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.viewServiceAccounts')}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('adminCoreBilling.loading') : t('adminCoreBilling.refresh')}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <AdminPanel
        title={t('adminCoreBilling.tenantInfoTitle')}
        description={t('adminCoreBilling.tenantInfoDescription')}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? t('adminCoreBilling.syncing') : tenantSummary?.display_name || tenantId}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard card={{ label: t('adminCoreBilling.cardTenant'), value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <AdminMetricCard card={{ label: t('adminCoreBilling.cardPlan'), value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <AdminMetricCard card={{ label: t('adminCoreBilling.cardInvoiceState'), value: commercialSummary?.invoice_state || tenantSummary.invoice_state || '—', status: commercialSummary?.invoice_state || tenantSummary.invoice_state }} />
            <AdminMetricCard card={{ label: t('adminCoreBilling.cardUsageRisk'), value: currentUsageRisk, status: currentUsageRisk }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreBilling.tenantInfoLoading') : t('adminCoreBilling.tenantInfoEmpty')}
          </p>
        )}
      </AdminPanel>

      <AdminPanel
        title={t('adminCoreBilling.billingSummaryTitle')}
        description={t('adminCoreBilling.billingSummaryDescription')}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard card={{ label: t('adminCoreBilling.cardBillingCycle'), value: commercialSummary?.billing_cycle || '—' }} />
          <AdminMetricCard card={{ label: t('adminCoreBilling.cardInvoiceState'), value: commercialSummary?.invoice_state || '—', status: commercialSummary?.invoice_state }} />
          <AdminMetricCard card={{ label: t('adminCoreBilling.cardNextInvoice'), value: renewalLabel, detail: t('adminCoreBilling.cardDetailSnapshot') }} />
          <AdminMetricCard card={{ label: t('adminCoreBilling.cardCriticalMeters'), value: String(pastDueMeterCount), status: pastDueMeterCount > 0 ? 'critical' : 'normal' }} />
        </div>
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AdminPanel
          title={t('adminCoreBilling.subscriptionTitle')}
          description={t('adminCoreBilling.subscriptionDescription')}
        >
          {commercialSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardPlan'), value: commercialSummary.plan_code || '—' }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardStatus'), value: tenantSummary?.status || '—', status: tenantSummary?.status }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardBillingCycle'), value: commercialSummary.billing_cycle || '—' }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardInvoiceState'), value: commercialSummary.invoice_state || '—', status: commercialSummary.invoice_state }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardCurrentPeriod'), value: commercialSummary.current_period_start ? `${formatDateTime(commercialSummary.current_period_start)} → ${formatDateTime(commercialSummary.current_period_end)}` : '—' }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardNextInvoice'), value: renewalLabel }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardUsageRisk'), value: currentUsageRisk, status: currentUsageRisk }} />
              <AdminMetricCard card={{ label: t('adminCoreBilling.cardCreditBalance'), value: formatCurrency(commercialSummary.credit_balance || 0, localeTag) }} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? t('adminCoreBilling.subscriptionLoading') : t('adminCoreBilling.subscriptionEmpty')}</p>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('adminCoreBilling.commercialNote')}
          </div>
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreBilling.usageContextTitle')}
          description={t('adminCoreBilling.usageContextDescription')}
        >
          {usageMeters.length > 0 ? (
            <div className="space-y-3">
              {usageMeters.slice(0, 5).map((meter: any) => (
                <div key={meter.meter_code} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{meter.display_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{meter.meter_code}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(meter.risk_state)}`}>
                      {meter.risk_state}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <AdminValueRow label={t('adminCoreBilling.meterConsumed')} value={formatCurrency(meter.consumed_amount, localeTag)} />
                    <AdminValueRow label={t('adminCoreBilling.meterRemaining')} value={formatCurrency(meter.remaining_amount, localeTag)} />
                    <AdminValueRow label={t('adminCoreBilling.meterReset')} value={formatDateTime(meter.reset_at)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? t('adminCoreBilling.usageContextLoading') : t('adminCoreBilling.usageContextEmpty')}</p>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
