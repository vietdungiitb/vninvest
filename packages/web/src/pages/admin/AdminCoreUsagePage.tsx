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
  const { t } = useI18n();
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
            ? t('adminCoreUsage.errorNotFound')
            : t('adminCoreUsage.errorGeneric'));
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
                {t('adminCoreUsage.heroTitle')}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                {t('adminCoreUsage.heroDescription')}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/admin/tenants/${tenantId}`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreUsage.backToTenant')}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/pats`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreUsage.viewPats')}
            </Link>
            <Link
              to={`/admin/tenants/${tenantId}/billing`}
              className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/15"
            >
              {t('adminCoreUsage.viewBilling')}
            </Link>
            <button
              type="button"
              onClick={refresh}
              className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={loading}
            >
              {loading ? t('adminCoreUsage.loading') : t('adminCoreUsage.refresh')}
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
        title={t('adminCoreUsage.tenantInfoTitle')}
        description={t('adminCoreUsage.tenantInfoDescription')}
        actions={(
          <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {loading ? t('adminCoreUsage.syncing') : tenantSummary?.display_name || tenantId}
          </span>
        )}
      >
        {tenantSummary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardTenant'), value: tenantSummary.display_name || tenantSummary.tenant_code || tenantId, detail: tenantSummary.tenant_code || tenantId }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardPlan'), value: commercialSummary?.plan_code || tenantSummary.plan_code || '—', detail: commercialSummary?.billing_cycle || '—' }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardUsageRisk'), value: usageRisk, status: usageRisk }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardRemaining'), value: formatNumber(totalRemaining), detail: t('adminCoreUsage.cardRemainingDetail', { critical: criticalCount, warning: warningCount }) }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreUsage.tenantInfoLoading') : t('adminCoreUsage.tenantInfoEmpty')}
          </p>
        )}
      </AdminPanel>

      <AdminPanel
        title={t('adminCoreUsage.quotaSummaryTitle')}
        description={t('adminCoreUsage.quotaSummaryDescription')}
      >
        {meters.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardTotalMeters'), value: String(meters.length), detail: t('adminCoreUsage.cardDetailSnapshot') }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardWarnings'), value: String(warningCount), status: 'warning' }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardCritical'), value: String(criticalCount), status: 'critical' }} />
            <AdminMetricCard card={{ label: t('adminCoreUsage.cardRemainingCapacity'), value: formatNumber(totalRemaining) }} />
          </div>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {loading ? t('adminCoreUsage.summaryLoading') : t('adminCoreUsage.summaryEmpty')}
          </p>
        )}
      </AdminPanel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminPanel
          title={t('adminCoreUsage.meterUsageTitle')}
          description={t('adminCoreUsage.meterUsageDescription')}
        >
          {meters.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
                <thead className="bg-slate-50 dark:bg-slate-950/60">
                  <tr className="text-left text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3">{t('adminCoreUsage.thMeter')}</th>
                    <th className="px-4 py-3">{t('adminCoreUsage.thConsumed')}</th>
                    <th className="px-4 py-3">{t('adminCoreUsage.thRemaining')}</th>
                    <th className="px-4 py-3">{t('adminCoreUsage.thRisk')}</th>
                    <th className="px-4 py-3">{t('adminCoreUsage.thUpdated')}</th>
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
                            {t('adminCoreUsage.viewDetail')}
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
              {loading ? t('adminCoreUsage.meterUsageLoading') : t('adminCoreUsage.meterUsageEmpty')}
            </div>
          )}
        </AdminPanel>

        <AdminPanel
          title={t('adminCoreUsage.meterDetailTitle')}
          description={t('adminCoreUsage.meterDetailDescription')}
        >
          {selectedMeter ? (
            <div className="space-y-5">
              <div>
                <p className="text-lg font-semibold text-slate-950 dark:text-white">{selectedMeter.display_name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{selectedMeter.meter_code}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreUsage.statConsumed')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatNumber(selectedMeter.consumed_amount)}</p>
                  <UsageBar consumedAmount={selectedMeter.consumed_amount} entitledAmount={selectedMeter.entitled_amount} riskState={selectedMeter.risk_state} />
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreUsage.statRemaining')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{formatNumber(selectedMeter.remaining_amount)}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreUsage.statRisk')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedMeter.risk_state}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('adminCoreUsage.statHardStop')}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950 dark:text-white">{selectedMeter.hard_stop ? t('adminCoreUsage.hardStopYes') : t('adminCoreUsage.hardStopNo')}</p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminCoreUsage.propertiesTitle')}</h3>
                <AdminValueRow label={t('adminCoreUsage.propUnit')} value={selectedMeter.unit} />
                <AdminValueRow label={t('adminCoreUsage.propAggregationWindow')} value={selectedMeter.aggregation_window} />
                <AdminValueRow label={t('adminCoreUsage.propEntitledAmount')} value={formatNumber(selectedMeter.entitled_amount)} />
                <AdminValueRow label={t('adminCoreUsage.propOverageAmount')} value={formatNumber(selectedMeter.overage_amount)} />
                <AdminValueRow label={t('adminCoreUsage.propResetAt')} value={formatDateTime(selectedMeter.reset_at)} />
                <AdminValueRow label={t('adminCoreUsage.propPeriodStart')} value={formatDateTime(selectedMeter.period_start)} />
                <AdminValueRow label={t('adminCoreUsage.propPeriodEnd')} value={formatDateTime(selectedMeter.period_end)} />
                <AdminValueRow label={t('adminCoreUsage.propProjectedExhaustion')} value={selectedMeter.projected_exhaustion_at ? formatDateTime(selectedMeter.projected_exhaustion_at) : '—'} />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {t('adminCoreUsage.meterDetailNote')}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              {loading ? t('adminCoreUsage.meterDetailLoading') : t('adminCoreUsage.meterDetailEmpty')}
            </div>
          )}
        </AdminPanel>
      </div>
    </div>
  );
}
