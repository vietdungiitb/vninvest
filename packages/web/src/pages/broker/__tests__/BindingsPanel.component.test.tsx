import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { BindingsPanel } from "../BindingsPanel.js";

/**
 * mbw3 B3.1 — TDD fail-before cho BindingsPanel (tab "Gộp danh mục").
 *
 * Contract đóng băng PLAN_WAVE3 §2:
 * - List từ `GET workspace/portfolios/<id>/broker-bindings/`
 *   (envelope `[{binding_id, sub_account_id, provider, external_id,
 *   display_name, role, is_default}]`), KHÔNG hardcode.
 * - Add/remove confirm 2 bước + role select (mặc định `secondary`).
 * - Convert kind theo bảng chuyển làn §2 qua PATCH hiện có
 *   `{action:'convert', kind}` (không thêm route).
 *
 * AC1: portfolio có ≥1 binding ⇒ panel hiện đúng danh sách từ GET.
 * AC2: manual + gộp 1 TK ⇒ binding mới role=secondary; gộp TK thứ 2 vào
 *   broker_backed ⇒ FE chặn theo `broker_backed_single_account`; convert sang
 *   aggregate (confirm) ⇒ kind=aggregate + giữ nguyên bindings.
 */

const BINDINGS = [
  {
    binding_id: 1,
    sub_account_id: 7,
    provider: "dnse",
    external_id: "E1",
    display_name: "DNSE — 0001",
    role: "primary",
    is_default: true,
  },
];

const PORTFOLIOS = [{ id: 3, name: "Danh mục chính", kind: "manual" }];

const ACCOUNTS = [
  { id: 7, provider: "dnse", external_id: "E1", display_name: "DNSE — 0001" },
  { id: 8, provider: "ssi", external_id: "E2", display_name: "SSI — 0002" },
];

function makeAdapter(overrides = {}) {
  return {
    getPortfolioBindings: vi.fn(async () => BINDINGS),
    savePortfolioBindings: vi.fn(async () => ({ ok: true })),
    getBrokerAccounts: vi.fn(async () => ACCOUNTS),
    getPortfolios: vi.fn(async () => PORTFOLIOS),
    ...overrides,
  };
}

function wrap(adapter, props = { portfolioId: 3 }) {
  return render(
    <MemoryRouter initialEntries={["/broker/accounts/7"]}>
      <PortfolioProvider>
        <LangProvider>
          <BindingsPanel adapter={adapter} {...props} />
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("BindingsPanel (B3.1, contract §2)", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it("AC1: hiện đúng danh sách bindings từ GET (không hardcode)", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await waitFor(() => expect(adapter.getPortfolioBindings).toHaveBeenCalledWith(3));
    expect(await screen.findByText("DNSE — 0001")).toBeTruthy();
    expect(screen.getByText("DNSE")).toBeTruthy();
  });

  it("GET lỗi ⇒ báo lỗi, không treo loading", async () => {
    const adapter = makeAdapter({
      getPortfolioBindings: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    wrap(adapter);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });

  it("AC2: gộp tiểu khoản confirm 2 bước, role mặc định secondary", async () => {
    const adapter = makeAdapter();
    wrap(adapter, { portfolioId: 3, accountId: 8 });
    await screen.findByText("DNSE — 0001");
    fireEvent.click(screen.getByRole("button", { name: /gộp/i }));
    // Bước 2: hộp xác nhận hiện trước khi gọi mạng.
    expect(await screen.findByText(/xác nhận gộp/i)).toBeTruthy();
    expect(adapter.savePortfolioBindings).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /xác nhận/i }));
    await waitFor(() =>
      expect(adapter.savePortfolioBindings).toHaveBeenCalledWith(3, {
        action: "add",
        sub_account_id: 8,
        role: "secondary",
      }),
    );
  });

  it("AC2: tách binding confirm 2 bước", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await screen.findByText("DNSE — 0001");
    fireEvent.click(screen.getByRole("button", { name: /tách/i }));
    expect(await screen.findByText(/xác nhận tách/i)).toBeTruthy();
    expect(adapter.savePortfolioBindings).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: /xác nhận/i })[0]);
    await waitFor(() =>
      expect(adapter.savePortfolioBindings).toHaveBeenCalledWith(3, {
        action: "remove",
        sub_account_id: 7,
      }),
    );
  });

  it("AC2: broker_backed + ≥2 binding ⇒ chặn chọn broker_backed (single-account)", async () => {
    const two = [
      ...BINDINGS,
      {
        binding_id: 2,
        sub_account_id: 8,
        provider: "ssi",
        external_id: "E2",
        display_name: "SSI — 0002",
        role: "secondary",
        is_default: false,
      },
    ];
    const adapter = makeAdapter({
      getPortfolioBindings: vi.fn(async () => two),
      getPortfolios: vi.fn(async () => [{ id: 3, name: "P", kind: "aggregate" }]),
    });
    wrap(adapter);
    await screen.findByText("SSI — 0002");
    // Gợi ý quy tắc single-account phải hiện (không im lặng).
    expect(screen.getByText(/1 tài khoản/i)).toBeTruthy();
  });

  it("AC2: convert sang aggregate (confirm) ⇒ PATCH convert, giữ bindings", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await screen.findByText("DNSE — 0001");
    fireEvent.change(screen.getByLabelText(/chuyển loại/i), { target: { value: "aggregate" } });
    fireEvent.click(screen.getByRole("button", { name: /chuyển loại/i }));
    expect(await screen.findByText(/xác nhận chuyển/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /xác nhận/i }));
    await waitFor(() =>
      expect(adapter.savePortfolioBindings).toHaveBeenCalledWith(3, {
        action: "convert",
        kind: "aggregate",
      }),
    );
  });

  it("kind vắng (BE chưa deploy) ⇒ khóa convert fail-closed", async () => {
    const adapter = makeAdapter({
      getPortfolios: vi.fn(async () => [{ id: 3, name: "P" }]),
    });
    wrap(adapter);
    await screen.findByText("DNSE — 0001");
    expect(screen.getByText(/không rõ/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /chuyển loại/i }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
