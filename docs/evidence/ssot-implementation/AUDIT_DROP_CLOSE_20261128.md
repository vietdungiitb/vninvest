# Audit kế hoạch xoá `DailyPrice.close` — VERDICT: **REJECT** (2026-11-28)

**Auditor**: subagent read-only. Đọc `PLAN_DROP_CLOSE_20261128.md` + source thật. **Không code, không migrate.**

## 5 objection chặn

| # | Mức | Objection (file:line) |
|---|---|---|
| 1 | P0 | AC2 `close = adj_close` mâu thuẫn contract test: `test_m5_chart_points.py:30,50,70`, `test_ohlcv_bars_native_api.py:488` assert giá thô (42750/43100/100000), `adj_close` khác. FE `chartAdapter.js:53,56-59` dùng close làm fallback O/H/L ở nhánh raw ⇒ nến méo |
| 2 | P0 | Đổi mọi `values('close')` sang adj phá **semantic raw**: `corporate_actions/adjustment.py:23-27,176,233` cần raw cho hệ số; `vnbroker_materializer.py:107,195-201,247`, `market_serving/materializers.py:83,113-117` cần raw cho trần/sàn. `raw_close` chỉ phủ ~50% ⇒ không có nguồn thay |
| 3 | P0 | Sót writer/obj: `tasks.py:817-823` (`update_fields` chứa `'close'`), `price_migration_persist.py:184`, `models.py:115` (`__str__`), `admin.py:53` (`list_display` → E108), `serializers.py:23`, `pricing.py:41,49` (`raise` khi thiếu close) |
| 4 | P1 | Backup không tái tạo được: chỉ 4 cột, không row-count/checksum/snapshot ID; DROP cột 4.608.523 dòng là table rewrite/lock mà không có plan lock/thời gian |
| 5 | P1 | Sót consumer: `advisory/views.py:969`, `portfolio_analytics_views.py:598` (dùng raw cố ý để tránh double-count NAV), `tasks.py:3752-3758`, `backfill_ceiling_floor.py` (ngoài `backend/src`) |

## Kết luận

**Không implement slice này.** `REJECT` là verdict cuối theo quy tắc 3 vòng; phải trả partial state (chỉ plan + audit), không tự sửa định nghĩa để qua gate.

## Mâu thuẫn gốc cần Owner chốt trước khi mở lại

Owner vừa chốt "xóa cột `close`", nhưng cùng lúc hệ thống **vẫn cần raw price** cho:
- trần/sàn giá (`vnbroker_materializer.py`, `backfill_ceiling_floor.py`),
- hệ số corporate action (`adjustment.py`),
- contract test/FE nhánh raw.

Ba lựa chọn:
1. **Giữ `close`** (không xoá) nhưng đổi tên ngữ nghĩa thành `raw_close` thông qua migration `RenameField` + backfill — **không mất dữ liệu**, không phá contract bên trong.
2. **Thêm `raw_close`, backfill đủ 4,6M dòng** từ CafeF/provider, đổi consumer raw sang `raw_close`, rồi mới xoá `close` — cần nguồn raw cho ~2,3M dòng hiện không có trong `CafefDailyPrice`.
3. **Chấp nhận bỏ raw hoàn toàn** — phải định nghĩa lại trần/sàn + hệ số sự kiện theo adjusted price, sửa contract test + FE, rủi ro sai giá sàn/trần cao.

Khuyến nghị: **(1)** hoặc **(2)**. Không làm (3) khi chưa có phản chứng bằng dữ liệu thị trường.

Partial state: branch `feat/drop-close-column` chỉ có claim + plan + audit, **0 dòng source/data đổi**.
