import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { adminToneClasses } from './adminTone.js';
import { AdminPanel, AdminMetricCard, AdminValueRow } from './adminUi.js';

function formatDateTime(value: any) {
  if (!value) {
    return '—';
  }
  return value || '—';
}

function formatCurrency(value: any) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '—';
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(value));
}

export function AdminCoreBillingPage() {
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
    return (<p>Không đủ quyền truy cập.</p>);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-6 py-6 text-white shadow-2xl shadow-slate-950/30">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">Central Operator Admin</p>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">
                {'Thanh toán và subscription theo tenant'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {'Theo dõi subscription, invoice state và rủi ro thanh toán từ current-code operator snapshot của tenant.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Quay lại tenant'}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/usage`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem usage'}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/service-accounts`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem service accounts'}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? 'Đang tải…' : 'Làm mới'}
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
        title={'Thông tin tenant'}
        description={'Bối cảnh tenant operator đang được điều tra cho thanh toán.'}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? 'Đang đồng bộ…' : tenantSummary?.display_name || tenantId}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard card={{ label: 'Tenant', value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <AdminMetricCard card={{ label: 'Plan', value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <AdminMetricCard card={{ label: 'Invoice state', value: commercialSummary?.invoice_state || tenantSummary.invoice_state || '—', status: commercialSummary?.invoice_state || tenantSummary.invoice_state }} />
            <AdminMetricCard card={{ label: 'Rủi ro sử dụng', value: currentUsageRisk, status: currentUsageRisk }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </AdminPanel>

      <AdminPanel
        title={'Tổng hợp billing'}
        description={'Dữ liệu subscription và billing posture từ current-code operator snapshot.'}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminMetricCard card={{ label: 'Billing cycle', value: commercialSummary?.billing_cycle || '—' }} />
          <AdminMetricCard card={{ label: 'Invoice state', value: commercialSummary?.invoice_state || '—', status: commercialSummary?.invoice_state }} />
          <AdminMetricCard card={{ label: 'Next invoice', value: renewalLabel, detail: 'Current snapshot' }} />
          <AdminMetricCard card={{ label: 'Critical meters', value: String(pastDueMeterCount), status: pastDueMeterCount > 0 ? 'critical' : 'normal' }} />
        </div>
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
        <AdminPanel
          title={'Subscription summary'}
          description={'Trạng thái subscription và chu kỳ hiện tại của tenant operator.'}
        >
          {commercialSummary ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminMetricCard card={{ label: 'Plan', value: commercialSummary.plan_code || '—' }} />
              <AdminMetricCard card={{ label: 'Status', value: tenantSummary?.status || '—', status: tenantSummary?.status }} />
              <AdminMetricCard card={{ label: 'Billing cycle', value: commercialSummary.billing_cycle || '—' }} />
              <AdminMetricCard card={{ label: 'Invoice state', value: commercialSummary.invoice_state || '—', status: commercialSummary.invoice_state }} />
              <AdminMetricCard card={{ label: 'Current period', value: commercialSummary.current_period_start ? `${formatDateTime(commercialSummary.current_period_start)} → ${formatDateTime(commercialSummary.current_period_end)}` : '—' }} />
              <AdminMetricCard card={{ label: 'Next invoice', value: renewalLabel }} />
              <AdminMetricCard card={{ label: 'Usage risk', value: currentUsageRisk, status: currentUsageRisk }} />
              <AdminMetricCard card={{ label: 'Credit balance', value: formatCurrency(commercialSummary.credit_balance || 0) }} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Đang tải subscription…' : 'Chưa có dữ liệu subscription.'}</p>
          )}

          <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {'Màn hình này phản ánh current-code commercial snapshot. Invoice table đầy đủ sẽ xuất hiện khi operator commercial wrapper được mở thêm.'}
          </div>
        </AdminPanel>

        <AdminPanel
          title={'Usage context'}
          description={'Meter posture ảnh hưởng trực tiếp đến billing state.'}
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
                    <AdminValueRow label="Dùng" value={formatCurrency(meter.consumed_amount)} />
                    <AdminValueRow label="Còn lại" value={formatCurrency(meter.remaining_amount)} />
                    <AdminValueRow label="Hết hạn" value={formatDateTime(meter.reset_at)} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">{loading ? 'Đang tải usage context…' : 'Chưa có usage context.'}</p>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
