/**
 * WAVE 10 / NAV-1 — `uiux-w10b-nav1`: `useAlertCenterFilters` đồng bộ bộ lọc +
 * sắp xếp + phân trang bảng thống kê với URL query.
 *
 * Ba hành vi AC (quy tắc A/B/C của slice):
 *   A. URL rỗng ⇒ mọi giá trị = mặc định cũ, **và URL vẫn rỗng**.
 *   C. Deep-link `?severity=high,critical&page_stats=3` ⇒ hook đọc ra đúng.
 *   B. Gọi setter/toggle ⇒ `useSearchParams()` **thật sự đổi**, đo bằng
 *      `SearchProbe` — KHÔNG assert state nội bộ (proxy vẫn xanh khi hỏng).
 *
 * AC-4: `symbolDraft` là ô **đang soạn** ⇒ tuyệt đối KHÔNG được ghi URL. Chỉ
 * `appliedSymbol` (sau `applySymbol`) mới là trạng thái đã áp dụng. Test này khoá
 * luôn điều đó — đồng bộ nhầm draft sẽ đẩy 1 history entry cho MỖI ký tự.
 *
 * ⚠ Vì sao bọc `MemoryRouter`: `useUrlState` → `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>`. Đây cũng là blocker chặn
 * `pages/AlertCenterPage.component.test.tsx` (render `<AlertCenterPage />` ~20 lần,
 * không bọc Router) — xem `docs/SUMMARY_uiux-w10b-nav1.md`.
 */
import { describe, it, expect, afterEach } from "vitest";
import { renderHook, act, screen, cleanup } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";
import type { ReactNode } from "react";
import { useAlertCenterFilters } from "../useAlertCenterFilters";

/** Đọc `location.search` hiện tại — bằng chứng trực tiếp rằng URL đã đổi. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

function createWrapper(search: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[`/${search}`]}>
        <SearchProbe />
        {children}
      </MemoryRouter>
    );
  };
}

type Filters = ReturnType<typeof useAlertCenterFilters>;

function renderFilters(search: string) {
  return renderHook(() => useAlertCenterFilters(), { wrapper: createWrapper(search) });
}

/** Gọi 1 action của hook trong `act` để Router flush lại render. */
async function run(f: Filters, action: () => void) {
  await act(async () => {
    action();
  });
}

describe("WAVE 10 / NAV-1 — useAlertCenterFilters dong bo URL", () => {
  afterEach(() => cleanup());

  // AC-A: mặc định phải y hệt `useState` cũ, URL không bị ghi bận.
  it("AC-A — URL rong: gia tri mac dinh va KHONG ghi them tham so", async () => {
    const { result } = renderFilters("");

    expect(result.current.severityFilter).toEqual([]);
    expect(result.current.familyFilter).toEqual([]);
    expect(result.current.sorting).toBe("latest");
    expect(result.current.searchTermStats).toBe("");
    expect(result.current.pageStats).toBe(1);
    expect(result.current.statsSort).toEqual({ key: "count", dir: "desc" });
    expect(currentSearch()).toBe("");

    // AC-4: gõ vào ô đang soạn KHÔNG được chạm URL.
    await run(result.current, () => result.current.setSymbolDraft("HPG"));
    expect(currentSearch()).toBe("");
    expect(result.current.symbolDraft).toBe("HPG");
    expect(result.current.appliedSymbol).toBe("");
  });

  // AC-C: deep-link — nguyên cái NAV-1 chống ("F5 mất trạng thái").
  it("AC-C — deep-link: bo loc, sap xep va phan trang deu khoi tao tu URL", () => {
    const { result } = renderFilters(
      "?severity=high,critical&family=whale&sorting=largestValue&pageStats=3&searchTermStats=abc&statsSortKey=value&statsSortDir=asc",
    );

    expect(result.current.severityFilter).toEqual(["high", "critical"]);
    expect(result.current.familyFilter).toEqual(["whale"]);
    expect(result.current.sorting).toBe("largestValue");
    expect(result.current.pageStats).toBe(3);
    expect(result.current.searchTermStats).toBe("abc");
    expect(result.current.statsSort).toEqual({ key: "value", dir: "asc" });
    // Deep-link không được bị ghi đè lúc mount — URL giữ nguyên.
    expect(currentSearch()).toBe(
      "severity=high%2Ccritical&family=whale&sorting=largestValue&pageStats=3&searchTermStats=abc&statsSortKey=value&statsSortDir=asc",
    );
  });

  // AC-B: toggle bộ lọc ⇒ URL đổi, và trang bị reset về 1 trong CÙNG một patch.
  it("AC-B — toggleSeverity: ghi vao URL + ve trang 1", async () => {
    const { result } = renderFilters("?pageStats=4");

    expect(result.current.pageStats).toBe(4);
    await run(result.current, () => result.current.toggleSeverity("high"));

    expect(result.current.severityFilter).toEqual(["high"]);
    expect(result.current.pageStats).toBe(1);
    expect(currentSearch()).toContain("severity=high");
    // Trang 1 là mặc định ⇒ `pageStats` bị XOÁ khỏi URL, không để lại `?pageStats=1`.
    expect(currentSearch()).not.toContain("pageStats");
  });

  // AC-B: 2 lần toggle ⇒ 2 lần bỏ ⇒ URL sạch trở lại (không để lại `severity=`).
  it("AC-B — toggleSeverity 2 lan: URL quay ve rong", async () => {
    const { result } = renderFilters("");

    await run(result.current, () => result.current.toggleSeverity("high"));
    await run(result.current, () => result.current.toggleSeverity("critical"));
    expect(result.current.severityFilter).toEqual(["high", "critical"]);
    // URL phải mang CẢ HAI giá trị — không phải chỉ giá trị cuối cùng.
    expect(currentSearch()).toContain("severity=high%2Ccritical");

    await run(result.current, () => result.current.toggleSeverity("high"));
    await run(result.current, () => result.current.toggleSeverity("critical"));
    expect(result.current.severityFilter).toEqual([]);
    expect(currentSearch()).toBe("");
  });

  // AC-B: toggleFamily.
  it("AC-B — toggleFamily: ghi vao URL", async () => {
    const { result } = renderFilters("");

    await run(result.current, () => result.current.toggleFamily("whale"));

    expect(result.current.familyFilter).toEqual(["whale"]);
    expect(currentSearch()).toContain("family=whale");
  });

  // AC-B: đổi chiều sắp xếp bảng thống kê.
  it("AC-B — cycleStatsSort: ghi key va huong vao URL", async () => {
    const { result } = renderFilters("?pageStats=5");

    await run(result.current, () => result.current.cycleStatsSort("value"));
    expect(result.current.statsSort).toEqual({ key: "value", dir: "desc" });
    expect(currentSearch()).toContain("statsSortKey=value");
    expect(result.current.pageStats).toBe(1);

    // Bấm lại cùng key ⇒ đảo chiều.
    await run(result.current, () => result.current.cycleStatsSort("value"));
    expect(result.current.statsSort).toEqual({ key: "value", dir: "asc" });
    expect(currentSearch()).toContain("statsSortDir=asc");
  });

  // AC-B: sắp xếp feed (2 giá trị) + ô tìm kiếm + phân trang bảng thống kê.
  it("AC-B — setSorting / setSearchTermStats / setPageStats: deu ghi vao URL", async () => {
    const { result } = renderFilters("");

    await run(result.current, () => result.current.setSorting("largestValue"));
    expect(currentSearch()).toContain("sorting=largestValue");

    await run(result.current, () => result.current.setSearchTermStats("HPG"));
    expect(currentSearch()).toContain("searchTermStats=HPG");

    await run(result.current, () => result.current.setPageStats(3));
    expect(currentSearch()).toContain("pageStats=3");
  });

  // AC-B: nút Xoá bộ lọc phải xoá hết tham số liên quan.
  it("AC-B — clearFilters: xoa het tham so bo loc", async () => {
    const { result } = renderFilters("?severity=high&family=whale&pageStats=3");

    await run(result.current, () => result.current.clearFilters());

    expect(result.current.severityFilter).toEqual([]);
    expect(result.current.familyFilter).toEqual([]);
    expect(result.current.pageStats).toBe(1);
    expect(currentSearch()).toBe("");
  });

  // AC-4 (chiều ngược lại): ô soạn KHÔNG vào URL, nhưng Apply thì CÓ.
  it("AC-4 — symbolDraft khong vao URL, chi appliedSymbol moi vao", async () => {
    const { result } = renderFilters("");

    await run(result.current, () => result.current.setSymbolDraft(" hpg "));
    expect(currentSearch()).toBe("");

    await run(result.current, () => result.current.applySymbol({ preventDefault() {} } as never));
    expect(result.current.appliedSymbol).toBe("HPG");
    expect(result.current.pageStats).toBe(1);
    // ⚠ WAVE 11: assertion cu la `expect(currentSearch()).toBe("")` — khi do
    // `appliedSymbol` con la `useState` local va `AlertCenterPage` TU GHI
    // `?symbol=`. Bai nay chuyen `appliedSymbol` vao `useUrlState` (xem
    // `useAlertCenterFilters.ts`) nen Apply **phai** ghi URL — neu khong, xoa
    // 2 effect cu cua `AlertCenterPage` se lam mat deep-link `?symbol=VIC`.
    // Day la doi spec CO Y, khong phai test "cho xanh".
    expect(currentSearch()).toBe("symbol=HPG");
  });

  // WAVE 11 — deep-link 4 truong URL cu: `lane` · `symbol` · `timeframe` ·
  // `session_date`. Chúng duoc 2 effect cu cua `AlertCenterPage` doc/ghi bang
  // tay; bo 2 effect do thi hook phai so huu chung.
  it("WAVE 11 — deep-link lane/symbol/timeframe/session_date", () => {
    const { result } = renderFilters("?lane=ai&symbol=vic&timeframe=1h&session_date=2026-09-18");

    expect(result.current.lane).toBe("ai");
    expect(result.current.appliedSymbol).toBe("VIC");
    expect(result.current.timeframe).toBe("1h");
    expect(result.current.sessionDate).toBe("2026-09-18");
    // O nhap phai HIEN thi symbol tu deep-link (khong de nguoi dung thay minh
    // co loc ma khong thay dau gi).
    expect(result.current.symbolDraft).toBe("VIC");
  });

  // WAVE 11 — 2 setter lien tiep trong MOT handler phai compose.
  // Do 2026-10-10: 2 `setParams` trong cung tick KHONG compose (`?b=2` mat `a`).
  it("WAVE 11 — setLane + setSessionDate + resetStatsPage trong 1 tick: ca 3 deu con", async () => {
    const { result } = renderFilters("?lane=main&session_date=2026-09-18&pageStats=7");

    await run(result.current, () => {
      result.current.setLane("ai");
      result.current.resetStatsPage();
      result.current.setSessionDate("");
    });

    expect(result.current.lane).toBe("ai");
    expect(result.current.sessionDate).toBe("");
    expect(result.current.pageStats).toBe(1);
    // `session_date` rong + `pageStats=1` la mac dinh ⇒ ca hai phai bi XOA.
    expect(currentSearch()).toBe("lane=ai");
  });

  // WAVE 11 — toggle 2 gia trong cung mot tick (vong `for` cu cua AlertCenterPage).
  it("WAVE 11 — toggleSeverity x2 trong 1 tick: giu ca 2 gia tri", async () => {
    const { result } = renderFilters("");

    await run(result.current, () => {
      result.current.toggleSeverity("high");
      result.current.toggleSeverity("critical");
    });

    expect(result.current.severityFilter).toEqual(["high", "critical"]);
    expect(currentSearch()).toContain("severity=high%2Ccritical");
  });

  // WAVE 11 — URL do nguoi sua tay khong duoc bien thanh gia tri sai.
  it("WAVE 11 — URL sai gia tri bi bo qua, khong render ban sai", () => {
    const { result } = renderFilters("?lane=hack&timeframe=99y&session_date=abc");

    expect(result.current.lane).toBe("main");
    expect(result.current.timeframe).toBe("session");
    expect(result.current.sessionDate).toBe("");
  });
});
