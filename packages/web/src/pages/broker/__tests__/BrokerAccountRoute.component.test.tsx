import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { BrokerAccountPage } from "../BrokerAccountPage.js";

/**
 * Follow-up mount (mbw2-hub): route con `/broker/accounts/:accountId` render
 * AccountManager 4 tab (DATA) + SyncCenter (DATA) từ route thật.
 *
 * - Mock đúng signature adapter DATA (§2 PLAN_WAVE2): getBrokerAccount,
 *   getAccountPositions/Balance/Orders, syncBrokerAccount, getBrokerJob,
 *   getBrokerSyncRuns/Issues. HUB không gọi coreGet trực tiếp, không sửa file DATA.
 * - Badge join §2: provider lấy từ account trong URL, unlinked ⇒ 0 request đọc.
 */

const adapterMocks = vi.hoisted(() => ({
  getBrokerAccount: vi.fn(),
  getAccountPositions: vi.fn(),
  getAccountBalance: vi.fn(),
  getAccountOrders: vi.fn(),
  syncBrokerAccount: vi.fn(),
  getBrokerJob: vi.fn(),
  getBrokerSyncRuns: vi.fn(),
  getBrokerSyncIssues: vi.fn(),
}));

vi.mock("../../../adapters/coreApiAdapter.js", async (importOriginal) => {
  const actual = await importOriginal();
  const mocked = {
    getBrokerAccount: adapterMocks.getBrokerAccount,
    getAccountPositions: adapterMocks.getAccountPositions,
    getAccountBalance: adapterMocks.getAccountBalance,
    getAccountOrders: adapterMocks.getAccountOrders,
    syncBrokerAccount: adapterMocks.syncBrokerAccount,
    getBrokerJob: adapterMocks.getBrokerJob,
    getBrokerSyncRuns: adapterMocks.getBrokerSyncRuns,
    getBrokerSyncIssues: adapterMocks.getBrokerSyncIssues,
  };
  return {
    ...(actual as Record<string, unknown>),
    defaultCoreApiAdapter: mocked,
    coreApiAdapter: mocked,
  };
});

const LINKED = {
  id: 7,
  provider: "dnse",
  external_id: "E1",
  account_number: "0001",
  display_name: "DNSE — 0001",
  broker_config_id: 5,
  last_sync_at: null,
};

const UNLINKED = { ...LINKED, id: 8, broker_config_id: null };

const POSITIONS = [{ symbol: "VCB", quantity: 10, avg_price: "90", market_price: "100" }];

const BALANCE = {
  cash: "1000",
  stock_value: "2000",
  debt: "0",
  net_equity: "3000",
  buying_power: "1500",
};

const ORDERS = [
  {
    order_id: "O1",
    symbol: "VCB",
    side: "BUY",
    price: "95",
    quantity: "10",
    status: "FILLED",
    placed_at: "2026-10-15T01:00:00Z",
  },
];

const RUNS = [
  {
    id: 11,
    provider: "dnse",
    status: "succeeded",
    started_at: "2026-10-15T01:00:00Z",
    finished_at: "2026-10-15T01:01:00Z",
    stats: {},
    error: null,
  },
];

const ISSUES = [
  {
    id: 21,
    severity: "warning",
    code: "position_drift",
    payload: {},
    resolved: false,
    created_at: "2026-10-15T01:02:00Z",
  },
];

function mockLinked() {
  adapterMocks.getBrokerAccount.mockResolvedValue(LINKED);
  adapterMocks.getAccountPositions.mockResolvedValue(POSITIONS);
  adapterMocks.getAccountBalance.mockResolvedValue(BALANCE);
  adapterMocks.getAccountOrders.mockResolvedValue(ORDERS);
  adapterMocks.syncBrokerAccount.mockResolvedValue({ job_id: "job-1", state: "pending" });
  adapterMocks.getBrokerJob.mockResolvedValue({ job_id: "job-1", state: "succeeded" });
  adapterMocks.getBrokerSyncRuns.mockResolvedValue(RUNS);
  adapterMocks.getBrokerSyncIssues.mockResolvedValue(ISSUES);
}

function renderAtRoute(path, ui) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PortfolioProvider>
        <LangProvider>
          <Routes>
            <Route path="/broker/accounts/:accountId" element={ui} />
          </Routes>
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("BrokerAccountPage route-mount (mbw2-hub follow-up)", () => {
  beforeEach(() => {
    cleanup();
    Object.values(adapterMocks).forEach((fn) => fn.mockReset());
    mockLinked();
  });
  afterEach(() => cleanup());

  it("render từ route đủ 4 tab + sync center", async () => {
    renderAtRoute("/broker/accounts/7", <BrokerAccountPage pollIntervalMs={10} />);
    expect(await screen.findByRole("tab", { name: "Vị thế" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Sổ lệnh" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Khớp lệnh" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Số dư" })).toBeTruthy();
    expect(await screen.findByText(/Lịch sử đồng bộ/)).toBeTruthy();
    expect(screen.getByText("position_drift")).toBeTruthy();
  });

  it("badge join §2: provider lấy từ account trong URL, không suy từ dòng", async () => {
    renderAtRoute("/broker/accounts/7", <BrokerAccountPage pollIntervalMs={10} />);
    const row = await screen.findByText("VCB");
    expect(row.closest("tr")?.textContent).toMatch(/dnse/i);
    expect(row.closest("tr")?.textContent).not.toMatch(/chưa liên kết/i);
  });

  it("đồng bộ từ route: sync ⇒ poll job ⇒ refetch runs", async () => {
    renderAtRoute("/broker/accounts/7", <BrokerAccountPage pollIntervalMs={10} />);
    await screen.findByText("position_drift");
    fireEvent.click(screen.getByRole("button", { name: /Đồng bộ ngay/ }));
    await waitFor(() => expect(adapterMocks.syncBrokerAccount).toHaveBeenCalledWith("7"), {
      timeout: 3000,
    });
    await waitFor(() => expect(adapterMocks.getBrokerJob).toHaveBeenCalledWith("job-1"), {
      timeout: 3000,
    });
    await waitFor(
      () => expect(adapterMocks.getBrokerSyncRuns.mock.calls.length).toBeGreaterThanOrEqual(2),
      { timeout: 5000 },
    );
  });

  it("account unlinked: badge unlinked + 0 request đọc positions/balance/orders", async () => {
    adapterMocks.getBrokerAccount.mockResolvedValue(UNLINKED);
    renderAtRoute("/broker/accounts/8", <BrokerAccountPage pollIntervalMs={10} />);
    await waitFor(() => expect(adapterMocks.getBrokerAccount).toHaveBeenCalledTimes(1));
    expect(document.querySelector('.bdata-badge[data-tone="off"]')?.textContent).toMatch(
      /chưa liên kết/i,
    );
    expect(adapterMocks.getAccountPositions).not.toHaveBeenCalled();
    expect(adapterMocks.getAccountBalance).not.toHaveBeenCalled();
    expect(adapterMocks.getAccountOrders).not.toHaveBeenCalled();
  });

  it("thiếu :accountId ⇒ fail-closed, không gọi adapter", () => {
    render(
      <MemoryRouter initialEntries={["/broker"]}>
        <PortfolioProvider>
          <LangProvider>
            <BrokerAccountPage />
          </LangProvider>
        </PortfolioProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(adapterMocks.getBrokerAccount).not.toHaveBeenCalled();
  });
});
