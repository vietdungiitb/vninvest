import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";

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
    <div style={{ marginTop: "12px", marginBottom: "12px" }}>
      <div style={{ height: "8px", overflow: "hidden", borderRadius: "999px", background: "rgba(255,255,255,0.06)" }}>
        <div style={{ height: "100%", borderRadius: "999px", width: `${ratio}%`, background: toneColor, transition: "width 0.3s ease" }} />
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"meters" | "history" | "forecast" | "analytics">("meters");
  const [historyData, setHistoryData] = useState<Record<string, DailyPoint[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);
  const [selectedMeter, setSelectedMeter] = useState("api_calls");

  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [alertConfigLoading, setAlertConfigLoading] = useState(false);

  const [analyticsData, setAnalyticsData] = useState<ApiUsageAnalyticsResponse | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsGroupBy, setAnalyticsGroupBy] = useState<"ip" | "endpoint" | "status" | "hour">("endpoint");
  const [analyticsDays, setAnalyticsDays] = useState(7);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  const loadMetersAndQuotas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [metersData, quotasData, tenantData] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/usage/meters/"),
        defaultCoreApiAdapter.coreGet("/partner/usage/quotas/"),
        defaultCoreApiAdapter.coreGet("/partner/tenant/"),
      ]);
      setMeters(metersData.results || []);
      setQuotas(quotasData.results || []);
      setTenantApiUsage({
        api_calls_limit: tenantData.api_calls_limit ?? -1,
        api_calls_used: tenantData.api_calls_used ?? 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadAnalytics = useCallback(async (groupBy?: "ip" | "endpoint" | "status" | "hour", days?: number) => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);
      const data = await defaultCoreApiAdapter.getApiUsageAnalytics(groupBy || analyticsGroupBy, days || analyticsDays);
      setAnalyticsData(data);
    } catch (err: unknown) {
      setAnalyticsError(err instanceof Error ? err.message : t("tenantUsage.loadError"));
    } finally {
      setAnalyticsLoading(false);
    }
  }, [t, analyticsGroupBy, analyticsDays]);

  const loadHistory = useCallback(async (days: number) => {
    try {
      setHistoryLoading(true);
      const data = await defaultCoreApiAdapter.getAllUsageTrends(days);
      setHistoryData(data.meters || {});
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsageHistory.loadError"));
    } finally {
      setHistoryLoading(false);
    }
  }, [t]);

  const loadForecasts = useCallback(async () => {
    try {
      setForecastLoading(true);
      const data = await defaultCoreApiAdapter.getUsageForecast();
      setForecasts(data.forecasts || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsage.loadError"));
    } finally {
      setForecastLoading(false);
    }
  }, [t]);

  const loadAlertConfigs = useCallback(async () => {
    try {
      setAlertConfigLoading(true);
      const data = await defaultCoreApiAdapter.getAlertConfigs();
      setAlertConfigs(data.configs || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsage.loadError"));
    } finally {
      setAlertConfigLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadMetersAndQuotas();
  }, [loadMetersAndQuotas]);

  useEffect(() => {
    if (activeTab === "analytics") {
      loadAnalytics();
    }
  }, [activeTab, loadAnalytics]);

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory(historyDays);
    }
  }, [activeTab, historyDays, loadHistory]);

  useEffect(() => {
    if (activeTab === "forecast") {
      loadForecasts();
    }
  }, [activeTab, loadForecasts]);

  useEffect(() => {
    if (activeTab === "meters") {
      loadAlertConfigs();
    }
  }, [activeTab, loadAlertConfigs]);

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
        <div className="shellPage__panel">
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
        <div style={{ height: 16 }} />
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
        error={error}
      >
        <div className="shellPage__panel">{error}</div>
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
    <button onClick={loadMetersAndQuotas} className="shellPage__button shellPage__button--secondary">
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
    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => setActiveTab(tab.key)}
          style={{
            background: activeTab === tab.key ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: activeTab === tab.key ? "var(--shell-accent)" : "var(--shell-ink)",
            border: activeTab === tab.key ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
            borderRadius: 14, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer",
          }}
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
      <section className="shellPage__stack">
        {tabBar}

        {/* Alert indicator bar */}
        {apiUsagePct > 0 && (
          <div
            style={{
              padding: "8px 12px",
              marginBottom: 16,
              borderRadius: 8,
              background: `${apiAlertColor}20`,
              border: `1px solid ${apiAlertColor}`,
              color: apiAlertColor,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontSize: 14 }}>{apiAlertRisk === "critical" ? "🔴" : "🟡"}</span>
            <span>{apiAlertText}</span>
            <div
              style={{
                flex: 1,
                height: 6,
                background: "rgba(255,255,255,0.1)",
                borderRadius: 3,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.min(apiUsagePct, 100)}%`,
                  height: "100%",
                  background: apiAlertColor,
                  transition: "width 0.3s ease",
                }}
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
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px", fontSize: "13px" }}>
                      <div>
                        <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "11px" }}>{t("tenantUsage.consumedLabel")}</span>
                        <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(apiUsed)}</span>
                      </div>
                      <div>
                        <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "11px" }}>{t("tenantUsage.limitLabel")}</span>
                        <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(apiLimit)}</span>
                      </div>
                    </div>
                  </div>
                );
              })() : (
                <div style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("common.loading")}</div>
              )}
            </ShellPanel>

            <ShellPanel title={t("tenantUsage.meterListTitle")} actions={refreshAction}>
              <div className="shellPage__list">
                {meters.length === 0 ? (
          <ShellEmptyState description={t("tenantUsage.meterEmpty")} />
                ) : (
                  meters.map(meter => {
                    const quota = quotaByMeterCode.get(meter.meter_code);
                    const entitledAmount = quota?.entitled_amount ?? -1;
                    const alertConfig = alertConfigs.find(c => c.meter_code === meter.meter_code);

                    return (
                      <div key={meter.meter_code} className="shellPage__listItem">
                        <div className="shellPage__listItemHeader">
                          <div>
                            <div className="shellPage__itemTitle" style={{ fontSize: "15px" }}>{meter.display_name}</div>
                            <code style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "2px", fontFamily: "monospace" }}>{meter.meter_code}</code>
                          </div>
                          <span
                            className="shellPage__pill"
                            style={{
                              background: meter.risk_state === "critical" ? "rgba(239,68,68,0.2)" : (meter.risk_state === "warning" ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"),
                              color: meter.risk_state === "critical" ? "#ef4444" : (meter.risk_state === "warning" ? "#f59e0b" : "#10b981"),
                            }}
                          >
                            {t(`tenantUsage.risk.${meter.risk_state}`, { defaultValue: meter.risk_state })}
                          </span>
                        </div>
                        <UsageBar consumedAmount={meter.consumed_amount} entitledAmount={entitledAmount} riskState={meter.risk_state} />
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: "10px", marginTop: "12px", fontSize: "13px" }}>
                          <div>
                            <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "11px" }}>{t("tenantUsage.consumedLabel")}</span>
                            <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(meter.consumed_amount)}</span>
                          </div>
                          <div>
                            <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "11px" }}>{t("tenantUsage.remainingLabel")}</span>
                            <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(meter.remaining_amount)}</span>
                          </div>
                          <div>
                            <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "11px" }}>{t("tenantUsage.resetAtLabel")}</span>
                            <span style={{ color: "#cbd5e1" }}>{formatUsageDate(meter.reset_at)}</span>
                          </div>
                        </div>
                        {alertConfig && alertConfig.enabled && (
                          <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8" }}>
                            {t("tenantUsage.alertThresholds")}: {t("tenantUsage.warningLabel")} {alertConfig.warning_pct}%, {t("tenantUsage.criticalLabel")} {alertConfig.critical_pct}%
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              {alertConfigLoading && <div style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("common.loading")}</div>}
            </ShellPanel>

            <ShellPanel title={t("tenantUsage.quotaListTitle")}>
              <div className="shellPage__list">
                {quotas.length === 0 ? (
                  <ShellEmptyState description={t("tenantUsage.quotaEmpty")} />
                ) : (
                  quotas.map(quota => (
                    <div key={quota.meter_code} className="shellPage__listItem">
                      <div className="shellPage__listItemHeader">
                        <div>
                          <span className="shellPage__itemTitle" style={{ fontSize: "14px" }}>{quota.display_name}</span>
                          <span className="shellPage__itemMeta" style={{ display: "block", marginTop: "2px" }}>
                            {t("tenantUsage.limitLabel")}: {formatUsageNumber(quota.entitled_amount)} {quota.unit}
                          </span>
                        </div>
                        <span
                          className="shellPage__pill"
                          style={{
                            background: quota.hard_stop ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                            color: quota.hard_stop ? "#ef4444" : "#10b981",
                          }}
                        >
                          {quota.hard_stop ? t("tenantUsage.hardStop") : t("tenantUsage.overageAllowed")}
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginTop: "10px", fontSize: "12px" }}>
                        <div>
                          <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "10px" }}>{t("tenantUsage.limitLabel")}</span>
                          <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(quota.entitled_amount)}</span>
                        </div>
                        <div>
                          <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "10px" }}>{t("tenantUsage.consumedLabel")}</span>
                          <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(quota.consumed_amount)}</span>
                        </div>
                        <div>
                          <span className="shellPage__itemMeta" style={{ display: "block", fontSize: "10px" }}>{t("tenantUsage.remainingLabel")}</span>
                          <span style={{ color: "#cbd5e1" }}>{formatUsageNumber(quota.remaining_amount)}</span>
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
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {METER_CODES.map(code => (
                  <button
                    key={code}
                    onClick={() => setSelectedMeter(code)}
                    style={{
                      background: selectedMeter === code ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: selectedMeter === code ? "var(--shell-accent)" : "var(--shell-ink)",
                      border: selectedMeter === code ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
                      borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t(`tenantUsage.meter.${code}`, { defaultValue: code })}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => { setHistoryDays(d); loadHistory(d); }}
                    style={{
                      background: historyDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: historyDays === d ? "var(--shell-accent)" : "var(--shell-ink)",
                      border: historyDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
                      borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>{t("common.loading")}</div>
            ) : chartData.length > 0 ? (
              <div style={{ width: "100%", height: 220 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
            {forecastLoading ? (
              <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>{t("common.loading")}</div>
            ) : forecasts.length > 0 ? (
              forecasts.map(f => (
                <ShellPanel key={f.meter_code} title={t(`tenantUsage.meter.${f.meter_code}`, { defaultValue: f.meter_code })}>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("tenantUsage.dailyRateLabel")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{f.daily_rate != null ? formatUsageNumber(f.daily_rate) : "—"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("tenantUsage.daysRemainingLabel")}</span>
                      <span style={{
                        fontSize: 14, fontWeight: 600,
                        color: f.days_remaining != null && f.days_remaining < 7 ? "#ef4444" : f.days_remaining != null && f.days_remaining < 14 ? "#f59e0b" : "#10b981",
                      }}>
                        {f.days_remaining != null ? `${f.days_remaining} ${t("tenantUsage.daysLabel")}` : t("tenantUsage.unlimited")}
                      </span>
                    </div>
                    {f.forecast_exhaust_date && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("tenantUsage.exhaustDateLabel")}</span>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#f59e0b" }}>{f.forecast_exhaust_date}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("tenantUsage.confidenceLabel")}</span>
                      <span className="shellPage__pill" style={{
                        background: f.confidence === "high" ? "rgba(16,185,129,0.2)" : f.confidence === "medium" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                        color: f.confidence === "high" ? "#10b981" : f.confidence === "medium" ? "#f59e0b" : "#ef4444",
                      }}>
                        {t(`tenantUsage.confidence.${f.confidence}`, { defaultValue: f.confidence })}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 12, color: "var(--shell-muted)" }}>{t("tenantUsage.remainingLabel")}</span>
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{formatUsageNumber(f.remaining)}</span>
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
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["ip", "endpoint", "status", "hour"] as const).map(group => (
                  <button
                    key={group}
                    onClick={() => { setAnalyticsGroupBy(group); loadAnalytics(group); }}
                    style={{
                      background: analyticsGroupBy === group ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: analyticsGroupBy === group ? "var(--shell-accent)" : "var(--shell-ink)",
                      border: analyticsGroupBy === group ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
                      borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t(`tenantUsage.analytics.groupBy.${group}`, { defaultValue: group })}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[7, 14, 30, 90].map(d => (
                  <button
                    key={d}
                    onClick={() => { setAnalyticsDays(d); loadAnalytics(analyticsGroupBy, d); }}
                    style={{
                      background: analyticsDays === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
                      color: analyticsDays === d ? "var(--shell-accent)" : "var(--shell-ink)",
                      border: analyticsDays === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--shell-border)",
                      borderRadius: 12, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {d}d
                  </button>
                ))}
              </div>
            </div>

            {analyticsLoading ? (
              <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>{t("common.loading")}</div>
            ) : analyticsError ? (
              <div style={{ padding: 16, color: "#ef4444" }}>{analyticsError}</div>
            ) : analyticsData?.data && analyticsData.data.length > 0 ? (
              <div style={{ display: "grid", gap: 16 }}>
                <ShellPanel title={t("tenantUsage.analytics.topItems", { defaultValue: "Top Items" })}>
                  <div className="shellPage__list">
                    {analyticsData.data.map((item, idx) => (
                      <div key={`${item.key}-${idx}`} className="shellPage__listItem">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <code style={{ color: "#cbd5e1", fontSize: 11, wordBreak: "break-all", maxWidth: "70%" }}>{item.key}</code>
                          <span className="shellPage__pill" style={{
                            background: "rgba(0,180,216,0.15)", color: "#00b4d8", fontSize: 12,
                          }}>
                            {item.count} {t("tenantUsage.callsLabel", { defaultValue: "calls" })}
                            {item.error_count && item.error_count > 0 && (
                              <span style={{ marginLeft: 8, color: "#ef4444" }}>
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
                    <div style={{ width: "100%", height: 220 }}>
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
                    <div style={{ display: "grid", gap: 8, maxHeight: 200, overflow: "auto" }}>
{analyticsData?.data.map((item, idx) => (
                        <div key={`${item.key}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                          <span style={{ width: 60, color: "#94a3b8" }}>{item.key}</span>
                          <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 999, overflow: "hidden" }}>
                            <div style={{ width: `${Math.max(1, (item.count / Math.max(1, ...analyticsData?.data.map(d => d.count) ?? [1])) * 100)}%`, height: "100%", background: "#a855f7", borderRadius: 999 }} />
                          </div>
                          <span style={{ width: 36, textAlign: "right", color: "#cbd5e1" }}>{item.count}</span>
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
