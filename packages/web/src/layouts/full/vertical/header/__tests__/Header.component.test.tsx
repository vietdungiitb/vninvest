/**
 * WAVE 10C / NAV-1 — `Header` search box `q` synced to the URL.
 *
 * Source under test: `packages/web/src/layouts/full/vertical/header/Header.tsx:77`
 *   const [searchVal, setSearchVal] = useUrlValue('q', stringCodec, '', { replace: true });
 *
 * Why this file existed at all: `Header.tsx` had **zero** test coverage —
 * grepping the whole test tree for `layouts/full/vertical/header` found nothing.
 * The `useState('') -> useUrlValue(...)` migration therefore shipped unverified,
 * which is exactly the case "suite is green" cannot catch.
 *
 * `Header` is the heavy one to mount. Real imports read from the file, and the
 * mocks actually required are listed in `MOCKS` below — 4 of the 9 imports.
 * The shadcn primitives (`dropdown-menu`, `avatar`, `button`, `input`),
 * `lucide-react`, `@/lib/utils` and `@/lib/runtimeConfig` are deliberately
 * left REAL: they render fine under jsdom, and mocking them would have hidden
 * the very input the test drives.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation, useNavigationType, useSearchParams } from "react-router-dom";

/**
 * MOCKS REQUIRED (the other 4 imports are real):
 *  1. `@/context/PortfolioContext.js`  — `usePortfolio`: auth identity + logout.
 *  2. `@/context/LangContext.js`       — `useI18n`: t/locale/setLanguage.
 *  3. `@/hooks/useCoreQuery.ts`        — needs a QueryClientProvider otherwise.
 *  4. `@/adapters/coreApiAdapter.js`   — `coreApiAdapter.getAlertCenterSummary`.
 *  5. `@/context/RealtimeContext.js`   — `useRealtimeContext`: feed status indicator
 *     (R1, 2026-11-19). Default `null` = mounted without provider, like the 7 legacy tests.
 */
const h = vi.hoisted(() => ({
  usePortfolio: vi.fn(),
  useI18n: vi.fn(),
  useCoreQuery: vi.fn(),
  getAlertCenterSummary: vi.fn(),
  getSymbolList: vi.fn(),
  useRealtimeContext: vi.fn(),
}));

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: h.usePortfolio }));
vi.mock("@/context/LangContext.js", () => ({ useI18n: h.useI18n }));
vi.mock("@/hooks/useCoreQuery.ts", () => ({ useCoreQuery: h.useCoreQuery }));
vi.mock("@/adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { getAlertCenterSummary: h.getAlertCenterSummary, getSymbolList: h.getSymbolList },
}));
vi.mock("@/context/RealtimeContext.js", () => ({ useRealtimeContext: h.useRealtimeContext }));

import { Header } from "../Header";

/** Reads the live query string — the only observable that proves NAV-1. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

/**
 * Reports how the CURRENT entry was reached: `POP` on first mount, then
 * `REPLACE` or `PUSH`.
 *
 * ⚠ `location.key` is NOT a valid discriminator here: `@remix-run/router`
 * mints a fresh key on `replace` too (`getNextLocation` does
 * `key: state?.key ?? createKey()`), so key changes are identical either way.
 * `useNavigationType()` is the honest observable for `{ replace: true }`
 * (`Header.tsx:75-76`) — without it every keystroke would add a history entry
 * and the user would need dozens of Back presses to leave the page.
 */
function NavTypeProbe() {
  return <div data-testid="navType">{useNavigationType()}</div>;
}

function LocationProbe() {
  return <div data-testid="pathname">{useLocation().pathname}</div>;
}

function currentPath(): string {
  return screen.getByTestId("pathname").textContent || "";
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

function currentNavType(): string {
  return screen.getByTestId("navType").textContent || "";
}

const SEARCH_LABEL = "layout.searchPlaceholder";

function renderHeader(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <NavTypeProbe />
      <LocationProbe />
      <Header onMenuClick={vi.fn()} />
    </MemoryRouter>,
  );
}

function searchInput(): HTMLInputElement {
  return screen.getByLabelText(SEARCH_LABEL) as HTMLInputElement;
}

describe("WAVE 10C / NAV-1 — Header o tim ma dong bo hai chieu voi URL", () => {
  beforeEach(() => {
    h.usePortfolio.mockReset();
    h.useI18n.mockReset();
    h.useCoreQuery.mockReset();
    h.getAlertCenterSummary.mockReset();
    h.getSymbolList.mockReset();
    h.useRealtimeContext.mockReset();
    h.useRealtimeContext.mockReturnValue(null); // 7 legacy tests mount without RealtimeProvider
    h.getSymbolList.mockResolvedValue({ results: [{ symbol: "VCB", name: "Ngân hàng TMCP Công thương Việt Nam" }] });

    h.usePortfolio.mockReturnValue({
      userIdentity: { id: 42, username: "nam", email: "nam@example.com", isStaff: false, isSuperuser: false },
      logout: vi.fn().mockResolvedValue(undefined),
      isAuthenticated: true,
    });
    h.useI18n.mockReturnValue({
      t: (key: string) => key,
      locale: "vi",
      setLanguage: vi.fn(),
    });
    h.useCoreQuery.mockReturnValue({ data: null });
    h.getAlertCenterSummary.mockResolvedValue({ unseen: 0 });
  });

  afterEach(() => cleanup());

  // AC-A: default is '' AND the URL stays clean — `stringCodec` must delete the
  // key on the empty string rather than write `?q=`.
  it("AC-A — URL rong: o tim rong va KHONG ghi q", () => {
    renderHeader("");

    expect(searchInput().value).toBe("");
    expect(currentSearch()).toBe("");
  });

  // AC-C: deep-link — reload with `?q=` must restore the search box, else the
  // shared link lands on an empty header and the search looks "lost".
  it("AC-C — deep-link ?q=VCB: o tim khoi phuc dung ma CK", () => {
    renderHeader("?q=VCB");

    expect(searchInput().value).toBe("VCB");
    expect(currentSearch()).toBe("q=VCB");
  });

  // AC-B: typing must move the URL, read back through useSearchParams — not
  // merely component-local state.
  it("AC-B — go chu vao o tim: useSearchParams doi", async () => {
    renderHeader("");

    fireEvent.change(searchInput(), { target: { value: "HPG" } });

    await waitFor(() => expect(currentSearch()).toBe("q=HPG"));
    expect(searchInput().value).toBe("HPG");
  });

  // Clearing back to the default must DELETE the key, keeping shared URLs clean.
  it("AC-B' — xoa het chu: key q bi xoa khoi URL", async () => {
    renderHeader("?q=VCB");

    expect(searchInput().value).toBe("VCB");
    fireEvent.change(searchInput(), { target: { value: "" } });

    await waitFor(() => expect(currentSearch()).toBe(""));
    expect(searchInput().value).toBe("");
  });

  // Guards `{ replace: true }` (`Header.tsx:77`). If it were dropped, `push`
  // would add a history entry per keystroke and the user would need dozens
  // of Back presses to leave the page — the wave-4 bug the comment cites.
  it("AC-B'' — go chu phai REPLACE, khong push tung history entry", async () => {
    renderHeader("");
    expect(currentNavType()).toBe("POP");

    fireEvent.change(searchInput(), { target: { value: "VIC" } });
    await waitFor(() => expect(currentSearch()).toBe("q=VIC"));

    expect(currentNavType()).toBe("REPLACE");
  });

  // P0-1 — Enter must actually REACH /stocks/:symbol. The old test only checked
  // that `q` was cleared, so the setSearchVal('') override swallowed the
  // navigation while the test stayed green.
  it("AC-B''' — bam Enter: dieu huong TAI /stocks/:symbol va xoa q", async () => {
    renderHeader("?q=vcb");

    expect(searchInput().value).toBe("vcb");
    fireEvent.keyDown(searchInput(), { key: "Enter" });

    await waitFor(() => expect(currentPath()).toBe("/stocks/VCB"));
    expect(currentSearch()).toBe("");
  });

  // P0-1 / Q3 — autocomplete dropdown: arrow-down then Enter opens the
  // highlighted suggestion, not the raw text typed in the box.
  it("AC-B'''' — go 2 ky tu: dropdown goi y; ArrowDown + Enter mo ma duoc chon", async () => {
    h.getSymbolList.mockResolvedValueOnce({ results: [{ symbol: "FPT", name: "FPT Corporation" }] });
    renderHeader("");

    fireEvent.change(searchInput(), { target: { value: "FP" } });
    await waitFor(() => expect(screen.getByRole("option", { name: /FPT/ })).toBeTruthy());

    fireEvent.keyDown(searchInput(), { key: "ArrowDown" });
    fireEvent.keyDown(searchInput(), { key: "Enter" });

    await waitFor(() => expect(currentPath()).toBe("/stocks/FPT"));
  });
});

/**
 * R1 (2026-11-19) — header realtime indicator must NOT say "Offline" on a page
 * that simply has no subscribed symbol (e.g. /operations-center?tab=dataops).
 * `realtimeStatus` values come from useRealtimeFeedCore; `disconnected` is a
 * defensive branch only (grep: 0 setRealtimeStatus('disconnected') in prod code).
 *
 * The legacy `t: (key) => key` mock would make these assert on keys; here we
 * deliberately use a translating mock so the assertions prove the real label.
 */
const REALTIME_LABELS_VI: Record<string, string> = {
  "layout.realtime.idle": "Chưa theo dõi",
  "layout.realtime.connecting": "Đang kết nối",
  "layout.realtime.polling": "Dự phòng",
  "layout.realtime.online": "Online",
  "layout.realtime.disconnected": "Offline",
};

function feedWith(status: string, consumerCount = 1) {
  return {
    feed: {
      realtimeStatus: status,
      metrics: { manager: { consumerCount, symbolUnionCount: consumerCount } },
    },
  };
}

function renderWithFeed(feed: unknown) {
  h.useRealtimeContext.mockReturnValue(feed);
  h.useI18n.mockReturnValue({
    t: (key: string, opts?: { defaultValue?: string }) => REALTIME_LABELS_VI[key] ?? opts?.defaultValue ?? key,
    locale: "vi",
    setLanguage: vi.fn(),
  });
  return renderHeader("");
}

function assertIndicator(label: string, dotClass: string) {
  const labelEl = screen.getByText(label);
  const dot = labelEl.previousElementSibling;
  expect(dot, "indicator dot must exist").toBeTruthy();
  expect(dot!.className).toContain(dotClass);
  return labelEl;
}

describe("R1 — Header realtime indicator co 5 trang thai, khong gan nhan Offline sai", () => {
  it("AC0 — khong co RealtimeProvider: trạng thái idle, khong throw, khong hien Offline", () => {
    renderWithFeed(null);

    assertIndicator("Chưa theo dõi", "bg-slate-500");
    expect(screen.queryByText("Offline")).toBeNull();
  });

  it("AC1 — consumerCount=0 (trang SOC khong co symbol): idle + cham xam", () => {
    renderWithFeed(feedWith("idle", 0));

    assertIndicator("Chưa theo dõi", "bg-slate-500");
    expect(screen.queryByText("Offline")).toBeNull();
  });

  it("AC2 — dang ket noi: nhan vang", () => {
    renderWithFeed(feedWith("connecting"));

    assertIndicator("Đang kết nối", "bg-amber-400");
    expect(screen.queryByText("Offline")).toBeNull();
  });

  it("AC3 — polling (fallback hop le): nhan vang Dự phòng", () => {
    renderWithFeed(feedWith("polling"));

    assertIndicator("Dự phòng", "bg-amber-400");
    expect(screen.queryByText("Offline")).toBeNull();
  });

  it("AC4 — live/connected: Online + cham xanh nhap nhay (giu hanh vi cu)", () => {
    renderWithFeed(feedWith("live"));
    assertIndicator("Online", "bg-emerald-400");
    expect(document.querySelector(".live-dot-pulse")).toBeTruthy();
    cleanup();

    renderWithFeed(feedWith("connected"));
    assertIndicator("Online", "bg-emerald-400");
  });

  it("AC5 — disconnected (defensive): chi luc nay moi hien Offline + cham do", () => {
    renderWithFeed(feedWith("disconnected"));

    assertIndicator("Offline", "bg-rose-400");
    expect(screen.queryByText("Chưa theo dõi")).toBeNull();
  });
});
