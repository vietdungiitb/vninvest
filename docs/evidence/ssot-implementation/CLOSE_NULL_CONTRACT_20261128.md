# Đề xuất contract mới: `close` = reference (nullable), `adj_close` = giá hệ thống (2026-11-28)

## 1. Nguyên tắc Owner nêu
> `close` đúng ra là `None`; `adj_close` là giá VCI/KBS cung cấp; raw close chỉ lấy từ CafeF để tham chiếu/đối chiếu (raw như nhau ở mọi provider).

**Tôi đồng thuận về nguyên tắc.** Nhưng hiện trạng code/DB chưa theo contract đó.

## 2. Hiện trạng đo được

| Hạng mục | Số liệu / file:line |
|---|---|
| `DailyPrice.close` | `models.py:74` = `DecimalField(...)` **KHÔNG null** |
| Dòng có `close` | **4.608.523 / 4.608.523** (0 NULL) trên staging |
| `CafefDailyPrice.close_raw` | 2.308.756 dòng, **100% có giá trị** — nhưng chỉ phủ ~50% số dòng DailyPrice |
| `adj_close` non-null | 3.678.498 dòng (sau Anchor A + vintage) |
| Flag | `PRICE_ADJUSTED_DISPLAY=1` đã bật theo Owner |

## 3. Mức độ phụ thuộc `close` (grep toàn backend)

- `pricing.py:41,49` — fallback trả raw; `raise ValueError` nếu close None.
- `stock_mgmt_native_views.py:597,613,622,1009,1034,1047,1641,1671,1683-1688,1908-1909,2049,2148,2166,2241,2288,4204,4274,4300-4301,4317,4333` — chart/W-M/NAV/reference price/technical đều đọc `close`.
- `market_serving/vnbroker_materializer.py:97,104` — reference price/trần-sàn.
- `advisory/views.py:969`, `service_ops/screener_bridge.py:131`, `service_ops/views/screener.py:595-596`.
- `cafef/rebase.py:43-44,77`, `cafef/integrity.py:82,162`, `cafef/persist.py`, `price_migration_diff.py`, `price_migration_persist.py`, `anchor_a_relabel.py:51`.
- `corporate_actions/adjustment.py:27,172,176,233` — `prev_close`/`base_close` lấy từ `close`.
- FE `chartAdapter.js:55-58` — dùng `p.close` khi không scale.

⇒ Không thể set `close=NULL` đại trà khi chưa chuyển consumer sang `effective_close`/`adj_close`; `pricing.py:49` sẽ raise và nhiều endpoint trả `None`/0.

## 4. Rủi ro dữ liệu
- Nếu `close=NULL` cho toàn bộ 4,6M dòng ⇒ **mất raw price** của ~2,3M dòng không có bản ghi `CafefDailyPrice`. Owner nói raw lấy từ CafeF — nhưng bảng đối chiếu mới phủ một nửa lịch sử.
- `compute_event_factor` hiện dùng `prev.close` (`adjustment.py:172`); nếu close None ⇒ phải đổi sang `CafefDailyPrice.close_raw` hoặc `adj_close` tùy định nghĩa công thức.

## 5. Lộ trình đề xuất (3 phase, mỗi phase claim + TDD + audit riêng)

**Phase A — Contract an toàn (không đổi dữ liệu)**
1. Migration: `DailyPrice.close` → `null=True` (cho phép nhưng chưa set NULL). Số migration do `makemigrations` sinh.
2. Thêm `raw_close` nullable vào `DailyPrice` (hoặc dùng `CafefDailyPrice.close_raw` làm SSOT raw — cần Owner chọn).
3. Đổi mọi consumer đọc `close` sang `effective_close`/`adj_close` với fallback trung thực; bỏ `raise ValueError` (`pricing.py:49`).
4. Test fail-before + gate + B8 audit.

**Phase B — Backfill & chuyển giá trị (có backup)**
1. Đảm bảo `adj_close` có cho mọi dòng sẽ display (hiện 3,68M/4,61M — còn ~0,93M thiếu).
2. Sao lưu `close` sang bảng ops; chỉ sau đó `UPDATE close=NULL WHERE adj_close IS NOT NULL`.
3. Chạy `check_price_integrity`, so sánh random 100 mã trước/sau (giá hiển thị phải không đổi).
4. Rollback SQL có sẵn.

**Phase C — FE/contract**
1. Bỏ `p.close` fallback trong `chartAdapter.js`; nếu thiếu `adj_close` thì bỏ nến + nhãn `missing_adjusted`.
2. Bỏ nhãn `price_basis='adjusted'` cứng (`stock_mgmt_native_views.py:2069`) — suy theo dữ liệu (đã ghi ở `FLAG_ON_20261128.md`).
3. E2E browser (đang blocked bởi baseline widget) — cần xử lý riêng.

## 6. Quyết định cần Owner
1. Raw price SSOT: **`CafefDailyPrice.close_raw`** (đã có, phủ 2,3M) hay thêm **`DailyPrice.raw_close`** và backfill từ provider?
2. Có chấp nhận phase B set `close=NULL` cho ~3,68M dòng sau backup không? (Thay đổi irreversibility cao.)
3. Với ~0,93M dòng chưa có `adj_close`: bỏ khỏi hiển thị hay fetch bổ sung từ provider trước?

## 7. Reservation
Tôi chưa đổi code/data. `PRICE_ADJUSTED_DISPLAY=1` đang bật; contract hiện tại vẫn trả `close` cho phần thiếu adj. Trung thực ghi nhật ký này trước khi đề xuất triển khai.
