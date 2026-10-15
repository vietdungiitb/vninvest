import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { ScopedWatchlist } from "../ScopedWatchlist.js";

/**
 * mbw3 B3.3-FE — TDD fail-before cho watchlist scoped + derived (ADR-007).
 *
 * Contract đóng băng PLAN_WAVE3 §2:
 * - `getWatchlistsScoped({provider, brokerAccountId})` → watchlist thủ công
 *   đúng scope (BE filter `?provider=&broker_account=`).
 * - `getDerivedWatchlist(accountId)` → FE-compute từ positions, read-only.
 * - Quy tắc hiển thị: holdings vs watchlist 2 khu vực riêng, badge nguồn mọi
 *   dòng; derived gắn nhãn "Đang nắm giữ @ provider/tiểu khoản"; copy
 *   empty-state khác nhau.
 *
 * AC5: 2 watchlist khác scope + lọc theo provider/tiểu khoản ⇒ chỉ hiện đúng
 * scope; derived tách riêng khỏi manual, empty-copy khác nhau.
 */

const MANUAL = [
  { id: 1, name: "Theo dõi DNSE", source: "manual", provider: "dnse", broker_account: 7 },
  { id: 2, name: "Theo dõi SSI", source: "manual", provider: "ssi", broker_account: 8 },
];

const DERIVED = {
  account: { id: 7, provider: "dnse", display_name: "DNSE — 0001" },
  items: [{ symbol: "VCB", quantity: 10 }],
};

function makeAdapter(overrides = {}) {
  return {
    getWatchlistsScoped: vi.fn(async () => MANUAL),
    getDerivedWatchlist: vi.fn(async () => DERIVED),
    ...overrides,
  };
}

function wrap(adapter, props = { provider: "dnse", brokerAccountId: 7 }) {
  return render(
    <MemoryRouter initialEntries={["/watchlist"]}>
      <PortfolioProvider>
        <LangProvider>
          <ScopedWatchlist adapter={adapter} {...props} />
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("ScopedWatchlist (B3.3-FE, ADR-007)", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  it("AC5: gọi đúng scope provider + broker_account", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await waitFor(() =>
      expect(adapter.getWatchlistsScoped).toHaveBeenCalledWith({
        provider: "dnse",
        brokerAccountId: 7,
      }),
    );
  });

  it("AC5: chỉ hiện watchlist đúng scope, badge nguồn mọi dòng", async () => {
    const adapter = makeAdapter({
      getWatchlistsScoped: vi.fn(async () => [MANUAL[0]]),
    });
    wrap(adapter);
    expect(await screen.findByText("Theo dõi DNSE")).toBeTruthy();
    expect(screen.queryByText("Theo dõi SSI")).toBeNull();
  });

  it("AC5: derived tách riêng khỏi manual + nhãn đang-nắm-giữ", async () => {
    const adapter = makeAdapter();
    wrap(adapter, { provider: "dnse", brokerAccountId: 7 });
    const derived = await screen.findByText(/đang nắm giữ/i);
    const manual = await screen.findByText("Theo dõi DNSE");
    // Hai khu vực riêng: không chung container section.
    expect(derived.closest("section")).not.toBe(manual.closest("section"));
    expect(await screen.findByText("VCB")).toBeTruthy();
  });

  it("AC5: empty-copy manual và derived khác nhau", async () => {
    const adapter = makeAdapter({
      getWatchlistsScoped: vi.fn(async () => []),
      getDerivedWatchlist: vi.fn(async () => ({ account: DERIVED.account, items: [] })),
    });
    wrap(adapter);
    const manualEmpty = await screen.findByText(/chưa có danh sách theo dõi/i);
    const derivedEmpty = await screen.findByText(/chưa nắm giữ mã nào/i);
    expect(manualEmpty.textContent).not.toBe(derivedEmpty.textContent);
  });

  it("lỗi tải ⇒ báo lỗi, không treo", async () => {
    const adapter = makeAdapter({
      getWatchlistsScoped: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    wrap(adapter);
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
