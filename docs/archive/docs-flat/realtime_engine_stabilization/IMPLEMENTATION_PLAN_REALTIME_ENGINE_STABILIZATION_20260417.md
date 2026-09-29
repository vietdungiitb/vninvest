# IMPLEMENTATION PLAN - REALTIME ENGINE STABILIZATION (20260417)

## 1. Business objective

Van de can giai quyet:
- Giam rui ro sap backend trong gio cao diem do N+1 DB query tren WebSocket advisory fanout.
- Giam tai CPU/GC trong stream consumers do khoi tao pandas DataFrame lien tuc tren hot path.
- Giam xung dot DB khi xay ra reconnect storm (deploy/restart/network flap).
- Cung co do tin cay delivery cho Redis Stream consumer groups khi consumer bi restart/chet giua chung.

KPI/ket qua ky vong:
- p95 latency cho event ticker -> WS client <= 500ms trong gio giao dich binh thuong.
- So DB query/giay tu ws advisory path giam >= 90% so voi baseline.
- CPU avg cua process stream-consumer giam >= 25% trong scenario throughput tuong duong.
- Ti le reconnect thanh cong trong 30s >= 99% (khong tao dot bien DB connections).
- Khong con loi 500 lien quan realtime path trong 3 phien giao dich lien tiep sau rollout.

## 2. Scope and non-scope

In-scope:
- WebSocket consumer (`backend/portfolio/consumers.py`): bo N+1 user-plan query tren moi advisory event.
- Realtime stream consumers (`backend/portfolio/realtime/stream_consumers.py`): toi uu hot path ticker/alert engine.
- Redis stream reliability: pending claim/replay/ack guardrails.
- Observability + alerting cho realtime pipeline.
- Test suite cho cac scenario high-risk neu tren.

Out-of-scope:
- Thay doi giao dien frontend hoac i18n ngoai canh bao debug/metrics.
- Thay doi luong business scoring cua whale/dark flow.
- Thay doi DB schema lon (migration bang moi) trong dot nay.
- Refactor toan bo realtime architecture sang service rieng.

## 3. Current-state assessment

Hien trang lien quan:
- `RealtimeConsumer.whale_advisory` goi `_get_user_plan()` moi event -> `database_sync_to_async` co DB hit theo moi socket.
- `WsBroadcastConsumer` va `AlertEngineConsumer` tao `pd.DataFrame(rows)` tren moi batch stream.
- `_authenticate_user` goi `_get_user(user_id)` tu DB tren moi ket noi WS moi.
- Chua co co che pending-entry reclaim ro rang khi consumer group co stale pending entries sau restart.
- He thong da co observability co ban nhung thieu dashboard/alerts chuyen biet cho stream lag, pending depth, ws fanout query load.

Constraint ky thuat/ha tang:
- Django + Channels + Redis Streams + Celery beat/worker.
- Docker dev stack thuong duoc user quan ly thu cong; khong auto rebuild trong scope agent.
- Can backward compatible de khong pha vo endpoint contract hien tai.

## 4. Target design

Kien truc dich:
- WebSocket connection-level entitlement cache:
  - Resolve plan 1 lan tai `connect()`.
  - Luu tren memory cua consumer instance (`self.user_plan`, `self.plan_resolved_at`).
  - Advisory fanout khong duoc query DB tren hot path.
- Auth lookup de-pressure:
  - Uu tien JWT claims + cache layer (short TTL) cho `user_id -> auth snapshot`.
  - DB lookup chi fallback khi cache miss.
- Stream processing hot path:
  - Ticker broadcast path dung native list/dict processing (khong pandas) cho payload can thiet.
  - Alert engine giu pandas neu can thiet cho detect logic phuc tap, nhung co batched conversion toi uu va guard row limit.
- Consumer group reliability:
  - Them reclaim pending strategy theo idle timeout + claim size.
  - Metric hoa so pending theo group/symbol.

Luong du lieu vao/ra:
- Input: Redis stream `vninvest:ticks:{symbol}`.
- Processing:
  - `db-writer` -> DB `IntradayTick`.
  - `ws-broadcaster` -> Channels group `ticker_{SYMBOL}`.
  - `alert-engine` -> Channels group `whale_{SYMBOL}`.
- Output: WebSocket payload den frontend + metrics/logs.

Luu tru va retention:
- Redis stream maxlen giu nguyen hien tai (co the tune sau benchmark).
- Pending entries reclaim theo threshold idle de tranh tich tu.
- Cache auth/plan TTL de xuat: 120-300s.

Ownership:
- Owner chinh: Backend Realtime team.
- Support: Platform/Ops cho metric + alert wiring.

## 5. Execution phases

Phase 0 - Prep + feature flags:
- Them flags:
  - `REALTIME_WS_PLAN_CACHE_ENABLED` (default true)
  - `REALTIME_WS_AUTH_CACHE_ENABLED` (default true)
  - `REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED` (default false, canary)
  - `REALTIME_STREAM_PENDING_RECLAIM_ENABLED` (default false)
- Cap nhat settings/env docs.
- Rollback: tat cac flag moi ve false.

Phase 1 - P0 N+1 advisory fix:
- Files du kien:
  - `backend/portfolio/consumers.py`
  - `backend/portfolio/tests/...` (bo sung test ws advisory no-db-on-hotpath)
- Cong viec:
  - Resolve plan trong `connect()` va cache local consumer.
  - `whale_advisory` doc `self.user_plan` thay vi query DB.
  - Co fallback an toan neu plan chua resolve.
- Rollback phase: flag `REALTIME_WS_PLAN_CACHE_ENABLED=false` + giu duong cu.

Phase 2 - Auth reconnect de-pressure:
- Files du kien:
  - `backend/portfolio/consumers.py`
  - `backend/portfolio/cache_helpers.py` (neu can)
- Cong viec:
  - Cache `user_id -> auth snapshot` TTL ngan.
  - Reduce DB query trong reconnect storm.
- Rollback: tat `REALTIME_WS_AUTH_CACHE_ENABLED`.

Phase 3 - Ticker broadcast hot path optimization:
- Files du kien:
  - `backend/portfolio/realtime/stream_consumers.py`
  - `backend/portfolio/realtime/compute.py`
- Cong viec:
  - Them native payload builder cho ticker path.
  - Benchmark so sanh native vs pandas.
  - Enable canary bang flag cho mot nhom symbol.
- Rollback: tat `REALTIME_STREAM_NATIVE_TICKER_PATH_ENABLED`.

Phase 4 - Stream pending reclaim + reliability:
- Files du kien:
  - `backend/portfolio/realtime/stream_consumers.py`
  - `backend/portfolio/realtime/stream_reader.py`
- Cong viec:
  - Them pending scan + claim loop co gioi han.
  - Them log va metric cho pending lag.
- Rollback: tat `REALTIME_STREAM_PENDING_RECLAIM_ENABLED`.

Phase 5 - Hardening + docs + release gates:
- Hoan tat tests, update runbook, update dashboard/alerts.
- Chot release checklist va post-release monitoring window.

## 6. API and data contract changes

Endpoint contract:
- Khong thay doi schema response hien tai cho ticker/whale WS payload.
- Co the bo sung truong debug optional trong noi bo (khong expose mac dinh).

Schema/migration:
- Khong migration DB bat buoc trong dot nay.

Backward compatibility:
- Tat ca thay doi duoc bao boi feature flags.
- Fallback ve hanh vi cu trong moi phase neu co regression.

## 7. Scheduling and operations

Lich auto:
- Khong them Celery beat task moi bat buoc.
- Pending reclaim co the nam trong vong lap consumer hien tai (interval nho) hoac task nhe theo chu ky 30-60s (neu can).

Manual trigger/admin:
- Khong mo endpoint admin moi trong phase dau.
- Neu can debug, dung script/read-only command trong runbook.

Guardrails:
- Lock: tranh reclaim trung lap bang per-group lock key trong Redis.
- Retry: exponential backoff cho group_send loi tam thoi.
- Timeout: dat timeout ro rang cho Redis read/claim.
- Rate-limit: giu co che DRF throttle da harden.
- Circuit-breaker: neu broadcaster lag vuot nguong, giam payload mode (skip optional fields).

## 8. Testing and verification

Unit tests bat buoc:
- `RealtimeConsumer.whale_advisory` khong query DB tren moi event khi plan cache da co.
- Auth cache logic: hit/miss/ttl expiry.
- Native ticker payload builder cho ket qua tuong duong contract cu.
- Pending reclaim logic: claim du entry idle, khong double-ack.

Integration tests:
- End-to-end stream -> broadcaster -> websocket receive.
- Reconnect storm simulation (N clients) va do DB query count.
- Chaos test: kill 1 consumer worker, verify pending reclaim.

Verification step-by-step:
1. Baseline metrics truoc thay doi (CPU, DB qps, ws latency, pending depth).
2. Enable phase flag tren dev/staging.
3. Chay test suite + load test ngan.
4. So sanh metrics voi baseline.
5. Chi rollout tiep neu dat exit criteria.

Exit criteria de release:
- No regression functional tests.
- p95 ws latency khong xau hon baseline > 10%.
- DB qps tren advisory path giam ro net theo KPI.
- Khong co crash/500 moi trong soak test >= 30 phut.

## 9. Observability and alerting

Metrics can bo sung:
- `realtime_ws_advisory_plan_cache_hit_total`
- `realtime_ws_advisory_plan_cache_miss_total`
- `realtime_stream_broadcast_batch_size`
- `realtime_stream_broadcast_process_ms`
- `realtime_stream_pending_depth{group}`
- `realtime_stream_pending_reclaim_total{group}`
- `realtime_ws_connect_auth_db_lookup_total`

Logs:
- Structured logs cho path reclaim/auth-cache fallback.
- Correlation id cho stream message -> ws event.

Alerts:
- Pending depth vuot nguong lien tuc 5 phut.
- ws broadcast error rate > 2% / 5 phut.
- advisory DB lookup spike vuot baseline x2.

## 10. Security and governance

Permission model:
- Giu nguyen auth JWT hien tai.
- Khong mo rong scope quyen user.

Audit trail:
- Ghi ro thay doi trong `docs/CODE_CHANGE_AUDIT_LEDGER.md` theo tung phase.
- Moi phase merge phai co file-list va ket qua verify.

Secrets/config:
- Bien moi duoc khai bao trong env docs.
- Khong hardcode secret vao repo.

## 11. Release plan

Canary/phased rollout:
- Dot 1: 10% symbol cohort (hoac low-volume symbols) voi native ticker path.
- Dot 2: 50% symbols neu metric on dinh sau 1 phien.
- Dot 3: 100% sau 2-3 phien khong co regression.

Backout plan:
- Tat feature flags theo thu tu phase gan nhat -> cu nhat.
- Neu co su co nghiem trong: rollback ve commit truoc phase dang rollout.

Post-release checklist:
- Xac nhan dashboards metrics update.
- Xac nhan khong co 500 moi tren `/api/realtime/*`.
- Xac nhan ws reconnect behavior on dinh sau restart worker.

## 12. Ownership and timeline

Ownership:
- Owner chinh: Backend Realtime Engineer.
- Reviewer: Tech Lead Backend.
- Approver: Product/Engineering owner.
- Ops support: DevOps on-call.

Timeline de xuat:
- Day 0: Chot plan + baseline metrics.
- Day 1: Phase 0 + Phase 1 (P0 N+1 fix).
- Day 2: Phase 2 (auth cache reconnect).
- Day 3-4: Phase 3 (native ticker path) + benchmark.
- Day 5: Phase 4 (pending reclaim) + chaos test.
- Day 6: Phase 5 release canary.
- Day 7-8: Theo doi + full rollout neu on dinh.

---

## Definition of Ready (DoR)
- File plan nay duoc review va thong nhat.
- Da chot KPI baseline va nguong pass/fail.
- Da co owner/reviewer/approver ro rang.
- Da co rollback strategy cho tung phase.

## Definition of Done (DoD)
- Tat ca phase trong scope da hoan tat hoac co ghi ro sai lech.
- Dat exit criteria testing va observability.
- Da cap nhat `docs/CODE_CHANGE_AUDIT_LEDGER.md` voi file-list + verify.
- Da cap nhat `PROGRESS_DASHBOARD.md` theo quy dinh audit trung tam.
