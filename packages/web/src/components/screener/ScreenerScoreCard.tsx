import { createElement } from "react";
import { useI18n } from "../../context/LangContext.js";

interface AiAdvisory {
  ai_score_0_100: number;
  strategy_action: "BUY" | "SELL" | "HOLD" | "STAND_ASIDE";
  risk_level: "low" | "medium" | "high";
  synthesis_text: string;
}

interface ScreenerScoreCardProps {
  advisory: AiAdvisory | null;
}

function scoreColor(score: number): string {
  if (score >= 70) return "#4ade80";
  if (score >= 40) return "#fbbf24";
  return "#f87171";
}

function actionColor(action: string): string {
  switch (action) {
    case "BUY":
      return "#4ade80";
    case "SELL":
      return "#f87171";
    case "HOLD":
      return "#fbbf24";
    default:
      return "var(--text-muted)";
  }
}

export function ScreenerScoreCard({ advisory }: ScreenerScoreCardProps) {
  const { t } = useI18n();

  if (!advisory) {
    return createElement(
      "span",
      { style: { color: "var(--text-muted)", fontSize: "12px" } },
      "—",
    );
  }

  const score = advisory.ai_score_0_100;
  const actionKey =
    advisory.strategy_action === "BUY"
      ? "buy"
      : advisory.strategy_action === "SELL"
        ? "sell"
        : advisory.strategy_action === "HOLD"
          ? "hold"
          : "standAside";
  const riskKey =
    advisory.risk_level === "low" ? "low" : advisory.risk_level === "medium" ? "medium" : "high";

  return createElement(
    "span",
    {
      title: advisory.synthesis_text,
      style: { display: "inline-flex", alignItems: "center", gap: "6px", cursor: "help" },
    },
    createElement(
      "span",
      {
        style: {
          fontWeight: 700,
          color: scoreColor(score),
          fontSize: "12px",
          minWidth: "34px",
          textAlign: "right",
        },
      },
      String(score),
    ),
    createElement(
      "span",
      {
        style: {
          fontSize: "10px",
          fontWeight: 600,
          color: actionColor(advisory.strategy_action),
          border: `1px solid ${actionColor(advisory.strategy_action)}`,
          borderRadius: "4px",
          padding: "1px 5px",
          whiteSpace: "nowrap",
        },
      },
      t("screener.ai." + actionKey),
    ),
    createElement(
      "span",
      { style: { fontSize: "10px", color: "var(--text-muted)" } },
      "(" + t("screener.risk." + riskKey) + ")",
    ),
  );
}
