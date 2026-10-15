import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { BrokerAccountPage } from "../BrokerAccountPage.js";

/**
 * Mount `ScopedWatchlist` (mbw3 B3.3-FE, truoc do 0 noi mount):
 * - `BrokerAccountPage` truyen `brokerAccountId` tu URL => hien ca manual
 *   theo scope + derived "Dang nam giu @ ...".
 * - `WatchlistPage` mount khong account => chi manual theo scope.
 *
 * Mock dung signature adapter DATA: getWatchlistsScoped + getDerivedWatchlist
 * (qua getBrokerAccount/getAccountPositions). Khong goi mang that.
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
  getWatchlists: vi.fn(),
  getWatchlistsScoped: vi.fn(),
  getDerivedWatchlist: vi.fn(),
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
    getWatchlists: adapterMocks.getWatchlists,
    getWatchlistsScoped: adapterMocks.getWatchlistsScoped,
    getDerivedWatchlist: adapterMocks.getDerivedWatchlist,
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

function mockAll() {
  adapterMocks.getBrokerAccount.mockResolvedValue(LINKED);
  adapterMocks.getAccountPositions.mockResolvedValue([
    { symbol: "VCB", quantity: 10 },
  ]);
  adapterMocks.getAccountBalance.mockResolvedValue({ cash: "1000" });
  adapterMocks.getAccountOrders.mockResolvedValue([]);
  adapterMocks.syncBrokerAccount.mockResolvedValue({ job_id: "j", state: "pending" });
  adapterMocks.getBrokerJob.mockResolvedValue({ job_id: "j", state: "succeeded" });
  adapterMocks.getBrokerSyncRuns.mockResolvedValue([]);
  adapterMocks.getBrokerSyncIssues.mockResolvedValue([]);
  adapterMocks.getWatchlists.mockResolvedValue([]);
  adapterMocks.getWatchlistsScoped.mockResolvedValue({
    data: [{ id: 1, name: "Theo doi sat", source: "manual", provider: "dnse" }],
  });
  adapterMocks.getDerivedWatchlist.mockResolvedValue({
    account: LINKED,
    items: [{ symbol: "VCB", quantity: 10 }],
  });
}

function renderAtRoute(path: string, ui: React.ReactNode) {
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

describe("ScopedWatchlist mount (watchlist-mount)", () => {
  beforeEach(() => {
    mockAll();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("BrokerAccountPage hien manual theo scope + derived dang-nam-giu", async () => {
    renderAtRoute("/broker/accounts/7", <BrokerAccountPage pollIntervalMs={10} />);
    expect(await screen.findByText("Danh mục theo dõi theo phạm vi")).toBeTruthy();
    expect(await screen.findByText("Danh sách thủ công")).toBeTruthy();
    expect(await screen.findByText(/đang nắm giữ/i)).toBeTruthy();
    expect(adapterMocks.getWatchlistsScoped).toHaveBeenCalled();
  });
});
