# SELF AUDIT AND TEST PROTOCOL — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11

---

## 1. Audit checklist theo phase

## P0
1. Queue drift report đã có chưa?
2. Startup sync queue fields đã bật chưa?
3. Baseline dashboard đã có dữ liệu chưa?

## P1
1. Queue matrix đã được duyệt chưa?
2. Worker split topology đã chạy ổn chưa?
3. Critical tasks còn vào default queue không?
4. Fallback consumer policy đã test failover chưa?

## P2
1. Provider score có đủ metrics chưa?
2. Best-source resolver có chạy đúng theo market phase không?
3. Runtime config v2 có validate đủ không?
4. Routing decisions có audit trail không?

## P3
1. Manual trigger API có entitlement + quota gates chưa?
2. Manual queue có gây tăng lag realtime không?
3. User có xem được trạng thái job không?

## P4
1. Offhours jobs có chạy đủ channels không?
2. Pre-open snapshots có đủ completeness target không?
3. Dedupe/upsert có kiểm soát duplicate rate không?

## P5
1. Load test 10k users đã đạt SLO chưa?
2. Soak 72h có incident P1/P0 không?
3. Cutover evidence đã đủ sign-off chưa?

---

## 2. Test protocol tối thiểu

1. Queue routing tests
- verify task route by queue
- verify beat DB queue fields
- verify no blackhole queues

2. Provider tests
- timeout fallback
- parseability fallback
- quality score consistency

3. Manual trigger tests
- auth + quota + cooldown
- priority fairness
- cancellation/retry behavior

4. Offhours tests
- schedule execution timing
- completeness and freshness before pre-open
- materialization consistency checks

5. Scale tests
- concurrent active users simulation
- websocket fanout stability
- cache hit/miss under stress

---

## 3. Failure triage protocol

1. Queue starvation
- kiểm tra routing drift, worker readiness, queue depths.

2. Provider outage burst
- kiểm tra circuit breaker, fallback path, stale-serve flags.

3. Manual flood
- áp quota clamp, giảm priority, bật cooldown stricter.

4. Offhours overrun
- tăng shard/concurrency, cắt non-critical enrich steps theo policy.

---

## 4. Sign-off rule

Chỉ PASS khi:
1. Tất cả phase checklist pass.
2. Không còn blocker severity high/critical.
3. Evidence bundle đầy đủ và traceability không thiếu mapping.
