# IMPLEMENTATION PLAN — DataOps Realtime Sync Fix (2026-09-18) — Từ AUDIT + PHẢN BIỆN

**Base:** `ec594e4c` (origin/dev) — `docs/AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` (Entry 115) + `docs/PHAN_BIEN_AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` (Entry 116) — reproduce live `vninvest-dev` 18/09/2026.
**Mục tiêu:** Chấm dứt dispatch EOD lặp (beat crash-loop), tách worker đua queue, refresh coverage thật, heartbeat tiến độ, fix tz next_run, lấp gap bar & parity — để `Dữ liệu vận hành` và `Lịch chạy` đồng bộ chính xác với thị trường thực tế.
**Chuyển giao:** Đội code thực thi không cần hỏi lại. Mỗi slice có **Yêu cầu đạt (DoD)** + **Tiêu chí audit copy-paste** (`grep`/`manage.py`/`docker`/`tsc`) + **Test**. Gate bắt buộc sau mỗi slice.

> **Hiệu chỉnh sau phản biện (Entry 116):**
> - F-BACK-01 PARTIAL: counter không flush là thật nhưng “treo vô hạn” overstatement — run 208 hoàn tất 7h09m (`tasks.py:1700-1748`), B08 tự đóng stale >2h (`tasks.py:1316`). Defect mới: `time_limit=11400` (`tasks.py:1755`) không enforce trên `--pool=solo`.
> - F-BAR-01 REFUTED: bảng `market_data_intraday_bar` tươi tới `2026-09-17 07:59 UTC` 40474 rows; “MAX 2026-05-22” là `GlobalSymbolCoverage:intraday_bars`, audit không query bar. Gap thật Jun–Aug = 0.
> - C2 REFUTED cause: bug là `scheduler_catalog.py:498 remaining_estimate(timezone.now())` + `now+remaining` ra UTC thay vì ICT, không phải `formatNextRun`.
> - R-NEW-01 HIGH beat crash-loop (~5–6 phút, RestartCount 17, ExitCode 0, mem 128m) + last_run_at=None → dispatch lặp EOD 365d.
> - R-NEW-02 HIGH 2 worker cùng `enrichment_offhours` (`core-worker:119` + `core-worker-enrichment:286`) → song song 210/211.
> - R-NEW-03/04/05: time_limit solo, shared celery_task_id, except: pass.

---

## 0. BỐI CẢNH & NGUYÊN NHÂN GỐC (đã chứng minh, reproduce-first)

- **Beat crash-loop (R-NEW-01, HIGH):** `docker inspect vninvest-dev-core-beat` `RestartCount=17`, `OOMKilled=false`, `ExitCode=0`, `mem_limit 128m cpus 0.25` `docker-compose.dev.yml`. `docker logs beat | Select-String "is starting"` beat restart mỗi 5–6 phút (06:45,06:50,06:56,07:01... ICT). Mỗi restart + `PeriodicTask id=42 daily-backfill-prices-1700 last_run_at=NULL total=0 date_changed≈now` → beat coi job quá hạn → dispatch lại EOD toàn thị trường 365d → sinh runs 210/211/212 chồng lấn. `scheduler.py:555 run_now` không liên quan (đã kèm `service_run_log_id` → nhánh `tasks.py:1425`).
- **Song song queue (R-NEW-02, HIGH):** `docker-compose.dev.yml:119` `core-worker` `CELERY_QUEUES=celery,enrichment_offhours,manual_on_demand,analytics_heavy` + `:286` `core-worker-enrichment` `CELERY_QUEUES=enrichment_offhours` cùng solo `concurrency=1` → 2 consumer cùng queue → 2 run backfill song song (210/211 `planned 1942` cùng lúc).
- **Coverage không refresh (F-COVER-01, CONFIRMED):** `_refresh_coverage_for_symbols` định nghĩa `tasks.py:178`, chỉ gọi tại `:771, :898, :1257` (ingest/price-board). `_backfill_daily_prices_impl` `1382-1748` finalize `1700-1730` **KHÔNG** gọi → mọi run qua `backfill_daily_prices` không bao giờ cập nhật `GlobalSymbolCoverage` → `daily_prices latest 2026-09-16 08:00` (`audit_check6.py:25`) lệch DB `MAX 2026-09-17` 4514097 rows.
- **Heartbeat thiếu (F-BACK-01, PARTIAL):** finalize chỉ ghi counter ở cuối `tasks.py:1700-1722`; không flush mỗi N symbols → `BackfillExecutionRun 211/210 running 22:4x completed 0` dù worker đã `POST gap-chart 264 rows` từng mã (APG 06:04:19 → AST 06:04:42). Run 208 vẫn hoàn tất 7h09m, B08 `tasks.py:1316` auto-close stale >2h hoạt động — nên “treo vô hạn” là overstatement, nhưng thiếu heartbeat che tiến độ.
- **time_limit không enforce (R-NEW-03, MEDIUM):** `@shared_task ... time_limit=11400 soft=10800 tasks.py:1755` nhưng `core-worker` chạy `--pool=solo` (không prefork) → hard limit không kill; run 208 vượt 7h09m (>3h10m).
- **Tz next_run (C2, CONFIRMED effect):** DB `crontab id=21 minute=5 hour=17 tz=Asia/Ho_Chi_Minh` (đúng 17:05 ICT). `scheduler_catalog.py:498 remaining_estimate(timezone.now())` + `499 now+remaining` — `timezone.now()` là UTC → `remaining` tính từ UTC → `17:05 UTC` = `00:05 ICT 19-09` (đúng UI). Bug là dùng `timezone.now()` thay vì `now` đã convert ICT.
- **Bar gap (F-BAR-01, PARTIAL):** `market_data_intraday_bar MAX 2026-09-17 07:59 UTC 40474 rows (Sep 8771 + May 31703)` tươi, nhưng `GlobalSymbolCoverage:intraday_bars` stale `2026-05-22`; Jun–Aug 0 rows là gap thật cần điều tra.

---

## 1. KIẾN TRÚC ĐÍCH

```
[settings.CELERY_BEAT_SCHEDULE] SSOT + [PeriodicTask/CrontabSchedule tz=Asia/Ho_Chi_Minh]
        │  beat (stable, không crash-loop, last_run_at được ghi)
        ▼
[workers] 1×enrichment_offhours (dedup lock)  |  manual_on_demand | realtime_prefetch | analytics
        │  backfill_daily_prices — heartbeat mỗi 50 symbols + time_limit enforce + coverage refresh sau 1726
        ▼
[DB] DailyPrice 4514097 | GlobalSymbolCoverage fresh (hook sau backfill) | BackfillExecutionRun completed/inserted realtime | ServiceRunLog/B08 stale-clean
        │
        ▼
[Catalog] scheduler_catalog.py:498 tz-aware next_run (ICT) | DataOps inventory/coverage/tier views
        ▼
[FE] SocSchedulerBoard.tsx 60s poll (Live dot reuse) + SocDataOps* heartbeat bar + caption latest_complete + SLA 90s
```

Self-heal: disable/sai queue/xóa row → ≤5m tự khôi phục (S1/S2 Entry 114 giữ); EOD không dispatch lặp khi beat ổn định.

---

## 2. SLICES & TIÊU CHÍ AUDIT (copy-paste chạy được — đội code tự verify, không hỏi lại)

### SLICE A — Beat crash-loop R-NEW-01 (P0) — BLOCKER, làm đầu tiên

**Mục tiêu:** Beat không còn restart 5–6 phút/lần; `daily-backfill-prices-1700` không dispatch lặp.

**Files:**
- `docker-compose.dev.yml:—` (beat service, `healthcheck`, `mem_limit`, `restart`)
- `packages/core/backend/src/vninvest_core/settings.py:214,569` (beat schedule, tz)
- `packages/core/backend/entrypoint.sh:43` (DatabaseScheduler)
- `packages/core/backend/src/service_ops/beat_reconcile.py` (giữ)

**Yêu cầu đạt (DoD):**
- A1. Tìm nguyên nhân exit: `docker inspect vninvest-dev-core-beat --format '{{.State.ExitCode}} {{.State.OOMKilled}} {{.State.Error}}'`, `docker logs core-beat --tail 200` lúc `is starting`, `healthcheck` `check_scheduler_queue_drift` exit 1 có kill beat? Nếu `mem 128m` quá thấp → tăng `mem_limit: 256m` (dev) hoặc bỏ `healthcheck` khỏi beat (chỉ warn, không `restart: unless-stopped` kill).
- A2. Đảm bảo `PeriodicTask.last_run_at` được cập nhật khi dispatch: nếu `last_run_at` vẫn NULL sau dispatch → bug celery-beat version (cần `celery[sqs]`/`django-celery-beat` upgrade hoặc thêm `PeriodicTask.objects.filter(id=42).update(last_run_at=timezone.now())` trong task wrapper). Ít nhất: sau 1 dispatch thủ công `python manage.py shell -c "from data_ingest.tasks import backfill_daily_prices; backfill_daily_prices.delay(days=1)"` thì `PeriodicTask.total_run_count` tăng.
- A3. Beat uptime ≥15 phút không restart; `docker inspect RestartCount` không tăng sau 15m.
- A4. Không còn sinh runs `daily-backfill` chồng mỗi 5 phút khi idle (chỉ 1 run/24h hoặc khi `last_run_at` + interval).

**Tiêu chí audit (copy-paste):**
```bash
# 1. Beat không crash-loop
docker inspect vninvest-dev-core-beat --format 'RestartCount={{.RestartCount}} OOM={{.State.OOMKilled}} Exit={{.State.ExitCode}}'  # expect RestartCount ổn định sau 15m, không tăng
docker logs vninvest-dev-core-beat --tail 100 2>&1 | Select-String "is starting" | Select-Object -Last 5  # expect cách nhau >>6 phút hoặc chỉ 1 dòng sau fix
# 2. Không dispatch lặp EOD khi idle
python src/manage.py shell -c "from django_celery_beat.models import PeriodicTask; p=PeriodicTask.objects.get(name='daily-backfill-prices-1700'); print(p.last_run_at, p.total_run_count)"
# Đợi 10 phút idle, check BackfillExecutionRun không tăng:
python src/manage.py shell -c "from service_ops.models import BackfillExecutionRun; print(BackfillExecutionRun.objects.filter(job_key='daily-backfill-prices-1700', created_at__gte='2026-09-18').count())"  # expect 0 hoặc 1, không 3
# 3. Mem/healthcheck
Select-String -Path docker-compose.dev.yml -Pattern "core-beat" -Context 0,15 | Out-String  # check mem_limit/healthcheck đã sửa
```

**Test:** Không thêm test mới cho slice này (infra). Gate `manage.py check` 0 + beat uptime.

---

### SLICE B — Worker queue dedup R-NEW-02 + F-SCHED-01 (P0) — làm sau A, có thể song song C/D/E

**Mục tiêu:** Chỉ 1 worker consume `enrichment_offhours`; chồng lấn 210/211 không tái diễn; `celery_task_id` không dùng chung do redelivery.

**Files:**
- `docker-compose.dev.yml:106-128` (`core-worker` `CELERY_QUEUES`) + `:273-295` (`core-worker-enrichment`)
- `packages/core/backend/src/data_ingest/tasks.py:1755-1772` (`backfill_daily_prices` task def)
- `packages/core/backend/src/service_ops/beat_reconcile.py` / `global_symbol_planner.py:136` (không đổi, chỉ xác minh)

**Yêu cầu đạt (DoD):**
- B1. Tách queue: `core-worker` bỏ `enrichment_offhours` khỏi `CELERY_QUEUES` (chỉ `celery,manual_on_demand,analytics_heavy`); chỉ `core-worker-enrichment` giữ `enrichment_offhours` (solo, concurrency=1). Hoặc nếu giữ 2 worker, thêm **advisory lock** per `job_key` trong `_backfill_daily_prices_impl` đầu hàm: `cache.add(f"scheduler:inflight:{job_key}", task_id, timeout=7200)` → nếu `False` → `return skipped_dedup`.
- B2. Xác minh không tạo `job_key=''` từ queue-tier: `global_symbol_planner.py:136` hiện không truyền `_scheduler_job_key` → đúng là không tạo `job_key` (R-NEW-01 xác nhận) — không cần sửa, chỉ ghi comment `# non-beat path writes job_key='' by design`.
- B3. `acks_late` + `visibility_timeout`: `backfill_daily_prices` hiện **không** `acks_late` (mặc định False) → đúng là không redelivery do ack sớm; nhưng 210/212 share `celery_task_id` ~62 phút cách nhau (≈ `visibility_timeout 3600s`) vẫn nghi. Thêm `acks_late=True` + `reject_on_worker_lost=True` cho `backfill_daily_prices` nếu chấp nhận rerun, hoặc giữ False và log `request.id` khi create `BackfillExecutionRun` để audit.
- B4. Sau fix, chạy 2 lần `backfill_daily_prices.delay(days=1)` liên tiếp → lần 2 `skipped_dedup` hoặc queued nhưng không song song (1 worker).

**Tiêu chí audit:**
```bash
# 1. Chỉ 1 consumer enrichment_offhours
Select-String -Path docker-compose.dev.yml -Pattern "CELERY_QUEUES.*enrichment" | ForEach-Object { "$($_.LineNumber): $($_.Line)" }  # expect 1 dòng (enrichment worker) sau fix
docker ps --format "{{.Names}} {{.Status}}" | Select-String "worker"  # expect 6-7 workers, chỉ enrichment có queue đó
# 2. Dedup lock có mặt
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "scheduler:inflight" | Select-Object -First 5  # expect hits (B1 hoặc tests đã có tasks.py:1083)
# 3. Không song song
python src/manage.py shell -c "from service_ops.tasks import reconcile_stale_running_service_run_logs; print('B08 queue', reconcile_stale_running_service_run_logs)"  # sanity
# Trigger test manual: gửi 2 beat delay cách 1s, check 1 running + 1 skipped/queued không song song (xem BackfillExecutionRun status)
```

**Test (BE):** `service_ops/tests/test_soc_tasks.py:1083,1110` đã có `cache scheduler:inflight:daily-backfill-prices-1700` (stale-pending/queued). Thêm `test_enrichment_offhours_single_consumer_dedup` — gửi 2 lần `backfill_daily_prices.delay` → assert thứ 2 `skipped_dedup` hoặc `count running ==1`. Gate `python src/manage.py test service_ops.tests.test_soc_tasks --keepdb` PASS.

---

### SLICE C — Coverage refresh F-COVER-01 (P0/P1) — có thể làm song song B sau khi A ổn định

**Mục tiêu:** Mọi EOD run dispatch qua `backfill_daily_prices` đều cập nhật `GlobalSymbolCoverage` → UI không còn `latest 2026-09-16` lệch `2026-09-17`.

**Files:**
- `packages/core/backend/src/data_ingest/tasks.py:178` (`_refresh_coverage_for_symbols` def) + `:771,898,1257` (existing calls) + `:1382-1748` (`_backfill_daily_prices_impl` — chỗ thiếu)
- `packages/core/backend/src/market_data/global_symbol_coverage.py` (build summary)
- `packages/core/backend/tests` nếu cần

**Yêu cầu đạt (DoD):**
- C1. Trong `_backfill_daily_prices_impl` sau khi `transaction.atomic` commit `DailyPrice` (sau `tasks.py:1726` — sau `bulk_create`/`bulk_update` và trước `return`), gọi: `coverage_refreshed = _refresh_coverage_for_symbols(affected_symbols)` với `affected_symbols = [s for status in per_symbol_results if status inserted/updated]`. Bắt `try/except: logger.exception("coverage refresh failed")` không làm fail run (coverage là best-effort).
- C2. `affected_symbols` deduplicate; nếu rỗng → không gọi (tránh full refresh 1942 khi fail toàn bộ).
- C3. Không gọi `full_refresh` toàn 1942 nếu chỉ 1059 symbols có data — chỉ refresh `affected_symbols` (tiết kiệm).
- C4. Đảm bảo không double-call khi `ingest_daily_prices` đã gọi (không liên quan — đường này là backfill).

**Tiêu chí audit:**
```bash
# 1. Impl có gọi refresh
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "_refresh_coverage_for_symbols" | Select-Object -First 10  # expect hits tại 178,771,898,1257 và THÊM 1 hit trong 1726-1740 (impl)
# Lấy đoạn 1720-1735:
#   coverage_refreshed_symbols = _refresh_coverage_for_symbols(...)
#   logger.info("coverage refreshed %s", len(coverage_refreshed_symbols))
# 2. Không gọi full table khi rỗng
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "if affected_symbols" -Context 0,2 | Out-String
# 3. Live verify sau 1 EOD run nhỏ (3 symbols) — coverage latest nhảy:
python src/manage.py shell -c "from data_ingest.tasks import _backfill_daily_prices_impl; _backfill_daily_prices_impl(days=1, symbols=['HPG','VNM','FPT'], job_key='test-cover')"
python src/manage.py shell -c "from django.db import connection; c=connection.cursor(); c.execute(\"SELECT latest_available_at, latest_complete_trade_date FROM market_data_globalsymbolcoverage WHERE dataset='daily_prices' ORDER BY updated_at DESC LIMIT 1\"); print(c.fetchone())"  # expect 2026-09-17/18
```

**Test (BE):** Thêm `test_backfill_refreshes_coverage` trong `service_ops/tests/test_dataops_coverage.py` (hoặc `test_soc_tasks.py`) — tạo 3 symbols DailyPrice mới, gọi `_backfill_daily_prices_impl(days=1, symbols=[...])`, assert `GlobalSymbolCoverage` `latest_complete_trade_date` cập nhật. Gate `python src/manage.py test service_ops.tests.test_dataops_coverage --keepdb` PASS.

---

### SLICE D — Heartbeat + time_limit + observability F-BACK-01 / R-NEW-03/04/05 (P1) — có thể song song C

**Mục tiêu:** UI “Đang chạy 0/1942” có tiến độ realtime; `time_limit` có hiệu lực; log không nuốt lỗi.

**Files:**
- `packages/core/backend/src/data_ingest/tasks.py:1382-1772` (`_backfill_daily_prices_impl` loop + `backfill_daily_prices` task def `:1755` + `soft_time_limit` handler `:1787-1823`)
- `packages/core/backend/src/service_ops/tasks.py:232,1307` (B08 stale + reconcile)
- `packages/core/backend/src/service_ops/models.py` (`BackfillExecutionRun`, `ServiceRunLog`)

**Yêu cầu đạt (DoD):**
- D1. **Heartbeat mỗi N symbols (50):** trong loop `per_symbol_results` (khoảng `tasks.py:1525` log `"%d symbols"`), sau mỗi `50` hoặc mỗi `30s` (whichever first), `UPDATE service_ops_backfillexecutionrun SET completed_symbols_count=..., failed_symbols_count=..., inserted_rows=..., updated_at=NOW() WHERE id=run.id` + `UPDATE service_ops_servicerunlog SET output_summary=...`. Dùng `transaction.atomic` + `F()` hoặc `filter(id=...).update(...)` để không block.
- D2. **time_limit enforce:** `backfill_daily_prices` đang `time_limit=11400 soft=10800` nhưng solo pool không kill. Fix: (a) đổi `core-worker-enrichment` sang `--pool=prefork --concurrency=1` (khuyến nghị) để hard limit kill, HOẶC (b) giữ solo và thêm soft-limit handler đã có `tasks.py:1787` `SoftTimeLimitExceeded` → `output_summary reason=soft_time_limit_exceeded` + `status=failed` + `logger.error`. Chọn (a) cho dev (đổi 1 dòng `docker-compose.dev.yml:295 command ["worker","--pool=prefork"]`).
- D3. **celery_task_id audit:** khi tạo `BackfillExecutionRun`, ghi `run.celery_task_id = self.request.id` (bind=True) ngay đầu `backfill_daily_prices` (`tasks.py:1758` đổi `bind=True`). Nếu không bind, log `task_id` trong `ServiceRunLog.input_summary`.
- D4. **except: pass → logger.exception:** `tasks.py:1451-1452, 1453-1454, 1723-1724, 1745-1746` (R-NEW-05 LOW) đổi `except Exception: pass` → `except Exception: logger.exception("backfill ...")`.
- D5. **B08 giữ nguyên** `tasks.py:232 reconcile_stale_running_service_run_logs` `stale_grace 900s` auto-close >2h — không đổi, chỉ đảm bảo heartbeat làm B08 không đóng nhầm run đang tiến.

**Tiêu chí audit:**
```bash
# 1. Heartbeat có flush
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "completed_symbols_count|BackfillExecutionRun.*update" | Select-Object -First 10  # expect hits trong impl loop (mỗi 50)
# 2. Pool prefork cho enrichment
Select-String -Path docker-compose.dev.yml -Pattern "core-worker-enrichment" -Context 0,10 | Out-String  # expect --pool=prefork hoặc concurrency=1
# 3. Bind task_id
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "def backfill_daily_prices\(self" | Out-String  # expect bind=True
# 4. No bare pass
Select-String -Path packages/core/backend/src/data_ingest/tasks.py -Pattern "except.*: *pass" | Out-String  # expect 0 sau fix (hoặc chỉ test files)
# 5. Live: chạy EOD 28 symbols (như audit_check4.py success 28), theo dõi progress realtime:
python src/manage.py shell -c "from data_ingest.tasks import backfill_daily_prices; r=backfill_daily_prices.delay(days=1, symbols=['HPG','VNM','FPT']); print(r.id)"
# Trong lúc chạy, poll: python src/manage.py shell -c "from service_ops.models import BackfillExecutionRun; print(BackfillExecutionRun.objects.filter(status='running').values_list('completed_symbols_count', flat=True))"  # expect tăng mỗi 50, không 0 mãi
```

**Test (BE):** Thêm `test_backfill_heartbeat` — mock `fetch_daily_history` trả 264 rows cho 120 symbols, gọi `backfill_daily_prices` sync, assert `BackfillExecutionRun.completed_symbols_count` tăng giữa chừng (patch `filter().update` call_count >=2). Thêm `test_soft_time_limit_exceeded` — patch `SoftTimeLimitExceeded` → assert `status=failed` + `reason=soft_time_limit_exceeded`.

---

### SLICE E — Scheduler tz fix C2 + intraday_bars gap F-BAR-01 (P1) — sau A

**Mục tiêu:** `Lịch chạy Lần chạy tiếp` hiện đúng `17:05 ICT` (không `00:05`); `intraday_bars` không còn `stale` sai; Jun–Aug gap được làm rõ hoặc lấp.

**Files:**
- `packages/core/backend/src/service_ops/scheduler_catalog.py:483-506` (next_run_at)
- `packages/core/backend/src/market_data/models.py` / `global_symbol_coverage.py` (intraday_bars dataset)
- `packages/web/src/components/soc/SocSchedulerBoard.tsx:90` (formatNextRun — không đổi, chỉ BE fix)

**Yêu cầu đạt (DoD):**
- E1. **Tz fix:** `scheduler_catalog.py:498` đổi `remaining = crontab_schedule.remaining_estimate(timezone.now())` → `remaining = crontab_schedule.remaining_estimate(timezone.localtime(timezone.now()))` hoặc `crontab_schedule.schedule` vốn đã `TzAwareCrontab` với `tz=Asia/Ho_Chi_Minh` (từ DB) → `remaining_estimate` nên nhận `now` đã ở ICT. Sau đó `next_run_at = timezone.localtime(timezone.now()) + remaining` rồi `astimezone(ICT).isoformat()`. Kết quả DB `5 17 *` → UI `17:05` ICT cùng ngày hoặc `17:05 mai` nếu đã qua giờ, không `00:05`.
- E2. **Không đoán formatNextRun:** FE `SocSchedulerBoard.tsx:90` giữ nguyên `formatNextRun(job.next_run_at, job.trigger_type)` — bug là BE, không sửa FE.
- E3. **intraday_bars gap:** Xác minh `market_data_intraday_bar` Sept 8771 + May 31703 = 40474, Jun–Aug 0. Nếu bar được materialize từ `IntradayTick` (tick 94885 MAX 2026-09-17 07:59), tìm job `materialize-intraday-bars` có bị disable/missing trong `PeriodicTask` không; nếu dataset đã bỏ, xóa/reconcile `GlobalSymbolCoverage` rows `intraday_bars` (mark `deprecated` hoặc xóa) để hết `stale`/`DEGRADED`. Nếu còn dùng, thêm lại beat schedule interval `5m` và đảm bảo worker `analytics_heavy` consume.
- E4. **Coverage nuance:** `GlobalSymbolCoverage:intraday_bars` hiện `2026-05-22` là coverage row stale — sau E1/E3, row này phải được refresh hoặc xóa; không để audit sau nhầm là bar table chết.

**Tiêu chí audit:**
```bash
# 1. Tz fix có localtime
Select-String -Path packages/core/backend/src/service_ops/scheduler_catalog.py -Pattern "localtime|Asia/Ho_Chi_Minh" | Select-Object -First 10  # expect hit tại 498-499
# 2. Next_run đúng ICT
python src/manage.py shell -c "from service_ops.scheduler_catalog import build_scheduler_catalog; c=build_scheduler_catalog(); print([j for j in c if j['job_key']=='daily-backfill-prices-1700'][0]['next_run_at'])"  # expect hour 17 ICT, không 00
# 3. Bar table vs coverage
python src/manage.py shell -c "from django.db import connection; c=connection.cursor(); c.execute('SELECT MAX(datetime) FROM market_data_intraday_bar'); print(c.fetchone()); c.execute('SELECT MAX(datetime),COUNT(*) FROM market_data_intraday_bar WHERE datetime >= ''2026-06-01'''); print(c.fetchone())"  # expect MAX 2026-09-17, Jun-Aug 0 nếu chưa fix
# 4. Coverage row
python src/manage.py shell -c "from market_data.models import GlobalSymbolCoverage; print(GlobalSymbolCoverage.objects.filter(dataset='intraday_bars').values_list('latest_available_at', flat=True)[:1])"  # sau fix: tươi hoặc không còn
```

**Test (BE):** Thêm `test_scheduler_catalog_cron_tz` — mock `timezone.now()` tại `2026-09-18 10:00 UTC` (17:00 ICT), assert `daily-backfill-prices-1700 next_run_at.hour ==17` ICT. Gate `python src/manage.py test service_ops.tests.test_scheduler_catalog --keepdb` PASS (cập nhật expectation).

---

### SLICE F — Observability / parity UI F-DATA-01 / F-REAL-01 / F-PTIME-01 / F-DEG-01 (P2) — sau A-E

**Mục tiêu:** Operator thấy parity thật, không hoảng transient; biết phiên chưa đóng.

**Files:**
- `packages/web/src/components/soc/SocDataInventorySection.tsx` (caption latest_complete)
- `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:104-108` (tier starvation đã fix Entry 107, giữ)
- `packages/web/src/components/soc/SocSchedulerBoard.tsx:14,90` (DEGRADED filter)
- `packages/web/src/i18n/vi.js:1139,en.js` (keys mới nếu thêm)
- `packages/core/backend/src/service_ops/views/dataops_*.py` (alert rules)

**Yêu cầu đạt (DoD):**
- F1. **Caption phiên:** `SocDataInventorySection.tsx` dưới KPI `Dữ liệu muộn nhất` thêm dòng nhỏ `t("soc.dataops.latest_complete", {date})` + `next_run 17:05 ICT` (lấy từ `GET /operator/soc/scheduler/board` hoặc `GET /operator/soc/dataops/coverage` `latest_complete_trade_date`). Nếu `MAX(date) == yesterday` và `now < 17:05 ICT` → không đỏ, hiển thị `Chờ đóng phiên 17:05`.
- F2. **DEGRADED filter:** `SocSchedulerBoard.tsx` `DEGRADED` badge khi `Quá hạn >24h` mới đỏ; `deep-history` weekly `07h` không tính nếu `trigger_type=cron` + `remaining <7d`. Thêm toggle `Chỉ quá hạn <24h` (client filter).
- F3. **Alert coverage <80%:** BE hoặc FE cảnh báo khi `daily_prices coverage_ratio <80%` (hiện 54.5%) — thêm banner `soc.dataops.coverage_warning` (FE poll `GET /operator/soc/dataops/coverage`).
- F4. **SLA 90s:** `ingest-price-board-60s` lag `>90s` mới vàng, `>3m` đỏ (hiện `9m28s` là đỏ transient sau restart, đã hiểu).
- F5. Không đổi `matrix` namespace (đã fix Entry 107).

**Tiêu chí audit:**
```bash
Select-String -Path packages/web/src/components/soc/SocDataInventorySection.tsx -Pattern "latest_complete|17:05" | Out-String  # expect hit
Select-String -Path packages/web/src/components/soc/SocSchedulerBoard.tsx -Pattern "DEGRADED|24h|deep-history" -Context 0,2 | Out-String
Select-String -Path packages/web/src/i18n/vi.js -Pattern "coverage_warning|latest_complete" | Out-String  # expect nếu thêm key
npx tsc --noEmit --project packages/web/tsconfig.json  # 0
npm run build --prefix packages/web  # PASS
```

**Test (FE):** `packages/web/src/components/__tests__/soc-inventory-caption.test.tsx` — mock coverage `latest_complete 2026-09-17`, `now 2026-09-18 07:00 ICT` → assert caption `Chờ đóng phiên 17:05`, không badge đỏ.

---

### SLICE G — Tài liệu & ledger (sau mỗi slice, làm cuối cùng)

**Files:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `docs/AUDIT_*` + `AGENTS.md`

**Yêu cầu đạt (DoD):**
- G1. Sau mỗi slice, append `Entry 117→122` trong ledger với `commit hash, files, gates`.
- G2. Cập nhật `docs/IMPLEMENTATION_PLAN_DATAOPS_REALTIME_SYNC_FIX_20260918.md` § Progress (nếu cần).
- G3. `AGENTS.md` Progress sync.

**Tiêu chí audit:**
```bash
Select-String -Path docs/CODE_CHANGE_AUDIT_LEDGER.md -Pattern "^## Entry 1(1[7-9]|2[0-2]):" | Out-String  # expect entries
```

---

## 3. THỨ TỰ THỰC HIỆN & GATE (bắt buộc sau mỗi slice)

| Bước | Slice | Verify ngay (copy-paste) | Gate BE/FE |
|------|-------|--------------------------|------------|
| 1 | **A Beat** | `docker inspect --format RestartCount` + `docker logs --tail 100` + `BackfillExecutionRun count` | `manage.py check` 0 |
| 2 | **B Queue** | `Select-String CELERY_QUEUES.*enrichment` (1 hit) + `cache scheduler:inflight` | `test_soc_tasks` (dedup) |
| 3 | **C Coverage** | `Select-String _refresh_coverage_for_symbols` (1726) + live coverage `2026-09-17` | `test_dataops_coverage` |
| 4 | **D Heartbeat** | `completed_symbols_count` tăng + `bind=True` + no `except: pass` | `test_backfill_heartbeat` |
| 5 | **E Tz+Bar** | `localtime` grep + `next_run_at 17h ICT` + `MAX bar 2026-09-17` | `test_scheduler_catalog` |
| 6 | **F UI** | `latest_complete` + `DEGRADED` + `tsc 0` + `build PASS` | `vitest soc-*` |
| 7 | **G Ledger** | `grep ^## Entry 11` | — |

**Gate chung mỗi slice:** `python src/manage.py check` 0 + test slice + `npx tsc --noEmit` (nếu chạm FE) 0.
**Gate cuối toàn plan:** `python src/manage.py test service_ops.tests.test_scheduler_catalog service_ops.tests.test_repair_beat_schedule service_ops.tests.test_drift_enabled_missing service_ops.tests.test_soc_tasks service_ops.tests.test_dataops_coverage --keepdb` + `npx tsc --noEmit` (web) 0 + `npm run build` PASS + `docker compose config` validate.

---

## 4. VERIFY E2E SAU KHI XONG (không hỏi lại — copy-paste)

```bash
# 1. Beat ổn định 15m
docker inspect vninvest-dev-core-beat --format 'RestartCount={{.RestartCount}}'  # không tăng sau 15m
docker logs vninvest-dev-core-beat --tail 30 2>&1 | Select-String "market-data-queue-tier-scheduler-30s" | Select-Object -Last 3  # đều 30s

# 2. Không dispatch lặp EOD
python src/manage.py shell -c "from service_ops.models import BackfillExecutionRun; print(BackfillExecutionRun.objects.filter(job_key='daily-backfill-prices-1700').order_by('-created_at')[:3].values_list('created_at','status','celery_task_id'))"
# expect ≤1 running, không 3 runs cách 5 phút

# 3. Coverage refresh
python src/manage.py shell -c "from django.db import connection; c=connection.cursor(); c.execute('SELECT latest_complete_trade_date FROM market_data_globalsymbolcoverage WHERE dataset=''daily_prices'' ORDER BY updated_at DESC LIMIT 1'); print(c.fetchone())"
# expect 2026-09-17 hoặc 18 (không 16)

# 4. Heartbeat realtime
python src/manage.py shell -c "from data_ingest.tasks import backfill_daily_prices; r=backfill_daily_prices.delay(days=1, symbols=['HPG','VNM','FPT','SSI','VCB']); print(r.id)" &
# Poll trong 60s:
python src/manage.py shell -c "from service_ops.models import BackfillExecutionRun; import time; [print(BackfillExecutionRun.objects.get(celery_task_id='...').completed_symbols_count) or time.sleep(5) for _ in range(12)]"
# expect tăng, không 0 mãi

# 5. Tz next_run
python src/manage.py shell -c "from service_ops.scheduler_catalog import build_scheduler_catalog; print([j['next_run_at'] for j in build_scheduler_catalog() if j['job_key']=='daily-backfill-prices-1700'][0])"
# expect 17:05 ICT

# 6. Bar gap
python src/manage.py shell -c "from django.db import connection; c=connection.cursor(); c.execute('SELECT MAX(datetime) FROM market_data_intraday_bar'); print(c.fetchone()); c.execute('SELECT COUNT(*) FROM market_data_intraday_bar WHERE datetime::date BETWEEN ''2026-06-01'' AND ''2026-08-31'''); print(c.fetchone())"
# expect MAX 2026-09-17, Jun-Aug >0 nếu đã lấp hoặc 0 nếu đã đánh dấu deprecated (coverage xóa)

# 7. UI
# http://localhost:8080/operations-center?tab=dataops — inventory caption "Chờ đóng phiên 17:05" khi chưa 17:05, không đỏ
# http://localhost:8080/operations-center?tab=scheduler — DEGRADED chỉ >24h, daily 17:05 đúng
```

---

## 5. RỦI RO & QUYẾT ĐỊNH DESIGN (đã chốt, không hỏi lại)

- Beat mem 128m quá thấp cho `django-celery-beat` + `coverage builder` → tăng 256m dev (prod 512m) hoặc bỏ healthcheck khỏi beat (chỉ check API).
- Solo pool không enforce hard limit → đổi `core-worker-enrichment` sang `prefork` (concurrency 1) để `time_limit` kill, hoặc giữ solo và rely soft-limit handler (chọn prefork cho EOD queue, solo giữ cho realtime).
- Dedup theo `job_key` dùng `cache.add` với TTL = `days*3600` (EOD 365d → 86400*365 quá lớn, nên TTL 7200 + `last_run_at` check) — đã ghi trong D1.
- `acks_late=False` cho backfill là đúng nếu không muốn redelivery; nếu đổi True phải idempotent `DailyPrice upsert` (đã `ON CONFLICT`).
- `except: pass` → `logger.exception` không làm fail run, chỉ observability.
- Không đổi `SocSchedulerBoard.tsx:90`/`trigger_type` — bug là BE tz, FE giữ.
- Scope ngoài: SSE scheduler, SLO alerting, backfill weekly→daily đã loại.

---

## 6. PHẠM VI NGOÀI (đã loại, không làm trong plan này)

- SSE `operator/soc/scheduler/stream` (P3).
- SLO `burn_rate`/`error_budget` scheduler-aware.
- Backfill `deep-history-bootstrap` weekly→ daily.
- Coverage `session_facts` missing 1942 rows (không phải EOD).

---

## 7. BÀN GIAO CHECKLIST (đội code tick trước khi gửi audit)

- [ ] A Beat RestartCount ổn định 15m + last_run_at cập nhật
- [ ] B `docker-compose.dev.yml` chỉ 1 consumer `enrichment_offhours` + dedup hit
- [ ] C `_refresh_coverage_for_symbols` sau `1726` + test coverage PASS
- [ ] D heartbeat mỗi 50 + `bind=True` + `except pass` 0 + `prefork` hoặc soft-limit
- [ ] E tz `localtime` + `next_run 17:05 ICT` + bar MAX 2026-09-17 / hoặc coverage xóa
- [ ] F caption `latest_complete` + DEGRADED >24h + alert <80% + tsc 0 + build PASS
- [ ] G ledger Entry 117-122 + `AGENTS.md` sync + `manage.py check` 0 + full tests PASS

**File plan:** `docs/IMPLEMENTATION_PLAN_DATAOPS_REALTIME_SYNC_FIX_20260918.md` (file này).
**Audit:** `docs/AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` + phản biện `docs/PHAN_BIEN_AUDIT_DATAOPS_REALTIME_SYNC_20260918.md`.
**Ledger:** cập nhật sau mỗi slice (không hỏi lại).

