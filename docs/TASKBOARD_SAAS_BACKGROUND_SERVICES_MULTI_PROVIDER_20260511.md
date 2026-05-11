# TASKBOARD — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Legend**: [ ] Not started | [~] In progress | [x] Done | [!] Blocked

---

## P0 — Baseline and Guardrails

- [x] `SBMP-P0.1` Audit queue drift code vs DB scheduler
Owner: Platform Lead  
DoD: Có drift report và danh sách tasks lệch queue

- [x] `SBMP-P0.2` Add startup sync for periodic task queue fields
Owner: Backend Lead  
DoD: Deploy mới tự đồng bộ queue không cần thao tác tay

- [x] `SBMP-P0.3` Baseline dashboards cho queue lag + freshness
Owner: DevOps  
DoD: Dashboard có dữ liệu cho 24h gần nhất

---

## P1 — Queue Isolation

- [x] `SBMP-P1.1` Define queue map theo domains
Owner: Platform  
DoD: Queue matrix được duyệt

- [x] `SBMP-P1.2` Split workers theo queue domains
Owner: DevOps + Backend  
DoD: Worker topology mới chạy ổn định

- [x] `SBMP-P1.3` Route critical tasks sang queue mục tiêu
Owner: Backend  
DoD: 100% critical tasks không chạy trên queue default

- [x] `SBMP-P1.4` Add fallback consumer policy cho high-priority queues
Owner: Backend  
DoD: Không còn blackhole queue khi một worker domain down

---

## P2 — Multi-Provider Hardening

- [x] `SBMP-P2.1` Implement provider quality scoring
Owner: Data Platform  
DoD: Có score per provider/channel trong metrics

- [ ] `SBMP-P2.2` Implement best-source resolver theo market phase
Owner: Backend  
DoD: Routing policy chạy được qua runtime config

- [ ] `SBMP-P2.3` Expand runtime config schema v2
Owner: Backend  
DoD: Admin-ops có thể điều chỉnh provider strategy

- [ ] `SBMP-P2.4` Add provider routing audit trail
Owner: Backend  
DoD: Có log truy vết provider decision mỗi chu kỳ

---

## P3 — Manual Trigger Framework

- [ ] `SBMP-P3.1` API trigger thủ công cho user/admin
Owner: Backend  
DoD: API có auth, entitlement, quota gate

- [ ] `SBMP-P3.2` Queue manual_on_demand + priority rules
Owner: Platform  
DoD: Manual jobs không ảnh hưởng realtime queues

- [ ] `SBMP-P3.3` Add manual job status endpoint + retry policy
Owner: Backend  
DoD: Người dùng xem được trạng thái và ETA job

---

## P4 — Offhours Enrichment

- [ ] `SBMP-P4.1` Build enrichment pipelines (history/fundamentals/news)
Owner: Data Team  
DoD: Jobs ngoài giờ hoàn thành đầy đủ theo checklist

- [ ] `SBMP-P4.2` Materialize pre-open snapshots
Owner: Market Serving  
DoD: Snapshot completeness >= 99.5% trước pre-open + 20m

- [ ] `SBMP-P4.3` Dedupe/upsert canonical facts
Owner: Data Team  
DoD: Duplicate rate dưới ngưỡng chấp nhận

---

## P5 — Soak and Scale

- [ ] `SBMP-P5.1` 10k-user synthetic load test
Owner: QA Perf + DevOps  
DoD: SLI latency/freshness đạt mục tiêu

- [ ] `SBMP-P5.2` 72h soak test with alert gates
Owner: DevOps + QA  
DoD: Không có incident P1/P0

- [ ] `SBMP-P5.3` Final cutover decision
Owner: Tech Lead + Product Owner  
DoD: Sign-off theo evidence bundle
