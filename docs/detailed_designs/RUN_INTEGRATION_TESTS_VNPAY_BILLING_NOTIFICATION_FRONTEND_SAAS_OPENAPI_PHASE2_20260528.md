# Run Integration Tests — VNPAY Billing Notification Frontend SaaS OpenAPI Phase 2
**Ngày**: 2026-05-28
**Trạng thái**: Mandatory runbook

---

## 1. Mục tiêu

Xác minh rằng commercial frontend phase 2 hoạt động đúng với current core API contracts và không làm vỡ packaging/runtime lane hiện có.

---

## 2. Automated commands

### Package Web tests
```powershell
npm --prefix packages/web test -- --runInBand
```

### Package Web packaging gate
```powershell
npm --prefix packages/web run build-community
```

### Core backend contract verification
```powershell
& "c:\Mujoco Projects\vninvest\backend\.venv\Scripts\python.exe" packages/core/backend/manage.py test commercial identity_access --keepdb
```

### Runtime refresh
```powershell
./start_dev.ps1
```

---

## 3. Manual journey tests

### JT-01 Billing Center happy path
1. Đăng nhập tenant có subscription active.
2. Mở `/commercial/billing`.
3. Verify summary strip, quota posture, invoice table hiển thị đúng.

### JT-02 Billing Center empty path
1. Dùng tenant chưa có invoices.
2. Verify empty state trung thực, không crash, không fake rows.

### JT-03 Payment create -> redirect
1. Từ invoice open hoặc CTA upgrade, bấm `Thanh toán ngay`.
2. Verify button disable trong khi request đang chạy.
3. Verify redirect đúng `pay_url` duy nhất 1 lần.

### JT-04 Payment Return pending/success/failure
1. Mở `/commercial/payment-return?txn_ref=...`.
2. Verify page gọi status endpoint.
3. Verify từng state đúng copy, tone, CTA.

### JT-05 Auth expiry
1. Mô phỏng access token hết hạn.
2. Verify transport refresh flow hoặc state re-auth rõ ràng.

---

## 4. Mandatory evidence

1. Output test command.
2. Output build-community.
3. Screenshots Billing Center + Payment Return.
4. Payload snapshots cho subscription, invoices, payment create, payment status.
5. Residual risk note nếu notification domain còn deferred.

---

## 5. Gate fail conditions

1. Automated tests fail.
2. Build-community fail.
3. Payment return không query status endpoint.
4. Billing route hoặc page registry mount sai.
5. Runtime smoke fail sau `./start_dev.ps1`.