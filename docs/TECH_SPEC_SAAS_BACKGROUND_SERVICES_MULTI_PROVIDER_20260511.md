# TECH SPEC — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Trạng thái**: PROPOSED FOR APPROVAL

---

## 1. Kiến trúc mục tiêu

## 1.1 Service domains
1. Provider Adapter Mesh
- Chuẩn hóa truy xuất qua vnbroker cho market data providers (KBS/VCI/TCBS/SSI/MSI) và mở rộng plug-in cho provider mới.

2. Ingestion Orchestrator
- Điều phối periodic/event/manual jobs.
- Áp chính sách theo market phase và quota.

3. Materialization Layer
- Sinh symbol snapshot, session facts, bucket facts, enriched datasets.

4. Realtime Serving Layer
- Cache nóng + stream/websocket fanout.

5. Governance and Control Plane
- Runtime config/policy, ownership matrix, changelog, rollback toggles.

## 1.2 Queue topology
1. `realtime_prefetch`
- build universe snapshot
- schedule shards
- prefetch realtime ticker shard

2. `realtime_stream`
- stream consumers db-writer/ws-broadcaster/alert-engine

3. `enrichment_offhours`
- offpeak ingest, fundamentals/news/sentiment enrichment

4. `analytics_heavy`
- whale/order-flow heavy computations, backfill, recompute tasks

5. `manual_on_demand`
- user/admin-triggered jobs có quota và priority

## 1.3 Data planes
1. Hot plane
- Redis cache keys ticker snapshot, freshness metadata.

2. Warm plane
- materialized bucket/session facts phục vụ truy vấn nhanh.

3. Cold plane
- raw/staging + archival datasets cho backfill/forensics.

---

## 2. Provider orchestration contract

1. Provider selection
- primary source + fallback_sources lấy từ runtime config.

2. Failure handling
- timeout theo channel (price_board, intraday, history, fundamentals, listing).
- rate-limit detection + cooldown.
- circuit breaker per provider/channel.

3. Quality scoring
- completeness score
- freshness score
- parseability score
- stability score

4. Best-source resolver
- Chọn provider tốt nhất theo channel và market phase.
- Lưu provider decision vào observability payload.

---

## 3. Job modes contract

1. Periodic
- Trigger bởi beat theo cadence policy.

2. Event-driven
- Trigger khi phát hiện stale spike, cache miss burst, provider recovery.

3. Manual
- Trigger từ admin/user endpoint với:
  - entitlements check
  - quota check
  - cooldown check
  - audit trail

---

## 4. Outside-hours enrichment contract

1. Thu thập
- history bars, corporate actions, fundamentals, ownership, news/sentiment.

2. Làm giàu
- chuẩn hóa symbol, price unit, timezone, session date.
- dedupe/upsert theo canonical keys.

3. Materialize
- pre-open snapshots để mở phiên dữ liệu sẵn.

4. SLA ngoài giờ
- hoàn tất pipeline trước mốc pre-open + 20 phút.

---

## 5. Multi-tenant SaaS contract

1. Priority tiers
- Team > Pro > Community theo manual jobs và freshness budgets.

2. Quota model
- per-user và per-tenant quotas cho manual refresh/recompute.

3. Fairness
- không để manual jobs làm nghẽn realtime jobs.

4. Isolation
- tenant-scoped cache key namespaces và audit logs.

---

## 6. SLO/SLI contract cho mốc 10.000 users

1. SLI: Realtime freshness p95 <= 2s (top universe).
2. SLI: Realtime API p95 <= 250ms.
3. SLI: Manual job queue wait p95 <= 30s (Pro/Team).
4. SLI: Offhours pipeline success >= 99%.
5. SLI: Provider failover success >= 99% khi primary lỗi.

---

## 7. Observability contract

1. Metrics bắt buộc
- queue_depth{queue}
- task_lag_seconds{task}
- provider_timeout_total{provider,channel}
- provider_fallback_total{from,to,channel}
- cache_hit_ratio{domain}
- freshness_seconds{symbol_tier}

2. Alert rules
- realtime queue lag > threshold 5 phút
- freshness breach > threshold 3 chu kỳ
- provider timeout burst vượt baseline
- manual queue starvation

3. Audit logs
- runtime policy change
- manual trigger (actor, scope, quota decision)
- provider routing decision deltas

---

## 8. Backward compatibility

1. Giữ API contracts hiện hành cho dashboard/stock detail.
2. Mọi migration queue/policy phải có feature flags.
3. Có rollback toggles cho từng domain worker.

---

## 9. Non-functional constraints

1. Không cài package runtime lúc container startup ở production path.
2. Queue routing không phụ thuộc duy nhất vào code, phải đồng bộ DB scheduler entries.
3. Mọi thay đổi policy phải có changelog và review path.
