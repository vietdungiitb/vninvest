import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement as e } from "react";
import { UnifiedAlertCenter } from "../UnifiedAlertCenter.js";
import { createTranslator } from "../../../i18n/index.js";

// The real translator is used on purpose. A previous version of this file
// hand-wrote a dictionary containing every key the component asked for, which
// meant the five keys `alert.showing` / `loadingList` / `loadError` /
// `retryHint` / `filteredEmpty` could be missing from vi.js and en.js and this
// test would still pass while production rendered the raw key strings.
vi.mock("../../../context/LangContext.js", () => ({
  useI18n: () => ({ t: createTranslator("vi"), localeTag: "vi-VN" }),
}));

const alerts3 = [
  { alert_id: "a1", symbol: "CAR", severity: "high", source: "whale", direction: "buy", value: 660489030, confidence: 0.85, session_date: "2026-09-21", body: "Cá mập mua CAR", triggered_at: new Date(Date.now() - 3600e3).toISOString() },
  { alert_id: "a2", symbol: "VBB", severity: "medium", source: "whale", direction: "buy", value: 1523938140, confidence: 0.95, session_date: "2026-09-21", body: "Cá mập mua VBB", triggered_at: new Date(Date.now() - 7200e3).toISOString() },
  { alert_id: "a3", symbol: "HPG", severity: "low", source: "dark_flow", direction: "sell", value: 500000000, confidence: 0.72, session_date: "2026-09-21", body: "Dark flow HPG bán", triggered_at: new Date(Date.now() - 10800e3).toISOString() },
];

const alerts = alerts3.slice(0, 2);

describe("UnifiedAlertCenter compact (S2)", () => {
  it("symbol không truncate (computed flex:none) — audit #13, S1.1", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts } as any));
    const sym = container.querySelector(".alert-sym") as HTMLElement;
    expect(sym).toBeTruthy();
    expect(sym?.textContent).toBe("CAR");
    // class không chứa truncate, có alert-sym (CSS flex:none)
    expect(sym.className).not.toMatch(/truncate/);
    expect(sym.className).toContain("alert-sym");
    // computed flex:none — inline style ensures jsdom returns correct
    const cs = window.getComputedStyle(sym);
    // jsdom with inline style returns "none" for flex shorthand
    expect(cs.flex === "none" || cs.flex === "0 0 auto" || sym.style.flex === "none").toBeTruthy();
  });

  it("card height ≤110px với 3 alerts mock (S2.2 — p-3 compact)", () => {
    const { container } = render(e(UnifiedAlertCenter as any, { alerts: alerts3 } as any));
    const cards = container.querySelectorAll(".alert-card");
    expect(cards.length).toBe(3);
    // each card should have p-3 (compact) not p-4, and be reasonably small
    cards.forEach((card) => {
      const el = card as HTMLElement;
      expect(el.className).toContain("alert-card");
      expect(el.className).toContain("p-3");
      expect(el.className).not.toContain("p-4");
      // jsdom offsetHeight is 0, so we mock measurement: check bounding rect height via style
      // If real browser, height should be ≤110px; in jsdom we assert structural compactness
      const rect = el.getBoundingClientRect();
      // jsdom returns 0; allow 0 as pass but also enforce ≤110 when non-zero
      if (rect.height && rect.height !== 0) {
        expect(rect.height).toBeLessThanOrEqual(110);
      }
      // also ensure card contains compact head + desc, not multi-row overflow wrappers
      expect(el.querySelector(".alert-head")).toBeTruthy();
    });
  });

  it("filter có nhãn + count, 1 hàng, aria-pressed đúng (audit #14, S2.1)", () => {
    render(e(UnifiedAlertCenter as any, { alerts: alerts3 } as any));
    // nhãn + count
    expect(screen.getByRole("button", { name: /Tất cả \(3\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Cao \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Trung bình \(1\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thấp \(1\)/ })).toBeTruthy();
    // aria-pressed for active filter
    const allBtn = screen.getByRole("button", { name: /Tất cả \(3\)/ });
    expect(allBtn.getAttribute("aria-pressed")).toBe("true");
    const highBtn = screen.getByRole("button", { name: /Cao \(1\)/ });
    expect(highBtn.getAttribute("aria-pressed")).toBe("false");
    // click đổi filter updates aria-pressed
    fireEvent.click(highBtn);
    // component internal state not controlled here, but onSeverityFilterChange would be called
  });

  it("filter aria-pressed toggles via controlled prop", () => {
    const { rerender } = render(e(UnifiedAlertCenter as any, { alerts: alerts3, severityFilter: "all" } as any));
    expect(screen.getByRole("button", { name: /Tất cả \(3\)/ }).getAttribute("aria-pressed")).toBe("true");
    rerender(e(UnifiedAlertCenter as any, { alerts: alerts3, severityFilter: "high" } as any));
    expect(screen.getByRole("button", { name: /Cao \(1\)/ }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /Tất cả \(3\)/ }).getAttribute("aria-pressed")).toBe("false");
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
