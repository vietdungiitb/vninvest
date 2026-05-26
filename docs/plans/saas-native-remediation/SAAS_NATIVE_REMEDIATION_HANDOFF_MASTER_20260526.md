# Handoff Master: SaaS Native Remediation (Login/Register & SOC Mail Config)

**Ngày bàn giao:** 2026-05-26
**Phạm vi:** packages/core (core-api), packages/web (React Shell)
**Mục tiêu:** Hoàn thiện SOC Mail Config UI, fix các lỗ hổng URL routing và đảm bảo Outbox idempotency.

## 1. Thành phần tài liệu trong Feature Pack
Đội phát triển (Dev) và đội Kiểm thử (QA) bắt buộc phải đọc và tuân thủ các tài liệu sau theo thứ tự:
1. **HANDOFF MASTER (Tài liệu này)**
2. **IMPLEMENTATION_PLAN_SAAS_NATIVE_REMEDIATION_20260526.md**
3. **TECH_SPEC_SAAS_NATIVE_REMEDIATION_20260526.md**
4. **TASKBOARD_SAAS_NATIVE_REMEDIATION_20260526.md**
5. **SAAS_NATIVE_REMEDIATION_TRACEABILITY_MATRIX_20260526.md**
6. **SAAS_NATIVE_REMEDIATION_SELF_AUDIT_AND_TEST_PROTOCOL_20260526.md**
7. **SAAS_NATIVE_REMEDIATION_EXECUTION_EVIDENCE_TEMPLATE_20260526.md**
8. **SAAS_NATIVE_REMEDIATION_CONFIG_OWNERSHIP_MATRIX_20260526.md**
9. **SAAS_NATIVE_REMEDIATION_CODE_QUALITY_CONSTITUTION_20260526.md**
10. **RUN_CODE_REVIEW_SAAS_NATIVE_REMEDIATION_20260526.md**
11. **RUN_INTEGRATION_TESTS_SAAS_NATIVE_REMEDIATION_20260526.md**
12. **RUN_SPEC_AUDIT_SAAS_NATIVE_REMEDIATION_20260526.md**

## 2. Hard Constraints (Bắt buộc tuân thủ)
- Tuyệt đối không đụng vào thư mục legacy `backend/` hoặc `frontend/`.
- Phải đảm bảo DB lock `select_for_update` cho mọi tác vụ nền.

## 3. Khởi động công việc
- **Backend dev**: Tập trung xử lý ngay blocker CRITICAL là khai báo URL routing cho `views_operator.py` vào `urls.py` và vá lỗ hổng idempotency `select_for_update(skip_locked=True)` trong worker xử lý outbox ở `data_ingest.tasks`.
- **Frontend dev**: Xây dựng UI `ShellMailConfigPage.js` và đấu nối routing.
