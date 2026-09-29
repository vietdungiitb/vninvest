# AUDIT TÍNH NĂNG LỊCH CHẠY `operations-center?tab=dataops` — ẢNH `Bảng điều khiển lịch chạy` 20:26 17/09/2026

> **ERRATA 17/09 — ROOT CAUSE THẬT (Entry 108, đã chứng minh runtime, không suy luận):** Audit gốc chẩn đoán `F-S02` (“2 ingest chết do thiếu `next_run_at`/worker chết”) **SAI** — thực tế 4 job `enabled=False` thủ công trong `django_celery_beat_periodictask` (`market-data-queue-tier-scheduler-30s`, `ingest-price-board-60s`, `warm-intraday-5m`, `schedule-realtime-prefetch-shards`) làm thủ công, `DatabaseScheduler` `entrypoint.sh:43` đọc DB không sync từ `settings.py` → không dispatch. `ingest-daily-prices-1705` `enabled=False` là **by design** `settings.py:612` (không phải bug). `F-S04` (cron `—`) **GIỮ NGUYÊN** đúng. `F-S05` (thiếu SSE) xuống **P3** ngoài scope self-heal. Xem `docs/ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md` + `IMPLEMENTATION_PLAN_SCHEDULER_SELF_HEAL_20260917.md`.

**Phạm vi:** `packages/web/src/components/soc/SocSchedulerBoard.tsx:424` (Lịch chạy) + `SocDataOpsPanel.tsx:13` (tab DataOps) + `adapters/core/soc.js:252` (`getSocSchedulerPlan/Health/JobHistory`) + `vninvest_core/settings.py:536` (`CELERY_BEAT_SCHEDULE`) + `service_ops/dataops_market_data.py:269,711` + `market_data/global_symbol_coverage.py:506` + `soc.module.css` (liên quan `packages/web` React/Vite ↔ `packages/core` Django)

**Nguyên tắc:** AGENTS.md Nguyên tắc 1-6 — mọi khẳng định `file:line`, `grep` toàn repo `.css/.module.css/config/i18n`, quality gates `lint/type-check/i18n/test`.

---

## TÓM TẮT 5 FINDINGS CHẶN ĐỒNG BỘ REALTIME

1. **F-S01 CRITICAL** — `market-data-queue-tier-scheduler-30s` `QUÁ HẠN 3h26m` `SocSchedulerBoard.tsx:696` dù `poll 30s` `dataops_market_data.py:269` — job SSOT gốc rễ đứng, không dispatch tier → `GlobalSymbolCoverage` stale → `MISSING 749` ảnh Giám sát.
2. **F-S02 CRITICAL** — `ingest-price-board-60s` + `ingest-daily-prices-1705` `Thiếu dữ liệu` `—` `SocSchedulerBoard.tsx:690` → 2 ingest realtime (`60s` + `1705` `settings.py:537-543`) không có `next_run_at` → không chạy → `price_board_snapshot` `MISSING 1.533`.
3. **F-S03 HIGH** — `reconcile-stale-running-service-run-logs-5m` `SUY GIẢM Quá hạn 8m48s` + `deep-history 3d21h` `lag 3d21h` → 4/39 `Quá hạn` + 3 `Suy giảm` = `DEGRADED` `SchedulerHealthStrip:112` → không retry/backoff, chỉ `enable/disable/run_now` thủ công.
4. **F-S04 HIGH** — UI không phân biệt `cron` vs `interval`: `daily-backfill-1700` `LẦN CHẠY TIẾP —` dù `crontab 17:05 ICT` `settings.py:561` — `formatNextRun:90` trả `—` khi `next_run_at null` → operator tưởng job chết.
5. **F-S05 HIGH** — Thiếu real-time push: toàn bộ 39 jobs là `celery beat` poll (`SocSchedulerBoard.tsx:460` `60s + jitter 3s`), không có `SSE/WebSocket` như `useDataOpsStream.ts:30` → delay `30s-24h` vs chuẩn Bloomberg `<2s`.

---

## A. BẢN ĐỒ KIẾN TRÚC LỊCH CHẠY

| File | Dòng | Trách nhiệm | Liên quan ảnh |
|------|------|-------------|---------------|
| `SocSchedulerBoard.tsx:424` | 737 | Board `DEGRADED 39/29/3/0/4` `SchedulerHealthStrip:110` + table 8 cột `TÊN JOB/DOMAIN/TRẠNG THÁI/ĐỘ TƯƠI MỚI/LẦN CHẠY TIẾP/ĐỘ TRỄ/THAO TÁC/LỊCH SỬ` `JobActionButtons:163` + `JobHistoryDrawer:284` | Ảnh toàn bộ |
| `soc.js:252-274` | 614 | `getSocSchedulerPlan/Health/JobHistory/postSocSchedulerJobAction` `coreGet /operator/scraping/dataops/scheduler/...` | Network |
| `vninvest_core/settings.py:536` | 741 | `CELERY_BEAT_SCHEDULE` `ingest-price-board-60s 60s`, `queue-tier-scheduler 30s`, `daily-backfill 17:05`, `warm-intraday 300s` | Cron |
| `dataops_market_data.py:269` | 857 | `queue_tier_snapshot` + `observability` `fail_rates/starvation` | Data |
| `global_symbol_coverage.py:506` | 817 | `build_global_coverage_summary` `MISSING` | Ảnh 6 Giám sát |

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE

`beat 30s` → `market-data-queue-tier-scheduler-30s` `dataops_market_data.py:216` `build_market_data_queue_tier_queryset` `hot 50/warm 1892` → `select_market_data_queue_tier_symbols:229` → `ServiceRunLog` `market_data.queue_tier_scheduler` `started_at` → `SocSchedulerBoard formatNextRun:90` → `lag_seconds = now - next_run_at` `:76` → `QUÁ HẠN 3h26m` khi `next_run_at` null. `ingest-price-board-60s` `fetch_and_upsert_price_board` đọc `GlobalSymbolRegistry` active → `vnbroker_adapter fetch_price_board_snapshots_batch` → `GlobalSymbolCoverage` `fresh/warm` → `Độ phủ` `537 fresh`. Khi `queue-tier-scheduler` overdue → không có `plannable_gap` → `MISSING 749` đứng.

---

## C. CONTRADICTIONS

| Plan `AGENTS.md GAP CLOSED` | Thực tế `file:line` | Tác động |
|---|---|---|
| `daily-backfill-1700` `HEALTHY` cron hàng ngày | `SocSchedulerBoard.tsx:691` `next_run_at —` `lag 26m 8s` dù `crontab 17:05` `settings.py:561` | Operator không biết cron ngày mai |
| `ingest-price-board-60s` realtime `60s` | `Thiếu dữ liệu` `next — lag —` | Thiếu `is_inflight` + `freshness` null → không heartbeat |
| `DEGRADED 3` là cảnh báo nhẹ | `QUÁ HẠN 4` trong đó `queue-tier-scheduler 3h26m` là gốc rễ | Health strip không phân biệt `overdue` vs `degraded` |

---

## D. FINDINGS CHUẨN CÔNG NGHIỆP (Airflow/Dagster/Temporal)

| ID | Mức | `file:line` | Thực tế ảnh | Tác động | Tại sao mất đồng bộ realtime |
|---|---|---|---|---|---|
| **F-S01** | CRITICAL | `SocSchedulerBoard.tsx:696` `dataops_market_data.py:779` `lag 3h26m` | `queue-tier-scheduler-30s QUÁ HẠN` | Gốc rễ — không queue → `warm 1892` không `realtime_prefetch` → `price_board 1.533 MISSING` | Queue-tier là **duy nhất** đẩy `hot 50` vào `realtime_prefetch` `QUEUE_TIER_EXECUTION_QUEUES:35`. Quá hạn 3h = 390 lần miss 30s → gap 6h thị trường không bù. |
| **F-S02** | CRITICAL | `settings.py:537` `ingest-price-board-60s` `SocSchedulerBoard:691` `Thiếu dữ liệu —` | `ingest-price-board-60s` `— —`, `ingest-daily-prices-1705` `—` | 2 ingest realtime chết → `snapshot 1.533 MISSING` | `Thiếu dữ liệu` = `freshness_state null` khi `GlobalSymbolCoverage` chưa từng `has_plannable_gap` → job không được `beat` tạo `next_run_at`. Thiếu `manual_only` fallback `run_now`. |
| **F-S03** | HIGH | `SocSchedulerBoard:666` `is_possibly_stuck` + `reconcile-stale 8m48s SUY GIẢM` | `QUÁ HẠN 4` + `SUY GIẢM 3` | Không có **SLA retry/backoff** — chỉ `Tắt/Chạy ngay/Hủy` thủ công | Chuẩn cần `exponential backoff + dead-letter + auto-retry 3 lần` như `deliver_webhook:231 autoretry_for`. Hiện `reconcile-stale` phải bấm tay `Hủy` → `SIGKILL`. |
| **F-S04** | HIGH | `SocSchedulerBoard:90` `formatNextRun` → `—` | `daily-backfill 1700` `—`, `deep-history —` | Không phân biệt `interval` vs `crontab` → tưởng job hỏng | Thiếu cột `CRON`/`INTERVAL` + `Time Until Next` như Airflow `DAG Runs`. `next_run_at` null với cron daily là **bình thường** sau 17:05, phải hiện `Tomorrow 17:05 (in 20h)` không phải `—`. |
| **F-S05** | HIGH | `SocSchedulerBoard:460` `setInterval 60s + jitter 3s` | Poll 60s, không `Live` | Delay `60s` vs Bloomberg `<500ms` | Thiếu **SSE** như `useDataOpsStream.ts:30` `retry 3000 ping 15s` đã có cho `observability` nhưng chưa cho `scheduler` → `Re­connecting` ở Giám sát lặp lại. |

---

## E. QUALITY GATES

| Gate | Lệnh | Trạng thái |
|---|---|---|
| Lint | `npm run lint` | 0 errors |
| Type | `tsc --noEmit` | 0 |
| Test | `vitest soc-monitor 5/5` | PASS |
| BE | `manage.py test service_ops.tests.test_soc_api_domain.DataOpsDomain` | 22 OK, nhưng `MatrixDomain 2 fail` + `signals_stream 16* connection closed` khi full 348 |
| i18n | `vi.js` | `Tắt/Chạy ngay/Hủy/Lịch sử` đủ, thiếu `CRON` label |

---

## F. TẠI SAO CHƯA ĐỒNG BỘ REALTIME & GIẢI PHÁP

**Nguyên nhân gốc chuỗi:**
1. `queue-tier-scheduler-30s` QUÁ HẠN 3h26m → không tạo `has_plannable_gap` → `MISSING 749` đứng → `ingest-price-board-60s` dù chạy 60s cũng không có symbol mới để `fetch_price_board_snapshots_batch` → `snapshot 1.533 MISSING`.
2. `ingest-price-board-60s` `Thiếu dữ liệu` → không có `ServiceRunLog` success nào trong 24h → `fail_rates` tính `0/0` → `0.00%` giả.
3. `warm-intraday 300s` + `intraday_ticks/bars 573` cũng `Thiếu dữ liệu` → `tape 573` không cập nhật → `Session facts 1.533 MISSING`.
4. Thiếu **push**: chỉ `beat` poll, không `realtime_stream` consumer (`core-worker-realtime-stream` `CELERY_QUEUES realtime_stream` `docker-compose.dev.yml:245`) được `queue-tier-scheduler` đánh thức — nhưng scheduler chết nên stream chết theo.

**Giải pháp nâng cấp để luôn đồng bộ + chính xác + đầy đủ (chuẩn Bloomberg):**

**P0 HOTFIX (4h, không đổi BE contract):**
- `SocSchedulerBoard.tsx:696` thêm `if (job.lag_seconds == null) return t("soc.scheduler.not_scheduled")` thay `—`, và tooltip `cron: daily 17:05 ICT` cho `daily-backfill` → hết nhầm `—`.
- `JobActionButtons.tsx:182` cho `ingest-price-board-60s` thêm `capabilities: ["run_now","enable"]` dù `freshness null` → nút `Chạy ngay` xanh (hiện `Bật` xám) để operator bù tay ngay.
- `dataops_market_data.py:779` `is_starved` đổi `null → "Chưa chạy"` xám như đã fix starvation, không `STARVED` đỏ giả.

**P1 REALTIME PIPELINE (2d, BE):**
- Sửa `vninvest_core/settings.py:537` đảm bảo `ingest-price-board-60s` có `CELERY_BEAT_SCHEDULE` `60.0` + `queue realtime_prefetch` và `queue-tier-scheduler 30s` **bắt buộc** health `healthy` — thêm `readinessProbe` `python src/manage.py check_scheduler_queue_drift --warn-only` đã có `core-beat:396` nhưng interval `5m` quá dài → đổi `30s` + `restart: unless-stopped` đã có.
- Thêm **ingest fallback**: `market_serving/realtime_prefetch.py:451` `Failed to fetch` → `logger.warning` + `cache` degraded → đổi `TICKER_CACHE_MISS_ALLOW_DEGRADED True` `compose.dev.env:40` đã có, nhưng cần UI `degraded 25%` thay `0.00%`.
- **SSE cho scheduler**: copy `useDataOpsStream.ts:30` tạo `useSchedulerStream.ts` `event: scheduler` `GET /operator/soc/scheduler/stream/` (tái dùng `SOCStreamThrottle 60/min` `dataops_stream.py:30`) → `SocSchedulerBoard` `streamOpenRef` pause `setInterval 60s` khi `Live`, hiện `● Live` xanh thay `Re­connecting` xám.

**P2 ĐẦY ĐỦ + CHÍNH XÁC (3d, data):**
- **Backfill bù gap:** `pre5y-history-backfill-weekly` + `dnse-quarterly 90 ngày` hiện `3 ngày 21h` lag → đổi `crontab Sun 01:00` thành `daily 01:00` trong 7 ngày đầu sau deploy để `MISSING 749 → 0`, rồi trả lại `weekly`. Dùng `build_global_planner_preview:548` `force_refresh` để `All 1892` warm được hydrate.
- **Đầy đủ 1533 mã:** `warm 1892` nhưng `cold 0` → thiếu `cold_full_market` 0 → `listed_market` `dataops_market_data.py:27` `listed_market` chưa `sync_system_default_symbol_group` → chạy `ensure_market_data_system_default_baseline:113` `listing_sources`.
- **Chính xác:** Thêm `MarketDataParitySnapshot` `strict_fresh_parity 99%` `dataops_market_data.py:398` làm gate: nếu `<99%` thì `queue-tier-scheduler` tự `run_now` + alert `SOCStreamThrottle`.

**Verify:** `curl http://127.0.0.1:8080/core/v1/operator/scraping/dataops/scheduler/health/` `overall_health healthy` `quá hạn 0` + `GET /operator/soc/dataops/stream/` `event: scheduler` + `vninvest-dev-core-worker-realtime-prefetch` `LLEN realtime_prefetch 0` (không backlog).

---

**Lệnh kiểm sau P0:** `docker logs vninvest-dev-core-beat --tail 20 | grep queue-tier` + reload `http://127.0.0.1:8080/operations-center?tab=dataops` `Lịch chạy` không còn `—` mà `Tomorrow 17:05`.
