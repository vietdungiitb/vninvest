import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCoreOperatorTenantDetail } from '../api/client';
import { useI18n } from '../context/LangContext';

function toneClasses(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'active' || normalized === 'healthy' || normalized === 'normal') {
    return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200';
  }
  if (normalized === 'warning' || normalized === 'trialing') {
    return 'border-amber-500/25 bg-amber-500/10 text-amber-200';
  }
  if (normalized === 'critical' || normalized === 'past_due' || normalized === 'overdue' || normalized === 'credit_hold') {
    return 'border-rose-500/25 bg-rose-500/10 text-rose-200';
  }
  return 'border-slate-700 bg-slate-900/70 text-slate-200';
}

function Panel({ title, description, actions, children }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h2>
          {description ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ card }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
          {card.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p> : null}
        </div>
        {card.status ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(card.status)}`}>
            {card.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ValueRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function formatDateTime(value, formatDateTimeFn) {
  if (!value) {
    return '—';
  }

  return formatDateTimeFn(value, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
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

export default function AdminCoreBilling() {
  const { tenantId } = useParams();
  const { t, locale, formatDateTime: formatI18nDateTime } = useI18n();
  const [tenantDetail, setTenantDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const response = await getCoreOperatorTenantDetail(tenantId);
        if (cancelled) {
          return;
        }
        setTenantDetail(response.data || null);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError?.response?.status === 404
            ? 'Không tìm thấy tenant operator cần xem thanh toán.'
            : 'Không tải được dữ liệu thanh toán của tenant operator.');
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
  }, [refreshTick, tenantId]);

  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const usageMeters = Array.isArray(tenantDetail?.usage_meters) ? tenantDetail.usage_meters : [];
  const securitySummary = tenantDetail?.security_summary || null;
  const currentUsageRisk = securitySummary?.anomaly_state || tenantSummary?.current_usage_risk || 'normal';
  const pastDueMeterCount = usageMeters.filter((item) => item.risk_state === 'critical').length;
  const nextInvoiceDate = commercialSummary?.next_invoice_date || null;
  const renewalLabel = nextInvoiceDate ? formatDateTime(nextInvoiceDate, formatI18nDateTime) : '—';

  const refresh = () => {
    setRefreshTick((current) => current + 1);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {t('adminCoreBilling.title', { defaultValue: 'Thanh toán và subscription theo tenant' })}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreBilling.description', {
                  defaultValue: 'Theo dõi subscription, invoice state và rủi ro thanh toán từ current-code operator snapshot của tenant.',
                })}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/core/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.backToTenant', { defaultValue: 'Quay lại tenant' })}
            </Link>
            <Link
              to={`/admin/core/tenants/${tenantId}/usage`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.openUsage', { defaultValue: 'Xem usage' })}
            </Link>
            <Link
              to={`/admin/core/tenants/${tenantId}/service-accounts`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreBilling.openServiceAccounts', { defaultValue: 'Xem service accounts' })}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Đang tải…' : t('adminCoreBilling.refresh', { defaultValue: 'Làm mới' })}
            </button>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      ) : null}

      <Panel
        title={t('adminCoreBilling.tenantTitle', { defaultValue: 'Thông tin tenant' })}
        description={t('adminCoreBilling.tenantDescription', { defaultValue: 'Bối cảnh tenant operator đang được điều tra cho thanh toán.' })}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? 'Đang đồng bộ…' : tenantSummary?.display_name || tenantId}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard card={{ label: 'Tenant', value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <MetricCard card={{ label: 'Plan', value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <MetricCard card={{ label: 'Invoice state', value: commercialSummary?.invoice_state || tenantSummary.invoice_state || '—', status: commercialSummary?.invoice_state || tenantSummary.invoice_state }} />
            <MetricCard card={{ label: 'Rủi ro sử dụng', value: currentUsageRisk, status: currentUsageRisk }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </Panel>

      <Panel
        title={t('adminCoreBilling.summaryTitle', { defaultValue: 'Tổng hợp billing' })}
        description={t('adminCoreBilling.summaryDescription', { defaultValue: 'Dữ liệu subscription và billing posture từ current-code operator snapshot.' })}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard card={{ label: 'Billing cycle', value: commercialSummary?.billing_cycle || '—' }} />
          <MetricCard card={{ label: 'Invoice state', value: commercialSummary?.invoice_state || '—', status: commercialSummary?.invoice_state }} />
          <MetricCard card={{ label: 'Next invoice', value: renewalLabel, detail: 'Current snapshot' }} />
          <MetricCard card={{ label: 'Critical meters', value: String(pastDueMeterCount), status: pastDueMeterCount > 0 ? 'critical' : 'normal' }} />
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <Panel
          title={t('adminCoreBilling.subscriptionTitle', { defaultValue: 'Subscription summary' })}
          description={t('adminCoreBilling.subscriptionDescription', { defaultValue: 'Trạng thái subscription và chu kỳ hiện tại của tenant operator.' })}
        >
          {commercialSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <MetricCard card={{ label: 'Plan', value: commercialSummary.plan_code || '—' }} />
              <MetricCard card={{ label: 'Status', value: tenantSummary?.status || '—', status: tenantSummary?.status }} />
              <MetricCard card={{ label: 'Billing cycle', value: commercialSummary.billing_cycle || '—' }} />
              <MetricCard card={{ label: 'Invoice state', value: commercialSummary.invoice_state || '—', status: commercialSummary.invoice_state }} />
              <MetricCard card={{ label: 'Current period', value: commercialSummary.current_period_start ? `${formatDateTime(commercialSummary.current_period_start, formatI18nDateTime)} → ${formatDateTime(commercialSummary.current_period_end, formatI18nDateTime)}` : '—' }} />
              <MetricCard card={{ label: 'Next invoice', value: renewalLabel }} />
              <MetricCard card={{ label: 'Usage risk', value: currentUsageRisk, status: currentUsageRisk }} />
              <MetricCard card={{ label: 'Credit balance', value: formatCurrency(commercialSummary.credit_balance || 0, locale) }} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Đang tải subscription…' : 'Chưa có dữ liệu subscription.'}</p>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {t('adminCoreBilling.readFirstNote', {
              defaultValue: 'Màn hình này phản ánh current-code commercial snapshot. Invoice table đầy đủ sẽ xuất hiện khi operator commercial wrapper được mở thêm.',
            })}
          </div>
        </Panel>

        <Panel
          title={t('adminCoreBilling.meterTitle', { defaultValue: 'Usage context' })}
          description={t('adminCoreBilling.meterDescription', { defaultValue: 'Meter posture ảnh hưởng trực tiếp đến billing state.' })}
        >
          {usageMeters.length > 0 ? (
            <div className="space-y-3">
              {usageMeters.slice(0, 5).map((meter) => (
                <div key={meter.meter_code} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950 dark:text-white">{meter.display_name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{meter.meter_code}</p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(meter.risk_state)}`}>
                      {meter.risk_state}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <ValueRow label="Dùng" value={formatCurrency(meter.consumed_amount, locale)} />
                    <ValueRow label="Còn lại" value={formatCurrency(meter.remaining_amount, locale)} />
                    <ValueRow label="Hết hạn" value={formatDateTime(meter.reset_at, formatI18nDateTime)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Đang tải usage context…' : 'Chưa có usage context.'}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}