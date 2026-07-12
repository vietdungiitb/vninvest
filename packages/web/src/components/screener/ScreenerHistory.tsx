import { createElement, useState, useMemo, type CSSProperties } from "react";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import {
  type ScreenerRunEntry,
  type HistoryAction,
  buildTrades,
} from "./screenerHistoryStore.js";

interface ScreenerHistoryProps {
  runs: ScreenerRunEntry[];
}

const ACTION_COLORS: Record<string, string> = {
  BUY: "#4ade80",
  SELL: "#f87171",
  HOLD: "#fbbf24",
  STAND_ASIDE: "#94a3b8",
};

function actionBadge(t: (k: string) => string, action: HistoryAction) {
  if (!action) return null;
  const color = ACTION_COLORS[action] || "#94a3b8";
  return createElement(
    "span",
    {
      style: {
        color,
        border: `1px solid ${color}`,
        borderRadius: "6px",
        padding: "1px 6px",
        fontSize: "11px",
        fontWeight: 600,
      },
    },
    t(`screener.ai.${action.toLowerCase()}`)
  );
}

export function ScreenerHistory({ runs }: ScreenerHistoryProps) {
  const { t, formatNumber } = useI18n();
  const [currentPrices, setCurrentPrices] = useState<Record<string, number | null> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const distinctSymbols = useMemo(() => {
    const set = new Set<string>();
    runs.forEach((r) =>
      r.rows.forEach((row) => {
        if ((row.action === "BUY" || row.action === "SELL") && row.close != null) set.add(row.symbol);
      })
    );
    return [...set];
  }, [runs]);

  const trades = useMemo(() => buildTrades(runs, currentPrices), [runs, currentPrices]);
  const wins = trades.filter((tr) => tr.win).length;
  const losses = trades.length - wins;
  const winRate = trades.length ? (wins / trades.length) * 100 : 0;

  const refreshPrices = async () => {
    if (refreshing || distinctSymbols.length === 0) return;
    setRefreshing(true);
    const map: Record<string, number | null> = {};
    await Promise.all(
      distinctSymbols.map(async (sym) => {
        try {
          const res = (await coreApiAdapter.getDailyPrices(sym, { limit: 5 })) as {
            results?: { date?: string; close: number }[];
          };
          const results = res?.results || [];
          if (results.length) {
            const sorted = [...results].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
            map[sym] = sorted[sorted.length - 1].close;
          }
        } catch {
          /* ignore individual failures */
        }
      })
    );
    setCurrentPrices(map);
    setRefreshing(false);
  };

  if (runs.length === 0) {
    return createElement(
      "div",
      {
        style: {
          background: "var(--bg-panel)",
          border: "1px solid var(--border-default)",
          borderRadius: "12px",
          padding: "24px",
          color: "var(--text-muted)",
          fontSize: "14px",
        },
      },
      t("screener.history.empty")
    );
  }

  const panel: CSSProperties = {
    background: "var(--bg-panel)",
    border: "1px solid var(--border-default)",
    borderRadius: "12px",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  };

  return createElement(
    "div",
    { style: panel },
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" } },
      createElement("h2", { style: { fontSize: "16px", fontWeight: 600, color: "var(--text-primary)" } }, t("screener.history.title")),
      createElement(
        "button",
        {
          onClick: refreshPrices,
          disabled: refreshing || distinctSymbols.length === 0,
          style: {
            padding: "6px 12px",
            background: "rgba(15,23,42,0.6)",
            border: "1px solid var(--border-default)",
            color: "var(--text-secondary)",
            fontSize: "12px",
            borderRadius: "8px",
            cursor: refreshing ? "not-allowed" : "pointer",
            opacity: refreshing ? 0.6 : 1,
          },
        },
        refreshing ? t("screener.history.refreshing") : t("screener.history.refreshPrices")
      )
    ),
    createElement(
      "p",
      { style: { fontSize: "12px", color: "var(--text-muted)", margin: 0 } },
      t("screener.history.backtestNote")
    ),
    createElement(
      "div",
      { style: { display: "flex", gap: "24px", flexWrap: "wrap" } },
      createElement(
        "div",
        null,
        createElement("div", { style: { fontSize: "12px", color: "var(--text-muted)" } }, t("screener.history.winRate")),
        createElement(
          "div",
          { style: { fontSize: "24px", fontWeight: 700, color: winRate >= 50 ? "#4ade80" : "#f87171" } },
          `${formatNumber(Math.round(winRate))}%`
        )
      ),
      createElement(
        "div",
        null,
        createElement("div", { style: { fontSize: "12px", color: "var(--text-muted)" } }, t("screener.history.evaluated")),
        createElement("div", { style: { fontSize: "24px", fontWeight: 700, color: "var(--text-primary)" } }, formatNumber(trades.length))
      ),
      createElement(
        "div",
        null,
        createElement("div", { style: { fontSize: "12px", color: "var(--text-muted)" } }, t("screener.history.wins")),
        createElement("div", { style: { fontSize: "24px", fontWeight: 700, color: "#4ade80" } }, formatNumber(wins))
      ),
      createElement(
        "div",
        null,
        createElement("div", { style: { fontSize: "12px", color: "var(--text-muted)" } }, t("screener.history.losses")),
        createElement("div", { style: { fontSize: "24px", fontWeight: 700, color: "#f87171" } }, formatNumber(losses))
      )
    ),
    trades.length > 0 &&
      createElement(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        createElement("div", { style: { fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 } }, t("screener.history.trades")),
        ...trades.slice(0, 15).map((tr) =>
          createElement(
            "div",
            {
              key: `${tr.symbol}-${tr.entry}`,
              style: {
                display: "flex",
                alignItems: "center",
                gap: "12px",
                fontSize: "12px",
                color: "var(--text-secondary)",
              },
            },
            createElement("span", { style: { width: "56px", color: "var(--text-primary)", fontWeight: 600 } }, tr.symbol),
            actionBadge(t, tr.action),
            createElement("span", null, `${t("screener.history.entry")}: ${formatNumber(Math.round(tr.entry * 100) / 100)}`),
            createElement("span", null, `${t("screener.history.exit")}: ${formatNumber(Math.round(tr.exit * 100) / 100)}`),
            createElement(
              "span",
              { style: { color: tr.win ? "#4ade80" : "#f87171", fontWeight: 600 } },
              t(tr.win ? "screener.history.win" : "screener.history.loss")
            )
          )
        )
      ),
    trades.length === 0 &&
      createElement("p", { style: { fontSize: "12px", color: "var(--text-muted)" } }, t("screener.history.noTrades")),
    createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "10px" } },
      ...runs.map((run) =>
        createElement(
          "div",
          {
            key: run.id,
            style: {
              borderTop: "1px solid var(--border-default)",
              paddingTop: "10px",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
            },
          },
          createElement(
            "div",
            { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", flexWrap: "wrap" } },
            createElement("span", { style: { fontSize: "13px", color: "var(--text-primary)", fontWeight: 600 } }, run.ruleName),
            createElement(
              "span",
              { style: { fontSize: "11px", color: "var(--text-muted)" } },
              `${t("screener.history.runAt")}: ${new Date(run.timestamp).toLocaleString()} · ${formatNumber(run.rows.length)} ${t("screener.history.matches")}`
            )
          ),
          createElement(
            "div",
            { style: { display: "flex", gap: "8px", flexWrap: "wrap" } },
            ...[...run.rows]
              .filter((r) => r.action === "BUY" || r.action === "SELL")
              .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
              .slice(0, 5)
              .map((r) =>
                createElement(
                  "span",
                  {
                    key: r.symbol,
                    style: {
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "rgba(15,23,42,0.6)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "6px",
                      padding: "2px 6px",
                    },
                  },
                  createElement("span", { style: { color: "var(--text-primary)", fontWeight: 600 } }, r.symbol),
                  actionBadge(t, r.action),
                  r.score != null && createElement("span", null, formatNumber(Math.round(r.score)))
                )
              )
          )
        )
      )
    )
  );
}
