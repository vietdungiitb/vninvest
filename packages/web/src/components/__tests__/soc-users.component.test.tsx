import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within, act } from "@testing-library/react";
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
    render(<SocUsersPanel />);
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
    render(<SocUsersPanel />);
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
    render(<SocUsersPanel />);
    await waitFor(() => {
      expect(document.body.textContent).toContain("soc.users.page_of");
    });
    fireEvent.click(screen.getByText("soc.users.export_csv"));
    expect(createSpy).toHaveBeenCalledWith("a");
    createSpy.mockRestore();
  });

  it("plan modal submits correct body", async () => {
    render(<SocUsersPanel />);
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
});
