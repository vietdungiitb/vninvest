# PHẢN BIỆN ĐỘC LẬP — `AUDIT_LICH_CHAY_SCHEDULER_20260917.md`

**Ngày:** 2026-09-17 — **Trạng thái:** TRA CỨU THUẦN (không sửa code) — **Nguyên tắc:** AGENTS.md mục 0 — mọi khẳng định kèm `file:line`, đối chiếu plan↔code, file không tồn tại → báo `KHÔNG TỒN TẠI`, không chốt root cause bằng suy luận.

**Kết luận tóm tắt:** Chẩn đoán "gốc rễ" của audit **chưa được chứng minh**; **3 claim sai line/file/capability**, **1 claim sai hoàn toàn (F-S02)**, **F-S04 là đúng và có giá trị**. Plan P0 (4h) như viết **không thể merge nguyên trạng** — phần lớn là UI cosmetic, thiếu item vận hành thực (beat/worker `manual_on_demand`). P0 thực = reproduce root cause + tạo PeriodicTask row + cron next-run BE.

---

## A. BẢN ĐỒ ĐỐI CHIẾU AUDIT ↔ CODE

| Audit `file:line` | Thực tế code (đã đọc) | Đúng lệch |
|---|---|---|
| `SocSchedulerBoard.tsx:424` (board) | Component export tại `:424` ✓, 737 dòng ✓ | Đúng |
| `SchedulerHealthStrip:112` | Inline trong `SocSchedulerBoard.tsx:110-161` (không phải file riêng); healthColor tại `:112-116` | Đúng ý, lệch định danh (inline, không separate file) |
| `JobActionButtons:163` | Inline `SocSchedulerBoard.tsx:164-221` | Đúng ý |
| `JobHistoryDrawer:284` | Inline `SocSchedulerBoard.tsx:284-421` | Đúng |
| `formatNextRun:90` | `SocSchedulerBoard.tsx:90-98` trả `"—"` khi `dateStr` falsy ✓ | Đúng |
| `formatLag:76` | `:76-88` trả `"—"` khi `seconds == null` ✓ | Đúng |
| Poll `SocSchedulerBoard.tsx:460` | `:457-472` `setInterval(60000 + jitter)` (jitter `Math.random()*3000` tính 1 lần) + `visibilitychange` | Đúng |
| `soc.js:252` scheduler adapters | `soc.js:253-274` `getSocSchedulerPlan/Health/JobHistory/postSocSchedulerJobAction` → `/operator/scraping/dataops/scheduler/...` | Đúng |
| `settings.py:536` CELERY_BEAT_SCHEDULE | `settings.py:383` khai mở; `ingest-price-board-60s` `:537-541` (60.0s, queue `realtime_prefetch`) ✓; `queue-tier-scheduler-30s` `:487-491` (30.0s, queue `manual_on_demand`) | Đúng |
| `settings.py:561` crontab 17:05 daily-backfill | `:560-565` — `daily-backfill-prices-1700`, `schedule: crontab(hour=17, minute=5)`, queue `enrichment_offhours` | Lệch 1 dòng (562) — không chất |
| **F-S02 dẫn `settings.py:537-543` cho `ingest-daily-prices-1705`** | **`ingest-daily-prices-1705` thực tại `settings.py:607-613`, `'enabled': False` `:612` (P3-T03 shadow run)** | **SAI — xem bảng C** |
| `dataops_market_data.py:269` (poll 30s) | `:269` = `build_market_data_queue_tier_snapshot` (snapshot builder). Poll 30s thực: `tasks.py:1050` `run_market_data_queue_tier_scheduler` + `settings.py:489` | Lệch file chức năng |
| `dataops_market_data.py:711` | `:711` = `build_market_data_observability_summary` ✓ | Đúng |
| `dataops_market_data.py:779` is_starved | `:783` `is_starved = seconds_since_last_progress is None or > threshold` (779 là `starvation_threshold_seconds`) | Lệch vài dòng |
| `global_symbol_coverage.py:506` | `:506` = `build_global_coverage_summary` ✓ (đếm `freshness_state` per dataset, top_gaps) | Đúng |
| `realtime_prefetch.py:451` "Failed to fetch" | `:451` `logger.warning(f"Failed to fetch {symbol}: {ex}")` ✓ | Đúng |
| `core-beat` healthcheck `docker-compose.dev.yml:396` interval 5m | `:395-399` — healthcheck `check_scheduler_queue_drift --warn-only`, **interval 5m** ✓ | Đúng |
| `sync_scheduler_queues` | `sync_scheduler_queues.py:15` loop `PeriodicTask.objects.all()` — **chỉ fix queue drift của task đang tồn tại, KHÔNG tạo row mới** | Điểm audit BỎ SÓT |

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE (đối chiếu audit §B)

### B1. Bảng Lịch chạy (FE)
`load()` `:436-455` → `Promise.all([getSocSchedulerPlan, getSocSchedulerHealth])` → render health strip `:110` + table 8 cột `:610-618`. Cột:
- **Trạng thái** `:663` → `t(soc.scheduler.status_{job.status})` (status = `degraded` khi stale/nằm giữa).
- **Độ tươi mới** `:690-693` → `freshness_state ? t(...) : "—"` (missing → `"Thiếu dữ liệu"` `vi.js:1145`).
- **Lần chạy tiếp** `:695` → `formatNextRun(next_run_at)` → `"—"` khi null `:91`.
- **Độ trễ** `:696` → `formatLag(lag_seconds)` → `"—"` khi null `:77`.
- **Thao tác** `:697` → `JobActionButtons` (capability từ server `job.capabilities`, readonly; `abort_active`→`abort` `:175`).

### B2. Catalog (BE) — nguồn sinh `next_run_at/lag/freshness/status`
`build_scheduler_catalog` `scheduler_catalog.py:307-526`:
1. `last_run_at` từ `PeriodicTask.last_run_at` `:406-408`.
2. S04-ext: override bằng `ServiceRunLog.finished_at` nếu mới hơn, **chỉ khi job có `service_key`** `:453-458`.
3. `lag_seconds = now - last_run_at` `:414`.
4. `freshness` qua `_freshness_state` `:253-261` (`None→missing`, `≤120s→fresh`, `≤warm→warm`, else `stale`).
5. **`next_run_at` CHỈ tính khi schedule là `int/float`** `:485-492` (`last_run_at + interval`). **Crontab KHÔNG bao giờ có `next_run_at`** → F-S04 đúng.
6. `_derive_status` `:275-304`: running > paused > disabled > degraded > idle > enabled.

### B3. Chuỗi F-S01 (queue-tier)
- Task `tasks.py:1050` chạy mỗi 30s (beat), dispatch tier qua `create_global_planner_run` (mode strict_fresh/missing_only) tới queue tier (`QUEUE_TIER_EXECUTION_QUEUES` `dataops_market_data.py:35-40`).
- Backpressure guard `tasks.py:1114-1135`: skip dispatch nếu `queue_depth > REALTIME_PREFETCH_MAX_QUEUE_DEPTH`.
- Health strip "3 Suy giảm": `degraded` sinh từ freshness `stale` (lag > warm) HOẶC `is_possibly_stuck` (inflight vượt `max_expected_run_seconds`) `scheduler_catalog.py:464-472`.
- **Lag 3h26m chưa thể suy ra "scheduler đứng"**: cả 2 nguồn (`PeriodicTask.last_run_at` = dispatch beat; `ServiceRunLog.finished_at`) đều cũ → chỉ chứng minh *không có run hoàn thành / không có dispatch* trong 3h26m — **chưa trace được nguyên nhân** (beat chết? row PeriodicTask thiếu? worker chết? backpressure?). Strip có `by_status.running=0` → không có run nào đang chạy → cần verify worker trước khi kết luận.

---

## C. CONTRADICTIONS (audit vs code)

| # | Audit (plan) `file:line` | Thực tế code `file:line` | Tác động |
|---|---|---|---|
| C1 | **F-S02**: `ingest-daily-prices-1705` là "ingest realtime chết" `settings.py:537-543`, cần sửa | `settings.py:612` **`'enabled': False`** — disabled by design (P3-T03 shadow run). Job = crontab 17:10, không phải realtime. `SocSchedulerBoard` hiển thị "Thiếu dữ liệu" cho job đang tắt là **hành vi chuẩn** (catalog: not enabled → status `disabled`; freshness `missing` vì chưa từng chạy) | **F-S02 CRITICAL sai nền tảng** — ½ claim không phải lỗi. Không được merge như "2 ingest chết" |
| C2 | P0 fix: thêm `capabilities: ["run_now","enable"]` cho ingest-price-board tại `JobActionButtons.tsx:182` | **`JobActionButtons.tsx` KHÔNG TỒN TẠI** (component inline `SocSchedulerBoard.tsx:164`); `:182` là `control_mode` mapping. Capability `run_now` **đã có sẵn** `scheduler_catalog.py:73` (`['enable','disable','run_now','abort_active']`) | P0 item vô hiệu — file không có, capability không thiếu |
| C3 | F-S03: deep-history `lag 3d21h` nằm trong "4 Quá hạn" | deep-history có `freshness_warm_seconds = 7d` `scheduler_catalog.py:117` → 3d21h = **warm** (không stale, không degraded) | Mis-attribute — deep-history không góp vào "4 Quá hạn/3 Suy giảm" |
| C4 | F-S01: "poll 30s `dataops_market_data.py:269`" | `:269` = snapshot builder; poll 30s = `tasks.py:1050` + `settings.py:489` | Dẫn chiếu lệch chức năng |
| C5 | F-S05: "Reconnecting ở Giám sát lặp lại" gắn với scheduler | "Reconnecting" thuộc `useDataOpsStream` (tab Giám sát, `SocDataOpsMonitorSection`) — dataops stream chỉ emit observability/coverage/queue_tiers, **không** plan/health/jobs | Nhiễu — không phải bằng chứng cho scheduler thiếu push |

---

## D. ĐÁNH GIÁ TỪNG FINDING

| ID | Mức audit | Verdict độc lập | Lý do |
|---|---|---|---|
| **F-S01** (queue-tier quá hạn 3h26m) | CRITICAL | **HIỆN TƯỢNG ĐÚNG — GỐC RỄ CHƯA CHỨNG MINH** | Lag >3h26m với running=0 nghĩa là không có run hoàn thành và không dispatch — nhưng audit không có bằng chứng (beat log, PeriodicTask row, worker liveness, queue depth). Backpressure guard `tasks.py:1116` cũng là ứng viên bỏ sót. Vi phạm Nguyên tắc 6 (không chốt bằng suy luận) |
| **F-S02** (2 ingest "Thiếu dữ liệu —") | CRITICAL | **SAI** | `ingest-daily-prices-1705` tắt sẵn `settings.py:612`. "Thiếu dữ liệu" của nó = đúng thiết kế. Phần `ingest-price-board-60s` đáng xem nhưng root cause (PeriodicTask row missing/disabled) chưa được audit truy ra |
| **F-S03** (reconcile suy giảm + thiếu retry/backoff) | HIGH | **NỬA ĐÚNG** | `reconcile-stale` warm=300s `scheduler_catalog.py:65`, lag 8m48s → stale → degraded: **logic đúng**. Nhưng "4 Quá hạn ≠ 3 Suy giảm" (1 stale là job disabled, đúng thiết kế). Thiếu auto-retry: đúng nhưng là P1, không demo blocker (mất 1 cycle 5m) |
| **F-S04** (UI không phân biệt cron/interval, `next_run_at=null` → "—") | HIGH | **ĐÚNG — finding thực nhất** | `scheduler_catalog.py:485-492` chỉ tính next_run_at cho `int/float`; crontab luôn null → `formatNextRun` `SocSchedulerBoard.tsx:91` luôn "—" dù job khoẻ. Fix BE tính next-fire từ crontab (ít dòng, không đổi contract) |
| **F-S05** (thiếu SSE scheduler, poll 60s) | HIGH | **ĐÚNG SỰ KIỆN — SAI MỨC ĐỘ** | Không có scheduler stream; poll `:459-463`. Nhưng chuẩn "Bloomberg <500ms" cho ops board là over-engineering; trích "Reconnecting" là nhiễu (khác tab). Hạ xuống LOW/MED, P1 |

---

## E. NHỮNG GÌ AUDIT BỎ SÓT

1. **2 cơ chế freshness khác nhau**: job có `service_key` (lag từ `ServiceRunLog.finished_at`, S04-ext `scheduler_catalog.py:453-458`) vs job không service_key (chỉ `PeriodicTask.last_run_at`). `ingest-price-board-60s`/`warm-intraday`/`ingest-daily-prices-1705` **không có service_key** (`scheduler_catalog.py:68-107`) → hiển thị "Thiếu dữ liệu" khác bản chất với queue-tier.
2. **`sync_scheduler_queues` không tạo PeriodicTask row mới** (`sync_scheduler_queues.py:15`) — ứng viên gốc rễ thật cho job mới thêm vào `CELERY_BEAT_SCHEDULE` ("Thiếu dữ liệu" = beat không dispatch vì không có row DB, DatabaseScheduler `entrypoint.sh:43` đọc DB).
3. **Backpressure guard** `tasks.py:1114-1135` (`skip reason queue_backpressure`) là 1 ngõ chết thay thế cho lý thuyết "scheduler đứng" — audit không xét.
4. **P0 toàn UI cosmetic** (đổi "—", bật nút, đổi nhãn), trong khi 2 CRITICAL thực chất là **1 vấn đề vận hành** (beat/worker không hoàn thành job `manual_on_demand`) — không item nào kiểm tra nhóm đó.

---

## F. QUALITY GATES (audit tự report — chưa chạy lại trong phản biện này)

| Gate | Audit (chưa đối chiếu lại) | Ghi chú phản biện |
|---|---|---|
| Lint `npm run lint` | 0 errors | Plausible (không đụng FE) |
| Type `tsc --noEmit` | 0 | — |
| Test `vitest soc-monitor` | 5/5 | Khớp baseline Entry 107 |
| BE `DataOpsDomain` | 22 OK, MatrixDomain 2 fail | 2 fail thuộc nhóm pre-existing ledger, không phải lỗi mới |
| i18n | thiếu label CRON | **Đúng** — không có key cron/interval label (chỉ `scheduler: 'Lịch chạy'` `vi.js:464`) |

---

## G. KHUYẾN NGHỊ P0/P1/P2 (thay cho plan gốc)

**P0 (vận hành — không phải UI):**
1. **Reproduce trước**: `docker logs` beat (có dispatch `queue-tier` không), kiểm tra `PeriodicTask.objects.filter(name__in=[...])` có row/đang enabled, worker `core-worker-manual` liveness, `LLEN manual_on_demand`, `scheduler:inflight:*` cache. → Xác định 1 trong: beat chết / row missing / worker chết / backpressure.
2. Tự-heal: mở rộng `sync_scheduler_queues` (hoặc script) tạo `PeriodicTask` + `IntervalSchedule`/`CrontabSchedule` cho job thiếu row (đóng gap "Thiếu dữ liệu").
3. **F-S04** (giữ nguyên, giá trị cao/ít công): BE tính next_ fire từ crontab trong `build_scheduler_catalog`; FE hiện "Ngày mai 17:05 (sau ~20h)" thay "—".

**P1:** auto-retry/backoff cho `reconcile-stale` (theo `deliver_webhook autoretry_for` mà audit trích — đúng hướng); SSE scheduler chỉ khi P0 xong và có nhu cầu thật (hạ mức).

**P2:** làm phép bù gap/baseline `ensure_market_data_system_default_baseline` `dataops_market_data.py:113` như đề xuất — giữ, nhưng không phải block realtime.

**KHÔNG làm**: F-S02 CRITICAL, P0 `JobActionButtons.tsx` (file không tồn tại), P0 "thêm capabilities" (đã có).

---

*Phản biện này là tra cứu thuần — không sửa code. Entry ledger mới sẽ ghi kết luận khi có quyết định thực thi.*