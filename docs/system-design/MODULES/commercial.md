# MODULES/commercial — Commercial

> Tin cậy tổng: ⚠ (luồng thanh toán đã thấy qua view + route). Ngày rà: 2026-10-14.

## 1. Mục đích + ranh giới

Thanh toán và gói: Stripe checkout/portal/webhook, VNPay create/IPN/status,
invoice, quota, subscription, trang pháp lý công khai. Không chạm lệnh chứng khoán
(đó là `user_workspace/broker`).

## 2. Models (6 — chi tiết ở `06.02`)

`Invoice`, `PaymentTransaction`, `QuotaHistory`, `QuotaRecord`, `Subscription`
(có tenant FK), `VNPayIPNLog` (không — log webhook thô, hợp lý).

## 3. API (10 route — chi tiết ở `07.02`)

`billing/*` + `payments/*` (`IsAuthenticated`, 3 route `RequiresTenantPermission`),
3 route AllowAny (2 webhook + legal-pages — webhook xác thực chữ ký riêng,
dossier cần xác minh cơ chế ký).

## 4. Job/signal

Có `commercial/tasks.py` + 6 beat (nhiều thứ hai). Không có file signal riêng.

## 5. Finding mở

- F-COM-01 (❓): cơ chế xác thực chữ ký webhook Stripe/VNPay chưa đọc.
- F-COM-02 (⚠): `RequiresTenantPermission` dùng ở đâu ngoài 3 route — rà ở dossier sâu.

## 6. Test khóa + trạng thái

`tests.py` (1 file — tồn tại đo được; phủ luồng thanh toán chưa rà).
