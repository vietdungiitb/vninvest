import { createElement, useEffect, useState, useMemo, type ReactNode } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface RecentSignal {
  id?: number;
  symbol: string;
  type: "whale" | "dark_pool" | "screener";
  action?: "buy" | "sell" | string;
  volume?: number;
  price?: number;
  detected_at: string;
  metadata?: Record<string, unknown>;
  whale_volume?: number;
  total_volume?: number;
  strength?: string;
  total_value?: number;
  signal_count?: number;
  significance?: string;
  rule_name?: string;
  severity?: string;
}

interface PerformanceMetrics {
  signals_today?: number;
  whale_signals?: number;
  dark_pool_signals?: number;
  screener_alerts?: number;
  detection_rate?: number;
  avg_latency_ms?: number;
  sentiment?: {
    bullish?: number;
    bearish?: number;
    neutral?: number;
  };
}

interface MaterializationService {
  service_key: string;
  status: string;
  last_started_at: string | null;
  last_finished_at: string | null;
  run_log_id: number | null;
}

interface MaterializationExecPlan {
  service_key: string;
  execution_supported: boolean;
  will_run: boolean;
  symbol: string | null;
}

interface MaterializationStatus {
  services: MaterializationService[];
  execution_plan: MaterializationExecPlan[];
  unified_alerts_available?: number;
  session_dates_available?: number;
  latest_detection_job_run_log_id?: number | null;
}

type SubTab = "overview" | "job-console" | "materialization";

const TYPE_ICONS: Record<string, string> = {
  whale: "\uD83D\uDC19",
  dark_pool: "\uD83C\uDF0A",
  screener: "\uD83D\uDD0D",
};

const TYPE_COLORS: Record<string, string> = {
  whale: "#22d3ee",
  dark_pool: "#a78bfa",
  screener: "#fbbf24",
};

function formatTime(iso: string): string {
  if (!iso) return "";
  try {
    const p = iso.split("T");
    if (p.length < 2) return iso.slice(0, 5);
    const time = p[1].slice(0, 5);
    return time;
  } catch {
    return iso.slice(0, 5);
  }
}

function formatVolume(v: number | undefined | null): string {
  if (v == null) return "";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(0) + "K";
  return String(v);
}

function getActionLabel(action: string | undefined): { cls: string; text: string } {
  if (!action) return { cls: styles.signalLabelNeutral, text: "\u2014" };
  const a = action.toLowerCase();
  if (a === "buy" || a === "b" || a === "accumulate") return { cls: styles.signalLabelBuy, text: "BUY" };
  if (a === "sell" || a === "s" || a === "distribute") return { cls: styles.signalLabelSell, text: "SELL" };
  return { cls: styles.signalLabelNeutral, text: action.toUpperCase() };
}

export function SocSignalsPanel() {
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [materialization, setMaterialization] = useState<MaterializationStatus | null>(null);

  const [typeFilter, setTypeFilter] = useState("all");
  const [symbolFilter, setSymbolFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const [jobDomain, setJobDomain] = useState("whale");
  const [jobSymbol, setJobSymbol] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const filterTypes = ["all", "whale", "dark_pool", "screener"];

  const fetchData = async () => {
    setLoading(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocSignalPerformanceMetrics: () => Promise<PerformanceMetrics>;
        getSocWhaleRecent: () => Promise<{ results?: RecentSignal[]; data?: RecentSignal[] }>;
        getSocDarkPoolRecent: () => Promise<{ results?: RecentSignal[]; data?: RecentSignal[] }>;
        getSocScreenerRecent: () => Promise<{ results?: RecentSignal[]; data?: RecentSignal[] }>;
        getSocSignalMaterialization: () => Promise<MaterializationStatus>;
      };

      const [perfMetrics, whaleRes, darkPoolRes, screenerRes, matStatus] = await Promise.all([
        adapter.getSocSignalPerformanceMetrics(),
        adapter.getSocWhaleRecent(),
        adapter.getSocDarkPoolRecent(),
        adapter.getSocScreenerRecent(),
        adapter.getSocSignalMaterialization(),
      ]);

      const whaleList: RecentSignal[] = (whaleRes?.results || whaleRes?.data || []).map((s: { id?: number; symbol: string; action?: string; volume?: number; detected_at: string; metadata?: Record<string, unknown> }) => ({
        ...s,
        type: "whale" as const,
      }));

      const darkPoolList: RecentSignal[] = (darkPoolRes?.results || darkPoolRes?.data || []).map((s: { id?: number; symbol: string; action?: string; volume?: number; detected_at: string; metadata?: Record<string, unknown> }) => ({
        ...s,
        type: "dark_pool" as const,
      }));

      const screenerList: RecentSignal[] = (screenerRes?.results || screenerRes?.data || []).map((s: { id?: number; symbol: string; action?: string; volume?: number; detected_at: string; metadata?: Record<string, unknown> }) => ({
        ...s,
        type: "screener" as const,
      }));

      const merged = [...whaleList, ...darkPoolList, ...screenerList].sort((a, b) => {
        const da = a.detected_at || "";
        const db = b.detected_at || "";
        return db.localeCompare(da);
      });

      setSignals(merged);
      setMetrics(perfMetrics);
      setMaterialization(matStatus);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cannot load signal data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredSignals = useMemo(() => {
    const q = symbolFilter.trim().toUpperCase();
    return signals.filter((s) => {
      if (typeFilter !== "all" && s.type !== typeFilter) return false;
      if (q && !s.symbol.toUpperCase().includes(q)) return false;
      return true;
    });
  }, [signals, typeFilter, symbolFilter]);

  const stats = useMemo(() => {
    const total = metrics?.signals_today ?? signals.length;
    const whaleCount = metrics?.whale_signals ?? signals.filter((s) => s.type === "whale").length;
    const darkPoolCount = metrics?.dark_pool_signals ?? signals.filter((s) => s.type === "dark_pool").length;
    const screenerCount = metrics?.screener_alerts ?? signals.filter((s) => s.type === "screener").length;
    const detectionRate = metrics?.detection_rate ?? null;
    const avgLatency = metrics?.avg_latency_ms ?? null;
    return { total, whaleCount, darkPoolCount, screenerCount, detectionRate, avgLatency };
  }, [signals, metrics]);

  const sentiment = metrics?.sentiment ?? { bullish: 0, bearish: 0, neutral: 0 };
  const totalSentiment = (sentiment.bullish || 0) + (sentiment.bearish || 0) + (sentiment.neutral || 0);
  const bullPct = totalSentiment > 0 ? ((sentiment.bullish || 0) / totalSentiment) * 100 : 0;
  const bearPct = totalSentiment > 0 ? ((sentiment.bearish || 0) / totalSentiment) * 100 : 0;
  const neutPct = totalSentiment > 0 ? ((sentiment.neutral || 0) / totalSentiment) * 100 : 0;

  const handleRunJob = async () => {
    if (!jobSymbol.trim()) return;
    setJobLoading(true);
    setJobStatus(null);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        runSocSignalJob: (domain: string, symbol: string) => Promise<{ status?: string; run_log_id?: string; message?: string }>;
      };
      const result = await adapter.runSocSignalJob(jobDomain, jobSymbol.trim().toUpperCase());
      setJobStatus(result.status || result.message || t("soc.signals_overview.job_queued"));
    } catch (err) {
      setJobStatus(err instanceof Error ? err.message : "Job failed.");
    } finally {
      setJobLoading(false);
    }
  };

  const signalTypeLabel = (type: string): string => {
    if (type === "whale") return "Whale";
    if (type === "dark_pool") return "Dark Pool";
    if (type === "screener") return "Screener";
    return type;
  };

  // ─── Stat card ─────────────────────────────────────────────────────────
  const statCard = (label: string, value: string | number, color: string) =>
    createElement("div", { className: styles.metricCardSm, key: label },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color, fontSize: "1rem" } }, String(value)),
    );

  // ─── Signal row ────────────────────────────────────────────────────────
  const renderSignalRow = (s: RecentSignal) => {
    const isExpanded = expandedId === (s.id ?? 0);
    const action = getActionLabel(s.action);
    const handleClick = () => setExpandedId(isExpanded ? null : (s.id ?? 0));
    const metaJson = s.metadata ? JSON.stringify(s.metadata, null, 2) : null;

    return createElement(
      "div",
      { key: `${s.type}-${s.id ?? s.symbol}-${s.detected_at}` },
      createElement(
        "div",
        {
          className: `${styles.signalRow} ${isExpanded ? styles.signalRowExpanded : ""}`,
          onClick: handleClick,
        },
        createElement("div", {
          className: styles.signalIcon,
          style: { background: `${TYPE_COLORS[s.type]}20`, color: TYPE_COLORS[s.type] },
        }, TYPE_ICONS[s.type] || ""),
        createElement("div", { className: styles.signalSymbol }, s.symbol),
        createElement("div", { className: `${styles.signalLabel} ${action.cls}` }, action.text),
        createElement("div", { className: styles.signalVolume },
          s.volume != null ? formatVolume(s.volume) : "",
        ),
        createElement("div", { className: styles.signalTime },
          formatTime(s.detected_at),
        ),
      ),
      isExpanded && metaJson
        ? createElement("div", { className: styles.signalMeta }, metaJson)
        : null,
    );
  };

  // ─── Radar Empty State ────────────────────────────────────────────────
  const renderRadarEmptyState = () => {
    return createElement("div", { className: styles.radarContainer },
      createElement("div", { className: styles.radarRingOuter },
        createElement("div", { className: styles.radarRingInner },
          createElement("div", { className: styles.radarSweep })
        )
      ),
      createElement("p", { className: styles.radarTextTitle }, t("soc.signals_overview.no_signals")),
      createElement("p", { className: styles.radarTextSub }, t("soc.signals_overview.scanning_hint"))
    );
  };

  // ─── Sentiment tab ─────────────────────────────────────────────────────
  const renderOverviewTab = () => {
    return createElement("div", null,
      createElement("h4", { style: { margin: "0 0 0.5rem", fontSize: "0.8rem", fontWeight: 700 } },
        t("soc.signals_overview.sentiment"),
      ),
      createElement(
        "div",
        { className: styles.sentimentBar },
        totalSentiment === 0
          ? createElement("div", {
              className: styles.sentimentSegment,
              style: { width: "100%", background: "rgba(148, 163, 184, 0.15)", color: "rgba(148, 163, 184, 0.5)" },
            }, t("soc.signals_overview.no_data"))
          : [
              sentiment.bullish != null && sentiment.bullish > 0
                ? createElement("div", {
                    key: "bull",
                    className: styles.sentimentSegment,
                    style: { width: `${bullPct}%`, background: "rgba(52, 211, 153, 0.35)", color: "#34d399" },
                  }, `${sentiment.bullish}`)
                : null,
              sentiment.neutral != null && sentiment.neutral > 0
                ? createElement("div", {
                    key: "neut",
                    className: styles.sentimentSegment,
                    style: { width: `${neutPct}%`, background: "rgba(148, 163, 184, 0.25)", color: "#94a3b8" },
                  }, `${sentiment.neutral}`)
                : null,
              sentiment.bearish != null && sentiment.bearish > 0
                ? createElement("div", {
                    key: "bear",
                    className: styles.sentimentSegment,
                    style: { width: `${bearPct}%`, background: "rgba(239, 68, 68, 0.35)", color: "#f87171" },
                  }, `${sentiment.bearish}`)
                : null,
            ].filter(Boolean)
      ),
      createElement("div", { style: { display: "flex", gap: "1rem", fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", justifyContent: "center", marginBottom: 0 } },
        createElement("span", { style: { color: "#34d399" } },
          `\u25B2 ${t("soc.signals_overview.bullish")}: ${sentiment.bullish ?? 0}`,
        ),
        createElement("span", { style: { color: "#94a3b8" } },
          `\u25C6 ${t("soc.signals_overview.neutral")}: ${sentiment.neutral ?? 0}`,
        ),
        createElement("span", { style: { color: "#f87171" } },
          `\u25BC ${t("soc.signals_overview.bearish")}: ${sentiment.bearish ?? 0}`,
        ),
      )
    );
  };

  // ─── Job console tab ───────────────────────────────────────────────────
  const renderJobConsoleTab = () =>
    createElement("div", null,
      createElement("div", { className: styles.jobInputRow },
        createElement("select", {
          className: styles.jobDomainSelect,
          value: jobDomain,
          onChange: (e: { target: { value: string } }) => setJobDomain(e.target.value),
        },
          createElement("option", { value: "whale" }, "Whale Detection"),
          createElement("option", { value: "dark_pool" }, "Dark Pool"),
          createElement("option", { value: "screener" }, "Screener"),
        ),
        createElement("input", {
          className: styles.searchInput,
          type: "text",
          placeholder: t("soc.signals_overview.symbol_placeholder"),
          value: jobSymbol,
          onChange: (e: { target: { value: string } }) => setJobSymbol(e.target.value.toUpperCase()),
          style: { maxWidth: "100px" },
        }),
        createElement("button", {
          className: styles.runBtn,
          disabled: jobLoading || !jobSymbol.trim(),
          onClick: handleRunJob,
        },
          jobLoading
            ? t("soc.signals_overview.job_running")
            : t("soc.signals_overview.run_job"),
        ),
      ),
      createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", lineHeight: 1.6 } },
        t("soc.signals_overview.job_console_hint"),
      ),
      jobStatus
        ? (jobStatus.includes("fail") || jobStatus.includes("error") || jobStatus.includes("l\u1ed7i")
            ? createElement("div", { className: styles.inlineError, style: { marginTop: "0.5rem" } }, jobStatus)
            : createElement("div", { className: styles.inlineSuccess, style: { marginTop: "0.5rem" } }, jobStatus))
        : null,
    );

  // ─── Materialization tab ───────────────────────────────────────────────
  const renderMaterializationTab = () => {
    if (!materialization) {
      return createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_materialization"));
    }
    const services = materialization.services || [];
    if (services.length === 0) {
      return createElement("p", { className: styles.emptyState }, t("soc.signals_overview.no_materialization"));
    }
    const statusColor = (st: string): string =>
      st === "success" || st === "completed" ? "#34d399"
      : st === "running" ? "#22d3ee"
      : st === "failed" ? "#f87171"
      : "#94a3b8";
    const summaryChildren: ReactNode[] = [];
    if (materialization.unified_alerts_available != null) {
      summaryChildren.push(
        createElement("span", { key: "alerts" },
          `${t("soc.signals_overview.total_alerts")}: ${materialization.unified_alerts_available}`,
        ),
      );
    }
    if (materialization.session_dates_available != null) {
      summaryChildren.push(
        createElement("span", { key: "sessions" },
          `${t("soc.signals_overview.session_dates")}: ${materialization.session_dates_available}`,
        ),
      );
    }
    return createElement("div", null,
      createElement("div", { className: styles.matGrid },
        ...services.map((svc: MaterializationService) =>
          createElement("div", { className: styles.matCard, key: svc.service_key },
            createElement("div", null,
              createElement("div", { className: styles.matCardLabel }, svc.service_key),
              svc.last_finished_at
                ? createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.15rem" } },
                    svc.last_finished_at.split("T")[0],
                  )
                : null,
              svc.run_log_id != null
                ? createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" } },
                    `Log #${svc.run_log_id}`,
                  )
                : null,
            ),
            createElement("div", { className: styles.matCardStatus, style: { color: statusColor(svc.status) } },
              svc.status ? svc.status.toUpperCase() : "—",
            ),
          ),
        ),
      ),
      summaryChildren.length > 0
        ? createElement("div", { style: { display: "flex", gap: "1rem", fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.75rem", justifyContent: "center" } },
            ...summaryChildren,
          )
        : null,
    );
  };

  // ─── Sub-tab content map ──────────────────────────────────────────────
  const subTabContent: Record<SubTab, () => ReturnType<typeof createElement>> = {
    overview: renderOverviewTab,
    "job-console": renderJobConsoleTab,
    materialization: renderMaterializationTab,
  };

  const subTabKeys: { key: SubTab; label: string }[] = [
    { key: "overview", label: t("soc.signals_overview.overview") },
    { key: "job-console", label: t("soc.signals_overview.job_console") },
    { key: "materialization", label: t("soc.signals_overview.materialization") },
  ];

  // ─── Main render ──────────────────────────────────────────────────────
  return createElement(
    "div",
    { className: styles.glassPanel },
    loading
      ? createElement("p", { className: styles.emptyState }, t("soc.pages.status_loading"))
      : error
        ? createElement("div", { className: styles.inlineError }, error)
        : createElement("div", null,
            // ── Stats row ─────────────────────────────────────────────────
            createElement("div", { className: styles.metricGrid },
              statCard(t("soc.signals_overview.total_alerts"), stats.total, "#f1f5f9"),
              statCard(t("soc.signals_overview.whale_count"), stats.whaleCount, "#22d3ee"),
              statCard(t("soc.signals_overview.dark_pool_count"), stats.darkPoolCount, "#a78bfa"),
              statCard(t("soc.signals_overview.screener_count"), stats.screenerCount, "#fbbf24"),
              statCard(t("soc.signals_overview.detection_rate"), stats.detectionRate != null ? `${stats.detectionRate}%` : "\u2014", "#34d399"),
              statCard(t("soc.signals_overview.avg_latency"), stats.avgLatency != null ? `${stats.avgLatency}ms` : "\u2014", "#22d3ee"),
            ),
            createElement("div", { className: styles.signalsTwoCol },
              // ── Left: Live signal feed ──────────────────────────────────
              createElement("div", { className: styles.feedCard },
                createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" } },
                  createElement("h3", { style: { margin: 0, fontSize: "0.85rem", fontWeight: 700 } },
                    t("soc.signals_overview.live_feed"),
                  ),
                  null,
                ),
                createElement("div", { className: styles.signalFeedFilterBar },
                  ...filterTypes.map((ft) =>
                    createElement("button", {
                      key: ft,
                      className: `${styles.filterBtn} ${typeFilter === ft ? styles.filterBtnActive : styles.filterBtnInactive}`,
                      onClick: () => { setTypeFilter(ft); setExpandedId(null); },
                    }, ft === "all" ? t("soc.signals_overview.filter_all") : signalTypeLabel(ft)),
                  ),
                  createElement("div", { className: styles.searchWrapper, style: { marginLeft: "auto" } },
                    createElement("span", { className: styles.searchIcon }, "\uD83D\uDD0D"),
                    createElement("input", {
                      className: styles.searchInputWithIcon,
                      type: "text",
                      placeholder: t("soc.signals_overview.search_symbol"),
                      value: symbolFilter,
                      onChange: (e: { target: { value: string } }) => {
                        setSymbolFilter(e.target.value);
                        setExpandedId(null);
                      },
                    }),
                  ),
                ),
                filteredSignals.length === 0
                  ? renderRadarEmptyState()
                  : createElement("div", { className: styles.signalFeed },
                      ...filteredSignals.slice(0, 50).map(renderSignalRow),
                    ),
              ),
              // ── Right: Sub-tabs ────────────────────────────────────────
              createElement("div", { className: styles.controlCard },
                createElement("div", { className: styles.subTabBar },
                  ...subTabKeys.map((st) =>
                    createElement("button", {
                      key: st.key,
                      className: `${styles.subTabBtn} ${subTab === st.key ? styles.subTabBtnActive : ""}`,
                      onClick: () => setSubTab(st.key),
                    }, st.label),
                  ),
                ),
                createElement("div", { style: { minHeight: "200px" } },
                  subTabContent[subTab](),
                ),
              ),
            ),
          ),
  );
}
