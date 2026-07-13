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
    createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value),
  );
}

export function SocDataInventorySection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { inventory, loading } = state;
  const [queueTiers, setQueueTiers] = useState<QueueTierData[]>([]);
  const [queueTiersExpanded, setQueueTiersExpanded] = useState<string | null>(null);
  const [queueTiersLoading, setQueueTiersLoading] = useState(false);
  const [queueTiersError, setQueueTiersError] = useState<string | null>(null);

  useEffect(() => {
    actions.refreshInventory();
  }, [actions]);

  useEffect(() => {
    if (!queueTiersLoading && queueTiers.length === 0 && !queueTiersError) {
      setQueueTiersLoading(true);
      const adapter = defaultCoreApiAdapter as unknown as {
        getSocDataOpsQueueTiers: () => Promise<{ tiers?: QueueTierData[] }>;
      };
      adapter.getSocDataOpsQueueTiers().then((res) => {
        setQueueTiers(res.tiers || []);
        setQueueTiersError(null);
      }).catch((err) => {
        setQueueTiersError(err instanceof Error ? err.message : "Failed to load queue tiers.");
      }).finally(() => setQueueTiersLoading(false));
    }
  }, [queueTiersLoading, queueTiers.length, queueTiersError]);

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

  return createElement("div", { className: "s5_0_SocDataInventorySection",  },

    createElement("div", { className: styles.metricGrid },
      MetricCard({ label: t("soc.dataops.total_rows"), value: (s.total_rows ?? 0).toLocaleString(), color: "var(--accent-cyan, #06b6d4)" }),
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
                createElement("div", { className: `styles.metricValue s5_1_SocDataInventorySection`,  },
                  dt.total_rows.toLocaleString(),
                ),
                createElement("div", { className: "s5_2_SocDataInventorySection",  },
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
          createElement("div", { className: "s5_3_SocDataInventorySection",  },
            years.map((yr) =>
              createElement("div", { key: yr.year, className: "s5_4_SocDataInventorySection",  },
                createElement("span", { className: "s5_5_SocDataInventorySection",  }, yr.year),
                createElement("div", { className: "s5_6_SocDataInventorySection",  },
                  createElement("div", { className: styles.barFill, style: { width: `${(yr.rows / maxYearRows) * 100}%` } }),
                ),
                createElement("span", { className: "s5_7_SocDataInventorySection",  },
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
          createElement("div", { className: "s5_8_SocDataInventorySection",  },
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
                    createElement("td", { style: { color: g.calendar_days != null && g.calendar_days < 30 ? "#fbbf24" : "var(--text-muted, #94a3b8)", fontWeight: g.calendar_days != null && g.calendar_days < 30 ? 700 : 400 } },
                      g.calendar_days != null ? `${g.calendar_days.toLocaleString()} ngày${g.calendar_days < 30 ? ' \u26A0' : ''}` : "N/A",
                    ),
                    createElement("td", null, g.total_rows.toLocaleString()),
                    createElement("td", { className: "s5_9_SocDataInventorySection",  },
                      g.earliest_date && g.latest_date ? `${g.earliest_date} \u2013 ${g.latest_date}` : "N/A",
                    ),
                  ),
                ),
              ),
            ),
          ),
        )
      : null,

    queueTiersError
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
          createElement("div", { className: styles.inlineError }, queueTiersError),
        )
      : queueTiers.length > 0
        ? createElement("div", { className: styles.sectionCard },
            createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
            createElement("div", null,
              queueTiers.map((tier) =>
                createElement("div", { key: tier.tier, className: styles.accordion },
                  createElement("div", {
                    className: styles.accordionHeader,
                    onClick: () => setQueueTiersExpanded(queueTiersExpanded === tier.tier ? null : tier.tier),
                  },
                    createElement("span", { className: "s5_10_SocDataInventorySection",  }, tier.tier),
                    createElement("span", { className: "s5_11_SocDataInventorySection",  },
                      `${tier.symbol_count} symbols \u2022 ${tier.cadence || "N/A"}`,
                    ),
                  ),
                  queueTiersExpanded === tier.tier
                    ? createElement("div", { className: styles.accordionContent },
                        createElement("div", { className: "s5_12_SocDataInventorySection",  },
                          `Cadence: ${tier.cadence || "N/A"} \u2022 Active: ${tier.symbol_count} symbols`,
                        ),
                        tier.active_symbols?.length > 0
                          ? createElement("div", { className: "s5_13_SocDataInventorySection",  },
                              tier.active_symbols.slice(0, 10).map((sym) =>
                                createElement("span", { key: sym, className: `styles.statusBadge s5_14_SocDataInventorySection`,  }, sym),
                              ),
                              tier.active_symbols.length > 10
                                ? createElement("span", { className: "s5_15_SocDataInventorySection",  }, `+${tier.active_symbols.length - 10} more`)
                                : null,
                            )
                          : createElement("span", { className: "s5_16_SocDataInventorySection",  }, t("soc.dataops.empty_examples")),
                      )
                    : null,
                ),
              ),
            ),
          )
        : null,
  );
}