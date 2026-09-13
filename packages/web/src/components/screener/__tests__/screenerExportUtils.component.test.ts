import { describe, it, expect } from "vitest";
import {
  buildCSV,
  buildSheetAOA,
  buildSheetColWidths,
  slugifyRuleName,
  buildExportFilename,
  type ExportColumn,
} from "../screenerExportUtils.js";

const COLUMNS: ExportColumn[] = [
  { key: "symbol", labelKey: "screener.columns.symbol" },
  { key: "close", labelKey: "screener.columns.price" },
  { key: "note", labelKey: "screener.columns.date" },
];

const t = (labelKey: string) =>
  ({ "screener.columns.symbol": "Mã", "screener.columns.price": "Giá", "screener.columns.date": "Ngày" })[labelKey] ??
  labelKey;

const ROWS = [
  { symbol: "HPG", close: 28500.456, note: 'a"b,c' },
  { symbol: "VIC", close: null, note: null },
];

describe("buildCSV (P0.2 R2.1/R2.2)", () => {
  it("starts with BOM and uses translated headers", () => {
    const csv = buildCSV(ROWS, COLUMNS, t);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.replace("﻿", "").split("\n")[0]).toBe('"Mã","Giá","Ngày"');
  });

  it("quotes/escapes strings, formats numbers, empties nulls", () => {
    const lines = buildCSV(ROWS, COLUMNS, t).split("\n");
    expect(lines[1]).toBe('"HPG",28500.46,"a""b,c"');
    expect(lines[2]).toBe('"VIC","",""');
  });

  it("falls back to the raw key when a label is missing", () => {
    const csv = buildCSV([], [{ key: "x", labelKey: "screener.columns.unknown" }], t);
    expect(csv.replace("﻿", "").split("\n")[0]).toBe('"screener.columns.unknown"');
  });
});

describe("buildSheetAOA (P0.2 R2.3)", () => {
  it("keeps numbers numeric and nulls empty", () => {
    const aoa = buildSheetAOA(ROWS, COLUMNS, t);
    expect(aoa[0]).toEqual(["Mã", "Giá", "Ngày"]);
    expect(aoa[1]).toEqual(["HPG", 28500.46, 'a"b,c']);
    expect(aoa[2]).toEqual(["VIC", "", ""]);
    expect(typeof aoa[1][1]).toBe("number");
  });

  it("computes column widths capped at 40", () => {
    const widths = buildSheetColWidths([["Mã", "Giá"], ["HPG", 28500.46]]);
    expect(widths).toHaveLength(2);
    expect(widths[0].wch).toBeGreaterThanOrEqual(10);
    const wide = buildSheetColWidths([[ "x".repeat(100) ]]);
    expect(wide[0].wch).toBe(40);
  });
});

describe("filenames", () => {
  it("slugifies Vietnamese rule names", () => {
    expect(slugifyRuleName("Cá voi tích lũy")).toBe("ca-voi-tich-luy");
    expect(slugifyRuleName("")).toBe("screener");
  });

  it("builds dated csv/xlsx filenames", () => {
    const csv = buildExportFilename("RSI oversold", "csv");
    const xlsx = buildExportFilename("RSI oversold", "xlsx");
    expect(csv).toMatch(/^screener-rsi-oversold-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(xlsx).toMatch(/^screener-rsi-oversold-\d{4}-\d{2}-\d{2}\.xlsx$/);
  });
});
