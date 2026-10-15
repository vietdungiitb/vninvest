/**
 * mbw2-data B2.5 — TDD fail-before cho badge nguồn holdings (QĐ-C ADR-005).
 *
 * AC5: mỗi dòng có badge nguồn đúng QĐ-C (manual|broker_backed|aggregate),
 * màu tăng/giảm giữ chuẩn Bloomberg (data-sign pos/neg nguyên vẹn).
 * Fail-closed: dòng KHÔNG có `source` (BE hiện chưa trả) ⇒ KHÔNG bịa badge.
 */
import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioHoldingsPage } from "../PortfolioHoldingsPage";
import { SourceBadge } from "../../../components/brokerData/sourceBadge";

function wrap(node: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/portfolio/1"]}>
      <PortfolioProvider>
        <LangProvider>{node}</LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

const ROWS = [
  {
    symbol: "VCB", company_name: "Vietcombank", industry: "Ngân hàng",
    quantity: 10, avg_cost: "90", current_price: "100",
    market_value: "1000", unrealized_pnl: "100", unrealized_pnl_pct: 11.11,
    weight_pct: 100, price_change_pct: 1.5, price_missing_reason: null, stale: false,
    source: "broker_backed",
  },
  {
    symbol: "MAN", company_name: "Thủ công", industry: "",
    quantity: 5, avg_cost: "10", current_price: "12",
    market_value: "60", unrealized_pnl: "10", unrealized_pnl_pct: 20,
    weight_pct: 5, price_change_pct: 0.5, price_missing_reason: null, stale: false,
    source: "manual",
  },
  {
    symbol: "NOSRC", company_name: "Chưa rõ nguồn", industry: "",
    quantity: 1, avg_cost: "1", current_price: "1",
    market_value: "1", unrealized_pnl: "0", unrealized_pnl_pct: 0,
    weight_pct: 0.1, price_change_pct: 0, price_missing_reason: null, stale: false,
  },
];

describe("holdings source badge (B2.5, QĐ-C)", () => {
  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("SourceBadge map dung 3 nhan QĐ-C + unlinked", () => {
    const badge = (source: string | null) => (
      <PortfolioProvider>
        <LangProvider>
          <SourceBadge source={source} />
        </LangProvider>
      </PortfolioProvider>
    );
    const { unmount } = render(badge("manual"));
    expect(screen.getByText("Thủ công")).toBeTruthy();
    unmount();
    render(badge("broker_backed"));
    expect(screen.getByText("Môi giới")).toBeTruthy();
    cleanup();
    render(badge("aggregate"));
    expect(screen.getByText("Tổng hợp")).toBeTruthy();
    cleanup();
    render(badge("unlinked"));
    expect(screen.getByText(/chưa liên kết/i)).toBeTruthy();
  });

  test("SourceBadge unknown ⇒ render null (khong bia badge)", () => {
    const { container } = render(
      <PortfolioProvider>
        <LangProvider>
          <SourceBadge source={null} />
        </LangProvider>
      </PortfolioProvider>,
    );
    expect(container.textContent).toBe("");
  });

  test("holdings: dong co source hien badge, dong thieu source khong bia", async () => {
    const adapter = { getPortfolioHoldings: vi.fn(async () => ({ data: ROWS, meta: {} })) };
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Đang tải…")).toBeNull());
    const vcb = (await screen.findByRole("rowheader", { name: /VCB/ })).closest("tr");
    expect(vcb?.textContent).toMatch(/Môi giới/);
    const man = screen.getByRole("rowheader", { name: /MAN/ }).closest("tr");
    expect(man?.textContent).toMatch(/Thủ công/);
    const nosrc = screen.getByRole("rowheader", { name: /NOSRC/ }).closest("tr");
    expect(nosrc?.textContent).not.toMatch(/Môi giới|Thủ công|Tổng hợp/);
  });

  test("them badge khong doi 13 cot + mau Bloomberg giu nguyen", async () => {
    const adapter = { getPortfolioHoldings: vi.fn(async () => ({ data: ROWS, meta: {} })) };
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={adapter} />);
    await waitFor(() => expect(screen.queryByText("Đang tải…")).toBeNull());
    expect(screen.getAllByRole("columnheader")).toHaveLength(13);
    const vcb = screen.getByRole("rowheader", { name: /VCB/ }).closest("tr");
    expect(vcb?.querySelector('td[data-sign="pos"]')).toBeTruthy();
  });
});
