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
    { className: `styles.sectionCard s5_0_SocAnomalyGuardPanel`,  },
    createElement(
      "div",
      { className: "s5_1_SocAnomalyGuardPanel",  },
      createElement(
        "div",
        null,
        createElement(
          "h3",
          { className: `styles.sectionCardTitle s5_2_SocAnomalyGuardPanel`,  },
          `⚠️ ${t("soc.dataops.anomaly_guard")}`
        ),
        createElement("p", { className: "s5_3_SocAnomalyGuardPanel",  }, t("soc.dataops.anomaly_guard_desc"))
      )
    ),

    createElement(
      "div",
      { className: `styles.metricGrid s5_4_SocAnomalyGuardPanel`,  },
      renderMetricCard(t("soc.dataops.anomaly_promotion_backlog"), promotionCount, promotionCount > 50 ? "var(--accent-amber)" : "#34d399"),
      renderMetricCard(
        t("soc.dataops.anomaly_repair_age"),
        repairAgeHours > 0 ? `${repairAgeHours.toFixed(1)}h` : "—",
        repairAgeHours > 24 ? "#f87171" : "#34d399"
      )
    ),

    createElement(
      "div",
      { className: "s5_5_SocAnomalyGuardPanel",  },
      // Critical gaps table
      createElement(
        "div",
        { className: `styles.glassPanel s5_6_SocAnomalyGuardPanel`,  },
        createElement(
          "h4",
          { className: "s5_7_SocAnomalyGuardPanel",  },
          t("soc.dataops.anomaly_critical_gaps")
        ),
        createElement(
          "div",
          { className: "s5_8_SocAnomalyGuardPanel",  },
          createElement(
            "table",
            { className: "s5_9_SocAnomalyGuardPanel",  },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { className: "s5_10_SocAnomalyGuardPanel",  },
                createElement("th", { className: "s5_11_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { className: "s5_12_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_tier")),
                createElement("th", { className: "s5_13_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { className: "s5_14_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.critical_gap_symbols || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, className: "s5_15_SocAnomalyGuardPanel",  },
                  createElement("td", { className: "s5_16_SocAnomalyGuardPanel",  }, item.symbol),
                  createElement("td", { className: "s5_17_SocAnomalyGuardPanel",  }, item.tier || "—"),
                  createElement("td", { className: "s5_18_SocAnomalyGuardPanel",  }, item.gap_score?.toFixed(1)),
                  createElement("td", { className: "s5_19_SocAnomalyGuardPanel",  }, item.freshness_state)
                )
              ),
              (anomalyGuard.critical_gap_symbols || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, className: "s5_20_SocAnomalyGuardPanel",  }, t("soc.dataops.no_critical_gaps"))
                )
            )
          )
        )
      ),

      // Hot tier breach table
      createElement(
        "div",
        { className: `styles.glassPanel s5_21_SocAnomalyGuardPanel`,  },
        createElement(
          "h4",
          { className: "s5_22_SocAnomalyGuardPanel",  },
          t("soc.dataops.anomaly_hot_breaches")
        ),
        createElement(
          "div",
          { className: "s5_23_SocAnomalyGuardPanel",  },
          createElement(
            "table",
            { className: "s5_24_SocAnomalyGuardPanel",  },
            createElement(
              "thead",
              null,
              createElement(
                "tr",
                { className: "s5_25_SocAnomalyGuardPanel",  },
                createElement("th", { className: "s5_26_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_symbol")),
                createElement("th", { className: "s5_27_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_days")),
                createElement("th", { className: "s5_28_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_score")),
                createElement("th", { className: "s5_29_SocAnomalyGuardPanel",  }, t("soc.dataops.coverage_gap_freshness"))
              )
            ),
            createElement(
              "tbody",
              null,
              (anomalyGuard.hot_tier_breach || []).map((item) =>
                createElement(
                  "tr",
                  { key: item.symbol, className: "s5_30_SocAnomalyGuardPanel",  },
                  createElement("td", { className: "s5_31_SocAnomalyGuardPanel",  }, item.symbol),
                  createElement("td", { className: "s5_32_SocAnomalyGuardPanel",  }, item.gap_days),
                  createElement("td", { className: "s5_33_SocAnomalyGuardPanel",  }, item.gap_score?.toFixed(1)),
                  createElement("td", { className: "s5_34_SocAnomalyGuardPanel",  }, item.freshness_state)
                )
              ),
              (anomalyGuard.hot_tier_breach || []).length === 0 &&
                createElement(
                  "tr",
                  null,
                  createElement("td", { colSpan: 4, className: "s5_35_SocAnomalyGuardPanel",  }, t("soc.dataops.no_hot_breach"))
                )
            )
          )
        )
      )
    )
  );
}
