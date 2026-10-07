/**
 * S-03 - contract chart. Trọng tâm: dữ liệu thiếu KHÔNG được biến thành 0.
 *
 * Đây là loại lỗi mà gate "bars render" không bắt được (hazard 8 - proxy
 * observable): chart vẫn render, nhưng rơi xuống sàn 0 đúng những ngày hệ
 * thống chưa biết giá ⇒ người dùng tưởng danh mục sụp sàn. Vì vậy test assert
 * trên **giá trị đầu vào của option**, không phải "component có render".
 */

import { describe, expect, test } from "vitest";
import {
  buildOption,
  emptyReason,
  groupByIndustry,
  usableNavPoints,
  type PortfolioChartProps,
} from "../PortfolioChart";

describe("usableNavPoints", () => {
  test("bo diem nav null thay vi chuyen thanh 0", () => {
    const out = usableNavPoints([
      { date: "2026-01-02", nav: 100 },
      { date: "2026-01-03", nav: null },   // BE: thieu gia cho it nhat 1 ma
      { date: "2026-01-06", nav: 110 },
    ]);
    expect(out.map((p) => p.nav)).toEqual([100, 110]);
    expect(out.some((p) => p.nav === 0)).toBe(false);
  });

  test("sap xep theo ngay tang dan", () => {
    const out = usableNavPoints([
      { date: "2026-01-06", nav: 3 },
      { date: "2026-01-02", nav: 1 },
    ]);
    expect(out.map((p) => p.date)).toEqual(["2026-01-02", "2026-01-06"]);
  });

  test("bo qua gia tri khong phai so hoac NaN/Infinity", () => {
    const out = usableNavPoints([
      { date: "2026-01-02", nav: Number.NaN },
      { date: "2026-01-03", nav: Number.POSITIVE_INFINITY },
      { date: "2026-01-04", nav: 5 },
    ] as never);
    expect(out.map((p) => p.nav)).toEqual([5]);
  });

  test("undefined -> mang rong, khong nem loi", () => {
    expect(usableNavPoints(undefined)).toEqual([]);
  });
});

describe("groupByIndustry", () => {
  test("gom theo nganh va cong don gia tri", () => {
    const out = groupByIndustry([
      { name: "VNM", value: 60, industry: "Thực phẩm" },
      { name: "FPT", value: 30, industry: "Công nghệ" },
      { name: "VFC", value: 10, industry: "Thực phẩm" },
    ]);
    expect(out).toEqual([
      { name: "Thực phẩm", value: 70 },
      { name: "Công nghệ", value: 30 },
    ]);
  });

  test("ma chua co nganh gom vao nhom rieng, KHONG gom vao 'Khac' gia", () => {
    const out = groupByIndustry([
      { name: "VNM", value: 10, industry: "Thực phẩm" },
      { name: "XYZ", value: 5 },              // khong co industry
      { name: "ABC", value: 5, industry: "  " }, // industry rong
    ]);
    const names = out.map((o) => o.name);
    expect(names).toContain("Chưa phân ngành");
    expect(names).not.toContain("Khác");
    expect(out.find((o) => o.name === "Chưa phân ngành")?.value).toBe(10);
  });

  test("bo gia tri khong hop le", () => {
    const out = groupByIndustry([
      { name: "A", value: -5, industry: "X" },
      { name: "B", value: 0, industry: "X" },
      { name: "C", value: Number.NaN, industry: "X" },
      { name: "D", value: 7, industry: "X" },
    ] as never);
    expect(out).toEqual([{ name: "X", value: 7 }]);
  });
});

describe("buildOption", () => {
  const base: PortfolioChartProps = { kind: "line", ariaLabel: "NAV" };

  test("series chi chua cac ngay co gia that", () => {
    const opt = buildOption({
      ...base,
      points: [
        { date: "2026-01-02", nav: 100 },
        { date: "2026-01-03", nav: null },
        { date: "2026-01-06", nav: 110 },
      ],
    }) as { series: Array<{ data: number[] }>; xAxis: { data: string[] } };
    expect(opt.series[0].data).toEqual([100, 110]);
    expect(opt.xAxis.data).toEqual(["2026-01-02", "2026-01-06"]);
    // Không được chèn 0 cho ngày thiếu giá.
    expect(opt.series[0].data).not.toContain(0);
    // len(data) === len(xAxis): ECharts sẽ vẽ lệch nếu 2 mảng khác độ dài.
    expect(opt.series[0].data.length).toBe(opt.xAxis.data.length);
  });

  test("treemap nhan du lieu da gom nganh", () => {
    const opt = buildOption({
      kind: "treemap",
      ariaLabel: "Phân bổ",
      items: [
        { name: "VNM", value: 60, industry: "Thực phẩm" },
        { name: "FPT", value: 40, industry: "Công nghệ" },
      ],
    }) as { series: Array<{ type: string; data: unknown[] }> };
    expect(opt.series[0].type).toBe("treemap");
    expect(opt.series[0].data).toEqual([
      { name: "Thực phẩm", value: 60 },
      { name: "Công nghệ", value: 40 },
    ]);
  });

  test("khong dung type chart ma chua import (bat loi khi goi nham)", () => {
    const opt = buildOption({ kind: "sunburst", ariaLabel: "Tập trung", items: [] }) as {
      series: Array<{ type: string }>;
    };
    // sunburst/treemap phai la type ECharts that, khong phai ten tu do.
    expect(["treemap", "sunburst"]).toContain(opt.series[0].type);
  });
});

describe("emptyReason", () => {
  test("du 2 diem nav moi ve duoc", () => {
    expect(
      emptyReason({
        kind: "line", ariaLabel: "NAV",
        points: [{ date: "a", nav: 1 }, { date: "b", nav: 2 }],
      }),
    ).toBeNull();
  });

  test("chi 1 diem nav -> bao ly do chu khong ve khung rong", () => {
    expect(
      emptyReason({ kind: "line", ariaLabel: "NAV", points: [{ date: "a", nav: 1 }] }),
    ).toBe("insufficient_nav_history");
  });

  test("tat ca nav null -> bao ly do", () => {
    expect(
      emptyReason({
        kind: "bar", ariaLabel: "NAV",
        points: [{ date: "a", nav: null }, { date: "b", nav: null }],
      }),
    ).toBe("insufficient_nav_history");
  });

  test("khong co item co gia tri duong -> bao no_market_prices", () => {
    expect(emptyReason({ kind: "treemap", ariaLabel: "PB", items: [] })).toBe("no_market_prices");
    expect(
      emptyReason({ kind: "treemap", ariaLabel: "PB", items: [{ name: "A", value: 0 }] }),
    ).toBe("no_market_prices");
  });
});
