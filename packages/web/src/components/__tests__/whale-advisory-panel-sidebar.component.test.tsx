import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { createElement } from "react";
import { MemoryRouter } from "react-router-dom";

/**
 * R6.1 / R6.2 / R4.1 / R4.2 / R2.3 / R2.6 — test cho `WhaleSymbolSidebar`
 * và `WhaleAdvisoryCommandPanel`, hai file trước đây **không có test nào**
 * (grep toàn repo: 0 kết quả) dù chúng hiển thị phần lớn thông tin người dùng
 * thấy trên trang.
 */

vi.mock("@/context/PortfolioContext.js", () => ({ usePortfolio: vi.fn(() => ({ userPlan: "Pro", activePortfolioId: null })) }));
vi.mock("@/components/ShellToast.js", () => ({ useToast: () => ({ warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() }) }));

import WhaleSymbolSidebar from "@/components/advisory/WhaleSymbolSidebar.jsx";
import { WhaleAdvisoryCommandPanel } from "@/components/advisory/WhaleAdvisoryCommandPanel.jsx";
import { ConfirmProvider } from "@/components/ConfirmModal.js";

function renderSidebar(props = {}) {
  return render(createElement(
    MemoryRouter,
    null,
    createElement(WhaleSymbolSidebar, {
      symbolStats: [],
      symbolSearch: "",
      setSymbolSearch: vi.fn(),
      activeSymbol: "",
      setActiveSymbol: vi.fn(),
      page: 1,
      setPage: vi.fn(),
      pageSize: 20,
      setPageSize: vi.fn(),
      compareSymbols: [],
      onToggleCompare: vi.fn(),
      ...props,
    }),
  ));
}

function renderPanel(props = {}) {
  return render(createElement(
    ConfirmProvider,
    null,
    createElement(MemoryRouter, null, createElement(WhaleAdvisoryCommandPanel, {
      item: null,
      activeSymbol: "FPT",
      hasAnyAdvisory: true,
      onRefresh: vi.fn(),
      onDeleteCurrent: vi.fn(),
      refreshing: false,
      deleting: false,
      rowMessage: "",
      ...props,
    })),
  ));
}

describe("WhaleSymbolSidebar (R2.3, R2.6, R4.6)", () => {
  it("hiển thị side/confidence từ dữ liệu thật", () => {
    // Test env không nạp bản dịch, nên `t()` trả `defaultValue` (chính là mã
    // side thô). Assert theo giá trị thô để test không phụ thuộc i18n runtime.
    renderSidebar({
      symbolStats: [{ symbol: "VNM", side: "SELL", confidence: 82, updatedAt: null }],
    });
    expect(screen.getByText("VNM")).toBeTruthy();
    expect(screen.getByText("SELL")).toBeTruthy();
    expect(document.body.textContent).toContain("82%");
  });

  it("side thiếu dữ liệu thì hiện — thay vì chữ side", () => {
    renderSidebar({ symbolStats: [{ symbol: "VNM", side: null, confidence: 82 }] });
    expect(document.body.textContent).not.toContain("UNKNOWN");
  });

  it("R4.2 — symbol không có dữ liệu hiện —, không phải 0", () => {
    renderSidebar({ symbolStats: [{ symbol: "VIC", side: null, confidence: null }] });
    expect(document.body.textContent).not.toContain("0%");
    expect(document.body.textContent).not.toMatch(/\b0\b/);
  });

  it("R2.6 — không còn badge LIVE", () => {
    renderSidebar({ symbolStats: [{ symbol: "VNM", side: "BUY", confidence: 10 }] });
    expect(document.body.textContent).not.toMatch(/\bLIVE\b/);
  });

  it("không còn render cột GD hay thanh cường độ dòng tiền", () => {
    const { container } = renderSidebar({ symbolStats: [{ symbol: "VNM", side: "BUY", confidence: 10 }] });
    expect(container.textContent).not.toContain("GD");
  });

  it("R4.6 — nút so sánh là button riêng, không role=checkbox lồng trong button", () => {
    const { container } = renderSidebar({ symbolStats: [{ symbol: "VNM", side: "BUY", confidence: 10 }] });
    expect(container.querySelector('button [role="checkbox"]')).toBeNull();
    expect(container.querySelector('[aria-pressed]')).toBeTruthy();
  });

  it("chọn mã gọi setActiveSymbol", () => {
    const setActiveSymbol = vi.fn();
    const { container } = renderSidebar({ symbolStats: [{ symbol: "VNM", side: "BUY", confidence: 10 }], setActiveSymbol });
    const row = Array.from(container.querySelectorAll("button"))
      .find((button) => button.textContent?.includes("VNM"));
    expect(row).toBeTruthy();
    fireEvent.click(row);
    expect(setActiveSymbol).toHaveBeenCalledWith("VNM");
  });

  it("empty state phân biệt chưa có mã vs không tìm thấy", () => {
    const { unmount } = renderSidebar({ symbolStats: [] });
    expect(document.body.textContent).toContain("Chưa có mã nào");
    unmount();
    renderSidebar({ symbolStats: [], symbolSearch: "ZZZ" });
    expect(document.body.textContent).toContain("Không tìm thấy");
  });
});

describe("WhaleAdvisoryCommandPanel (R4.1, R4.2, R2.5)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("R4.1 — chưa chọn mã thì báo chọn mã, không báo 'chưa có mã nào đang hoạt động'", () => {
    renderPanel({ activeSymbol: "" });
    expect(screen.getByTestId("empty-no-symbol")).toBeTruthy();
    expect(document.body.textContent).not.toContain("Chưa có mã nào đang hoạt động");
  });

  it("R4.1 — mã đã chọn nhưng chưa có tư vấn thì báo đúng mã đó", () => {
    renderPanel({ activeSymbol: "VIC" });
    const empty = screen.getByTestId("empty-no-advisory");
    expect(empty.textContent).toContain("VIC");
    expect(empty.textContent).toContain("chưa có tư vấn");
  });

  it("R4.2 — metric null hiện — chứ không 0", () => {
    renderPanel({ item: { symbol: "FPT", side: "UNKNOWN", created_at: null } });
    expect(screen.getByTestId("metric-intensity").textContent?.trim()).toBe("—");
    expect(screen.getByTestId("metric-reference").textContent?.trim()).toBe("—");
    expect(screen.getByTestId("metric-confidence").textContent?.trim()).toBe("—");
  });

  it("R4.2 — có dữ liệu thì hiện số thật", () => {
    renderPanel({
      item: {
        symbol: "FPT", side: "BUY", created_at: "2026-09-25T10:00:00Z",
        confidence: 88, whale_intensity: 72, matched_value: 14500,
      },
    });
    expect(screen.getByTestId("metric-confidence").textContent).toContain("88");
    expect(screen.getByTestId("metric-intensity").textContent).toContain("72");
    expect(screen.getByTestId("metric-reference").textContent).toContain("14.500");
  });

  it("hiện side badge khi có tư vấn, ẩn khi chưa có", () => {
    const { unmount } = renderPanel({ item: { symbol: "FPT", side: "SELL", created_at: null } });
    expect(screen.getByTestId("advisory-side-badge").textContent).toBe("SELL");
    unmount();
    renderPanel({ item: null });
    expect(screen.queryByTestId("advisory-side-badge")).toBeNull();
  });

  it("R2.5 — không còn link nhãn 'Bảng điều khiển cá voi' trỏ nhầm", () => {
    renderPanel({ item: { symbol: "FPT", side: "BUY", created_at: null } });
    expect(document.body.textContent).not.toContain("Bảng điều khiển cá voi");
  });

  it("R1.4 — nút Lệnh thử nghiệm chỉ hiện khi có tư vấn", () => {
    const { unmount } = renderPanel({ item: null });
    expect(screen.queryByText("Lệnh thử nghiệm")).toBeNull();
    unmount();
    renderPanel({ item: { symbol: "FPT", side: "BUY", created_at: null } });
    expect(screen.getByText("Lệnh thử nghiệm")).toBeTruthy();
  });

  it("nút Làm mới gọi onRefresh với mã đang chọn", () => {
    const onRefresh = vi.fn();
    renderPanel({ onRefresh });
    fireEvent.click(screen.getByText("Làm mới"));
    expect(onRefresh).toHaveBeenCalledWith("FPT");
  });
});
