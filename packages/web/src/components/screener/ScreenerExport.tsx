import { createElement, useCallback } from "react";
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

export function ScreenerExport({ results, visibleColumns = DEFAULT_COLUMNS }: ScreenerExportProps) {
  const { t } = useI18n();
  const resolveLabel = useCallback((labelKey: string) => t(labelKey), [t]);

  const handleExportCSV = useCallback(() => {
    const csv = buildCSV(results.matched as Array<Record<string, unknown>>, visibleColumns, resolveLabel);
    downloadFile(csv, buildExportFilename(results.rule_name, "csv"), "text/csv;charset=utf-8");
  }, [results, visibleColumns, resolveLabel]);

  const handleExportExcel = useCallback(async () => {
    // P0.2 (Q4): real .xlsx via SheetJS, lazy-loaded so the sheet chunk
    // stays out of the initial bundle.
    const XLSX = await import("xlsx");
    const aoa = buildSheetAOA(results.matched as Array<Record<string, unknown>>, visibleColumns, resolveLabel);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = buildSheetColWidths(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Screener");
    XLSX.writeFile(wb, buildExportFilename(results.rule_name, "xlsx"));
  }, [results, visibleColumns, resolveLabel]);

  const btnStyle = {
    padding: "6px 12px",
    background: "rgba(15,23,42,0.6)",
    border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
    borderRadius: "6px",
    color: "var(--text-primary, #f1f5f9)",
    fontSize: "12px",
    cursor: "pointer",
  };

  return createElement(
    "div",
    { style: { display: "flex", gap: "8px" } },
    createElement(
      "button",
      { type: "button", onClick: handleExportCSV, style: btnStyle },
      t("screener.export.csv", { defaultValue: "CSV" }),
    ),
    createElement(
      "button",
      { type: "button", onClick: handleExportExcel, style: btnStyle },
      t("screener.export.excel", { defaultValue: "Excel (.xlsx)" }),
    ),
  );
}
