/**
 * WAVE 10 / NAV-1 — `uiux-w10b-nav1`: `AIAuditLogsPanel` đồng bộ **bộ lọc +
 * phân trang** với URL query.
 *
 * Ba hành vi AC (quy tắc A/B/C của slice), giống `soc-nav1-url-state`:
 *   A. URL rỗng ⇒ hiện trang 1 + filter rỗng, **và URL vẫn rỗng** (không tự
 *      ghi tham số thừa — `intCodec.serialize`/`stringCodec.serialize` trả
 *      `undefined` cho giá trị rỗng ⇒ hook `delete` key).
 *   C. Deep-link `?page=3` ⇒ mount ra **đã** ở trang 3 (đúng cái NAV-1 chống:
 *      F5 mất trạng thái, link gửi cho người khác mở ra sai màn hình).
 *   B. Bấm "Sau" / đổi filter ⇒ `useSearchParams()` **thật sự đổi**, đo bằng
 *      `SearchProbe` — KHÔNG assert state nội bộ của component (proxy observable
 *      vẫn xanh khi tính năng hỏng).
 *
 * ⚠ Vì sao bọc `MemoryRouter`: `useUrlState` → `useSearchParams` → `useLocation()`
 * **throw** ngoài `<Router>` (`useLocation() may be used only in the context of a
 * <Router> component.`).
 *
 * ⚠ Vì sao `t()` trả **key** trừ `auditShowing`: component gọi
 * `t('aiCommandCenter.auditShowing').replace('{page}', …)` — nếu `t` trả key thì
 * `.replace` không thay được gì ⇒ mất mốc quan sát "đang ở trang mấy". Ở đây
 * trả chuỗi placeholder ASCII để assert deterministic, không phụ thuộc dấu
 * tiếng Việt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useSearchParams } from "react-router-dom";

const adapterMocks = vi.hoisted(() => ({ getAIAuditLogs: vi.fn() }));

vi.mock("../../adapters/coreApiAdapter.js", () => ({
  coreApiAdapter: { getAIAuditLogs: adapterMocks.getAIAuditLogs },
}));

vi.mock("../../context/LangContext.js", () => ({
  useI18n: () => ({
    localeTag: "vi-VN",
    t: (k: string) =>
      k === "aiCommandCenter.auditShowing" ? "{total} | P{page}/{totalPages}" : k,
  }),
}));

import { AIAuditLogsPanel } from "../AIAuditLogsPanel.js";

/** Đọc `location.search` hiện tại — bằng chứng trực tiếp rằng URL đã đổi. */
function SearchProbe() {
  const [params] = useSearchParams();
  return <div data-testid="search">{params.toString()}</div>;
}

function currentSearch(): string {
  return screen.getByTestId("search").textContent || "";
}

/**
 * Ô nhập/select của bộ lọc. Component dựng bằng `createElement` không có
 * `data-testid`/`aria-label`, nhưng mỗi field là `<div><label/><input|select/></div>`
 * ⇒ leo từ text của `<label>`.
 */
function fieldByLabel(labelKey: string): HTMLElement {
  const wrap = screen.getByText(labelKey).parentElement as HTMLElement;
  const input = wrap.querySelector("input, select");
  if (!input) throw new Error(`khong tim thay field cho label ${labelKey}`);
  return input as HTMLElement;
}

/** 25 log / `AUDIT_PAGE_SIZE = 10` (AIAuditLogsPanel.tsx:7) ⇒ 3 trang. */
const LOGS = Array.from({ length: 25 }, (_, i) => ({
  id: i,
  action: "custom_action",
  actor: `USER-${String(i).padStart(2, "0")}`,
  reason: "",
  before_json: {},
  after_json: {},
  diff_summary: "",
  created_at: "2026-10-10T00:00:00Z",
}));

function renderPanel(search: string) {
  return render(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <SearchProbe />
      <AIAuditLogsPanel />
    </MemoryRouter>,
  );
}

describe("WAVE 10 / NAV-1 — AIAuditLogsPanel dong bo bo loc + phan trang voi URL", () => {
  beforeEach(() => {
    adapterMocks.getAIAuditLogs.mockReset();
    // BE tra theo `offset`/`limit` — mock cung phai cat theo, neu khong moi
    // "trang 2" van hien trang 1 va test AC-B/AC-C xanh nham.
    adapterMocks.getAIAuditLogs.mockImplementation(({ offset, limit }: { offset: number; limit: number }) =>
      Promise.resolve({ results: LOGS.slice(offset, offset + limit), total: LOGS.length }),
    );
  });

  afterEach(() => cleanup());

  // AC-A: mặc định phải y hệt `useState(1)`/`useState('')` cũ, URL không bị ghi bận.
  it("AC-A — URL rong: hien trang 1 va KHONG ghi them tham so", async () => {
    renderPanel("");

    await waitFor(() => expect(screen.getByText("USER-00")).toBeTruthy());
    // Trang 1 ⇒ 10 log đầu, chưa thấy log của trang 2.
    expect(screen.queryByText("USER-10")).toBeNull();
    expect(screen.getByText("25 | P1/3")).toBeTruthy();
    // Không tham số nào bị ghi thừa khi người dùng chưa chạm vào bộ lọc.
    expect(currentSearch()).toBe("");
    // Filter rỗng ⇒ không gửi `action`/`actor`/`date_from`/`date_to` lên API.
    const params = adapterMocks.getAIAuditLogs.mock.calls.at(-1)?.[0];
    expect(params.action).toBeUndefined();
    expect(params.actor).toBeUndefined();
    expect(params.offset).toBe(0);
  });

  // AC-C: deep-link — nguyên cái NAV-1 chống ("F5 mất trạng thái").
  it("AC-C — deep-link ?page=3: mount ra da o trang 3", async () => {
    renderPanel("?page=3");

    await waitFor(() => expect(screen.getByText("USER-20")).toBeTruthy());
    expect(screen.queryByText("USER-00")).toBeNull();
    expect(screen.queryByText("USER-19")).toBeNull();
    expect(screen.getByText("USER-24")).toBeTruthy();
    expect(screen.getByText("25 | P3/3")).toBeTruthy();
    expect(currentSearch()).toBe("page=3");
  });

  // AC-C (bộ lọc): deep-link filter cũng phải khởi tạo lại, không chỉ phân trang.
  it("AC-C — deep-link ?actor=admin: loc gan vao API va giu nguyen tren URL", async () => {
    renderPanel("?actor=admin");

    await waitFor(() => expect(screen.getByText("USER-00")).toBeTruthy());
    expect(adapterMocks.getAIAuditLogs.mock.calls.at(-1)?.[0].actor).toBe("admin");
    // Ô nhập phải hiện giá trị từ URL (deep-link nhìn thấy được, không chỉ network).
    expect((fieldByLabel("aiCommandCenter.actor") as HTMLInputElement).value).toBe("admin");
    expect(currentSearch()).toBe("actor=admin");
  });

  // AC-B: ghi URL — `useSearchParams` thật sự đổi, không chỉ setState nội bộ.
  it("AC-B — bam 'Sau': useSearchParams doi va hien dung trang 2", async () => {
    renderPanel("");

    await waitFor(() => expect(screen.getByText("USER-00")).toBeTruthy());
    fireEvent.click(screen.getByText("aiCommandCenter.next"));

    await waitFor(() => expect(currentSearch()).toBe("page=2"));
    await waitFor(() => expect(screen.getByText("USER-10")).toBeTruthy());
    expect(screen.queryByText("USER-00")).toBeNull();
    expect(screen.getByText("25 | P2/3")).toBeTruthy();
  });

  // AC-B: đổi filter ⇒ URL đổi theo (và trang bị reset về 1 trong CÙNG một patch).
  it("AC-B — doi filter action: ghi vao URL + ve trang 1", async () => {
    renderPanel("?page=2");

    await waitFor(() => expect(screen.getByText("USER-10")).toBeTruthy());
    fireEvent.change(fieldByLabel("aiCommandCenter.action"), {
      target: { value: "update_settings" },
    });

    await waitFor(() => expect(currentSearch()).toContain("action=update_settings"));
    await waitFor(() => expect(screen.getByText("USER-00")).toBeTruthy());
    expect(adapterMocks.getAIAuditLogs.mock.calls.at(-1)?.[0].action).toBe("update_settings");
  });

  // AC-B: nút Reset phải XOÁ hết tham số (không để lại `?actor=...` cũ).
  it("AC-B — bam 'Xoa bo loc': URL quay ve rong", async () => {
    renderPanel("?action=update_settings&actor=admin&dateFrom=2026-01-01&page=3");

    await waitFor(() => expect(screen.getByText("USER-20")).toBeTruthy());
    fireEvent.click(screen.getByText("aiCommandCenter.resetFilter"));

    await waitFor(() => expect(currentSearch()).toBe(""));
    await waitFor(() => expect(screen.getByText("USER-00")).toBeTruthy());
    expect(screen.getByText("25 | P1/3")).toBeTruthy();
  });
});
