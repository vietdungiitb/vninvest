import styles from "../../components/ShellPageTemplate.module.css";
import ta from "./TenantAdmin.module.css";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
import { useTenantAdminQuery } from "./useTenantAdminQuery.js";
interface Meter {
  meter_code: string;
  display_name: string;
  consumed_amount: number;
  remaining_amount: number;
  reset_at?: string;
  risk_state: string;
}

interface Quota {
  meter_code: string;
  display_name: string;
  unit: string;
  entitled_amount: number;
  consumed_amount: number;
  remaining_amount: number;
  hard_stop: boolean;
}

interface DailyPoint {
  date: string;
  consumed: number;
}

interface ForecastResult {
  meter_code: string;
  daily_rate: number | null;
  days_remaining: number | null;
  forecast_exhaust_date: string | null;
  confidence: string;
  total_entitled: number;
  total_consumed: number;
  remaining: number;
}

interface AlertConfig {
  meter_code: string;
  warning_pct: number;
  critical_pct: number;
  enabled: boolean;
  notify_email: boolean;
}

interface ApiUsageGroup {
  key: string;
  count: number;
  error_count?: number;
  avg_duration_ms?: number;
}

interface ApiUsageAnalyticsResponse {
  group_by: string;
  data: ApiUsageGroup[];
  days: number;
  start_date: string;
  end_date: string;
}

interface ApiUsageAnalyticsResponse {
  group_by: string;
  data: ApiUsageGroup[];
}

interface UsageBarProps {
  consumedAmount: number;
  entitledAmount: number;
  riskState: string;
}

interface TenantAdminUsagePageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const METER_CODES = ["api_calls", "ai_regenerate", "whale_symbols", "exports"];

function resolveToneColor(riskState: string): string {
  if (riskState === "critical") return "#ef4444";
  if (riskState === "warning") return "#f59e0b";
  return "#10b981";
}

function UsageBar({ consumedAmount, entitledAmount, riskState }: UsageBarProps) {
  const ratio = entitledAmount > 0 ? Math.min((consumedAmount / entitledAmount) * 100, 100) : 0;
  const toneColor = resolveToneColor(riskState);

  return (
    <div className={ta.usage_1}>
      <div className={ta.usage_2}>
        <div className={ta.usage_3} style={{ width: `${ratio}%`, background: toneColor }} />
      </div>
    </div>
  );
}

export function TenantAdminUsagePage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminUsagePageProps) {
  const { t, formatNumber: fmtNumber, formatDate: fmtDate } = useI18n();
  const { ability } = usePortfolio();

  const [meters, setMeters] = useState<Meter[]>([]);
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [tenantApiUsage, setTenantApiUsage] = useState<{ api_calls_limit: number; api_calls_used: number } | null>(null);

  const [activeTab, setActiveTab] = useState<"meters" | "history" | "forecast" | "analytics">("meters");
  const [historyData, setHistoryData] = useState<Record<string, DailyPoint[]>>({});
  const [historyDays, setHistoryDays] = useState(30);
  const [selectedMeter, setSelectedMeter] = useState("api_calls");

  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);

  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);

  const [analyticsData, setAnalyticsData] = useState<ApiUsageAnalyticsResponse | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<"ip" | "endpoint" | "status" | "hour">("endpoint");
  const [analyticsDays, setAnalyticsDays] = useState(7);

  const adapter = defaultCoreApiAdapter as unknown as {
    coreGet: (u: string) => Promise<any>;
    getApiUsageAnalytics: (g: string, d: number) => Promise<any>;
    getAllUsageTrends: (d: number) => Promise<any>;
    getUsageForecast: () => Promise<any>;
    getAlertConfigs: () => Promise<any>;
  };

  const {
    data: mainData,
    isLoading: loading,
    error,
    refetch,
  } = useTenantAdminQuery<{
    meters: Meter[];
    quotas: Quota[];
    tenantApiUsage: { api_calls_limit: number; api_calls_used: number };
  }>(
    ["tenant-usage-main"],
    "/partner/usage/meters/",
    {
      queryFn: async () => {
        const [metersData, quotasData, tenantData] = await Promise.all([
          adapter.coreGet("/partner/usage/meters/"),
          adapter.coreGet("/partner/usage/quotas/"),
          adapter.coreGet("/partner/tenant/"),
        ]);
        return {
          meters: metersData.results || [],
          quotas: quotasData.results || [],
          tenantApiUsage: {
            api_calls_limit: tenantData.api_calls_limit ?? -1,
            api_calls_used: tenantData.api_calls_used ?? 0,
          },
        };
      },
    },
  );

  if (mainData) {
    if (meters !== mainData.meters) setMeters(mainData.meters);
    if (quotas !== mainData.quotas) setQuotas(mainData.quotas);
    if (tenantApiUsage !== mainData.tenantApiUsage) setTenantApiUsage(mainData.tenantApiUsage);
  }

  const { data: historyData_, isFetching: historyLoading } = useTenantAdminQuery<{ meters: Record<string, DailyPoint[]> }>(
    ["tenant-usage-history", String(historyDays)],
    "/partner/usage/trends/",
    {
      enabled: activeTab === "history",
      queryFn: async () => {
        const data = await adapter.getAllUsageTrends(historyDays);
        return { meters: data.meters || {} };
      },
    },
  );
  if (historyData_ && historyData !== historyData_.meters) setHistoryData(historyData_.meters);

  const { data: forecastData, isFetching: forecastLoading } = useTenantAdminQuery<{ forecasts: ForecastResult[] }>(
    ["tenant-usage-forecast"],
    "/partner/usage/forecast/",
    {
      enabled: activeTab === "forecast",
      queryFn: async () => {
        const data = await adapter.getUsageForecast();
        return { forecasts: data.forecasts || [] };
      },
    },
  );
  if (forecastData && forecasts !== forecastData.forecasts) setForecasts(forecastData.forecasts);

  const { data: analyticsData_, isFetching: analyticsLoading, error: analyticsErr } = useTenantAdminQuery<ApiUsageAnalyticsResponse>(
    ["tenant-usage-analytics", analyticsGroupBy, String(analyticsDays)],
    "/partner/usage/analytics/",
    {
      enabled: activeTab === "analytics",
      queryFn: async () => {
        return adapter.getApiUsageAnalytics(analyticsGroupBy, analyticsDays);
      },
    },
  );
  if (analyticsData_ && analyticsData !== analyticsData_) setAnalyticsData(analyticsData_);
  if (analyticsErr && analyticsError !== (analyticsErr.message || null)) setAnalyticsError(analyticsErr.message || null);

  const { data: alertData, isFetching: alertConfigLoading } = useTenantAdminQuery<{ configs: AlertConfig[] }>(
    ["tenant-usage-alerts"],
    "/partner/usage/alert-configs/",
    {
      enabled: activeTab === "meters",
      queryFn: async () => {
        const data = await adapter.getAlertConfigs();
        return { configs: data.configs || [] };
      },
    },
  );
  if (alertData && alertConfigs !== alertData.configs) setAlertConfigs(alertData.configs);

  const canRead = ability?.can?.("read", "TenantUsageView") ?? false;

  // History chart data (must be before early returns — React hook order)
  const chartData = useMemo(() => {
    const selected = historyData[selectedMeter] || [];
    return selected.map(d => ({
      date: d.date.slice(5),
      consumed: d.consumed,
    }));
  }, [historyData, selectedMeter]);

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsage.eyebrow")}
        title={t("tenantUsage.title")}
        description={t("tenantUsage.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("tenantUsage.meterEmpty")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && meters.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsage.eyebrow")}
        title={t("tenantUsage.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="metric" count={2} />
        <div className={ta.usage_4} />
        <ShellSkeleton variant="table-row" count={5} />
      </ShellPageChrome>
    );
  }

  if (error && meters.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsage.eyebrow")}
        title={t("tenantUsage.title")}
        description={t("tenantUsage.loadError")}
        error={error?.message || t("tenantUsage.loadError")}
      >
        <div className={`${styles.panel}`}>{error?.message || t("tenantUsage.loadError")}</div>
      </ShellPageChrome>
    );
  }

  const formatUsageNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return t("common.notAvailable");
    if (value < 0) return t("tenantHome.unlimited");
    return fmtNumber(value);
  };

  const formatUsageDate = (value: string | null | undefined): string => {
    if (!value) return t("common.notAvailable");
    return fmtDate(value);
  };

  const quotaByMeterCode = new Map(quotas.map(q => [q.meter_code, q]));
  const warningCount = meters.filter(m => m.risk_state === "warning").length;
  const criticalCount = meters.filter(m => m.risk_state === "critical").length;

  const metrics = [
    renderShellMetric(t("tenantUsage.metricMeters"), String(meters.length)),
    renderShellMetric(t("tenantUsage.metricWarnings"), String(warningCount)),
    renderShellMetric(t("tenantUsage.metricCritical"), String(criticalCount)),
  ];

  // Alert indicator for API calls usage
  const apiUsagePct = tenantApiUsage && tenantApiUsage.api_calls_limit > 0
    ? Math.round((tenantApiUsage.api_calls_used / tenantApiUsage.api_calls_limit) * 100)
    : 0;
  const apiAlertRisk = apiUsagePct >= 95 ? "critical" : apiUsagePct >= 80 ? "warning" : "normal";
  const apiAlertColor = resolveToneColor(apiAlertRisk);
  const apiAlertText = apiUsagePct > 0
    ? `${t("tenantUsage.apiCallsUsage", { defaultValue: "API Calls Usage" })}: ${apiUsagePct}% ${t("tenantUsage.usedOfLimit", { defaultValue: "used / limit" })}`
    : "";

  const refreshAction = (
    <button onClick={() => refetch()} className={`${styles.button} ${styles.buttonSecondary}`}>
      {t("tenantUsage.refreshAction")}
    </button>
  );

  const tabs = [
    { key: "meters" as const, label: t("tenantUsage.tabMeters") },
    { key: "history" as const, label: t("tenantUsage.tabHistory") },
    { key: "forecast" as const, label: t("tenantUsage.tabForecast") },
    { key: "analytics" as const, label: t("tenantUsage.tabAnalytics", { defaultValue: "API Analytics" }) },
  ];

  const tabBar = (
    <div className={ta.usage_5}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          className={ta.usage_6} style={{ background: activeTab === tab.key ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)", color: activeTab === tab.key ? "var(--accent-shell)" : "var(--text-primary)", border: activeTab === tab.key ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)" }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <ShellPageChrome
      eyebrow={t("tenantUsage.eyebrow")}
      title={t("tenantUsage.title")}
      description={t("tenantUsage.description")}
      metrics={metrics}
    >
      <section className={`${styles.stack}`}>
        {tabBar}

        {/* Alert indicator bar */}
        {apiUsagePct > 0 && (
          <div
            className={ta.usage_7} style={{ background: `${apiAlertColor}20`, border: `1px solid ${apiAlertColor}`, color: apiAlertColor }}
          >
            <span className={ta.usage_8}>{apiAlertRisk === "critical" ? "🔴" : "🟡"}</span>
            <span>{apiAlertText}</span>
            <div
              className={ta.usage_9}
            >
              <div
                className={ta.usage_10} style={{ width: `${Math.min(apiUsagePct, 100)}%`, background: apiAlertColor }}
              />
            </div>
          </div>
        )}

        {/* Meters Tab */}
        {activeTab === "meters" && (
          <>
            <ShellPanel title={t("tenantUsage.apiCallsUsageTitle", { defaultValue: "API Calls Usage" })}>
              {tenantApiUsage ? (() => {
                const apiLimit = tenantApiUsage.api_calls_limit;
                const apiUsed = tenantApiUsage.api_calls_used;
                const apiRatio = apiLimit > 0 ? (apiUsed / apiLimit) * 100 : 0;
                const apiRisk = apiRatio >= 95 ? "critical" : apiRatio >= 80 ? "warning" : "normal";
                return (
                  <div>
                    <UsageBar consumedAmount={apiLimit > 0 ? apiUsed : 0} entitledAmount={apiLimit > 0 ? apiLimit : 0} riskState={apiRisk} />
                    <div className={ta.usage_11}>
                      <div>
                        <span className={[`${styles.itemMeta}`, ta.usage_12].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>{t("tenantUsage.consumedLabel")}</span>
                        <span className={ta.usage_13}>{formatUsageNumber(apiUsed)}</span>
                      </div>
                      <div>
                        <span className={[`${styles.itemMeta}`, ta.usage_14].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>{t("tenantUsage.limitLabel")}</span>
                        <span className={ta.usage_15}>{formatUsageNumber(apiLimit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div className={ta.usage_16}>{t("common.loading")}</div>
              )}
            </ShellPanel>

            <ShellPanel title={t("tenantUsage.meterListTitle")} actions={refreshAction}>
              <div className={`${styles.list}`}>
                {meters.length === 0 ? (
          <ShellEmptyState description={t("tenantUsage.meterEmpty")} />
                ) : (
                  meters.map(meter => {
                    const quota = quotaByMeterCode.get(meter.meter_code);
                    const entitledAmount = quota?.entitled_amount ?? -1;
                    const alertConfig = alertConfigs.find(c => c.meter_code === meter.meter_code);

                    return (
                      <div key={meter.meter_code} className={`${styles.listItem}`}>
                        <div className={`${styles.listItemHeader}`}>
                          <div>
                            <div className={`${styles.itemTitle}`} style={{ fontSize: "15px" }}>{meter.display_name}</div>
                            <code className={ta.usage_17}>{meter.meter_code}</code>
                          </div>
                          <span
                            className={`${styles.pill}`}
                            style={{
                              background: meter.risk_state === "critical" ? "rgba(239,68,68,0.2)" : (meter.risk_state === "warning" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"),
                              color: meter.risk_state === "critical" ? "#ef4444" : (meter.risk_state === "warning" ? "#f59e0b" : "#10b981"),
                            }}
                          >
                            {t(`tenantUsage.risk.${meter.risk_state}`, { defaultValue: meter.risk_state })}
                          </span>
                        </div>
                        <UsageBar consumedAmount={meter.consumed_amount} entitledAmount={entitledAmount} riskState={meter.risk_state} />
                        <div className={ta.usage_18}>
                          <div>
                            <span className={[`${styles.itemMeta}`, ta.usage_19].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>{t("tenantUsage.consumedLabel")}</span>
                            <span className={ta.usage_20}>{formatUsageNumber(meter.consumed_amount)}</span>
                          </div>
                          <div>
                            <span className={[`${styles.itemMeta}`, ta.usage_21].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>{t("tenantUsage.remainingLabel")}</span>
                            <span className={ta.usage_22}>{formatUsageNumber(meter.remaining_amount)}</span>
                          </div>
                          <div>
                            <span className={[`${styles.itemMeta}`, ta.usage_23].filter(Boolean).join(" ")} style={{ fontSize: "11px" }}>{t("tenantUsage.resetAtLabel")}</span>
                            <span className={ta.usage_24}>{formatUsageDate(meter.reset_at)}</span>
                          </div>
                        </div>
                        {alertConfig && alertConfig.enabled && (
                          <div className={ta.usage_25}>
                            {t("tenantUsage.alertThresholds")}: {t("tenantUsage.warningLabel")} {alertConfig.warning_pct}%, {t("tenantUsage.criticalLabel")} {alertConfig.critical_pct}%
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {alertConfigLoading && <div className={ta.usage_26}>{t("common.loading")}</div>}
            </ShellPanel>

            <ShellPanel title={t("tenantUsage.quotaListTitle")}>
              <div className={`${styles.list}`}>
                {quotas.length === 0 ? (
                  <ShellEmptyState description={t("tenantUsage.quotaEmpty")} />
                ) : (
                  quotas.map(quota => (
                    <div key={quota.meter_code} className={`${styles.listItem}`}>
                      <div className={`${styles.listItemHeader}`}>
                        <div>
                          <span className={`${styles.itemTitle}`} style={{ fontSize: "14px" }}>{quota.display_name}</span>
                          <span className={[`${styles.itemMeta}`, ta.usage_27].filter(Boolean).join(" ")} style={{ marginTop: "2px" }}>
                            {t("tenantUsage.limitLabel")}: {formatUsageNumber(quota.entitled_amount)} {quota.unit}
                          </span>
                        </div>
                        <span
                          className={`${styles.pill}`}
                          style={{
                            background: quota.hard_stop ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                            color: quota.hard_stop ? "#ef4444" : "#10b981",
                          }}
                        >
                          {quota.hard_stop ? t("tenantUsage.hardStop") : t("tenantUsage.overageAllowed")}
                        </span>
                      </div>
                      <div className={ta.usage_28}>
                        <div>
                          <span className={[`${styles.itemMeta}`, ta.usage_29].filter(Boolean).join(" ")} style={{ fontSize: "10px" }}>{t("tenantUsage.limitLabel")}</span>
                          <span className={ta.usage_30}>{formatUsageNumber(quota.entitled_amount)}</span>
                        </div>
                        <div>
                          <span className={[`${styles.itemMeta}`, ta.usage_31].filter(Boolean).join(" ")} style={{ fontSize: "10px" }}>{t("tenantUsage.consumedLabel")}</span>
                          <span className={ta.usage_32}>{formatUsageNumber(quota.consumed_amount)}</span>
                        </div>
                        <div>
                          <span className={[`${styles.itemMeta}`, ta.usage_33].filter(Boolean).join(" ")} style={{ fontSize: "10px" }}>{t("tenantUsage.remainingLabel")}</span>
                          <span className={ta.usage_34}>{formatUsageNumber(quota.remaining_amount)}</span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ShellPanel>
          </>
        )}

        {/* History Tab */}
        {activeTab === "history" && (
          <ShellPanel title={t("tenantUsage.historyTitle")}>
            <div className={ta.usage_35}>
              <div className={ta.usage_36}>
                {METER_CODES.map(code => (
                  <button
                    key={code}
                    onClick={() => setSelectedMeter(code)}
                    className={ta.usage_37} style={{ background: selectedMeter === code ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)", color: selectedMeter === code ? "var(--accent-shell)" : "var(--text-primary)", border: selectedMeter === code ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)" }}
                  >
                    {t(`tenantUsage.meter.${code}`, { defaultValue: code })}
                  </button>
                ))}
              </div>
              <div className={ta.usage_38}>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => { setHistoryDays(d); }}
                    className={ta.usage_39} style={{ background: historyDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)", color: historyDays === d ? "var(--accent-shell)" : "var(--text-primary)", border: historyDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)" }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className={ta.usage_40}>{t("common.loading")}</div>
            ) : chartData.length > 0 ? (
              <div className={ta.usage_41}>
                <ResponsiveContainer>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                      }}
                    />
                    <Bar dataKey="consumed" fill="#00b4d8" radius={[4, 4, 0, 0]} name={t("tenantUsage.consumedLabel")} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <ShellEmptyState description={t("tenantUsage.noHistoryData")} />
            )}
          </ShellPanel>
        )}

        {/* Forecast Tab */}
        {activeTab === "forecast" && (
          <div className={ta.usage_42}>
            {forecastLoading ? (
              <div className={ta.usage_43}>{t("common.loading")}</div>
            ) : forecasts.length > 0 ? (
              forecasts.map(f => (
                <ShellPanel key={f.meter_code} title={t(`tenantUsage.meter.${f.meter_code}`, { defaultValue: f.meter_code })}>
                  <div className={ta.usage_44}>
                    <div className={ta.usage_45}>
                      <span className={ta.usage_46}>{t("tenantUsage.dailyRateLabel")}</span>
                      <span className={ta.usage_47}>{f.daily_rate != null ? formatUsageNumber(f.daily_rate) : "—"}</span>
                    </div>
                    <div className={ta.usage_48}>
                      <span className={ta.usage_49}>{t("tenantUsage.daysRemainingLabel")}</span>
                      <span className={ta.usage_50} style={{ color: f.days_remaining != null && f.days_remaining < 7 ? "#ef4444" : f.days_remaining != null && f.days_remaining < 14 ? "#f59e0b" : "#10b981" }}>
                        {f.days_remaining != null ? `${f.days_remaining} ${t("tenantUsage.daysLabel")}` : t("tenantUsage.unlimited")}
                      </span>
                    </div>
                    {f.forecast_exhaust_date && (
                      <div className={ta.usage_51}>
                        <span className={ta.usage_52}>{t("tenantUsage.exhaustDateLabel")}</span>
                        <span className={ta.usage_53}>{f.forecast_exhaust_date}</span>
                      </div>
                    )}
                    <div className={ta.usage_54}>
                      <span className={ta.usage_55}>{t("tenantUsage.confidenceLabel")}</span>
                      <span className={`${styles.pill}`} style={{
                        background: f.confidence === "high" ? "rgba(16,185,129,0.2)" : f.confidence === "medium" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                        color: f.confidence === "high" ? "#10b981" : f.confidence === "medium" ? "#f59e0b" : "#ef4444",
                      }}>
                        {t(`tenantUsage.confidence.${f.confidence}`, { defaultValue: f.confidence })}
                      </span>
                    </div>
                    <div className={ta.usage_56}>
                      <span className={ta.usage_57}>{t("tenantUsage.remainingLabel")}</span>
                      <span className={ta.usage_58}>{formatUsageNumber(f.remaining)}</span>
                    </div>
                  </div>
                </ShellPanel>
              ))
            ) : (
              <ShellEmptyState description={t("tenantUsage.noForecastData")} />
            )}
          </div>
        )}
        {/* Analytics Tab */}
        {activeTab === "analytics" && (
          <ShellPanel title={t("tenantUsage.analyticsTitle", { defaultValue: "API Analytics" })}>
            <div className={ta.usage_59}>
              <div className={ta.usage_60}>
                {(["ip", "endpoint", "status", "hour"] as const).map(group => (
                  <button
                    key={group}
                    onClick={() => { setAnalyticsGroupBy(group); }}
                    className={ta.usage_61} style={{ background: analyticsGroupBy === group ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)", color: analyticsGroupBy === group ? "var(--accent-shell)" : "var(--text-primary)", border: analyticsGroupBy === group ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)" }}
                  >
                    {t(`tenantUsage.analytics.groupBy.${group}`, { defaultValue: group })}
                  </button>
                ))}
              </div>
              <div className={ta.usage_62}>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => { setAnalyticsDays(d); }}
                    className={ta.usage_63} style={{ background: analyticsDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)", color: analyticsDays === d ? "var(--accent-shell)" : "var(--text-primary)", border: analyticsDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)" }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div className={ta.usage_64}>{t("common.loading")}</div>
            ) : analyticsError ? (
              <div className={ta.usage_65}>{analyticsError}</div>
            ) : analyticsData?.data && analyticsData.data.length > 0 ? (
              <div className={ta.usage_66}>
                <ShellPanel title={t("tenantUsage.analytics.topItems", { defaultValue: "Top Items" })}>
                  <div className={`${styles.list}`}>
                    {analyticsData.data.map((item, idx) => (
                      <div key={`${item.key}-${idx}`} className={`${styles.listItem}`}>
                        <div className={ta.usage_67}>
                          <code className={ta.usage_68}>{item.key}</code>
                          <span className={`${styles.pill}`} style={{
                            background: "rgba(0,180,216,0.15)", color: "#00b4d8", fontSize: 12,
                          }}>
                            {item.count} {t("tenantUsage.callsLabel", { defaultValue: "calls" })}
                            {item.error_count && item.error_count > 0 && (
                              <span className={ta.usage_69}>
                                {t("tenantUsage.errorsLabel", { defaultValue: "errors" })}: {item.error_count}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ShellPanel>

                <ShellPanel title={t("tenantUsage.analytics.timelineTitle", { defaultValue: "Timeline" })}>
                  {analyticsGroupBy === "hour" && analyticsData?.data.length > 0 ? (
                    <div className={ta.usage_70}>
                      <ResponsiveContainer>
                        <BarChart data={analyticsData.data.map(d => ({ hour: d.key, count: d.count }))} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                          <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                          <Tooltip
                            contentStyle={{
                              background: "rgba(15,23,42,0.95)", border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: 12, fontSize: 12, color: "#f1f5f9",
                            }}
                          />
                          <Bar dataKey="count" fill="#00b4d8" radius={[4, 4, 0, 0]} name={t("tenantUsage.callsLabel")} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className={ta.usage_71}>
{analyticsData?.data.map((item, idx) => (
                        <div key={`${item.key}-${idx}`} className={ta.usage_72}>
                          <span className={ta.usage_73}>{item.key}</span>
                          <div className={ta.usage_74}>
                            <div className={ta.usage_75} style={{ width: `${Math.max(1, (item.count / Math.max(1, ...analyticsData?.data.map(d => d.count) ?? [1])) * 100)}%` }} />
                          </div>
                          <span className={ta.usage_76}>{item.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </ShellPanel>
              </div>
            ) : (
              <ShellEmptyState description={t("tenantUsage.noAnalyticsData", { defaultValue: "No analytics data available" })} />
            )}
          </ShellPanel>
        )}
      </section>
    </ShellPageChrome>
  );
}
