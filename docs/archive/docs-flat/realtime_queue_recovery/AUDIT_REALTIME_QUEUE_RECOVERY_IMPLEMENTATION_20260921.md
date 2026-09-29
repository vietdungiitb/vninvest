# AUDIT — QueueRecovery implementation vs plan Rev.2 (2026-09-21)

> Re-audit độc lập phần code đội code đã triển khai theo
> `docs/IMPLEMENTATION_PLAN_REALTIME_QUEUE_RECOVERY_20260921.md` (Rev.2, ledger Entry 137).
> Khung: AGENTS.md §4. Phương pháp: read/grep toàn repo + chạy gates thật, không trust tài liệu.
> Trạng thái: **toàn bộ thay đổi còn UNCOMMITTED** (head `f41ec45f`), không có commit/ledger/PR cho slice nào.

---

## TÓM TẮT 5 FINDINGS NGHIÊM TRỌNG NHẤT

1. **Q-1 (HIGH) — Isolation EOD không đạt ở prod/ghcr.** Dev tách `core-worker-enrichment-eod`
   (`docker-compose.dev.yml:368-395`) nhưng prod/ghcr chỉ **thêm `enrichment_eod` vào worker backfill
   cũ** (`docker-compose.prod.yml:146`, `docker-compose.ghcr.yml:124`) → `daily-backfill` vẫn chia slot
   với marathon cuối tuần. Mục tiêu PA1 (Slice E) chỉ đúng ở dev.
2. **Q-2 (HIGH) — Traceability = 0.** 27 file đổi uncommitted; ledger chỉ có Entry 137 ghi
   *"chưa code"*; không có PR/commit theo slice → vi phạm quy ước plan (1 PR/slice + ledger/slice).
3. **Q-3 (MED) — Rotation coverage sai kỳ vọng.** `_select_coverage_rotation` đổi slot mỗi
   `60//parts` phút (parts=3 → 20 phút) ⇒ full refresh ~**60 phút**, không phải "~9 phút" như docstring.
4. **Q-4 (MED) — Test rotation rỗng nghĩa.** `test_rotation_partitions_symbols` gọi 3 lần trong cùng
   một phút → cùng partition; assert `len(seen) <= 90` luôn đúng.
5. **Q-5 (MED) — Rủi ro OOM worker realtime.** prefork concurrency 5 với `mem_limit 512m`
   (`docker-compose.dev.yml:204,226`); comment tự nhận ~150MB/slot (5×150=750m > 512m).

---

## A. BẢN ĐỒ KIẾN TRÚC THAY ĐỔI (uncommitted)

| File | Trách nhiệm | Ghi chú |
|---|---|---|
| `data_ingest/tasks.py` | Slice C: warm chunk + self-continuation + timeout + circuit breaker + coverage rotation | +~250 dòng |
| `market_serving/realtime_prefetch.py` | Slice B: dedup guard, soft/hard limit, session gate, shard per-symbol timeout | |
| `market_serving/vnbroker_materializer.py` | Slice F: bulk upsert + bỏ mass-stale | `bulk_create:291`, `:324` |
| `market_serving/materializers.py` | Slice F: bỏ mass-stale | `:43` |
| `market_serving/session_facts_engine.py` | Slice C follow-up: refresh coverage sau upsert facts | |
| `service_ops/beat_reconcile.py` | Slice B/F: CRITICAL_JOBS + expire_seconds + interval sync | `:18-23` |
| `service_ops/tasks.py` | Slice G: queue-depth helper timeout + mở rộng orphan-check | `:818`, `:865-875` |
| `service_ops/dataops_market_data.py` | Slice G: `_read_broker_queue_depths` + `queue_depths` | `:711`, `:878` |
| `service_ops/views/dataops_stream.py` | Slice G: `queue_depths` vào SSE signature | `:54-67` |
| `vninvest_core/management/commands/check_scheduler_queue_drift.py` | Slice F: CRITICAL_JOBS | `:10-15` |
| `vninvest_core/queue_policy.py` | Slice D/E: `realtime_scheduler`, `enrichment_eod` + domain | `:6-16`, `:64-78`, `:117-135` |
| `vninvest_core/settings.py` | Slice B: `expire_seconds` + interval env-tunable | `:454-576` |
| `entrypoint.sh` | Slice E: `--max-tasks-per-child` env-tunable | `:36-48` |
| compose ×5 | Slice D/E/G: worker mới, monitor multi-queue | dev/prod/ghcr/root/core |
| FE `SocDataOpsMonitorSection.tsx`, `soc.js`, `i18n/{vi,en}.js` | Slice G: card queue depth + i18n ×6 | |
| test mới ×10 | Slice B–G + snapshot bulk + FE component | |

---

## B. LUỒNG DỮ LIỆU ĐÃ TRACE

**Scheduler → shard (Slice B/D/G):**
`beat (3s, `settings.py:481`)` → queue `realtime_scheduler` (`queue_policy.py:66-71`) →
`schedule_realtime_prefetch_shards` (`realtime_prefetch.py:292-299`) → dedup cache `last_run`
(`:315-334`) → session gate (`:355-366`) → enqueue `prefetch_realtime_ticker_shard` theo tier
(`:398`) → worker `realtime-scheduler` (`docker-compose.dev.yml:231-269`).

**Beat warm (Slice C, F1):**
`warm-intraday-realtime-5m` (`settings.py:576`) → `warm_intraday_universe` (`tasks.py:984`) →
beat path không plan → `_get_hot_registry_symbols()` (`:169`, hot-only) → chunk 30
(`:103,:1052`) → `_hydrate_intraday_symbols` per-symbol timeout 8s (`:404`) → circuit breaker
(`:121`) → self-continuation `apply_async(offset+30, countdown 30s)` (`:1102+`).

**Snapshot (Slice F):**
`materialize-symbol-snapshot-60s` (nay 300s, `settings.py:454-460`) →
`materialize_symbol_snapshot_from_vnbroker` → 2 batch DailyPrice queries (`:188`) →
`bulk_create(update_conflicts=True)` 1 lần (`:291`) → lỗi provider KHÔNG mass-stale (`:324`).

**SSE (Slice G):**
`build_market_data_observability_summary` → `queue_depths` (`dataops_market_data.py:878`) →
`_dataops_signature` hash kèm depths (`dataops_stream.py:57-63`) → FE card
(`SocDataOpsMonitorSection.tsx`) cập nhật khi depth đổi dù stream mở.

---

## C. CONTRADICTIONS (plan/doc vs code)

| # | Plan/Doc | Code thực tế | Tác động |
|---|---|---|---|
| C-a | Docstring `warm_intraday_universe` "30 × 15s = 450s" | `_DEFAULT_WARM_PER_SYMBOL_TIMEOUT_SECONDS = 8` (`tasks.py:104`) → 240s | Doc sai, không phải code |
| C-b | Docstring rotation "full refresh ~9 phút" | slot đổi mỗi `60//parts` phút ⇒ full ~60 phút (`tasks.py:244-259`) | Kỳ vọng freshness sai |
| C-c | Plan Rev.2 giữ interval 60s | snapshot 60→300s, price-board 60→180s (`settings.py:454-460,557-563`) | Deviation có chủ đích, cần sign-off |
| C-d | Entry 137 "git status chỉ 2 file đổi (plan+ledger)" | hiện 27 file code đổi | Ledger stale |

---

## D. FINDINGS

| ID | Mức | file:line | Thực tế | Tác động | Đề xuất fix |
|---|---|---|---|---|---|
| Q-1 | **HIGH** | `docker-compose.prod.yml:146`, `docker-compose.ghcr.yml:124` | `enrichment_eod` gộp worker với `enrichment_offhours` (marathon); chỉ dev tách worker riêng (`docker-compose.dev.yml:368`) | PA1 không đạt ở prod/ghcr | Thêm service `core-worker-enrichment-eod` cho prod + ghcr |
| Q-2 | **HIGH** | git status / `docs/CODE_CHANGE_AUDIT_LEDGER.md` | 0 commit/ledger/PR/slice; Entry 137 "chưa code" | Vi phạm traceability plan | Tách commit/PR + ledger entry từng slice |
| Q-3 | MED | `data_ingest/tasks.py:244-259` | slot rotation theo phút ⇒ full ~60' | Kỳ vọng coverage sai | Sửa docstring; nếu cần full 9' thì đổi slot theo run/offset |
| Q-4 | MED | `data_ingest/tests/test_queue_recovery_slice_c.py:135-144` | 3 lần gọi cùng phút → cùng partition | Test không kiểm chứng rotation | Mock `timezone.now()` qua các slot |
| Q-5 | MED | `docker-compose.dev.yml:204,226` | prefork 5 × ~150MB > mem 512m | Nguy cơ OOM worker realtime | Đo RSS; nâng mem hoặc giảm slot |
| Q-6 | LOW | `realtime_prefetch.py:63,133-161` | session-only ON mặc định (T2–T6 08:30–15:30) | Không prefetch ngoài phiên — behaviour change | Sign-off + rà consumer off-hours |
| Q-7 | LOW | `materializers.py:43`, `vnbroker_materializer.py:324` | Bỏ mass-stale khi provider fail toàn bộ | UI có thể hiển thị last-good như "fresh" | Xác minh freshness tính ở nguồn khác |
| Q-8 | LOW | `docker-compose.dev.yml:244` + `realtime_prefetch.py:296-297` | worker scheduler `pool=solo` không enforce soft/hard limit | Q3 (45/60s) vô hiệu ở worker đó | Ghi nhận; task rẻ nên chấp nhận |
| Q-9 | LOW | `entrypoint.sh:42`; `settings.py` `float(os.getenv(...))` | Comment "4 critical jobs" (nay 5); env sai → ValueError lúc import | Nhỏ | Sửa comment; guard parse |
| Q-10 | LOW | `realtime_prefetch.py:69` vs `tasks.py:98` | `_read_int_env` trùng 2 module | DRY | Gom helper chung |

### Đối chiếu finding lần 1 (đã đóng)
| Finding | Trạng thái | Bằng chứng |
|---|---|---|
| C-1 mass-stale 2 chỗ | ✅ ĐÓNG | `materializers.py:43`, `vnbroker_materializer.py:324` + test `snapshot_bulk:63-66` |
| C-2 60×20=1200s > FR-03 | ✅ ĐÓNG | chunk 30 × timeout 8s = 240s (`tasks.py:103-104`) + bound test `slice_c:96-99` |
| C-3 broker TTL | ✅ ĐÓNG (giới hạn đã ghi rõ) | `settings.py:481-486` comment + `test_queue_recovery_slice_b` |
| C-4 signature thiếu depth | ✅ ĐÓNG | `dataops_stream.py:57-63` + `slice_g:34-43` + FE test |
| F1 beat warm full registry | ✅ ĐÓNG | hot-only `tasks.py:169` + self-continuation `:1102+` + `slice_c:54-72` |
| F3 hardcode queue list | ✅ ĐÓNG | `service_ops/tasks.py:865-875` (+realtime_scheduler,+enrichment_eod) |
| F4 sent_at không tin cậy | ✅ ĐÓNG | cache `last_run` `realtime_prefetch.py:51,315-334` |
| F5 monitor 1 queue | ✅ ĐÓNG | `docker-compose.dev.yml:148-160`, `ghcr.yml:171-182` (8 queue) |
| F6 CRITICAL_JOBS lệch | ✅ ĐÓNG | `beat_reconcile.py:18-23` == drift `:10-15` + `slice_f:16-22` |

---

## E. QUALITY GATES (đã chạy thật)

**Backend** (`docker compose exec -w /app/src core-api python manage.py …`):
- 39 test slice mới: **OK (39/39)**.
- `test_realtime_prefetch` + `test_tasks` + `test_repair_beat_schedule`: **OK**.
- `test_scheduler_catalog` + `test_drift_enabled_missing`: **OK (43 tests)**.
- `test_soc_tasks`: **6 FAIL = đúng baseline pre-existing** (reproduce HEAD), không tăng.
- `manage.py check`: **0 issues**.

**Frontend** (`packages/web`):
- `npx tsc --noEmit`: **0**.
- `npm run build`: **PASS 48.00s**.
- `eslint` (4 file đổi): **0**.
- `npm run i18n:scan`: **exit 0**; diff i18n sạch, đúng +6 key `queue_depth*`.
- `vitest` queue-depth component: **2/2**.
- `jest soc.test.js`: **94/94**.

**Live (dev stack):**
- Worker `core-worker-realtime-scheduler`, `core-worker-enrichment-eod`: **up**.
- Broker depth (`redis -n 3 LLEN`): `realtime_prefetch=162`, `realtime_scheduler=0`,
  `enrichment_offhours=0`, `enrichment_eod=0`, `manual_on_demand=2`, `celery=2` → không còn 76k,
  nhưng `realtime_prefetch` vẫn còn tồn 162 (theo dõi tiếp).

---

## F. CÂU HỎI CẦN LÀM RÕ

1. Interval snapshot 300s / price-board 180s (env-tunable) đã được product/ops duyệt?
2. Session-only gate OFF ngoài phiên có làm hỏng consumer nào (app/prefetch) không?
3. Prod/ghcr gộp EOD chung worker marathon là chủ đích (khác dev) hay thiếu sót?
4. Khi nào tách commit/PR + ledger entry cho 8 slice?

---

## G. ĐÁNH GIÁ TỔNG THỂ

- **Implementation quality:** cao. 8/8 slice khớp plan Rev.2; 9/9 finding lần 1 đã đóng **có test**;
  gates BE+FE xanh; không blocker kỹ thuật.
- **Chưa sẵn sàng merge** cho tới khi: (a) xử lý **Q-1** (worker EOD prod/ghcr), (b) **Q-2**
  (tách commit/PR + ledger theo slice). Nên sửa kèm **Q-3/Q-4/Q-5**.
- **Ưu tiên sửa:** Q-1 → Q-2 → Q-5 → Q-3/Q-4 → Q-6..Q-10.

---

## H. PHỤ LỤC — Lệnh verify

```powershell
# BE
docker compose -f docker-compose.dev.yml exec -T -w /app/src core-api python manage.py test `
  service_ops.tests.test_queue_recovery_slice_b service_ops.tests.test_queue_recovery_slice_d `
  service_ops.tests.test_queue_recovery_slice_e service_ops.tests.test_queue_recovery_slice_f `
  service_ops.tests.test_queue_recovery_slice_g data_ingest.tests.test_queue_recovery_slice_c `
  market_serving.tests.test_queue_recovery_snapshot_bulk `
  market_serving.tests.test_queue_recovery_slice_c_facts
# FE
npx tsc --noEmit ; npm run build ; npx vitest run src/components/__tests__/soc-queue-depth.component.test.tsx
npx jest src/adapters/core/__tests__/soc.test.js ; npm run i18n:scan
# Live
docker compose -f docker-compose.dev.yml exec -T core-redis redis-cli -n 3 LLEN realtime_prefetch
```
