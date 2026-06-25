import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface QueueTier {
  tier: string;
  symbol_count: number;
  cadence: string;
  active_symbols: string[];
  [key: string]: unknown;
}

interface ObservabilityData {
  backlog_by_dataset: Record<string, number>;
  fail_rate_1h: number;
  fail_rate_24h: number;
  starvation_alerts: string[];
  [key: string]: unknown;
}

export function SocDataOpsMonitorSection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { coverage, loading } = state;
  const [queueTiers, setQueueTiers] = useState<QueueTier[]>([]);
  const [observability, setObservability] = useState<ObservabilityData | null>(null);
  const [error, setError] = useState("");

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
  }, []);

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary)" } }, value),
    );
  };

  if (loading.coverage && queueTiers.length === 0) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    error ? createElement("div", { className: styles.inlineError }, error) : null,
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
      queueTiers.length === 0
        ? createElement("p", { className: styles.emptyState }, t("soc.dataops.no_queue_tiers"))
        : createElement(
            "div",
            { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.75rem" } },
            queueTiers.map((tier) =>
              createElement(
                "div",
                {
                  key: tier.tier,
                  style: {
                    padding: "0.75rem",
                    borderRadius: "8px",
                    background: "rgba(15, 23, 42, 0.3)",
                    border: "1px solid var(--border-default)",
                  },
                },
                createElement("div", { style: { fontWeight: 700, fontSize: "0.9rem" } }, tier.tier),
                createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" } },
                  `${tier.symbol_count} symbols \u2022 Cadence: ${tier.cadence || "N/A"}`,
                ),
                tier.active_symbols?.length > 0
                  ? createElement("div", { style: { fontSize: "0.7rem", color: "var(--accent-cyan)", marginTop: "0.25rem" } },
                    `Examples: ${tier.active_symbols.slice(0, 5).join(", ")}`,
                  )
                  : null,
              ),
            ),
          ),
    ),
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.observability_title")),
      observability
        ? createElement(
            "div",
            null,
            createElement("div", { className: styles.metricGrid },
              renderMetricCard(t("soc.dataops.fail_rate_1h"), `${observability.fail_rate_1h ?? 0}%`, observability.fail_rate_1h > 10 ? "#f87171" : "#34d399"),
              renderMetricCard(t("soc.dataops.fail_rate_24h"), `${observability.fail_rate_24h ?? 0}%`, observability.fail_rate_24h > 5 ? "#fbbf24" : "#34d399"),
            ),
            observability.backlog_by_dataset && Object.keys(observability.backlog_by_dataset).length > 0
              ? createElement(
                  "div",
                  { style: { marginTop: "0.75rem" } },
                  createElement("div", { style: { fontWeight: 600, fontSize: "0.8rem", marginBottom: "0.5rem" } }, t("soc.dataops.backlog_by_dataset")),
                  createElement(
                    "div",
                    { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem" } },
                    Object.entries(observability.backlog_by_dataset).map(([dataset, count]) =>
                      createElement(
                        "span",
                        {
                          key: dataset,
                          className: styles.statusBadge,
                          style: {
                            background: `${(count as number) > 100 ? "#f87171" : "var(--accent-cyan)"}20`,
                            color: (count as number) > 100 ? "#f87171" : "var(--accent-cyan)",
                          },
                        },
                        `${dataset}: ${(count as number).toLocaleString()}`,
                      ),
                    ),
                  ),
                )
              : null,
            observability.starvation_alerts?.length > 0
              ? createElement(
                  "div",
                  { className: styles.inlineError, style: { marginTop: "0.75rem" } },
                  createElement("div", { style: { fontWeight: 700, marginBottom: "0.25rem" } }, t("soc.dataops.starvation_alerts")),
                  observability.starvation_alerts.map((alert, i) =>
                    createElement("div", { key: i, style: { fontSize: "0.75rem" } }, `\u2022 ${alert}`),
                  ),
                )
              : null,
          )
        : createElement("p", { className: styles.emptyState }, t("soc.dataops.no_observability")),
    ),
    coverage
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.coverage_title")),
          createElement("pre", { className: styles.jsonBlock, style: { maxHeight: "300px" } }, JSON.stringify(coverage, null, 2)),
        )
      : null,
  );
}
