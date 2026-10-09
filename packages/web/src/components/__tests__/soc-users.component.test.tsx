import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { SocUsersPanel } from "../soc/SocUsersPanel.js";

const adapterMocks = vi.hoisted(() => ({
  getSocUsers: vi.fn(),
  setSocUserActive: vi.fn(),
  setSocUserPlan: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getSocUsers: adapterMocks.getSocUsers,
    setSocUserActive: adapterMocks.setSocUserActive,
    setSocUserPlan: adapterMocks.setSocUserPlan,
  },
}));

vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const rows = [
  { id: 7, username: "vietdung", email: "v@test.com", is_active: true,
    is_staff: false, tenant: { tenant_code: "tenant_vietdung", plan: "pro" } },
];

function mockLoaded() {
  adapterMocks.getSocUsers.mockResolvedValue({ results: rows, count: 1 });
  adapterMocks.setSocUserActive.mockResolvedValue({ id: 7, is_active: false });
  adapterMocks.setSocUserPlan.mockResolvedValue({ tenant_code: "t", plan: "enterprise" });
}

/**
 * WAVE 6 / NAV-1 — `SocUsersPanel` dùng `useUrlValue` ⇒ `useSearchParams` ⇒
 * `useLocation()`, mà `useLocation()` **throw** ngoài `<Router>`:
 *   "useLocation() may be used only in the context of a <Router> component."
 *
 * Đây là lý do 12 file test SOC phải bọc `MemoryRouter` (phương án (a) của
 * handoff wave 6 §2.3). Pattern bám đúng `page-heading-fu02c.component.test.tsx`.
 *
 * `SearchProbe` đọc `useSearchParams()` và **chỉ** dùng để chứng minh URL thật
 * sự đổi — không đi qua UI, nên không phải giả lập.
 */
function renderPanel(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/soc/users${search}`]}>
      <SearchProbe />
      <SocUsersPanel />
    </MemoryRouter>,
  );
}

/** Bằng chứng trực tiếp: `location.search` thật, không suy diễn từ props. */
function SearchProbe() {
  const [sp] = useSearchParams();
  return <output data-testid="url-probe">{sp.toString()}</output>;
}

describe("SocUsersPanel (A2)", () => {
  beforeEach(() => {
    Object.values(adapterMocks).forEach((m) => m.mockReset());
    mockLoaded();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders user table with badges and count", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("vietdung")).toBeTruthy();
    });
    expect(screen.getByText("tenant_vietdung")).toBeTruthy();
    const table = document.querySelector("table") as HTMLElement;
    expect(table).toBeTruthy();
    expect(within(table).getByText("pro")).toBeTruthy();
    expect(document.body.textContent).toContain("soc.users.bulk_title");
  });

  it("lock opens reason modal and confirms with reason", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("soc.users.lock_btn")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("soc.users.lock_btn"));
    await waitFor(() => {
      expect(screen.getByText("soc.users.lock_confirm")).toBeTruthy();
    });
    const reasonInput = document.querySelector(
      'input[placeholder="soc.users.reason_ph"]') as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: "vi phạm chính sách" } });
    await act(async () => {
      fireEvent.click(screen.getByText("soc.users.lock_confirm"));
    });
    await waitFor(() => {
      expect(adapterMocks.setSocUserActive).toHaveBeenCalledWith(
        7, { is_active: false, reason: "vi phạm chính sách" });
    });
  });

  it("shows pagination total and exports CSV without crash", async () => {
    adapterMocks.getSocUsers.mockResolvedValue({ results: rows, count: 42 });
    const createSpy = vi.spyOn(document, "createElement");
    renderPanel();
    await waitFor(() => {
      expect(document.body.textContent).toContain("soc.users.page_of");
    });
    fireEvent.click(screen.getByText("soc.users.export_csv"));
    expect(createSpy).toHaveBeenCalledWith("a");
    createSpy.mockRestore();
  });

  it("plan modal submits correct body", async () => {
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText("soc.users.plan_btn")).toBeTruthy();
    });
    fireEvent.click(screen.getByText("soc.users.plan_btn"));
    await waitFor(() => {
      expect(screen.getByText("soc.users.plan_submit")).toBeTruthy();
    });
    const reasonInputs = document.querySelectorAll('input[placeholder="soc.users.reason_ph"]');
    const reasonInput = reasonInputs[reasonInputs.length - 1] as HTMLInputElement;
    fireEvent.change(reasonInput, { target: { value: "nâng gói khách hàng" } });
    fireEvent.click(screen.getByText("soc.users.plan_submit"));
    await waitFor(() => {
      expect(adapterMocks.setSocUserPlan).toHaveBeenCalled();
    });
    const [id, body] = adapterMocks.setSocUserPlan.mock.calls[0] as [number, { plan: string; reason: string }];
    expect(id).toBe(7);
    expect(body.reason).toBe("nâng gói khách hàng");
  });

  // ---------------------------------------------------------------- WAVE 6 / NAV-1
  // AC: bộ lọc + phân trang **thật sự** đồng bộ URL, và mount với query sẵn có
  // khởi tạo đúng giá trị đó (deep-link). Đây là quan sát người dùng QUAN TÂM,
  // không phải proxy "component không crash".
  it("W6-1: bam nut trang ghi ?users_page= vao URL", async () => {
    adapterMocks.getSocUsers.mockResolvedValue({ results: rows, count: 42 });
    renderPanel();
    await waitFor(() => { expect(screen.getByText("soc.users.page_of")).toBeTruthy(); });
    // 42 bản ghi / PAGE_SIZE(20) = 3 trang ⇒ nút "›" bật.
    fireEvent.click(screen.getByText("›"));
    await waitFor(() => {
      expect(screen.getByTestId("url-probe").textContent).toContain("users_page=2");
    });
    expect(adapterMocks.getSocUsers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2 }),
    );
  });

  it("W6-2: mount voi ?users_q=... thi o nhap hien dung gia tri deep-link", async () => {
    adapterMocks.getSocUsers.mockResolvedValue({ results: [], count: 0 });
    renderPanel("?users_q=alice");
    await waitFor(() => {
      expect(adapterMocks.getSocUsers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "alice" }),
      );
    });
    const input = document.querySelector('input[type="search"], input') as HTMLInputElement;
    expect(input.value).toBe("alice");
  });

  it("W6-3: mount voi ?users_page=3 thi load dung trang 3", async () => {
    adapterMocks.getSocUsers.mockResolvedValue({ results: rows, count: 60 });
    renderPanel("?users_page=3");
    await waitFor(() => {
      expect(adapterMocks.getSocUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3 }),
      );
    });
  });
});
