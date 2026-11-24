# Đề xuất — Đưa CafeF vào vnbroker làm nguồn SSOT duy nhất cho giá lịch sử

> Ngày: 2026-11-24 · Yêu cầu owner: "dữ liệu chỉ đi qua một nguồn SSOT là vnbroker thay vì rời rạc".
> Tài liệu là **đề xuất kiến trúc**, không sửa code ở vninvest lẫn vnbroker.

## 1. Trạng thái hiện tại (đã đọc code thật)

### vnbroker (repo riêng, branch `feat/cafef-reference`, **in-progress của agent khác**)
- `vnbroker/common/client.py:268` — facade `Vnbroker.reference(name="cafef")`.
- `vnbroker/reference/cafef.py:22-71` — `CafefReference.history(symbol, start, end, interval)` trả frame có `close_raw` + `close_adjusted`; **mặc định `start='2018-01-01'` (`:59`)**; `:73 reconcile()` so sánh provider frame với giá điều chỉnh CafeF.
- `vnbroker/explorer/kbs/quote.py`, `vci/quote.py` — route `adjusted=False` sang CafeF, trả **6 cột tier-1** (`time,open,high,low,close,volume`), `attrs source/data_origin='cafef'`.
- `vnbroker/api/company.py:184` — `corporate_actions()` vẫn chỉ VCI.
- CafeF **không** vào `ProviderRegistry`/AUTO pool (chủ đích — tránh sai kỳ vọng cho intraday).

### vninvest (repo này)
- `market_data/vnbroker_adapter.py:748-769` — `fetch_daily_history` chép `row['close']` provider (**:763**) vào `DailyPrice.close`; không truyền `adjusted`.
- `data_ingest/tasks.py:653-704` — upsert `DailyPrice`, `source='vnbroker_<provider>'` (**:703**).
- `corporate_actions/adjustment.py:100` — tự nhân `adj_close = close × Π factor` ⇒ double-adjust (audit `AUDIT_PRICE_ADJUSTMENT_VNINVEST_20261124.md`).
- `market_data/cafef/{fetcher,parser,importer}.py` (branch `feat/cafef-ref`) — **đang tự fetch/parse CafeF ngay trong vninvest**, tức là nguồn thứ 2 rời rạc.

## 2. Khoảng trống so với mục tiêu SSOT

| # | Khoảng trống | Bằng chứng | Hệ quả |
|---|---|---|---|
| G1 | CafeF vẫn là "reference opt-in", vninvest tự parse riêng | `vnbroker/reference/cafef.py:22-27`; vninvest `market_data/cafef/*` | 2 bộ parse/unit/date-format, dễ phân kỳ |
| G2 | Route `adjusted=False` chỉ trả 6 cột, **mất `close_adjusted`** | plan `PLAN_CAFEF_REFERENCE...md:85-92` (AC-5/5b) | Không điền được cả 2 cột `close`/`adj_close` trong 1 lần gọi |
| G3 | `CafefReference.history` chỉ 1 mã/lần, default 2018 | `cafef.py:36-60` | Không backfill toàn thị trường; tiền đề "CafeF chỉ đến 2018" sai (đo thực có từ 2011) |
| G4 | Không có cột provenance/basis trong frame tier-1 (chỉ có `attrs`) | plan AC-5b `:85` | vninvest không biết chắc dòng nào raw/adjusted để lưu |
| G5 | Corporate event tự tính factor trong vninvest; vnbroker chỉ có `reconcile` thụ động | `adjustment.py:100`; `cafef.py:73` | Không có vòng "sự kiện mới → re-fetch chuỗi adjusted" |

## 3. Đề xuất trên vnbroker (SSOT)

### 3.1 API mới duy nhất cho giá lịch sử
```
Vnbroker.daily_bars(
    symbol: str | "ALL", start: str, end: str,
    exchange: str = "HOSE",
    basis: "raw" | "adjusted" | "both" = "both",
) -> CanonicalPriceFrame
```
Frame **một định dạng** (khác tier-1 để tránh nhầm):
`time, open_raw, high_raw, low_raw, close_raw, close_adjusted, volume, value, put_through_volume, put_through_value, source='cafef', price_basis, fetched_at`, tz `Asia/Ho_Chi_Minh`.

- `basis='both'` lấy thẳng 2 cột từ CafeF `GiaDongCua`/`GiaDieuChinh` (×1000 / ×1e9).
- `basis='raw'` / `'adjusted'` chỉ lọc cột — **cùng một code path**.
- Route `adjusted=False` hiện tại của KBS/VCI gọi lại `daily_bars(basis='raw')` ⇒ bỏ được nhánh helper trùng (giữ `attrs` để tương thích).

### 3.2 Mở rộng CafeF reference cho backfill
- `CafefReference.history(symbol="ALL", exchange=...)` / `bulk_year(exchange, year)` dùng **XLSX export 1 năm** (đã đo: 4,47 MB / 101.756 dòng HOSE 2022, 3 s tải, ~20 s parse; gộp 3 sàn phủ 98,6% DB 2022).
- Đổi default `start` từ `2018-01-01` (`cafef.py:59`) sang năm sớm nhất có dữ liệu (**2011**, đã probe).
- Giữ JSON pagination làm fallback cho 1 mã/ngày ngắn.

### 3.3 Reconcile chủ động
- `Vnbroker.reconcile_prices(symbol, start, end)` → `ReconcileReport` (tỷ lệ `provider_adjusted / cafef_adjusted`, mean/std, `flagged_dates`, verdict rebase).
- Khi có sự kiện mới, vninvest gọi hàm này; nếu verdict "rebase" ⇒ re-fetch `daily_bars(basis='both')` cho mã đó. **Không tự nhân factor.**

### 3.4 Vai trò các provider sau khi chuẩn hóa
| Provider | Vai trò trong vnbroker |
|---|---|
| **CafeF** | SSOT cho **daily OHLC raw + adjusted**, turnover, put-through (từ 2011) |
| VCI | corporate actions, listing, realtime/gap-chart, cross-check |
| KBS | realtime, cross-check; không còn là nguồn giá lịch sử canonical |
| AUTO pool | giữ nguyên (CafeF **không** vào pool — tránh sai kỳ vọng intraday) |

## 4. Đề xuất trên vninvest (sau khi vnbroker merge)

1. Xoá fetch/parse CafeF khỏi vninvest (`market_data/cafef/fetcher.py`, `parser.py`, `importer.py`); giữ lại model `CafefDailyPrice` làm bảng đệm hoặc thay bằng cột mới.
2. `vnbroker_adapter.py:748-769` gọi `Vnbroker.daily_bars(..., basis='both')` thay vì tự lấy `close` provider.
3. `data_ingest/tasks.py` map: `close ← close_raw`, `adj_close ← close_adjusted`, thêm `price_source`, `is_adjusted=True`.
4. `corporate_actions/adjustment.py:100` **ngừng ghi `adj_close`**; giữ `AdjFactor` cho overlay + kiểm chéo.
5. Migration: backfill qua `daily_bars(basis='both', symbol='ALL')` → dry-run diff → apply theo `(exchange, year)`, backup/rollback.

## 5. Điều kiện / rủi ro
- vnbroker đang có claim `cafef-reference` **in-progress** ⇒ không đụng branch đó; đề xuất này là slice tiếp theo sau merge.
- Cần owner chốt: ToS/rate-limit, bump version vnbroker, default UI hiển thị raw hay adjusted, 1,4% `(symbol,date)` CafeF không phủ.
- Test bắt buộc assert **ngày**, không chỉ giá (bài học B-1 của vnbroker: nến 1970 vẫn xanh nếu chỉ assert close).

## 6. Kết luận
SSOT đúng là **vnbroker**, nhưng không phải bằng cách đăng ký CafeF vào provider pool — mà bằng cách đưa CafeF thành nguồn giá lịch sử canonical **bên trong vnbroker**, phơi một API `daily_bars(basis='both')` duy nhất. vninvest chỉ gọi API đó và ngừng tự tính `adj_close`. Đây là slice P0 riêng, cần plan + audit độc lập ở cả 2 repo trước khi code.
