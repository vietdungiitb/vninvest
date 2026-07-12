import styles from "../../components/ShellPageTemplate.module.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShellPageChrome, ShellPanel, renderShellMetric } from "../../components/ShellPageTemplate.js";
import { ShellEmptyState } from "../../components/ShellEmptyState.js";
import { ShellSkeleton } from "../../components/ShellSkeleton.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { usePortfolio } from "../../context/PortfolioContext.js";
interface DailyPoint {
  date: string;
  consumed: number;
}

interface MeterHistory {
  meter_code: string;
  display_name: string;
  daily: DailyPoint[];
}

interface TenantAdminUsageHistoryPageProps {
  env?: Record<string, unknown>;
  fetchImpl?: unknown;
  bootstrapLoader?: unknown;
  autoLoad?: boolean;
  initialSnapshot?: Record<string, unknown> | null;
}

const METER_CODES = [
  { code: "api_calls", labelKey: "tenantUsage.meter.api_calls" },
  { code: "ai_regenerate", labelKey: "tenantUsage.meter.ai_regenerate" },
  { code: "whale_symbols", labelKey: "tenantUsage.meter.whale_symbols" },
  { code: "exports", labelKey: "tenantUsage.meter.exports" },
];

export function TenantAdminUsageHistoryPage({
  env: _env = {},
  fetchImpl: _fetchImpl,
  bootstrapLoader: _bootstrapLoader,
  autoLoad: _autoLoad = true,
  initialSnapshot: _initialSnapshot = null,
}: TenantAdminUsageHistoryPageProps) {
  const { t, formatNumber: fmtNumber } = useI18n();
  const { ability } = usePortfolio();

  const [histories, setHistories] = useState<MeterHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeter, setSelectedMeter] = useState("api_calls");
  const [days, setDays] = useState(30);
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  const canRead = ability?.can?.("read", "TenantUsageView") ?? false;

  const loadHistory = useCallback(async (fetchDays = days) => {
    try {
      setLoading(true);
      setError(null);
      const data = await defaultCoreApiAdapter.getAllUsageTrends(fetchDays);
      const meters = Object.entries(data.meters || {}).map(([meter_code, daily]) => ({
        meter_code,
        display_name: t(`tenantUsage.meter.${meter_code}`, { defaultValue: meter_code }),
        daily: (daily as DailyPoint[]) || [],
      }));
      setHistories(meters);
      setDays(fetchDays);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("tenantUsageHistory.loadError"));
    } finally {
      setLoading(false);
    }
  }, [days, t]);

  const selectedHistory = histories.find((h) => h.meter_code === selectedMeter) || histories[0];
  const chartData = useMemo(
    () =>
      selectedHistory?.daily.map((d) => ({
        date: d.date.slice(5),
        consumed: d.consumed,
      })) || [],
    [selectedHistory]
  );

  const totalConsumed = selectedHistory?.daily.reduce((sum, d) => sum + d.consumed, 0) || 0;
  const avgDaily = chartData.length > 0 ? totalConsumed / chartData.length : 0;
  const peakDay = chartData.reduce(
    (max, d) => (d.consumed > max.consumed ? d : max),
    { date: "", consumed: 0 }
  );

  const metrics = [
    renderShellMetric(t("tenantUsageHistory.metricTotalConsumed"), fmtNumber(totalConsumed)),
    renderShellMetric(t("tenantUsageHistory.metricAvgDaily"), fmtNumber(Math.round(avgDaily))),
    renderShellMetric(
      t("tenantUsageHistory.metricPeakDay"),
      peakDay.date ? `${peakDay.date}: ${fmtNumber(peakDay.consumed)}` : t("common.notAvailable")
    ),
    renderShellMetric(t("tenantUsageHistory.metricDaysTracked"), String(chartData.length)),
  ];

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  if (!canRead) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsageHistory.eyebrow")}
        title={t("tenantUsageHistory.title")}
        description={t("tenantUsageHistory.description")}
        notice={t("common.noPermission")}
      >
        <div className={`${styles.panel}`}>
          <ShellEmptyState description={t("common.noPermission")} />
        </div>
      </ShellPageChrome>
    );
  }

  if (loading && histories.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsageHistory.eyebrow")}
        title={t("tenantUsageHistory.title")}
        description={t("common.loading")}
      >
        <ShellSkeleton variant="metric" count={2} />
        <div style={{ height: 16 }} />
        <ShellSkeleton variant="table-row" count={5} />
      </ShellPageChrome>
    );
  }

  if (error && histories.length === 0) {
    return (
      <ShellPageChrome
        eyebrow={t("tenantUsageHistory.eyebrow")}
        title={t("tenantUsageHistory.title")}
        description={t("tenantUsageHistory.loadError")}
        error={error}
      >
        <div className={`${styles.panel}`}>{error}</div>
      </ShellPageChrome>
    );
  }

  const refreshAction = (
    <button onClick={() => loadHistory(days)} className={`${styles.button} ${styles.buttonSecondary}`}>
      {t("common.refresh")}
    </button>
  );

  const chartTypeButtons = (
    <div className={`${styles.actions}`} style={{ gap: 8 }}>
      {(["area", "bar"] as const).map((type) => (
        <button
          key={type}
          onClick={() => setChartType(type)}
          className={`${styles.button}`}
          style={{
            background: chartType === type ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: chartType === type ? "var(--accent-shell)" : "var(--text-primary)",
            border: chartType === type ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)",
            borderRadius: 14,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {type === "area" ? t("tenantUsageHistory.chartArea") : t("tenantUsageHistory.chartBar")}
        </button>
      ))}
    </div>
  );

  const daysButtons = (
    <div className={`${styles.actions}`} style={{ gap: 8 }}>
      {[7, 14, 30, 90].map((d) => (
        <button
          key={d}
          onClick={() => loadHistory(d)}
          className={`${styles.button}`}
          style={{
            background: days === d ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: days === d ? "var(--accent-shell)" : "var(--text-primary)",
            border: days === d ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)",
            borderRadius: 14,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {d}d
        </button>
      ))}
    </div>
  );

  const meterSelector = (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
      {METER_CODES.map((m) => (
        <button
          key={m.code}
          onClick={() => setSelectedMeter(m.code)}
          style={{
            background: selectedMeter === m.code ? "rgba(0,180,216,0.2)" : "rgba(255,255,255,0.06)",
            color: selectedMeter === m.code ? "var(--accent-shell)" : "var(--text-primary)",
            border: selectedMeter === m.code ? "1px solid rgba(0,180,216,0.3)" : "1px solid var(--border-shell)",
            borderRadius: 12,
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t(m.labelKey, { defaultValue: m.code })}
        </button>
      ))}
    </div>
  );

  return (
    <ShellPageChrome
      eyebrow={t("tenantUsageHistory.eyebrow")}
      title={t("tenantUsageHistory.title")}
      description={t("tenantUsageHistory.description")}
      metrics={metrics}
    >
      <section className={`${styles.stack}`}>
        <ShellPanel title={t("tenantUsageHistory.meterSelectorTitle")} actions={meterSelector}>
          <div className={`${styles.itemMeta}`}>{t("tenantUsageHistory.meterSelectorDesc")}</div>
        </ShellPanel>

        <ShellPanel title={t("tenantUsageHistory.chartTitle")} actions={chartTypeButtons}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>{daysButtons}</div>

          {chartData.length > 0 ? (
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                {chartType === "area" ? (
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                    <defs>
                      <linearGradient id="historyGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#00b4d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#f1f5f9",
                      }}
                    />
                    <Area type="monotone" dataKey="consumed" stroke="#00b4d8" fill="url(#historyGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                ) : (
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -16 }}>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,23,42,0.95)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        fontSize: 12,
                        color: "#f1f5f9",
                      }}
                    />
                    <Bar dataKey="consumed" fill="#00b4d8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          ) : (
            <ShellEmptyState description={t("tenantUsageHistory.noData")} />
          )}
        </ShellPanel>

        <ShellPanel title={t("tenantUsageHistory.detailTitle")} actions={refreshAction}>
          <div className={`${styles.list}`}>
            {histories.length === 0 ? (
              <ShellEmptyState description={t("tenantUsageHistory.noMeters")} />
            ) : (
              histories.map((h) => (
                <div key={h.meter_code} className={`${styles.listItem}`}>
                  <div className={`${styles.listItemHeader}`}>
                    <div>
                      <div className={`${styles.itemTitle}`}>{h.display_name}</div>
                      <code style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "2px", fontFamily: "monospace" }}>
                        {h.meter_code}
                      </code>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div>
                        <span className={`${styles.itemMeta}`} style={{ display: "block", fontSize: "11px" }}>
                          {t("tenantUsageHistory.totalConsumed")}
                        </span>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>{fmtNumber(h.daily.reduce((s, d) => s + d.consumed, 0))}</span>
                      </div>
                      <div>
                        <span className={`${styles.itemMeta}`} style={{ display: "block", fontSize: "11px" }}>
                          {t("tenantUsageHistory.avgDaily")}
                        </span>
                        <span style={{ color: "#cbd5e1", fontWeight: 600 }}>
                          {fmtNumber(Math.round(h.daily.reduce((s, d) => s + d.consumed, 0) / Math.max(h.daily.length, 1)))}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ShellPanel>
      </section>
    </ShellPageChrome>
  );
}
