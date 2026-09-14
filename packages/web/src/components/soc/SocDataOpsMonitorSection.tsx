import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { SocMatrixScrapeMonitor } from "./SocMatrixScrapeMonitor.js";
import { SocParityGatesPanel } from "./SocParityGatesPanel.js";
import { SocRetentionHealthPanel } from "./SocRetentionHealthPanel.js";
import { SocAnomalyGuardPanel } from "./SocAnomalyGuardPanel.js";
import { toneColor } from "./socStatusColors.js";
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
    { },
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
    createElement("span", { }, t("soc.actions.page", { page })),
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
        setError(err instanceof Error ? err.message : t("soc.dataops.error_load_monitor"));
      }
    };
    fetchData();
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
    error ? createElement("div", { className: styles.inlineError }, error) : null,
    renderActiveRunBanner(),

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
            `${t("soc.dataops.observability_updated_at")}: ${new Date(observability.updated_at).toLocaleString()}`
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
                          createElement("td", { }, item.backlog_count.toLocaleString())
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
                    return createElement(
                      "div",
                      {
                        key: item.tier,
                        },
                      createElement(
                        "div",
                        null,
                        createElement("div", { }, t(TIER_LABEL_KEYS[item.tier] || "soc.dataops.unknown_tier")),
                        createElement(
                          "div",
                          { },
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
                            background: isStarved ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                            color: isStarved ? toneColor("danger") : toneColor("success"),
                            fontSize: "0.6rem",
                            fontWeight: 600,
                          },
                        },
                        isStarved ? t("soc.dataops.starved_yes") : t("soc.dataops.starved_no")
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
                        createElement("td", { }, item.symbol_count.toLocaleString()),
                        createElement("td", { }, item.backlog_symbols.toLocaleString())
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
        { },
        createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_title")),
        coverage?.updated_at &&
          createElement(
            "span",
            { },
            `${t("soc.dataops.coverage_updated_at")}: ${new Date(coverage.updated_at).toLocaleString()}`
          )
      ),
      createElement("p", { }, t("soc.dataops.coverage_description")),

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
                      return createElement(
                        "td",
                        { key: stateKey, },
                        count > 0 ? count.toLocaleString() : "—"
                      );
                    }),
                    createElement("td", { }, total.toLocaleString())
                  );
                })
              )
            );
            })()
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
                coverage.top_gaps.slice((gapsPage - 1) * 20, gapsPage * 20).map((gap, i) =>
                  createElement(
                    "tr",
                    { key: i, },
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
                            background: gap.freshness_state === "error" ? "rgba(239, 68, 68, 0.15)" : gap.freshness_state === "missing" ? "rgba(239, 68, 68, 0.1)" : "rgba(245, 158, 11, 0.1)",
                            color: gap.freshness_state === "error" ? "var(--color-danger-500, #ef4444)" : gap.freshness_state === "missing" ? toneColor("danger") : toneColor("warning"),
                            fontSize: "0.6rem",
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
                tier.active_symbols?.length > 0
                  ? createElement(
                      "div",
                      { },
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
