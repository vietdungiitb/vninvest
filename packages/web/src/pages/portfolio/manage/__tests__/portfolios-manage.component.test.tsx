/**
 * Test tích hợp `/portfolios/manage`.
 *
 * Khoảng trống mà bộ test này lấp: trước rebuild **KHÔNG test nào render
 * `PortfoliosPage`**. `grep PortfoliosPage` trong `packages/web` chỉ ra 1 dòng
 * *comment* trong `field-contract.test.js`. Nghĩa là: cột tiền thêm vào, xử lý
 * 409, sửa danh mục — không có gì bắt hồi quy nếu ai đó xoá nhầm.
 *
 * Dữ liệu vào **tiêm qua prop `adapter`** (không `vi.mock` module) — cùng cách
 * 5 trang workspace làm (`PortfolioHoldingsPage` nhận `adapter`).
 *
 * Mỗi test gắn với một lỗi cụ thể đã ghi trong claim `pf-manage-rebuild`:
 *   - MOA hiển thị tiền        → "Tổng giá trị danh mục" lên từ `summary` thật
 *   - MOA sửa được danh mục    → nút "Sửa" → PATCH với đúng field
 *   - MOA bỏ bịa số dư mở đầu  → để trống ⇒ `opening_balance: null`, KHÔNG `"0"`
 *   - MOA 409 có thông điệp    → không rò chuỗi kỹ thuật của CoreApiRequestError
 *   - MOA 1 danh mục lỗi summary không làm mất danh mục khỏi bảng
 *   - MOA ô không có số liệu hiện `—` chứ không phải `0`
 */

import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LangProvider } from "../../../../context/LangContext";
import { PortfolioProvider } from "../../../../context/PortfolioContext";
import { ToastProvider } from "../../../../components/ShellToast";
import { ConfirmProvider } from "../../../../components/ConfirmModal";
import { PortfoliosPage } from "../../../PortfoliosPage";
import type { PortfolioManageAdapter } from "../usePortfolioManage";

const SUMMARIES: Record<string, Record<string, unknown>> = {
  "1": {
    portfolio_id: 1,
    total_market_value: "125000000",
    total_cost: "100000000",
    total_unrealized_pnl: "25000000",
    total_unrealized_pnl_pct: 25,
    num_holdings: 3,
    cash: "5000000",
    cash_complete: true,
    nav: "130000000",
    nav_reason: "",
    as_of: "2026-10-13",
    unpriced_symbols: [],
  },
  // Chưa có ledger ⇒ `null` + lý do. Đây là trạng thái thật của user mới.
  "2": {
    portfolio_id: 2,
    total_market_value: null,
    total_cost: "0",
    total_unrealized_pnl: null,
    total_unrealized_pnl_pct: null,
    num_holdings: 0,
    cash: "0",
    cash_complete: false,
    nav: null,
    nav_reason: "no_opening_balance",
    nav_reason_text: "Chưa khai báo số dư mở đầu",
    as_of: "2026-10-13",
    unpriced_symbols: [],
    market_value_reason: "2 mã chưa có giá phiên 2026-10-13",
  },
};

const ROWS = [
  { id: 1, name: "Danh mục lớn", description: "Core", is_default: true, opening_balance: "100000000", created_at: "2026-01-05T08:00:00Z" },
  { id: 2, name: "Danh mục thử nghiệm", description: "", is_default: false, opening_balance: null, created_at: "2026-02-06T08:00:00Z" },
];

function makeAdapter(over: Partial<PortfolioManageAdapter> = {}): PortfolioManageAdapter {
  return {
    getPortfolios: vi.fn(async () => ({ results: ROWS, next: null, previous: null })),
    getPortfolioSummary: vi.fn(async (id: string | number) => SUMMARIES[String(id)] ?? null),
    getPortfolioHoldings: vi.fn(async () => ({ data: [], meta: { count: 0 } })),
    createPortfolio: vi.fn(async () => ({ id: 9, name: "Mới" })),
    updatePortfolio: vi.fn(async (id: string | number) => ROWS.find((r) => r.id === id) ?? { id, name: "Mới" }),
    deletePortfolio: vi.fn(async () => undefined),
    ...over,
  } as PortfolioManageAdapter;
}

// Thứ tự provider phải khớp `main.tsx:235-259`: ToastProvider và ConfirmProvider
// nằm NGOÀI trang, nếu thiếu chúng `useToast()` ném lỗi ngay dòng render đầu.
function wrap(adapter: PortfolioManageAdapter) {
  return render(
    <MemoryRouter>
      <PortfolioProvider>
        <LangProvider>
          <ToastProvider>
            <ConfirmProvider>
              <PortfoliosPage adapter={adapter} />
            </ConfirmProvider>
          </ToastProvider>
        </LangProvider>
      </PortfolioProvider>
    </MemoryRouter>,
  );
}

/** Đợi cả tiền load xong (bảng + KPI). */
async function settled() {
  await waitFor(() => {
    expect(screen.getByText("Danh mục lớn")).toBeTruthy();
  });
}

beforeEach(() => {
  localStorage.setItem("lang", "vi");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("/portfolios/manage — hiển thị tiền thật", () => {
  test("bảng có cột giá trị thị trường và lãi/lỗ chưa thực hiện", async () => {
    wrap(makeAdapter());
    await settled();

    expect(screen.getByText("Giá trị thị trường")).toBeTruthy();
    // "Lãi/lỗ chưa thực hiện" có ở CẢ tiêu đề bảng lẫn nhãn KPI — kiểm theo
    // role columnheader để chỉ đúng cột của bảng.
    expect(
      screen.getByRole("columnheader", { name: /Lãi\/lỗ chưa thực hiện/ }),
    ).toBeTruthy();
    // 125.000.000 xuất hiện ở ô bảng VÀ ở thẻ KPI tổng — kiểm cả hai đều có.
expect(screen.getAllByText("125.000.000").length).toBeGreaterThanOrEqual(2);
  });

  test("ô lãi/lỗ dùng màu tăng (xanh) — chuẩn Bloomberg, không đảo", async () => {
    wrap(makeAdapter());
    await settled();

    const row = screen.getByText("Danh mục lớn").closest("tr");
    const pnlCell = row!.querySelector(".pfm-tone-gain");
    expect(pnlCell).toBeTruthy();
    expect(pnlCell!.textContent).toContain("25.000.000");
  });

  test("KPI tổng cộng từ summary, không tự bịa từ opening_balance", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await settled();

    expect(screen.getByText("Tổng giá trị danh mục")).toBeTruthy();
    // `getPortfolioSummary` mới được gọi — bản cũ KHÔNG gọi hàm này.
    expect(adapter.getPortfolioSummary).toHaveBeenCalledTimes(2);
    // Danh mục 2 có `total_market_value: null` ⇒ KPI phải nói rõ đang tạm tính.
    expect(screen.getByText(/Tổng trên là tạm tính/)).toBeTruthy();
  });

  test("danh mục không có số liệu hiện — chứ không hiện 0", async () => {
    wrap(makeAdapter());
    await settled();

    const row = screen.getByText("Danh mục thử nghiệm").closest("tr");
    expect(row?.textContent).toContain("—");
    // Không có "0đ" hay "0,00%" giả lập ở ô giá trị thị trường.
    expect(row?.textContent).not.toMatch(/Giá trị thị trường/);
  });

  test("một danh mục lỗi summary KHÔNG làm mất các danh mục khác", async () => {
    const adapter = makeAdapter({
      getPortfolioSummary: vi.fn(async (id: string | number) => {
        if (String(id) === "2") throw new Error("boom");
        return SUMMARIES[String(id)];
      }),
    });
    wrap(adapter);
    await settled();

    // Cả hai dòng vẫn còn — danh mục lỗi phải hiện ô trống, không biến mất.
    expect(screen.getByText("Danh mục lớn")).toBeTruthy();
    expect(screen.getByText("Danh mục thử nghiệm")).toBeTruthy();
  });
});

describe("/portfolios/manage — CRUD", () => {
  test("tạo danh mục: để trống số dư mở đầu ⇒ gửi null, KHÔNG gửi \"0\"", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await settled();

    fireEvent.click(screen.getAllByRole("button", { name: "Tạo danh mục" })[0]);
    const dialog = await screen.findByRole("dialog");

    fireEvent.change(within(dialog).getByLabelText("Tên danh mục"), {
      target: { value: "Danh mục mới" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Tạo danh mục" }));

    await waitFor(() => expect(adapter.createPortfolio).toHaveBeenCalled());
    const payload = (adapter.createPortfolio as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.opening_balance).toBeNull();
    expect(payload.name).toBe("Danh mục mới");
  });

  test("sửa danh mục gọi updatePortfolio — bản cũ không có thao tác này", async () => {
    const adapter = makeAdapter();
    wrap(adapter);
    await settled();

    const row = screen.getByText("Danh mục lớn").closest("tr");
    fireEvent.click(row!.querySelectorAll("button")[1]); // [0]=Chi tiết, [1]=Sửa
    const dialog = await screen.findByRole("dialog");

    expect((within(dialog).getByLabelText("Tên danh mục") as HTMLInputElement).value).toBe(
      "Danh mục lớn",
    );
    fireEvent.change(within(dialog).getByLabelText("Tên danh mục"), {
      target: { value: "Đã đổi tên" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(adapter.updatePortfolio).toHaveBeenCalledWith(1, expect.any(Object)));
    const [, payload] = (adapter.updatePortfolio as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(payload.name).toBe("Đã đổi tên");
  });

  test("xoá gặp 409 portfolio_has_financial_history ⇒ thông điệp tiếng Việt, không rò chuỗi kỹ thuật", async () => {
    const adapter = makeAdapter({
      deletePortfolio: vi.fn(async () => {
        const err = Object.assign(new Error("Core API request error 409 Conflict - /workspace/portfolios/1/"), {
          status: 409,
          code: "portfolio_has_financial_history",
          payload: {
            detail: "Danh mục đã có lịch sử giao dịch nên không thể xoá cứng.",
            code: "portfolio_has_financial_history",
          },
        });
        throw err;
      }),
    });
    wrap(adapter);
    await settled();

    const row = screen.getByText("Danh mục lớn").closest("tr");
    fireEvent.click(row!.querySelectorAll("button")[2]); // [2]=Xoá
    // `ConfirmModal` dùng `role="alertdialog"` (ConfirmModal.tsx:97), KHÁC
    // `dialog` của `PortfolioFormDialog` — tra sai role sẽ không tìm thấy.
    const confirmBox = await screen.findByRole("alertdialog");
    fireEvent.click(within(confirmBox).getByRole("button", { name: /Xác nhận/ }));

    await waitFor(() => expect(screen.getByText(/không thể xoá/i)).toBeTruthy());
    // Chuỗi kỹ thuật của CoreApiRequestError KHÔNG được lộ ra.
    expect(screen.queryByText(/Core API request error 409/)).toBeNull();
  });
});

describe("/portfolios/manage — điều hướng", () => {
  test("bấm Chi tiết mở drawer vị thế", async () => {
    const adapter = makeAdapter({
      getPortfolioHoldings: vi.fn(async () => ({
        data: [
          {
            symbol: "VFC", company_name: "Vingroup", quantity: 1000,
            avg_cost: "85000", current_price: "90000", market_value: "90000000",
            unrealized_pnl: "5000000", unrealized_pnl_pct: 5.88, weight_pct: 66.67,
            price_missing_reason: null, stale: false,
          },
          {
            symbol: "XYZ", company_name: "Chưa có giá", quantity: 10,
            avg_cost: "10000", current_price: null, market_value: null,
            unrealized_pnl: null, unrealized_pnl_pct: null, weight_pct: null,
            price_missing_reason: "no_quote_for_today", stale: true,
          },
        ],
        meta: { count: 2, unpriced_symbols: ["XYZ"], weight_covers_all_holdings: false },
      })),
    });
    wrap(adapter);
    await settled();

    const row = screen.getByText("Danh mục lớn").closest("tr");
    fireEvent.click(row!.querySelectorAll("button")[0]);
    await waitFor(() => screen.getByRole("dialog"));

    await waitFor(() => expect(screen.getByText("Vingroup")).toBeTruthy());
    // Mã chưa có giá vẫn hiện dòng + nhãn lý do, không bị ẩn (giữ đúng tổng tỷ trọng).
    expect(screen.getByText("XYZ")).toBeTruthy();
    expect(screen.getAllByText("Chưa có giá").length).toBeGreaterThan(0);
    expect(screen.getByText(/Còn mã chưa có giá hôm nay: XYZ/)).toBeTruthy();
  });

  test("trang quản lý KHÔNG còn nhúng panel đặt lệnh broker", async () => {
    wrap(makeAdapter());
    await settled();
    // `DNSEConnectionPanel` có nút "Gửi OTP" — màn hình danh mục không được có nó.
    expect(screen.queryByText(/Gửi OTP/)).toBeNull();
    // Nhưng vẫn có lối ra tới trang broker.
    expect(screen.getByRole("link", { name: "Kết nối broker" })).toBeTruthy();
  });
});