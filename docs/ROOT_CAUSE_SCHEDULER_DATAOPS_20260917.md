# ROOT CAUSE THẬT — Lịch chạy DataOps "Quá hạn / Thiếu dữ liệu" (F-S01/F-S02)

**Ngày:** 2026-09-17 20:3x ICT — **Loại:** điều tra runtime reproduce-first (docker + DB + log), Nguyên tắc 6 AGENTS.md — **Kết quả:** chốt được root cause bằng bằng chứng, không suy luận.

**Tóm tắt:** 5 job market-data realtime (trong đó 4 job DataOps) bị `enabled=False` TRONG DATABASE `django_celery_beat_periodictask`, trong khi `CELERY_BEAT_SCHEDULE` (settings.py) khai `enabled=True`. Beat dùng `DatabaseScheduler` (đọc DB, KHÔNG đọc settings) → không bao giờ dispatch các job này → PeriodicTask.last_run_at = NULL (chưa từng chạy từ khi bị tắt) → catalog trả `missing` → UI "Thiếu dữ liệu —". Job có service_key vẫn hiển thị lag từ ServiceRunLog lần cuối (queue-tier: 3h56m). **Không phải "beat chết", "worker chết", "thêm capabilities", "SSE" hay "retry/backoff" như audit giả định.**

---

## A. BẰNG CHỨNG (all đã chạy thật — không suy luận)

### A1. Beat SỐNG và dispatch đều đặn — nhưng KHÔNG gửi 5 job bị disable
`docker logs vninvest-dev-core-beat` (từ 19:35 → 20:31 local): gửi đều `flush-pat-audit-log` (10s), `process-outbox-events-30s`, `materialize-unified-alerts-2m`, `reconcile-stale` (5m), `service-ops-health-check-60s`, screener, etc. **0 lần xuất hiện** `market-data-queue-tier-scheduler-30s`, `ingest-price-board-60s`, `warm-intraday-realtime-5m`, `schedule-realtime-prefetch-shards`.

### A2. DB: 5 job enabled=False — thể hiện 3 trạng thái đã chạy rồi dừng
`docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core` (query trực tiếp):

```
name                            | enabled | last_run_at | total_run_count | interval |
market-data-queue-tier-scheduler-30s | f      |             |            1528 | id 6 (30s)
ingest-price-board-60s               | f      |             |             764 | id 1 (60s)
warm-intraday-realtime-5m            | f      |             |             153 | id 2 (300s)
schedule-realtime-prefetch-shards    | f      |             |           15277 | id 5 (3s)
ingest-daily-prices-1705             | f      |             |               0 | cron — by design
```

- **`total_run_count > 0` + `last_run_at = NULL`** = các job ĐÃ chạy trong quá khứ (đếm được từ beat), rồi bị tắt và beat reset mind. Hiện tại disabled → không dispatch → `last_run_at`/freshness `missing`.
- `claim date_changed` KHÔNG dùng được để suy ai disable (bị beat touch liên tục mỗi lần đọc) — không phải bằng chứng ai làm.

### A3. Beat dùng `DatabaseScheduler`, không phải schedule từ settings
`packages/core/backend/entrypoint.sh:41-43` → `celery beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`. Takeaway: `CELERY_BEAT_SCHEDULE` (settings.py) chỉ là *định nghĩa*; state thực tế nằm trong bảng `django_celery_beat_periodictask`. Nếu row ở DB bị disable → beat bỏ qua bất kể settings nói gì.

### A4. Settings khai enabled=True (không conflict)
- `settings.py:487-491` `market-data-queue-tier-scheduler-30s` — interval 30s, không `enabled: False` → enabled True.
- `settings.py:537-541` `ingest-price-board-60s` — interval 60s → enabled True.
- `settings.py:552-556` `warm-intraday-realtime-5m` — interval 300s → enabled True.
- `settings.py:472-476` `schedule-realtime-prefetch-shards` — 3s → enabled True.
- Ngoại lệ DUY NHẤT đúng thiết kế: `ingest-daily-prices-1705` `settings.py:612` `'enabled': False` (P3-T03 shadow run) — UI hiện "Thiếu dữ liệu" cho job này là **expected behavior**, không phải lỗi.

### A5. Worker SỐNG và consume đúng queue
- `docker ps`: `core-worker-manual` Up 53 phút, `core-worker-realtime-prefetch` Up 53 phút, `core-worker` Up 3 phút, `core-worker-enrichment` Up 2 phút, beat Up ~1 phút (restart + health: starting).
- `core-worker-manual` log: xử lý `materialize_market_anomaly_alerts`, `health_check_all_services` (kéo từ queue `manual_on_demand`) — tức queue này WORKING. Việc không có queue-tier job là vì beat không gửi, không phải worker chết.

### A6. ServiceRunLog: queue-tier service last run 09:35 UTC = lag thật
`service_ops_servicedefinition.service_key='vnbroker_price_board'` (map bởi catalog `scheduler_catalog.py:38`): 22 runs, last `started_at` 08:17 UTC, last `finished_at` **09:35 UTC**. Lúc 20:26 local (13:26 UTC) → lag ≈ 3h51m → đúng "Quá hạn" F-S01. Nguồn lag là ServiceRunLog cũ (vì beat không còn dispatch), không phải "scheduler đứng".

### A7. Không có code nào tự động force-disable 5 job này
- `grep -r "enabled=False\|update(enabled" packages/core/backend/src`: chỉ `service_ops/views/scheduler.py:486` (action endpoint enable/disable → ghi ConfigChangeAudit) + tests. **Không có auto-disable trong code.**
- `ConfigChangeAudit` query trả 0 dòng về scheduler/PeriodicTask → ai disable là **thao tác thủ công** (UI action hoặc SQL/ORM shell) — không có vết audit trong hệ thống, và KHÔNG phải code sinh ra.

---

## B. KẾT LUẬN ROOT CAUSE

> **ROOT CAUSE**: 5 PeriodicTask rows trong `django_celery_beat_periodictask` bị **disable thủ công** trong DB (enabled=False). Vì beat dùng `DatabaseScheduler`, các job này **không được dispatch từ lâu** → `last_run_at` trống → catalog trả `missing` → Bảng "Lịch chạy" dataops hiển thị "Thiếu dữ liệu —" và "Quá hạn" cho queue-tier (lag = ServiceRunLog cũ 09:35 UTC). Beat + worker + broker + queue `manual_on_demand` đều hoạt động tốt — **không có gì "chết".**

### Chuỗi nhân quả (kèm file:line)
1. Ai đó/thủ công: `PeriodicTask.objects.filter(name=...).update(enabled=False)` trên 5 job (service_ops/views/scheduler.py:486 là 1 đường; có thể là SQL/ORM khác) → DB row enabled=False. Không audit log.
2. Beat khởi động `DatabaseScheduler` (entrypoint.sh:43) → đọc DB → job bị skip, không gửi task.
3. `PeriodicTask.last_run_at` không bao giờ set (vì beat không send) → **NULL** (thay vì một timestamp cũ).
4. `build_scheduler_catalog` (scheduler_catalog.py:307-526) đọc `last_run_at` null → `freshness_state=missing` (:253-261 `_freshness_state`) → UI "Thiếu dữ liệu".
5. Riêng queue-tier có service_key (`scheduler_catalog.py:38`) → S04-ext đọc `ServiceRunLog.finished_at` cũ nhất (:453-458) → lag ~3h51m → `degraded` → "Quá hạn".
6. FE render đúng giá trị BE trả (SocSchedulerBoard.tsx:690-696) → UI đúng, không phải bug FE.

---

## C. ANSWER CHO TỪNG NGUYÊN NHÂN AUDIT GIẢ ĐỊNH

| Giả định audit | Verdict | Bằng chứng |
|---|---|---|
| "Scheduler queue-tier đứng 3h26m" | **SAI — không có gì đứng.** Beat dispatch mọi job khác đều tay; riêng 4 job realtime bị disable trong DB | A1, A2 |
| "Worker manual chết → queue-tier không chạy" | **SAI** — worker-manual xử lý task queue `manual_on_demand` bình thường | A5 |
| "Thiếu capabilities run_now/JobActionButtons" | **KHÔNG TỒN TẠI** — JobActionButtons.tsx không có; capability đủ `scheduler_catalog.py:36` | đã nêu phản biện trước |
| "ingest-price-board/ingest-daily-1705 là 2 ingest chết" | **SAI** — ingest-daily-1705 disabled đúng thiết kế (settings.py:612); ingest-price-board disabled trong DB (không phải code) | A2, A4 |
| "Cần thêm SSE/auto-retry/backoff" | **EXTRA không liên quan root cause** — poll 60s hoạt động bình thường | A1 |

---

## D. KHẮC PHỤC (đề xuất, chưa thực thi)

**D1. Re-enable đúng 4 job (đang bị tắt nhầm), giữ nguyên ingest-daily-1705 disabled:**
```sql
UPDATE django_celery_beat_periodictask SET enabled=true
WHERE name IN (
  'market-data-queue-tier-scheduler-30s',
  'ingest-price-board-60s',
  'warm-intraday-realtime-5m',
  'schedule-realtime-prefetch-shards'
);
```
(hoặc qua UI action enable; sau ~30-60s beat dispatch → ServiceRunLog mới → freshness khôi phục.)

**D2. Ngăn tái diễn (P1):**
- `sync_scheduler_queues.py` (hiện chỉ fix queue drift cho row tồn tại `:15`) → mở rộng: **tự tạo PeriodicTask rows + sync enabled từ CELERY_BEAT_SCHEDULE** cho job khai báo `enabled` nhưng không có row → đóng gap "Thiếu dữ liệu" và ngăn drift giữa settings ↔ DB.
- Thêm alert khi periodic job `enabled=False` quá lâu (reuse scheduler health strip) — để disable thủ công không diễn ra im lặng.

**D3. Cải tiến catalog (F-S04 cũ, vẫn hợp lệ):** `next_run_at` chỉ tính cho interval `:485-492` — cron luôn "—". Tính next-fire từ `crontab_schedule` để UI có dữ liệu.

---

## E. TRẠNG THÁI FIX (cập nhật 17/09 21:00 — sau `471bb89b`)

- **Đã deploy `471bb89b` (startup-only):** `entrypoint.sh:24,44` `repair_beat_schedule` re-enable 4 jobs lúc `api`/`beat` restart → beat log `Re-enabled 4` `20:47:29` + `Sending due task queue-tier 30s` `20:49:55` `price-board 60s` `20:50:26` → `PeriodicTask` 4 `enabled=True` `last_run` đang cập nhật.
- **Còn lại self-heal (plan `IMPLEMENTATION_PLAN_SCHEDULER_SELF_HEAL_20260917.md` 6 slices):** S1 v2 (tạo `Interval/Crontab` FK + queue đúng), S2 beat task 5m, S3 drift-check, S4 cron `next_run_at` ICT, S5 FE `trigger_type`, S6 docs — để đóng gap “disable giữa phiên” (hiện chỉ startup) và UI `—` cron.

*Điều tra kết thúc — bằng chứng đầy đủ. Entry ledger 108 đã ghi; Entry 109 sẽ ghi sau khi xong 6 slices self-heal.*