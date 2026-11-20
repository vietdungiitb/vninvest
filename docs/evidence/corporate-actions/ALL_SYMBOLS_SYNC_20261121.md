# Service đồng bộ điều chỉnh cho TOÀN BỘ mã (2026-11-21)

- **Claim**: `corp-actions-all-symbols` (`45717afc4`) · **Branch**: `feat/corp-actions-all-symbols`.

## VẤN ĐỀ PHÁT HIỆN

Trước slice này:

- Có `sync_corporate_actions(symbol, ...)` — sync 1 mã, chạy tay được (đã E2E VNM).
- Beat `sync-corporate-actions-nightly` (18:30) gọi **chính task đó** nhưng kwargs chỉ có `_scheduler_job_key` ⇒ **thiếu `symbol` bắt buộc** ⇒ mỗi đêm sẽ `TypeError`, không có service nào cập nhật toàn bộ mã.
- Không có orchestrator nào dispatch theo danh sách mã.

## GIẢI PHÁP

Thêm `sync_all_corporate_actions(symbols=None, countdown_seconds=2, _scheduler_job_key=None)` trong `data_ingest/tasks.py`:

- Flag off → `{'skipped': True}` (không đụng hàng đợi).
- Mặc định lấy `sorted(set(DailyPrice.objects.values_list('symbol', flat=True).distinct()))` — **1.899 mã đang có giá** trên staging (đo bằng `manage.py shell`, lệnh trong §Gates). Có thể truyền `symbols=` để chạy subset.
- Dispatch `sync_corporate_actions.delay(symbol, countdown=index*2)` — giãn 2s/mã ⇒ không bắn ~1.900 request VCI cùng lúc; mỗi mã là subtask riêng, một mã lỗi không dừng cả đêm.
- Beat đổi target sang orchestrator; kwargs vẫn chỉ `_scheduler_job_key`.

## TEST FAIL-BEFORE → PASS

- Trước: `ImportError: cannot import name 'sync_all_corporate_actions'` (3 test mới đỏ).
- Sau: **sync task 6/6**, **pipeline 6 module 71/71 OK**.
- Test ghim:
  - `test_orchestrator_dispatches_every_price_symbol` — 2 mã có DailyPrice ⇒ delay đúng 2 mã.
  - `test_orchestrator_flag_off_skips` — flag off ⇒ không queue.
  - `test_beat_kwargs_can_invoke_orchestrator` — lấy đúng entry từ `settings.CELERY_BEAT_SCHEDULE`, gọi `task(**kwargs)` ⇒ không TypeError (chặn regression beat).

## FULL BE — 0 REGRESSION (có hiệu chỉnh thời gian)

| Cây | Thời điểm chạy | Failures | Errors |
|---|---|---:|---:|
| Baseline `165cdc8d2` | tối 20/11 | 35 | 221 |
| Cây slice này | rạng 21/11 | 36 | 221 |

1 fail mới: `data_ingest.tests.test_tasks...test_warm_intraday_universe_consumes_plan_items_and_persists_rows` (`'warm' != FRESH`). **Chạy lại chính test này trên baseline `165cdc8d2` tại cùng thời điểm → CŨNG FAIL** ⇒ do đổi ngày/freshness, **không phải regression**. So sánh tên fail/error giữa 2 cây tại cùng thời điểm: chỉ khác mục time-dependent này.

Ngoài ra sửa 1 test flakes theo đồng hồ container: fixture bars dùng `date.today()-1` ⇒ đổi sang `date(2024,1,2)` cố định (staging clock lệch ngày làm `bars=0`).

## GATES

- 1.899 mã có giá / 1.400 profile active — lệnh:
  `manage.py shell -c "from market_data.models import DailyPrice, StockProfile; print(DailyPrice.objects.values_list('symbol',flat=True).distinct().count(), StockProfile.objects.filter(status='active').count())"`
- `check-multi-agent` exit 0; pipeline 71/71; full BE so baseline như bảng trên.

## DEPLOY + VERIFY SAU MERGE

*(cập nhật sau khi merge/deploy: pull VPS, `deploy-staging.sh`, `celery inspect registered` phải thấy `data_ingest.tasks.sync_all_corporate_actions`, `django_celery_beat` periodic task `sync-corporate-actions-nightly` trỏ đúng orchestrator).*

**Kết luận câu hỏi owner**: sau slice này **có** service chạy mỗi đêm 18:30 quét toàn bộ mã có giá (1.899) và cập nhật `adj_close`, thay vì chỉ sync tay từng mã. Flag phải bật (`CORPORATE_ACTIONS_ENABLED=true` — staging đã bật; production do owner).
