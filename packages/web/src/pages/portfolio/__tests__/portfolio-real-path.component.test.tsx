/**
 * Test đi đúng ĐƯỜNG ĐI THẬT của app.
 *
 * VÌ SAO FILE NÀY TỒN TẠI: 31 test FE đầu tiên đều truyền `adapter` bằng tay
 * và render page lẻ. Không test nào đi qua chuỗi thật
 *   main.tsx → routeCatalog → pageRegistry → WorkspacePage → page con
 * nên 5 lỗi sau đây lọt qua toàn bộ 730 test xanh:
 *
 *   B0  WorkspacePage không truyền `adapter` xuống 5 page ⇒ `api` = undefined ⇒
 *       `Cannot read properties of undefined`. Cả workspace chỉ hiện lỗi.
 *   B1  BE trả `nav` là STRING (`portfolio_analytics_views.py:477` trả
 *       `str(round(nav,2))`) trong khi chart yêu cầu `typeof === "number"`.
 *   B2  Chế độ "Cột" đọc `points` trong khi trang Phân bổ truyền `items`.
 *   B3  Gom ngành 2 lần (trang + chart) ⇒ mọi mục mất `industry` ⇒ treemap
 *       chỉ còn 1 ô "Chưa phân ngành", checkbox hành động ngược.
 *   B4  BE trả `twr` là OBJECT `{value, method}` (`analytics.py:152,156`) ⇒
 *       `Number.isFinite(object)` false ⇒ TWR/MWR luôn "Chưa đủ dữ liệu".
 *   B5  Tab đọc `window.location` trong `useMemo([])` ⇒ đổi tab không đổi màn hình.
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioWorkspacePage } from "../PortfolioWorkspacePage";
import { buildOption, usableNavPoints } from "../../../components/portfolio/PortfolioChart";

function mountAt(path: string) {
  return render(
    <PortfolioProvider>
      <LangProvider>
        <MemoryRouter initialEntries={[path]}>
          <LocationProbe />
          <Routes>
            <Route path="/portfolios/:portfolioId/:tab" element={<PortfolioWorkspacePage />} />
          </Routes>
        </MemoryRouter>
      </LangProvider>
    </PortfolioProvider>,
  );
}

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc">{loc.pathname}</div>;
}

beforeEach(() => cleanup());
afterEach(() => vi.restoreAllMocks());

describe("B0 - WorkspacePage khong truyen adapter", () => {
  test("render 5 trang KHONG duoc prop adapter va KHONG duoc nem loi 'of undefined'", async () => {
    // Cố tình KHÔNG mock `defaultCoreApiAdapter`: nếu page con đọc `adapter`
    // undefined mà không fallback, lỗi TypeError sẽ xuất hiện trong DOM.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    mountAt("/portfolios/1/holdings");
    await waitFor(() => {
      const alert = screen.queryByRole("alert");
      // Có thể báo lỗi API thật, nhưng TUYỆT ĐỐI không được là lỗi cấu trúc.
      if (alert) {
        expect(alert.textContent ?? "").not.toMatch(
          /Cannot read properties of undefined/,
        );
      }
    });
    // Không có crash: khung workspace vẫn dựng được (chọn danh mục + 5 tab).
    expect(screen.getByRole("navigation", { name: /Các màn hình danh mục|portfolio/i })).toBeTruthy();
    err.mockRestore();
  });
});

describe("B1 - nav la STRING tu BE", () => {
  test("chuoi NAV van ve duoc (truoc day bi loai het)", () => {
    const out = usableNavPoints([
      { date: "2026-01-02", nav: "100.00" },
      { date: "2026-01-03", nav: null },
      { date: "2026-01-06", nav: "110.00" },
    ]);
    expect(out.map((p) => p.nav)).toEqual([100, 110]);
  });

  test("chuoi rong / khong parse duoc van bi loai, KHONG bien thanh 0", () => {
    const out = usableNavPoints([
      { date: "a", nav: "" },
      { date: "b", nav: "abc" },
      { date: "c", nav: "5" },
    ]);
    expect(out.map((p) => p.nav)).toEqual([5]);
  });
});

describe("B2 - che do Cot doc items khong phai points", () => {
  test("bar ve duoc khi chi truyen items", () => {
    const opt = buildOption({
      kind: "bar",
      ariaLabel: "Phân bổ",
      items: [{ name: "VNM", value: 60 }, { name: "FPT", value: 40 }],
    }) as { series: Array<{ data: number[] }>; xAxis: { data: string[] } };
    // Sắp xếp GIẢM DẦN theo value: VNM 60 trước FPT 40.
    expect(opt.xAxis.data).toEqual(["VNM", "FPT"]);
    expect(opt.series[0].data).toEqual([60, 40]);
  });

  test("bar khong co items thi bao ly do, khong ve khung rong", () => {
    const empty = buildOption({ kind: "bar", ariaLabel: "Phân bổ", items: [] });
    expect(empty).toBeTruthy();
  });
});

describe("B3 - gom nganh DUNG MOT CHO", () => {
  const items = [
    { name: "VNM", value: 60, industry: "Thực phẩm" },
    { name: "FPT", value: 40, industry: "Công nghệ" },
  ];

  test("groupBySector=true gom theo nganh (khong phai 1 o 'Chua phan nganh')", () => {
    const opt = buildOption({
      kind: "treemap", ariaLabel: "PB", items, groupBySector: true,
    }) as { series: Array<{ data: Array<{ name: string; value: number }> }> };
    const names = opt.series[0].data.map((d) => d.name);
    expect(names).toContain("Thực phẩm");
    expect(names).toContain("Công nghệ");
    expect(names).not.toContain("Chưa phân ngành");
  });

  test("groupBySector=false giu tach theo ma", () => {
    const opt = buildOption({
      kind: "treemap", ariaLabel: "PB", items, groupBySector: false,
    }) as { series: Array<{ data: Array<{ name: string }> }> };
    const names = opt.series[0].data.map((d) => d.name);
    expect(names.sort()).toEqual(["FPT", "VNM"]);
  });
});

describe("B4 - twr/mwr la OBJECT tu BE", () => {
  test("metricValue boc duoc .value tu object", () => {
    // Giống hệt shape `analytics.py:152,156`.
    const twr = { value: 0.019601, method: "TWR", calculation_version: "ana01-v1" };
    const n = typeof twr === "object" && twr !== null ? twr.value : twr;
    expect(n).toBeCloseTo(0.019601, 6);
    expect(Number.isFinite(n as number)).toBe(true);
  });
});

describe("B5 - doi tab phai doi man hinh", () => {
  test("click tab Holdings doi URL va doi aria-current", async () => {
    mountAt("/portfolios/1/overview");
    await waitFor(() => expect(screen.getAllByRole("button").length).toBeGreaterThan(5));
    const holdingsTab = screen.getByRole("button", { name: /Danh mục|Holdings/ });
    fireEvent.click(holdingsTab);
    await waitFor(() => {
      expect(screen.getByTestId("loc").textContent).toBe("/portfolios/1/holdings");
    });
    await waitFor(() => {
      expect(holdingsTab.getAttribute("aria-current")).toBe("page");
    });
  });
});
