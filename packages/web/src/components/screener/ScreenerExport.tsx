import { createElement, useCallback, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import type { ScreenerResult } from "../../types/screener.d.ts";
import {
  buildCSV,
  buildSheetAOA,
  buildSheetColWidths,
  buildExportFilename,
  type ExportColumn,
} from "./screenerExportUtils.js";

interface ScreenerExportProps {
  results: ScreenerResult;
  visibleColumns?: ExportColumn[];
  /** P1.1: full-set fetcher (server paging); falls back to the current rows. */
  fetchAllRows?: () => Promise<Array<Record<string, unknown>>>;
}

const DEFAULT_COLUMNS: ExportColumn[] = [
  { key: "symbol", labelKey: "screener.columns.symbol" },
  { key: "close", labelKey: "screener.columns.price" },
  { key: "rsi_14", labelKey: "screener.columns.rsi14" },
  { key: "sma20", labelKey: "screener.columns.sma20" },
  { key: "sma50", labelKey: "screener.columns.sma50" },
  { key: "price_vs_sma20_pct", labelKey: "screener.columns.pctSma20" },
  { key: "macd_hist", labelKey: "screener.columns.macdHist" },
  { key: "volume_rvol", labelKey: "screener.columns.rvol" },
  { key: "momentum_20d_pct", labelKey: "screener.columns.momentum20d" },
  { key: "date", labelKey: "screener.columns.date" },
];

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ScreenerExport({ results, visibleColumns = DEFAULT_COLUMNS, fetchAllRows }: ScreenerExportProps) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const resolveLabel = useCallback((labelKey: string) => t(labelKey), [t]);

  const resolveRows = useCallback(async (): Promise<Array<Record<string, unknown>>> => {
    if (fetchAllRows) return fetchAllRows();
    return results.matched as Array<Record<string, unknown>>;
  }, [fetchAllRows, results]);

  const handleExportCSV = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const rows = await resolveRows();
      const csv = buildCSV(rows, visibleColumns, resolveLabel);
      downloadFile(csv, buildExportFilename(results.rule_name, "csv"), "text/csv;charset=utf-8");
    } finally {
      setBusy(false);
    }
  }, [busy, resolveRows, visibleColumns, resolveLabel, results.rule_name]);

  const handleExportExcel = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      // P0.2 (Q4): real .xlsx via SheetJS, lazy-loaded so the sheet chunk
      // stays out of the initial bundle.
      const XLSX = await import("xlsx");
      const rows = await resolveRows();
      const aoa = buildSheetAOA(rows, visibleColumns, resolveLabel);
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = buildSheetColWidths(aoa);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Screener");
      XLSX.writeFile(wb, buildExportFilename(results.rule_name, "xlsx"));
    } finally {
      setBusy(false);
    }
  }, [busy, resolveRows, visibleColumns, resolveLabel, results.rule_name]);

  const btnStyle = {
    padding: "6px 12px",
    background: "rgba(15,23,42,0.6)",
    border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
    borderRadius: "6px",
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "12px",
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.6 : 1,
  };

  return createElement(
    "div",
    { style: { display: "flex", gap: "8px" } },
    createElement(
      "button",
      { type: "button", onClick: handleExportCSV, disabled: busy, style: btnStyle },
      t("screener.export.csv", { defaultValue: "CSV" }),
    ),
    createElement(
      "button",
      { type: "button", onClick: handleExportExcel, disabled: busy, style: btnStyle },
      t("screener.export.excel", { defaultValue: "Excel (.xlsx)" }),
    ),
  );
}
