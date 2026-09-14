import { createElement, useEffect, useState, useMemo, useRef, type ReactNode } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor, statusColor as socStatusColor } from "./socStatusColors.js";
import { LucideIcon } from "../ui/lucide-icon.js";
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
  whale: "Waves",
  dark_pool: "EyeOff",
  screener: "Search",
};

const TYPE_COLORS: Record<string, string> = {
  whale: "var(--accent-cyan, #06b6d4)",
  dark_pool: "#a78bfa",
  screener: toneColor("warning"),
};

const TYPE_BG: Record<string, string> = {
  whale: "rgba(6, 182, 212, 0.2)",
  dark_pool: "rgba(167, 139, 250, 0.2)",
  screener: "rgba(245, 158, 11, 0.2)",
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<SubTab>("overview");

  const [jobDomain, setJobDomain] = useState("whale");
  const [jobSymbol, setJobSymbol] = useState("");
  const [jobLoading, setJobLoading] = useState(false);
  const [jobStatus, setJobStatus] = useState<string | null>(null);

  const filterTypes = ["all", "whale", "dark_pool", "screener"];

  const mountedRef = useRef(true);
  const consecutiveErrorsRef = useRef(0);
  const intervalRef = useRef<number | null>(null);
  const intervalDelayRef = useRef(10000);

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
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
        const da = a.detected_at ? new Date(a.detected_at).getTime() : 0;
        const db = b.detected_at ? new Date(b.detected_at).getTime() : 0;
        return db - da;
      });

      if (!mountedRef.current) return;
      setSignals(merged);
      setMetrics(perfMetrics);
      setMaterialization(matStatus);
      setError("");
      const hadBackoff = consecutiveErrorsRef.current >= 3;
      consecutiveErrorsRef.current = 0;
      if (hadBackoff) restartInterval(10000);
    } catch (err) {
      if (!mountedRef.current) return;
      consecutiveErrorsRef.current += 1;
      // R2: after 3 consecutive poll failures, slow 10s → 60s
      if (consecutiveErrorsRef.current >= 3 && intervalDelayRef.current === 10000) {
        restartInterval(60000);
      }
      // R2: after 3 consecutive poll failures, stop spamming error toast
      if (!isSilent || consecutiveErrorsRef.current >= 3) {
        setError(err instanceof Error ? err.message : "Cannot load signal data.");
      }
    } finally {
      if (!isSilent && mountedRef.current) setLoading(false);
    }
  };

  const restartInterval = (delayMs: number) => {
    if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    intervalDelayRef.current = delayMs;
    intervalRef.current = window.setInterval(() => {
      fetchData(true);
    }, delayMs);
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchData(false);
    restartInterval(10000);
    return () => {
      mountedRef.current = false;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const sym = jobSymbol.trim().toUpperCase();
    if (!sym) return;
    if (!/^[A-Z0-9]{3,4}$/.test(sym)) {
      setJobStatus(t("soc.signals_overview.symbol_invalid", { defaultValue: "Mã không hợp lệ (3-4 ký tự A-Z0-9)" }));
      return;
    }
    setJobLoading(true);
    setJobStatus(null);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        runSocSignalJob: (domain: string, symbol: string) => Promise<{ status?: string; run_log_id?: string; message?: string }>;
      };
      const result = await adapter.runSocSignalJob(jobDomain, sym);
      setJobStatus(result.status || result.message || t("soc.signals_overview.job_queued"));
    } catch (err) {
      setJobStatus(err instanceof Error ? err.message : "Job failed.");
    } finally {
      setJobLoading(false);
    }
  };

  const signalTypeLabel = (type: string): string => {
    if (type === "whale") return t("soc.signals_overview.filter_whale");
    if (type === "dark_pool") return t("soc.signals_overview.filter_dark_pool");
    if (type === "screener") return t("soc.signals_overview.filter_screener");
    return type;
  };

  // ─── Stat card ─────────────────────────────────────────────────────────
  const statCard = (label: string, value: string | number, color: string) =>
    createElement("div", { className: styles.metricCardSm, key: label },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color, fontSize: "1rem" } }, String(value)),
    );

  // ─── Signal row ────────────────────────────────────────────────────────
  const renderSignalRow = (s: RecentSignal, idx: number) => {
    const stableKey = `${s.type}-${s.symbol}`;
    const isExpanded = expandedId === stableKey;
    const action = getActionLabel(s.action);
    const handleClick = () => setExpandedId(isExpanded ? null : stableKey);
    const metaJson = s.metadata ? JSON.stringify(s.metadata, null, 2) : null;

    return createElement(
      "div",
      { key: `${s.type}-${s.id ?? stableKey}-${s.detected_at}-${idx}` },
      createElement(
        "div",
        {
          className: `${styles.signalRow} ${isExpanded ? styles.signalRowExpanded : ""}`,
          onClick: handleClick,
        },
        createElement("div", {
          className: styles.signalIcon,
          style: { background: TYPE_BG[s.type] ?? "transparent", color: TYPE_COLORS[s.type] },
        }, createElement(LucideIcon, { name: TYPE_ICONS[s.type] || "Activity", className: "h-3.5 w-3.5" })),
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
      createElement("h4", { },
        t("soc.signals_overview.sentiment"),
      ),
      createElement(
        "div",
        { className: styles.sentimentBar },
        totalSentiment === 0
          ? createElement("div", {
              className: styles.sentimentSegment,
              style: { width: "100%", background: "rgba(148, 163, 184, 0.15)", color: "var(--color-text-muted, #94a3b8)" },
            }, t("soc.signals_overview.no_data"))
          : [
              sentiment.bullish != null && sentiment.bullish > 0
                ? createElement("div", {
                    key: "bull",
                    className: styles.sentimentSegment,
                    style: { width: `${bullPct.toFixed(1)}%`, background: "rgba(52, 211, 153, 0.35)", color: toneColor("success") },
                  }, `${bullPct.toFixed(1)}%`)
                : null,
              sentiment.neutral != null && sentiment.neutral > 0
                ? createElement("div", {
                    key: "neut",
                    className: styles.sentimentSegment,
                    style: { width: `${neutPct.toFixed(1)}%`, background: "rgba(148, 163, 184, 0.25)", color: "var(--color-text-muted, #94a3b8)" },
                  }, `${neutPct.toFixed(1)}%`)
                : null,
              sentiment.bearish != null && sentiment.bearish > 0
                ? createElement("div", {
                    key: "bear",
                    className: styles.sentimentSegment,
                    style: { width: `${bearPct.toFixed(1)}%`, background: "rgba(239, 68, 68, 0.35)", color: toneColor("danger") },
                  }, `${bearPct.toFixed(1)}%`)
                : null,
            ].filter(Boolean)
      ),
      createElement("div", { },
        createElement("span", { },
          `\u25B2 ${t("soc.signals_overview.bullish")}: ${sentiment.bullish ?? 0}`,
        ),
        createElement("span", { },
          `\u25C6 ${t("soc.signals_overview.neutral")}: ${sentiment.neutral ?? 0}`,
        ),
        createElement("span", { },
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
      createElement("div", { },
        t("soc.signals_overview.job_console_hint"),
      ),
      jobStatus
        ? (jobStatus.includes("fail") || jobStatus.includes("error") || jobStatus.includes("l\u1ed7i")
            ? createElement("div", { className: styles.inlineError,  }, jobStatus)
            : createElement("div", { className: styles.inlineSuccess,  }, jobStatus))
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
    const getStatusColor = (st: string): string => socStatusColor(st);
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
                ? createElement("div", { },
                    svc.last_finished_at.split("T")[0],
                  )
                : null,
              svc.run_log_id != null
                ? createElement("div", { },
                    `Log #${svc.run_log_id}`,
                  )
                : null,
            ),
            createElement("div", { className: styles.matCardStatus, style: { color: getStatusColor(svc.status) } },
              svc.status ? svc.status.toUpperCase() : "—",
            ),
          ),
        ),
      ),
      summaryChildren.length > 0
        ? createElement("div", { },
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
              statCard(t("soc.signals_overview.whale_count"), stats.whaleCount, "var(--accent-cyan, #06b6d4)"),
              statCard(t("soc.signals_overview.dark_pool_count"), stats.darkPoolCount, "#a78bfa"),
              statCard(t("soc.signals_overview.screener_count"), stats.screenerCount, toneColor("warning")),
              statCard(t("soc.signals_overview.detection_rate"), stats.detectionRate != null ? `${stats.detectionRate}%` : "\u2014", toneColor("success")),
              statCard(t("soc.signals_overview.avg_latency"), stats.avgLatency != null ? `${stats.avgLatency}ms` : "\u2014", "var(--accent-cyan, #06b6d4)"),
            ),
            createElement("div", { className: styles.signalsTwoCol },
              // ── Left: Live signal feed ──────────────────────────────────
              createElement("div", { className: styles.feedCard },
                createElement("div", { },
                  createElement("h3", { },
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
                  createElement("div", { className: styles.searchWrapper,  },
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
                      ...filteredSignals.slice(0, 50).map((s, idx) => renderSignalRow(s, idx)),
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
                createElement("div", { },
                  subTabContent[subTab](),
                ),
              ),
            ),
          ),
  );
}
