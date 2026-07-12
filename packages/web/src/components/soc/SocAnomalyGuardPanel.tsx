import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface AnomalySymbol {
  symbol: string;
  tier?: string;
  gap_score: number;
  freshness_state: string;
  gap_days?: number;
  priority_reason?: string;
}

interface AnomalyGuardData {
  critical_gap_symbols?: AnomalySymbol[];
  hot_tier_breach?: AnomalySymbol[];
  promotion_backlog?: number;
  repair_backlog_age_hours?: number;
  anomaly_computed_at?: string;
  [key: string]: unknown;
}

interface SocAnomalyGuardPanelProps {
  anomalyGuard?: AnomalyGuardData;
}

export function SocAnomalyGuardPanel({ anomalyGuard }: SocAnomalyGuardPanelProps) {
  const { t } = useI18n();

  if (!anomalyGuard) return null;

  const promotionCount = anomalyGuard.promotion_backlog ?? 0;
  const repairAgeHours = anomalyGuard.repair_backlog_age_hours ?? 0;

  const renderMetricCard = (label: string, value: string | number, color?: string) => {
    return createElement(
      "div",
      { className: styles.metricCard },
      createElement("div", { className: styles.metricLabel }, label),
      createElement("div", { className: styles.metricValue, style: { color: color || "var(--text-primary, #f1f5f9)" } }, value)
    );
  };

  return createElement(
    "div",
    { className: styles.sectionCard, style: { border: "1px solid rgba(249, 115, 22, 0.2)" } },
    createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" } },
      createElement(
        "div",
        null,
        createElement(
          "h3",
          { className: styles.sectionCardTitle, style: { color: "var(--accent-amber)", display: "flex", alignItems: "center", gap: "0.4rem" } },
          `⚠️ ${t("soc.dataops.anomaly_guard")}`
        ),
        createElement("p", { style: { fontSize: "0.7rem", color: "var(--text-muted, #94a3b8)", margin: "0.15rem 0 0 0" } }, t("soc.dataops.anomaly_guard_desc"))
      )
    ),

    createElement(
      "div",
      { className: styles.metricGrid, style: { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "0.75rem", marginBottom: "1.25rem" } },
      renderMetricCard(t("soc.dataops.anomaly_promotion_backlog"), promotionCount, promotionCount > 50 ? "var(--accent-amber)" : "#34d399"),
      renderMetricCard(
        t("soc.dataops.anomaly_repair_age"),
        repairAgeHours > 0 ? `${repairAgeHours.toFixed(1)}h` : "—",
        repairAgeHours > 24 ? "#f87171" : "#34d399"
      )
    ),

    createElement(
      "div",
      { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "1rem" } },
      // Critical gaps table
      createElement(
        "div",
        { className: styles.glassPanel, style: { padding: "0.75rem", background: "rgba(15, 23, 42, 0.3)" } },
        createElement(
          "h4",
          { style: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" } },
          t("soc.dataops.anomaly_critical_gaps")
        ),
        createElement(
          "div",
          { style: { overflowX: "auto" } },
          createElement(
            "table",
            { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.65rem" } },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                createElement("th", { style: { textAlign: "left", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { style: { textAlign: "left", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_tier")),
                createElement("th", { style: { textAlign: "right", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { style: { textAlign: "center", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.critical_gap_symbols || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                  createElement("td", { style: { padding: "0.3rem", fontWeight: 600, color: "var(--accent-amber)" } }, item.symbol),
                  createElement("td", { style: { padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, item.tier || "—"),
                  createElement("td", { style: { padding: "0.3rem", textAlign: "right", fontWeight: 600, color: "#f87171" } }, item.gap_score?.toFixed(1)),
                  createElement("td", { style: { padding: "0.3rem", textAlign: "center" } }, item.freshness_state)
                )
              ),
              (anomalyGuard.critical_gap_symbols || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, style: { padding: "1rem", textAlign: "center", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.no_critical_gaps"))
                )
            )
          )
        )
      ),

      // Hot tier breach table
      createElement(
        "div",
        { className: styles.glassPanel, style: { padding: "0.75rem", background: "rgba(15, 23, 42, 0.3)" } },
        createElement(
          "h4",
          { style: { margin: "0 0 0.5rem 0", fontSize: "0.75rem", fontWeight: 700, color: "var(--text-primary, #f1f5f9)" } },
          t("soc.dataops.anomaly_hot_breaches")
        ),
        createElement(
          "div",
          { style: { overflowX: "auto" } },
          createElement(
            "table",
            { style: { width: "100%", borderCollapse: "collapse", fontSize: "0.65rem" } },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                createElement("th", { style: { textAlign: "left", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { style: { textAlign: "right", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_days")),
                createElement("th", { style: { textAlign: "right", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { style: { textAlign: "center", padding: "0.3rem", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.hot_tier_breach || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, style: { borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", background: "rgba(239, 68, 68, 0.03)" } },
                  createElement("td", { style: { padding: "0.3rem", fontWeight: 600, color: "#f87171" } }, item.symbol),
                  createElement("td", { style: { padding: "0.3rem", textAlign: "right", fontWeight: 600, color: "#f87171" } }, item.gap_days),
                  createElement("td", { style: { padding: "0.3rem", textAlign: "right", color: "var(--text-muted, #94a3b8)" } }, item.gap_score?.toFixed(1)),
                  createElement("td", { style: { padding: "0.3rem", textAlign: "center" } }, item.freshness_state)
                )
              ),
              (anomalyGuard.hot_tier_breach || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, style: { padding: "1rem", textAlign: "center", color: "var(--text-muted, #94a3b8)" } }, t("soc.dataops.no_hot_breach"))
                )
            )
          )
        )
      )
    )
  );
}
