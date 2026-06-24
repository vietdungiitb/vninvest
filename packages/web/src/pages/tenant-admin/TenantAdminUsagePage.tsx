import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"meters" | "history" | "forecast">("meters");
  const [historyData, setHistoryData] = useState<Record<string, DailyPoint[]>>({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDays, setHistoryDays] = useState(30);
  const [selectedMeter, setSelectedMeter] = useState("api_calls");

  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [forecastLoading, setForecastLoading] = useState(false);

  const [alertConfigs, setAlertConfigs] = useState<AlertConfig[]>([]);
  const [alertConfigLoading, setAlertConfigLoading] = useState(false);

  const loadMetersAndQuotas = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [metersData, quotasData] = await Promise.all([
        defaultCoreApiAdapter.coreGet("/partner/usage/meters/"),
        defaultCoreApiAdapter.coreGet("/partner/usage/quotas/"),
      ]);
      setMeters(metersData.results || []);
      setQuotas(quotasData.results || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsage.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadHistory = useCallback(async (days) => {
    try {
      setHistoryLoading(true);
      const data = await defaultCoreApiAdapter.getAllUsageTrends(days);
      setHistoryData(data.meters || {});
    } catch {
      // silently fail
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadForecasts = useCallback(async () => {
    try {
      setForecastLoading(true);
      const data = await defaultCoreApiAdapter.getUsageForecast();
      setForecasts(data.forecasts || []);
    } catch {
      // silently fail
    } finally {
      setForecastLoading(false);
    }
  }, []);

  const loadAlertConfigs = useCallback(async () => {
    try {
      setAlertConfigLoading(true);
      const data = await defaultCoreApiAdapter.getAlertConfigs();
      setAlertConfigs(data.configs || []);
    } catch {
      // silently fail
    } finally {
      setAlertConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetersAndQuotas();
  }, [loadMetersAndQuotas]);

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

  const canRead = ability?.can?.("read", "TenantUsageView") ?? true;

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
          <div className="shellPage__empty">{t("tenantUsage.meterEmpty")}</div>
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
        <div className="shellPage__panel">{t("common.loading")}</div>
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

  const refreshAction = (
    <button onClick={loadMetersAndQuotas} className="shellPage__button shellPage__button--secondary">
      {t("tenantUsage.refreshAction")}
    </button>
  );

  const tabs = [
    { key: "meters" as const, label: t("tenantUsage.tabMeters") },
    { key: "history" as const, label: t("tenantUsage.tabHistory") },
    { key: "forecast" as const, label: t("tenantUsage.tabForecast") },
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

        {/* Meters Tab */}
        {activeTab === "meters" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 20 }}>
            <ShellPanel title={t("tenantUsage.meterListTitle")} actions={refreshAction}>
              <div className="shellPage__list">
                {meters.length === 0 ? (
                  <div className="shellPage__empty">{t("tenantUsage.meterEmpty")}</div>
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
                            <code style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "2px", fontFamily: "monospace" }}>{meter.meter_code}</code>
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
                          <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
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
                  <div className="shellPage__empty">{t("tenantUsage.quotaEmpty")}</div>
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
          </div>
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
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
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
              <div className="shellPage__empty" style={{ height: 150, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {t("tenantUsage.noHistoryData")}
              </div>
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
              <div className="shellPage__empty" style={{ gridColumn: "1 / -1" }}>{t("tenantUsage.noForecastData")}</div>
            )}
          </div>
        )}
      </section>
    </ShellPageChrome>
  );
}
