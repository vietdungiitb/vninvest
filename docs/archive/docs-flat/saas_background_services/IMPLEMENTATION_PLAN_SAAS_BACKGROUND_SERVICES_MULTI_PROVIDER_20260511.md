# IMPLEMENTATION PLAN — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Owner**: Platform + Data + Backend  
**Trạng thái**: READY FOR TEAM EXECUTION

---

## 1. Mục tiêu triển khai

1. Đưa kiến trúc background services lên mức production-grade cho SaaS 10.000 users.
2. Chuẩn hóa multi-provider orchestration có periodic/event/manual paths.
3. Nâng năng lực ngoài giờ để mở phiên với dữ liệu giàu và sẵn phục vụ.

---

## 2. Phases

## Phase P0 — Baseline and Guardrails (3-5 ngày)

Mục tiêu:
1. Khóa drift scheduler queue giữa code và DB.
2. Chuẩn hóa metrics/alerts nền.

Tasks:
1. Bootstrap migration script đồng bộ queue cho periodic tasks trọng yếu.
2. Bật queue lag + freshness dashboards.
3. Cài alert rules cho realtime starvation.

Deliverables:
1. Queue drift checker.
2. Alert baseline dashboard.

---

## Phase P1 — Queue Isolation and Worker Domain Split (1-2 tuần)

Mục tiêu:
1. Tách realtime khỏi heavy workloads.
2. Giảm cache miss do nghẽn chéo queue.

Tasks:
1. Tạo đầy đủ queues: realtime_prefetch, realtime_stream, enrichment_offhours, analytics_heavy, manual_on_demand.
2. Tách workers theo queue domains.
3. Gắn task routes + beat options + DB schedule sync.

Deliverables:
1. Compose/k8s worker topology mới.
2. Runbook scale per queue.

---

## Phase P2 — Multi-Provider Orchestration Hardening (1-2 tuần)

Mục tiêu:
1. Provider fallback thông minh theo channel.
2. Giảm timeout burst và parse errors.

Tasks:
1. Thêm provider quality score pipeline.
2. Thêm best-source resolver per channel/market phase.
3. Thêm provider decision metrics và audit.

Deliverables:
1. Provider routing policy docs.
2. Runtime config schema v2 cho provider strategy.

---

## Phase P3 — Manual Trigger Framework (1 tuần)

Mục tiêu:
1. Cho phép user/admin trigger jobs an toàn theo quota.

Tasks:
1. Xây API manual trigger với entitlement/priority gates.
2. Tạo queue manual_on_demand và cooldown controls.
3. Tạo UI admin history + retry controls.

Deliverables:
1. Manual job API + audit logs.
2. User-facing trạng thái tiến trình job.

---

## Phase P4 — Offhours Data Enrichment Pipeline (1-2 tuần)

Mục tiêu:
1. Tự động làm giàu dữ liệu ngoài giờ ở quy mô lớn.

Tasks:
1. Lập pipeline ingest ngoài giờ cho history/fundamentals/news/sentiment.
2. Chuẩn hóa + dedupe + upsert facts.
3. Materialize pre-open snapshots.

Deliverables:
1. Offhours scheduler policy.
2. Pre-open completeness report.

---

## Phase P5 — Soak, Load, and Cutover (1-2 tuần)

Mục tiêu:
1. Chứng minh đạt SLO với tải tương đương 10.000 users.

Tasks:
1. Chạy load test multi-queue + websocket fanout.
2. Chạy soak 72h với alert gates.
3. Tinh chỉnh resource và autoscaling.

Deliverables:
1. SLO attainment report.
2. Final cutover decision package.

---

## 3. Risk register

1. Queue misrouting do scheduler DB drift.
- Mitigation: drift checker chạy mỗi deploy + startup sync job.

2. Provider outage đồng thời.
- Mitigation: fallback tiers + stale-serve policy có gắn cờ.

3. Manual triggers gây nhiễu realtime.
- Mitigation: queue isolation + quota + priority scheduling.

4. Chi phí hạ tầng tăng nhanh.
- Mitigation: autoscale theo queue lag và downsample cold-path.

---

## 4. Validation gates

1. Gate G1: Queue isolation pass.
2. Gate G2: Provider failover pass.
3. Gate G3: Manual trigger governance pass.
4. Gate G4: Offhours completeness pass.
5. Gate G5: 10k-user SLO soak pass.

---

## 5. Discipline bắt buộc

1. Mỗi phase chia thành slices nhỏ, có evidence riêng.
2. Không merge khi thiếu traceability mapping.
3. Cập nhật audit ledger và progress dashboard sau từng slice.
