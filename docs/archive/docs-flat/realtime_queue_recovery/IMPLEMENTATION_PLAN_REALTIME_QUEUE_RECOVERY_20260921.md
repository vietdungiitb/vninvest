# Kế hoạch khắc phục nghẽn queue realtime + hồi sinh đồng bộ dữ liệu (2026-09-21, Rev.2)

> **Trạng thái:** DONE 2026-09-21 — thực thi toàn bộ A–H + corrective v1–v4, nghiệm thu live đạt DoD.
> Ledger Entry 138–145. Chi tiết thực thi + số liệu live xem các entry tương ứng.
> (Rev.2 bên dưới là bản đã áp audit/phản biện, giữ nguyên để trace.)
> **Nguồn điều tra:** kiểm tra live DB `vninvest_core` + Redis + logs ngày 2026-09-21 ~10:30–11:00 ICT.
> **Quy ước repo tuân thủ:** AGENTS.md (adapter cast `as unknown as {…}`, i18n VI full dấu qua LangContext,
> `npx tsc --noEmit` sau mỗi sub-step, `npm run build` cuối mỗi step, cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md`).

## 0. Tóm tắt điều hành — 5 findings nghiêm trọng nhất

1. **Queue `realtime_prefetch` ngập 76.493 tin nhắn** (~93% là heartbeat 3s quá hạn), worker solo/concurrency-1
   không bao giờ xả kịp → `materialize_session_facts` (chết từ 09/09), `fetch_and_upsert_price_board`
   (coverage 0 fresh) bị chôn sau hàng chục giờ chờ.
2. **Task `warm_intraday_universe` ôm ~1900 symbols/task**, mỗi symbol fail qua KBS-retry/DNSE-SSL mất
   20–45s → 1 task chiếm slot duy nhất nhiều giờ, đồng thời scheduler cứ 3s nạp thêm tin (vòng phản hồi dương).
3. **Worker `enrichment` chết dịp cuối tuần 19–20/09** (cờ `OOMKilled=true`) khi 3 job marathon
   (dnse-quarterly → deep-history 8h → pre5y 12h) dồn chung 1 slot với `daily-backfill 17:05` →
   backfill EOD fail 3 ngày liên tiếp ở trạng thái `PENDING` (không phải lỗi provider).
4. **`materialize-symbol-snapshot-60s` bị `enabled=False` trong beat DB** (đã từng chạy 803 lần),
   không thuộc `CRITICAL_JOBS` nên reconcile không bao giờ bật lại → snapshot dừng từ 17/09.
5. **Monitor queue-depth đã tồn tại nhưng chỉ ghi log** (`queue-drain-monitor`, threshold 200) —
   không ai xem, không nối vào SOC UI/cảnh báo, trong khi depth thực tế 76k (gấp 380 lần ngưỡng).

---

## 0.1. Audit & phản biện 2026-09-21 — disposition (áp vào Rev.2)

Audit độc lập verify toàn bộ file:line R1–R11: **đúng vị trí code, khả thi, thứ tự slice hợp lý**.
7 phát hiện dưới đây đã được verify lại từng dòng và áp sửa vào plan. Quy ước: [SỬA TẠI SLICE X].

| ID audit | Verdict verify | Disposition trong Rev.2 |
|----------|---------------|--------------------------|
| C-1 mass-stale 2 chỗ | CONFIRMED — `vnbroker_materializer.py:299-303` (`except` → `update(stale=True)` toàn bảng rồi `raise`), chạy **trước** `materializers.py:42-46` (double-mark) | Slice F: sửa cả 2 chỗ; acceptance grep=0 giữ nguyên (giờ mới đúng) |
| C-2 số học chunk | CONFIRMED — 60 symbols × timeout 20s = 1200s > FR-03 (600s) | Slice C: chunk **30** + timeout **15s** → worst-case 450s < 600s; FR-03 giữ nguyên |
| C-3 expires Redis | CONFIRMED một phần — `expires` do **worker enforce lúc pop** (không GC broker list): downtime vẫn tích LLEN theo arrival rate; lợi ích thật = drain nhanh sau restart + không thực thi tin cũ | Slice B: acceptance viết lại theo cơ chế đúng (đo sau restart, không đo trong downtime) |
| C-4 SSE signature | CONFIRMED — `_dataops_signature` (`dataops_stream.py:50-67`) không hash `queue_depths`; FE bỏ poll khi stream mở (`SocDataOpsMonitorSection.tsx:319-341`) → card Depth đứng im | Slice G: thêm `queue_depths` vào signature + xử lý stream-open |
| F1 warm beat path | CONFIRMED — beat `warm-intraday-realtime-5m` (`settings.py:562-566`) dispatch **không plan_items** → fallback toàn registry ~1942 symbols (`tasks.py:888-892` + `:105-113`); comment `:560-561` gọi là belt-and-suspenders | Slice C redesign: task tự chunk + tự re-enqueue continuation (1 change fix cả 2 path); **giữ** beat entry (trả lời Q1) |
| F2 compose topology | CONFIRMED + hiệu chỉnh — có 4 topology: `docker-compose.dev.yml` (đang chạy, canonical dev), `docker-compose.prod.yml`/`ghcr.yml` (multi-queue workers, canonical prod), root `docker-compose.yml` (1 worker, không `CELERY_QUEUES` → chỉ ăn `celery`), `packages/core/docker-compose.core.yml` (standalone harness, worker `:60` thiếu `enrichment_offhours,screener`) | Slice D: ma trận compose canonical (trả lời Q2); F6 line-refs sửa (`QUEUE_NAMES` tại `queue_policy.py:6-16`, mem enrichment tại compose `:302`) |
| F3 orphan-check queues | CONFIRMED — `_task_in_redis_queue` hardcode 5 queue (`service_ops/tasks.py:863-869`); full-scan `lrange 0..depth-1` tại `:808` là O(n) pre-existing (không sửa ở đây). Bonus: `_get_redis_queue_depth` đã tồn tại tại `:818` → Slice G reuse | Slice D: thêm queue mới vào tuple; Slice G dùng helper `:818` |
| F4 sent_at Redis | CONFIRMED một phần — message headers không có `sent_at` tin cậy; `expires` (worker-enforced) là cơ chế chính đáng tin | Slice B: `expires` primary + guard cache-based `last_run` secondary (rẻ, robust) |
| F5 monitor 1 queue | CONFIRMED — `docker-compose.dev.yml:150` hardcode `realtime_prefetch` | Slice G: nới danh sách queue monitor |
| E test asserts cũ | CONFIRMED đúng dòng — `test_repair_beat_schedule.py:44`, `test_scheduler_catalog.py:37,42`, `test_soc_tasks.py:357,421,512,650`. Lưu ý: 4 asserts sau check field `planner_queue` (khác beat queue) → review, không sửa mù | Slice H: danh sách rà soát tường minh |

**Trả lời 3 câu hỏi audit:**
- **Q1 (warm beat entry redundancy hay di tích?):** redundancy **chủ đích** (`settings.py:560-561`).
  Quyết định: GIỮ entry; fix bằng chunk-aware task + self-continuation (Slice C) để cả 2 path đều bounded.
- **Q2 (compose canonical?):** dev = `docker-compose.dev.yml`; prod = `docker-compose.prod.yml` (+`ghcr.yml` variant);
  root `docker-compose.yml` = minimal/legacy (1 worker chỉ ăn `celery`) → Slice D quyết định: thêm `CELERY_QUEUES`
  multi-queue HOẶC đánh dấu deprecated, không đồng bộ mù; `packages/core/docker-compose.core.yml` = harness độc lập
  → chỉ sync tên queue mới vào worker `:60`, không thêm worker.
- **Q3 (time-limit riêng?):** hiện **không có** `task_time_limit` nào trong settings/entrypoint (đã grep toàn repo).
  Quyết định: thêm soft+hard limit cho 2 task realtime trong Slice B/C (scheduler-task 60s hard; warm-chunk =
  chunk×timeout + margin), env-tunable.

## 1. Bối cảnh & root cause (bảng bằng chứng)

| # | Khẳng định | Bằng chứng (lệnh/file:line đã verify) |
|---|-----------|----------------------------------------|
| R1 | Beat dispatch `materialize-session-facts-5m` đều mỗi 5p nhưng worker không thực thi | `docker logs core-beat`: `Sending due task materialize-session-facts-5m` 10:35/10:40/…; `docker logs worker-realtime-prefetch --since 120m`grep `materialize_session_facts` = **0 dòng** |
| R2 | Queue `realtime_prefetch` tồn 76.493 tin, các queue khác = 0 | `redis-cli -n 3 LLEN realtime_prefetch` = 76493; `enrichment_offhours/analytics_heavy/manual_on_demand/celery/screener` = 0 |
| R3 | ~93% queue là heartbeat 3s quá hạn | Sample 3000 tin đầu: 2804 `schedule_realtime_prefetch_shards` + 140 `fetch_and_upsert_price_board` + 28 `materialize_session_facts` + 28 `warm_intraday_universe`, 0 shard-task |
| R4 | Worker realtime-prefetch chỉ có 1 slot | `docker-compose.dev.yml:197-199` `CELERY_QUEUES: realtime_prefetch`, `CELERY_CONCURRENCY: "1"`, `CELERY_POOL: solo`; entrypoint `packages/core/backend/entrypoint.sh:35-41` (không `max-tasks-per-child`, không time-limit) |
| R5 | Scheduler-task tự nạp thêm việc vào cùng queue (feedback loop) | `packages/core/backend/src/market_serving/realtime_prefetch.py:290` (`prefetch_realtime_ticker_shard.apply_async` cùng `REALTIME_PREFETCH_QUEUE=:28`) và `:326` (`warm_intraday_universe.apply_async` cùng queue); beat 3s tại `vninvest_core/settings.py:476-480` với `expires: null` (tin 63h tuổi vẫn chờ) |
| R6 | 1 task warm ôm ~1900 symbols, mỗi symbol fail 20–45s | `data_ingest/tasks.py:857-993` (`warm_intraday_universe`, plan cả tier trong 1 task, `:904` build plan rồi `:913` hydrate tuần tự); scheduler enqueue cả tier tại `realtime_prefetch.py:309-331` (`_page_size` 120/60, plan = toàn bộ `_tier_symbols`); log worker: `Intraday fetch failed … via KBS: RetryError` + `DNSE get_trades … SSLError` lặp lại mỗi ~20–45s/symbol |
| R7 | Coverage hooks đã wired đúng — lỗi do task không chạy | `_refresh_coverage_for_symbols` (`data_ingest/tasks.py:178-216`) được gọi tại `:787` (price-board), `:914` (warm), `:1273` (ingest_daily), `:1801` (backfill), `:2790` (synthesize) |
| R8 | Backfill EOD fail 3 ngày ở trạng thái PENDING | `ServiceRunLog`: `backfill_daily_prices` 18/19/20-09 `failed / Auto-recovered stale running log; task_state=PENDING`; run tay cùng task (`18/09 01:30, 03:05 UTC`) `success` → code đúng, hạ tầng sai |
| R9 | Enrichment worker OOM cuối tuần marathon | `docker inspect core-worker-enrichment`: `OOMKilled=true`; weekend: `deep_history` (Sun 03:00 ICT, `task_state=FAILURE` giữa chừng) → `pre5y` (PENDING) → `daily-backfill` Sun 17:05 (PENDING → failed sau 3.25h); 3 job + daily-backfill chung 1 slot (`queue_policy.py:104-126`, worker prefork concurrency 1, `docker-compose.dev.yml:273-288`) |
| R10 | Snapshot job bị disable, reconcile bỏ qua | Beat DB: `materialize-symbol-snapshot-60s enabled=f, total_run_count=803`; `CRITICAL_JOBS` chỉ 4 job (`service_ops/beat_reconcile.py:18-23`, `check_scheduler_queue_drift.py:10-15`) — không gồm snapshot nên `reconcile_beat_schedule` (`:105-112` chỉ re-enable critical) không chạm tới |
| R11 | Queue-monitor tồn tại nhưng vô hình | `docker-compose.dev.yml:138-157`: `queue-drain-monitor` log `realtime_prefetch_depth` mỗi 300s, threshold 200, chỉ `echo ALERT` ra log — không nối SOC UI/API/cảnh báo |

**Dữ liệu thị trường tại thời điểm điều tra (đối chiếu sau fix):** `DailyPrice` 4.515.456 rows/1898 symbols/`2000-07-28→2026-09-18`;
`IntradayTick` 238.908 rows/latest=realtime; `IntradayBar` latest 18/09 14:59 ICT; `SessionFacts` 20 rows từ 09/09;
`SymbolSnapshot` latest 17/09; coverage `daily_prices` healthy ~58%, `price_board_snapshot` 0 fresh.

---

## 2. Phạm vi & non-goals

**Trong phạm vi:** 8 slice A–H dưới đây (ops gỡ nghẽn + code chống tái diễn + observability + tests + ledger).
**Non-goals (không làm trong plan này, ghi backlog có lý do):**
- Sửa provider KBS/DNSE fail (RetryError/SSL-EOF) — là nhiễu ngoài, có fallback nguồn khác, data vẫn chảy. Chỉ giảm tác động bằng chunking (Slice C).
- Realtime intraday multi-timeframe / đa khung — backlog theo `docs/SCREENER_METHODOLOGY_20260914.md`.
- Đổi broker Redis → RabbitMQ — quá tầm, không cần thiết khi root cause là single-slot + feedback loop.

---

## 3. Yêu cầu tổng (requirements) & ràng buộc

### 3.1 Functional requirements
- FR-01: Mọi task định kỳ realtime (session-facts 5m, price-board 60s, warm 5m) phải **start trong vòng ≤ 2 chu kỳ** của chính nó khi worker healthy.
- FR-02: Task quá hạn (age > 3 chu kỳ) không được thực thi vô ích gây nạp thêm việc.
- FR-03: `warm_intraday_universe` không được chiếm 1 slot quá 10 phút/task.
- FR-04: `daily-backfill-prices-1700` không bao giờ bị marathon-job cuối tuần chặn (PENDING > 30 phút = lỗi).
- FR-05: Depth mọi queue realtime/enrichment hiển thị trên SOC DataOps Monitor + có ngưỡng cảnh báo.
- FR-06: `materialize-symbol-snapshot-60s` chạy lại ổn định trong giờ giao dịch, được reconcile bảo vệ như critical job.

### 3.2 Non-functional requirements
- NFR-01: Không tăng số worker container quá 2 (giới hạn tài nguyên dev stack); ưu tiên tách queue + chunking.
- NFR-02: Không mất dữ liệu đã ingest; purge chỉ xóa tin beat quá hạn có thể tái-dispatch.
- NFR-03: Mọi ngưỡng mới phải env-tunable (theo pattern `_read_int_env` tại `realtime_prefetch.py:49-57`), default an toàn cho dev.
- NFR-04: Không regression: full BE suite liên quan + FE tsc/build/lint xanh.

### 3.3 Ràng buộc cứng (từ AGENTS.md)
- API calls FE dùng `defaultCoreApiAdapter as unknown as { … }`; i18n VI full dấu qua LangContext, key `soc.dataops.*`.
- `npx tsc --noEmit` sau mỗi sub-step; `npm run build` cuối mỗi slice FE.
- Mọi thay đổi BE: `python src/manage.py check` 0 issues; test mới cho mọi logic mới.
- Cập nhật `docs/CODE_CHANGE_AUDIT_LEDGER.md` sau mỗi slice (quy ước hiện hành của repo).

---

## 4. Ma trận slice

| Slice | Tên | Loại | Ưu tiên | Phụ thuộc | Output |
|-------|-----|------|---------|-----------|--------|
| A | Gỡ nghẽn khẩn (purge + bật lại + bù dữ liệu) | OPS (không code) | P0, làm đầu tiên | Không | Queue sạch, SessionFacts/Snapshot/coverage hồi |
| B | Heartbeat 3s có hạn + drop-if-behind | BE code | P0 | A | Không bao giờ tích lũy heartbeat quá hạn |
| C | Chia nhỏ `warm_intraday_universe` theo chunk | BE code | P0 | A | Task ≤ 10 phút, slot xoay vòng |
| D | Tách queue realtime (scheduler ↔ materialize/ingest) | BE code + compose | P1 | A | Materialize/ingest không bị scheduler chôn |
| E | Cô lập enrichment marathon khỏi daily-backfill | BE code + compose | P1 | A | Backfill EOD không PENDING quá 30p |
| F | Hồi sinh `materialize-symbol-snapshot-60s` | OPS + BE code | P1 | A, D | Snapshot fresh trong phiên, được reconcile bảo vệ |
| G | Queue-depth vào observability + SOC UI | BE + FE | P2 | D (khuyến nghị) | Banner/cảnh báo depth trên Monitor tab |
| H | Regression tests + ledger/AGENTS bàn giao | TEST + DOCS | P1 (song song từ B) | B–G | Suite xanh, ledger đủ 8 slice |

---

## 5. Chi tiết từng slice

### Slice A — Gỡ nghẽn khẩn cấp (OPS, P0, ~30 phút, làm đầu tiên)

**Mục tiêu:** đưa hệ thống về trạng thái chảy lại ngay, tạo baseline đo cho các slice sau.

**Files chạm:** không sửa code. Chỉ vận hành `docker-compose.dev.yml` services
`core-redis`, `core-beat`, `core-worker-realtime-prefetch`, `core-worker-enrichment`.

**Steps (thứ tự bắt buộc):**
1. Ghi baseline: `docker exec vninvest-dev-core-redis redis-cli -n 3 LLEN realtime_prefetch`
   (kỳ vọng ~76k) + `SELECT count(*) FROM market_serving_sessionfacts` (kỳ vọng 20) + chụp log monitor.
2. Tạm dừng beat để ngừng nạp tin mới: `docker stop vninvest-dev-core-beat`.
3. Purge **có chọn lọc**: xóa tin `schedule_realtime_prefetch_shards` quá hạn, **giữ lại** tin
   `materialize_session_facts` / `fetch_and_upsert_price_board` / `warm_intraday_universe` mới nhất mỗi loại
   (script Lua/python duyệt `LRANGE`, `LREM` theo `periodic_task_name`; nếu không viết kịp script thì
   `DEL realtime_prefetch` toàn bộ — chấp nhận được vì beat sẽ dispatch lại trong 60s/5m).
4. `docker start vninvest-dev-core-beat`.
5. Re-enable snapshot job: `UPDATE django_celery_beat_periodictask SET enabled=true WHERE name='materialize-symbol-snapshot-60s'`
   (lý do R10; reconcile không tự làm).
6. Run-now bù (qua SOC Operations tab hoặc `celery call`): `materialize_session_facts` (all),
   `fetch_and_upsert_price_board`, `synthesize_intraday_bars_from_ticks` cho 18/09 nếu thiếu bars.
7. Đợi 15 phút, đo lại toàn bộ mục 1.

**Yêu cầu cần đạt:** LLEN < 200 và giữ ổn định 15 phút; worker log xuất hiện
`materialize_session_facts:` INFO; SessionFacts có rows cho 21/09 (ngày có whale data);
coverage `price_board_snapshot` bắt đầu có fresh.

**Tiêu chí nghiệm thu:**
- [ ] `LLEN realtime_prefetch` < 200 trong 3 lần đo cách nhau 5 phút.
- [ ] `SELECT session_date, count(*) FROM market_serving_sessionfacts GROUP BY 1` có dòng `2026-09-21`.
- [ ] `SELECT session_date, max(fetched_at) FROM market_serving_symbolsnapshot` = hôm nay (giờ giao dịch).
- [ ] Không có task nào `started_at` NULL quá 30 phút trong `ServiceRunLog` 24h gần nhất.

**Audit checklist (reviewer):** đối chiếu lệnh purge với backup Redis (RDB) trước khi xóa;
xác nhận beat đã stop trước purge (tránh race); xác nhận không xóa nhầm queue khác
(`enrichment_offhours`, `manual_on_demand` phải giữ nguyên = 0).

**Minh chứng xác thực:** paste output 4 lệnh nghiệm thu + `docker logs worker-realtime-prefetch --since 20m | grep materialize_session_facts`
vào ledger entry của Slice A (ghi rõ timestamp ICT).

---

### Slice B — Heartbeat 3s có hạn + drop-if-behind (BE, P0)

**Mục tiêu:** triệt tận gốc tích lũy heartbeat quá hạn (R5) — tin 3s cũ hơn 3 chu kỳ thì tự hủy, không chờ worker.

**Files chạm (đã verify tồn tại):**
- `packages/core/backend/src/vninvest_core/settings.py:476-480` (thêm `expires` cho beat entry).
- `packages/core/backend/src/market_serving/realtime_prefetch.py:227-241` (drop-if-behind trong task + lock TTL).
- `packages/core/backend/src/market_serving/tests/` (test mới, đặt cạnh test materializers hiện có).

**Steps:**
1. Thêm `'expires': int(os.getenv('REALTIME_SCHEDULER_EXPIRES_SECONDS', '30'))` vào beat entry
   `schedule-realtime-prefetch-shards` (`settings.py:476-480`). Default 30s = 10 chu kỳ, dev-safe.
   Cơ chế đúng trên Redis broker: `expires` do **worker enforce lúc pop** (tin hết hạn bị discard ngay,
   không thực thi) — broker list vẫn tích trong downtime, nhưng drain sau restart là tức thì.
2. Trong `schedule_realtime_prefetch_shards` (`realtime_prefetch.py:227`), ngay sau acquire lock:
   guard cache-based (không dùng `delivery_info`/`sent_at` — headers Redis không có trường tin cậy):
   đọc `cache.get('realtime:scheduler:last_run')`; nếu `now - last_run < 3s` (1 task khác vừa chạy xong
   trong cùng chu kỳ) → return `{'status': 'skipped_duplicate', ...}` không enqueue thêm (chặn backlog
   dồn khi worker vừa hồi phục và xả hàng loạt tin tồn). Sau run `ok`, `cache.set` key này (timeout 120s).
3. Siết lock scheduler: `timeout_seconds=10` hiện tại giữ nguyên.
4. Áp cùng pattern `expires` cho `ingest-price-board-60s` (default 300) và `warm-intraday-realtime-5m`
   (default 600) tại `settings.py:547-551`, `:562-566` — heartbeat realtime không có giá trị khi quá hạn.
5. Time-limit (trả lời Q3 — hiện repo chưa có limit nào): thêm decorator
   `soft_time_limit=int(os.getenv('REALTIME_SCHEDULER_SOFT_LIMIT', '45'))`,
   `time_limit=int(os.getenv('REALTIME_SCHEDULER_HARD_LIMIT', '60'))` cho scheduler-task
   (task healthy chạy < 5s; limit chỉ giết run bị kẹt).
6. Test mới: (a) task với `expires` đã qua (dùng `apply_async(..., expires=0)` hoặc mock headers)
   → worker discard, không gọi `apply_async` con; (b) duplicate-guard: 2 run cách nhau 1s → run 2
   `skipped_duplicate`; (c) beat entry có `expires` (assert trên `CELERY_BEAT_SCHEDULE` dict).
7. `manage.py check` + chạy test file mới + `test_soc_tasks` (ghi nhận 6 fail pre-existing, không tăng).

**Yêu cầu cần đạt:** FR-02. Không đổi hành vi khi hệ thống healthy (task fresh vẫn `ok`).

**Tiêu chí nghiệm thu:**
- [ ] Giết worker realtime-prefetch 10 phút: LLEN tăng theo arrival rate (~200 — đúng kỳ vọng, **không**
      assert ≤ 200 trong downtime); bật lại worker → LLEN về < 200 trong **≤ 5 phút** (discard nhanh,
      không thực thi tin cũ) và **không** có `hydrate_enqueued` từ tin quá hạn trong log.
- [ ] Worker log có `skipped_duplicate` khi xả backlog (nếu implement) — không có fan-out bùng nổ sau restart.
- [ ] Test mới pass 100%; `manage.py check` 0 issues.

**Audit checklist:** reviewer xác nhận default `expires` không nhỏ hơn 3× chu kỳ của từng job;
xác nhận không áp `expires` cho job EOD/marathon (daily-backfill, deep-history, pre5y — tin trễ vẫn có giá trị);
xác nhận `delivery_info` key tồn tại trên Redis broker (đã verify format message có `delivery_info` trong R3).

**Minh chứng:** output test + đoạn log kill/restart worker kèm 3 lần đo LLEN + ledger entry.

---

### Slice C — Chia nhỏ `warm_intraday_universe` (BE, P0)

**Mục tiêu:** FR-03 — không task nào ôm slot > 10 phút; slot xoay vòng cho session-facts/price-board.

**Files chạm:**
- `packages/core/backend/src/data_ingest/tasks.py:857-993` (thêm params `max_symbols`, early-return khi vượt).
- `packages/core/backend/src/market_serving/realtime_prefetch.py:309-331` (enqueue N chunk thay vì 1 plan cả tier).
- `packages/core/backend/src/data_ingest/tests/test_tasks.py` (mở rộng, cạnh assert `coverage_refreshed_symbols` tại `:419-420`, `:533-536`).

**Steps (redesign sau audit F1/C-2 — 1 change fix cả 2 enqueue path: hydrate-leg VÀ beat trực tiếp):**
1. Thêm params `max_symbols: int | None = None` + `offset: int = 0` cho `warm_intraday_universe`
   (`tasks.py:857`); default từ env `WARM_INTRADAY_MAX_SYMBOLS_PER_TASK` = **30**.
   Số học bắt buộc (C-2): per-symbol timeout `WARM_INTRADAY_PER_SYMBOL_TIMEOUT_SECONDS` default **15s**
   → worst-case 30 × 15s = **450s < 600s (FR-03)**. (Giá trị cũ 60×20s = 1200s là VI PHẠM FR-03 — cấm dùng.)
2. **Self-continuation (fix F1):** task xử lý `symbols[offset:offset+max_symbols]`; nếu còn dư, tự
   `self.apply_async(kwargs={..., 'offset': offset+max_symbols}, queue='realtime_prefetch')` 1 tin continuation
   rồi return `{'status': 'partial_chunk', 'processed': n, 'remaining': m}`. Path beat trực tiếp
   (`warm-intraday-realtime-5m` không plan_items → fallback toàn registry ~1942 symbols tại `tasks.py:888-892`)
   nhờ đó cũng bounded — **giữ nguyên beat entry** (redundancy chủ đích, trả lời Q1), không tắt.
3. Sửa hydrate leg (`realtime_prefetch.py:319-331`): enqueue 1 tin duy nhất với toàn tier (giữ throttle key
   `realtime:hydrate:last_enqueue` hiện tại, không đổi tần suất) — chunking xảy ra **trong task** (bước 1–2),
   scheduler không cần chia. (Đơn giản hơn bản Rev.1, tránh double-chunking.)
4. Thêm per-symbol timeout: trong `_hydrate_intraday_symbols` (`tasks.py:321`), skip symbol khi 1 symbol
   quá timeout (bước 1) thay vì retry vô hạn qua KBS/DNSE; ghi vào `failed` list (đã có) để lần sau bù.
   Thêm `soft_time_limit`/`time_limit` = `max_symbols × timeout + 120s` margin (trả lời Q3) để giết task kẹt
   ở tầng worker kể cả khi provider treo ngoài timeout đo được.
5. Tests: (a) plan 200 symbols → xử lý 30 + `remaining=170` + 1 continuation enqueued (mock `apply_async`);
   (b) beat path không plan_items → vẫn chunked, không task nào ôm > 30 symbols (mock registry 100 symbols);
   (c) per-symbol timeout skip (mock fetch sleep); (d) worst-case bound test: `max_symbols × timeout < 600`.
6. Gates BE như Slice B.

**Yêu cầu cần đạt:** FR-03 (mọi warm-task ≤ 10 phút, chứng minh bằng bound test (d)); không symbol nào đói vĩnh viễn:
xoay vòng bằng `last_hydrated_at` (`realtime_prefetch.py:128-134`) + continuation giữ thứ tự offset.

**Tiêu chí nghiệm thu:**
- [ ] Trong giờ giao dịch, không task `warm_intraday_universe` nào chạy > 10 phút (đo qua worker log start/finish hoặc Flower/celery events).
- [ ] `materialize_session_facts` start ≤ 10 phút/lần (worker log có INFO mỗi 5m ± jitter).
- [ ] Ticks vẫn chảy (max `timestamp` trong `IntradayTick` lệch realtime < 5 phút).
- [ ] Kill test: dispatch 1 warm full-registry (~1900 symbols) → hoàn tất qua chuỗi continuation trong
      ≤ `ceil(1900/30)` task, không task nào > 10 phút, session-facts xen kẽ vẫn chạy giữa các chunk.

**Audit checklist:** default chunk 60 phải khớp throughput đo được (nếu 60 vẫn > 10p thì giảm);
xác nhận không đổi `page_size` fetch/provider (chỉ đổi bao đóng task); xác nhận chunk cuối tier vẫn được
enqueue (không rớt symbol do integer division).

**Minh chứng:** output tests + log worker 30 phút (grep start/finish warm + materialize) + LLEN ổn định + ledger.

---

### Slice D — Tách queue realtime (BE + compose, P1)

**Mục tiêu:** scheduler-heartbeat/shard không bao giờ chôn materialize/ingest, kể cả khi chưa có Slice B/C
(xếp sau A; làm sau B/C cũng được nhưng bắt buộc trước G).

**Files chạm:**
- `packages/core/backend/src/vninvest_core/queue_policy.py:6-16` (`QUEUE_NAMES` — thêm queue),
  `:61-81` (tách domain), `:162-189` (builders tự nhận queue mới — không sửa builders).
- `packages/core/backend/src/vninvest_core/settings.py:476-480, :547-566` (trỏ beat entries sang queue mới).
- `packages/core/backend/src/service_ops/tasks.py:863-869` (thêm queue mới vào tuple `_task_in_redis_queue` —
  nếu không, task ở queue mới bị coi là orphan. Không đụng full-scan `:808`, O(n) pre-existing để backlog riêng).
- Compose theo ma trận canonical (trả lời Q2 — cấm đồng bộ mù):
  | Env | File canonical | Thay đổi |
  |-----|---------------|----------|
  | dev (đang chạy) | `docker-compose.dev.yml` | thêm worker `core-worker-realtime-scheduler` (`CELERY_QUEUES: realtime_scheduler`, concurrency 1, solo, mem 256m) — +1 worker (trong NFR-01) |
  | prod | `docker-compose.prod.yml` + `docker-compose.ghcr.yml` | thêm `realtime_scheduler` vào worker realtime hiện có (`CELERY_QUEUES_REALTIME`, `:149` ghcr / worker realtime `:223` prod) — không +container |
  | root minimal | `docker-compose.yml` (`core-worker` `:98-117`, không `CELERY_QUEUES` → chỉ ăn `celery`) | 1 trong 2, ghi quyết định vào PR: (a) thêm multi-queue, hoặc (b) đánh dấu deprecated trong README vận hành |
  | package harness | `packages/core/docker-compose.core.yml` (worker `:60`) | chỉ thêm tên queue mới vào list, không thêm worker |
- `packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py:10-15`
  + `sync_scheduler_queues.py` (tự nhận `SCHEDULER_QUEUE_MAP` — verify không hardcode queue cũ).
- `packages/core/backend/src/service_ops/scheduler_catalog.py` (metadata `CATALOG_JOB_METADATA` nếu có reference
  queue — grep `realtime_prefetch` trong file, cập nhật nếu cần).

**Steps:**
1. Thêm queue `realtime_scheduler` vào `QUEUE_NAMES`; tách domain `market_serving_realtime` thành 2:
   - `market_serving_scheduler` (queue `realtime_scheduler`): `schedule_realtime_prefetch_shards` task route +
     periodic `schedule-realtime-prefetch-shards`.
   - `market_serving_realtime` (giữ `realtime_prefetch`): `materialize_symbol_snapshot`, `materialize_session_facts`,
     `fetch_and_upsert_price_board`, `warm_intraday_universe` + periodics còn lại (`ingest-price-board-60s`,
     `warm-intraday-realtime-5m`, `materialize-session-facts-5m`, `materialize-symbol-snapshot-60s`).
2. Cập nhật tuple queue tại `service_ops/tasks.py:863-869` (+`realtime_scheduler`, và `enrichment_eod` nếu Slice E
   chọn PA1) — test orphan-check với task_id ở queue mới → `True`, không false-negative.
3. Triển khai worker theo ma trận compose ở trên (dev +1 worker; prod/ghcr gộp queue; root + harness theo quyết định).
4. Chạy `repair_beat_schedule` + `check_scheduler_queue_drift` để DB nhận queue mới (reconcile tự fix queue
   tại `beat_reconcile.py:114-128`).
5. Tests: `SCHEDULER_QUEUE_MAP['schedule-realtime-prefetch-shards'] == 'realtime_scheduler'`;
   drift-check pass với queue mới; mở rộng `test_drift_enabled_missing.py` (3 tests hiện tại phải xanh).
6. `docker compose config` validate từng file đã chạm + rebuild image + rolling restart dev.

**Yêu cầu cần đạt:** FR-01 cho 3 task materialize/ingest kể cả khi scheduler-task kẹt; NFR-01 (+1 worker).

**Tiêu chí nghiệm thu:**
- [ ] `LLEN realtime_scheduler` và `LLEN realtime_prefetch` đều < 200 sau 1h chạy.
- [ ] Stop worker `realtime_scheduler` 10 phút: session-facts/price-board vẫn chạy (log), chỉ prefetch-cache ngừng.
- [ ] `check_scheduler_queue_drift` (không `--warn-only`) exit 0.

**Audit checklist:** grep toàn repo `realtime_prefetch` sau đổi (không sót hardcode queue trong
`realtime_prefetch.py:28`, settings, docs); xác nhận Task Routes (`TASK_ROUTES`) cũng tách theo
(không chỉ beat options); xác nhận prod/ghcr compose đồng bộ.

**Minh chứng:** `docker compose config` OK 3 file + LLEN 2 queue + test drift + ledger.

---

### Slice E — Cô lập enrichment marathon khỏi daily-backfill (BE + compose, P1)

**Mục tiêu:** FR-04 — daily-backfill 17:05 không bao giờ PENDING > 30 phút vì kẹt sau job 8–12h.

**Files chạm:**
- `packages/core/backend/src/vninvest_core/queue_policy.py:104-126` (tách `offhours_enrichment`).
- `packages/core/backend/src/vninvest_core/settings.py:570-621` (trỏ `daily-backfill-prices-1700` sang queue ưu tiên).
- `docker-compose.{dev,prod,ghcr}.yml` (worker enrichment thứ 2 hoặc nâng mem/concurrency).
- `packages/core/backend/entrypoint.sh:35-41` (thêm `--max-tasks-per-child` env-tunable, default 20 cho enrichment).
- `packages/core/backend/src/data_ingest/tasks.py:1398+` (`_backfill_daily_prices_impl` — log heartbeat/progress nếu chưa có).

**Steps (chọn 1 trong 2 phương án, khuyến nghị PA1):**
- **PA1 (khuyến nghị):** thêm queue `enrichment_eod` + worker riêng cho `daily-backfill-prices-1700`
  (và `ingest-daily-prices-1705` nếu bật lại sau này); marathon jobs (deep-history/pre5y/dnse-quarterly)
  ở lại `enrichment_offhours`. Tổng worker +1.
- **PA2 (tiết kiệm worker):** giữ 1 worker nhưng bật `task_acks_late` + priority: daily-backfill priority 9,
  marathon priority 3–5 (Redis broker hỗ trợ priority). Rủi ro: solo vẫn tuần tự — chỉ nên chọn nếu không
  được +1 worker.
- Dù PA nào: thêm `--max-tasks-per-child=${CELERY_MAX_TASKS_PER_CHILD:-20}` vào entrypoint worker
  (chống leak/OOM tích lũy — nguyên nhân R9), nâng `mem_limit` enrichment lên ≥1g (default 512m tại
  `docker-compose.dev.yml:302` trong khối `core-worker-enrichment` `:273-303`, runtime đang override 1.17g —
  chốt số chính thức vào file).
- Tests: route map assert; `max-tasks-per-child` hiện trong worker cmdline (test entrypoint bằng shellcheck/dry-run).

**Yêu cầu cần đạt:** FR-04; OOM không tái diễn 14 ngày với limit đã chốt.

**Tiêu chí nghiệm thu:**
- [ ] Mô phỏng: dispatch deep-history (mock sleep 30p) + daily-backfill cùng lúc → backfill start < 5 phút (PA1) và success.
- [ ] 5 phiên EOD liên tiếp `backfill_daily_prices success` (kể cả cuối tuần có marathon job).
- [ ] Không container OOM (`OOMKilled=false`) trong 14 ngày.

**Audit checklist:** xác nhận marathon jobs không hardcode queue cũ ở chỗ khác (grep `enrichment_offhours`);
xác nhận crontab 17:05 ICT + timezone `Asia/Ho_Chi_Minh` giữ nguyên (đừng đụng `beat_reconcile.py:62-78`);
xác nhận `max-tasks-per-child` không áp cho worker realtime solo đang cần cache ấm (chỉ enrichment + prefork).

**Minh chứng:** log mô phỏng kẹt + 5 run-log EOD success + `docker inspect OOMKilled` + ledger.

---

### Slice F — Hồi sinh `materialize-symbol-snapshot-60s` (OPS + BE, P1)

**Mục tiêu:** FR-06 — snapshot fresh trong phiên; không bao giờ bị tắt lặng lẽ nữa.

**Files chạm:**
- Beat DB (OPS, đã làm ở Slice A bước 5 — slice này chốt vĩnh viễn bằng code).
- `packages/core/backend/src/service_ops/beat_reconcile.py:18-23` + `check_scheduler_queue_drift.py:10-15`
  (thêm `materialize-symbol-snapshot-60s` vào `CRITICAL_JOBS` cả 2 file — đồng bộ).
- `packages/core/backend/src/market_serving/materializers.py:25-46` (review nhánh fail: hiện tại
  `except` đánh `SymbolSnapshot.objects.update(stale=True)` **toàn bảng** rồi retry — nguy hiểm: 1 lỗi provider
  làm stale cả 1551 symbols).
- `packages/core/backend/src/market_serving/vnbroker_materializer.py:299-303` (**mass-stale thứ 2, audit C-1**:
  `except` → `update(stale=True)` toàn bảng rồi `raise` — chạy TRƯỚC outer except ở trên, tức hiện tại
  double-mark stale; inner function tại `:130`).
- `packages/core/backend/src/market_serving/vnbroker_materializer.py:130` (verify fallback nguồn khi KBS fail —
  audit 08/09 ghi `fetch_symbol_group_members VN50 via KBS failed`; xác nhận multi-provider còn hiệu lực).

**Steps:**
1. Thêm snapshot job vào `CRITICAL_JOBS` (2 file), chạy `repair_beat_schedule --dry-run` → kỳ vọng no-op
   (vì Slice A đã bật), rồi chạy thật 1 lần.
2. Sửa **cả 2** nhánh mass-stale (audit C-1): `vnbroker_materializer.py:299-303` và `materializers.py:42-46`:
   không `update(stale=True)` toàn bảng ở bất kỳ đâu; thay bằng log `failed_symbols` (+ return `failed` list
   đã có tại inner `:294-296`) + retry giữ nguyên (`max_retries=3, default_retry_delay=30`).
3. Verify provider fallback: chạy tay `materialize_symbol_snapshot_from_vnbroker()` với KBS down (mock) →
   vẫn ra rows từ VCI/DNSE.
4. Tests: reconcile dry-run gồm snapshot; except-branch không chạm rows của symbols khác.
5. Theo dõi 3 phiên: snapshot latest = today, `stale=false` đa số trong giờ giao dịch.

**Yêu cầu cần đạt:** FR-06; không còn `update(stale=True)` toàn bảng ở bất kỳ nhánh nào (grep kiểm).

**Tiêu chí nghiệm thu:**
- [ ] Tắt tay job (`enabled=false`) → trong 5 phút reconcile bật lại (log `re_enabled` chứa job).
- [ ] Mock 1 provider fail → snapshot vẫn ghi rows, không có mass-stale.
- [ ] 3 phiên liên tiếp snapshot latest = today.

**Audit checklist:** 2 file `CRITICAL_JOBS` đồng bộ nhau (drift-check và reconcile phải cùng danh sách);
grep `objects.update(stale=True)` toàn repo market_serving = 0 kết quả sau sửa.

**Minh chứng:** test reports + log reconcile + 3 snapshot-latest queries + ledger.

---

### Slice G — Queue-depth vào observability + SOC UI (BE + FE, P2)

**Mục tiêu:** FR-05 — depth queue nhìn thấy được trên SOC DataOps Monitor, có cảnh báo trước khi thành 76k.

**Files chạm (đã verify):**
- BE: `packages/core/backend/src/service_ops/dataops_market_data.py:711` (`build_market_data_observability_summary`
  — thêm key `queue_depths`); stream `service_ops/views/dataops_stream.py:39` tự nhận (đọc cùng summary).
  Đọc LLEN qua Redis client từ `settings.REDIS_URL`/`CELERY_BROKER_URL` (`settings.py:356`) — pattern có sẵn
  ở monitor shell (`docker-compose.dev.yml:150`).
- FE: `packages/web/src/adapters/core/soc.js:181` (`getSocDataOpsObservability` — không đổi signature, thêm field);
  `packages/web/src/components/soc/SocDataOpsMonitorSection.tsx` (thêm Queue-Depth card cạnh starvation panel
  `:591-660`, reuse `metricCard`/`toneColor`); i18n `src/i18n/vi.js` + `en.js` keys `soc.dataops.queue_depth_*`.
- Test FE: `soc.test.js` (+case observability có `queue_depths`); vitest component (banner đỏ khi depth > threshold).

**Steps:**
1. BE: helper `_read_queue_depths()` — **reuse `_get_redis_queue_depth` đã tồn tại**
   (`service_ops/tasks.py:818`, LLEN fail-open return 0, đã dùng pattern `REDIS_URL`/`CELERY_BROKER_URL`) cho
   7 queue `QUEUE_NAMES` (`queue_policy.py:6-16`), timeout 2s, fail-open `{}` khi Redis unreachable — **không viết
   client Redis mới**. Gắn key `queue_depths` vào `build_market_data_observability_summary`
   (`dataops_market_data.py:711`). **Thêm `queue_depths` vào `_dataops_signature`**
   (`dataops_stream.py:50-67`, audit C-4) — nếu không, SSE không emit khi depth đổi.
   FE `useDataOpsStream`/`SocDataOpsMonitorSection`: khi stream mở, `onSnapshot` vẫn nhận event `dataops`
   (đã có handler) — verify không rơi vào nhánh `streamOpenRef` skip-poll (`:319-341` chỉ skip **poll thủ công**,
   không skip SSE); nếu card Depth đứng im khi stream mở thì thêm `queue_depths` vào deps so sánh local
   (force re-render khi đổi). Thêm test BE (mock redis) + test signature đổi khi depth đổi.
2. FE: render card "Độ sâu hàng đợi" (mỗi queue 1 dòng + màu theo ngưỡng: xanh <50, vàng <200, đỏ ≥200 —
   khớp threshold monitor hiện tại 200); banner cảnh báo khi bất kỳ queue realtime nào đỏ (reuse
   `coverageWarningBanner` pattern tại `SocDataInventorySection.tsx:138-145`).
3. i18n VI/EN đủ keys, `npm run i18n:scan` exit 0.
4. Nâng `queue-drain-monitor` (`docker-compose.dev.yml:138-157`, audit F5): nới danh sách queue
   (không chỉ `realtime_prefetch` hardcode tại `:150` — thêm `realtime_scheduler`, `enrichment_offhours`,
   `enrichment_eod` nếu Slice E tạo, `manual_on_demand`); ngoài log, gọi webhook/API nội bộ khi depth >
   threshold 3 lần liên tiếp (hoặc tối thiểu document rõ "xem ở SOC Monitor" trong README vận hành —
   chọn 1, ghi rõ trong PR).
5. Gates FE: `tsc` 0, `build` PASS, `jest soc.test.js` pass, vitest component mới pass.

**Yêu cầu cần đạt:** FR-05; depth hiển thị ≤ 60s trễ (dùng chung poll/SSE observability 30s hiện tại,
`SocDataOpsMonitorSection.tsx:319-341`).

**Tiêu chí nghiệm thu:**
- [ ] SOC → DataOps → Monitor hiển thị 7 queue depths, số khớp `redis-cli LLEN` (±60s).
- [ ] Bơm queue test > 200 → banner đỏ hiện trong ≤ 90s.
- [ ] Redis down (stop core-redis 1 phút) → UI không crash (fail-open), hiện "—".

**Audit checklist:** helper Redis có timeout + fail-open (không treo request observability);
không lộ password Redis trong response; i18n đủ 2 ngôn ngữ, full dấu VI.

**Minh chứng:** screenshot/UI test + lệnh LLEN đối chiếu + test reports + ledger.

---

### Slice H — Regression tests + bàn giao docs (TEST + DOCS, P1, chạy song song từ Slice B)

**Mục tiêu:** mọi logic mới có test; ledger/AGENTS phản ánh đúng; đội khác đọc là chạy được.

**Files chạm:** test files cạnh code (BE `service_ops/tests/`, `data_ingest/tests/`, `market_serving/tests/`;
FE `adapters/core/__tests__/soc.test.js`, `vitest` component mới); `docs/CODE_CHANGE_AUDIT_LEDGER.md`; `AGENTS.md`
(mục Progress/Done + metrics nếu thay đổi kiến trúc queue).

**Steps:**
1. Mỗi slice B–G bắt buộc ≥1 BE test + (nếu chạm FE) ≥1 FE test, đặt tên `test_<slice>_<hanh_vi>.py` / `*.component.test.tsx`.
   Không sửa 6 fail pre-existing của `test_soc_tasks.py` (đã ghi từ Entry 80/AGENTS) — tests mới phải độc lập,
   chạy isolated xanh.
2. Rà soát tường minh các asserts queue cũ sau Slice D (audit E — review từng dòng, chỉ sửa khi thiết kế mới
   thật sự đổi queue đó):
   - `test_repair_beat_schedule.py:44` (`pt.queue == "realtime_prefetch"` → `"realtime_scheduler"` cho job scheduler).
   - `test_scheduler_catalog.py:37,42` (queue trong schedule_map fixture).
   - `test_soc_tasks.py:357,421,512,650` (`planner_queue` — field khác beat queue; giữ nguyên nếu planner không đổi).
   - Mở rộng `test_drift_enabled_missing.py` với queue mới (Slice D).
   - Nơi đặt test mới: `market_serving/tests/test_realtime_prefetch.py` (đã tồn tại) cho Slice B/C;
     cạnh `test_tasks.py` (`test_tasks.py:419-420`, `:533-536` asserts `coverage_refreshed_symbols`) cho Slice C.
2. Sau mỗi slice: ledger entry theo format hiện hành (Entry N: mục tiêu, commits, gates, bằng chứng số).
3. Cuối cùng: cập nhật AGENTS.md (Progress → Done từng slice, cập nhật metrics queue mới trong Key Decisions),
   rà soát `docs/GAP_ANALYSIS_DATAOPS_LEGACY_VS_SAAS_NATIVE.md` nếu còn reference kiến trúc queue cũ.

**Tiêu chí nghiệm thu:**
- [ ] `manage.py check` 0; các test file mới/chạm pass 100%; tổng số fail BE không tăng so với baseline
      (baseline: `service_ops` 17 pre-existing + `test_soc_tasks` 6 — liệt kê rõ trong ledger nếu đổi).
- [ ] FE: `tsc` 0, `build` PASS, `lint` 0 errors, `jest soc.test.js` pass, vitest files mới pass.
- [ ] Ledger có đủ entry A–H với minh chứng số (LLEN, row counts, timestamps ICT).

**Audit checklist:** reviewer chạy độc lập 3 lệnh (BE check, FE build, 1 test file mỗi slice) và đối chiếu
số liệu ledger; mọi `file:line` trong plan còn đúng sau refactor (sai → cập nhật plan).

---

## 6. Quality gates tổng (áp cho mọi slice code)

| Gate | Lệnh | Ngưỡng |
|------|------|--------|
| BE check | `python src/manage.py check` (trong `packages/core/backend`) | 0 issues |
| BE tests mới/chạm | `pytest <file> -q` | 100% pass, không tăng fail pre-existing |
| FE type | `npx tsc --noEmit` (trong `packages/web`) | 0 errors, sau mỗi sub-step |
| FE build | `npm run build` | PASS cuối mỗi slice |
| FE lint | `npm run lint` | 0 errors (warn pre-existing chấp nhận, liệt kê) |
| FE jest | `jest soc.test.js` (hiện 92/92) | không giảm |
| i18n | `npm run i18n:scan` | exit 0, đủ VI/EN |
| Live verify | LLEN + psql counts + logs (mục 5 từng slice) | đạt số nghiệm thu |

## 7. Rollout & rollback

1. Thứ tự: **A → (B, C song song) → D → (E, F song song) → G → H xuyên suốt**.
2. Mỗi slice BE deploy dev → chạy live-verify ≥ 1 phiên giao dịch (hoặc 24h cho EOD/marathon) → mới coi là DONE.
3. Rollback: mọi slice đều backward-compatible (queue mới + worker mới chạy song song queue cũ 1 phiên trước khi
   xóa route cũ — ghi rõ trong PR từng slice); beat `expires` rollback bằng revert settings + `repair_beat_schedule`.
4. Cấm deploy E/F/G vào 16:30–18:00 ICT (cửa sổ backfill EOD) — ghi vào PR checklist.

## 8. Rủi ro & mitigation

| Rủi ro | Mức | Mitigation |
|--------|-----|------------|
| Purge Slice A xóa nhầm tin có giá trị | Trung | Stop beat trước purge; prefer purge chọn lọc theo `periodic_task_name`; backup RDB Redis trước khi DEL |
| Chunk 60 vẫn > 10p khi provider chậm toàn diện | Trung | Per-symbol timeout (Slice C bước 3) + đo lại sau 1 phiên, giảm chunk xuống 30 không cần deploy code mới (env) |
| Tách queue làm lộ drift ở prod (queue cũ còn tin) | Thấp | Chạy song song 1 phiên; `check_scheduler_queue_drift` gate trong CI; reconcile tự fix queue |
| Thêm worker vượt tài nguyên máy dev | Thấp | Worker mới mem 256m, NFR-01 giới hạn +2 container; đo `docker stats` sau deploy |
| Test mới flaky do phụ thuộc giờ phiên | Trung | Mock `timezone.now`/session_date trong mọi test thời gian; không assert wall-clock live |

## 9. Bàn giao (handover checklist cho đội code)

- [ ] Đọc mục 1 (root cause + bằng chứng) trước khi code — mọi quyết định thiết kế phải trace về R1–R11.
- [ ] Nhận slice theo ma trận mục 4; mỗi slice tự chứa steps/lệnh/file:line — thực hiện đúng thứ tự steps.
- [ ] Không devote khỏi output mục 5 (thiếu section minh chứng = slice chưa DONE).
- [ ] Mọi số liệu live trong plan (76.493, 20 rows, 17/09…) là **baseline 2026-09-21 ~11:00 ICT** — đo lại baseline
      mới nếu bắt đầu muộn hơn 48h.
- [ ] Mở 1 PR/slice, tiêu đề `[QueueRecovery/SliceX]`; paste bảng nghiệm thu vào mô tả PR; cập nhật ledger trong cùng PR.
- [ ] Reviewer dùng Audit checklist từng slice + gates mục 6; từ chối merge khi thiếu minh chứng số.
