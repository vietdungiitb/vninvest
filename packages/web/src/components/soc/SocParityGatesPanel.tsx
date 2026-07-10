import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";
import styles from "./soc.module.css";

interface ParityWindowData {
  evaluated_symbols?: number;
  strict_fresh_count?: number;
  fresh_or_warm_count?: number;
  strict_fresh_parity?: number;
  fresh_or_warm_parity?: number;
  strict_met?: boolean;
  relaxed_met?: boolean;
  trend?: {
    comparison_hours?: number;
    strict_fresh_delta_pct_points?: number;
    strict_fresh_direction?: string;
    fresh_or_warm_delta_pct_points?: number;
    fresh_or_warm_direction?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

interface ParityHistoryPoint {
  sequence?: number;
  strict_fresh_parity?: number;
  fresh_or_warm_parity?: number;
  end_offset_hours?: number;
  [key: string]: unknown;
}

interface SocParityGatesPanelProps {
  parityGates?: {
    window_24h?: ParityWindowData;
    window_72h?: ParityWindowData;
  };
  parityHistory?: {
    window_24h?: ParityHistoryPoint[];
    window_72h?: ParityHistoryPoint[];
  };
}

export function SocParityGatesPanel({ parityGates, parityHistory }: SocParityGatesPanelProps) {
  const { t } = useI18n();

  if (!parityGates) return null;

  return createElement(
    "div",
    { className: styles.sectionCard },
    createElement("div", { className: styles.sectionCardTitle }, t("soc.dataops.parity_gates")),
    createElement(
      "div",
      { className: styles.metricGrid, style: { gridTemplateColumns: "1fr 1fr", gap: "1rem" } },
      (["24h", "72h"] as const).map((window) => {
        const windowKey = `window_${window}` as const;
        const parityWindow = parityGates[windowKey];
        if (!parityWindow) return null;

        const parityTrend = parityWindow.trend || {};
        const strictParity = (parityWindow.strict_fresh_parity || 0) * 100;
        const relaxedParity = (parityWindow.fresh_or_warm_parity || 0) * 100;
        const strictTrendDelta = parityTrend.strict_fresh_delta_pct_points || 0;
        const relaxedTrendDelta = parityTrend.fresh_or_warm_delta_pct_points || 0;
        const strictTrendDirection = parityTrend.strict_fresh_direction || "flat";
        const relaxedTrendDirection = parityTrend.fresh_or_warm_direction || "flat";

        const strictTrendTone =
          strictTrendDirection === "up"
            ? "text-emerald-300"
            : strictTrendDirection === "down"
            ? "text-rose-300"
            : "text-slate-400";

        const relaxedTrendTone =
          relaxedTrendDirection === "up"
            ? "text-emerald-300"
            : relaxedTrendDirection === "down"
            ? "text-rose-300"
            : "text-slate-400";

        const hasPassed = !!parityWindow.strict_met;
        const windowHistory = parityHistory?.[windowKey] || [];

        return createElement(
          "div",
          {
            key: window,
            className: styles.glassPanel,
            style: {
              padding: "1rem",
              borderRadius: "8px",
              background: "rgba(15, 23, 42, 0.3)",
              border: "1px solid var(--border-default)",
            },
          },
          createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
            createElement("h4", { style: { margin: 0, fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" } }, `${window} window`),
            createElement(
              "span",
              {
                className: styles.statusBadge,
                style: {
                  background: hasPassed ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                  color: hasPassed ? "#34d399" : "#f87171",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                },
              },
              hasPassed ? t("soc.dataops.parity_status_pass") : t("soc.dataops.parity_status_fail")
            )
          ),
          createElement(
            "p",
            { style: { fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)", margin: "0.5rem 0 0.25rem 0" } },
            `${strictParity.toFixed(2)}%`
          ),
          createElement(
            "p",
            { style: { fontSize: "0.7rem", color: "var(--text-muted)", margin: "0.15rem 0" } },
            t("soc.dataops.parity_strict_line", {
              count: parityWindow.strict_fresh_count || 0,
              total: parityWindow.evaluated_symbols || 0,
            })
          ),
          createElement(
            "p",
            {
              className: strictTrendTone,
              style: {
                fontSize: "0.7rem",
                margin: "0.15rem 0",
                color: strictTrendDirection === "up" ? "#34d399" : strictTrendDirection === "down" ? "#f87171" : "#94a3b8",
              },
            },
            t("soc.dataops.parity_trend_line", {
              delta: strictTrendDelta > 0 ? `+${strictTrendDelta.toFixed(2)}` : strictTrendDelta.toFixed(2),
              hours: parityTrend.comparison_hours || 0,
            })
          ),
          createElement(
            "p",
            { style: { fontSize: "0.7rem", color: "var(--accent-amber)", margin: "0.4rem 0 0.15rem 0" } },
            t("soc.dataops.parity_relaxed_line", {
              parity: relaxedParity.toFixed(2),
              count: parityWindow.fresh_or_warm_count || 0,
              total: parityWindow.evaluated_symbols || 0,
            })
          ),
          createElement(
            "p",
            {
              className: relaxedTrendTone,
              style: {
                fontSize: "0.7rem",
                margin: "0.15rem 0",
                color: relaxedTrendDirection === "up" ? "#34d399" : relaxedTrendDirection === "down" ? "#f87171" : "#94a3b8",
              },
            },
            t("soc.dataops.parity_relaxed_trend_line", {
              delta: relaxedTrendDelta > 0 ? `+${relaxedTrendDelta.toFixed(2)}` : relaxedTrendDelta.toFixed(2),
              hours: parityTrend.comparison_hours || 0,
            })
          ),
          createElement(
            "div",
            { style: { marginTop: "0.75rem", borderTop: "1px solid var(--border-default)", paddingTop: "0.5rem" } },
            createElement("p", { style: { fontSize: "0.65rem", color: "var(--text-muted)", margin: "0 0 0.4rem 0", fontWeight: 600 } }, t("soc.dataops.parity_history_title")),
            createElement(
              "div",
              { style: { display: "flex", flexWrap: "wrap", gap: "0.3rem" } },
              windowHistory.slice(0, 7).map((historyPoint, index) => {
                const pointSequence = historyPoint.sequence ?? index;
                const pointStrictPct = (historyPoint.strict_fresh_parity || 0) * 100;
                const pointRelaxedPct = (historyPoint.fresh_or_warm_parity || 0) * 100;
                return createElement(
                  "span",
                  {
                    key: `${window}-${pointSequence}`,
                    className: styles.statusBadge,
                    style: {
                      fontSize: "0.6rem",
                      background: "rgba(100, 116, 139, 0.1)",
                      border: "1px solid rgba(100, 116, 139, 0.2)",
                      color: "var(--text-muted)",
                      cursor: "help",
                      padding: "0.1rem 0.35rem",
                    },
                    title: t("soc.dataops.parity_history_point_tooltip", {
                      strict: pointStrictPct.toFixed(2),
                      relaxed: pointRelaxedPct.toFixed(2),
                      offset: historyPoint.end_offset_hours || 0,
                    }),
                  },
                  t("soc.dataops.parity_history_point_label", {
                    sequence: pointSequence + 1,
                    strict: pointStrictPct.toFixed(1),
                  })
                );
              }),
              windowHistory.length === 0 &&
                createElement(
                  "span",
                  { style: { fontSize: "0.65rem", color: "var(--text-muted)" } },
                  t("soc.dataops.parity_history_empty")
                )
            )
          )
        );
      })
    )
  );
}
