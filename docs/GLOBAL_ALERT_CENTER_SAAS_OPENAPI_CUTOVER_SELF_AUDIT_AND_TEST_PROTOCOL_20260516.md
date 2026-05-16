# Self Audit and Test Protocol — Global Alert Center SaaS OpenAPI Cutover
**Ngày**: 2026-05-16

---

## 1. Mục tiêu audit

Đảm bảo alert-center mới đúng kiến trúc SaaS native, OpenAPI-first và không lệch khỏi `global symbol matrix` foundation.

---

## 2. Checklist self-audit bắt buộc

### A. Foundation correctness
- [ ] Detection universe đọc từ global matrix, không tự build riêng
- [ ] Demand source tách riêng khỏi registry row
- [ ] Coverage/freshness tách riêng khỏi run-state

### B. Planner correctness
- [ ] Planner là `missing-only` by default
- [ ] `force_refresh` có audit trail rõ ràng
- [ ] Session facts nằm trong execution path khi cần cho alert-center

### C. Alert fact correctness
- [ ] Whale/dark flow có canonical facts riêng
- [ ] Price shock/stale quote không còn do browser synthesize
- [ ] AI lane có canonical source riêng

### D. Delivery correctness
- [ ] User chỉ thấy alert relevant theo holding/watchlist/tracked/preferences
- [ ] Mute/snooze không xóa canonical event
- [ ] Tenant cross-access bị chặn

### E. OpenAPI correctness
- [ ] Request/response schema rõ ràng
- [ ] Pagination cho mọi list endpoint
- [ ] Error envelope đúng chuẩn
- [ ] Rate-limit/auth semantics được mô tả

### F. Cutover correctness
- [ ] Không thêm compat route business logic mới
- [ ] Không có direct legacy proxy mới cho alert-center
- [ ] Có shadow/parity evidence trước cutover
- [ ] Không có tài liệu hoặc code path hợp thức hóa việc bỏ shadow/soak gate

---

## 3. Test categories bắt buộc

1. Model/service tests cho matrix foundation
2. Coverage/planner tests cho `missing_only`, `force_refresh`, `coverage_ok`
3. Signal fact tests cho whale/dark/price shock/stale/AI signal
4. API tests cho alert-center family và AI lane family
5. Delivery tests cho mute/snooze/ack/cross-tenant
6. packages/web adapter/UI tests
7. Shadow/parity report cho cutover slice

---

## 4. Fail conditions

Block merge nếu có một trong các dấu hiệu sau:

- universe truth nằm ngoài global matrix
- browser là source of truth cho alert nghiệp vụ
- endpoint mới thiếu OpenAPI metadata hoặc pagination
- packages/web gọi direct fetch thay vì `coreApiAdapter`
- compat route mới chứa business logic mới
- bất kỳ tài liệu nào ghi đường chuẩn “skip soak/shadow validation”

---

## 5. D01 / D02 completion evidence

### A. Foundation correctness
- [x] Detection universe đọc từ global matrix, không tự build riêng
- [x] Demand source tách riêng khỏi registry row
- [x] Coverage/freshness tách riêng khỏi run-state

### B. Planner correctness
- [x] Planner là `missing-only` by default
- [x] `force_refresh` có audit trail rõ ràng
- [x] Session facts nằm trong execution path khi cần cho alert-center

### C. Alert fact correctness
- [x] Whale/dark flow có canonical facts riêng
- [x] Price shock/stale quote không còn do browser synthesize
- [x] AI lane có canonical source riêng

### D. Delivery correctness
- [x] User chỉ thấy alert relevant theo holding/watchlist/tracked/preferences
- [x] Mute/snooze không xóa canonical event
- [x] Tenant cross-access bị chặn

### E. OpenAPI correctness
- [x] Request/response schema rõ ràng
- [x] Pagination cho mọi list endpoint
- [x] Error envelope đúng chuẩn
- [x] Rate-limit/auth semantics được mô tả

### F. Cutover correctness
- [x] Không thêm compat route business logic mới
- [x] Không có direct legacy proxy mới cho alert-center
- [x] Có shadow/parity evidence trước cutover
- [x] Không có tài liệu hoặc code path hợp thức hóa việc bỏ shadow/soak gate

### G. Evidence links
- [x] `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_PARITY_SHADOW_EVIDENCE_20260516.md`
- [x] `docs/RUN_CODE_REVIEW_GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_20260516.md`
- [x] `docs/GLOBAL_ALERT_CENTER_SAAS_OPENAPI_CUTOVER_TRACEABILITY_MATRIX_20260516.md`
