import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { usePortfolio } from '../../context/PortfolioContext.js';
import { coreApiAdapter } from '../../adapters/coreApiAdapter.js';
import { adminToneClasses } from './adminTone.js';

function Panel({ title, description, actions, children }: { title: string; description?: string | null; actions?: React.ReactNode; children: React.ReactNode }) {
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

function MetricCard({ card }: { card: any }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-black/5 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{card.label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-slate-950 dark:text-white">{card.value}</p>
          {card.detail ? <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{card.detail}</p> : null}
        </div>
        {card.status ? (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(card.status)}`}>
            {card.status}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ValueRow({ label, value }: { label: string; value: any }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-200 py-3 last:border-0 dark:border-slate-800">
      <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
      <span className="text-sm font-semibold text-slate-950 dark:text-white">{value}</span>
    </div>
  );
}

function formatDateTime(value: any) {
  if (!value) {
    return '—';
  }
  return value || '—';
}

function formatNumber(value: any) {
  if (value === null || value === undefined) {
    return '—';
  }

  if (value < 0) {
    return '∞';
  }

  return new Intl.NumberFormat('vi-VN').format(value);
}

function UsageBar({ consumedAmount, entitledAmount, riskState }: { consumedAmount: number; entitledAmount: number; riskState: string }) {
  const ratio = entitledAmount > 0 ? Math.min((consumedAmount / entitledAmount) * 100, 100) : 0;

  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all ${riskState === 'critical' ? 'bg-rose-500' : riskState === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`}
          style={{ width: `${ratio}%` }}
        />
      </div>
    </div>
  );
}

export function AdminCoreUsagePage() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const [tenantDetail, setTenantDetail] = useState<any>(null);
  const [meters, setMeters] = useState<any[]>([]);
  const [selectedMeterCode, setSelectedMeterCode] = useState('');
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
        const detail = response.data || null;
        const nextMeters = Array.isArray(detail?.usage_meters) ? detail.usage_meters : [];
        setTenantDetail(detail);
        setMeters(nextMeters);
        setSelectedMeterCode((current) => {
          if (current && nextMeters.some((item: any) => item.meter_code === current)) {
            return current;
          }
          return nextMeters[0]?.meter_code || '';
        });
      } catch (nextError: any) {
        if (!cancelled) {
          setError(nextError?.response?.status === 404
            ? 'Không tìm thấy tenant operator cần xem usage.'
            : 'Không tải được dữ liệu usage của tenant operator.');
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

  const selectedMeter = meters.find((item: any) => item.meter_code === selectedMeterCode) || null;
  const tenantSummary = tenantDetail?.tenant || null;
  const commercialSummary = tenantDetail?.commercial_summary || null;
  const securitySummary = tenantDetail?.security_summary || null;
  const totalRemaining = meters.reduce((sum: number, item: any) => {
    if (typeof item.remaining_amount !== 'number' || item.remaining_amount < 0) {
      return sum;
    }
    return sum + item.remaining_amount;
  }, 0);
  const warningCount = meters.filter((item: any) => item.risk_state === 'warning').length;
  const criticalCount = meters.filter((item: any) => item.risk_state === 'critical').length;
  const usageRisk = securitySummary?.anomaly_state || tenantSummary?.current_usage_risk || 'normal';

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
                {'Sử dụng và quota theo tenant'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {'Xem meter consumption, quota posture và cảnh báo quota từ current-code operator snapshot của tenant.'}
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
              to={`/admin/tenants/${tenantId}/pats`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem PATs'}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/billing`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {'Xem thanh toán'}
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

      <Panel
        title={'Thông tin tenant'}
        description={'Bối cảnh tenant operator đang được điều tra cho usage/quota.'}
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
            <MetricCard card={{ label: 'Rủi ro sử dụng', value: usageRisk, status: usageRisk }} />
            <MetricCard card={{ label: 'Còn lại', value: formatNumber(totalRemaining), detail: `${criticalCount} critical / ${warningCount} warning` }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải thông tin tenant…' : 'Chưa có thông tin tenant.'}
          </p>
        )}
      </Panel>

      <Panel
        title={'Tổng hợp quota'}
        description={'Các meter hiện có trong current-code tenant snapshot.'}
      >
        {meters.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard card={{ label: 'Tổng meter', value: String(meters.length), detail: 'Current snapshot' }} />
            <MetricCard card={{ label: 'Cảnh báo', value: String(warningCount), status: 'warning' }} />
            <MetricCard card={{ label: 'Nguy cấp', value: String(criticalCount), status: 'critical' }} />
            <MetricCard card={{ label: 'Dung lượng còn lại', value: formatNumber(totalRemaining) }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? 'Đang tải summary…' : 'Chưa có dữ liệu usage.'}
          </p>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel
          title={'Meter usage'}
          description={'Biểu đồ thanh và số liệu quota cho từng meter.'}
        >
          {meters.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">Meter</th>
                    <th className="px-4 py-3">Đã dùng</th>
                    <th className="px-4 py-3">Còn lại</th>
                    <th className="px-4 py-3">Rủi ro</th>
                    <th className="px-4 py-3">Cập nhật</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                  {meters.map((meter: any) => {
                    const isSelected = meter.meter_code === selectedMeterCode;
                    return (
                      <tr key={meter.meter_code} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                        <td className="px-4 py-4">
                          <div>
                            <p className="font-semibold text-slate-950 dark:text-white">{meter.display_name}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{meter.meter_code}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                              {meter.unit} • {meter.aggregation_window}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{formatNumber(meter.consumed_amount)}</td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{formatNumber(meter.remaining_amount)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${adminToneClasses(meter.risk_state)}`}>
                            {meter.risk_state}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-sm text-slate-600 dark:text-slate-300">{formatDateTime(meter.reset_at)}</td>
                        <td className="px-4 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedMeterCode(meter.meter_code)}
                            className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-300"
                          >
                            {'Xem chi tiết'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? 'Đang tải usage…' : 'Không có meter usage phù hợp.'}
            </div>
          )}
        </Panel>

        <Panel
          title={'Chi tiết meter'}
          description={'Quota, hard-stop và lịch reset của meter đang chọn.'}
        >
          {selectedMeter ? (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedMeter.display_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedMeter.meter_code}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Đã dùng</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatNumber(selectedMeter.consumed_amount)}</p>
                  <UsageBar consumedAmount={selectedMeter.consumed_amount} entitledAmount={selectedMeter.entitled_amount} riskState={selectedMeter.risk_state} />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Còn lại</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatNumber(selectedMeter.remaining_amount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Rủi ro</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedMeter.risk_state}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Hard-stop</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedMeter.hard_stop ? 'Có' : 'Không'}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">Thuộc tính chính</h3>
                <ValueRow label="Unit" value={selectedMeter.unit} />
                <ValueRow label="Aggregation window" value={selectedMeter.aggregation_window} />
                <ValueRow label="Entitled amount" value={formatNumber(selectedMeter.entitled_amount)} />
                <ValueRow label="Overage amount" value={formatNumber(selectedMeter.overage_amount)} />
                <ValueRow label="Reset at" value={formatDateTime(selectedMeter.reset_at)} />
                <ValueRow label="Period start" value={formatDateTime(selectedMeter.period_start)} />
                <ValueRow label="Period end" value={formatDateTime(selectedMeter.period_end)} />
                <ValueRow label="Projected exhaustion" value={selectedMeter.projected_exhaustion_at ? formatDateTime(selectedMeter.projected_exhaustion_at) : '—'} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {'Màn hình này dùng current-code tenant snapshot, chưa cần commercial-side endpoint riêng. Meter detail phản ánh usage/quota thật của tenant operator.'}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? 'Đang tải chi tiết meter…' : 'Chọn một meter trong bảng bên trái để mở chi tiết.'}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
