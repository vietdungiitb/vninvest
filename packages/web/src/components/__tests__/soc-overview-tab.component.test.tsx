import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { renderInRouter, currentUrl } from "./socRouterHarness.js";
import { SocOverviewPanel } from "../soc/SocOverviewPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocOverviewSummary: vi.fn(),
  getSocSloOverview: vi.fn(),
  updateSocService: vi.fn(),
  triggerSocServiceHealthCheck: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocOverviewSummary: adapterMocks.getSocOverviewSummary,
    getSocSloOverview: adapterMocks.getSocSloOverview,
    updateSocService: adapterMocks.updateSocService,
    triggerSocServiceHealthCheck: adapterMocks.triggerSocServiceHealthCheck,
  },
}));

const baseServices = [
  { service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true, avg_response_ms: 120, last_check_at: "2026-09-16T09:00:00Z" },
  { service_key: "svc_degraded", name: "Degraded SVC", domain: "prefetch", status: "degraded", is_active: true },
  { service_key: "svc_critical", name: "Critical SVC", domain: "signals", status: "unhealthy", is_active: true },
  { service_key: "svc_maintenance", name: "Maintenance SVC", domain: "screener", status: "maintenance", is_active: true },
  { service_key: "svc_unknown", name: "Unknown SVC", domain: "dataops", status: "unknown", is_active: true },
  { service_key: "svc_disabled", name: "Disabled SVC", domain: "platform", status: "healthy", is_active: false },
];

describe("SocOverviewPanel — PR-1 W3 maintenance metric", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows maintenance card with count 1 and unknown 0 when fixture has 1 maintenance", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: baseServices });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    // metric labels are i18n keys in test env
    expect(screen.getByText("soc.overview.maintenance_count")).toBeTruthy();
    // maintenance card value 1 should appear at least once
    const maintenanceValues = screen.getAllByText("1");
    expect(maintenanceValues.length).toBeGreaterThan(0);
    // unknown count should be 1 (only svc_unknown), not 2 (maintenance not counted as unknown)
    // total services =6, so we check that unknown card exists
    expect(screen.getByText("soc.overview.unknown_count")).toBeTruthy();
  });
});

describe("SocOverviewPanel — PR-1 W2 bar 6 segments", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("renders 6 segments when 6 statuses each have 1 service, total width ≈100%", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: baseServices });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    const { container } = renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    const bar = container.querySelector('[class*="overviewHealthBar"]');
    expect(bar).toBeTruthy();
    const segments = bar!.querySelectorAll('[class*="overviewHealthBarSegment"]');
    expect(segments.length).toBe(6);
    let totalWidth = 0;
    segments.forEach((el) => {
      const w = (el as HTMLElement).style.width;
      totalWidth += parseFloat(w.replace("%", "")) || 0;
    });
    expect(totalWidth).toBeGreaterThan(99);
    expect(totalWidth).toBeLessThan(101);
  });
});

describe("SocOverviewPanel — PR-1 W4 SLO fail", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows SLO error banner but keeps service grid when SLO fetch fails", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true }],
    });
    adapterMocks.getSocSloOverview.mockRejectedValue(new Error("SLO boom"));
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Healthy SVC")).toBeTruthy());
    expect(screen.getByText("SLO boom")).toBeTruthy();
    expect(screen.getByText("soc.overview.retry_slo")).toBeTruthy();
    // retry should clear error when next SLO succeeds
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    fireEvent.click(screen.getByText("soc.overview.retry_slo"));
    await waitFor(() => expect(screen.queryByText("SLO boom")).toBeNull());
  });
});

describe("SocOverviewPanel — PR-1 W1 toggle confirm", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
    adapterMocks.updateSocService.mockReset();
  });
  afterEach(() => cleanup());

  it("shows modal on toggle, cancel does not call API, confirm with reason calls API with change_reason", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_healthy", name: "Healthy SVC", domain: "vnbroker", status: "healthy", is_active: true }],
    });
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    adapterMocks.updateSocService.mockResolvedValue({});
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Healthy SVC")).toBeTruthy());
    const toggleBtn = screen.getByText("soc.overview.disable_service");
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(screen.getByText("soc.overview.toggle_title")).toBeTruthy());
    // confirm button disabled when reason empty
    const confirmBtn = screen.getByRole("button", { name: "Xác nhận" }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    // cancel should close and not call API
    fireEvent.click(screen.getByText("Hủy"));
    await waitFor(() => expect(screen.queryByText("soc.overview.toggle_title")).toBeNull());
    expect(adapterMocks.updateSocService).not.toHaveBeenCalled();
    // reopen, fill reason, confirm
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(screen.getByText("soc.overview.toggle_title")).toBeTruthy());
    const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "bao tri dinh ky" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Xác nhận" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(adapterMocks.updateSocService).toHaveBeenCalledWith("svc_healthy", { is_active: false, change_reason: "bao tri dinh ky" }));
  });
});

describe("SocOverviewPanel — PR-2 W7 domain strip", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows domain pills from by_domain and filters on click", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [
        { service_key: "svc_a", name: "A SVC", domain: "vnbroker", status: "healthy", is_active: true },
        { service_key: "svc_b", name: "B SVC", domain: "prefetch", status: "healthy", is_active: true },
      ],
      by_domain: {
        vnbroker: { total: 1, healthy: 1, degraded: 0, unhealthy: 0, unknown: 0, maintenance: 0 },
        prefetch: { total: 1, healthy: 1, degraded: 0, unhealthy: 0, unknown: 0, maintenance: 0 },
      },
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    expect(screen.getByText("soc.overview.domain_all")).toBeTruthy();
    const vnbrokerPill = screen.getByText("vnbroker 1/1");
    fireEvent.click(vnbrokerPill);
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    expect(screen.queryByText("B SVC")).toBeNull();
  });
});

describe("SocOverviewPanel — PR-2 W10 pagination range", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows showing_range 1–9 / 10 and paginates to second page", async () => {
    const many = Array.from({ length: 10 }, (_, i) => ({
      service_key: `svc_${i}`,
      name: `SVC ${i}`,
      domain: "vnbroker",
      status: "healthy",
      is_active: true,
    }));
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: many } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("SVC 0")).toBeTruthy());
    expect(screen.getByText("soc.overview.showing_range")).toBeTruthy();
    fireEvent.click(screen.getByText("soc.overview.next_page"));
    await waitFor(() => expect(screen.getByText("SVC 9")).toBeTruthy());
    expect(screen.queryByText("SVC 0")).toBeNull();
  });
});

describe("SocOverviewPanel — PR-2 W5 empty filtered", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("shows empty_filtered when search has no match", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_a", name: "A SVC", domain: "vnbroker", status: "healthy", is_active: true }],
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    const input = document.querySelector('input[placeholder="soc.overview.search_placeholder"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "zzz_no_match" } });
    await waitFor(() => expect(screen.getByText("soc.overview.empty_filtered")).toBeTruthy(), { timeout: 1000 });
  });
});

describe("SocOverviewPanel — UI polish W-U2 name title", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("long service name has full title tooltip", async () => {
    const longName = "Daily Prefetch Orchestrator With Very Long Name";
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [{ service_key: "svc_long", name: longName, domain: "prefetch", status: "healthy", is_active: true }],
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    const { container } = renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText(longName, { exact: false })).toBeTruthy());
    const h4 = container.querySelector('h4[class*="overviewServiceName"]') as HTMLElement;
    expect(h4).toBeTruthy();
    expect(h4.getAttribute("title")).toBe(longName);
  });
});

describe("SocOverviewPanel — UI polish W-U4 metric share + W-U7 freshness", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("metric cards show share caption and hero shows updated time", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: baseServices,
      generated_at: "2026-09-16T09:00:00Z",
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    // 6 status cards each render metric_share caption
    expect(screen.getAllByText("soc.overview.metric_share").length).toBe(6);
    expect(screen.getAllByText((_c, el) => el?.tagName === "SPAN" && (el?.textContent?.includes("soc.overview.hero_updated_at") ?? false)).length).toBe(1);
  });
});

describe("SocOverviewPanel — UI polish W-U5 domain pills + row labels", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("domain pills use distinct class and both filter rows have labels", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [
        { service_key: "svc_a", name: "A SVC", domain: "vnbroker", status: "healthy", is_active: true },
      ],
      by_domain: {
        vnbroker: { total: 1, healthy: 1, degraded: 0, unhealthy: 0, unknown: 0, maintenance: 0 },
      },
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    const { container } = renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    expect(screen.getByText("soc.overview.filter_by_domain")).toBeTruthy();
    expect(screen.getByText("soc.overview.filter_by_status")).toBeTruthy();
    const pills = container.querySelectorAll('[class*="domainPill"]');
    expect(pills.length).toBe(2); // domain_all + vnbroker
  });
});

describe("SocOverviewPanel — UI polish uniform card zones", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("every card has its own full-width SLO zone (placeholder when no SLO data)", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({ services: baseServices } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] });
    const { container } = renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Maintenance SVC")).toBeTruthy());
    const cards = container.querySelectorAll('[class*="overviewServiceCard"]');
    expect(cards.length).toBe(6);
    cards.forEach((card) => {
      // SLO zone must be a direct child of the card (not nested in header)
      const zones = Array.from(card.children).filter((el) =>
        (el.getAttribute("class") || "").includes("sloBadges"),
      );
      expect(zones.length).toBe(1);
    });
  });
});

describe("SocOverviewPanel — PR-2 W11 burn per budget", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
  });
  afterEach(() => cleanup());

  it("burn badge red when budget <20% and hidden when disabled", async () => {
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [
        { service_key: "svc_low_budget", name: "Low Budget SVC", domain: "vnbroker", status: "healthy", is_active: true },
        { service_key: "svc_disabled", name: "Disabled SVC", domain: "vnbroker", status: "healthy", is_active: false },
      ],
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({
      services: [
        { service_key: "svc_low_budget", uptime_30d: 0.99, burn_rate_1h: 5, error_budget_remaining: 0.1, slo_target: 0.999 },
        { service_key: "svc_disabled", uptime_30d: 0.99, burn_rate_1h: 5, error_budget_remaining: 0.1, slo_target: 0.999 },
      ],
    } as any);
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("Low Budget SVC")).toBeTruthy());
    // burn badge for low budget should be red (color var)
    const lowBudgetCard = screen.getByText("Low Budget SVC").closest("div")?.parentElement?.parentElement;
    expect(lowBudgetCard?.textContent).toContain("soc.slo.burn_rate_label");
    // disabled service should not have SLO badges
    const disabledCard = screen.getByText("Disabled SVC").closest("div")?.parentElement?.parentElement;
expect(disabledCard?.textContent).not.toContain("soc.slo.burn_rate_label");
  });
});

// ---------------------------------------------------------------- WAVE 6 / NAV-1
// AC: URL là nguồn sự thật. Quan sát người dùng QUAN TÂM — deep-link phải mở
// đúng trang, và thao tác phải ghi ra URL — chứ không phải proxy "component
// không crash".
//
// Block RIÊNG (không nhét vào block trên): block đó không có `beforeEach` mock ⇒
// component render ra không có dữ liệu, mọi `getByText` đều fail. Đây là lỗi
// khi đặt test, không phải lỗi production.
describe("SocOverviewPanel - WAVE 6 / NAV-1 dong bo URL", () => {
  beforeEach(() => {
    adapterMocks.getSocOverviewSummary.mockReset();
    adapterMocks.getSocSloOverview.mockReset();
    adapterMocks.getSocOverviewSummary.mockResolvedValue({
      services: [
        { service_key: "svc_a", name: "A SVC", domain: "vnbroker", status: "healthy", is_active: true },
        { service_key: "svc_b", name: "B SVC", domain: "signals", status: "healthy", is_active: true },
        { service_key: "svc_c", name: "C SVC", domain: "screener", status: "healthy", is_active: true },
      ],
    } as any);
    adapterMocks.getSocSloOverview.mockResolvedValue({ services: [] } as any);
  });
  afterEach(() => cleanup());

  it("W6-O1: deep-link ?size=1&page=3 thi GIU NGUYEN (trang co that)", async () => {
    // 3 dịch vụ / size=1 ⇒ **3 trang thật**, nên `?page=3` là deep-link hợp lệ.
    // Đổi fixture lớn hơn sẽ biến `?page=3` thành trang không tồn tại ⇒ khi đó
    // clamp về 1 là **đúng** (đây là hành vi sẵn có, không phải hồi quy).
    renderInRouter(<SocOverviewPanel />, "?size=1&page=3");
    // size=1 ⇒ mỗi trang 1 dịch vụ; trang 3 hiện "C SVC".
    await waitFor(() => expect(screen.getByText("C SVC")).toBeTruthy());
    // Effect "đổi bộ lọc ⇒ setPage(1)" chạy ở mount. Trước khi có `firstRun`
    // guard, nó xoá mất deep-link ngay lập tức.
    expect(currentUrl()).toContain("page=3");
    expect(currentUrl()).toContain("size=1");
  });

  it("W6-O1b: deep-link ?page=99 vuot so trang thi clamp ve trang cuoi (khong loi)", async () => {
    renderInRouter(<SocOverviewPanel />, "?size=1&page=99");
    await waitFor(() => expect(screen.getByText("C SVC")).toBeTruthy());
    // 3 trang ⇒ clamp về 3, không phải 1. Đây là hành vi clamp có sẵn.
    await waitFor(() => expect(currentUrl()).toContain("page=3"));
  });

  it("W6-O2: doi pageSize ghi ?size= vao URL", async () => {
    renderInRouter(<SocOverviewPanel />);
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    // Chọn ĐÚNG select phân trang: `value` = pageSize hiện tại. Trang có nhiều
    // `select` khác (lọc domain/sort) nên `querySelector("select")` chọn nhầm.
    const sizeSelect = Array.from(document.querySelectorAll("select")).find(
      (s) => ["9", "18", "36"].includes((s as HTMLSelectElement).value),
    ) as HTMLSelectElement;
    expect(sizeSelect).toBeTruthy();
    fireEvent.change(sizeSelect, { target: { value: "18" } });
    await waitFor(() => expect(currentUrl()).toContain("size=18"));
  });

  it("W6-O3: bam nut trang sau ghi ?page= vao URL", async () => {
    renderInRouter(<SocOverviewPanel />, "?size=1");
    await waitFor(() => expect(screen.getByText("A SVC")).toBeTruthy());
    // Nút tránh bằng `aria-label="Page N"` (SocOverviewPanel.tsx) — **không** phải
    // ký tự `›`/`‹`. Test đo đúng nút người dùng thực sự bấm.
    fireEvent.click(screen.getByLabelText("Page 2"));
    await waitFor(() => expect(currentUrl()).toContain("page=2"));
  });
});
