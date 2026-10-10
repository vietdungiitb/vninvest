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
import { MemoryRouter, useNavigationType, useSearchParams } from "react-router-dom";

/**
 * MOCKS REQUIRED (the other 5 imports are real):
 *  1. `@/context/PortfolioContext.js` — `usePortfolio`: auth identity + logout.
 *  2. `@/context/LangContext.js`       — `useI18n`: t/locale/setLanguage.
 *  3. `@/hooks/useCoreQuery.ts`        — needs a QueryClientProvider otherwise.
 *  4. `@/adapters/coreApiAdapter.js`   — `coreApiAdapter.getAlertCenterSummary`.
 */
const h = vi.hoisted(() => ({
  usePortfolio: vi.fn(),
  useI18n: vi.fn(),
  useCoreQuery: vi.fn(),
  getAlertCenterSummary: vi.fn(),
}));

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: h.usePortfolio }));
vi.mock("@/context/LangContext.js", () => ({ useI18n: h.useI18n }));
vi.mock("@/hooks/useCoreQuery.ts", () => ({ useCoreQuery: h.useCoreQuery }));
vi.mock("@/adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { getAlertCenterSummary: h.getAlertCenterSummary },
}));

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

  // Enter navigates AND clears — the clear must propagate back to the URL.
  it("AC-B''' — bam Enter: dieu huong va xoa q khoi URL", async () => {
    renderHeader("?q=vcb");

    expect(searchInput().value).toBe("vcb");
    fireEvent.keyDown(searchInput(), { key: "Enter" });

    await waitFor(() => expect(currentSearch()).toBe(""));
  });
});