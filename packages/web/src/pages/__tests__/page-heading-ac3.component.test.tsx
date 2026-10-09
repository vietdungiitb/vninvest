/**
 * AC-3 (W3-3a) — 6 route ĐÃ CÓ `<h1>` phải giữ **đúng 1**, và giờ **có test phòng thủ**.
 *
 * Bối cảnh: `page-heading-fu02c.component.test.tsx:214-225` ghi lại 6 route này
 * ("AC-3 phủ 8/14") là **đã có 1 h1 nhưng chưa được bảo vệ** — mỗi lần thử test
 * thì **không render ổn định trong jsdom**. Tài liệu cũ đúng về hiện tượng, sai về
 * nguyên nhân: không phải "cây provider khác nhau" mà là **thiếu provider** +
 * **thiếu mock adapter** cho các nhánh `return` sớm không có `<h1>`.
 *
 * Ba điều bắt buộc trong file này:
 *
 * 1. **`toHaveLength(1)`, KHÔNG `toBeLessThanOrEqual(1)`.** `≤1` cũng **pass khi 0
 *    h1** ⇒ AC mà không bắt được lỗi "mất h1" (audit Stage 5, M-3).
 * 2. **`await import()` ở MODULE SCOPE.** Import trong thân test bị tính vào
 *    timeout của test đó; đo được 27.5 s > timeout 20 s khi chạy chung với
 *    100+ file, trong khi chạy riêng chỉ mất 8 s (`page-heading-fu02c...:100-112`).
 * 3. **Mock đặt ở module scope**, không dùng `vi.doMock` trong thân test — cùng lý
 *    do: mock động sẽ kéo dynamic import vào budget của test.
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { renderRoutePage } from "./render-route-page";

// ── Mock tĩnh ở module scope (AC-2.4) ───────────────────────────────────────
//
// `vi.mock` bị vitest hoist lên đầu file, nên **không được** tham chiếu biến
// khai báo ở thân module trong factory — factory chạy lúc module con được import
// (trước khi các `const` khai sau khai báo được). Vì vậy payload mock nằm ngay
// trong factory. `vi.hoisted` chỉ dùng cho 1 biến thật sự cần đọc từ test body.

const stock = vi.hoisted(() => ({ model: {} as Record<string, unknown> }));

/**
 * 4 trang tự có `e("h1", …)` trong file, 2 trang lấy h1 qua component con.
 * `coreApiAdapter.js:170` — `export const coreApiAdapter = defaultCoreApiAdapter`
 * là **binding riêng**: chỉ override `defaultCoreApiAdapter` (như
 * `page-heading-fu02c...:69-81` làm) thì `coreApiAdapter` vẫn trỏ tới object thật
 * ⇒ `TransactionsPage`/`UserSettingsPage`/`SupportPage` vẫn gọi mạng thật.
 * Phải override **cả hai**.
 */
vi.mock("../../adapters/coreApiAdapter.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../adapters/coreApiAdapter.js");
  const merged = {
    ...(actual.defaultCoreApiAdapter as object),
    // TransactionsPage.tsx:67 — `usePortfolios`; `TransactionsPage.tsx:185` rơi
    // vào nhánh "chưa có danh mục" **không có `<h1>`** nếu trả rỗng.
    getPortfolios: vi.fn().mockResolvedValue({ results: [{ id: 1, name: "P" }] }),
    // TransactionsPage.tsx:104
    getTransactions: vi.fn().mockResolvedValue({ results: [] }),
    // UserSettingsPage.tsx:68 — `UserSettingsPage.tsx:170` return sớm khi `loading`
    // và `:174` return sớm khi `error`; **cả hai đều không có `<h1>`**.
    getUserProfile: vi.fn().mockResolvedValue({
      id: 7, username: "tester", email: "tester@example.com",
      display_name: "Tester", avatar_url: "", language: "vi", theme: "light",
      whale_alert_threshold: "500", is_staff: false, is_superuser: false,
    }),
    updateUserProfile: vi.fn().mockResolvedValue({}),
    changeUserPassword: vi.fn().mockResolvedValue({}),
    // BrokerSettingsSection.tsx:93/:106-107 (sau UserSettingsPage.tsx:5)
    getBrokerProviders: vi.fn().mockResolvedValue({ providers: [] }),
    getBrokerSchema: vi.fn().mockResolvedValue({
      provider: "dnse", test_connection_kind: "dnse", fields: [],
    }),
    getBrokerConfig: vi.fn().mockResolvedValue({
      is_configured: false, provider: "dnse", status: "inactive", preview: {},
    }),
    // SupportPage.tsx:81/:88/:121/:139
    listSupportTickets: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    listStaffSupportTickets: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    getSupportTicketDetail: vi.fn().mockResolvedValue({ messages: { results: [] } }),
    getStaffSupportDashboard: vi.fn().mockResolvedValue({}),
    createSupportTicket: vi.fn().mockResolvedValue({}),
    replySupportTicket: vi.fn().mockResolvedValue({}),
    replyStaffSupportTicket: vi.fn().mockResolvedValue({}),
    patchStaffSupportTicket: vi.fn().mockResolvedValue({}),
    reopenSupportTicket: vi.fn().mockResolvedValue({}),
    // StockDetailPage.tsx:145/:156/:186-187
    getWatchlists: vi.fn().mockResolvedValue({ results: [] }),
    getWatchlistItems: vi.fn().mockResolvedValue({ results: [] }),
    addWatchlistItem: vi.fn().mockResolvedValue({}),
    removeWatchlistItem: vi.fn().mockResolvedValue({}),
  };
  return {
    ...actual,
    defaultCoreApiAdapter: merged,
    coreApiAdapter: merged,
    // StockDetailPage.tsx:14 gọi ở **module scope**, nên factory phải sẵn sàng
    // trước khi `ShellStockDetailPage` được import.
    createCoreApiAdapter: vi.fn(() => merged),
  };
});

/**
 * `useWhaleAdvisoryData.js:327-331` có `setInterval(fetchWhaleStats, 60000)` và
 * gọi adapter ngay khi mount ⇒ giữ timer sống và bắn mạng. Thay bằng shape rỗng
 * đúng như `WhaleAdvisoryPage.tsx:135-145` destructure (giữ `...actual` để 3
 * export khác — `normalizeAdvisoryItem`… — không vỡ chỗ khác đang import).
 */
vi.mock("../../hooks/useWhaleAdvisoryData.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("../../hooks/useWhaleAdvisoryData.js");
  return {
    ...actual,
    useWhaleAdvisoryData: vi.fn(() => ({
      items: [], loading: false, error: null,
      symbolStats: [], statsLoading: false,
      globalMatches: [], globalSearchLoading: false, globalSearchError: null,
      searchGlobalSymbols: vi.fn(), refreshInfoMap: {}, refreshInfoErrors: {},
      pendingRefreshSymbols: {}, pendingDeleteSymbols: {}, rowMessages: {},
      fetchData: vi.fn(), loadRefreshInfo: vi.fn(),
      handleRefreshAdvisory: vi.fn(), handleDeleteAdvisory: vi.fn(),
    })),
  };
});

// Model của `/stocks/:symbol` — `StockDetailPage.tsx:5` là consumer duy nhất
// trong cây này. `loadingBlocking: false` ⇒ chạy tới nhánh settled, tức là nhánh
// **có** `StockDetailHeader.js:76` render h1 thứ hai trước khi sửa.
vi.mock("../../features/stock-detail/hooks/useStockDetailPageModel.js", () => ({
  useStockDetailPageModel: vi.fn(() => stock.model),
}));

vi.mock("../../components/workstation/hooks/index.js", () => ({
  useOrderBook: vi.fn(() => ({ orderBook: null, loading: false, error: null, refresh: vi.fn() })),
  useTradeLog: vi.fn(() => ({ trades: [], loading: false, error: null, refresh: vi.fn() })),
}));

// 2 panel chart là code nặng (echarts) — thay bằng stub cho đúng mục tiêu đếm h1.
vi.mock("../../components/VNStockChartPanel.js", () => ({
  default: () => null,
}));
vi.mock("../../components/WhaleBubbleChart.jsx", () => ({
  default: () => null,
}));

// ── Nạp page ở MODULE SCOPE (AC-2.4) ────────────────────────────────────────
const SupportPage = (await import("../SupportPage")).SupportPage;
const TransactionsPage = (await import("../TransactionsPage")).TransactionsPage;
const UserSettingsPage = (await import("../UserSettingsPage")).UserSettingsPage;
const UpgradePage = (await import("../UpgradePage")).default;
const ShellStockDetailPage = (await import("../market/ShellStockDetailPage.js")).ShellStockDetailPage;
const WhaleAdvisoryPage = (await import("../signals/WhaleAdvisoryPage")).WhaleAdvisoryPage;

afterEach(cleanup);

/** Đếm `<h1>` **thật** trong DOM — role `heading` level 1, không phải grep. */
function countH1() {
  return screen.queryAllByRole("heading", { level: 1 });
}

function stockDetailModel() {
  return {
    activeTimeframe: "1D",
    setActiveTimeframe: vi.fn(),
    activePeriod: "1M",
    setActivePeriod: vi.fn(),
    selectedSession: null,
    setSelectedSession: vi.fn(),
    setVisibleRange: vi.fn(),
    loadingBlocking: false,
    loadingDeferred: false,
    error: null,
    profile: { company_name: "TPBank", exchange: "HOSE", industry: "Bank" },
    snapshot: {
      symbol: "TPB", current_price: 18000, reference_price: 17500,
      change_value: 500, change_pct: 2.85, ceiling_price: 18700,
      floor_price: 16300, open_price: 17600, high_price: 18200,
      low_price: 17400, volume: 1200000, stale: false,
    },
    setChartBars: vi.fn(),
    orderFlowData: null,
    advisory: null,
    advisoryFallbackFlags: null,
    whaleFeed: [],
    whaleFeedMeta: { next_cursor: null, has_more: false },
    loadMoreWhaleFeed: vi.fn(),
    news: [],
    financials: null,
    loadingNews: false,
    loadingFinancials: false,
    activeTab: "giao-dich",
    setActiveTab: vi.fn(),
    loadingProfile: false,
    refreshAdvisoryData: vi.fn(),
    loadBlocking: vi.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AC-3 — 6 route đã có h1, KHÔNG được thêm lần nữa và KHÔNG được mất.
// Nguồn h1 (đã tự dò, không tin tài liệu):
//   SupportPage.tsx:311 · TransactionsPage.tsx:194 · UserSettingsPage.tsx:182
//   UpgradePage.tsx:54                                    — tự render e("h1", …)
//   ShellStockDetailPage → WorkstationShell.tsx:53         — component con
//   WhaleAdvisoryPage → WhaleAdvisoryBentoHeader.js:44     — component con
// ═══════════════════════════════════════════════════════════════════════════

describe("AC-3 — 6 route chỉ được có ĐÚNG 1 h1", () => {
  test("SupportPage (/support) — h1 ngay trong file, SupportPage.tsx:311", () => {
    renderRoutePage({ Component: SupportPage, routePath: "/support" });
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  test("UpgradePage (/upgrade) — h1 ngay trong file, UpgradePage.tsx:54", () => {
    renderRoutePage({ Component: UpgradePage, routePath: "/upgrade" });
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  test("WhaleAdvisoryPage (/ai-advisory) — h1 do WhaleAdvisoryBentoHeader.js:44 render", () => {
    renderRoutePage({ Component: WhaleAdvisoryPage, routePath: "/ai-advisory" });
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  // 2 trang dưới đây có nhánh `return` sớm **không có `<h1>`**, nên bắt buộc
  // `waitFor` — assert đồng bộ ngay sau render sẽ thấy 0 (đây chính là lý do
  // 6 route này bị bỏ trống trước đây).
  test("TransactionsPage (/transactions) — nhánh loading/empty không có h1, TransactionsPage.tsx:181/185", async () => {
    renderRoutePage({ Component: TransactionsPage, routePath: "/transactions" });
    await waitFor(() => {
      expect(countH1()).toHaveLength(1);
    }, { timeout: 4000 });
    const h1 = countH1();
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  test("UserSettingsPage (/settings) — nhánh loading/error không có h1, UserSettingsPage.tsx:170/174", async () => {
    renderRoutePage({ Component: UserSettingsPage, routePath: "/settings" });
    await waitFor(() => {
      expect(countH1()).toHaveLength(1);
    }, { timeout: 4000 });
    const h1 = countH1();
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  // Route này **từng render 2 `<h1>`** (AC-2.3): `WorkstationShell.tsx:53` cho
  // h1 tiêu đề trang, `StockDetailHeader.js:76` cho h1 tên công ty. Test này là
  // hàng rào bắt lỗi đó quay lại — nếu ai đó đổi `h2` ở `StockDetailHeader.js:76`
  // về `h1`, case này đỏ.
  test("ShellStockDetailPage (/stocks/:symbol) — WorkstationShell.tsx:53 là h1 DUY NHẤT", () => {
    stock.model = stockDetailModel();
    // `ShellStockDetailPage.js:21-25` đọc `window.location.pathname` (không có
    // prop khi route thật render, `main.tsx:181`) ⇒ phải đặt URL thật của jsdom.
    window.history.replaceState(null, "", "/stocks/TPB");
    renderRoutePage({
      Component: ShellStockDetailPage,
      routePath: "/stocks/:symbol",
      entry: "/stocks/TPB",
    });
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim()).toBe("TPB");
    // Hạ tiêu đề vẫn còn, chỉ là `h2` — `StockDetailPage.css:150` set đủ
    // margin/font-size/font-weight/color/line-height nên không đổi hiển thị.
    expect(screen.queryByRole("heading", { level: 2, name: "TPBank" })).toBeTruthy();
    window.history.replaceState(null, "", "/");
  }, 20000);
});
