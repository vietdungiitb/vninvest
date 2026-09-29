# Checklist Slice Execution — Global Alert Center SaaS OpenAPI Cutover

Ngày: 2026-05-16
Cách dùng: mỗi slice copy 1 block checklist, tick đầy đủ trước khi chuyển QA/review.

---

## Slice Metadata

- Slice ID:
- Owner:
- Branch:
- PR:
- Related requirements: GAC-xx

---

## Checklist bắt buộc cho mọi slice

### A. Scope control
- [ ] Đã xác nhận scope in/out theo GUIDE_CODE_BY_SLICE
- [ ] Không sửa file ngoài File Map nếu chưa có approval
- [ ] Không thêm compat route business logic mới

### B. Architecture guardrails
- [ ] Không có browser-side synthesis cho alert nghiệp vụ
- [ ] Không có writer song song ngoài SSOT
- [ ] Không bypass shadow/parity/soak gates

### C. Contract guardrails
- [ ] List endpoint có pagination
- [ ] Error envelope chuẩn (detail/code/timestamp/request_id/field_errors)
- [ ] Auth/rate-limit semantics được khai báo đúng
- [ ] Tenant isolation có test

### D. Implementation evidence
- [ ] Danh sách file đổi đã ghi rõ
- [ ] Validation commands đã chạy
- [ ] Payload snapshots đã lưu
- [ ] Residual risks đã ghi

### E. Runtime and regression
- [ ] Focused tests của slice pass
- [ ] Regression suites liên quan pass
- [ ] start_dev smoke pass (nếu slice chạm runtime/UI)

---

## Per-slice completion checklist

### F01/F02/F03
- [ ] Matrix/demand/ops invariants pass
- [ ] Không còn universe truth ngoài registry boundary

### A01/A02/A03
- [ ] missing_only default đúng
- [ ] force_refresh có audit trail
- [ ] session_facts có execution path

### B01/B02/B03
- [ ] Taxonomy family chuẩn hóa đúng lane
- [ ] Producer path server-side đầy đủ
- [ ] Endpoint family native đủ theo spec

### C01/C02
- [ ] Delivery state machine hoạt động đúng
- [ ] packages/web gọi qua coreApiAdapter, không direct fetch business APIs

### D01/D02
- [ ] Frontend bridge native-only
- [ ] Có shadow/parity/rollback evidence trước sunset

---

## Gate quyết định merge

- [ ] PASS toàn bộ checklist
- [ ] Không có fail condition trong self-audit protocol
- [ ] Traceability matrix đã cập nhật trạng thái requirement
