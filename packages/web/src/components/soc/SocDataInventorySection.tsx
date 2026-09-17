import { createElement, useEffect, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { toneColor } from "./socStatusColors.js";
import styles from "./soc.module.css";

interface QueueTierData {
  tier: string;
  symbol_count: number;
  cadence: string;
  active_symbols: string[];
  examples: string[];
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
        setQueueTiersError(err instanceof Error ? err.message : t("soc.dataops.error_load_queue_tiers"));
      }).finally(() => setQueueTiersLoading(false));
    }
  }, [queueTiersLoading, queueTiers.length, queueTiersError, t]);

  if (loading.inventory) {
    return createElement("div", { className: styles.inventorySkeletonGrid, "aria-busy": "true" },
      Array.from({ length: 4 }).map((_, i) =>
        createElement("div", { key: i, className: styles.inventorySkeletonCard }),
      ),
    );
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
    if (total === 0) return toneColor("danger");
    const ratio = covered / total;
    if (ratio >= 0.9) return toneColor("success");
    if (ratio >= 0.5) return toneColor("warning");
    return toneColor("danger");
  };

  return createElement("div", { className: styles.inventoryRoot },

    createElement("div", { className: styles.metricGrid },
      MetricCard({ label: t("soc.dataops.total_rows"), value: (s.total_rows ?? 0).toLocaleString(), color: "var(--accent-cyan, #06b6d4)" }),
      MetricCard({ label: t("soc.dataops.total_symbols"), value: (s.total_symbols ?? 0).toLocaleString(), color: toneColor("success") }),
      MetricCard({ label: t("soc.dataops.earliest_date"), value: s.earliest_date ?? t("soc.dataops.fallback_na"), color: toneColor("warning") }),
      MetricCard({ label: t("soc.dataops.latest_date"), value: s.latest_date ?? t("soc.dataops.fallback_na"), color: toneColor("danger") }),
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
                  ? { borderColor: "var(--color-success-500, #34d399)", background: "rgba(16, 185, 129, 0.08)" }
                  : {},
                title: `${dt.total_rows.toLocaleString()} ${t("soc.dataops.label_rows")} \u2022 ${dt.symbols} ${t("soc.dataops.label_symbols")}`,
              },
                createElement("div", { className: styles.metricLabel }, dt.label),
                createElement("div", { className: styles.metricValue,  },
                  dt.total_rows.toLocaleString(),
                ),
                createElement("div", { }, `${dt.symbols} ${t("soc.dataops.label_symbols")}${dt.earliest_date ? ` \u2022 ${dt.earliest_date}` : ""}`),
              ),
            ),
          ),
        )
      : null,

    years.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.year_distribution")),
          createElement("div", { className: styles.yearChart },
            years.map((yr) => {
              const pct = (yr.rows / maxYearRows) * 100;
              return createElement("div", { key: yr.year, className: styles.yearRow },
                createElement("span", { className: styles.yearLabel }, String(yr.year)),
                createElement("div", { className: styles.yearBarTrack },
                  createElement("div", { className: styles.yearBarFill, style: { width: `${pct}%` } }),
                ),
                createElement("span", { className: styles.yearCount }, yr.rows.toLocaleString()),
              );
            }),
          ),
        )
      : null,

    groups.length > 0
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.inventory_table.title")),
          createElement("div", { className: styles.coverageTableWrap },
            createElement("table", { className: styles.coverageTable },
              createElement("thead", null,
                createElement("tr", null,
                  createElement("th", null, t("soc.dataops.inventory_table.col_group")),
                  createElement("th", null, t("soc.dataops.inventory_table.col_symbols")),
                  createElement("th", null, t("soc.dataops.inventory_table.col_covered")),
                  createElement("th", null, t("soc.dataops.inventory_table.col_calendar_days")),
                  createElement("th", null, t("soc.dataops.inventory_table.col_total_rows")),
                  createElement("th", null, t("soc.dataops.inventory_table.col_date_range")),
                ),
              ),
              createElement("tbody", null,
                groups.map((g) => {
                  const ratio = g.symbol_count > 0 ? g.covered_symbols / g.symbol_count : 0;
                  const ratioColor = coverageColor(g.covered_symbols, g.symbol_count);
                  return createElement("tr", { key: g.id },
                    createElement("td", { style: { fontWeight: 600, color: g.type === "custom" ? "var(--color-success-400, #5eead4)" : "inherit" } },
                      `${g.type === "custom" ? "\u2605 " : ""}${g.name}`,
                    ),
                    createElement("td", null, g.symbol_count.toLocaleString()),
                    createElement("td", null,
                      createElement(
                        "span",
                        { className: styles.coverageRatioBar },
                        createElement("span", { style: { fontWeight: 700, color: ratioColor, fontSize: "0.75rem" } }, `${g.covered_symbols} / ${g.symbol_count}`),
                        createElement(
                          "span",
                          { className: styles.coverageRatioTrack },
                          createElement("span", { className: styles.coverageRatioFill, style: { width: `${Math.min(ratio, 1) * 100}%`, background: ratioColor } }),
                        ),
                      ),
                    ),
                    createElement("td", { style: { color: g.calendar_days != null && g.calendar_days < 30 ? "var(--color-warning-500, #fbbf24)" : "var(--text-muted, #94a3b8)", fontWeight: g.calendar_days != null && g.calendar_days < 30 ? 700 : 400 }, title: g.calendar_days != null && g.calendar_days < 30 ? t("soc.dataops.calendar_days_warning") : undefined },
                      g.calendar_days != null ? `${g.calendar_days.toLocaleString()} ngày${g.calendar_days < 30 ? ' \u26A0' : ''}` : t("soc.dataops.fallback_na"),
                    ),
                    createElement("td", { style: { fontWeight: 600 } }, g.total_rows.toLocaleString()),
                    createElement("td", { style: { whiteSpace: "nowrap", fontSize: "0.7rem" } },
                      g.earliest_date && g.latest_date ? `${g.earliest_date} \u2013 ${g.latest_date}` : t("soc.dataops.fallback_na"),
                    ),
                  );
                }),
              ),
            ),
          ),
        )
      : null,

    queueTiersError
      ? createElement("div", { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
          createElement("div", { className: styles.inlineError }, queueTiersError),
          createElement("button", {
            className: styles.actionBtn,
            onClick: () => {
              setQueueTiersError(null);
              setQueueTiersLoading(false);
            },
            style: { marginTop: "0.5rem" },
          }, t("soc.overview.retry")),
        )
      : queueTiers.length > 0
        ? createElement("div", { className: styles.sectionCard },
            createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.queue_tiers")),
            createElement("div", null,
              queueTiers.map((tier) =>
                createElement("div", { key: tier.tier, className: styles.accordion },
                  createElement("div", {
                    className: styles.accordionHeader,
                    role: "button",
                    tabIndex: 0,
                    "aria-expanded": queueTiersExpanded === tier.tier,
                    onClick: () => setQueueTiersExpanded(queueTiersExpanded === tier.tier ? null : tier.tier),
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setQueueTiersExpanded(queueTiersExpanded === tier.tier ? null : tier.tier);
                      }
                    },
                  },
                    createElement("span", { }, tier.tier),
                    createElement("span", { },
                      `${tier.symbol_count} ${t("soc.dataops.label_symbols")} \u2022 ${tier.cadence || t("soc.dataops.fallback_na")}`,
                    ),
                  ),
                  queueTiersExpanded === tier.tier
                    ? createElement("div", { className: styles.accordionContent },
                        createElement("div", { },
                          `${t("soc.dataops.label_cadence")} ${tier.cadence || t("soc.dataops.fallback_na")} \u2022 ${t("soc.dataops.label_active")} ${tier.symbol_count} ${t("soc.dataops.label_symbols")}`,
                        ),
                        ((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).length > 0
                          ? createElement("div", { },
                              ((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).slice(0, 10).map((sym) =>
                                createElement("span", { key: sym, className: styles.statusBadge,  }, sym),
                              ),
                              ((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).length > 10
                                ? createElement("span", { }, `+${((tier as unknown as { examples?: string[] }).examples || tier.active_symbols || []).length - 10} ${t("soc.dataops.overflow_more")}`)
                                : null,
                            )
                          : createElement("span", { }, t("soc.dataops.empty_examples")),
                      )
                    : null,
                ),
              ),
            ),
          )
        : null,
  );
}