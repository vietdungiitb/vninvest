import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocMatrixScrapeMonitor } from "./SocMatrixScrapeMonitor.js";
import { SocParityGatesPanel } from "./SocParityGatesPanel.js";
import { SocRetentionHealthPanel } from "./SocRetentionHealthPanel.js";
import { SocAnomalyGuardPanel } from "./SocAnomalyGuardPanel.js";
import styles from "./soc.module.css";

interface QueueTier {
  tier: string;
  symbol_count: number;
  cadence: string;
  active_symbols: string[];
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
  hot: "soc.dataops.tier_hot_user_demand",
  warm: "soc.dataops.tier_warm_liquid_market",
  cold: "soc.dataops.tier_cold_full_market",
  recovery: "soc.dataops.tier_recovery_backlog",
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

function renderPagination(page: number, hasMore: boolean, onPrev: () => void, onNext: () => void, t: (key: string, vars?: Record<string, unknown>) => string) {
  return createElement(
    "div",
    { style: { display: "flex", justifyContent: "center", gap: "0.5rem", marginTop: "0.75rem", alignItems: "center" } },
    createElement(
      "button",
      {
        onClick: onPrev,
        disabled: page <= 1,
        className: styles.actionBtn,
        style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted, #94a3b8)", cursor: page <= 1 ? "not-allowed" : "pointer" },
      },
      "\u25C0 " + t("soc.actions.prev")
    ),
    createElement("span", { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.actions.page", { page })),
    createElement(
      "button",
      {
        onClick: onNext,
        disabled: !hasMore,
        className: styles.actionBtn,
        style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted, #94a3b8)", cursor: hasMore ? "pointer" : "not-allowed" },
      },
      t("soc.actions.next") + " \u25B6"
    )
  );
}

export function SocDataOpsMonitorSection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { coverage: rawCoverage, loading } = state;
  const coverage = rawCoverage as CoverageData | null;
  const [queueTiers, setQueueTiers] = useState<QueueTier[]>([]);
  const [observability, setObservability] = useState<ObservabilityData | null>(null);
  const [error, setError] = useState("");
  const [gapsPage, setGapsPage] = useState(1);
  const [matrixExpanded, setMatrixExpanded] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const adapter = defaultCoreApiAdapter as unknown as {
          getSocDataOpsQueueTiers: () => Promise<{ tiers?: QueueTier[] }>;
          getSocDataOpsObservability: () => Promise<ObservabilityData>;
        };
        const [tiers, obs] = await Promise.all([
          adapter.getSocDataOpsQueueTiers(),
          adapter.getSocDataOpsObservability(),
        ]);
        setQueueTiers(tiers.tiers || []);
        setObservability(obs);
        actions.refreshCoverage();
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Cannot load monitor data.");
      }
    };
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard, style: { flex: 1, minWidth: "140px" } },
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
        style: {
          padding: "0.75rem",
          borderRadius: "8px",
          background: "rgba(16, 185, 129, 0.06)",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          marginBottom: "0.5rem",
        },
      },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" } },
        createElement(
          "div",
          null,
          createElement("span", { style: { fontWeight: 700, fontSize: "0.75rem", color: "#34d399" } }, t("soc.dataops.monitor_active_runs_title")),
          createElement(
            "span",
            { style: { fontSize: "0.6rem", color: "var(--text-muted, #94a3b8)", marginLeft: "0.5rem" } },
            t("soc.dataops.monitor_active_runs_desc")
          )
        ),
        createElement(
          "button",
          {
            className: styles.actionBtn,
            onClick: () => actions.abortRun(activeRun.run_id),
            style: { background: "rgba(239, 68, 68, 0.15)", color: "#f87171", fontSize: "0.65rem" },
          },
          t("soc.dataops.abort")
        )
      ),
      createElement(
        "div",
        {
          style: {
            height: "6px",
            borderRadius: "3px",
            background: "rgba(16, 185, 129, 0.15)",
            overflow: "hidden",
          },
        },
        createElement("div", {
          style: {
            height: "100%",
            width: `${Math.min(progress, 100)}%`,
            borderRadius: "3px",
            background: "linear-gradient(90deg, #34d399, #22d3ee)",
            transition: "width 0.5s ease",
          },
        })
      ),
      createElement(
        "div",
        { style: { display: "flex", gap: "0.75rem", fontSize: "0.6rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.3rem" } },
        createElement("span", null, `${activeRun.run_id.slice(0, 8)}...`),
        createElement("span", null, `${activeRun.dataset || ""}`),
        createElement("span", null, `${progress.toFixed(0)}%`)
      )
    );
  };

  if (loading.coverage && queueTiers.length === 0) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  const oneHourData = observability?.fail_rates?.window_1h || {
    fail_rate_pct: 0,
    failed_runs: 0,
    total_runs: 0,
    degraded_rate_pct: 0,
    partial_runs: 0,
  };
  const twentyFourHourData = observability?.fail_rates?.window_24h || {
    fail_rate_pct: 0,
    failed_runs: 0,
    total_runs: 0,
    degraded_rate_pct: 0,
    partial_runs: 0,
  };

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    error ? createElement("div", { className: styles.inlineError }, error) : null,
    renderActiveRunBanner(),

    // Matrix Monitor Section
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" } },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.matrix_snapshot")),
        createElement(
          "button",
          {
            onClick: () => setMatrixExpanded((v) => !v),
            className: styles.actionBtn,
            style: { fontSize: "0.7rem", background: "rgba(100, 116, 139, 0.15)", color: "var(--text-muted, #94a3b8)" },
          },
          matrixExpanded ? t("soc.dataops.matrix_collapse") : t("soc.dataops.matrix_expand")
        )
      ),
      matrixExpanded ? createElement(SocMatrixScrapeMonitor) : null
    ),

    // Observability Section
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement(
        "div",
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" } },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.observability_title")),
        observability?.updated_at &&
          createElement(
            "span",
            { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" } },
            `${t("soc.dataops.observability_updated_at")}: ${new Date(observability.updated_at).toLocaleString()}`
          )
      ),
      createElement("p", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginBottom: "0.75rem" } }, t("soc.dataops.observability_description")),

      observability
        ? createElement(
            "div",
            { style: { display: "flex", flexDirection: "column", gap: "1rem" } },
            // Metric Cards
            createElement(
              "div",
              { className: styles.metricGrid, style: { display: "flex", flexWrap: "wrap", gap: "0.75rem" } },
              renderMetricCard(
                t("soc.dataops.fail_rate_1h"),
                `${(oneHourData.fail_rate_pct || 0).toFixed(2)}%`,
                (oneHourData.fail_rate_pct || 0) > 10 ? "#f87171" : "#34d399"
              ),
              renderMetricCard(
                t("soc.dataops.fail_rate_24h"),
                `${(twentyFourHourData.fail_rate_pct || 0).toFixed(2)}%`,
                (twentyFourHourData.fail_rate_pct || 0) > 5 ? "#fbbf24" : "#34d399"
              )
            ),

            // Backlog Tables
            createElement(
              "div",
              { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" } },
              // Backlog by Dataset Table
              createElement(
                "div",
                { className: styles.glassPanel, style: { padding: "0.75rem", background: "rgba(15, 23, 42, 0.3)" } },
                createElement(
                  "h4",
                  { style: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" } },
                  t("soc.dataops.backlog_by_dataset")
                ),
                createElement(
                  "div",
                  { style: { overflowX: "auto" } },
                  createElement(
                    "table",
                    { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" } },
                    createElement(
                      "thead",
                      null,
                      createElement(
                        "tr",
                        { style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                        createElement("th", { style: { textAlign: "left", padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.dataset")),
                        createElement("th", { style: { textAlign: "right", padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.backlog_count"))
                      )
                    ),
                    createElement(
                      "tbody",
                      null,
                      (observability.backlog?.by_dataset || []).map((item) =>
                        createElement(
                          "tr",
                          { key: item.dataset, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                          createElement("td", { style: { padding: "0.35rem", fontWeight: 600 } }, t(DATASET_LABEL_KEYS[item.dataset] || "soc.dataops.dataset_unknown")),
                          createElement("td", { style: { padding: "0.35rem", textAlign: "right", fontMono: "1" } }, item.backlog_count.toLocaleString())
                        )
                      ),
                      (!observability.backlog?.by_dataset || observability.backlog.by_dataset.length === 0) &&
                        createElement(
                          "tr",
                          null,
                          createElement("td", { colSpan: 2, style: { padding: "1rem", textAlign: "center", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.no_backlog"))
                        )
                    )
                  )
                )
              ),

              // Starvation Indicator Section
              createElement(
                "div",
                { className: styles.glassPanel, style: { padding: "0.75rem", background: "rgba(15, 23, 42, 0.3)" } },
                createElement(
                  "h4",
                  { style: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" } },
                  t("soc.dataops.starvation_indicator")
                ),
                createElement(
                  "div",
                  { style: { display: "flex", flexDirection: "column", gap: "0.4rem" } },
                  (observability.starvation || []).map((item) => {
                    const isStarved = !!item.is_starved;
                    return createElement(
                      "div",
                      {
                        key: item.tier,
                        style: {
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "0.5rem",
                          borderRadius: "6px",
                          background: "rgba(15, 23, 42, 0.2)",
                          border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                        },
                      },
                      createElement(
                        "div",
                        null,
                        createElement("div", { style: { fontWeight: 600, fontSize: "0.75rem" } }, t(TIER_LABEL_KEYS[item.tier] || "soc.dataops.unknown_tier")),
                        createElement(
                          "div",
                          { style: { fontSize: "0.6rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.15rem" } },
                          t("soc.dataops.starvation_last_progress_seconds", {
                            seconds: item.seconds_since_last_progress ?? "-",
                            threshold: item.threshold_seconds,
                          })
                        )
                      ),
                      createElement(
                        "span",
                        {
                          className: styles.statusBadge,
                          style: {
                            background: isStarved ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isStarved ? "#f87171" : "#34d399",
                            fontSize: "0.6rem",
                            fontWeight: 600,
                          },
                        },
                        isStarved ? t("soc.dataops.starved_yes") : t("soc.dataops.starved_no")
                      )
                    );
                  }),
                  (!observability.starvation || observability.starvation.length === 0) &&
                    createElement("p", { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", textAlign: "center" } }, t("soc.dataops.no_starvation_data"))
                )
              )
            ),

            // Backlog by Tier Table
            createElement(
              "div",
              { className: styles.glassPanel, style: { padding: "0.75rem", background: "rgba(15, 23, 42, 0.3)" } },
              createElement(
                "h4",
                { style: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" } },
                t("soc.dataops.backlog_by_tier")
              ),
              createElement(
                "div",
                { style: { overflowX: "auto" } },
                createElement(
                  "table",
                  { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" } },
                  createElement(
                    "thead",
                    null,
                    createElement(
                      "tr",
                      { style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                      createElement("th", { style: { textAlign: "left", padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.queue_tier")),
                      createElement("th", { style: { textAlign: "right", padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.symbol_count")),
                      createElement("th", { style: { textAlign: "right", padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.backlog_symbols"))
                    )
                  ),
                  createElement(
                    "tbody",
                    null,
                    (observability.backlog?.by_tier || []).map((item) =>
                      createElement(
                        "tr",
                        { key: item.tier, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                        createElement("td", { style: { padding: "0.35rem", fontWeight: 600 } }, t(TIER_LABEL_KEYS[item.tier] || "soc.dataops.unknown_tier")),
                        createElement("td", { style: { padding: "0.35rem", textAlign: "right", fontMono: "1" } }, item.symbol_count.toLocaleString()),
                        createElement("td", { style: { padding: "0.35rem", textAlign: "right", fontMono: "1" } }, item.backlog_symbols.toLocaleString())
                      )
                    ),
                    (!observability.backlog?.by_tier || observability.backlog.by_tier.length === 0) &&
                      createElement(
                        "tr",
                        null,
                        createElement("td", { colSpan: 3, style: { padding: "1rem", textAlign: "center", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.no_backlog"))
                      )
                  )
                )
              )
            )
          )
        : createElement("p", { className: styles.emptyState }, t("soc.dataops.no_observability"))
    ),

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
        { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" } },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_title")),
        coverage?.updated_at &&
          createElement(
            "span",
            { style: { fontSize: "0.65rem", color: "var(--text-muted, #94a3b8)" } },
            `${t("soc.dataops.coverage_updated_at")}: ${new Date(coverage.updated_at).toLocaleString()}`
          )
      ),
      createElement("p", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginBottom: "0.75rem" } }, t("soc.dataops.coverage_description")),

      Array.isArray(coverage?.datasets) && coverage.datasets.length > 0
        ? createElement(
            "div",
            { style: { overflowX: "auto" } },
            createElement(
              "table",
              { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" } },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", { style: { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.dataops.dataset")),
                  COVERAGE_STATE_ORDER.map((stateKey) =>
                    createElement(
                      "th",
                      { key: stateKey, style: { textAlign: "center", padding: "0.5rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } },
                      t(FRESHNESS_LABEL_KEYS[stateKey] || "soc.dataops.freshness_unknown")
                    )
                  ),
                  createElement("th", { style: { textAlign: "right", padding: "0.5rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, "Total")
                )
              ),
              createElement(
                "tbody",
                null,
                coverage.datasets.map((ds) => {
                  const total = COVERAGE_STATE_ORDER.reduce((sum, stateKey) => sum + ((ds as any)[stateKey] || 0), 0);
                  return createElement(
                    "tr",
                    { key: ds.dataset, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                    createElement("td", { style: { padding: "0.5rem", fontWeight: 600 } }, t(DATASET_LABEL_KEYS[ds.dataset] || "soc.dataops.dataset_unknown")),
                    COVERAGE_STATE_ORDER.map((stateKey) => {
                      const count = (ds as any)[stateKey] || 0;
                      return createElement(
                        "td",
                        { key: stateKey, style: { padding: "0.5rem", textAlign: "center", fontMono: "1" } },
                        count > 0 ? count.toLocaleString() : "—"
                      );
                    }),
                    createElement("td", { style: { padding: "0.5rem", textAlign: "right", fontWeight: 600 } }, total.toLocaleString())
                  );
                })
              )
            )
          )
        : createElement("p", { className: styles.emptyState }, t("soc.dataops.no_coverage_data"))
    ),

    // Top Gaps Section (Paginated List)
    coverage?.top_gaps && coverage.top_gaps.length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_gaps_title")),
          createElement(
            "div",
            { style: { overflowX: "auto" } },
            createElement(
              "table",
              { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.7rem" } },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  null,
                  createElement("th", { style: { textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.dataops.coverage_gap_symbol")),
                  createElement("th", { style: { textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.dataops.dataset")),
                  createElement("th", { style: { textAlign: "center", padding: "0.35rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.dataops.coverage_gap_freshness")),
                  createElement("th", { style: { textAlign: "left", padding: "0.35rem", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", color: "var(--text-muted, #94a3b8)", fontWeight: 600 } }, t("soc.dataops.next_action"))
                )
              ),
              createElement(
                "tbody",
                null,
                coverage.top_gaps.slice((gapsPage - 1) * 20, gapsPage * 20).map((gap, i) =>
                  createElement(
                    "tr",
                    { key: i, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                    createElement("td", { style: { padding: "0.35rem", fontWeight: 600 } }, gap.symbol),
                    createElement("td", { style: { padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } }, t(DATASET_LABEL_KEYS[gap.dataset] || "soc.dataops.dataset_unknown")),
                    createElement(
                      "td",
                      { style: { padding: "0.35rem", textAlign: "center" } },
                      createElement(
                        "span",
                        {
                          className: styles.statusBadge,
                          style: {
                            background: gap.freshness_state === "error" ? "rgba(239, 68, 68, 0.15)" : gap.freshness_state === "missing" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                            color: gap.freshness_state === "error" ? "#ef4444" : gap.freshness_state === "missing" ? "#f87171" : "#fbbf24",
                            fontSize: "0.6rem",
                          },
                        },
                        t(FRESHNESS_LABEL_KEYS[gap.freshness_state] || "soc.dataops.freshness_unknown")
                      )
                    ),
                    createElement(
                      "td",
                      { style: { padding: "0.35rem", color: "var(--text-muted, #94a3b8)" } },
                      gap.next_recommended_action ? t(ACTION_LABEL_KEYS[gap.next_recommended_action] || "soc.dataops.action_unknown") : "—"
                    )
                  )
                )
              )
            )
          ),
          coverage.top_gaps.length > 20
            ? renderPagination(
                gapsPage,
                gapsPage * 20 < coverage.top_gaps.length,
                () => setGapsPage((p) => Math.max(1, p - 1)),
                () => setGapsPage((p) => p + 1),
                t
              )
            : null
        )
      : null,

    // Queue Tiers Section
    queueTiers.length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
          createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginBottom: "0.75rem" } }, t("soc.dataops.queue_tiers_description")),
          createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "0.75rem" } },
            queueTiers.map((tier) =>
              createElement(
                "div",
                {
                  key: tier.tier,
                  style: {
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.3)",
                    border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
                  },
                },
                createElement("div", { style: { fontWeight: 700, fontSize: "0.9rem" } }, t(TIER_LABEL_KEYS[tier.tier] || "soc.dataops.unknown_tier")),
                createElement(
                  "div",
                  { style: { fontSize: "0.75rem", color: "var(--text-muted, #94a3b8)", marginTop: "0.25rem" } },
                  `${tier.symbol_count} ${t("soc.dataops.tier_symbols")} \u2022 Cadence: ${tier.cadence || "N/A"}`
                ),
                tier.active_symbols?.length > 0
                  ? createElement(
                      "div",
                      { style: { fontSize: "0.7rem", color: "var(--accent-cyan, #06b6d4)", marginTop: "0.25rem" } },
                      `${t("soc.dataops.tier_examples")}: ${tier.active_symbols.slice(0, 5).join(", ")}`
                    )
                  : null
              )
            )
          )
        )
      : null
  );
}
