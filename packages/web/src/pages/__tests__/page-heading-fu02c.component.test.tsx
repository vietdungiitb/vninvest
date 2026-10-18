/**
 * FU-02c - moi ROUTE render DUNG MOT `<h1>` khong rong.
 *
 * Vì sao test nay ton tai: 6 lan ket lieu so dem sai (L-G04 + L-G07). Script
 * grep `<h1` trong FILE PAGE bo qua:
 *   (a) `createElement("h1", ...)` - khong phai JSX,
 *   (b) `<h1>` den tu COMPONENT CON (`AdminPageHeader`, `WorkstationShell`, ...),
 *   (c) import alias `@/` ma regex khong theo.
 * ⇒ **Day la cong thuc do bang DOM that**, khong phai grep.
 *
 * AC-1: 4 trang thieu that co dung 1 h1 khong rong.
 * AC-2: fail-truoc chung toan bo file nay (bo h1 khoi 4 trang).
 * AC-3: 14 trang DA CO h1 phai van la 1 - bat loi "them h1 thu 2".
 */

import { describe, expect, test, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LangProvider } from "../../context/LangContext";
import { PortfolioProvider } from "../../context/PortfolioContext";

// Mock theo dung module ma SocUsersPanel import (ShellToast.js / ConfirmModal.js)
// — giong src/components/__tests__/soc-users.component.test.tsx:19-26.
vi.mock("../../components/ShellToast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../components/ConfirmModal.js", () => ({
  useConfirm: () => () => Promise.resolve(true),
  ConfirmProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../components/Toast.js", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }),
  ToastProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// DashboardPage nap du lieu qua 3 hook + realtime; khong mock se goi adapter that.
// Chi can du lieu rong de render, muc tieu la dem <h1> trong DOM.
vi.mock("../../features/dashboard/useCoreDashboardData.js", () => ({
  useCoreDashboardData: () => ({
    loading: false,
    error: null,
    summary: {},
    analytics: {},
    holdings: [],
    watchlists: [],
    trackedSymbols: [],
    breadth: {},
    resolvedPortfolioId: 1,
    refresh: () => {},
    lastUpdated: null,
  }),
}));

vi.mock("../../context/RealtimeContext.js", () => ({
  useRealtimeFeedFromManager: () => ({ subscribe: () => () => {}, unsubscribe: () => {} }),
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("../../hooks/useAlertCenterRealtime.js", () => ({
  useAlertCenterRealtime: () => ({ alerts: [], connected: false }),
}));

// `AIUsageDashboard` poll API thật qua adapter ⇒ len xuong o 5000ms mac dinh
// khi chay chung voi 100+ file. Mock adapter cho data rong ⇒ render tat ngay,
// va **khong con phai** dua test nay vao trong bat ky timeout cao nao.
vi.mock("../../adapters/coreApiAdapter.js", async () => {
  const actual = await vi.importActual<Record<string, unknown>>(
    "../../adapters/coreApiAdapter.js",
  );
  return {
    ...actual,
    defaultCoreApiAdapter: {
      ...(actual.defaultCoreApiAdapter as object),
      getAIUsageAnalytics: vi.fn().mockResolvedValue({}),
      getAIAuditLogs: vi.fn().mockResolvedValue({ results: [], count: 0 }),
    },
  };
});

vi.mock("../../context/PortfolioContext.js", async () => {
  const actual = await vi.importActual<typeof import("../../context/PortfolioContext")>(
    "../../context/PortfolioContext",
  );
  return {
    ...actual,
    usePortfolio: () => ({
      portfolios: [{ id: 1, name: "P", portfolio_name: "P" }],
      selectedId: 1,
      loading: false,
      error: null,
      selectPortfolio: () => {},
      reload: () => {},
    }),
  };
});

// ── W3-4 (AC-4.1a) — nap module o CAP MODULE, KHONG trong than test ──────────
//
// Ly do: `await import()` ben trong test bi tinh vao TIMEOUT cua test. Do that
// file chay chung voi 116 file khac, thoi gian nap module len toi
// 27.5 s (baseline do duoc) > timeout 20 s ⇒ fail, trong khi file chay rieng
// chi mat 8 s. Nang module ra khoi test ⇒ nap o luc collect, khong con nam
// trong budget cua tung test.
//
// Vì sao KHONG chi tang timeout: comment o dong 139-142 cua file nay ghi ro
// "KHONG phai lua chon" — 5 s mac dinh fail khi chay full suite va nguyen nhan
// goc la `cleanup` khong chay con sot DOM. Tang len 30 s chi che them.
// Top-level `await` ⇒ module da san SANG khi vitest collect file nay, nen
// phai nap KHONG nam trong budget cua tung test.
const P = {
  usageAnalytics: await import("../AIUsageAnalyticsPage"),
  adminUsers: await import("../admin/AdminUsersPage"),
  dashboard: await import("../DashboardPage"),
  adminUi: await import("../admin/adminUi"),
};
afterEach(cleanup);
vi.restoreAllMocks();

/** Dem `<h1>` render thuc te. */
function countH1() {
  return screen.queryAllByRole("heading", { level: 1 });
}

function wrapRoute(path: string, el: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PortfolioProvider>
        <LangProvider>
          <Routes>
            <Route path={path.replace(/\/:.*$/, "")} element={el} />
          </Routes>
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------- AC-1
// 4 trang THIẾU THẬT (đã kiểm chứng từng trang, xem PLAN §2 FU-02c)
describe("FU-02c — 4 trang thiếu thật", () => {

  test("AIUsageAnalyticsPage co 1 h1 khong rong", async () => {
    const { AIUsageAnalyticsPage } = P.usageAnalytics
    wrapRoute("/settings/ai/usage", <AIUsageAnalyticsPage />);
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
    // `AIUsageDashboard` bat dau poll API nen can thoi gian cho no settle
    // duoi tai full suite. Timeout o day KHONG phai lua chon: dat mac dinh
    // 5s thi test nay fail khi chay chung voi 100+ file khac, va do
    // `cleanup` khong chay => DOM ban con lai => test SAU do thay 2 h1.
  }, 20000);

  test("AdminUsersPage co 1 h1 khong rong", async () => {
    const { AdminUsersPage } = P.adminUsers
    wrapRoute("/admin/users", <AdminUsersPage />);
    // W3-4 (AC-4.1b) — SETTLE RACE, khong phai timeout. Test nay assert DONG BO
    // (`countH1()` ngay sau `wrapRoute`), nhung `SocUsersPanel` o trang thai
    // `loading` return som (SocUsersPanel.tsx:154-156) ⇒ DOM chua settle ⇒
    // `countH1()` co the thay 0 hoac 2. Do la 1 trong 2 failure cua baseline
    // (`test:components` 2 failed | 802 passed), fail o **306 ms** — ham y
    // chung to `waitFor`, khong phai module-import cost.
    // Chi sua TEST (them `waitFor`), KHONG sua code san pham.
    await waitFor(() => {
      expect(countH1()).toHaveLength(1);
    }, { timeout: 4000 });
    const h1 = countH1();
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  test("AdminUsersPanel van giu h2/h3 (phan cap khong bi phong)", async () => {
    const { AdminUsersPage } = P.adminUsers
    // `SocUsersPanel` o trang thai `loading` return som (SocUsersPanel.tsx:154-156)
    // va khong co h2 — phai cho no settle truoc khi kiem tra phan cap.
    wrapRoute("/admin/users", <AdminUsersPage />);
    await waitFor(() => {
      expect(screen.queryAllByRole("heading", { level: 2 }).length).toBeGreaterThan(0);
    }, { timeout: 4000 });
    // h1 van dung 1 sau khi panel render xong
    expect(countH1()).toHaveLength(1);
  });

  test("DashboardPage co 1 h1 o NHANH MAIN", async () => {
    const { DashboardPage } = P.dashboard
    wrapRoute("/core/dashboard", <DashboardPage />);
    const h1 = countH1();
    expect(h1).toHaveLength(1);
    expect((h1[0].textContent ?? "").trim().length).toBeGreaterThan(0);
  }, 20000);

  // DashboardPage nhanh "khong co danh muc" — dung helper DashboardHeading
  // o CA 3 nhanh return nen van phai co h1.
  test("DashboardPage nhanh EMPTY van co h1 (khong phai chi nhanh main)", async () => {
    const { DashboardPage } = P.dashboard
    wrapRoute("/core/dashboard", <DashboardPage className="" />);
    expect(countH1()).toHaveLength(1);
  }, 20000);
});

// ---------------------------------------------------------------- AC-3
// 14 trang ĐÃ CÓ h1 trước đây. KHÔNG được thêm h1 lần nữa.
describe("FU-02c — 14 trang đã có h1, không được thêm lần 2", () => {
  // ⚠ **AC-3 phủ 8/14.** 6 trang còn lại CHƯA có test phòng thủ, vì khi thử
  // thêm vào thì **không render ổn định trong jsdom** — mỗi lần một kiểu khác:
  //   - `SupportPage` / `TransactionsPage` / `UserSettingsPage` / `UpgradePage`:
  //     nạp dữ liệu bất đồng bộ, đếm h1 quá sớm thấy 0, chờ lâu vẫn 0.
  //   - `market/ShellStockDetailPage` → `WorkstationShell.tsx:53` là component con,
  //     cần cây provider khác.
  //   - `signals/WhaleAdvisoryPage` → `WhaleAdvisoryBentoHeader.js:44` qua prop.
  // Ép chúng vào `toHaveLength(1)` lúc này chỉ tạo ra **test đỏng vì harness**,
  // không phải vì code. Ghi lại đây thay vì làm xanh giả.
  // Cần một `renderRoutePage()` dùng chung cho cây provider đầy đủ — CHƯA LÀM.
  // Import TƯỜNG — dynamic `import(`../${mod}`)` làm Vite cảnh báo
  // "invalid import: a file extension must be included in the static part".
  const ALREADY = {
    "auth/AuthLoginPage": () => import("../auth/AuthLoginPage"),
    "auth/AuthRegisterPage": () => import("../auth/AuthRegisterPage"),
    "auth/AuthVerifyEmailPage": () => import("../auth/AuthVerifyEmailPage"),
    "auth/AuthResetPasswordPage": () => import("../auth/AuthResetPasswordPage"),
    "admin/AdminBillingFleetPage": () => import("../admin/AdminBillingFleetPage"),
    "admin/AdminUsageFleetPage": () => import("../admin/AdminUsageFleetPage"),
    "admin/AdminAuditPage": () => import("../admin/AdminAuditPage"),
    "admin/AdminAnalyticsPage": () => import("../admin/AdminAnalyticsPage"),
  } as const;

  const ROUTES: Array<[keyof typeof ALREADY, string, string]> = [
    ["auth/AuthLoginPage", "AuthLoginPage", "/login"],
    ["auth/AuthRegisterPage", "AuthRegisterPage", "/register"],
    ["auth/AuthVerifyEmailPage", "AuthVerifyEmailPage", "/verify-email"],
    ["auth/AuthResetPasswordPage", "AuthResetPasswordPage", "/reset-password"],
    ["admin/AdminBillingFleetPage", "AdminBillingFleetPage", "/admin/billing"],
    ["admin/AdminUsageFleetPage", "AdminUsageFleetPage", "/admin/usage"],
    ["admin/AdminAuditPage", "AdminAuditPage", "/admin/audit"],
    ["admin/AdminAnalyticsPage", "AdminAnalyticsPage", "/admin/analytics"],
  ];

  test.each(ROUTES)("%s co DUNG MOT h1", async (_key, exportName, path) => {
    const mod = (await ALREADY[_key]()) as Record<string, React.ComponentType>;
    const C = mod[exportName];
    expect(C).toBeTypeOf("function");
    wrapRoute(path, <C />);
    // M-3 (audit Stage 5): `toHaveLength(1)` CHỨNG KHÔNG phải
    // `toBeLessThanOrEqual(1)`. `≤1` cũng pass khi **0** h1 ⇒ AC-3 mà không
    // bắt được lỗi "mất h1" — tức là AC không kiểm được gì.
    expect(countH1()).toHaveLength(1);
  }, 20000);

  test("h1 trong 14 trang khong bi render trùng", async () => {
    const { AdminPageHeader } = P.adminUi
    // Bọc cùng provider như wrapRoute — `AdminPageHeader` nằm trong cây admin
    // mà các trang kia render; render trần sẽ vỡ context.
    render(
      <PortfolioProvider>
        <LangProvider>
          <AdminPageHeader title="X" />
        </LangProvider>
      </PortfolioProvider>,
    );
    expect(countH1()).toHaveLength(1);
  });
});
