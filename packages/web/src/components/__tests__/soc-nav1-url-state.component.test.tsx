/**
 * WAVE 6 / NAV-1 — `uiux-w6-soc`: chứng minh state phân trang của SOC panel
 * **thật sự** đồng bộ hai chiều với URL, không chỉ "dùng hook cho có".
 *
 * Ba hành vi AC (quy tắc A/B/C của slice):
 *   A. URL rông ⇒ giá trị = `useState` default cũ, **và không tự ghi tham số**
 *      (URL sạch, copy link không dính `?…_page=1` thừa).
 *   C. Deep-link `?dnse_jobs_page=3` ⇒ mount ra **đã** ở trang 3 (mất state
 *      sau F5 là bug NAV-1 nói tới).
 *   B. Bấm "Next" ⇒ `useSearchParams` **đổi** (không phải chỉ setState nội bộ).
 *
 * ⚠ Vì sao test này bọc `MemoryRouter`: `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>` — đó chính là blocker chặn 7/11 file của slice,
 * xem `docs/SUMMARY_uiux-w6-soc.md`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

const adapterMocks = vi.hoisted(() => ({
  getDnseBackfillJobs: vi.fn(),
  triggerDnseBackfill: vi.fn(),
}));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  defaultCoreApiAdapter: {
    getDnseBackfillJobs: adapterMocks.getDnseBackfillJobs,
    triggerDnseBackfill: adapterMocks.triggerDnseBackfill,
  },
}));

import { SocDnseBackfillPanel } from "../soc/SocDnseBackfillPanel.js";

/** Đọc `location.search` hiện tại — bằng chứng trực tiếp rằng URL đã đổi. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

/** 25 job / `jobsPageSize = 10` (SocDnseBackfillPanel.tsx:34) ⇒ 3 trang. */
const JOBS = Array.from({ length: 25 }, (_, i) => ({
  id: `job-${i}`,
  status: "done",
  symbol: `SYM-${String(i).padStart(2, "0")}`,
  date: "2026-10-09",
  progress: 100,
  started_at: "2026-10-09T00:00:00Z",
}));

function renderPanel(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <SocDnseBackfillPanel />
    </MemoryRouter>,
  );
}

describe("WAVE 6 / NAV-1 — SocDnseBackfillPanel dong bo phan trang voi URL", () => {
  beforeEach(() => {
    adapterMocks.getDnseBackfillJobs.mockReset();
    adapterMocks.getDnseBackfillJobs.mockResolvedValue({ jobs: JOBS });
  });

  afterEach(() => cleanup());

  // AC-A: default phải y hệt `useState(1)` cũ, và URL rỗng không bị ghi bận.
  it("AC-A — URL rong: hien trang 1 va KHONG ghi them tham so", async () => {
    renderPanel("");

    await waitFor(() => expect(screen.getByText("SYM-00")).toBeTruthy());
    // Trang 1 ⇒ SYM-10 chưa tới.
    expect(screen.queryByText("SYM-10")).toBeNull();
    // Không tham số nào bị ghi thừa khi người dùng chưa chạm vào phân trang.
    expect(currentSearch()).toBe("");
  });

  // AC-C: deep-link — nguyên cái NAV-1 chống ("F5 mất trạng thái").
  it("AC-C — deep-link ?dnse_jobs_page=3: mount ra da o trang 3", async () => {
    renderPanel("?dnse_jobs_page=3");

    await waitFor(() => expect(screen.getByText("SYM-20")).toBeTruthy());
    expect(screen.queryByText("SYM-00")).toBeNull();
    expect(screen.queryByText("SYM-19")).toBeNull();
    expect(screen.getByText("SYM-24")).toBeTruthy();
    expect(currentSearch()).toBe("dnse_jobs_page=3");
  });

  // AC-B: ghi URL — `useSearchParams` thật sự đổi, không chỉ setState nội bộ.
  it("AC-B — bam Next: useSearchParams doi va hien dung trang 2", async () => {
    renderPanel("");

    await waitFor(() => expect(screen.getByText("SYM-00")).toBeTruthy());
    fireEvent.click(screen.getByText("soc.actions.next"));

    await waitFor(() => expect(currentSearch()).toBe("dnse_jobs_page=2"));
    await waitFor(() => expect(screen.getByText("SYM-10")).toBeTruthy());
    expect(screen.queryByText("SYM-00")).toBeNull();
  });
});
