/**
 * WAVE 8 / NAV-1 — chứng minh bộ lọc cửa sổ CVD của `OrderFlowRadarPanel` **thật
 * sự** điều khiển bằng URL, không phải "chỉ gọi hook cho có".
 *
 * Ba hành vi AC (cùng quy ước A/B/C của `soc-nav1-url-state.component.test.tsx`):
 *   A. URL rỗng → `Cả phiên`, **và URL vẫn rỗng**.
 *   C. Deep-link `?cvd_window=1h` → mount ra **đã** ở cửa sổ `1h`.
 *   B. Bấm bộ lọc khác → `useSearchParams` **đổi thật**.
 *
 * Riêng AC A ở file này còn quan trọng hơn: mặc định là `"cả phiên"` — có
 * **dấu cách và tiếng Việt có dấu**. Nếu codec ghi mặc định ra URL thì sinh
 * `?cvd_window=cả phiên`, URL xấu và dễ vỡ khi copy/paste.
 *
 * Vì sao bọc `MemoryRouter`: `useUrlValue` → `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

vi.mock("recharts", () => ({
  AreaChart: ({ children }) => <div data-testid="area-chart">{children}</div>,
  Area: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div>{children}</div>,
}));

import { OrderFlowRadarPanel } from "../OrderFlowRadarPanel.js";

function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

/** Nhãn nút bấm đúng như `timeFilterButtons` (OrderFlowRadarPanel.js:177). */
const LABEL = { "1h": "1h", sang: "Sáng", chieu: "Chiều", all: "Cả phiên" };

function renderPanel(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <OrderFlowRadarPanel symbol="TPB" orderFlowData={{ cvd_series: [], signals: [] }} />
    </MemoryRouter>,
  );
}

describe("OrderFlowRadarPanel — NAV-1 cua so CVD dong bo URL", () => {
  beforeEach(() => vi.restoreAllMocks());
  afterEach(() => cleanup());

  it("A. URL rong → cua so mac dinh `Cả phiên` va URL VAN RONG", () => {
    renderPanel("");

    // Nút được chọn có class `bg-cyan-600` (trang thai active cua panel).
    const active = document.querySelector(".bg-cyan-600");
    expect(active?.textContent?.trim()).toBe(LABEL.all);
    // Điều kiện quan trọng nhất: mặc định KHÔNG được ghi ra URL.
    expect(currentSearch()).toBe("");
  });

  it("C. deep-link ?cvd_window=1h → cua so khoi tao = `1h`", () => {
    renderPanel("?cvd_window=1h");

    const active = document.querySelector(".bg-cyan-600");
    expect(active?.textContent?.trim()).toBe(LABEL["1h"]);
    expect(currentSearch()).toBe("cvd_window=1h");
  });

  it("C2. deep-link ?cvd_window=chi%E1%BB%81u → gia tri co dau duoc giai ma dung", () => {
    renderPanel("?cvd_window=chi%E1%BB%81u");

    const active = document.querySelector(".bg-cyan-600");
    expect(active?.textContent?.trim()).toBe(LABEL.chieu);
    expect(currentSearch()).toBe("cvd_window=chi%E1%BB%81u");
  });

  it("C3. ?cvd_window=bogus → rơi ve mac dinh (khong rơi vao trang thai vo nghia)", () => {
    renderPanel("?cvd_window=bogus");

    const active = document.querySelector(".bg-cyan-600");
    expect(active?.textContent?.trim()).toBe(LABEL.all);
  });

  it("B. bam `Sáng` → URL doi that", () => {
    renderPanel("");
    expect(currentSearch()).toBe("");

    fireEvent.click(screen.getByRole("button", { name: LABEL.sang }));

    expect(currentSearch()).toBe("cvd_window=s%C3%A1ng");
  });

  it("B2. bam ve `Cả phiên` → tham so bi XOA, khong con `?cvd_window=cả phiền`", () => {
    renderPanel("?cvd_window=1h");

    fireEvent.click(screen.getByRole("button", { name: LABEL.all }));

    // Đây là hành vi mà `stringCodec` KHÔNG làm được — lý do WAVE 8 sinh codec.
    expect(currentSearch()).toBe("");
  });

  it("B3. doi nhieu lan lien tiep → chi con gia tri cuoi cung", () => {
    renderPanel("");

    fireEvent.click(screen.getByRole("button", { name: LABEL.sang }));
    fireEvent.click(screen.getByRole("button", { name: LABEL.chieu }));

    expect(currentSearch()).toBe("cvd_window=chi%E1%BB%81u");
  });
});