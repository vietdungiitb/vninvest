# HANDOFF MASTER — SaaS Background Services Multi-Provider

**Ngày**: 2026-05-11  
**Trạng thái**: READY FOR DECISION  
**Phiên bản**: 1.0

---

## 1. Mục tiêu chương trình

Thiết kế và triển khai bộ background services đủ mạnh để:
1. Phục vụ quy mô SaaS 10.000 người dùng với dữ liệu thị trường có độ tươi cao.
2. Chạy song song nhiều provider qua vnbroker với cơ chế fallback, QoS và failover nhất quán.
3. Hỗ trợ 3 chế độ vận hành job: định kỳ, đột xuất (event-driven) và manual trigger bởi người dùng/admin.
4. Tự động thu thập và làm giàu dữ liệu ngoài giờ giao dịch để mở phiên với cache/facts đã sẵn sàng.

---

## 2. Căn cứ khảo sát hệ thống hiện tại

Các điểm khảo sát then chốt:
1. Runtime prefetch hiện có theo topology hot/warm/cold trong `backend/portfolio/tasks_prefetch.py`.
2. Runtime policy và prefetch time policy đang có SSOT cache-backed trong `backend/portfolio/runtime_policy_helpers.py`.
3. Tầng adapter vnbroker có fallback và chuẩn hóa canonical unit trong `backend/portfolio/adapters/vnbroker_adapter.py`.
4. Scheduler đang chạy qua django-celery-beat; có rủi ro drift queue runtime nếu DB periodic task không đồng bộ với code.
5. Core contract admin-ops đã có nền cho runtime config/policy trong `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py`.

Kết luận khảo sát:
1. Nền tảng kỹ thuật đã có 60-70% building blocks.
2. Thiếu kiến trúc orchestration đa provider ở mức SaaS production-grade.
3. Thiếu governance thống nhất cho periodic/event/manual job cùng SLA.

---

## 3. Bộ tài liệu bàn giao

### 3.1 Triad quyết định
1. `docs/IMPLEMENTATION_PLAN_SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_20260511.md`
2. `docs/TECH_SPEC_SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_20260511.md`
3. `docs/TASKBOARD_SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_20260511.md`

### 3.2 Tài liệu audit và execution
4. `docs/SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_HANDOFF_MASTER_20260511.md`
5. `docs/SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_TRACEABILITY_MATRIX_20260511.md`
6. `docs/SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_SELF_AUDIT_AND_TEST_PROTOCOL_20260511.md`
7. `docs/SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_EXECUTION_EVIDENCE_TEMPLATE_20260511.md`
8. `docs/SAAS_BACKGROUND_SERVICES_MULTI_PROVIDER_BUSINESS_CASE_20260511.md`

---

## 4. Phạm vi

In-scope:
1. Thiết kế background services architecture cho multi-provider market data.
2. Thiết kế queue topology tách tải realtime/prefetch/enrichment/analytics.
3. Thiết kế orchestration policy cho periodic, event-driven, manual run.
4. Thiết kế dữ liệu ngoài giờ: ingest, enrich, materialize, warm cache.
5. Định nghĩa SLO/SLA, observability và runbook vận hành.

Out-of-scope:
1. Viết lại toàn bộ business logic hiện có.
2. Refactor frontend ngoài các điểm cần thiết cho manual-trigger UX.
3. Thay thế framework nền (Django/Celery/Redis) trong phase đầu.

---

## 5. Nguyên tắc kiến trúc bắt buộc

1. Provider-agnostic: mọi call đi qua adapter contract thống nhất, không gọi provider trực tiếp từ service nghiệp vụ.
2. Facts-first serving: đường phục vụ chính ưu tiên cache/facts/materialized snapshots, không full-scan raw ở hot path.
3. Queue isolation: realtime path không dùng chung queue với heavy batch jobs.
4. Runtime policy as SSOT: policy universe, schedule, provider priority phải có owner và audit trail.
5. Multi-tenant fairness: manual jobs theo quota/priority theo tier khách hàng.

---

## 6. Exit criteria cho quyết định GO

1. Triad + taskboard được duyệt.
2. Tối thiểu 80% requirement có đường triển khai rõ và có evidence template.
3. Có lộ trình rollout theo phase với rollback rõ ràng.
4. Có SLO mục tiêu cho mốc 10.000 users và bộ đo lường đi kèm.

---

## 7. Thứ tự đọc đề xuất

1. Handoff master (file này)
2. Business case
3. Tech spec
4. Implementation plan
5. Taskboard
6. Traceability matrix
7. Self-audit and test protocol
8. Execution evidence template
