/**
 * WAVE 10 / NAV-1 — `uiux-w10b-nav1`: `AIUsageDashboard` đồng bộ **phân trang +
 * kích thước trang + 2 bộ lọc** với URL query.
 *
 * Ba hành vi AC (quy tắc A/B/C của slice):
 *   A. URL rỗng ⇒ trang 1, 20 bản ghi/trang, filter rỗng — **và URL vẫn rỗng**.
 *   C. Deep-link `?page=3` / `?pageSize=50` ⇒ mount ra đã ở đúng trạng thái đó.
 *   B. Bấm "Next" / đổi filter ⇒ `useSearchParams()` **thật sự đổi**, đo bằng
 *      `SearchProbe` — KHÔNG assert state nội bộ (proxy vẫn xanh khi hỏng).
 *
 * ⚠ Vì sao bọc `MemoryRouter`: `useUrlState` → `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>`. Đây cũng chính là blocker chặn 2 file test cũ
 * (`AIUsageDashboard.component.test.js`, `AISliceE.i18n.component.test.js`) render
 * component này mà KHÔNG bọc Router — xem `docs/SUMMARY_uiux-w10b-nav1.md`.
 *
 * ⚠ `t()` trả placeholder ASCII cho `pageOf`/`showing` để assert deterministic:
 * component gọi `t(...).replace('{page}', …)`; nếu `t` trả key thì `.replace`
 * không thay được ⇒ mất mốc quan sát "đang ở trang mấy".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

const adapterMocks = vi.hoisted(() => ({
  getAIUsageAggregate: vi.fn(),
  getAIUsageRecords: vi.fn(),
  getAIUsageSummary: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: {
    getAIUsageAggregate: adapterMocks.getAIUsageAggregate,
    getAIUsageRecords: adapterMocks.getAIUsageRecords,
    getAIUsageSummary: adapterMocks.getAIUsageSummary,
  },
}));

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    localeTag: "vi-VN",
    t: (k: string) => {
      if (k === "aiUsageAnalytics.pageOf") return "P{page}/{total}";
      if (k === "aiUsageAnalytics.showing") return "{shown}/{total}";
      return k;
    },
    // R1.6: dashboard dùng formatCurrency/formatDateTime/formatNumber — mock đủ shape useI18n.
    formatNumber: (n: unknown) => String(n ?? ""),
    formatCurrency: (n: unknown) => String(n ?? ""),
    formatDateTime: (dt: unknown) => String(dt ?? ""),
  }),
}));

import { AIUsageDashboard } from "../AIUsageDashboard.js";

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

/** Đọc `location.search` hiện tại — bằng chứng trực tiếp rằng URL đã đổi. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

function records(offset: number, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: String(offset + i),
    username: "u",
    action: `ACT-${String(offset + i).padStart(2, "0")}`,
    provider: "openai",
    model: "gpt-4",
    tokens_in: 1,
    tokens_out: 1,
    cost: "0.001",
    latency_ms: 10,
    status: "success",
    created_at: "2026-10-10T00:00:00Z",
  }));
}

function renderDashboard(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <AIUsageDashboard />
    </MemoryRouter>,
  );
}

describe("WAVE 10 / NAV-1 — AIUsageDashboard dong bo phan trang + bo loc voi URL", () => {
  beforeEach(() => {
    adapterMocks.getAIUsageAggregate.mockReset().mockResolvedValue({
      total_requests: 45, total_tokens_in: 1, total_tokens_out: 1,
      total_cost: "1", avg_latency: 10,
    });
    adapterMocks.getAIUsageSummary.mockReset().mockResolvedValue({ results: [] });
    // 45 bản ghi / pageSize mặc định 20 ⇒ 3 trang ⇒ nút "Next" không bị disable.
    adapterMocks.getAIUsageRecords.mockReset().mockImplementation(({ offset, limit }) =>
      Promise.resolve({ results: records(Number(offset), Number(limit)), total: 45 }),
    );
  });

  afterEach(() => cleanup());

  // AC-A: mặc định phải y hệt `useState(1)` / `useState(20)` / `useState('')` cũ.
  it("AC-A — URL rong: trang 1, 20/trang, KHONG ghi them tham so", async () => {
    renderDashboard("");

    await waitFor(() => expect(screen.getByText("ACT-00")).toBeTruthy());
    expect(screen.getByText("P1/3")).toBeTruthy();
    expect(screen.getByText("20/45")).toBeTruthy();
    expect(currentSearch()).toBe("");
    const params = adapterMocks.getAIUsageRecords.mock.calls.at(-1)?.[0];
    expect(params).toMatchObject({ limit: "20", offset: "0" });
    expect(params.model).toBeUndefined();
    expect(params.status).toBeUndefined();
  });

  // AC-C: deep-link phân trang.
  it("AC-C — deep-link ?page=3: mount ra da o trang 3", async () => {
    renderDashboard("?page=3");

    await waitFor(() => expect(screen.getByText("ACT-40")).toBeTruthy());
    expect(screen.queryByText("ACT-00")).toBeNull();
    expect(screen.getByText("P3/3")).toBeTruthy();
    expect(currentSearch()).toBe("page=3");
    expect(adapterMocks.getAIUsageRecords.mock.calls.at(-1)?.[0]).toMatchObject({ offset: "40" });
  });

  // AC-C: deep-link kích thước trang.
  it("AC-C — deep-link ?pageSize=50: 50 ban ghi/trang", async () => {
    renderDashboard("?pageSize=50");

    await waitFor(() => expect(screen.getByText("ACT-00")).toBeTruthy());
    expect(screen.getByText("50/45")).toBeTruthy();
    expect(currentSearch()).toBe("pageSize=50");
    expect(adapterMocks.getAIUsageRecords.mock.calls.at(-1)?.[0]).toMatchObject({ limit: "50" });
  });

  // AC-C: deep-link bộ lọc.
  it("AC-C — deep-link ?statusFilter=error: loc gan vao API", async () => {
    renderDashboard("?statusFilter=error");

    await waitFor(() => expect(screen.getByText("ACT-00")).toBeTruthy());
    expect(adapterMocks.getAIUsageRecords.mock.calls.at(-1)?.[0].status).toBe("error");
    expect((screen.getByTestId("filter-status") as HTMLSelectElement).value).toBe("error");
    expect(currentSearch()).toBe("statusFilter=error");
  });

  // AC-B: bấm "Next" ⇒ URL đổi (không assert riêng state nội bộ).
  it("AC-B — bam Next: useSearchParams doi va hien dung trang 2", async () => {
    renderDashboard("");

    await waitFor(() => expect(screen.getByText("ACT-00")).toBeTruthy());
    fireEvent.click(screen.getByText("aiUsageAnalytics.next"));

    await waitFor(() => expect(currentSearch()).toBe("page=2"));
    await waitFor(() => expect(screen.getByText("ACT-20")).toBeTruthy());
    expect(screen.queryByText("ACT-00")).toBeNull();
    expect(screen.getByText("P2/3")).toBeTruthy();
  });

  // AC-B: đổi bộ lọc ⇒ URL đổi và trang reset về 1 trong CÙNG một patch.
  it("AC-B — doi filter status: ghi vao URL + ve trang 1", async () => {
    renderDashboard("?page=3");

    await waitFor(() => expect(screen.getByText("ACT-40")).toBeTruthy());
    fireEvent.change(screen.getByTestId("filter-status"), { target: { value: "error" } });

    await waitFor(() => expect(currentSearch()).toContain("statusFilter=error"));
    await waitFor(() => expect(screen.getByText("ACT-00")).toBeTruthy());
    expect(screen.getByText("P1/3")).toBeTruthy();
    expect(adapterMocks.getAIUsageRecords.mock.calls.at(-1)?.[0]).toMatchObject({ status: "error" });
  });

  // AC-B: đổi pageSize ⇒ URL đổi (và trang reset về 1).
  it("AC-B — doi so ban ghi/trang: ghi vao URL", async () => {
    renderDashboard("?page=2");

    await waitFor(() => expect(screen.getByText("ACT-20")).toBeTruthy());
    const select = screen.getByText("aiUsageAnalytics.perPage")
      .parentElement as HTMLLabelElement;
    fireEvent.change(select.querySelector("select") as HTMLSelectElement, {
      target: { value: "50" },
    });

    await waitFor(() => expect(currentSearch()).toContain("pageSize=50"));
    await waitFor(() => expect(screen.getByText("P1/1")).toBeTruthy());
  });
});
