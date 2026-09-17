import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import { LucideIcon } from "../ui/lucide-icon.js";
import { toneColor } from "./socStatusColors.js";
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
    { className: styles.sectionCard,  },
    createElement(
      "div",
      { },
      createElement(
        "div",
        null,
        createElement(
          "h3",
          { className: styles.sectionCardTitle, style: { display: "flex", alignItems: "center", gap: "0.4rem" } },
          createElement(LucideIcon, { name: "AlertTriangle", className: "h-4 w-4 text-amber-400" }),
          t("soc.dataops.anomaly_guard")
        ),
        createElement("p", { }, t("soc.dataops.anomaly_guard_desc"))
      )
    ),

    createElement(
      "div",
      { className: styles.metricGrid,  },
      renderMetricCard(t("soc.dataops.anomaly_promotion_backlog"), promotionCount, promotionCount > 50 ? "var(--accent-amber)" : toneColor("success")),
      renderMetricCard(
        t("soc.dataops.anomaly_repair_age"),
        repairAgeHours > 0 ? `${repairAgeHours.toFixed(1)}h` : "—",
        repairAgeHours > 24 ? toneColor("danger") : toneColor("success")
      )
    ),

    createElement(
      "div",
      { },
      // Critical gaps table
      createElement(
        "div",
        { className: styles.glassPanel,  },
        createElement(
          "h4",
          { },
          t("soc.dataops.anomaly_critical_gaps")
        ),
        createElement(
          "div",
          { },
          createElement(
            "table",
            { },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { },
                createElement("th", { }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { }, t("soc.dataops.coverage_gap_tier")),
                createElement("th", { }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.critical_gap_symbols || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, },
                  createElement("td", { }, item.symbol),
                  createElement("td", { }, item.tier || "—"),
                  createElement("td", { }, item.gap_score?.toFixed(1)),
                  createElement("td", { }, item.freshness_state)
                )
              ),
              (anomalyGuard.critical_gap_symbols || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, }, t("soc.dataops.no_critical_gaps"))
                )
            )
          )
        )
      ),

      // Hot tier breach table
      createElement(
        "div",
        { className: styles.glassPanel,  },
        createElement(
          "h4",
          { },
          t("soc.dataops.anomaly_hot_breaches")
        ),
        createElement(
          "div",
          { },
          createElement(
            "table",
            { },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { },
                createElement("th", { }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { }, t("soc.dataops.coverage_gap_days")),
                createElement("th", { }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.hot_tier_breach || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, },
                  createElement("td", { }, item.symbol),
                  createElement("td", { }, item.gap_days),
                  createElement("td", { }, item.gap_score?.toFixed(1)),
                  createElement("td", { }, item.freshness_state)
                )
              ),
              (anomalyGuard.hot_tier_breach || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, }, t("soc.dataops.no_hot_breach"))
                )
            )
          )
        )
      )
    )
  );
}
