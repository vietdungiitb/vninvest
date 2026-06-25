import { createElement, useEffect } from "react";
import { useI18n } from "../../context/LangContext.js";
import { useDataOps } from "./DataOpsContext.js";
import styles from "./soc.module.css";

export function SocDataInventorySection() {
  const { t } = useI18n();
  const { state, actions } = useDataOps();
  const { inventory, loading } = state;

  useEffect(() => {
    actions.refreshInventory();
  }, []);

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary)" } }, value),
    );
  };

  if (loading.inventory) {
    return createElement("p", { className: styles.emptyState }, t("soc.dataops.loading"));
  }

  if (!inventory) {
    return createElement("div", { className: styles.inlineError }, t("soc.dataops.inventory_error"));
  }

  const yearDistribution = inventory.groups?.year_distribution || {};

  return createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } },
    createElement("div", { className: styles.metricGrid },
      renderMetricCard(t("soc.dataops.total_rows"), inventory.total_rows?.toLocaleString() || "0", "var(--accent-cyan)"),
      renderMetricCard(t("soc.dataops.total_symbols"), inventory.total_symbols || "0", "#34d399"),
      renderMetricCard(t("soc.dataops.earliest_date"), inventory.earliest_date || "N/A", "#fbbf24"),
      renderMetricCard(t("soc.dataops.latest_date"), inventory.latest_date || "N/A", "#f87171"),
    ),
    Object.keys(yearDistribution).length > 0
      ? createElement(
          "div",
          { className: styles.sectionCard },
          createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.year_distribution")),
          createElement(
            "div",
            { style: { display: "flex", flexWrap: "wrap", gap: "0.5rem" } },
            Object.entries(yearDistribution).map(([year, count]) =>
              createElement(
                "span",
                {
                  key: year,
                  className: styles.statusBadge,
                  style: { background: "rgba(0, 180, 216, 0.15)", color: "var(--accent-cyan)" },
                },
                `${year}: ${(count as number).toLocaleString()}`,
              ),
            ),
          ),
        )
      : null,
    createElement(
      "div",
      { className: styles.sectionCard },
      createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.data_types")),
      createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "0.5rem" } },
        ["intraday_ticks", "daily_prices", "whale_alerts", "dark_flow", "snapshots"].map((type) =>
          createElement(
            "div",
            {
              key: type,
              style: {
                padding: "0.5rem 0.75rem",
                borderRadius: "6px",
                background: "rgba(15, 23, 42, 0.3)",
                border: "1px solid var(--border-default)",
                fontSize: "0.8rem",
              },
            },
            type.replace(/_/g, " "),
          ),
        ),
      ),
    ),
  );
}
