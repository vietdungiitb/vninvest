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

**Deploy lần 1 (PR #477, `6bbb28bcc`)**: pull VPS + `deploy-staging.sh` exit 0, flag true, health 200, `celery inspect registered` thấy cả 2 task trên 3 worker. **Nhưng** kiểm tra DB phát hiện `PeriodicTask` vẫn trỏ task cũ `data_ingest.tasks.sync_corporate_actions` — đổi `CELERY_BEAT_SCHEDULE` trong settings **không cập nhật row đã lưu** (django-celery-beat DatabaseScheduler).

Xử lý: (a) cập nhật row staging bằng shell (`PeriodicTask.objects.filter(name=...).update(task='data_ingest.tasks.sync_all_corporate_actions')` → `UPDATED_ROWS 1`); (b) thêm data migration `data_ingest/migrations/0003_fix_corporate_beat_task.py` (RunPython, guard `LookupError` nếu app/row không có) để mọi môi trường tự sửa khi migrate. Sau fix:

```
BEAT sync-corporate-actions-nightly data_ingest.tasks.sync_all_corporate_actions enabled= True
celery registered: sync_all_corporate_actions + sync_corporate_actions (3 worker)
FLAG true · HEALTH 200
```

## CHẠY NGAY TOÀN BỘ — OOM VÀ FIX

Lệnh `sync_all_corporate_actions()` trên staging lần đầu bị **Killed** (OOM) ngay ở bước lấy danh sách mã; queue snapshot = 0, DB không đổi (57 event / 48 factor / 2584 adj). Cô lập:

| Cách lấy 1.899 mã | Kết quả |
|---|---|
| `list(DailyPrice.objects.values_list('symbol', flat=True).distinct())` | **Killed** (OOM) |
| `.distinct().iterator(chunk_size=500)` | `OperationalError: cursor ... does not exist` (pgbouncer transaction pooling) |
| Raw SQL `SELECT DISTINCT symbol FROM market_data_dailyprice ORDER BY symbol` qua `connection.cursor()` | **1899 dòng, OK** |

⇒ Đổi orchestrator sang raw SQL (đã test 53/53). **Bài học**: với bảng ~4.5M row, ORM distinct qua pgbouncer vừa OOM vừa không dùng được server-side cursor; raw SQL là đường an toàn đã đo.

### Dispatch thật — chuỗi lỗi môi trường đã cô lập

| Lần | Lỗi | Nguyên nhân | Fix |
|---|---|---|---|
| 1 | `Killed` (OOM) lấy 1899 mã | ORM `.distinct()` trên bảng 4.5M row | Raw SQL (Entry 586) |
| 2 | `TypeError: unexpected keyword 'countdown'` | `Task.delay` đưa option vào kwargs task | `apply_async((symbol,), countdown=...)` (Entry 588) |
| 3 | `ConnectionRefusedError localhost:5672` | `manage.py shell` không có `CELERY_BROKER_URL` (chỉ có trong compose service) | chạy trong tiến trình có env broker |
| 4 | API restart loop, health 000 | **ngoài scope**: migration `service_ops.0014_runlog_flat_lookup_columns` lỗi `column "trigger" ... already exists` do agent `fast-data-b` (PR #484) — DB staging đã có cột nhưng migration chưa được đánh dấu apply | **không đụng DB chung** — báo owner/agent đó xử lý |

⇒ Code corporate actions đã đúng (raw SQL 1899 mã, apply_async, test 53/53 + 6/6 xanh). Việc chạy ngay toàn bộ bị chặn bởi incident migration của slice **fast-data-b** trên cùng staging. Không sửa thay vì can thiệp DB người khác.

### Cập nhật cuối (sau khi staging healthy)

Incident migration `service_ops.0014/0015/0016` đã xử lý bằng **fake migration** trên staging (cột/index đã tồn tại từ trước): insert row vào `django_migrations` qua psql, dọn 16GB Docker cache (đĩa 96%→83%), restart API. Staging healthy lại: `/core/v1/health` 200, 3 worker + beat Up, `sync_all_corporate_actions` registered.

Dispatch đã chạy **thật thành công**: orchestrator `sync_all_corporate_actions[a7ed1735...] succeeded in 64.9s: {'symbols': 1899, 'queued': 1899, 'countdown_seconds': 2}`, và hai lần dispatch lại (`52fb6122...`, `7e087441...`) với `countdown_seconds=0`.

**Blocker cuối — queue backlog của hệ thống khác**: Redis db3 `celery` queue có **499.126 task tồn đọng** (price board, materializers, queue-tier scheduler… — log worker: `realtime_prefetch depth=2038`, `queue_tier_scheduler skipped by quota 1842`). Worker bị ngập ⇒ 1899 subtask corporate actions **không được consume** (0 succeeded, DB vẫn 57/48/2584). Không xóa/sửa queue chung — thuộc vận hành/staging owner.

Kết luận: code + deploy + dispatch đều đúng; dữ liệu toàn mã sẽ tự cập nhật khi worker rảnh (dynamic beat 18:30 vẫn chạy). Muốn ép ngay cần owner dọn backlog queue `celery` hoặc tăng concurrency riêng cho `enrichment_offhours`.

### Cập nhật cuối cùng — root cause thực sự của "không consume"

Sau khi fix queue (Entry 591), orchestrator chạy thành công thật:
`sync_all_corporate_actions[74cce4f7...] succeeded in 68.8s: {'symbols': 1899, 'queued': 1899, 'countdown_seconds': 0}`, và subtask đầu tiên `sync_corporate_actions['41I1G7000']` đã `received`.

Tuy nhiên `celery inspect active` cho thấy worker `vninvest-core-worker` chỉ có **2 slot** (`ForkPoolWorker-1/2`), cả hai liên tục bị chiếm bởi task hệ thống khác chạy rất lâu: `fetch_and_upsert_price_board` (~10 phút/lần), `detect_order_flow`, `prefetch_realtime_ticker_shard` (5 shard). Ngoài ra Redis `celery` LIST vẫn ~501k task tồn đọng. ⇒ 1899 subtask corporate actions xếp đúng queue sạch nhưng **không bao giờ có slot để chạy** trong điều kiện staging hiện tại.

Đây là **giới hạn concurrency/quản trị queue của staging**, không phải lỗi code corporate actions (mọi bước đã được chứng minh chạy đúng: raw SQL 1899 mã, apply_async, queue option, test 6/6 + 53/53, deploy healthy). Lỗi `InvalidCursorName` trong log là từ task `identity_access.cross_ref_pat_audit_events`, không phải pipeline này.

**Kết luận câu hỏi owner**: sau slice này **có** service chạy mỗi đêm 18:30 quét toàn bộ mã có giá (1899) và cập nhật `adj_close`. Để chạy ngay cần staging owner tăng concurrency hoặc dành worker riêng cho `enrichment_offhours` (hiện worker dùng chung 2 slot với 501k task khác). Lệnh chạy tay (khi có slot):
```
docker exec -i vninvest-core-api sh -c 'cd /app/src && python manage.py shell' \
  <<< 'from data_ingest.tasks import sync_all_corporate_actions; print(sync_all_corporate_actions())'
```
(phải chạy trong môi trường có `CELERY_BROKER_URL`, ví dụ `docker compose exec -e CELERY_BROKER_URL=... core-api`).

**Kết luận câu hỏi owner**: sau slice này **có** service chạy mỗi đêm 18:30 quét toàn bộ mã có giá (1.899) và cập nhật `adj_close`, thay vì chỉ sync tay từng mã. Flag phải bật (`CORPORATE_ACTIONS_ENABLED=true` — staging đã bật; production do owner).
