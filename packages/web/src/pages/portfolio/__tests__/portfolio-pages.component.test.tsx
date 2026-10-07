/**
 * S-04..S-11 - test tich hop cho 5 trang Portfolio workspace.
 *
 * Khong render ECharts (jsdom khong co canvas that). Thay vao do du lieu dau vao
 * bang adapter gia lap, kiem tra:
 *   - 13 cot cua Holdings, o thieu gia hien `—` CHU KHONG PHAI 0;
 *   - sap xep cot SO theo gia tri so (bat PB2 cua FE-03);
 *   - ma chua co nganh hien "Chua phan nganh", khong hien "Khac";
 *   - Activity chi hien khoang dang xem, khong gia "tong N ban ghi".
 *
 * Adapter truyen vao la object rong cho tung test. Neu trang goi endpoint that
 * (khong qua adapter prop) thi test se hong - day la chu dich.
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { LangProvider } from "../../../context/LangContext";
import { PortfolioProvider } from "../../../context/PortfolioContext";
import { PortfolioHoldingsPage } from "../PortfolioHoldingsPage";
import { PortfolioActivityPage } from "../PortfolioActivityPage";

function wrap(node: React.ReactElement) {
  return render(
    <PortfolioProvider>
      <LangProvider>{node}</LangProvider>
    </PortfolioProvider>,
  );
}

/** Cho phep effect + promise cua hook chay xong truoc khi kiem tra DOM. */
async function settled() {
  await waitFor(() => {
    expect(screen.queryByText("Đang tải…")).toBeNull();
  });
}

const HOLDINGS = [
  {
    symbol: "VFC", company_name: "Vingroup", industry: "Bất động sản",
    quantity: 1000, avg_cost: "85000", current_price: "90000",
    market_value: "90000000", unrealized_pnl: "5000000", unrealized_pnl_pct: 5.88,
    weight_pct: 66.67, price_change_pct: 1.1, price_missing_reason: null, stale: false,
  },
  {
    symbol: "AAA", company_name: "AAA", industry: "Thực phẩm",
    quantity: 100, avg_cost: "12000", current_price: "11000",
    market_value: "1100000", unrealized_pnl: "-100000", unrealized_pnl_pct: -8.33,
    weight_pct: 33.33, price_change_pct: -0.5, price_missing_reason: null, stale: false,
  },
  {
    // Ma thieu gia: moi cot so phai `—`, KHONG phai 0.
    symbol: "BBB", company_name: "BBB", industry: "",
    quantity: 50, avg_cost: "5000", current_price: null,
    market_value: null, unrealized_pnl: null, unrealized_pnl_pct: null,
    weight_pct: null, price_change_pct: null,
    price_missing_reason: "no_quote_for_today", stale: true,
  },
];

describe("PortfolioHoldingsPage", () => {
  const makeAdapter = (rows = HOLDINGS) => ({
    getPortfolioHoldings: vi.fn(async () => ({ data: rows, meta: {} })),
  });

  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("render du 13 cot tieu de", async () => {
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    expect(screen.getAllByRole("columnheader")).toHaveLength(13);
  });

  test("ma thieu gia hien `—` o cot so, KHONG hien 0", async () => {
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    const cell = await screen.findByRole("rowheader", { name: "BBB" });
    const row = cell.closest("tr") as HTMLTableRowElement;
    const texts = Array.from(row.querySelectorAll("td")).map((td) => td.textContent?.trim() ?? "");
    // `symbol` la <th scope="row">, khong phai <td> => moi <td> lech 1 so voi
    // chi so cot cua <thead>. Thu tu <td>: name, qty, avgCost, lastPrice,
    // marketValue, pnl, pnl%, weight, sector, change24h, status, actions.
    expect(texts[4]).toBe("—"); // market value
    expect(texts[5]).toBe("—"); // unrealized pnl
    expect(texts[6]).toBe("—"); // pnl %
    expect(texts[7]).toBe("—"); // weight
    expect(texts[8]).toBe("Chưa phân ngành"); // sector rong -> nhan ro, khong phai 0
    expect(texts[9]).toBe("—"); // 24h change
    // Không có ô số nào chứa 0 ở hàng này (số 0 = "chưa biết" là nói dối)
    const numericCells = [texts[4], texts[5], texts[6], texts[7], texts[9]];
    expect(numericCells.join("|")).not.toMatch(/(^|[^0-9])0([^0-9]|$)/);
  });

  test("sap xep theo gia tri SO, khong theo chuoi (PB2 cua FE-03)", async () => {
    // "1000000" > "900000" theo CHUOI ("1" < "9") nhung nho hon theo SO.
    const messy = [
      { symbol: "SMALL", market_value: "900000", weight_pct: 5, unrealized_pnl: "1",
        unrealized_pnl_pct: 1, price_change_pct: 0, industry: "" },
      { symbol: "BIG", market_value: "1000000", weight_pct: 95, unrealized_pnl: "2",
        unrealized_pnl_pct: 2, price_change_pct: 0, industry: "" },
    ];
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={makeAdapter(messy as never)} />);
    await settled();
    const order = screen.getAllByRole("rowheader").map((th) => th.textContent);
    expect(order[0]).toBe("BIG");   // 1.000.000 > 900.000
    expect(order[1]).toBe("SMALL");
  });

  test("loc theo chuoi tim kiem khop ca ten cong ty", async () => {
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "vingroup" } });
    await waitFor(() => {
      expect(screen.queryByRole("rowheader", { name: "AAA" })).toBeNull();
    });
    expect(screen.getByRole("rowheader", { name: "VFC" })).toBeTruthy();
  });

  test("ma chua co nganh hien 'Chua phan nganh', KHONG hien 'Khac'", async () => {
    wrap(<PortfolioHoldingsPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    await waitFor(() => expect(screen.getByText("Chưa phân ngành")).toBeTruthy());
    expect(screen.queryByText("Khác")).toBeNull();
  });
});

describe("PortfolioActivityPage", () => {
  const TXS = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
    transaction_type: i % 2 ? "SELL" : "BUY",
    symbol: "VNM",
    quantity: 100,
    total_value: 1000000 + i,
  }));
  const makeAdapter = (rows = TXS) => ({
    getTransactions: vi.fn(async () => ({ data: rows, meta: {} })),
  });

  beforeEach(() => cleanup());
  afterEach(() => vi.clearAllMocks());

  test("chi hien khoang dang xem, KHONG gia tong so ban ghi", async () => {
    wrap(<PortfolioActivityPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    await waitFor(() => expect(screen.getByText("1–25")).toBeTruthy());
    // BE khong tra count/total => khong duoc hien "Trang 1/2" hay "30 ban ghi"
    expect(screen.queryByText(/Trang\s*1\/2/i)).toBeNull();
    expect(screen.queryByText(/30 bản ghi/i)).toBeNull();
  });

  test("trang sau hien khoang tiep theo", async () => {
    wrap(<PortfolioActivityPage portfolioId={1} adapter={makeAdapter()} />);
    await settled();
    await waitFor(() => expect(screen.getByRole("button", { name: /Sau/ })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /Sau/ }));
    await waitFor(() => expect(screen.getByText("26–30")).toBeTruthy());
  });

  test("khong co giao dich -> thong bao rong, khong de trang trong", async () => {
    wrap(<PortfolioActivityPage portfolioId={1} adapter={makeAdapter([])} />);
    await settled();
    await waitFor(() => expect(screen.getByText("Chưa có giao dịch nào")).toBeTruthy());
  });
});
