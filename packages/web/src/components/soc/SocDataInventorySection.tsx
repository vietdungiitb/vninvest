import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import styles from "./soc.module.css";

interface QueueTierData {
  tier: string;
  symbol_count: number;
  cadence: string;
  active_symbols: string[];
  [key: string]: unknown;
}

function MetricCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return createElement("div", { className: styles.metricCard },
    createElement("div", { className: styles.metricLabel }, label),
    createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary)" } }, value),
  );
}

export function SocDataInventorySection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { inventory, loading } = state;
  const [queueTiers, setQueueTiers] = useState<QueueTierData[]>([]);
  const [queueTiersExpanded, setQueueTiersExpanded] = useState<string | null>(null);
  const [queueTiersLoading, setQueueTiersLoading] = useState(false);

  useEffect(() => {
    actions.refreshInventory();
  }, []);

  useEffect(() => {
    if (!queueTiersLoading && queueTiers.length === 0) {
      setQueueTiersLoading(true);
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsQueueTiers: () => Promise<{ tiers?: QueueTierData[] }>;
      };
      adapter.getSocDataOpsQueueTiers().then((res) => {
        setQueueTiers(res.tiers || []);
      }).catch(() => {
        // Silently fail
      }).finally(() => setQueueTiersLoading(false));
    }
  }, []);

  if (loading.inventory) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  if (!inventory) {
    return createElement("div", { className: styles.inlineError }, t("soc.dataops.inventory_error"));
  }

  const s = inventory.summary || {};
  const years = inventory.by_year || [];
  const groups = inventory.by_group || [];
  const dataTypes = inventory.data_types || [];
  const maxYearRows = years.length > 0 ? Math.max(...years.map((y) => y.rows)) : 1;

  const coverageColor = (covered: number, total: number): string => {
    if (total === 0) return "#f87171";
    const ratio = covered / total;
    if (ratio >= 0.9) return "#34d399";
    if (ratio >= 0.5) return "#fbbf24";
    return "#f87171";
  };

  return createElement("div", { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },

    createElement("div", { className: styles.metricGrid },
      MetricCard({ label: t("soc.dataops.total_rows"), value: (s.total_rows ?? 0).toLocaleString(), color: "var(--accent-cyan)" }),
      MetricCard({ label: t("soc.dataops.total_symbols"), value: (s.total_symbols ?? 0).toLocaleString(), color: "#34d399" }),
      MetricCard({ label: t("soc.dataops.earliest_date"), value: s.earliest_date ?? "N/A", color: "#fbbf24" }),
      MetricCard({ label: t("soc.dataops.latest_date"), value: s.latest_date ?? "N/A", color: "#f87171" }),
    ),

    dataTypes.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.data_types")),
          createElement("div", { className: styles.dataTypeGrid },
            dataTypes.map((dt) =>
              createElement("div", {
                key: dt.name,
                className: styles.dataTypeCard,
                style: dt.total_rows > 0
                  ? { borderColor: "rgb(6, 95, 70)", background: "rgba(6, 95, 70, 0.08)" }
                  : {},
                title: `${dt.total_rows.toLocaleString()} rows \u2022 ${dt.symbols} symbols`,
              },
                createElement("div", { className: styles.metricLabel }, dt.label),
                createElement("div", { className: styles.metricValue, style: { fontSize: "0.95rem" } },
                  dt.total_rows.toLocaleString(),
                ),
                createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.15rem" } },
                  `${dt.symbols} symbols${dt.earliest_date ? ` \u2022 ${dt.earliest_date}` : ""}`,
                ),
              ),
            ),
          ),
        )
      : null,

    years.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.year_distribution")),
          createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } },
            years.map((yr) =>
              createElement("div", { key: yr.year, style: { display: "flex", alignItems: "center", gap: "0.5rem" } },
                createElement("span", { style: { minWidth: "3rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)" } }, yr.year),
                createElement("div", { style: { flex: 1, height: "1.25rem", background: "rgba(15, 23, 42, 0.4)", borderRadius: "4px", overflow: "hidden" } },
                  createElement("div", { className: styles.barFill, style: { width: `${(yr.rows / maxYearRows) * 100}%` } }),
                ),
                createElement("span", { style: { minWidth: "5rem", fontSize: "0.75rem", textAlign: "right", fontVariantNumeric: "tabular-nums" } },
                  yr.rows.toLocaleString(),
                ),
              ),
            ),
          ),
        )
      : null,

    groups.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, "Coverage by Group"),
          createElement("div", { style: { overflowX: "auto" } },
            createElement("table", { className: styles.coverageTable },
              createElement("thead", null,
                createElement("tr", null,
                  createElement("th", null, "Group"),
                  createElement("th", null, "Symbols"),
                  createElement("th", null, "Covered"),
                  createElement("th", null, "Ngày lịch"),
                  createElement("th", null, "Total Rows"),
                  createElement("th", null, "Date Range"),
                ),
              ),
              createElement("tbody", null,
                groups.map((g) =>
                  createElement("tr", { key: g.id },
                    createElement("td", { style: { fontWeight: 600, color: g.type === "custom" ? "#5eead4" : "inherit" } },
                      `${g.type === "custom" ? "\u2605 " : ""}${g.name}`,
                    ),
                    createElement("td", null, g.symbol_count.toLocaleString()),
                    createElement("td", { className: styles.coverageCell, style: { color: coverageColor(g.covered_symbols, g.symbol_count) } },
                      `${g.covered_symbols} / ${g.symbol_count}`,
                    ),
                    createElement("td", { style: { color: g.calendar_days != null && g.calendar_days < 30 ? "#fbbf24" : "var(--text-muted)", fontWeight: g.calendar_days != null && g.calendar_days < 30 ? 700 : 400 } },
                      g.calendar_days != null ? `${g.calendar_days.toLocaleString()} ngày${g.calendar_days < 30 ? ' \u26A0' : ''}` : "N/A",
                    ),
                    createElement("td", null, g.total_rows.toLocaleString()),
                    createElement("td", { style: { fontSize: "0.7rem" } },
                      g.earliest_date && g.latest_date ? `${g.earliest_date} \u2013 ${g.latest_date}` : "N/A",
                    ),
                  ),
                ),
              ),
            ),
          ),
        )
      : null,

    queueTiers.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
          createElement("div", null,
            queueTiers.map((tier) =>
              createElement("div", { key: tier.tier, className: styles.accordion },
                createElement("div", {
                  className: styles.accordionHeader,
                  onClick: () => setQueueTiersExpanded(queueTiersExpanded === tier.tier ? null : tier.tier),
                },
                  createElement("span", { style: { fontWeight: 600, fontSize: "0.85rem" } }, tier.tier),
                  createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } },
                    `${tier.symbol_count} symbols \u2022 ${tier.cadence || "N/A"}`,
                  ),
                ),
                queueTiersExpanded === tier.tier
                  ? createElement("div", { className: styles.accordionContent },
                      createElement("div", { style: { fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.5rem" } },
                        `Cadence: ${tier.cadence || "N/A"} \u2022 Active: ${tier.symbol_count} symbols`,
                      ),
                      tier.active_symbols?.length > 0
                        ? createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: "0.35rem" } },
                            tier.active_symbols.slice(0, 10).map((sym) =>
                              createElement("span", { key: sym, className: styles.statusBadge, style: { background: "rgba(0, 180, 216, 0.12)", color: "var(--accent-cyan)", fontSize: "0.65rem" } }, sym),
                            ),
                            tier.active_symbols.length > 10
                              ? createElement("span", { style: { fontSize: "0.65rem", color: "var(--text-muted)" } }, `+${tier.active_symbols.length - 10} more`)
                              : null,
                          )
                        : createElement("span", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, t("soc.dataops.empty_examples")),
                    )
                  : null,
              ),
            ),
          ),
        )
      : null,
  );
}