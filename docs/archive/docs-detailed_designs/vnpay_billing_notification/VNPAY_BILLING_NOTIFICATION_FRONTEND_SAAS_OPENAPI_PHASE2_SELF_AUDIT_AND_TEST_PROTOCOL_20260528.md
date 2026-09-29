# Self Audit and Test Protocol — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Mandatory gate

---

## 1. Mục tiêu

Tài liệu này định nghĩa checklist tự kiểm toán và bộ kiểm thử tối thiểu mà đội code phải hoàn thành trước khi đóng bất kỳ slice nào của Phase 2.

---

## 2. Checklist A — Contract alignment

- [ ] Chỉ dùng các endpoint đã khóa trong tech spec.
- [ ] Không có commercial page nào gọi trực tiếp `/payments/vnpay-ipn/`.
- [ ] `payment-return` luôn gọi status endpoint trước khi hiển thị kết luận.
- [ ] Invoices consumer có posture pagination rõ ràng.
- [ ] Notification UI không được mở nếu backend notification contract chưa đủ OpenAPI metadata.

---

## 3. Checklist B — UX truthfulness

- [ ] `pending` không bị render như `success`.
- [ ] `failed` không bị che bằng wording mơ hồ.
- [ ] `missing txn_ref` có state riêng, không tự đoán giao dịch thành công.
- [ ] Error path hiển thị thông điệp rõ ràng cho người dùng, không dump raw JSON.
- [ ] Text mới qua i18n tiếng Việt đầy đủ dấu.

---

## 4. Checklist C — Security and architecture

- [ ] Không có `fetch()` trực tiếp trong commercial pages/components/hooks mới.
- [ ] Không import hoặc mount code mới từ `frontend/` hoặc `backend/` legacy root.
- [ ] Không hardcode `CORE_API_BASE_URL`, callback URL, merchant config, hoặc secret metadata trong page code.
- [ ] Không lưu `pay_url`, `txn_ref`, hoặc payment raw payload dài hạn trong localStorage/sessionStorage.
- [ ] Không reuse operator mail config surface cho user-facing notification preferences.

---

## 5. Checklist D — Automated test expectations

### Frontend mandatory
- [ ] Adapter tests cho `commercial.js`.
- [ ] Page tests cho `BillingCenterPage`.
- [ ] Page tests cho `PaymentReturnPage`.
- [ ] Error mapping tests cho `CoreApiRequestError` path.

### Backend contract verification khi có thay đổi backend đồng hành
- [ ] `commercial` endpoints vẫn pass tests.
- [ ] `identity_access` profile/preferences path không regress.

---

## 6. Execution commands

### Package Web
```powershell
npm --prefix packages/web test -- --runInBand
npm --prefix packages/web run build-community
```

### Core backend contract verification
```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" packages/core/backend/manage.py test commercial identity_access --keepdb
```

### Runtime smoke
```powershell
./start_dev.ps1
```

---

## 7. Manual verification scenarios

1. Billing Center tải thành công với tenant có subscription và invoices.
2. Billing Center empty state với tenant chưa có invoice.
3. Create payment thành công trả `pay_url` và redirect đúng 1 lần.
4. Payment Return với `txn_ref` hợp lệ hiển thị đúng `pending/success/failed` theo status endpoint.
5. Payment Return với `txn_ref` thiếu hoặc sai hiển thị `missing/not found` đúng state.
6. Auth hết hạn trong lúc load page được đưa về state re-auth rõ ràng.

---

## 8. Fail conditions block merge

1. Build-community fail.
2. Payment return không gọi status endpoint.
3. Notification route/user preferences được ship khi contract backend chưa sẵn sàng.
4. Direct fetch hoặc hardcoded callback/base URL còn tồn tại.
5. Governance docs không sync.