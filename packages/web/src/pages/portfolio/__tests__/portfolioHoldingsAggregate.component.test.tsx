import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioHoldingsPage } from "../PortfolioHoldingsPage";

/**
 * mbw3 B3.2-FE — TDD fail-before cho banner/khóa aggregate (AC3 phía FE).
 *
 * Contract: `kind` read-only trên PortfolioSerializer (BE-KIND); đường chuyển
 * làn duy nhất là action `convert`. FE hiện banner chỉ-đọc + ẩn/disable nút
 * write khi `kind=aggregate`; `kind` vắng (BE chưa deploy) ⇒ banner unknown
 * fail-closed (khóa write để an toàn).
 */

const ROWS = [
  {
    symbol: "VCB", company_name: "Vietcombank", industry: "Ngân hàng",
    quantity: 10, avg_cost: "90", current_price: "100",
    market_value: "1000", unrealized_pnl: "100", unrealized_pnl_pct: 11.11,
    weight_pct: 100, price_change_pct: 1.5, price_missing_reason: null, stale: false,
    source: "aggregate",
  },
];

function wrap(adapter, kind) {
  const full = {
    getPortfolioHoldings: vi.fn(async () => ({ data: ROWS, meta: {} })),
    getPortfolios: vi.fn(async () => [{ id: 1, name: "Gộp", kind }]),
    ...adapter,
  };
  // kind truyền tường minh qua prop khi có; khi undefined để component tự
  // suy từ getPortfolios (giống app thật qua PortfolioWorkspace).
  const props = kind === undefined ? { portfolioId: 1 } : { portfolioId: 1, kind };
  return render(
    <MemoryRouter initialEntries={["/portfolios/1/holdings"]}>
      <PortfolioProvider>
        <LangProvider>
          <PortfolioHoldingsPage adapter={full} {...props} />
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

describe("holdings aggregate banner (B3.2-FE, AC3)", () => {
  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("kind=aggregate ⇒ banner chỉ-đọc + nút write bị khóa", async () => {
    wrap({}, "aggregate");
    expect(await screen.findByText(/chỉ đọc/i)).toBeTruthy();
    await screen.findByText("VCB");
    // Trang holdings không có nút ghi khả dụng: nút hành động duy nhất ở cột
    // Thao tác ("Chi tiết") luôn disabled; banner là observable khóa.
    // (Tinh chỉnh selector sau fail-before: bản đầu lọc nút sort bằng regex,
    // sót 3 nút sort — nguyên nhân đỏ vẫn là "thiếu banner", không đổi.)
    const actionBtn = screen.getByRole("button", { name: /chi tiết/i });
    expect((actionBtn as HTMLButtonElement).disabled).toBe(true);
  });

  test("kind vắng (BE chưa deploy) ⇒ banner unknown fail-closed", async () => {
    wrap({ getPortfolios: vi.fn(async () => [{ id: 1, name: "Gộp" }]) }, undefined);
    expect(await screen.findByText(/không rõ/i)).toBeTruthy();
    await screen.findByText("VCB");
  });

  test("kind=manual ⇒ không banner, bảng giữ 13 cột", async () => {
    wrap({}, "manual");
    await screen.findByText("VCB");
    expect(screen.queryByText(/chỉ đọc/i)).toBeNull();
    expect(screen.queryByText(/không rõ/i)).toBeNull();
    expect(screen.getAllByRole("columnheader")).toHaveLength(13);
  });
});
