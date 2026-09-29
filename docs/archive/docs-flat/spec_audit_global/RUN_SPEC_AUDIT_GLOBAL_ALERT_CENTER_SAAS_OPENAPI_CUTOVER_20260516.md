# Run Spec Audit — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Bootstrap

Đọc các file sau trước khi audit spec:

1. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`
2. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
3. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
4. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
5. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`

---

## 2. Audit questions

### Foundation
- Code có chứng minh matrix là foundation thật không?
- Có nơi nào còn giữ universe truth riêng không?

### Planner
- Planner có còn full-scan by default không?
- Coverage/freshness có đủ để support alert-center không?

### Canonical alerts
- Price shock/stale quote đã thành server truth chưa?
- AI lane có bị trộn với main feed không?

### Delivery
- Delivery projection có thật sự theo user scope không?
- Có cross-tenant or cross-user leakage risk không?

### OpenAPI
- Endpoint list có khớp spec không?
- Response/error/pagination có khớp spec không?

### Cutover
- Có tài liệu hoặc code path nào hợp thức hóa việc bỏ shadow/parity gate không?

---

## 3. Audit output format

1. Findings theo severity
2. Requirement ID bị fail
3. File/path evidence
4. Test/evidence còn thiếu
5. Recommendation ngắn gọn, actionable
