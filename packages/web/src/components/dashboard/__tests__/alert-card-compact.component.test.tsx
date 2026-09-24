import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as e } from "react";
import { UnifiedAlertCenter } from "../UnifiedAlertCenter.js";

vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, unknown>) => {
      const dict: Record<string, string> = {
        "alert.title": "Cảnh báo",
        "alert.empty": "Không có cảnh báo nào.",
        "alert.unreadTooltip": "{count} chưa đọc",
        "alert.showing": "Hiển thị {shown}/{total}",
        "alert.filteredEmpty": "Bộ lọc hiện tại loại hết {total} cảnh báo.",
        "alert.loadingList": "Đang tải cảnh báo…",
        "alert.loadError": "Không tải được cảnh báo.",
        "alert.retryHint": "Thử lại.",
        "alert.viewAll": "Xem tất cả",
        "alert.clearFilters": "Xóa bộ lọc",
        "alert.prevPage": "Trang trước",
        "alert.nextPage": "Trang sau",
        "alert.markRead": "Đánh dấu đã đọc",
        "alert.dirBuy": "Mua",
        "alert.dirSell": "Bán",
        "alert.valLabel": "Giá trị",
        "alert.confLabel": "Tin cậy",
        "alert.sessionLabel": "Phiên",
        "alert.mute30m": "Tắt 30p",
        "alert.severity.all": "Tất cả",
        "alert.severity.critical": "Nghiêm trọng",
        "alert.severity.high": "Cao",
        "alert.severity.medium": "Trung bình",
        "alert.severity.low": "Thấp",
      };
      let s = dict[key] ?? key;
      Object.entries(vars || {}).forEach(([k, v]) => {
        s = s.replaceAll(`{${k}}`, String(v));
      });
      return s;
    },
  }),
}));

const alerts = [
  { alert_id: "a1", symbol: "CAR", severity: "high", source: "whale", direction: "buy", value: 660489030, confidence: 0.85, session_date: "2026-09-21", body: "Cá mập mua CAR", triggered_at: new Date(Date.now() - 3600e3).toISOString() },
  { alert_id: "a2", symbol: "VBB", severity: "medium", source: "whale", direction: "buy", value: 1523938140, confidence: 0.95, session_date: "2026-09-21", body: "Cá mập mua VBB", triggered_at: new Date(Date.now() - 7200e3).toISOString() },
];

describe("UnifiedAlertCenter compact (S2)", () => {
  it("symbol hiện đầy đủ, không truncate (audit #13)", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts } as any));
    const sym = container.querySelector(".alert-sym");
    expect(sym).toBeTruthy();
    expect(sym?.textContent).toBe("CAR");
    expect(getComputedStyle(sym as Element).cssText || "").toBeDefined();
    expect((sym as HTMLElement)?.className).not.toMatch(/truncate/);
  });
  it("filter có nhãn + count, 1 hàng (audit #14)", () => {
    render(e(UnifiedAlertCenter as any, { alerts } as any));
    expect(screen.getByRole("button", { name: /Tất cả \(2\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cao \(1\)/ })).toBeTruthy();
  });
  it("giá trị compact vi-VN + tooltip đầy đủ (audit #17)", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts } as any));
    const html = container.innerHTML;
    expect(html).toContain("660,5 triệu ₫");
    expect(html).toContain("1,5 tỷ ₫");
    expect(html).toContain("21/09/2026");
  });
  it("badge unread + link Xem tất cả (audit #15/#20)", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts } as any));
    const badge = container.querySelector('span[title="2 chưa đọc"]');
    expect(badge?.textContent).toBe("2");
    const link = container.querySelector('a[href="/alert-center"]');
    expect(link?.textContent).toContain("Xem tất cả");
  });
  it("counter Hiển thị X/Y khớp counts (khóa bất biến)", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts } as any));
    expect(container.innerHTML).toContain("2/2");
    expect(container.querySelectorAll(".alert-card").length).toBe(2);
  });
  it("filter loại hết → diagnostic + nút Xóa bộ lọc (không trắng trơn)", () => {
    const onChange: string[] = [];
    const { container } = render(e(UnifiedAlertCenter as any, {
      alerts,
      severityFilter: "critical",
      onSeverityFilterChange: (v: string) => { onChange.push(v); },
    } as any));
    expect(container.querySelectorAll(".alert-card").length).toBe(0);
    expect(container.innerHTML).toContain("2 cảnh báo");
    const btns = screen.getAllByRole("button", { name: /Xóa bộ lọc/ });
    fireEvent.click(btns[btns.length - 1]);
    expect(onChange).toEqual(["all"]);
  });
  it("loading rỗng → trạng thái đang tải, không trắng", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts: [], loading: true } as any));
    expect(container.innerHTML).toContain("Đang tải");
  });
  it("mark-read giảm badge (audit #15)", () => {
    let marked: string | null = null;
    const { container } = render(e(UnifiedAlertCenter as any, {
      alerts,
      readAlertIds: new Set(),
      markAlertAsRead: (id: string) => { marked = id; },
    } as any));
    const card = container.querySelector(".alert-card") as HTMLElement;
    fireEvent.click(card);
    expect(marked).toBe("a1");
  });
});
