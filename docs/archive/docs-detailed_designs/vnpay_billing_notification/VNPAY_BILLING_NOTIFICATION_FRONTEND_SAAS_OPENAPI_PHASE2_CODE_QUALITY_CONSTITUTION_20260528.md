# Code Quality Constitution — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Mandatory

---

## 1. Chất lượng được định nghĩa như thế nào

1. Billing UI phải phản ánh đúng commercial truth từ server, không “ước đoán cho đẹp”.
2. Payment return không được tạo cảm giác thành công giả trước khi backend xác nhận.
3. Notification UX chỉ đạt chuẩn khi không nhầm lẫn operator infrastructure với user-facing preference/delivery truth.
4. Route, adapter, page, i18n và test phải tiến cùng nhau; không có chuyện code xong rồi “điền docs sau”.

---

## 2. Coverage targets

| Subsystem | Target | Why |
|---|---:|---|
| Commercial adapter | 95% risk coverage | Sai contract mapping sẽ phá toàn bộ UI state |
| Billing Center state model | 90% risk coverage | Đây là entry surface chính của self-service billing |
| Payment Return state machine | 95% risk coverage | Sai status semantics gây hiểu nhầm thanh toán nghiêm trọng |
| Route/page registry integration | 90% risk coverage | Route drift làm feature không mount đúng build target |
| Error envelope mapping | 95% risk coverage | Nếu render lỗi sai, người dùng và support sẽ xử lý nhầm |
| Notification contract gate | 95% risk coverage | Ship sớm notification UX sẽ tạo truth giả và drift contract |

---

## 3. Coverage theater prevention

Những thứ sau không được tính là đủ bằng chứng chất lượng:

1. Chỉ chứng minh `build-community` pass nhưng không test state machine payment return.
2. Chỉ test component render mà không assert `pending/success/failed/not_found` mapping.
3. Chỉ test create payment gọi được API mà không test double-submit guard.
4. Chỉ gắn text `Đã gửi email` trong UI mà không có server truth tương ứng.
5. Chỉ verify route mới tồn tại mà không verify route catalog + page registry đều đồng bộ.

---

## 4. Fitness-to-purpose scenarios

### Scenario Q1 — Browser tin `vnp_ResponseCode` thay vì status endpoint
Rủi ro: người dùng thấy thành công giả khi IPN/backend truth chưa cập nhật.

### Scenario Q2 — Invoice list full-fetch ở client
Rủi ro: route có vẻ hoạt động khi data ít nhưng vỡ hiệu năng khi tenant nhiều invoices.

### Scenario Q3 — Notification settings piggyback lên operator mail config
Rủi ro: UI user-facing lộ khái niệm hạ tầng nội bộ và tạo quyền ghi sai ownership.

### Scenario Q4 — Direct fetch bypass transport
Rủi ro: mất refresh-token flow, request_id, error normalization và base-url discipline.

### Scenario Q5 — Callback path drift giữa frontend và backend
Rủi ro: VNPay redirect về path không mount hoặc page sai state.

---

## 5. Hard rules

1. Không thêm feature mới vào `frontend/` root.
2. Không direct fetch từ commercial page/component.
3. Không trust query params làm truth cuối cho payment.
4. Không ship notification route nếu chưa có backend OpenAPI contract.
5. Không hardcode merchant/base URLs trong frontend.
6. Không bỏ qua i18n tiếng Việt đầy đủ dấu.

---

## 6. Mandatory gates

1. `npm --prefix packages/web test -- --runInBand`
2. `npm --prefix packages/web run build-community`
3. `git diff --check`
4. Grep checks cho direct fetch, legacy imports, hardcoded URLs
5. Sync `CODE_CHANGE_AUDIT_LEDGER.md`, `PROGRESS_DASHBOARD.md`, `MODIFIED_FILES_AUDIT_T12_PHASE_4_20250501.md`, `module_tree_full.md`