# IMPLEMENTATION PLAN — Scheduler Self-Heal + Realtime Sync (2026-09-17) — ĐÃ HIỆU CHỈNH THEO PHẢN BIỆN F-PL-01→06

**Base:** commit `471bb89b` (HEAD) — root cause đã fix startup-only `entrypoint.sh:24,44` + `repair_beat_schedule.py:17`.
**Mục tiêu:** chuyển từ "sửa 1 lần lúc restart" → "tự phục hồi trong mọi hoàn cảnh + UI nói sự thật".
**Chuyển giao:** đội code thực thi không cần hỏi lại. Mỗi slice có yêu cầu đạt (DoD) + tiêu chí audit `grep`/`manage.py`/`tsc` chạy được.

> **Hiệu chỉnh 17/09 theo audit độc lập F-PL-01→06:** S1 bổ sung `IntervalSchedule/CrontabSchedule` FK + queue fallback đúng `job_key`; S3 giữ healthcheck `5m`; S4 timezone `Asia/Ho_Chi_Minh`; S5 `en.js` + `i18n:scan`; S1/S2 idempotent + `get_or_create` chi tiết.
>
> **Hiệu chỉnh 17/09 lần 2 theo audit v2 (F-A1/F-A6/F-A2/F-A4):**
> - **F-A1**: S1 R1.2a queue **lấy trực tiếp `schedule_def['options']['queue']`**, KHÔNG tái suy diễn qua `SCHEDULER_QUEUE_MAP.get(job_key, ...)` — vì `schedule-realtime-prefetch-shards` KHÔNG có trong `SCHEDULER_QUEUE_MAP` (`queue_policy.py:71-80` realtime_prefetch domain chỉ chứa materialize+ingest-price-board+warm-intraday) → fallback map sẽ ra `'celery'` sai. Settings gốc đã resolve đúng (`settings.py:475` inline fallback `'realtime_prefetch'`).
> - **F-A6**: Gates S1/S3 bỏ `pytest` (không tồn tại trong image) + bỏ path `packages.core.backend.tests` (không phải package) → chuyển sang `python src/manage.py test <module_path>` theo chuẩn repo; test S1 đặt tại `service_ops/tests/test_repair_beat_schedule.py`.
> - **F-A2**: S5 thêm field `trigger_type?: string` vào FE job type (hiện `SocSchedulerBoard.tsx:14` chưa có; BE đã trả `scheduler_catalog.py:505`) + truyền qua `formatNextRun(job.next_run_at, job.trigger_type)`.
> - **F-A4**: S4 R4.2 chỉ dùng `PeriodicTask.crontab.schedule` (DB row tz ICT) — bỏ nhánh `crontab()` từ settings (lệch tz, celery dùng `tz=` không phải `timezone=`).

---

## 0. BỐI CẢNH & NGUYÊN NHÂN GỐC (đã chứng minh `ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md`)

- `django_celery_beat_periodictask` có 5 job `enabled=False` làm thủ công:
  1. `market-data-queue-tier-scheduler-30s` (interval 30s)
  2. `ingest-price-board-60s` (interval 60s)
  3. `warm-intraday-realtime-5m` (interval 300s)
  4. `schedule-realtime-prefetch-shards` (interval 3s)
  5. `ingest-daily-prices-1705` (crontab 17:10) — **cố ý disabled** `settings.py:612` `enabled: False`.
- Beat `DatabaseScheduler` `entrypoint.sh:43` → đọc DB, không sync từ `CELERY_BEAT_SCHEDULE` → 4 job realtime không dispatch → `last_run_at` NULL → `scheduler_catalog.py:406 last_run_at None` → `freshness missing` → UI "Thiếu dữ liệu / Quá hạn" → `GlobalSymbolCoverage` `MISSING 1.533`.
- Evidence: `docker logs vninvest-dev-core-beat --tail 100 | grep queue-tier` 1h 0 lần 4 job trên; `PeriodicTask.objects.filter(name__in=CRITICAL_JOBS).values_list` 4 `False`; `ServiceRunLog` 1528/764/153 runs cũ.
- Fix hiện tại `471bb89b`: `repair_beat_schedule` `update(enabled=True)` lúc api/beat startup → re-enable. **Hạn chế:** chỉ startup, không tự sửa khi ai `UPDATE enabled=False` giữa phiên + chưa tạo `IntervalSchedule` FK khi row thiếu.

---

## 1. KIẾN TRÚC ĐÍCH (đồng bộ mọi hoàn cảnh)

```
[settings.py CELERY_BEAT_SCHEDULE]  ← SSOT (nguồn chân lý, định nghĩa interval/crontab/queue/enabled)
        │
        ▼  (S1) repair_beat_schedule --dry-run/--apply  +  (S2) reconcile 5m beat task
        │      get_or_create IntervalSchedule/CrontabSchedule → get_or_create PeriodicTask
[django_celery_beat_periodictask + django_celery_beat_intervalschedule/crontabschedule]  ← luôn khớp
        │
        ▼  beat DatabaseScheduler dispatch (mỗi interval/cron)
[workers: manual_on_demand (queue-tier), realtime_prefetch (price-board/warm-intraday), enrichment_offhours]
        │
        ▼  ServiceRunLog/GlobalSymbolCoverage fresh
[SocSchedulerBoard 60s poll + S5 formatNextRun] ← F-S04: cron next_run thật (Asia/Ho_Chi_Minh)
```

Self-heal: **disable/sai queue/xóa row trên DB → ≤5 phút tự khôi phục + warning log**; `S3` drift-check cảnh báo; `S4/S5` UI nói thật.

---

## 2. SLICES & TIÊU CHÍ AUDIT (copy-paste chạy được)

### SLICE 1 — `repair_beat_schedule` v2 (reconcile SSOT toàn diện) — FIX F-PL-01 + F-PL-02

**File:** `packages/core/backend/src/service_ops/management/commands/repair_beat_schedule.py` (hiện `repair_beat_schedule.py:17` chỉ `update(enabled=True)`)
**Yêu cầu đạt (DoD):**
- R1.1. Giữ `update(enabled=True)` 4 `CRITICAL_JOBS:17`.
- R1.2. **MỚI — FIX F-PL-01:** Job thiếu row `PeriodicTask` → **tạo mới với FK đúng**:
  ```python
  # Pseudocode phải có trong file để audit grep thấy:
  from django_celery_beat.models import IntervalSchedule, CrontabSchedule, PeriodicTask
  from django.conf import settings
  # interval: IntervalSchedule.objects.get_or_create(every=int(schedule), period='seconds')
  # crontab: CrontabSchedule.objects.get_or_create(minute=..., hour=17, day_of_week='*', timezone='Asia/Ho_Chi_Minh')
  # PeriodicTask.objects.get_or_create(name=job_key, defaults=dict(task=task, interval=..., crontab=..., queue=queue, enabled=enabled))
  ```
  Không được `PeriodicTask.objects.create(name=..., schedule=...)` thiếu `interval`/`crontab` → `IntegrityError`.
- R1.2a. **FIX F-PL-02 + F-A1 queue:** `queue = schedule_def.get('options', {}).get('queue')` — **lấy trực tiếp từ settings** (settings đã resolve đúng qua `SCHEDULER_QUEUE_MAP.get(key, <inline-default>)`, VD `settings.py:475` → `'realtime_prefetch'`), không cần gọi lại `SCHEDULER_QUEUE_MAP` vì `schedule-realtime-prefetch-shards` KHÔNG có trong map (`queue_policy.py:71-80`). Nếu `options.queue` trống → mới fallback `SCHEDULER_QUEUE_MAP.get(job_key, 'celery')`. Vì thế `schedule-realtime-prefetch-shards` chuẩn ra `realtime_prefetch`, không phải `celery`.
- R1.2b. Xử lý `expires`, `start_time`, `one_off` = `None` (theo `settings.py` không có).
- R1.3. `ingest-daily-prices-1705` luôn `enabled False` `settings.py:612` — không bật, chỉ log `skipped-by-design`.
- R1.4. `--dry-run`: in plan, không ghi DB.
- R1.5. Idempotent: `get_or_create` + `update_or_create` → chạy 2 lần “0 thay đổi”.
- R1.6. Log: `re-enabled / created / queue-fixed / skipped-by-design` với `name`.

**Tiêu chí audit (tự chạy, `file:line`):**
```bash
# 1. Code chứa FK handling + queue từ options (F-A1)
grep -n "IntervalSchedule" packages/core/backend/src/service_ops/management/commands/repair_beat_schedule.py # expect >=2
grep -n "CrontabSchedule" packages/core/backend/src/service_ops/management/commands/repair_beat_schedule.py # expect >=2
grep -n "options.*get('queue')\|options.get(.queue" packages/core/backend/src/service_ops/management/commands/repair_beat_schedule.py # expect >=1
# 2. Dry-run không đổi DB
python src/manage.py repair_beat_schedule --dry-run  # liệt kê, check DB count không đổi
# 3. Test-be — FIX F-A6: bỏ pytest, đặt file tại service_ops/tests/test_repair_beat_schedule.py
python src/manage.py test service_ops.tests.test_repair_beat_schedule  # expect Ran N OK (PASS)
python src/manage.py shell -c "from django_celery_beat.models import PeriodicTask; PeriodicTask.objects.filter(name='schedule-realtime-prefetch-shards').delete()"
python src/manage.py repair_beat_schedule  # phải tạo lại job với queue realtime_prefetch
python src/manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(PeriodicTask.objects.get(name='schedule-realtime-prefetch-shards').queue)" # expect realtime_prefetch
# 4. Idempotent
python src/manage.py repair_beat_schedule  # lần 2 → "0 thay đổi"
# 5. Giữ disabled by design
python src/manage.py shell -c "from django_celery_beat.models import PeriodicTask; print(PeriodicTask.objects.get(name='ingest-daily-prices-1705').enabled)" # expect False
```

---

### SLICE 2 — Beat task self-heal định kỳ (5m) — FIX race

**File mới:** `packages/core/backend/src/service_ops/tasks.py` (cạnh `run_market_data_queue_tier_scheduler`)
**Yêu cầu đạt (DoD):**
- R2.1. `@shared_task(name='service_ops.reconcile_beat_schedule_ssot', queue='manual_on_demand', acks_late=True, max_retries=0)` gọi hàm chung `reconcile_beat_schedule()` (refactor S1 body ra `service_ops/beat_reconcile.py:reconcile_beat_schedule(dry_run=False)` để command + task cùng gọi).
- R2.2. Đăng ký `settings.CELERY_BEAT_SCHEDULE:383` key `reconcile-beat-schedule-5m` `schedule: 300.0` `kwargs: {}` `options: {'queue': 'manual_on_demand'}`.
- R2.3. Khi có thay đổi → `logger.warning` (để alert bắt) + không ghi `ConfigChangeAudit` (tránh spam).
- R2.4. **FIX F-PL-01 race:** Dùng `transaction.atomic()` + `select_for_update` khi `get_or_create` hoặc chấp nhận idempotent `update_or_create` (đã idempotent nên 2 beat cùng chạy không hỏng).

**Tiêu chí audit:**
```bash
grep -n "reconcile_beat_schedule_ssot" packages/core/backend/src/service_ops/tasks.py  # expect 1
grep -n "reconcile-beat-schedule-5m" packages/core/backend/src/vninvest_core/settings.py  # expect 1, schedule 300.0
celery -A vninvest_core inspect registered 2>&1 | grep reconcile  # expect 1 (qua worker)
python src/manage.py shell -c "from service_ops.tasks import reconcile_beat_schedule_ssot; reconcile_beat_schedule_ssot.run()"  # bật lại job đã disable
```

---

### SLICE 3 — Drift-check mở rộng (enabled + missing, không chỉ queue) — FIX interval

**File:** `packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py` + `docker-compose.dev.yml:396`
**Yêu cầu đạt (DoD):**
- R3.1. Giữ hành vi cũ queue drift `--warn-only`/exit 1.
- R3.2. MỚI — `enabled-drift`: `CRITICAL_JOBS` `enabled=False` → drift.
- R3.3. MỚI — `missing-row`: job trong `CELERY_BEAT_SCHEDULE` không có `PeriodicTask` → drift.
- R3.4. `sys.exit(1)` khi drift và không `--warn-only`.
- R3.5. **FIX F-PL-03:** Giữ `docker-compose.dev.yml:396` `interval: 5m` `timeout: 30s` **không đổi 30s** (plan cũ 30s tăng 10× DB load). Healthcheck chỉ cảnh báo, sửa đã có `S2 5m`.

**Tiêu chí audit:**
```bash
# F-A6 FIX: test phải nằm trong src/ để vào image (Dockerfile chỉ COPY src/)
grep -n "ENABLED_DRIFT\|MISSING_ROW" packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py  # expect >=2
grep -A2 "check_scheduler_queue_drift" docker-compose.dev.yml  # expect interval: 5m (không phải 30s)
python src/manage.py test service_ops.tests.test_drift_enabled_missing --keepdb  # expect 3 PASS (enabled/missing/no-drift)
python src/manage.py test service_ops.tests.test_repair_beat_schedule --keepdb  # expect 5 PASS (S1)
```

---

### SLICE 4 — F-S04: `next_run_at` cho cron jobs (BE) — FIX timezone

**File:** `packages/core/backend/src/service_ops/scheduler_catalog.py:483-492`
**Yêu cầu đạt (DoD):**
- R4.1. Interval job giữ `last_run_at + interval` `scheduler_catalog.py:489`.
- R4.2. **FIX F-PL-04 + F-A4 timezone:** Cron job lấy `PeriodicTask.crontab` (`django_celery_beat.models.CrontabSchedule` row — DB đã lưu `timezone='Asia/Ho_Chi_Minh'`, verified live) → `crontab_obj.schedule.remaining_estimate(last_run_at)`; `schedule` là `TzAwareCrontab` đã mang tz ICT nên `remaining_estimate` tính đúng giờ địa phương. **KHÔNG dùng `crontab()` object từ `settings`** (chưa mang tz, lệch 7h). Trả `next_run_at` ISO `Asia/Ho_Chi_Minh` như `last_run_at`.
- R4.3. Nếu `last_run_at is None` → đọc `PeriodicTask.crontab` → `remaining_estimate(timezone.now())` → `now + remaining` (không `None` như plan cũ, để UI hiện `Tomorrow 17:05`).
- R4.4. `crontab`/`interval` đều `None` → `next_run_at=None`.

**Tiêu chí audit:**
```bash
grep -n "remaining_estimate" packages/core/backend/src/service_ops/scheduler_catalog.py  # expect >=1
grep -n "Asia/Ho_Chi_Minh" packages/core/backend/src/service_ops/scheduler_catalog.py  # expect 1
python src/manage.py test service_ops.tests.test_scheduler_catalog  # cron có last_run → next_run không None ±2 phút; cron chưa chạy → next_run ~ tomorrow 17:05
curl -s http://127.0.0.1:8001/core/v1/operator/scraping/dataops/scheduler/plan/ | jq '.jobs[] | select(.job_key=="daily-backfill-prices-1700") | .next_run_at'  # expect ISO
```

---

### SLICE 5 — FE: hiển thị cron next-run thay vì `—` — FIX i18n

**Files:** `packages/web/src/components/soc/SocSchedulerBoard.tsx:90` `formatNextRun` + `packages/web/src/i18n/vi.js`/`en.js` + `packages/web/src/components/__tests__/SocSchedulerBoard.test.tsx` (nếu có)
**Yêu cầu đạt (DoD):**
- R5.0. **FIX F-A2:** Thêm `trigger_type?: string` vào job type interface trong `SocSchedulerBoard.tsx` (BE đã trả `trigger_type` ở `scheduler_catalog.py:505`; FE type `SocSchedulerBoard.tsx:14` hiện chưa có field này).
- R5.1. `formatNextRun(next_run_at, trigger_type)` → cron `next_run_at` ISO → `toLocaleString("vi-VN", {day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit"})` `2026-09-18 17:05`; gọi site-update `formatNextRun(job.next_run_at, job.trigger_type)` tại `SocSchedulerBoard.tsx:695`.
- R5.2. `next_run_at === null && trigger_type === 'cron'` → `t("soc.scheduler.not_scheduled")` **không** đỏ `Quá hạn` (đổi `freshness_state` check `trigger_type`).
- R5.3. **FIX F-PL-05:** Thêm **cả** `vi.js` và `en.js` `soc.scheduler.not_scheduled` (`vi: Chưa chạy` `en: Not scheduled`) + `soc.scheduler.cron_tooltip` (`vi: Lịch cron: {label}` `en: Cron: {label}`) và chạy `npm run i18n:scan` không warn.
- R5.4. Không đổi cột, chỉ tooltip.

**Tiêu chí audit:**
```bash
grep -n "not_scheduled" packages/web/src/i18n/vi.js  # expect 1
grep -n "not_scheduled" packages/web/src/i18n/en.js  # expect 1 (F-PL-05 fix)
npx tsc --noEmit --project packages/web/tsconfig.json  # 0
npm run build --prefix packages/web  # PASS
npm run i18n:scan --prefix packages/web  # no warn
```

---

### SLICE 6 — Chuẩn hóa tài liệu audit & ledger

**Files:** `docs/AUDIT_LICH_CHAY_SCHEDULER_20260917.md` ERRATA + `docs/ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md` + `docs/CODE_CHANGE_AUDIT_LEDGER.md` + `AGENTS.md`
**Yêu cầu đạt (DoD):**
- R6.1. `AUDIT_LICH_CHAY` đầu thêm ERRATA: F-S02 sai (2 ingest chết do `enabled False` thủ công, không phải beat chết), F-S05 xuống P3.
- R6.2. `ROOT_CAUSE` cập nhật `Đã deploy 471bb89b` + còn lại self-heal S1-S5.
- R6.3. `CODE_CHANGE_AUDIT_LEDGER.md` Entry mới: commit hash, 6 files, `manage.py check` 0, `repair --dry-run`, `beat` log, `API plan` next_run, `tsc/build`.
- R6.4. `AGENTS.md` Progress sync.

**Tiêu chí audit:**
```bash
grep -n "ERRATA" docs/AUDIT_LICH_CHAY_SCHEDULER_20260917.md  # expect 1
grep -n "F-S02" docs/AUDIT_LICH_CHAY_SCHEDULER_20260917.md | grep -i "sai"  # expect 1
grep -n "471bb89b" docs/ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md  # expect 1
```

---

## 3. THỨ TỰ THỰC HIỆN & GATE (bắt buộc sau mỗi slice)

| Bước | Slice | Verify ngay (copy-paste) |
|---|---|---|
| 1 | S1 | `python src/manage.py check` 0 + `python src/manage.py test service_ops.tests.test_repair_beat_schedule` + `repair --dry-run` idempotent + `grep IntervalSchedule` |
| 2 | S2 | `python src/manage.py check` 0 + `celery inspect registered` + `grep reconcile-beat-schedule-5m settings.py` |
| 3 | S3 | `python src/manage.py test service_ops.tests.test_drift_enabled_missing` + `grep -A2 "check_scheduler_queue_drift" docker-compose.dev.yml` `5m` |
| 4 | S4 | `python src/manage.py test service_ops.tests.test_scheduler_catalog` + `curl .../plan/ | jq next_run_at` |
| 5 | S5 | `npx tsc --noEmit` (web) 0 + `npm run build` PASS + `grep not_scheduled vi.js en.js` + `grep trigger_type SocSchedulerBoard.tsx` |
| 6 | S6 | `grep ERRATA` + `grep 471bb89b` |

**Gate chung mỗi slice:** `python src/manage.py check` 0 + test-be slice.
**Gate cuối:** `service_ops` scheduler scope + `tsc/build` + `i18n:scan` 0.

---

## 4. VERIFY E2E SAU KHI XONG (không hỏi lại)

1. `docker exec vninvest-dev-core-api python src/manage.py repair_beat_schedule --dry-run` → 0 thay đổi
2. `docker exec ... python src/manage.py shell -c "PeriodicTask.objects.filter(name='market-data-queue-tier-scheduler-30s').update(enabled=False)"` → `docker logs vninvest-dev-core-beat --tail 20 --follow` ≤5 phút thấy `Re-enabled 1` + `Sending due task market-data-queue-tier-scheduler-30s`
3. UI `operations-center?tab=dataops` `Lịch chạy`: cron `Tomorrow 17:05` không `—`, `Quá hạn` hết đỏ
4. Beat: `Sending due task market-data-queue-tier-scheduler-30s` mỗi 30s + `ingest-price-board-60s` mỗi 60s
5. `python src/manage.py check_scheduler_queue_drift` (không `--warn-only`) → exit 0
6. `docker exec vninvest-dev-core-beat python src/manage.py test service_ops.tests.test_repair_beat_schedule` → Ran N OK (F-A6: xác nhận test chạy trong image, không cần pytest)

---

## 5. RỦI RO & QUYẾT ĐỊNH DESIGN

- Non-critical disable chỉ **cảnh báo** (S3) không tự bật — tránh phá ý định operator (giữ `S1 R1.2` chỉ 4 CRITICAL).
- `manual_on_demand` worker `docker-compose.dev.yml:318` đã có → không thêm worker cho S2.
- `repair_beat_schedule` giữ tên cũ `entrypoint.sh:24,44` không đổi.
- `get_or_create` idempotent → beat tạo trước, repair sửa sau không race; `select_for_update` không cần (đã idempotent).
- Timezone fix S4 dùng `pytz.timezone('Asia/Ho_Chi_Minh')` như `settings.py:214` — test cron 17:05 ICT = 10:05 UTC.

---

## 6. PHẠM VI NGOÀI (đã loại)

- SSE scheduler stream `F-S05` → P3.
- SLO/alerting scheduler-aware → backlog.
- Backfill weekly→daily → đã có `dnse-weekly`.

