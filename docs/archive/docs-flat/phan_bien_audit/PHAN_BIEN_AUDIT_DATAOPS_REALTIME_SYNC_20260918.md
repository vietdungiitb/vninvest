# PHẢN BIỆN ĐỘC LẬP — AUDIT Đồng bộ DataOps vs Thị trường Thời gian Thực (2026-09-18)

> **Ngày phản biện:** 2026-09-18 (reproduce live, container `vninvest-dev` 00:26 UTC = 07:26 ICT)
> **Đối tượng bị phản biện:** `docs/AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` (ledger Entry 115)
> **Phương pháp:** Tuân khung AGENTS.md (Nguyên tắc 1-6, B1-B6) — reproduce-first qua `docker exec`/`docker logs`/`psql` + đọc code `file:line`. Không sửa code.
> **Nguyên tắc:** Mọi verdict CONFIRMED/PARTIAL/REFUTED kèm `file:line` + bằng chứng live. Chỉ kết luận khi đã reproduce.

---

## 0. Tóm tắt 5 kết luận nghiêm trọng nhất (verdict trước)

1. **F-BACK-01 — PARTIAL.** Cơ chế "counter không flush" **CONFIRMED** (`data_ingest/tasks.py:1700-1748` chỉ ghi counter ở cuối). Nhưng "treo vô hạn" **REFUTED**: run 208 chạy 7h09m rồi **hoàn tất bình thường** (`completed=1942, inserted_rows=281172`) bằng chính đoạn finalize đó; run treo >2h bị **B08 tự đóng** (`tasks.py:1316-1379`). Thêm defect audit bỏ sót: `time_limit=11400` (3h10m) ở `tasks.py:1755` **không được thực thi** (run 208 vượt 7h09m) → job độc chiếm worker `concurrency=1`.
2. **F-COVER-01 — CONFIRMED (định vị lại root cause).** `_backfill_daily_prices_impl` finalize (1700-1748) **KHÔNG** gọi `_refresh_coverage_for_symbols`; refresh chỉ có ở `ingest_daily_prices` (`tasks.py:1257`) và `fetch_and_upsert_*` (`771, 898`). Vì vậy mọi run dispatch qua task `backfill_daily_prices` **không bao giờ** cập nhật coverage. Fix audit đề xuất ("hook trong `service_ops/tasks.py`") **sai vị trí**.
3. **F-BAR-01 — REFUTED-as-stated / PARTIAL.** `market_data_intraday_bar` **TƯƠI tới 2026-09-17 07:59 UTC, 40474 rows** (Sept 8771 + May 31703). "Chết 4 tháng" là **SAI** — "MAX=2026-05-22" trong audit là trường của **`GlobalSymbolCoverage:intraday_bars`**, không phải bảng bar; `audit_check6.py` **không có query intraday_bar**. Gap thật: **Jun–Aug = 0 rows**.
4. **F-SCHED-01 — CONFIRMED, kết luận chưa đủ.** Đúng `last_run_at=None/total_run_count=0`. Nhưng audit kết "cron chưa từng fire" mà bỏ sót: runs 210/211/212 **mang đúng kwargs beat** (`job_key=daily-backfill-prices-1700`, `triggered_by=beat_schedule` sinh tại `tasks.py:1432-1450`). Nguyên nhân loop: **beat container CRASH-LOOP mỗi ~5–6 phút** + `last_run_at=None` → mỗi lần restart beat coi job "chưa từng chạy/quá hạn" và **dispatch lại EOD 365 ngày toàn thị trường**.
5. **C2 — CONFIRMED effect, root cause SAI.** DB crontab id=21 = `5 17 * * *` **ICT (đúng 17:05 ICT)**; audit ghi `5 10 *` là **artifact sai hàng**. Bug thật: `scheduler_catalog.py:498` `crontab.remaining_estimate(timezone.now())` + `now+remaining` trả `2026-09-18 17:05 UTC` = `2026-09-19 00:05 ICT` — đúng "00:05:00 19-09". Đây là bug tz của `remaining_estimate`, **không phải** `formatNextRun`/`trigger_type` như audit đoán.

---

## 1. CONTRADICTIONS (audit doc vs code/runtime)

| STT | Audit nói (`AUDIT_DATAOPS_REALTIME_SYNC_20260918.md`) | Thực tế (`file:line` / live) | Tác động |
|-----|------------------------------------------------------|------------------------------|----------|
| **P1** | L128: "run_market_data_queue_tier_scheduler ... tạo `BackfillExecutionRun id 211 job_key=daily-backfill-prices-1700`" | `global_symbol_planner.py:136` gọi `ingest_daily_prices.run(..., service_run_log_id=child_run_log.id)` **không** `_scheduler_job_key` → `job_key=''`. Grep toàn backend: chỉ `tasks.py:1779,1899` truyền job key (pass-through) + `scheduler.py:555` (run_now, kèm `service_run_log_id` → nhánh đầu `tasks.py:1425`, KHÔNG auto-create) | **Attribution SAIVAI** — queue-tier không thể tạo run có `job_key`; runs 210/211/212 đến từ **beat** |
| **P2** | L133 + L156: counter treo → "chưa flush" ngụ ý vô hạn | Run 208 (beat) 15:31:38→22:40:06 (`completed=1942, inserted=281172`); finalize tại `tasks.py:1700-1722`; B08 auto-close stale >2h `tasks.py:1316-1379` | "Treo vô hạn" **overstated**; bug thật là **không có heartbeat giữa run** |
| **P3** | L29 + L165: `market_data_intraday_bar MAX=2026-05-22` `40474 rows` "chết 4 tháng" | Bảng bar **fresh tới 2026-09-17 07:59 UTC**; `2026-05-22` là `GlobalSymbolCoverage:intraday_bars`. `audit_check6.py` không có query `intraday_bar` | Bằng chứng F-BAR-01 **sai nguồn** |
| **P4** | L152: DB `django_celery_beat_crontabschedule:5 10 *` | Crontab id=21 = `minute='5', hour='17'`, tz `Asia/Ho_Chi_Minh` | Audit đọc nhầm hàng/format → luận cứ C2 lệch |
| **P5** | L6/L180: "`core-beat` dispatch đều", "`No queue drift`" | Beat dispatch queue-tier đúng 30s **NHƯNG** beat **restart mỗi ~5–6 phút** (`RestartCount=17`, `ExitCode=0`, `OOMKilled=false`, mem 128m) | Che lấp nguyên nhân dispatch lặp EOD |
| **P6** | L128-129: 210 và 211 "cùng queue (duplicate)" | 210/212 **dùng CHUNG `celery_task_id=80c6e118-…`** (cách ~62 phút); 211 có id khác | Duplicate không đơn thuần "cùng queue" |
| **P7** | L136 "drop 39 so 16" | DB `4622*` cập nhật lúc 16:04:38 UTC trong run 208 (15:31→22:40), `_refresh_coverage_for_symbols` **không** được gọi trong impl | Khớp F-COVER-01, nhưng audit không chỉ ra điểm thiếu hook |

---

## 2. Verdict từng finding

| ID audit | Verdict | Cơ sở |
|----------|---------|-------|
| **F-BACK-01** | **PARTIAL** | CONFIRMED: không flush counter giữa run (`tasks.py:1700-1748`). REFUTED "treo vô hạn": run 208 hoàn tất 7h09m. NEW: `time_limit` không thực thi trên `--pool=solo`; 2 worker cùng `enrichment_offhours` chạy song song |
| **F-COVER-01** | **CONFIRMED** (root cause refined) | `impl` không gọi `_refresh_coverage_for_symbols`; chỉ có ở `tasks.py:1257` (ingest) + `771,898`. Điểm hook đúng = sau `tasks.py:1726` |
| **F-DATA-01** | **CONFIRMED** | `DailyPrice MAX 2026-09-17, 1059 rows`; registry active 1942 → ~54.5%; missing ~151, new 112 |
| **F-BAR-01** | **REFUTED-as-stated / PARTIAL** | Bảng bar fresh tới 2026-09-17; gap thật Jun–Aug = 0 rows; coverage `intraday_bars` stale |
| **F-REAL-01** | **CONFIRMED** (đã ghi đúng là transient) | Price-board 60s sống; lag 9m sau restart là transient |
| **F-SCHED-01** | **CONFIRMED** (kết luận bổ sung) | last_run/total=0 đúng; nhưng loop dispatch từ **beat crash-loop** + `last_run_at=None` |
| **F-DEG-01 / F-PTIME-01 / F-VNBRK-01** | **PARTIAL** | Quan sát RISK/INFO hợp lý; chưa reproduce đủ để khẳng định "deep-history 4 ngày 7h" & "circuit-breaker" |
| **C2** | **CONFIRMED effect, REFUTED cause** | Bug ở `scheduler_catalog.py:498` (tz), không phải `formatNextRun`/`trigger_type` |
| **C3 / C4 / C5 / C6** | **CONFIRMED / một phần** | C4 = F-COVER-01; C5 self-heal đúng; C6 = F-BACK-01 |

---

## 3. Findings MỚI (audit bỏ sót)

| ID | Mức | `file:line` / live | Thực tế | Tác động | Đề xuất |
|----|-----|--------------------|---------|----------|---------|
| **R-NEW-01** | **HIGH** | `docker inspect vninvest-dev-core-beat` (RestartCount=17); `docker-compose.dev.yml` mem 128m/cpus 0.25 | Beat **crash-loop ~5–6 phút/lần**, `ExitCode=0`, `OOMKilled=false`; mỗi restart + `last_run_at=None` → `daily-backfill-prices-1700` bị coi quá hạn và **dispatch lại EOD 365d toàn thị trường** | Sinh runs 210/211/212 chồng lấn, lãng phí + đua dữ liệu | Tìm nguyên nhân exit (healthcheck/signal watch); đảm bảo `last_run_at` được ghi; hoặc tăng `mem_limit` + bỏ restart-loop trong dev |
| **R-NEW-02** | **HIGH** | `docker-compose.dev.yml` (`core-worker` `--queues=…,enrichment_offhours` solo `concurrency=1` + `core-worker-enrichment`) | **2 worker** cùng consume `enrichment_offhours` → 2 run `backfill_daily_prices` chạy **song song** trên cùng job | Đua `BackfillExecutionRun`/`DailyPrice`, duplicate insert, tranh chấp inflight cache | Tách 1 worker cho `enrichment_offhours`, hoặc dùng lock/dedup theo `job_key` |
| **R-NEW-03** | **MEDIUM** | `data_ingest/tasks.py:1755` `time_limit=11400`; run 208 chạy 7h09m | Hard time-limit **không thực thi** trên `--pool=solo` | Job dài vô hạn độc chiếm worker, chặn mọi job cùng queue | Chuyển pool `prefork` cho queue offhours, hoặc enforce soft-limit chủ động |
| **R-NEW-04** | **MEDIUM** | runs 210 & 212 share `celery_task_id=80c6e118-…` | Nghi **redelivery** (~62 phút ≈ visibility timeout 3600s). Tuy nhiên `backfill_daily_prices` **không** đặt `acks_late` (mặc định False; grep chỉ thấy `service_ops/tasks.py:1307` có `acks_late=True`) | Nếu đúng: message bị chạy lặp; nếu sai: cần truy `self.retry`/reset | Xác nhận `task_acks_late`/`broker_transport_options.visibility_timeout`; log `request.id` khi create run |
| **R-NEW-05** | **LOW** | `tasks.py:1451-1452, 1453-1454, 1723-1724, 1745-1746` | Nhiều `try/except: pass` nuốt lỗi im lặng (tạo run log, finalize) | Che dấu lỗi, khó audit | Log `logger.exception` thay `pass` |

---

## 4. Bằng chứng reproduce mới (bổ sung Phụ lục audit)

```bash
# R-NEW-01: beat crash-loop
docker inspect vninvest-dev-core-beat --format '{{.RestartCount}}'   # 17
docker logs vninvest-dev-core-beat | Select-String "is starting"     # beat: Starting... 06:45,06:50,06:56,07:01,07:06,07:12,07:17,07:23 ICT
docker inspect vninvest-dev-core-beat --format '{{.State.OOMKilled}} {{.State.ExitCode}}'  # false 0

# P1: không producer nào set job key ngoài beat/run_now
# grep "_scheduler_job_key=" toàn backend (non-test):
#   data_ingest/tasks.py:1779,1899 (pass-through)
#   service_ops/views/scheduler.py:555 (run_now, kèm service_run_log_id → nhánh 1425)
#   vninvest_core/settings.py:569 (beat kwargs)

# F-COVER-01: impl KHÔNG gọi refresh coverage
# grep "_refresh_coverage_for_symbols" trong tasks.py:
#   178 (def), 771, 898, 1257  ← không có trong 1382-1748 (impl backfill)

# C2: crontab thật + bug tz
# django_celery_beat_crontabschedule id=21: minute=5 hour=17 tz=Asia/Ho_Chi_Minh
# scheduler_catalog.py:498 remaining_estimate(timezone.now()); :499 now+remaining
#   → 2026-09-18 17:05:00+00:00 (UTC) = 2026-09-19 00:05 ICT

# F-BAR-01: bar table tươi, coverage stale
# market_data_intraday_bar MAX = 2026-09-17 07:59 UTC, total 40474 (Sep 8771 + May 31703)
# GlobalSymbolCoverage:intraday_bars last = 2026-05-22 (stale row — nguồn gây nhầm)

# F-SCHED-01 / P6: runs mang kwargs beat + task id dùng chung
# ServiceRunLog runs 210/211/212: input_summary.triggered_by=beat_schedule,
#   job_key=daily-backfill-prices-1700, days=365
# celery_task_id: 210=212=80c6e118-588d-419f-b960-70bc8f6a974c; 211=8e4c5dd6-…
# PeriodicTask id=42 daily-backfill-prices-1700: last_run_at=NULL total_run_count=0 date_changed≈now
```

---

## 5. Đánh giá tổng thể

- **Audit gốc có giá trị định hướng đúng** ở nhóm F-COVER-01 / F-DATA-01 / F-REAL-01 (đều CONFIRMED) và C2 (đúng hiện tượng).
- **Ba lỗi bằng chứng nghiêm trọng cần đính chính:** (P1) **attribution sai** — queue-tier không tạo được runs có `job_key`, thực tế từ beat; (P3) **F-BAR-01 sai nguồn** — bảng bar tươi, "chết 4 tháng" là coverage row; (P4) **đọc sai crontab** (`5 10 *` vs `5 17 *` ICT).
- **Hai overstatement:** F-BACK-01 "treo vô hạn" (thực ra chậm cập nhật tiến độ rồi hoàn tất / bị B08 đóng); F-SCHED-01 "cron chưa từng fire" (thực ra bị **crash-loop dispatch lặp**).
- **Nguyên nhân gốc lớn nhất bị bỏ sót:** **beat crash-loop** (R-NEW-01) + **2 worker cùng queue** (R-NEW-02) + **time_limit không enforce** (R-NEW-03).
- **Ưu tiên sửa đề xuất lại:**
  1. **P0:** Fix beat crash-loop (R-NEW-01) → chấm dứt dispatch lặp EOD; dedup theo `job_key` + tách 1 worker `enrichment_offhours` (R-NEW-02).
  2. **P1:** Hook `_refresh_coverage_for_symbols` cuối `_backfill_daily_prices_impl` (`tasks.py:~1726`) + heartbeat counter mỗi N symbols (F-COVER-01/F-BACK-01).
  3. **P1:** Fix tz `scheduler_catalog.py:498` (F-C2); điều tra gap Jun–Aug + coverage `intraday_bars` (F-BAR-01).
  4. **P2:** F-DATA-01 alert coverage <80%; F-REAL-01 SLA 90s; F-PTIME-01 caption.

> **Trả lời câu hỏi gốc (đính chính):** Hệ thống **tự chạy nhưng không khỏe**: beat **crash-loop**, dispatch EOD lặp, coverage không được refresh bởi đường backfill, và time-limit không có hiệu lực. Kết luận audit ("chưa đồng bộ hoàn toàn chính xác") **đúng kết quả**, nhưng **cơ chế nhân quả trình bày trong audit phần lớn sai** và **thiếu root cause beat crash-loop**.

---

**File:** `docs/PHAN_BIEN_AUDIT_DATAOPS_REALTIME_SYNC_20260918.md` — phản biện độc lập theo khung AGENTS.md.
**Ledger:** cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` (audit phản biện, không sửa code).
