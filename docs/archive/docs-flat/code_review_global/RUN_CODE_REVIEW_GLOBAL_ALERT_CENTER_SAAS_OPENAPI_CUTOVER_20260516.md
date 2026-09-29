# Run Code Review — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Bootstrap

Đọc trước khi review:

1. `quality/QUALITY.md`
2. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_HANDOFF_MASTER_20260516.md`
3. `docs/TECH_SPEC_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
4. `docs/IMPLEMENTATION_PLAN_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
5. `docs/TASKBOARD_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
6. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`
7. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CONFIG_OWNERSHIP_MATRIX_20260516.md`
8. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_CODE_QUALITY_CONSTITUTION_20260516.md`
9. `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_SELF_AUDIT_AND_TEST_PROTOCOL_20260516.md`

---

## 2. Review focus

### Foundation review
- Verify detection universe chỉ đọc từ global matrix.
- Verify không có module nào tự build monitored symbol set riêng.

### Planner review
- Verify `missing_only` là default.
- Verify `force_refresh` để lại audit trail.

### Alert fact review
- Verify browser không còn là source of truth.
- Verify taxonomy không trộn AI lane vào main feed mặc định.

### API review
- Verify request/response schema, error envelope, pagination, tenant isolation.
- Verify không thêm native business logic vào compat routes.

### Cutover review
- Verify không có tài liệu hoặc code path nào bỏ shadow/parity gate.

---

## 3. Grep checks hữu ích

```powershell
rg -n "price_shock|stale_quote" frontend/src packages/web/src packages/core/backend/src
rg -n "realtime/unified-alerts|realtime/whale-feed/aggregate" frontend/src packages/web/src
rg -n "coreApiAdapter|fetch\(" packages/web/src
rg -n "except: pass|except Exception: pass" packages/core/backend/src
```

---

## 4. Reject conditions

Reject ngay nếu phát hiện:

1. alert logic business ở browser
2. list API không pagination
3. route mới không có OpenAPI metadata
4. compat path trở thành canonical path mới
5. bất kỳ attempt nào hợp thức hóa no-soak/no-shadow cutover
