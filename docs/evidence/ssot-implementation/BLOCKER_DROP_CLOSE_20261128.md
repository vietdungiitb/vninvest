# BLOCKER — xoá `DailyPrice.close` (2026-11-28)

**Quy tắc 3 lần thử đã cạn**: Rev.1 → REJECT (5 objection), Rev.2 → NEED_REVISION (4), Rev.3 → NEED_REVISION (2). Phải dừng, trả partial state, không code/migrate.

## 2 objection cuối (chưa đóng)

1. **Inventory vẫn sót 3 consumer chết khi DROP**
   - `market_serving/native_views.py:583` — `float(dp.close)`.
   - `market_data/corporate_actions/adjustment.py:27,172,176,233` — hệ số/prev_close vẫn đọc `close`.
   - `market_data/cafef/integrity.py:162` — `fields` gồm `'close'`.
   ⇒ AC3 "grep không còn query close" chưa tái tạo được.

2. **Policy NULL chưa phủ**
   - `market_data/pricing.py:64` (`effective_ohlc`) vẫn đọc `close` dù đã sửa `effective_close`.
   - `advisory/advisory_helpers.py:239`, `user_workspace/screener_helpers.py:391` ép `None` → `0` ⇒ giá 0 giả.
   - `cafef/integrity.py:82,111-113` mất `close` ⇒ `factor_close_mismatch` vô hiệu âm thầm; `adj_close_null` chưa có trong `VIOLATION_CODES` (`:28-36`) dù plan nói đã đếm.

## Trạng thái

- Branch `feat/drop-close-rev2`: **chỉ claim + 3 bản plan/audit**, **0 dòng source/data đổi**.
- Staging giữ nguyên: `PRICE_ADJUSTED_DISPLAY=1`, `PRICE_MIGRATION_PAUSED=0`, integrity `ok=true`, 3.671.729 dòng có `adj_basis`.
- Không tự sửa plan lần 4; cần Owner/Owner-reviewer chỉ đạo lại trước khi mở slice mới.

## Hướng xử lý đề xuất (chỉ đề xuất, chưa làm)
- Gộp toàn bộ inventory thành **1 danh sách grep có lệnh tái hiện** (không viết tay theo nhóm) trước khi viết AC.
- Đổi `VIOLATION_CODES` + collector `integrity.py` sang `adj_close` làm nền tảng so sánh factor; thêm `adj_close_null` (không violation).
- Consumer ép `None → 0` phải đổi sang `continue` (bỏ dòng), không trả 0.
- Vẫn cần Owner nhắc lại quyết định bác rename (đã ghi Entry 688) — blocker này là **thực thi**, không phải đổi ý kiến.
