export interface ExportColumn {
  key: string;
  labelKey: string;
}

export type ResolveLabel = (labelKey: string) => string;

export function escapeCSVCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/** Format one row value the same way for CSV and XLSX (numbers keep 2 decimals). */
export function formatExportCell(val: unknown): string | number | "" {
  if (val === null || val === undefined) return "";
  if (typeof val === "number") return Number.isFinite(val) ? Number(val.toFixed(2)) : "";
  return String(val);
}

export function buildCSV(
  rows: Array<Record<string, unknown>>,
  columns: ExportColumn[],
  resolveLabel: ResolveLabel,
): string {
  const headers = columns.map((c) => escapeCSVCell(resolveLabel(c.labelKey))).join(",");
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const v = formatExportCell(row[c.key]);
        return typeof v === "number" ? String(v) : escapeCSVCell(v);
      })
      .join(","),
  );
  // BOM so Excel on Windows opens Vietnamese correctly (P0.2 R2.2)
  return "\uFEFF" + [headers, ...lines].join("\n");
}

/** 2D array (header + rows) for SheetJS aoa_to_sheet — numbers stay numeric (R2.3). */
export function buildSheetAOA(
  rows: Array<Record<string, unknown>>,
  columns: ExportColumn[],
  resolveLabel: ResolveLabel,
): Array<Array<string | number>> {
  const header = columns.map((c) => resolveLabel(c.labelKey));
  return [
    header,
    ...rows.map((row) => columns.map((c) => formatExportCell(row[c.key]))),
  ];
}

/** Column widths for SheetJS (!cols) — max content length capped at 40. */
export function buildSheetColWidths(aoa: Array<Array<string | number>>): Array<{ wch: number }> {
  if (!aoa.length) return [];
  const colCount = aoa[0].length;
  const widths: Array<{ wch: number }> = [];
  for (let c = 0; c < colCount; c += 1) {
    let max = 10;
    for (const row of aoa) {
      const len = String(row[c] ?? "").length;
      if (len > max) max = len;
    }
    widths.push({ wch: Math.min(max + 2, 40) });
  }
  return widths;
}

export function slugifyRuleName(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "screener";
}

export function buildExportFilename(ruleName: string, ext: "csv" | "xlsx"): string {
  const dateStr = new Date().toISOString().split("T")[0];
  return `screener-${slugifyRuleName(ruleName)}-${dateStr}.${ext}`;
}
