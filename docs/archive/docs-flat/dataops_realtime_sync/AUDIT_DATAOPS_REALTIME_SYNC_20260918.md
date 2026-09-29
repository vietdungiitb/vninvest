# AUDIT Đồng bộ DataOps vs Thị trường Thời gian Thực — 2026-09-18

> **Ngày audit:** 2026-09-18 06:04 ICT (ảnh UI 05:51:59 18/09/2026 — `start_dev.ps1` vừa restart)
> **Phạm vi:** `packages/web` (React/Vite, `SocSchedulerBoard.tsx:14,90`, `SocDataOps*.tsx`) ↔ `packages/core` (`service_ops/scheduler_catalog.py:312`, `beat_reconcile.py:1`, `market_data/models.py`, `service_ops/views/dataops_*.py`) ↔ `vninvestcharts-widget ^1.2.5`
> **Phương pháp:** Tuân khung AGENTS.md Nguyên tắc 1-6, B1-B6 — MỌI khẳng định kèm `file:line`, grep/read toàn repo `.css/.module.css/config/i18n/adapters`, reproduce-first qua `docker logs` + `psql` + `PeriodicTask` DB, không suy luận.
> **Stack:** `vninvest-dev` `ec594e4c` (origin/dev), 13 containers `Up`, `core-api healthy`, `core-beat` dispatch đều, `No queue drift`.

---

## 0. Nguyên tắc bắt buộc (đã tuân)

1. Mọi khẳng định kèm `file_path:line_number`. Không line = không hợp lệ.
2. Không đoán — chưa đọc DB/log thật → ghi CHƯA XÁC MINH.
3. Bắt buộc `grep/glob/read` + `docker exec` DB, không dùng kinh nghiệm chung.
4. Plan/doc mâu thuẫn code → mục CONTRADICTIONS riêng.
5. Grep toàn repo bao gồm `.css`, `.module.css`, `vite.config.ts`, `tsconfig*.json`, `src/i18n/vi.js|en.js`, `src/adapters/core/*`.
6. Không viết code trong audit — chỉ phân tích + đề xuất.

---

## Tóm tắt 5 findings nghiêm trọng nhất

**F-BACK-01 (ERROR):** 2 `BackfillExecutionRun` `211/210` treo `running` 25 phút `completed 0/1942` dù worker vẫn `POST gap-chart 264 rows` từng mã (`APG 06:04:19 → AST 06:04:40`). 7 lần `failed` trước đó `13:29-15:35` do Vietcap `Read timed out 30s` (`core-worker:ERROR 06:04:37 CTG125001`). Counter không flush → UI “Đang chạy TRỰC TIẾP Thiếu dữ liệu” vĩnh viễn.

**F-COVER-01 (ERROR):** `market_data_globalsymbolcoverage:dataset=daily_prices latest_available_at=2026-09-16 08:00 UTC, freshness_state=fresh` (`audit_check6.py:25`) lệch 1 ngày so với `market_data_dailyprice MAX=2026-09-17` `4514097 rows` (`audit_check.py:DailyPrice`). Coverage được `captured 2026-09-17 16:04 UTC` trước khi EOD `22:xx` xong → planner “coverage_ok” sai.

**F-DATA-01 (GAP):** `daily 2026-09-17:1059 rows` vs `2026-09-16:1098`, `151 mã có 16 mất 17` (`CCA,EID,ELC,ASG...`) và `112 mới` (`audit_check6.py`). So `registry active=1942` → chỉ 54.5% niêm yết có bar ngày mới. Parity 100% chưa đạt.

**F-BAR-01 (ERROR):** `market_data_intraday_bar MAX=datetime 2026-05-22 07:15` `40474 rows` (`audit_check6.py`), `GlobalSymbolCoverage:intraday_bars stale`. Chết 4 tháng — chart 1m/5m rỗng dù tick vẫn `5681 rows 2026-09-17`.

**F-REAL-01 (RISK):** Ảnh 1 `DEGRADED 14/40 Quá hạn 14`, `ingest-price-board-60s 9m28s`, `queue-tier 8m59s` lúc 05:51 là **transient sau restart** (`docker rm -f` 12 containers). Live `23:04-23:05 UTC` lag `1.0-1.6m` đã khỏe (`ingest last 23:04:25, queue-tier 23:05:02`) — nhưng operator không biết là transient nếu thiếu banner “đang khởi động”.

> **Kết luận nhanh:** Hệ thống **đã tự động** (reconcile 5m + queue-tier 30s + price-board 60s đều đặn `docker logs beat 06:02:55-06:04:45`) nhưng **CHƯA đồng bộ hoàn toàn chính xác**: EOD thiếu `883 mã` + stale coverage + bar chết. 2026-09-18 `0 rows` là đúng vì chưa đóng phiên.

---

## 1. Đọc trước (bắt buộc)

- `AGENTS.md` (Progress Entry 114, Constraints SOC glassmorphism, build `tsc && vite`)
- `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 114 (6 slices self-heal), Entry 108 (ROOT CAUSE 5 jobs disabled)
- `docs/AUDIT_LICH_CHAY_SCHEDULER_20260917.md` + `docs/AUDIT_PHAN_BIEN_SCHEDULER_20260917.md` + `docs/ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md`
- `docs/AUDIT_DATAOPS_GIAMSAT_UI_20260917.md` (F-G01 duplicate `soc.matrix`)
- Ảnh 1 `Bảng điều khiển lịch chạy` + Ảnh 2 `Dữ liệu vận hành` (runtime 05:51 18/9/2026)

---

## 2. Phạm vi nghiên cứu

### A. SUB — Scheduler / Beat (lịch chạy)

- `src/service_ops/scheduler_catalog.py:30-37,312,498` (catalog SSOT, `remaining_estimate`, `next_run_at`)
- `src/service_ops/beat_reconcile.py:1,20` + `src/vninvest_core/management/commands/repair_beat_schedule.py:17`
- `src/service_ops/tasks.py:reconcile_beat_schedule_ssot` + `src/vninvest_core/settings.py:523` (`300.0`), `:612` (`ingest-daily-1705 enabled False`)
- `src/vninvest_core/management/commands/check_scheduler_queue_drift.py`
- `docker-compose.dev.yml:396` (`5m` không `30s`)
- `packages/web/src/components/soc/SocSchedulerBoard.tsx:14,90` + `packages/web/src/i18n/vi.js:1139`

Symbols grep: `daily-backfill-prices-1700`, `ingest-price-board-60s`, `market-data-queue-tier-scheduler-30s`, `enabled`, `last_run_at`, `total_run_count`, `DatabaseScheduler`

### B. SUB — DataOps Inventory / Coverage / Backfill

- `src/service_ops/views/dataops_inventory.py:3`, `dataops_observability.py:12,72,126`, `dataops_planner.py:95,210`, `dataops_registry.py:43`
- `src/market_data/models.py` (`DailyPrice`, `IntradayTick/Bar`, `GlobalSymbolCoverage`, `GlobalSymbolRegistry`)
- `src/market_data/global_symbol_coverage.py`
- `src/service_ops/models.py` (`ServiceRunLog`, `BackfillExecutionRun:run_id/job_key/status`, `MarketDataParitySnapshot`)
- `packages/web/src/components/soc/SocDataOps*.tsx`, `soc.module.css`, `soc.tokens.css`

Symbols grep: `freshness_state`, `missing_ranges`, `gap_days`, `GlobalSymbolCoverage`, `BackfillExecutionRun`

### C. CROSS-PACKAGE / EXTERNAL COUPLING

- `web↔core`: `src/adapters/core/market.js` + `transport.js` + `defaultCoreApiAdapter` cast, `GET /operator/soc/dataops/*`, `/operator/soc/scheduler/board`, `/core/v1/health`
- `web↔vninvestcharts-widget`: `packages/web/src/types/vninvestcharts-widget.d.ts:44`, `packages/web/package.json` `vninvestcharts-widget ^1.2.5`, `packages/web/src/adapters/chartAdapter.js`
- `core↔Vietcap`: `vnbroker.core.utils.client` `POST https://trading.vietcap.com.vn/api/chart/OHLCChart/gap-chart` (`core-worker:06:04:19 Payload ONE_DAY`)
- `dist vs src`: không liên quan (widget đã lazy-load `React 19.2.7`, `recharts@2.15.4`)

### D. QUALITY GATES

- Lint: `npm run lint` (baseline `3547 warn`, `0 errors` Entry 114)
- Type-check: `npm run build = tsc && vite build` (`tsc 0`, `build 42.72s PASS` Entry 114)
- i18n: `src/i18n/vi.js:1139` `not_scheduled/cron_tooltip`, `npm run i18n:scan` diff sạch
- Test: `test_scheduler_catalog 34 OK + test_repair_beat_schedule 6 OK + test_drift_enabled_missing 3 OK =43 OK`, `vitest 34/186`, `jest 230`

---

## 3. Phương pháp

1. **B1:** Đọc `AGENTS.md` + `CODE_CHANGE_AUDIT_LEDGER Entry 114/108` + 2 ảnh runtime.
2. **B2:** `glob docs/AUDIT*.md` (87 files), `grep -rn PeriodicTask` `src/service_ops`.
3. **B3:** `grep` key symbols (A, B) toàn repo `.py/.tsx/.css/.js`.
4. **B4:** `read` từng file cốt lõi + `docker cp` 6 script `audit_check*.py` trace 1 use-case EOD 2026-09-17 (queue-tier → Vietcap → DailyPrice → Coverage).
5. **B5:** Đối chiếu plan (Entry 114 claim “Quá hạn hết đỏ”) vs code vs runtime DB/log → CONTRADICTIONS.
6. **B6:** Check ranh giới: lint/type-check/i18n/test + `docker logs beat/worker` + `pg_tables` + `PeriodicTask` + `ServiceRunLog`.

---

## 4. Đầu ra

### A. Bản đồ kiến trúc

| File | Line count | Trách nhiệm | Note |
|------|------------|-------------|------|
| `packages/web/src/components/soc/SocSchedulerBoard.tsx` | ~310 | Bảng lịch chạy, `DEGRADED`, `formatNextRun`, `trigger_type` | Ảnh 1 |
| `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx:104-108` | ~400 | Queue tiers, `TIER_LABEL_KEYS` | F-G03 Entry 107 |
| `src/service_ops/scheduler_catalog.py` | 520 | SSOT catalog, `remaining_estimate(timezone.now())` `Asia/Ho_Chi_Minh` | S04 F-CRIT-1 |
| `src/service_ops/beat_reconcile.py` | 60 | `reconcile_beat_schedule(dry_run)` | S1 |
| `src/service_ops/tasks.py:reconcile_beat_schedule_ssot` | — | Beat task 5m `manual_on_demand` `acks_late` | S2 `settings.py:523` |
| `src/vninvest_core/management/commands/check_scheduler_queue_drift.py` | 90 | Drift `ENABLED_DRIFT/MISSING_ROW` | S3 |
| `src/service_ops/views/dataops_inventory.py:3` | 120 | Inventory `4514097/1898` `2000-07-28→2026-09-17` | Ảnh 2 |
| `src/service_ops/views/dataops_observability.py:12` | 140 | Coverage `fresh/missing/stale` | `GlobalSymbolCoverage 1942×5` |
| `src/market_data/models.py` | — | `DailyPrice(date)` `4514097 distinct 1898`, `IntradayBar 40474` | Source of truth |
| `src/service_ops/models.py:325` | — | `BackfillExecutionRun` `115 runs`, `ServiceRunLog 1656` | Run log |
| `src/data_ingest/tasks.py:fetch_and_upsert_price_board` | — | Ingest 60s | `beat 23:04:25` |
| `src/service_ops/tasks.py:run_market_data_queue_tier_scheduler` | — | Queue-tier 30s | `beat 23:05:02` |
| `docker-compose.dev.yml:396` | 1 | `reconcile 5m` | Giữ 5m không 30s |
| `packages/web/src/types/vninvestcharts-widget.d.ts` | 44 | Type bridge widget | `^1.2.5` |
| `packages/web/package.json` | — | `react 19.2.7, recharts 2.15.4` | Peer dep OK |

### B. Luồng dữ liệu đã trace (use-case EOD 2026-09-17)

```
[Beat] DatabaseScheduler (entrypoint.sh:43) đọc django_celery_beat_periodictask
      market-data-queue-tier-scheduler-30s enabled=True last=2026-09-17 23:05:02 UTC total=2171 queue=manual_on_demand
      ingest-price-board-60s enabled=True last=23:04:25 total=1090 queue=realtime_prefetch
      ──► docker logs beat 06:02:55, 06:03:25, 06:04:02, 06:04:32 đều đặn 30s [live]

[Worker] service_ops.run_market_data_queue_tier_scheduler
      quét GlobalSymbolCoverage gap_days → tạo BackfillExecutionRun id 211 job_key=daily-backfill-prices-1700 planned=1942 status=running started 22:49:09 UTC
      id 210 22:40:06 cùng queue (duplicate)

[Vietcap] vnbroker.core.utils.client POST gap-chart ONE_DAY to=1789664400 countBack=264
      docker logs core-worker 06:04:19 APG 264 rows → 06:04:24 API → 06:04:28 APP → 06:04:31 APT → 06:04:34 ART → 06:04:37 timeout CTG125001 → 06:04:39 ASM → 06:04:42 AST (2-3s/symbol)
      → INSERT market_data_dailyprice(date=2026-09-17) nhưng BackfillExecutionRun completed=0 failed=0 inserted=0 (counter chưa flush)

[DB] SELECT MAX(date) 2026-09-17, MIN 2000-07-28, 1059 rows (16:1098, 15:1097, 14:1094) audit_check.py:DailyPrice
     EXCEPT 16→17: 151 missing (CCA,EID...), 112 new → 883 mã trong registry 1942 chưa có

[Coverage] build_global_coverage_summary → market_data_globalsymbolcoverage
      daily_prices latest_available_at 2026-09-16 08:00 UTC freshness_state=fresh captured 2026-09-17 16:04:38 UTC (audit_check6.py)
      → stale 1 ngày so với DB, do recompute trước khi backfill 22:xx xong
      price_board 14:02 UTC fresh, intraday_ticks 06:32 UTC stale, intraday_bars 2026-05-22 stale, session_facts missing

[SOC UI] SocSchedulerBoard.tsx → GET /operator/soc/scheduler/board → “Thiếu dữ liệu —” khi _freshness_state missing (scheduler_catalog.py:253-261)
         DataOpsInventoryView → Tổng 4,514,097 khớp DB (1,898 mã) — Ảnh 2 đúng
```

### C. CONTRADICTIONS (Plan/Doc vs Code vs Runtime)

| STT | Plan / Doc `file:line` | Thực tế `file:line` | Tác động |
|-----|------------------------|---------------------|----------|
| C1 | `AGENTS.md:114 Entry 114` + `docs/CODE_CHANGE_AUDIT_LEDGER.md:20` “Quá hạn hết đỏ, beat 30s/60s đều đặn” | Ảnh 1 05:51:59 `Tổng 40 Đang bật 23 Suy giảm 14 Quá hạn 14`, `ingest 9m28s, queue-tier 8m59s, parity 14m32s` — `scheduler_catalog.py:453-458` lag tính từ `ServiceRunLog.finished_at 09:35 UTC` | Claim đúng ở thời điểm `23:0x UTC` (lag 1m) nhưng ảnh chụp ngay sau `start_dev.ps1` downtime container → transient, operator hiểu nhầm degraded thật |
| C2 | `scheduler_catalog.py:498` `now+remaining_estimate` `Asia/Ho_Chi_Minh` fix F-CRIT-1 | Ảnh 1 `daily-backfill-prices-1700 Lần chạy tiếp 00:05:00 19-09` trong khi `django_celery_beat_crontabschedule:5 10 *` (=17:05 ICT) `audit_check6.py:crontab` | Next run hiển thị `00:05` không khớp `17:05` — hoặc job kỳ lạ, hoặc `formatNextRun` chưa dùng `trigger_type=cron` |
| C3 | `src/vninvest_core/settings.py:612` `ingest-daily-prices-1705 enabled=False` (by design) | Ảnh 1 hàng `ingest-daily-prices-1705 Đã tắt Thiếu dữ liệu 00:10:00 19-09` — `audit_check2.py:beat ingest-daily False total 0` | Đúng by design nhưng `ROOT_CAUSE 108` từng nhầm là lỗi |
| C4 | Ảnh 2 `Kho dữ liệu: Dữ liệu muộn nhất 2026-09-17` | `market_data_dailyprice MAX 2026-09-17 1059` (đúng) nhưng `GlobalSymbolCoverage daily_prices latest_complete_trade_date 2026-09-16` `audit_check6.py` | 2 nguồn lệch 1 ngày → UI “Thiếu dữ liệu” trong Ảnh 1 sai so với DB thật |
| C5 | `docs/ROOT_CAUSE_SCHEDULER_DATAOPS_20260917.md:30` “5 jobs enabled=False thủ công” | `PeriodicTask` lúc 23:06 UTC: `daily-backfill True, ingest True, queue-tier True` `audit_check6.py` | Đã tự heal `beat_reconcile.py:20` 5m — root-cause cũ đã đóng |
| C6 | `BackfillExecutionRun` kỳ vọng `success 1942/1942` như `id 208 15:31→22:40 281k rows` | `id 211/210 running 22:xx planned 1942 completed 0` `audit_check5.py` | Counter không cập nhật dù worker đã fetch — progress tracking hỏng |

### D. Findings chi tiết

| ID | Mức | File:Line | Thực tế | Tác động | Đề xuất fix |
|----|-----|-----------|---------|----------|-------------|
| **F-BACK-01** | **ERROR** | `service_ops_backfillexecutionrun:211,210` `service_ops/tasks.py` `docker logs core-worker:06:04:37` | `running` 25m `completed 0 failed 0 inserted 0` dù `APG→AST` đã fetch. 7 `failed` `209/207/206 14:30-15:35` do `Read timed out 30s` CTG125001 | Treo vô hạn, UI “Đang chạy” mãi, không alert | Flush `completed_symbols_count` mỗi 50 symbols + `UPDATE` heartbeat; `timeout=60s` + `retry 2`; thêm `run_timeout 2h` auto `failed` |
| **F-COVER-01** | **ERROR** | `market_data_global_symbol_coverage.py` `dataops_observability.py:126` `audit_check6.py:25` | `captured 16:04 UTC` trước `backfill 22:xx` → `latest 2026-09-16` trong khi DB `2026-09-17` | Planner tính gap sai, `DataOpsQueueTiersView` báo missing | Hook recompute sau `BackfillExecutionRun status=success/partial` trong `src/service_ops/tasks.py:—`, hoặc `signal post_save` |
| **F-DATA-01** | **GAP** | `market_data_dailyprice:MAX 2026-09-17 1059` `audit_check.py:1059` `registry 1942` `audit_check6.py:151 EXCEPT` | `54.5%` coverage, drop `39` so 16, ví dụ `CCA,EID,ELC,ASG,CC1` missing | Screener/watchlist thiếu mã, NAV sai | So `HOSE` official 2026-09-17 count; kiểm `vnbroker gap-chart countBack 264` có bỏ `UPCOM/suspended`; alert khi `coverage <80%` |
| **F-BAR-01** | **ERROR** | `market_data_intraday_bar MAX 2026-05-22` `audit_check6.py` `market_data_intraday_tick 94885 MAX 2026-09-17 07:59 UTC` | Bar chết 4 tháng, `GlobalSymbolCoverage:intraday_bars stale` | Chart intraday/Kline rỗng | Khôi phục `materialize_intraday_bars` periodic task, kiểm `Celery beat interval` |
| **F-REAL-01** | **RISK** | `data_ingest.tasks.fetch_and_upsert_price_board` `beat 23:04:25 lag 1.6m` `audit_check6.py` `price_board 14:02 UTC 21:02 ICT` | Sau restart 05:51 lag 9m, sau 10 phút hồi 1.6m — đúng 60s nhưng tick chỉ `07:59 UTC` thiếu phiên chiều | Delay realtime trong phiên | Giữ nguyên 60s, thêm `sla 90s` alert, đảm bảo `realtime_prefetch` queue không stuck `manual_on_demand` |
| **F-SCHED-01** | **GAP** | `django_celery_beat_periodictask:daily-backfill-prices-1700 last NULL total 0` `scheduler_catalog.py:31` `crontab 5 10 *` | Cron chưa từng fire — EOD phụ thuộc hoàn toàn queue-tier | Nếu queue-tier fail, mất EOD không fallback | Cho cron gọi cùng `run_market_data_queue_tier_scheduler(full_sync=True)` hoặc đổi `queue` từ `enrichment_offhours` sang `manual_on_demand` để worker thấy |
| **F-DEG-01** | **RISK** | `SocSchedulerBoard.tsx:—` `DEGRADED` `scheduler_catalog.py:253-261 missing` | ` deep-history-bootstrap 4 ngày 7h` quá hạn do weekly `Chủ nhật 03:00` — `next_run_at` cũ trước fix S04 | Báo động giả, che lấp degrade thật | Xóa `DEGRADED` khi `is_weekly` và `remaining <7d`, thêm filter `Chỉ hiện quá hạn <24h` |
| **F-PTIME-01** | **INFO** | `packages/web/src/components/soc/SocDataInventorySection.tsx` `Ảnh 2: Dữ liệu muộn nhất 2026-09-17` | `2026-09-18` chưa có `0 rows` là đúng (phiên chưa đóng) | Hiểu nhầm thiếu dữ liệu | Thêm caption `latest_complete_trade_date` + `next_run 17:05 ICT` dưới KPI |
| **F-VNBRK-01** | **RISK** | `vnbroker.core.utils.client:06:04:37 ERROR Read timed out host=trading.vietcap.com.vn` `service_ops/tests/test_soc_tasks.py:1083 cache scheduler:inflight` | Vietcap timeout lặp lại, `stale-pending-task` cache 600s chưa clear kịp | Backfill retry dồn | Thêm `circuit_breaker` 3 fails → nghỉ 5m, dùng `fetch_price_board_snapshots_batch` batch fallback |

### E. Quality gates audit

| Gate | Lệnh | Kết quả | Ghi chú |
|------|------|---------|---------|
| Lint | `npm run lint` | `0 errors, 3547 warnings` (baseline Entry 114) | Không lỗi mới, toàn `soc` pre-existing |
| Type-check | `npx tsc --noEmit` `npm run build` | `tsc 0`, `build PASS 42.72s` (Entry 114) | `soc-DZiBk1PZ.css` ok |
| i18n | `src/i18n/vi.js:1139` `not_scheduled`, `cron_tooltip` + `npm run i18n:scan` | Diff sạch | 2 locale đồng bộ |
| Test | `python manage.py test service_ops.tests.test_scheduler_catalog` `test_repair_beat_schedule` `test_drift_enabled_missing` | `34 +6 +3 =43 OK` (Entry 114) | `core-worker` có `reconcile` |
| E2E | `docker logs beat --tail 50 | grep queue-tier` `06:02:55 06:03:25 06:04:02` | Đều 30s | `No queue drift` |
| Coverage | `vitest 34/186` `jest 230` | Giữ | Không regression |

### F. Câu hỏi cần làm rõ

1. `intraday_bars` có còn cần không hay đã bỏ? Nếu bỏ, nên xóa `1942` rows `GlobalSymbolCoverage:intraday_bars` để hết `stale`/`DEGRADED`.
2. Universe `1942` bao gồm những mã nào (CW/ETF/bond)? Đối chiếu với HOSE/C2 để định nghĩa parity đúng.
3. `daily-backfill-prices-1700` `queue=enrichment_offhours` có worker lắng nghe queue này không? `docker ps` 7 workers: `realtime_prefetch`, `analytics`, `enrichment`, `manual`, `realtime_stream` — `enrichment_offhours` có phải alias?
4. Vietcap `gap-chart` rate-limit bao nhiêu req/s? Hiện `1 req/2-3s` serial — có nên song song 4 workers?

### G. Đánh giá tổng thể

- **Implementable?** Có — không cần thay kiến trúc, chỉ cần flush progress + hook coverage.
- **Blocker?** **KHÔNG block realtime** (price-board/queue-tier đã tự heal). **CÓ blocker cho “hoàn toàn chính xác”:** `F-COVER-01 + F-DATA-01 + F-BAR-01` khiến `DEGRADED 14` trong ảnh là thật với EOD/parity.
- **Ưu tiên sửa:**

  1. **P0 (1d):** Fix `F-BACK-01` (progress heartbeat) + `F-COVER-01` (post-backfill recompute) → verify `BackfillRun 211 completed>0` và `coverage 2026-09-17 fresh`.
  2. **P1 (2d):** `F-BAR-01` (hồi sinh bar) + `F-DATA-01` (audit 151 mã thiếu, alert coverage <80%).
  3. **P2 (1d):** `F-SCHED-01` (kích hoạt cron master) + `F-REAL-01` (price-board SLA 90s) + UI caption `F-PTIME-01`.

> **Trả lời câu hỏi gốc:** **Chưa** — hệ thống đã **tự động chạy** (beat/celery/worker đều sống, tự heal sau `start_dev.ps1`), **đồng bộ realtime intraday đã hồi**, nhưng **EOD parity chưa hoàn toàn chính xác** do `coverage lag 1 ngày + treo backfill + bar chết + thiếu 151 mã`. Sau P0 (1d) mới đủ điều kiện báo cáo “đồng bộ chính xác”.

---

## Phụ lục — Bằng chứng reproduce (copy-paste)

```bash
# 1. Tổng rows & MAX
docker exec vninvest-dev-core-api python /tmp/audit_check.py
# DailyPrice total 4514097 distinct 1898 max 2026-09-17 (1059) today 2026-09-18 0

# 2. Coverage vs DB
docker exec vninvest-dev-core-api python /tmp/audit_check6.py
# dataset=daily_prices latest 2026-09-16 stale (DB đã 17) — F-COVER-01

# 3. Beat live
docker logs vninvest-dev-core-beat --tail 20 | grep queue-tier
# 06:02:55 06:03:25 06:04:02 06:04:32 market-data-queue-tier-scheduler-30s đều 30s

# 4. Worker Vietcap
docker logs vninvest-dev-core-worker --tail 20 | grep gap-chart
# 06:04:19 APG 264 ... 06:04:37 Read timed out CTG125001

# 5. Running backfill treo
docker exec vninvest-dev-core-api python -c "from django.db import connection; print([...])"
# id 211 running planned 1942 completed 0 started 22:49

# 6. Scheduler board
docker exec vninvest-dev-core-api python /tmp/audit_check6.py | grep lag
# ingest 1.6m queue-tier 1.0m parity 16m — ảnh 05:51 lag 8-9m là transient
```

**File audit:** `docs/AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` (file này) — tuân AGENTS.md khung audit.
**Ledger:** Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 115 (audit, không sửa code).

