/**
 * mbw2-data B2.3 — TDD fail-before cho BrokerAccountManager (4 tab).
 *
 * AC3: badge provider = provider của account trong URL (detail), KHÔNG suy từ
 * dòng; account `unlinked` (broker_config_id null) ⇒ badge `unlinked` + 0
 * request đọc positions/balance/orders. Tab Khớp lệnh = orders lọc status
 * client-side (ghi rõ giới hạn: không có endpoint fills riêng).
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { BrokerAccountManager } from "../BrokerAccountManager";

const LINKED = {
  id: 7,
  provider: "dnse",
  external_id: "E1",
  account_number: "0001",
  display_name: "DNSE — 0001",
  type: "cash",
  is_active: true,
  broker_config_id: 5,
  last_sync_at: null,
};

const UNLINKED = { ...LINKED, id: 8, broker_config_id: null };

const POSITIONS = [
  { symbol: "VCB", quantity: 10, avg_price: "90", market_price: "100" },
];

const BALANCE = { cash: "1000", stock_value: "2000", debt: "0", net_equity: "3000", buying_power: "1500" };

const ORDERS = [
  { order_id: "O1", symbol: "VCB", side: "BUY", price: "95", quantity: "10", status: "FILLED", placed_at: "2026-10-15T01:00:00Z" },
  { order_id: "O2", symbol: "VCB", side: "SELL", price: "101", quantity: "5", status: "PENDING", placed_at: "2026-10-15T02:00:00Z" },
  { order_id: "O3", symbol: "SSI", side: "BUY", price: "30", quantity: "20", status: "CANCELLED", placed_at: "2026-10-15T03:00:00Z" },
];

function makeAdapter(account = LINKED) {
  return {
    getBrokerAccount: vi.fn(async () => account),
    getAccountPositions: vi.fn(async () => POSITIONS),
    getAccountBalance: vi.fn(async () => BALANCE),
    getAccountOrders: vi.fn(async () => ORDERS),
  };
}

/**
 * WAVE 9 — doc `useSearchParams()`: cung nguon su that voi `useUrlState`, nen
 * doc lai duoc URL sau khi hook ghi. Khong dung `window.location.search` —
 * `MemoryRouter` khong cham vao `window`.
 */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function wrap(node, accountId = 7) {
  return render(
    // LangProvider doi PortfolioProvider boc ngoai (LangContext.js doc usePortfolio).
    <MemoryRouter initialEntries={[`/broker/accounts/${accountId}`]}>
      <PortfolioProvider>
        <LangProvider>
          <SearchProbe />
          {node}
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("BrokerAccountManager (B2.3)", () => {
  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("render du 4 tab Vi the / So lenh / Khop lenh / So du", async () => {
    wrap(<BrokerAccountManager accountId={7} adapter={makeAdapter()} />);
    expect(await screen.findByRole("tab", { name: "Vị thế" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sổ lệnh" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Khớp lệnh" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Số dư" })).toBeTruthy();
  });

  test("badge moi dong lay provider tu account detail (dnse), khong suy tu dong", async () => {
    wrap(<BrokerAccountManager accountId={7} adapter={makeAdapter()} />);
    const row = await screen.findByText("VCB");
    const tr = row.closest("tr");
    expect(tr?.textContent).toMatch(/dnse/i);
    expect(tr?.textContent).not.toMatch(/unlinked|chưa liên kết/i);
  });

  test("account unlinked ⇒ badge unlinked + 0 request doc positions/balance/orders", async () => {
    const adapter = makeAdapter(UNLINKED);
    const { container } = wrap(<BrokerAccountManager accountId={8} adapter={adapter} />, 8);
    // Header badge `unlinked` (tone off) + ghi chu unlinkedNote deu chua cum
    // "chưa liên kết" — dem badge theo class de khong dinh chu thich.
    await waitFor(() => expect(adapter.getBrokerAccount).toHaveBeenCalledTimes(1));
    const badge = container.querySelector('.bdata-badge[data-tone="off"]');
    expect(badge?.textContent).toMatch(/chưa liên kết/i);
    expect(adapter.getAccountPositions).not.toHaveBeenCalled();
    expect(adapter.getAccountBalance).not.toHaveBeenCalled();
    expect(adapter.getAccountOrders).not.toHaveBeenCalled();
  });

  test("tab Khop lenh chi hien lenh FILLED/MATCHED, kem ghi chu gioi han fills", async () => {
    wrap(<BrokerAccountManager accountId={7} adapter={makeAdapter()} />);
    await screen.findByText("VCB");
    fireEvent.click(screen.getByRole("tab", { name: "Khớp lệnh" }));
    expect(await screen.findByText("O1")).toBeTruthy();
    expect(screen.queryByText("O2")).toBeNull();
    expect(screen.queryByText("O3")).toBeNull();
    expect(screen.getByText(/không có endpoint fills riêng/i)).toBeTruthy();
  });

  test("doi tab ghi URL 1 patch duy nhat (?tab=)", async () => {
    wrap(<BrokerAccountManager accountId={7} adapter={makeAdapter()} />);
    await screen.findByText("VCB");
    expect(screen.getByTestId("search").textContent).toBe("");
    fireEvent.click(screen.getByRole("tab", { name: "Sổ lệnh" }));
    await waitFor(() => {
      expect(screen.getByTestId("search").textContent).toMatch(/tab=orders/);
    });
  });
});
