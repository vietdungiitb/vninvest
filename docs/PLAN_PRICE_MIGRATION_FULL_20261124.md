# BÁO CÁO PHƯƠNG ÁN CHUYỂN ĐỔI TOÀN BỘ DỮ LIỆU GIÁ SANG CHUẨN THỊ TRƯỜNG (2026-11-24)

> Trạng thái: **ĐỀ XUẤT — chờ owner chốt thứ tự + phạm vi**. Không code trong tài liệu này.
> Nền tảng: audit `AUDIT_PRICE_ADJUSTMENT_VNINVEST_20261124.md`; researcher fan-out (phiên 2026-11-24, chỉ đọc); staging đã backfill `CafefDailyPrice` 101.756 dòng HOSE 2022; vnbroker 3.9.0 `daily_bars(basis='both')`.

## 1. Mục tiêu & nguyên tắc

Đưa `DailyPrice` về đúng semantics thị trường: `close` = **giá thô** (`Giá đóng cửa` CafeF), `adj_close` = **giá đã điều chỉnh** (`Giá điều chỉnh` CafeF), cập nhật ở **mọi field đã có** (`open/high/low/close/volume/value/change_pct/source/is_adjusted`) và mọi bảng dẫn xuất, đồng bộ toàn thị trường.

**Nguyên tắc cứng**
1. Không big-bang — chuyển theo lô `(exchange, year)`, có backup + rollback từng lô.
2. Không đổi basis một nửa hệ thống — mọi 🔴 consumer phải đổi/invalidate trong cùng đợt.
3. Nguồn thật là CafeF qua vnbroker 3.9.0; VCI/KBS giữ lại **chỉ drift monitoring**.
4. Không ghi đè dữ liệu user (`Transaction/LedgerEntry/CashFlow/PriceAlert`).
5. Mọi test liên quan phải assert **ngày**, không chỉ giá (bài học nến 1970).

## 2. Số liệu nền (đo thật staging)

| Hạng mục | Số |
|---|---|
| `DailyPrice` | ~4,58 triệu dòng (2011–2026); 2,25 triệu (49,1%) có `adj_close` sai |
| `CafefDailyPrice` hiện có | 101.756 dòng (HOSE 2022, 418 mã), 0 reject |
| Độ phủ CafeF | 2022 gộp 3 sàn 98,6%; riêng HOSE 27,2%; 2011 39,3%, 2015 39,5%, 2018 29,4%, 2020 28,1% |
| Bảng dẫn xuất | `SymbolSnapshot` 66.040 · `IntradayBar` 244.454 · `SessionFacts` 4.439 · `MarketDataParitySnapshot` 33.866 · `AccountSnapshot` 180 |
| Chưa đo | số dòng theo từng provider trong `source`; breakdown DB theo sàn — ghi `CHƯA ĐO`, không suy ra |

## 3. Field mapping (12 cột CafeF → DB)

| CafeF XLSX | DB đích | Chuyển đổi |
|---|---|---|
| `Mã` | `symbol` | upper |
| `Ngày` | `date` | `strptime('%d/%m/%Y')` (response) — request `MM/DD/YYYY` |
| `Giá đóng cửa` | **`close`** | ×1000 (vnbroker đã scale → lấy trực tiếp `close_raw`) |
| `Giá điều chỉnh` | **`adj_close`** | ×1000 (`close_adjusted`) |
| `Giá mở/cao/thấp nhất` | `open/high/low` | ×1000 (`open_raw/high_raw/low_raw`) |
| `Khối lượng khớp lệnh` | `volume` | nguyên |
| `Giá trị khớp lệnh` | `value` | ×1e9 (467,26 → 467.260.000.000) |
| `Thay đổi` | `change_pct` | parse `'%+1,65 (+4,01%)'` → `4.0100` |
| — | `source` | `'cafef'` |
| — | `is_adjusted` | `True` (có nguồn adjusted) |
| `KL/GT thỏa thuận` | **bỏ qua** | ghi rõ drop |
| — | `price_source` (mới) | provenance + guard ingest |

## 4. Fan-out consumer — cái phải đổi / invalidate / giữ

### 4.1 🔴 ĐỔI TRONG CÙNG ĐỢT (render/derive trực tiếp từ `close`)
- **Ghi**: `vnbroker_adapter.py:763` + `data_ingest/tasks.py:703-708,792-798` — cần **source-guard** bỏ qua `(symbol,date)` đã có `price_source='cafef'`, nếu không nightly 17:05 (`settings.py:776-783`) ghi đè cutover.
- **API đọc**: `/chart/` `stock_mgmt_native_views.py:1935-1947` (nến + SMA/RSI); `/bars/` `:4068/:4072`; `/stocks/<sym>/` `:1781-1818` (giá hiện tại, 52w); `daily-prices` `market_data/views.py:147-181` + serializer `:19-26` (đang **không trả `adj_close`** — nên thêm); `technicals/bulk` `:1515` (+ cache 300 s `:1499`); dark-money `:2031-2045`; price-change map `:592-596`.
- **Materializer**: `market_serving/materializers.py:79-140` (`reference_price`→ trần/sàn/%); `vnbroker_materializer.py:102-109,188-237`.
- **Domain**: advisory prompt `advisory_helpers.py:214-237` + backtest `advisory/views.py:963-999`; portfolio NAV/equity/benchmark `portfolio_analytics_views.py:475-561`; screener `_compute_scan` `:3468-3637` + `screener_helpers.py:368-419` + backtest `:4473-4529`.
- **FE**: `adapters/core/market.js:202-247` → `chartAdapter.js:42-60` → `VNStockChartPanel.js`; `ScreenerHistory.tsx:108-115`. Chỉ đổi BE là nến đổi; widget không tự render `adjClose` (đã xác minh bundle).
- **Snapshot lịch sử đóng băng**: `AdvisoryRecord.context_snapshot/structured_output` (`advisory/models.py:118-119`), `ScreenerRunHistory.matched` (`user_workspace/models.py:1134-1135`) — entry/exit trộn basis ⇒ phải gắn `price_basis` cho record mới, record cũ **không tự sửa**.

### 4.2 🟠 INVALIDATE NGAY SAU CUTOVER
- Cache bulk-technicals 300 s (`stock_mgmt_native_views.py:387-401,1499`); SOC inventory 3600 s (`dataops_inventory.py:8-12,220-223`); `SymbolSnapshot` + pre-open 08:40 (`settings.py:656-666`); coverage rows (`global_symbol_coverage.py:363-384`); raw-SQL inventory (`dataops_inventory.py:81-95`); CafeF preview cache 600 s (in-process).
- i18n nhãn "Giá ngày (OHLCV)" `i18n/locales/{vi,en}/soc.js:613,625-627,717` cần cập nhật basis.

### 4.3 🟢 GIỮ NGUYÊN
`IntradayBar/IntradayTick` (nến/tick trong phiên) · quote realtime (`vnbroker_adapter.py:467-616`, giá khớp live) · `SessionFacts`/`SessionFactsBucket` (CVD/whale volume) · `WhaleAlertCanonical` (giá thực thi tick) · alert/signal `value` · `Transaction/LedgerEntry/CashFlow/PriceAlert` (sổ user — chỉ revalue NAV, không ghi đè) · `MarketDataParitySnapshot` (drift monitoring) · gap-chart (**0 callsite** trong repo — không đoán).

## 5. Thứ tự chuyển đổi (7 bước)

| Bước | Việc | Tiêu chí dừng / kiểm chứng |
|---|---|---|
| **S0 Backup** | `pg_dump` toàn `DailyPrice` + bảng dẫn xuất 🔴 vào `/opt/backups/price-migration-20261124/`; ghi checksum + số dòng | dump thành công, checksum khớp, có thể restore thử |
| **S1 Bulk CafeF** | `bulk_year(exchange, year)` cho HOSE/HNX/UPCOM × 2011–2026 (≈51 request XLSX, pacing ≥1 s); ghi `CafefDailyPrice` | per-symbol coverage gate: `TPB 2011 → 'missing'`, không im lặng trả rỗng; tổng đối soát số dòng/năm |
| **S2 Dry-run diff** | So sánh từng `(symbol,date)`: `close cũ→mới`, `adj_close cũ→mới`, `open/high/low`, `value`; sinh báo cáo phân bố chênh + danh sách DB-only | bước nhảy giá **warn + báo cáo** (đã chốt); lệch **unit/ngày ⇒ DỪNG**; drift 0,5% phân loại rebase trước alert |
| **S3 Persist theo lô** | Migration/command ghi `close/adj_close/open/high/low/value/change_pct/source/is_adjusted/price_source` từ `CafefDailyPrice`; **không đụng** phần DB-only (giữ giá cũ + `price_source='unmapped_cafef'`) | mỗi lô `(exchange,year)` có backup riêng; row count sau = row count trước (không mất dòng); idempotent chạy lại `inserted=0` |
| **S4 Ngắt nguồn ghi đè** | Sửa `data_ingest/tasks.py:792-798` + `vnbroker_adapter.py:763`: skip upsert `close` khi `(symbol,date)` có `price_source='cafef'`; `adjustment.py` giữ flag tắt (P0) | chạy nightly giả lập → 0 row `price_source='cafef'` bị đổi; test regression xanh |
| **S5 Invalidate + recompute** | Xoá cache §4.2; chạy lại materializer `SymbolSnapshot` + pre-open; rebuild coverage; refresh inventory | snapshot `reference_price`/`ceiling`/`floor` khớp `close` mới; cache key mới trả số mới |
| **S6 Cutover consumer** | Deploy BE+FE (§4.1) trong cùng release; gắn `price_basis` cho `AdvisoryRecord`/`ScreenerRunHistory` mới | E2E Playwright staging: TPB 2022 nến = 42.750 (raw) hoặc 17.940 (adjusted) tuỳ UI default đã chốt; không trộn basis trong cùng window |
| **S7 Verify + Dọn** | Đối chiếu mẫu 20 mã × 5 năm với CafeF; drift monitoring VCI/KBS chạy 2 tuần; Sau parity: dọn `market_data/cafef/{fetcher,parser}` local, giữ `CafefDailyPrice` làm staging | báo cáo parity có số dòng đổi/phân bố; rollback sẵn sàng trong 2 tuần |

## 6. Rủi ro & giảm thiểu

| Rủi ro | Giảm thiểu |
|---|---|
| Nightly 17:05 ghi đè cutover | S4 source-guard + test giả lập |
| Trộn basis trong window indicator | S6 deploy đồng bộ + không chạy screener/advisory trong lúc chuyển |
| Entry/exit screener/backtest lệch chiều | Gắn `price_basis`; record cũ không tự sửa; đánh dấu |
| Độ phủ năm sâu thấp (per-symbol) | Coverage gate; phần thiếu giữ cũ + cờ; owner duyệt danh sách |
| Disk VPS đầy (đã xảy ra lúc deploy) | Dọn Docker trước S1; pacing; temp cleanup `finally` |
| Sai unit/ngày | Golden TPB `04/01/2022 → 42750/17940/11034900/467260000000`; test assert ngày |

## 7. Điều kiện owner cần chốt thêm
1. UI default: **raw hay adjusted** (đã defer tới P3 — giờ là lúc chốt).
2. Phạm vi năm: all 2011–2026 hay chỉ 2019–2026 (DB dày từ 2019);部分 năm sâu phủ thấp.
3. Chính sách phần DB-only (1,4% 2022, cao hơn các năm sâu): giữ cũ hay loại bỏ.
4. Có chạy lại `ScreenerRunHistory`/`AdvisoryRecord` lịch sử không, hay chỉ gắn nhãn.
5. Ngưỡng chênh cho phép khi so sánh provider drift (đã chốt 0,5% nhưng cần định nghĩa "phân loại rebase").

## 8. Kết luận
Chuyển đổi đúng phải làm **cả chuỗi S0–S7**, không chỉ đổi `close`. Điểm nguy hiểm nhất là nightly ingest ghi đè (S4) và trộn basis trong indicator/backtest (S6). Với backup + lô + dry-run + invalidate, toàn bộ 4,58 triệu dòng có thể chuyển an toàn; phần CafeF không phủ được giữ nguyên và đánh dấu thay vì suy diễn.
