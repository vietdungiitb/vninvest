# HANDOFF MASTER — SaaS Services Recovery

**Ngày**: 2026-05-11  
**Trạng thái**: READY FOR TEAM EXECUTION  
**Phiên bản**: 1.0

---

## 1. Mục tiêu

Khôi phục toàn bộ services theo kiến trúc SaaS mới để hệ thống đạt trạng thái vận hành ổn định, có thể audit, có thể rollback và có thể bàn giao cho team code triển khai theo slices nhỏ.

Kết quả bắt buộc:
1. Core stack chạy đầy đủ: `core-db`, `core-redis`, `core-api`, `core-worker`, `core-beat`, `frontend`.
2. Tất cả background jobs trọng yếu chạy ổn định theo scheduler/queue chuẩn.
3. Không còn phụ thuộc legacy runtime trong đường chạy chính.
4. Có bộ evidence đầy đủ để sign-off kỹ thuật và vận hành.

---

## 2. Bộ tài liệu bàn giao

### 2.1 Triad bắt buộc
1. `docs/IMPLEMENTATION_PLAN_SAAS_SERVICES_RECOVERY_20260511.md`
2. `docs/TECH_SPEC_SAAS_SERVICES_RECOVERY_20260511.md`
3. `docs/TASKBOARD_SAAS_SERVICES_RECOVERY_20260511.md`

### 2.2 Tài liệu audit và điều phối
4. `docs/SAAS_SERVICES_RECOVERY_HANDOFF_MASTER_20260511.md` (file này)
5. `docs/SAAS_SERVICES_RECOVERY_TRACEABILITY_MATRIX_20260511.md`
6. `docs/SAAS_SERVICES_RECOVERY_SELF_AUDIT_AND_TEST_PROTOCOL_20260511.md`
7. `docs/SAAS_SERVICES_RECOVERY_EXECUTION_EVIDENCE_TEMPLATE_20260511.md`
8. `docs/SAAS_SERVICES_RECOVERY_CONFIG_OWNERSHIP_MATRIX_20260511.md`
9. `docs/SAAS_SERVICES_RECOVERY_CODE_QUALITY_CONSTITUTION_20260511.md`
10. `docs/RUN_CODE_REVIEW_SAAS_SERVICES_RECOVERY_20260511.md`
11. `docs/RUN_INTEGRATION_TESTS_SAAS_SERVICES_RECOVERY_20260511.md`
12. `docs/RUN_SPEC_AUDIT_SAAS_SERVICES_RECOVERY_20260511.md`
13. `docs/RUNBOOK_SAAS_SERVICES_RECOVERY_20260511.md`

---

## 3. Phạm vi recovery

In-scope:
1. Recovery cho dev stack và production path của SaaS core services.
2. Recovery cho queue, scheduler, worker lifecycle.
3. Recovery cho health, observability, smoke endpoints, data path checks.
4. Recovery governance: freeze window, rollback, evidence collection.

Out-of-scope:
1. Refactor business logic mới ngoài mục tiêu recovery.
2. Mở rộng feature product mới.
3. Migration domain lớn chưa có trong taskboard recovery.

---

## 4. Pha thực thi chuẩn

1. **R0 — Stabilization Gate**: freeze thay đổi + chụp hiện trạng.
2. **R1 — Data Plane Recovery**: khôi phục DB/Redis và kết nối nền.
3. **R2 — Core Runtime Recovery**: đưa core-api/worker/beat về healthy.
4. **R3 — Background Services Recovery**: xác nhận tasks/schedule/queue.
5. **R4 — SaaS-Only Runtime Gate**: loại bỏ đường chạy legacy trong runtime chính.
6. **R5 — Soak & Hardening**: chạy ổn định 24-72h với SLO gate.
7. **R6 — Sign-off & Handover**: hoàn tất audit ledger, progress, evidence.

---

## 5. Quy tắc vận hành bắt buộc

1. Mỗi slice là một commit độc lập, có evidence đi kèm.
2. Không đánh dấu `DONE` khi chưa có test result và runtime health chứng minh.
3. Sau mỗi thay đổi có tác động runtime/UI phải rebuild hoặc restart stack liên quan.
4. Mọi thay đổi phải cập nhật:
   - `docs/CODE_CHANGE_AUDIT_LEDGER.md`
   - `PROGRESS_DASHBOARD.md`
5. Nếu gặp risk ngoài scope slice, mở issue/risk note, không tự ý mở rộng sửa.

---

## 6. Exit criteria toàn chương trình

1. Core services đạt health ổn định liên tục >= 24h.
2. Background jobs trọng yếu không có lỗi `unregistered task`, `queue stalled`, `broker unavailable`.
3. SLO tối thiểu pass:
   - API availability >= 99.5% trong cửa sổ soak
   - Queue latency p95 trong ngưỡng cho phép theo tech spec
4. Legacy runtime không còn là đường phục vụ chính.
5. Toàn bộ tài liệu evidence, traceability, test logs đã đầy đủ và sign-off.

---

## 7. Thứ tự đọc cho team code

1. File này (`HANDOFF MASTER`)
2. `IMPLEMENTATION PLAN`
3. `TASKBOARD`
4. `TECH SPEC`
5. `SELF AUDIT AND TEST PROTOCOL`
6. `RUNBOOK`
7. Bộ 3 tài liệu vận hành: `RUN_CODE_REVIEW`, `RUN_INTEGRATION_TESTS`, `RUN_SPEC_AUDIT`

---

## 8. Anchor runtime files

1. `docker-compose.dev.yml`
2. `docker-compose.yml`
3. `docker-compose.prod.yml`
4. `packages/core/backend/src/vninvest_core/settings.py`
5. `packages/core/backend/src/vninvest_core/urls.py`
6. `packages/core/backend/src/**` (market_serving, signal_intelligence, user_workspace, ops_audit)
7. `frontend/docker/nginx.conf`

---

## 9. Trình tự bàn giao sau khi tài liệu đã approved

1. Tech Lead duyệt triad + taskboard.
2. Backend Lead nhận R0-R3.
3. DevOps nhận R1, R4, R5 infra checks.
4. QA nhận R5 soak validation và R6 evidence review.
5. PM/Owner nhận sign-off cuối cùng theo checklist trong protocol.
