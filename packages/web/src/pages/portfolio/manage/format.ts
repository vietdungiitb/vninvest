/**
 * Lớp đọc/định dạng dữ liệu cho `/portfolios/manage`.
 *
 * Nguyên tắc bất di của trang: **thiếu dữ liệu = `null` + lý do, không phải 0**
 * (nguyên tắc 5 của `PORTFOLIO_COMMERCIAL_UPGRADE_PROPOSAL_20260927.md:87-108`,
 * LED-03 R5). Backend đã fail-closed sẵn: `portfolio_analytics_views.py:202-205`
 * trả `market_value = None` khi mã chưa có giá, kèm
 * `price_missing_reason = 'no_quote_for_today'`. Vì vậy mọi hàm ở đây phải
 * phân biệt "0 đồng" với "chưa có dữ liệu" — gộp hai thứ này là bịa số.
 *
 * Backend trả `Decimal` qua JSON dưới dạng **chuỗi** (`views.py` bọc
 * `str(round(x, 2))`), nên mọi giá trị tiền ở đây nhận `string | number | null`.
 */

/** Giá trị tiền từ API: `null`/`""` = chưa có dữ liệu. */
export type Money = string | number | null | undefined;

export interface PortfolioRow {
  id: string | number;
  name: string;
  description?: string | null;
  is_default?: boolean | null;
  opening_balance?: Money;
  opening_balance_source?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

/** Shape thật của `PortfolioSummaryView` — `portfolio_analytics_views.py:366-407`. */
export interface PortfolioSummary {
  portfolio_id?: string | number;
  portfolio_name?: string | null;
  total_market_value: Money;
  total_cost: Money;
  total_unrealized_pnl: Money;
  total_unrealized_pnl_pct: number | null;
  num_holdings?: number;
  cash?: Money;
  cash_complete?: boolean;
  cash_note?: string | null;
  realized_pnl?: Money;
  dividend_income?: Money;
  nav?: Money;
  nav_reason?: string | null;
  nav_reason_text?: string | null;
  as_of?: string | null;
  unpriced_symbols?: string[];
  market_value_reason?: string | null;
  [key: string]: unknown;
}

/** Shape thật của `PortfolioHoldingsView` — `portfolio_analytics_views.py:211-229`. */
export interface HoldingRow {
  symbol: string;
  company_name?: string | null;
  industry?: string | null;
  industry_reason?: string | null;
  quantity: string | number;
  avg_cost: Money;
  current_price: Money;
  market_value: Money;
  unrealized_pnl: Money;
  unrealized_pnl_pct: number | null;
  weight_pct: number | null;
  price_change_pct: number | null;
  price_missing_reason?: string | null;
  stale?: boolean;
  [key: string]: unknown;
}

export interface HoldingsMeta {
  priced_total_value?: Money;
  unpriced_symbols?: string[];
  weight_covers_all_holdings?: boolean;
  count?: number;
}

/** Placeholder thống nhất cho mọi ô không có dữ liệu. */
export const EM_DASH = "—";

/**
 * `null` khi không có số thật — dùng để phân biệt "chưa có" với 0.
 * `Number("")` là 0 nên phải chặn `""` TRƯỚC khi parse.
 */
export function toNumberOrNull(value: Money): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Định dạng tiền VND.
 *
 * `formatVnd` cũ trong `PortfoliosPage.tsx:13-17` dùng `toLocaleString("vi-VN")`
 * **hardcode** locale và không phân biệt `null` với `0`. Bản này nhận locale từ
 * `useI18n()` và trả `null` khi thiếu dữ liệu để caller tự quyết định hiển thị.
 */
export function formatVnd(value: Money, localeTag: string): string | null {
  const n = toNumberOrNull(value);
  if (n === null) return null;
  return new Intl.NumberFormat(localeTag, {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

/** Định dạng phần trăm, giữ dấu `+` để đọc nhanh chiều tăng/giảm. */
export function formatPct(value: number | null | undefined, localeTag: string): string | null {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const n = Number(value);
  const body = new Intl.NumberFormat(localeTag, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(n));
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${body}%`;
}

export function formatQty(value: string | number, localeTag: string): string {
  const n = toNumberOrNull(value);
  if (n === null) return EM_DASH;
  return new Intl.NumberFormat(localeTag, { maximumFractionDigits: 2 }).format(n);
}

/**
 * Ngày ngắn. `as_of` từ BE là ngày ISO (`portfolio_analytics_views.py:379`),
 * `created_at` là ISO datetime. `new Date("2026-10-13")` parse theo UTC nên ở
 * timezone âm có thể lùi 1 ngày — tách nhánh ngày-thuần để không dịch sai.
 */
export function formatDay(value: string | null | undefined, localeTag: string): string {
  if (!value) return EM_DASH;
  const isPlainDay = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isPlainDay ? new Date(`${value}T00:00:00`) : new Date(value);
  if (Number.isNaN(date.getTime())) return EM_DASH;
  return new Intl.DateTimeFormat(localeTag, { dateStyle: "short" }).format(date);
}

/** Số dư mở đầu về 2 chữ số thập phân — dùng cho input number, không group. */
export function normalizeDecimalInput(value: string): string {
  const cleaned = value.replace(/[^\d.,-]/g, "").replace(/,(?=\d{3}\b)/g, "");
  if (cleaned === "") return "";
  const n = Number(cleaned.replace(",", "."));
  return Number.isFinite(n) ? String(n) : "";
}

/**
 * Chuẩn hoá payload gửi lên `POST/PATCH /workspace/portfolios/`.
 *
 * `field-contract.test.js:154-177` chốt danh sách field writable lấy từ
 * `PortfolioSerializer.Meta.fields` (`serializers.py:96-102`). Gửi thừa field ⇒
 * 400. Gửi `opening_balance: "0"` khi user chưa nhập là **bịa số dư** — model
 * phân biệt `null` (chưa xác định) với `0` (`models.py` help_text của
 * `opening_balance`), nên để `null` khi rỗng.
 */
export function buildPortfolioPayload(input: {
  name: string;
  description?: string;
  openingBalance?: string;
}): Record<string, string | null> {
  const name = input.name.trim();
  const balance = normalizeDecimalInput(input.openingBalance ?? "");
  return {
    name,
    description: (input.description ?? "").trim(),
    opening_balance: balance === "" ? null : balance,
    opening_balance_source: balance === "" ? "" : "manual",
  };
}

/** Chuỗi tiện ích để hiển thị giá trị tiền hoặc `—` khi thiếu. */
export function moneyOrDash(value: Money, localeTag: string): string {
  return formatVnd(value, localeTag) ?? EM_DASH;
}

/** Lớp tiền: `gain` / `loss` / `flat` — ánh xạ sang token màu ở CSS. */
export type Tone = "gain" | "loss" | "flat";

/**
 * Màu tăng/giảm: **xanh = tăng, đỏ = giảm** (chuẩn Bloomberg, Owner chốt
 * 2026-10-07 — L-F08). Token `--pf-gain` / `--pf-loss` giữ nguyên, không đảo.
 */
export function toneOf(value: number | null | undefined): Tone {
  const n = toNumberOrNull(value ?? null);
  if (n === null || n === 0) return "flat";
  return n > 0 ? "gain" : "loss";
}