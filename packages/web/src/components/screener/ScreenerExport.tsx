import { createElement, useCallback } from "react";
import type { ScreenerResult } from "../../types/screener.d.ts";

interface ScreenerExportProps {
  results: ScreenerResult;
  visibleColumns?: Array<{ key: string; labelKey: string }>;
}

const DEFAULT_COLUMNS = [
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

function toCSV(results: ScreenerResult, columns: Array<{ key: string; labelKey: string }>): string {
  const headers = columns.map((c) => c.labelKey).join(",");
  const rows = results.matched.map((row) =>
    columns
      .map((c) => {
        const val = (row as any)[c.key];
        if (val === null || val === undefined) return "";
        if (typeof val === "number") return val.toFixed(2);
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [headers, ...rows].join("\n");
}

function toExcel(results: ScreenerResult, columns: Array<{ key: string; labelKey: string }>): string {
  const headerRow = columns
    .map((c) => `<Cell ss:StyleID="Header"><Data ss:Type="String">${c.labelKey}</Data></Cell>`)
    .join("");
  const dataRows = results.matched
    .map(
      (row) =>
        "<Row>" +
        columns
          .map((c) => {
            const val = (row as any)[c.key];
            if (val === null || val === undefined) return '<Cell><Data ss:Type="String"></Data></Cell>';
            if (typeof val === "number")
              return `<Cell><Data ss:Type="Number">${val.toFixed(2)}</Data></Cell>`;
            return `<Cell><Data ss:Type="String">${String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</Data></Cell>`;
          })
          .join("") +
        "</Row>"
    )
    .join("");

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal">
      <Alignment ss:Vertical="Bottom"/>
      <Borders/>
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
      <Interior/>
      <NumberFormat/>
      <Protection/>
    </Style>
    <Style ss:ID="Header">
      <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
      <Interior ss:Color="#1e293b" ss:Pattern="Solid"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="Screener Results">
    <Table ss:ExpandedColumnCount="${columns.length}" ss:ExpandedRowCount="${results.matched.length + 1}" x:FullColumns="1" x:FullRows="1">
      <Row>
        ${headerRow}
      </Row>
      ${dataRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

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
  const handleExportCSV = useCallback(() => {
    const csv = toCSV(results, visibleColumns);
    const dateStr = new Date().toISOString().split("T")[0];
    downloadFile(csv, `screener-results-${dateStr}.csv`, "text/csv");
  }, [results, visibleColumns]);

  const handleExportExcel = useCallback(() => {
    const xml = toExcel(results, visibleColumns);
    const dateStr = new Date().toISOString().split("T")[0];
    downloadFile(xml, `screener-results-${dateStr}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  }, [results, visibleColumns]);

  return createElement(
    "div",
    { style: { display: "flex", gap: "8px" } },
    createElement(
      "button",
      {
        type: "button",
        onClick: handleExportCSV,
        style: {
          padding: "6px 12px",
          background: "rgba(15,23,42,0.6)",
          border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
          borderRadius: "6px",
          color: "var(--text-primary, #f1f5f9)",
          fontSize: "12px",
          cursor: "pointer",
        },
      },
      "CSV",
    ),
    createElement(
      "button",
      {
        type: "button",
        onClick: handleExportExcel,
        style: {
          padding: "6px 12px",
          background: "rgba(15,23,42,0.6)",
          border: "1px solid var(--border-default, rgba(80, 120, 168, 0.28))",
          borderRadius: "6px",
          color: "var(--text-primary, #f1f5f9)",
          fontSize: "12px",
          cursor: "pointer",
        },
      },
      "Excel",
    ),
  );
}
