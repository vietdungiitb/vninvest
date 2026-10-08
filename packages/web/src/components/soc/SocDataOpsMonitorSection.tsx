import { formatNumber } from "../../i18n";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "../ui/button.js";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocMatrixScrapeMonitor } from "./SocMatrixScrapeMonitor.js";
import { SocParityGatesPanel } from "./SocParityGatesPanel.js";
import { SocRetentionHealthPanel } from "./SocRetentionHealthPanel.js";
import { SocAnomalyGuardPanel } from "./SocAnomalyGuardPanel.js";
import { useDataOpsStream } from "../../hooks/useDataOpsStream.js";
import { toneColor } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface QueueTier {
  tier: string;
  symbol_count: number;
  cadence: string;
  active_symbols: string[];
  examples: string[];
  [key: string]: unknown;
}

interface ObservabilityData {
  backlog?: {
    by_dataset?: Array<{ dataset: string; backlog_count: number }>;
    by_tier?: Array<{
      tier: string;
      symbol_count: number;
      backlog_symbols: number;
      datasets: Array<{ dataset: string; backlog_count: number }>;
    }>;
  };
  fail_rates?: {
    window_1h?: {
      fail_rate_pct: number;
      failed_runs: number;
      total_runs: number;
      degraded_rate_pct: number;
      partial_runs: number;
    };
    window_24h?: {
      fail_rate_pct: number;
      failed_runs: number;
      total_runs: number;
      degraded_rate_pct: number;
      partial_runs: number;
    };
  };
  parity_gates?: any;
  // Slice G (QueueRecovery): độ sâu broker queue từ observability endpoint.
  queue_depths?: Record<string, number>;
  parity_history?: any;
  retention_health?: any;
  starvation?: Array<{
    tier: string;
    is_starved: boolean;
    poll_interval_seconds: number;
    threshold_seconds: number;
    seconds_since_last_progress: number | null;
    latest_progress_started_at: string | null;
  }>;
  anomaly_guard?: any;
  updated_at?: string;
  [key: string]: unknown;
}

interface CoverageData {
  datasets?: Array<{
    dataset: string;
    fresh: number;
    warm: number;
    stale: number;
    missing: number;
    error: number;
    unknown: number;
  }>;
  top_gaps?: Array<{
    symbol: string;
    dataset: string;
    freshness_state: string;
    next_recommended_action: string | null;
  }>;
  updated_at?: string;
  [key: string]: unknown;
}

const DATASET_LABEL_KEYS: Record<string, string> = {
  daily_prices: "soc.dataops.dataset_daily_prices",
  price_board_snapshot: "soc.dataops.dataset_price_board_snapshot",
  intraday_bars: "soc.dataops.dataset_intraday_bars",
  intraday_ticks: "soc.dataops.dataset_intraday_ticks",
  session_facts: "soc.dataops.dataset_session_facts",
  whale_events: "soc.dataops.dataset_whale_events",
  order_flow: "soc.dataops.dataset_order_flow",
  dark_flow: "soc.dataops.dataset_dark_flow",
};

const FRESHNESS_LABEL_KEYS: Record<string, string> = {
  fresh: "soc.dataops.freshness_fresh",
  warm: "soc.dataops.freshness_warm",
  stale: "soc.dataops.freshness_stale",
  missing: "soc.dataops.freshness_missing",
  error: "soc.dataops.freshness_error",
  unknown: "soc.dataops.freshness_unknown",
};

const TIER_LABEL_KEYS: Record<string, string> = {
  hot_user_demand: "soc.dataops.tier_hot_user_demand",
  warm_liquid_market: "soc.dataops.tier_warm_liquid_market",
  cold_full_market: "soc.dataops.tier_cold_full_market",
  recovery_backlog: "soc.dataops.tier_recovery_backlog",
};

const ACTION_LABEL_KEYS: Record<string, string> = {
  hydrate_daily_prices: "soc.dataops.action_hydrate_daily_prices",
  refresh_daily_prices: "soc.dataops.action_refresh_daily_prices",
  investigate_daily_prices: "soc.dataops.action_investigate_daily_prices",
  hydrate_price_board_snapshot: "soc.dataops.action_hydrate_price_board_snapshot",
  refresh_price_board_snapshot: "soc.dataops.action_refresh_price_board_snapshot",
  investigate_price_board_snapshot: "soc.dataops.action_investigate_price_board_snapshot",
  hydrate_intraday_bars: "soc.dataops.action_hydrate_intraday_bars",
  refresh_intraday_bars: "soc.dataops.action_refresh_intraday_bars",
  investigate_intraday_bars: "soc.dataops.action_investigate_intraday_bars",
  hydrate_intraday_ticks: "soc.dataops.action_hydrate_intraday_ticks",
  refresh_intraday_ticks: "soc.dataops.action_refresh_intraday_ticks",
  investigate_intraday_ticks: "soc.dataops.action_investigate_intraday_ticks",
  materialize_session_facts: "soc.dataops.action_materialize_session_facts",
  refresh_session_facts: "soc.dataops.action_refresh_session_facts",
  investigate_session_facts: "soc.dataops.action_investigate_session_facts",
};

const COVERAGE_STATE_ORDER = ["fresh", "warm", "stale", "missing", "error", "unknown"];

// Slice G (QueueRecovery): ngưỡng đỏ khớp queue-drain-monitor (docker-compose threshold 200).
const QUEUE_DEPTH_ALERT_THRESHOLD = 200;
const QUEUE_DEPTH_WARN_THRESHOLD = 50;

function queueDepthTone(depth: number): string {
  if (depth >= QUEUE_DEPTH_ALERT_THRESHOLD) return toneColor("danger");
  if (depth >= QUEUE_DEPTH_WARN_THRESHOLD) return toneColor("warning");
  return toneColor("success");
}

function renderPagination(page: number, hasMore: boolean, onPrev: () => void, onNext: () => void, t: (key: string, vars?: Record<string, unknown>) => string) {
  return createElement(
    "div",
    { },
    createElement(
      "button",
      {
        onClick: onPrev,
        disabled: page <= 1,
        className: styles.actionBtn,
        style: { fontSize: "var(--fs-xs)", background: "rgba(var(--soc-rgb-64748b) / 0.15)", color: "var(--text-muted, #94a3b8)", cursor: page <= 1 ? "not-allowed" : "pointer" },
      },
      "\u25C0 " + t("soc.actions.prev")
    ),
    createElement("span", { }, t("soc.actions.page", { page })),
    createElement(
      "button",
      {
        onClick: onNext,
        disabled: !hasMore,
        className: styles.actionBtn,
        style: { fontSize: "var(--fs-xs)", background: "rgba(var(--soc-rgb-64748b) / 0.15)", color: "var(--text-muted, #94a3b8)", cursor: hasMore ? "pointer" : "not-allowed" },
      },
      t("soc.actions.next") + " \u25B6"
    )
  );
}

export function SocDataOpsMonitorSection() {
  const { t, localeTag, formatDateTime } = useI18n();
  const { state, actions } = useDataOps();
  const { coverage: rawCoverage, loading, errors } = state as unknown as { coverage: CoverageData | null; loading: Record<string, boolean>; errors: Record<string, string | null> };
  const [streamCoverage, setStreamCoverage] = useState<CoverageData | null>(null);
  const coverage = (streamCoverage || rawCoverage) as CoverageData | null;
  const coverageContextError = (errors as Record<string, string | null>)?.coverage || null;
  const [queueTiers, setQueueTiers] = useState<QueueTier[]>([]);
  const [observability, setObservability] = useState<ObservabilityData | null>(null);
  const [queueTiersError, setQueueTiersError] = useState("");
  const [observabilityError, setObservabilityError] = useState("");
  const [gapsPage, setGapsPage] = useState(1);
  const [gapsDatasetFilter, setGapsDatasetFilter] = useState("all");
  const [gapsFreshnessFilter, setGapsFreshnessFilter] = useState("all");
  const [matrixExpanded, setMatrixExpanded] = useState(true);
  const [exportingAudits, setExportingAudits] = useState(false);
  const [exportingRuns, setExportingRuns] = useState(false);
  const [streamStatusLabel, setStreamStatusLabel] = useState("");
  const [isDocVisible, setIsDocVisible] = useState(typeof document !== "undefined" ? !document.hidden : true);
  const streamOpenRef = useRef(false);

  const triggerCsvDownload = (rows: Array<Record<string, unknown>>, columns: Array<{ key: string; label: string }>, filename: string) => {
    const headers = columns.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(",");
    const lines = rows.map((row) =>
      columns
        .map((c) => {
          const value = row[c.key];
          if (value === null || value === undefined) return "";
          const stringValue = typeof value === "object" ? JSON.stringify(value) : String(value);
          return `"${stringValue.replace(/"/g, '""')}"`;
        })
        .join(","),
    );
    const csv = "\uFEFF" + [headers, ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportAudits = async () => {
    setExportingAudits(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        exportSocConfigAudits: (params?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
      };
      const rows = await adapter.exportSocConfigAudits({ service_key: "backfill_daily_prices", limit: 5000 });
      const dateStr = new Date().toISOString().split("T")[0];
      triggerCsvDownload(rows, [
        { key: "service_key", label: t("soc.export.col_service") },
        { key: "action", label: t("soc.export.col_action") },
        { key: "actor", label: t("soc.export.col_actor") },
        { key: "actor_ip", label: t("soc.export.col_actor_ip") },
        { key: "change_summary", label: t("soc.export.col_summary") },
        { key: "timestamp", label: t("soc.export.col_timestamp") },
        { key: "request_id", label: t("soc.export.col_request_id") },
      ], `soc-config-audits-${dateStr}.csv`);
      setObservabilityError("");
    } catch (err) {
      setObservabilityError(err instanceof Error ? err.message : t("soc.export.error_failed"));
    } finally {
      setExportingAudits(false);
    }
  };

  const handleExportRunLogs = async () => {
    setExportingRuns(true);
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        exportSocRunLogs: (params?: Record<string, unknown>) => Promise<Array<Record<string, unknown>>>;
      };
      const rows = await adapter.exportSocRunLogs({ service_key: "backfill_daily_prices", limit: 5000 });
      const dateStr = new Date().toISOString().split("T")[0];
      triggerCsvDownload(rows, [
        { key: "service_key", label: t("soc.export.col_service") },
        { key: "status", label: t("soc.export.col_status") },
        { key: "started_at", label: t("soc.export.col_started_at") },
        { key: "finished_at", label: t("soc.export.col_finished_at") },
        { key: "duration_seconds", label: t("soc.export.col_duration") },
        { key: "input_summary", label: t("soc.export.col_input") },
        { key: "output_summary", label: t("soc.export.col_output") },
        { key: "error_detail", label: t("soc.export.col_error") },
      ], `soc-run-logs-${dateStr}.csv`);
    } catch (err) {
      setObservabilityError(err instanceof Error ? err.message : t("soc.export.error_failed"));
    } finally {
      setExportingRuns(false);
    }
  };

  const fetchQueueTiers = async (isSilent = false) => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsQueueTiers: () => Promise<{ tiers?: QueueTier[] }>;
      };
      const tiers = await adapter.getSocDataOpsQueueTiers();
      setQueueTiers(tiers.tiers || []);
      setQueueTiersError("");
    } catch (err) {
      if (!isSilent) setQueueTiersError(err instanceof Error ? err.message : t("soc.dataops.error_load_queue_tiers"));
    }
  };

  const fetchObservability = async (isSilent = false) => {
    try {
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsObservability: () => Promise<ObservabilityData>;
      };
      const obs = await adapter.getSocDataOpsObservability();
      setObservability(obs);
      setObservabilityError("");
    } catch (err) {
      if (!isSilent) setObservabilityError(err instanceof Error ? err.message : t("soc.dataops.error_load_monitor"));
    }
  };

  const retryQueueTiers = () => fetchQueueTiers(false);
  const retryObservability = () => {
    fetchObservability(false);
    actions.refreshCoverage();
  };

  const handleStreamSnapshot = useCallback((snap: import("../../hooks/useDataOpsStream.js").DataOpsStreamSnapshot) => {
    if ((snap as unknown as { observability: ObservabilityData }).observability) {
      setObservability((snap as unknown as { observability: ObservabilityData }).observability);
      setObservabilityError("");
    }
    if ((snap as unknown as { coverage: CoverageData }).coverage) {
      setStreamCoverage((snap as unknown as { coverage: CoverageData }).coverage);
    }
    if ((snap as unknown as { queue_tiers: { tiers: QueueTier[] } }).queue_tiers?.tiers) {
      setQueueTiers((snap as unknown as { queue_tiers: { tiers: QueueTier[] } }).queue_tiers.tiers);
      setQueueTiersError("");
    }
  }, []);

  const streamEnabled = isDocVisible;
  useDataOpsStream({
    enabled: streamEnabled,
    onSnapshot: handleStreamSnapshot as unknown as (snap: import("../../hooks/useDataOpsStream.js").DataOpsStreamSnapshot) => void,
    onStatusChange: useCallback((s: string) => {
      streamOpenRef.current = s === "open";
      if (s === "open") setStreamStatusLabel("Live");
      else if (s === "connecting") setStreamStatusLabel("Connecting");
      else if (s === "error") setStreamStatusLabel("Reconnecting");
      else setStreamStatusLabel("Polling");
    }, []),
  });

  useEffect(() => {
    const onVis = () => setIsDocVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const fetchData = async (isSilent = false) => {
      if (streamOpenRef.current) return;
      await Promise.allSettled([fetchQueueTiers(isSilent), fetchObservability(isSilent)]);
      if (!isSilent) actions.refreshCoverage();
    };
    fetchData(false);
    const jitter = Math.random() * 3000;
    interval = setInterval(() => {
      if (document.hidden || streamOpenRef.current) return;
      fetchData(true);
    }, 30000 + jitter);
    const onVisibility = () => {
      if (!document.hidden && !streamOpenRef.current) fetchData(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard,  },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value)
    );
  };

  const activeRun = state.runs.find((r) => r.status === "running" || r.status === "queued");

  const renderActiveRunBanner = () => {
    if (!activeRun) return null;
    const progress = typeof activeRun.progress === "number" ? activeRun.progress : 0;
    return createElement(
      "div",
      {
        },
      createElement(
        "div",
        { },
        createElement(
          "div",
          null,
          createElement("span", { }, t("soc.dataops.monitor_active_runs_title")),
          createElement(
            "span",
            { },
            t("soc.dataops.monitor_active_runs_desc")
          )
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: () => actions.abortRun(activeRun.run_id),
            
          },
          t("soc.dataops.abort")
        )
      ),
      createElement(
        "div",
        {
          },
        createElement("div", {
          style: {
            height: "100%",
            width: `${Math.min(progress, 100)}%`,
            borderRadius: "3px",
            background: "linear-gradient(90deg, " + toneColor("success") + ", var(--accent-cyan, #06b6d4))",
            transition: "width 0.5s ease",
          },
        })
      ),
      createElement(
        "div",
        { },
        createElement("span", null, `${activeRun.run_id.slice(0, 8)}...`),
        createElement("span", null, `${activeRun.dataset || ""}`),
        createElement("span", null, `${progress.toFixed(0)}%`)
      )
    );
  };

  if (loading.coverage && queueTiers.length === 0) {
    return createElement("div", { className: styles.inventorySkeletonGrid, "aria-busy": "true" },
      Array.from({ length: 4 }).map((_, i) =>
        createElement("div", { key: i, className: styles.inventorySkeletonCard }),
      ),
    );
  }

  const oneHourWindow = observability?.fail_rates?.window_1h;
  const twentyFourHourWindow = observability?.fail_rates?.window_24h;
  const oneHourData = oneHourWindow || {
    fail_rate_pct: 0,
    failed_runs: 0,
    total_runs: 0,
    degraded_rate_pct: 0,
    partial_runs: 0,
  };
  const twentyFourHourData = twentyFourHourWindow || {
    fail_rate_pct: 0,
    failed_runs: 0,
    total_runs: 0,
    degraded_rate_pct: 0,
    partial_runs: 0,
  };

  return createElement(
    "div",
    { },
    queueTiersError ? createElement("div", { className: styles.inlineError, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
      createElement("span", null, queueTiersError),
      createElement(Button, { className: styles.actionBtn, variant: "ghost", size: "sm", onClick: retryQueueTiers, style: { fontSize: "var(--fs-xs)" } }, t("soc.overview.retry"))
    ) : null,
    observabilityError ? createElement("div", { className: styles.inlineError, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginTop: queueTiersError ? "0.5rem" : undefined } },
      createElement("span", null, observabilityError),
      createElement(Button, { className: styles.actionBtn, variant: "ghost", size: "sm", onClick: retryObservability, style: { fontSize: "var(--fs-xs)" } }, t("soc.overview.retry"))
    ) : null,
    renderActiveRunBanner(),

    // Stream status indicator (Live/Polling) — realtime <5s vs poll 30s
    streamStatusLabel ? createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginBottom: "0.5rem" } },
      createElement("span", { style: { width: "6px", height: "6px", borderRadius: "999px", background: streamStatusLabel === "Live" ? "var(--soc-c-34d399)" : streamStatusLabel === "Connecting" ? "var(--soc-c-fbbf24)" : "var(--soc-c-94a3b8)", display: "inline-block" } }),
      createElement("span", null, streamStatusLabel === "Live" ? `${t("soc.dataops.stream_live") || "Live"} · ${t("soc.dataops.stream_realtime") || "Realtime 5s"}` : streamStatusLabel)
    ) : null,

    // Matrix Monitor Section
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.matrix_snapshot")),
        createElement(
          "button",
          {
            onClick: () => setMatrixExpanded((v) => !v),
            className: styles.actionBtn,
            
          },
          matrixExpanded ? t("soc.dataops.matrix_collapse") : t("soc.dataops.matrix_expand")
        )
      ),
      matrixExpanded ? createElement(SocMatrixScrapeMonitor) : null
    ),

    // Hero 4 — commercial (Backlog | Fail 1h | Fail 24h | Starved)
    observability ? createElement("div", { className: styles.metricGrid, style: { marginBottom: "1rem" } },
      renderMetricCard((t as unknown as (k: string, o?: Record<string, unknown>) => string)("soc.dataops.backlog_total", { defaultValue: "Backlog" }), String((observability.backlog?.by_dataset || []).reduce((s: number, r: { backlog_count: number }) => s + (r.backlog_count || 0), 0)), toneColor("warning")),
      renderMetricCard(t("soc.dataops.fail_rate_1h"), oneHourWindow ? `${(oneHourData.fail_rate_pct || 0).toFixed(1)}%` : "—", oneHourWindow && (oneHourData.fail_rate_pct || 0) > 10 ? toneColor("danger") : toneColor("success")),
      renderMetricCard(t("soc.dataops.fail_rate_24h"), twentyFourHourWindow ? `${(twentyFourHourData.fail_rate_pct || 0).toFixed(1)}%` : "—", twentyFourHourWindow && (twentyFourHourData.fail_rate_pct || 0) > 5 ? toneColor("warning") : toneColor("success")),
      renderMetricCard((t as unknown as (k: string, o?: Record<string, unknown>) => string)("soc.dataops.starved_tiers", { defaultValue: "Starved tiers" }), String((observability.starvation || []).filter((s) => s.is_starved && s.seconds_since_last_progress != null).length), (observability.starvation || []).some((s) => s.is_starved && s.seconds_since_last_progress != null) ? toneColor("danger") : toneColor("success")),
    ) : null,

    // Observability Section
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.observability_title")),
        observability?.updated_at &&
          createElement(
            "span",
            { },
            `${t("soc.dataops.observability_updated_at")}: ${formatDateTime(observability.updated_at)}`
          ),
        createElement(
          "div",
          { style: { display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" as const } },
          createElement(
            "button",
            {
              className: styles.actionBtn,
              disabled: exportingAudits,
              onClick: () => handleExportAudits(),
            },
            exportingAudits ? t("soc.export.exporting") : t("soc.export.export_config_audits")
          ),
          createElement(
            "button",
            {
              className: styles.actionBtn,
              disabled: exportingRuns,
              onClick: () => handleExportRunLogs(),
            },
            exportingRuns ? t("soc.export.exporting") : t("soc.export.export_run_logs")
          )
        )
      ),
      createElement("p", { }, t("soc.dataops.observability_description")),

      observability
        ? createElement(
            "div",
            { },
            // Metric Cards
            createElement(
              "div",
              { className: styles.metricGrid,  },
              renderMetricCard(
                t("soc.dataops.fail_rate_1h"),
                oneHourWindow ? `${(oneHourData.fail_rate_pct || 0).toFixed(2)}%` : "—",
                 oneHourWindow && (oneHourData.fail_rate_pct || 0) > 10 ? toneColor("danger") : toneColor("success")
              ),
              renderMetricCard(
                t("soc.dataops.fail_rate_24h"),
                twentyFourHourWindow ? `${(twentyFourHourData.fail_rate_pct || 0).toFixed(2)}%` : "—",
                 twentyFourHourWindow && (twentyFourHourData.fail_rate_pct || 0) > 5 ? toneColor("warning") : toneColor("success")
              )
            ),

            // Backlog Tables
            createElement(
              "div",
              { },
              // Backlog by Dataset Table
              createElement(
                "div",
                { className: styles.glassPanel,  },
                createElement(
                  "h4",
                  { },
                  t("soc.dataops.backlog_by_dataset")
                ),
                createElement(
                  "div",
                  { },
                  createElement(
                    "table",
                    { className: styles.coverageTable },
                    createElement(
                      "thead",
                      null,
                      createElement(
                        "tr",
                        { },
                        createElement("th", { }, t("soc.dataops.dataset")),
                        createElement("th", { }, t("soc.dataops.backlog_count"))
                      )
                    ),
                    createElement(
                      "tbody",
                      null,
                      (observability.backlog?.by_dataset || []).map((item) =>
                        createElement(
                          "tr",
                          { key: item.dataset, },
                          createElement("td", { }, t(DATASET_LABEL_KEYS[item.dataset] || "soc.dataops.dataset_unknown")),
                          createElement("td", { }, formatNumber(item.backlog_count, localeTag))
                        )
                      ),
                      (!observability.backlog?.by_dataset || observability.backlog.by_dataset.length === 0) &&
                        createElement(
                          "tr",
                          null,
                          createElement("td", { colSpan: 2, }, t("soc.dataops.no_backlog"))
                        )
                    )
                  )
                )
              ),

              // Starvation Indicator Section
              createElement(
                "div",
                { className: styles.glassPanel,  },
                createElement(
                  "h4",
                  { },
                  t("soc.dataops.starvation_indicator")
                ),
                createElement(
                  "div",
                  { },
                  (observability.starvation || []).map((item) => {
                    const isStarved = !!item.is_starved;
                    const neverRun = item.seconds_since_last_progress == null;
                    const pct = item.seconds_since_last_progress != null ? Math.min((item.seconds_since_last_progress / Math.max(item.threshold_seconds,1))*100, 100) : 0;
                    const badgeLabel = neverRun
                      ? t("soc.dataops.starved_never_run")
                      : isStarved ? t("soc.dataops.starved_yes") : t("soc.dataops.starved_no");
                    const badgeColor = neverRun
                      ? "var(--text-muted)"
                      : isStarved ? toneColor("danger") : toneColor("success");
                    const badgeBg = neverRun
    ? "rgba(var(--soc-rgb-94a3b8) / 0.15)"
    : isStarved ? "rgba(var(--soc-rgb-ef4444) / 0.15)" : "rgba(var(--soc-rgb-10b981) / 0.15)";
                    return createElement(
                      "div",
                      {
                        key: item.tier,
                        style: { display: "flex", flexDirection: "column", gap: "0.35rem", padding: "0.6rem", border: "1px solid var(--border-default, rgba(80,120,168,0.12))", borderRadius: "8px", background: "rgba(var(--soc-rgb-0f172a) / 0.2)" },
                        },
                      createElement(
                        "div",
                        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
                        createElement(
                          "div",
                          null,
                          createElement("div", { style: { fontWeight: 600, fontSize: "var(--fs-sm)" } }, t(TIER_LABEL_KEYS[item.tier] || "soc.dataops.unknown_tier")),
                          createElement(
                            "div",
                            { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)" } },
                            t("soc.dataops.starvation_last_progress_seconds", {
                              seconds: item.seconds_since_last_progress != null ? String(item.seconds_since_last_progress) : "-",
                              threshold: item.threshold_seconds,
                            })
                          )
                        ),
                        createElement(
                          "span",
                          {
                            className: styles.statusBadge,
                            style: {
                              background: badgeBg,
                              color: badgeColor,
                              fontSize: "var(--fs-xs)",
                              fontWeight: 600,
                            },
                          },
                          badgeLabel
                        )
                      ),
                      createElement("div", { style: { height: "4px", borderRadius: "999px", background: "rgba(var(--soc-rgb-1e293b) / 0.5)", overflow: "hidden" } },
                        createElement("div", { style: { height: "100%", width: `${pct}%`, background: neverRun ? "var(--soc-c-94a3b8, #94a3b8)" : isStarved ? "var(--soc-c-f87171)" : "var(--soc-c-34d399)", transition: "width 0.3s ease" } })
                      )
                    );
                  }),
                  (!observability.starvation || observability.starvation.length === 0) &&
                    createElement("p", { }, t("soc.dataops.no_starvation_data"))
                )
              )
            ),

            // Backlog by Tier Table
            createElement(
              "div",
              { className: styles.glassPanel,  },
              createElement(
                "h4",
                { },
                t("soc.dataops.backlog_by_tier")
              ),
              createElement(
                "div",
                { },
                createElement(
                  "table",
                  { className: styles.coverageTable },
                  createElement(
                    "thead",
                    null,
                    createElement(
                      "tr",
                      { },
                      createElement("th", { }, t("soc.dataops.queue_tier")),
                      createElement("th", { }, t("soc.dataops.symbol_count")),
                      createElement("th", { }, t("soc.dataops.backlog_symbols"))
                    )
                  ),
                  createElement(
                    "tbody",
                    null,
                    (observability.backlog?.by_tier || []).map((item) =>
                      createElement(
                        "tr",
                        { key: item.tier, },
                        createElement("td", { }, t(TIER_LABEL_KEYS[item.tier] || "soc.dataops.unknown_tier")),
                        createElement("td", { }, formatNumber(item.symbol_count, localeTag)),
                        createElement("td", { }, formatNumber(item.backlog_symbols, localeTag))
                      )
                    ),
                    (!observability.backlog?.by_tier || observability.backlog.by_tier.length === 0) &&
                      createElement(
                        "tr",
                        null,
                        createElement("td", { colSpan: 3, }, t("soc.dataops.no_backlog"))
                      )
                  )
                )
              )
            )
          )
        : observabilityError
          ? createElement("div", { className: styles.inlineError, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" } },
              createElement("span", null, observabilityError),
              createElement(Button, { className: styles.actionBtn, variant: "ghost", size: "sm", onClick: retryObservability, style: { fontSize: "var(--fs-xs)" } }, t("soc.overview.retry"))
            )
          : createElement("p", { className: styles.emptyState }, t("soc.dataops.no_observability"))
    ),

    // Queue Depth Panel — Slice G (QueueRecovery): độ sâu broker queue realtime.
    // Backend: build_market_data_observability_summary().queue_depths (fail-open {} khi Redis ốm).
    (() => {
      const depths = observability?.queue_depths;
      if (!depths || typeof depths !== "object") return null;
      const entries = Object.entries(depths).sort((a, b) => b[1] - a[1]);
      if (entries.length === 0) {
        return createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_depth_title")),
          createElement("p", { className: styles.emptyState }, t("soc.dataops.no_queue_depth_data"))
        );
      }
      const breached = entries.filter(([, d]) => d >= QUEUE_DEPTH_ALERT_THRESHOLD);
      return createElement("div", { className: styles.sectionCard },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_depth_title")),
        createElement("p", null, t("soc.dataops.queue_depth_desc")),
        breached.length > 0
          ? createElement("div", { className: styles.coverageWarningBanner, role: "status" },
              breached.map(([q, d]) =>
                createElement("div", { key: q },
                  `\u26A0 ${t("soc.dataops.queue_depth_alert", {
                    queue: q, depth: formatNumber(d, localeTag), threshold: QUEUE_DEPTH_ALERT_THRESHOLD,
                  })}`
                )
              )
            )
          : null,
        createElement("div", { className: styles.coverageTableWrap },
          createElement("table", { className: styles.coverageTable },
            createElement("thead", null,
              createElement("tr", null,
                createElement("th", null, t("soc.dataops.queue_depth_queue")),
                createElement("th", null, t("soc.dataops.queue_depth_count"))
              )
            ),
            createElement("tbody", null,
              entries.map(([q, d]) =>
                createElement("tr", { key: q },
                  createElement("td", { style: { fontWeight: 600 } }, q),
                  createElement("td", {
                    style: {
                      fontWeight: d >= QUEUE_DEPTH_WARN_THRESHOLD ? 700 : 400,
                      color: queueDepthTone(d),
                    },
                  }, formatNumber(d, localeTag))
                )
              )
            )
          )
        )
      );
    })(),

    // Parity Gates Panel
    observability?.parity_gates
      ? createElement(SocParityGatesPanel, {
          parityGates: observability.parity_gates,
          parityHistory: observability.parity_history,
        })
      : null,

    // Retention Health Panel
    observability?.retention_health
      ? createElement(SocRetentionHealthPanel, {
          retentionHealth: observability.retention_health,
        })
      : null,

    // Anomaly Guard Panel
    observability?.anomaly_guard
      ? createElement(SocAnomalyGuardPanel, {
          anomalyGuard: observability.anomaly_guard,
        })
      : null,

    // Coverage Section (Datasets x Freshness Compact Matrix Table)
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_title")),
        coverage?.updated_at &&
          createElement(
            "span",
            { },
            `${t("soc.dataops.coverage_updated_at")}: ${formatDateTime(coverage.updated_at)}`
          )
      ),
      createElement("p", { }, t("soc.dataops.coverage_description")),
      coverageContextError
        ? createElement("div", { className: styles.inlineError, style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" } },
            createElement("span", null, coverageContextError),
            createElement(Button, { className: styles.actionBtn, variant: "ghost", size: "sm", onClick: () => actions.refreshCoverage(), style: { fontSize: "var(--fs-xs)" } }, t("soc.overview.retry"))
          )
        : null,

      Array.isArray(coverage?.datasets) && coverage.datasets.length > 0
        ? createElement(
            "div",
            { },
            (() => {
              const grandTotal = coverage.datasets.reduce(
                (sum, ds) => sum + COVERAGE_STATE_ORDER.reduce((s, stateKey) => s + ((ds as any)[stateKey] || 0), 0),
                0,
              );
              if (grandTotal === 0) {
                return createElement("p", { className: styles.emptyState }, t("soc.dataops.no_coverage_data"));
              }
              return createElement(
                "table",
                { className: styles.coverageTable },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", { }, t("soc.dataops.dataset")),
                  COVERAGE_STATE_ORDER.map((stateKey) =>
                    createElement(
                      "th",
                      { key: stateKey, },
                      t(FRESHNESS_LABEL_KEYS[stateKey] || "soc.dataops.freshness_unknown")
                    )
                  ),
                  createElement("th", { }, t("soc.dataops.col_total"))
                )
              ),
              createElement(
                "tbody",
                null,
                coverage.datasets.map((ds) => {
                  const total = COVERAGE_STATE_ORDER.reduce((sum, stateKey) => sum + ((ds as any)[stateKey] || 0), 0);
                  return createElement(
                    "tr",
                    { key: ds.dataset, },
                    createElement("td", { }, t(DATASET_LABEL_KEYS[ds.dataset] || "soc.dataops.dataset_unknown")),
                    COVERAGE_STATE_ORDER.map((stateKey) => {
                      const count = (ds as any)[stateKey] || 0;
                      const ratio = total > 0 ? count / total : 0;
                      // Color by freshness semantics + ratio (replaces hard-code count>100/20)
                      const isBadState = stateKey === "missing" || stateKey === "error";
                      const isWarnState = stateKey === "stale" || stateKey === "unknown";
                      let bg: string;
                      let col: string | undefined;
                      if (count === 0) {
                        bg = "transparent";
                        col = undefined;
                      } else if (isBadState) {
                        bg = ratio > 0.3 ? "rgba(var(--soc-rgb-ef4444) / 0.22)" : ratio > 0.05 ? "rgba(var(--soc-rgb-f59e0b) / 0.18)" : "rgba(var(--soc-rgb-ef4444) / 0.08)";
                        col = ratio > 0.2 ? "var(--soc-c-f87171)" : "var(--soc-c-fbbf24)";
                      } else if (isWarnState) {
                        bg = ratio > 0.2 ? "rgba(var(--soc-rgb-f59e0b) / 0.18)" : "rgba(var(--soc-rgb-f59e0b) / 0.06)";
                        col = "var(--soc-c-fbbf24)";
                      } else {
                        // fresh/warm — higher ratio is good (green), but low count muted
                        bg = ratio > 0.5 ? "rgba(var(--soc-rgb-22d3ee) / 0.14)" : ratio > 0.15 ? "rgba(var(--soc-rgb-34d399) / 0.12)" : "rgba(var(--soc-rgb-22d3ee) / 0.06)";
                        col = "var(--soc-c-34d399)";
                      }
                      return createElement(
                        "td",
                        { key: stateKey, title: total > 0 ? `${count} / ${total} (${(ratio * 100).toFixed(1)}%)` : undefined, style: { background: bg, color: count > 0 ? col : undefined, fontWeight: ratio > 0.2 ? 700 : 400, textAlign: "center" as const } },
                        count > 0 ? formatNumber(count, localeTag) : "—"
                      );
                    }),
                    createElement("td", { }, formatNumber(total, localeTag))
                  );
                })
              )
            );
            })()
          )
        : createElement("p", { className: styles.emptyState }, t("soc.dataops.no_coverage_data"))
    ),

    // Top Gaps Section (Paginated List + filters)
    coverage?.top_gaps && coverage.top_gaps.length > 0
      ? (() => {
          const filteredGaps = coverage.top_gaps.filter((g) => {
            const dsMatch = gapsDatasetFilter === "all" || g.dataset === gapsDatasetFilter;
            const freshMatch = gapsFreshnessFilter === "all" || g.freshness_state === gapsFreshnessFilter;
            return dsMatch && freshMatch;
          });
          const hasFilter = gapsDatasetFilter !== "all" || gapsFreshnessFilter !== "all";
          return createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_gaps_title")),
          createElement("div", { style: { display: "flex", gap: "0.5rem", marginBottom: "0.6rem", flexWrap: "wrap" as const, alignItems: "center" } },
            createElement("select", {
              value: gapsDatasetFilter,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { setGapsDatasetFilter((e.target as HTMLSelectElement).value); setGapsPage(1); },
              className: styles.actionBtn,
              style: { fontSize: "var(--fs-xs)", padding: "0.3rem 0.5rem" },
            },
              createElement("option", { value: "all" }, t("soc.dataops.filter_all_datasets") || "All datasets"),
              ...Array.from(new Set(coverage.top_gaps.map((g) => g.dataset))).map((ds) =>
                createElement("option", { key: ds, value: ds }, t(DATASET_LABEL_KEYS[ds] || ds))
              )
            ),
            createElement("select", {
              value: gapsFreshnessFilter,
              onChange: (e: React.ChangeEvent<HTMLSelectElement>) => { setGapsFreshnessFilter((e.target as HTMLSelectElement).value); setGapsPage(1); },
              className: styles.actionBtn,
              style: { fontSize: "var(--fs-xs)", padding: "0.3rem 0.5rem" },
            },
              createElement("option", { value: "all" }, t("soc.dataops.filter_all_freshness") || "All states"),
              ...COVERAGE_STATE_ORDER.filter((s) => s !== "fresh" && s !== "warm").map((s) =>
                createElement("option", { key: s, value: s }, t(FRESHNESS_LABEL_KEYS[s] || s))
              )
            ),
            hasFilter ? createElement(Button, { className: styles.actionBtn, variant: "ghost", size: "sm", onClick: () => { setGapsDatasetFilter("all"); setGapsFreshnessFilter("all"); setGapsPage(1); }, style: { fontSize: "var(--fs-xs)" } }, t("soc.actions.clear_filter") || "Clear") : null,
            createElement("span", { style: { fontSize: "var(--fs-xs)", color: "var(--text-muted)", marginLeft: "auto" } }, `${filteredGaps.length} / ${coverage.top_gaps.length}`)
          ),
          createElement(
            "div",
            { },
            createElement(
              "table",
              { className: styles.coverageTable },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", { }, t("soc.dataops.coverage_gap_symbol")),
                  createElement("th", { }, t("soc.dataops.dataset")),
                  createElement("th", { }, t("soc.dataops.coverage_gap_freshness")),
                  createElement("th", { }, t("soc.dataops.next_action"))
                )
              ),
              createElement(
                "tbody",
                null,
                filteredGaps.length === 0
                  ? createElement("tr", null, createElement("td", { colSpan: 4, style: { textAlign: "center" as const, color: "var(--text-muted)", fontSize: "var(--fs-sm)", padding: "0.8rem" } }, t("soc.dataops.no_coverage_data")))
                  : filteredGaps.slice((gapsPage - 1) * 20, gapsPage * 20).map((gap, i) =>
                  createElement(
                    "tr",
                    { key: `${gap.symbol}-${gap.dataset}-${i}`, },
                    createElement("td", { }, gap.symbol),
                    createElement("td", { }, t(DATASET_LABEL_KEYS[gap.dataset] || "soc.dataops.dataset_unknown")),
                    createElement(
                      "td",
                      { },
                      createElement(
                        "span",
                        {
                          className: styles.statusBadge,
                          style: {
                            background: gap.freshness_state === "error" ? "rgba(var(--soc-rgb-ef4444) / 0.15)" : gap.freshness_state === "missing" ? "rgba(var(--soc-rgb-ef4444) / 0.1)" : "rgba(var(--soc-rgb-f59e0b) / 0.1)",
                            color: gap.freshness_state === "error" ? "var(--color-danger-500, #ef4444)" : gap.freshness_state === "missing" ? toneColor("danger") : toneColor("warning"),
                            fontSize: "var(--fs-xs)",
                          },
                        },
                        t(FRESHNESS_LABEL_KEYS[gap.freshness_state] || "soc.dataops.freshness_unknown")
                      )
                    ),
                    createElement(
                      "td",
                      { },
                      gap.next_recommended_action ? t(ACTION_LABEL_KEYS[gap.next_recommended_action] || "soc.dataops.action_unknown") : "—"
                    )
                  )
                )
              )
            )
          ),
          filteredGaps.length > 20
            ? renderPagination(
                gapsPage,
                gapsPage * 20 < filteredGaps.length,
                () => setGapsPage((p) => Math.max(1, p - 1)),
                () => setGapsPage((p) => p + 1),
                t
              )
            : null
        );
        })()
      : null,

    // Queue Tiers Section
    queueTiers.length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
          createElement("div", { }, t("soc.dataops.queue_tiers_description")),
          createElement(
            "div",
            { },
            queueTiers.map((tier) =>
              createElement(
                "div",
                {
                  key: tier.tier,
                  },
                createElement("div", { }, t(TIER_LABEL_KEYS[tier.tier] || "soc.dataops.unknown_tier")),
                createElement(
                  "div",
                  { },
                  `${tier.symbol_count} ${t("soc.dataops.tier_symbols")} \u2022 Cadence: ${tier.cadence || "N/A"}`
                ),
                ((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).length > 0
                  ? createElement(
                      "div",
                      { },
                      `${t("soc.dataops.tier_examples")}: ${((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).slice(0, 5).join(", ")}`
                    )
                  : null
              )
            )
          )
        )
      : null
  );
}
