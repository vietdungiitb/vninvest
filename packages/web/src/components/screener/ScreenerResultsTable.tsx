import { createElement, useState, useMemo, useEffect, useCallback, type CSSProperties, type MouseEvent } from "react";
import { useI18n } from "../../context/LangContext.js";
import type { ScreenerRow, ScreenerResult } from "../../types/screener.d.ts";
import { ScreenerExport } from "./ScreenerExport.js";
import { ScreenerScoreCard } from "./ScreenerScoreCard.js";

type Format = "number" | "pct" | "ratio" | "string" | "date" | "ai";

interface ColumnDef {
  key: keyof ScreenerRow;
  labelKey: string;
  format: Format;
  group: string;
  visibleByDefault: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "symbol", labelKey: "screener.columns.symbol", format: "string", group: "price", visibleByDefault: true },
  { key: "close", labelKey: "screener.columns.price", format: "number", group: "price", visibleByDefault: true },
  { key: "date", labelKey: "screener.columns.date", format: "date", group: "price", visibleByDefault: true },
  { key: "rsi_14", labelKey: "screener.columns.rsi14", format: "number", group: "technical_momentum", visibleByDefault: true },
  { key: "momentum_20d_pct", labelKey: "screener.columns.momentum20d", format: "pct", group: "technical_momentum", visibleByDefault: true },
  { key: "ai_advisory", labelKey: "screener.columns.aiScore", format: "ai", group: "technical_momentum", visibleByDefault: true },
  { key: "macd_hist", labelKey: "screener.columns.macdHist", format: "number", group: "technical_momentum", visibleByDefault: true },
  { key: "adx_14", labelKey: "screener.columns.adx14", format: "number", group: "technical_momentum", visibleByDefault: false },
  { key: "sma20", labelKey: "screener.columns.sma20", format: "number", group: "technical_ma", visibleByDefault: true },
  { key: "sma50", labelKey: "screener.columns.sma50", format: "number", group: "technical_ma", visibleByDefault: true },
  { key: "price_vs_sma20_pct", labelKey: "screener.columns.pctSma20", format: "pct", group: "technical_ma", visibleByDefault: true },
  { key: "price_vs_sma50_pct", labelKey: "screener.columns.pctSma50", format: "pct", group: "technical_ma", visibleByDefault: false },
  { key: "sma20_vs_sma50_pct", labelKey: "screener.columns.crossSma", format: "pct", group: "technical_ma", visibleByDefault: false },
  { key: "stochastic_k", labelKey: "screener.columns.stochK", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "stochastic_d", labelKey: "screener.columns.stochD", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "atr_14", labelKey: "screener.columns.atr14", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "bollinger_width", labelKey: "screener.columns.bollWidth", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "vwap", labelKey: "screener.columns.vwap", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "mfi_14", labelKey: "screener.columns.mfi14", format: "number", group: "technical_advanced", visibleByDefault: false },
  { key: "volume_rvol", labelKey: "screener.columns.rvol", format: "ratio", group: "volume", visibleByDefault: true },
  { key: "avg_volume_20", labelKey: "screener.columns.avgVol20", format: "number", group: "volume", visibleByDefault: false },
  { key: "range_position_pct", labelKey: "screener.columns.rangePos", format: "pct", group: "price_position", visibleByDefault: false },
  { key: "pe_ratio", labelKey: "screener.columns.pe", format: "number", group: "fundamental", visibleByDefault: false },
  { key: "market_cap", labelKey: "screener.columns.marketCap", format: "number", group: "fundamental", visibleByDefault: false },
  { key: "dividend_yield", labelKey: "screener.columns.divYield", format: "pct", group: "fundamental", visibleByDefault: false },
  { key: "eps_growth_yoy", labelKey: "screener.columns.epsGrowth", format: "pct", group: "fundamental", visibleByDefault: false },
  { key: "revenue_growth_yoy", labelKey: "screener.columns.revGrowth", format: "pct", group: "fundamental", visibleByDefault: false },
  { key: "debt_to_equity", labelKey: "screener.columns.deRatio", format: "number", group: "fundamental", visibleByDefault: false },
];

const PAGE_SIZE = 25;

const GROUP_ORDER = ["price", "technical_momentum", "technical_ma", "technical_advanced", "volume", "price_position", "fundamental"];

function formatValue(val: any, format: Format): string {
  if (val === null || val === undefined) return "—";
  switch (format) {
    case "pct": return typeof val === "number" ? val.toFixed(2) + "%" : Number(val).toFixed(2) + "%";
    case "ratio": return typeof val === "number" ? val.toFixed(2) + "×" : Number(val).toFixed(2) + "×";
    case "number": return typeof val === "number" ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : String(val);
    case "date": return String(val);
    default: return String(val);
  }
}

function getCellStyle(val: any, key: keyof ScreenerRow): CSSProperties {
  if (val === null || val === undefined) return { textAlign: "right" };
  const base: React.CSSProperties = { textAlign: "right" };
  switch (key) {
    case "rsi_14":
      return { ...base, color: val < 30 ? "#4ade80" : val > 70 ? "#f87171" : "var(--text-secondary, #94a3b8)", fontWeight: 500 };
    case "price_vs_sma20_pct":
    case "price_vs_sma50_pct":
      return { ...base, color: val > 0 ? "#4ade80" : "#f87171" };
    case "macd_hist":
      return { ...base, color: val > 0 ? "#34d399" : "#fb7185", fontWeight: 500 };
    case "volume_rvol":
      return { ...base, color: val >= 2 ? "#fbbf24" : "var(--text-muted, #94a3b8)", fontWeight: val >= 2 ? 600 : 400 };
    case "momentum_20d_pct":
    case "eps_growth_yoy":
    case "revenue_growth_yoy":
    case "dividend_yield":
      return { ...base, color: val > 0 ? "#4ade80" : "#f87171" };
    default:
      return base;
  }
}

export function ScreenerResultsTable({ results }: { results: ScreenerResult }) {
  const { t, formatNumber } = useI18n();
  const [sortKey, setSortKey] = useState<keyof ScreenerRow | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [showPicker, setShowPicker] = useState(false);
  const [visible, setVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const c of COLUMNS) init[c.key] = c.visibleByDefault;
    return init;
  });

  useEffect(() => { setCurrentPage(1); }, [results]);

  const visibleColumns = useMemo(() => COLUMNS.filter((c) => visible[c.key]), [visible]);
  const totalPages = Math.max(1, Math.ceil(results.matched.length / PAGE_SIZE));

  const sorted = useMemo(() => {
    if (!sortKey) return results.matched;
    const data = [...results.matched];
    data.sort((a, b) => {
      const av = sortKey === "ai_advisory" ? (a.ai_advisory ? a.ai_advisory.ai_score_0_100 : null) : a[sortKey];
      const bv = sortKey === "ai_advisory" ? (b.ai_advisory ? b.ai_advisory.ai_score_0_100 : null) : b[sortKey];
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      let cmp = 0;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return data;
  }, [results.matched, sortKey, sortDir]);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, currentPage]);

  const handleSort = useCallback((key: keyof ScreenerRow) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }, [sortKey]);

  const groupedColumns = useMemo(() => {
    return GROUP_ORDER.map((g) => ({
      group: g,
      cols: COLUMNS.filter((c) => c.group === g),
    })).filter((g) => g.cols.length > 0);
  }, []);

  const visibleForExport = visibleColumns.map((c) => ({ key: String(c.key), labelKey: c.labelKey }));

  return createElement(
    "div",
    { style: { background: "var(--bg-panel, #0f172a)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "12px", padding: "20px" } },
    createElement(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "8px" } },
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "12px" } },
        createElement("h3", { style: { fontSize: "14px", fontWeight: 600, color: "var(--text-secondary, #94a3b8)" } }, results.rule_name),
        createElement(
          "div",
          { style: { fontSize: "12px", color: "var(--text-muted, #94a3b8)" } },
          createElement("span", { style: { color: "#4ade80", fontWeight: "bold" } }, formatNumber(results.matched_count)),
          " ",
          t("screener.matched"),
          " / ",
          formatNumber(results.total_scanned),
          " ",
          t("screener.scannedSymbols"),
        ),
      ),
      createElement(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "8px" } },
        createElement(ScreenerExport, { results, visibleColumns: visibleForExport }),
        createElement(
          "button",
          {
            type: "button",
            onClick: () => setShowPicker((s) => !s),
            style: { padding: "6px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "6px", color: "var(--text-primary, #f1f5f9)", fontSize: "12px", cursor: "pointer" },
          },
          t("screener.columnsBtn"),
        ),
      ),
    ),
    results.matched.length === 0
      ? createElement("p", { style: { color: "var(--text-muted, #94a3b8)", fontSize: "14px", textAlign: "center", padding: "24px 0" } }, t("screener.noMatchedSymbols"))
      : createElement(
          "div",
          null,
          showPicker &&
            createElement(
              "div",
              { style: { marginBottom: "12px", padding: "12px", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "8px", background: "rgba(15,23,42,0.3)", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" } },
              groupedColumns.map((gc) =>
                createElement(
                  "div",
                  { key: gc.group, style: { display: "flex", flexDirection: "column", gap: "6px" } },
                  createElement("h4", { style: { margin: 0, fontSize: "12px", fontWeight: 600, color: "var(--accent-amber)" } }, t("screener.group." + gc.group)),
                  gc.cols.map((c) =>
                    createElement(
                      "label",
                      { key: String(c.key), style: { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--text-secondary, #94a3b8)", cursor: "pointer", padding: "2px 0" } },
                      createElement("input", {
                        type: "checkbox",
                        checked: !!visible[c.key],
                        onChange: () => setVisible((prev) => ({ ...prev, [c.key]: !prev[c.key] })),
                        style: { width: "16px", height: "16px", accentColor: "var(--accent-cyan, #06b6d4)" },
                      }),
                      t(c.labelKey),
                    ),
                  ),
                ),
              ),
            ),
          createElement(
            "div",
            { style: { overflowX: "auto" } },
            createElement(
              "table",
              { style: { width: "100%", fontSize: "12px", textAlign: "left", borderCollapse: "collapse" } },
              createElement(
                "thead",
                null,
                createElement(
                  "tr",
                  { style: { color: "var(--text-muted, #94a3b8)", borderBottom: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))" } },
                  visibleColumns.map((col) =>
                    createElement(
                      "th",
                      {
                        key: String(col.key),
                        onClick: () => handleSort(col.key),
                        style: {
                          paddingBottom: "8px",
                          paddingRight: "16px",
                          textAlign: col.format === "string" ? "left" : "right",
                          fontWeight: 500,
                          cursor: "pointer",
                          userSelect: "none",
                          whiteSpace: "nowrap",
                        },
                      },
                      createElement(
                        "span",
                        { style: { display: "inline-flex", alignItems: "center", gap: "4px" } },
                        t(col.labelKey),
                        sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : "",
                      ),
                    ),
                  ),
                ),
              ),
              createElement(
                "tbody",
                null,
                pageRows.map((row) =>
                  createElement(
                    "tr",
                    {
                      key: row.symbol,
                      style: { borderBottom: "1px solid rgba(255,255,255,0.05)", transition: "background 0.2s" },
                      onMouseEnter: (e: MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; },
                      onMouseLeave: (e: MouseEvent<HTMLTableRowElement>) => { e.currentTarget.style.background = "transparent"; },
                    },
                    visibleColumns.map((col) =>
                      createElement(
                        "td",
                        {
                          key: String(col.key),
                          style: {
                            padding: "8px 16px 8px 0",
                            textAlign: col.format === "string" ? "left" : "right",
                            ...(col.key === "symbol" ? { fontWeight: "bold", color: "var(--accent-cyan, #06b6d4)" } : getCellStyle(row[col.key], col.key)),
                          },
                        },
                        col.key === "symbol"
                          ? createElement("a", { href: "/stocks/" + row.symbol, style: { color: "var(--accent-cyan, #06b6d4)", textDecoration: "none", fontWeight: "bold" } }, row.symbol)
                          : col.key === "ai_advisory"
                            ? createElement(ScreenerScoreCard, { advisory: row.ai_advisory })
                            : formatValue(row[col.key], col.format),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          totalPages > 1 &&
            createElement(
              "div",
              { style: { display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", marginTop: "12px" } },
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => setCurrentPage((p) => Math.max(1, p - 1)),
                  disabled: currentPage <= 1,
                  style: { padding: "6px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "6px", color: "var(--text-primary, #f1f5f9)", cursor: currentPage <= 1 ? "not-allowed" : "pointer", opacity: currentPage <= 1 ? 0.5 : 1 },
                },
                t("common.prev"),
              ),
              createElement("span", { style: { color: "var(--text-muted, #94a3b8)", fontSize: "12px" } }, currentPage + " / " + totalPages),
              createElement(
                "button",
                {
                  type: "button",
                  onClick: () => setCurrentPage((p) => Math.min(totalPages, p + 1)),
                  disabled: currentPage >= totalPages,
                  style: { padding: "6px 12px", background: "rgba(15,23,42,0.6)", border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))", borderRadius: "6px", color: "var(--text-primary, #f1f5f9)", cursor: currentPage >= totalPages ? "not-allowed" : "pointer", opacity: currentPage >= totalPages ? 0.5 : 1 },
                },
                t("common.next"),
              ),
            ),
        ),
  );
}
