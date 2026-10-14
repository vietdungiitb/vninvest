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

- ~~F-COM-01 (❓): cơ chế xác thực chữ ký webhook Stripe/VNPay chưa đọc~~ —
  ✅ ĐÃ XÁC MINH slice sysdesign-p15, cơ chế ĐỦ:
  Stripe thiếu header → 400 (`stripe_webhooks.py:73-78`), sai chữ ký → 400
  (`:83-88`, verify bằng SDK ở `stripe_service.py:145-159`), chỉ event đã
  verify mới xử lý (`:90+`); VNPay HMAC-SHA512 `compare_digest`
  (`vnpay_service.py:96-133`, fail-closed khi secret demo), sai → RspCode 97
  không đổi state (`views.py:284-287`), kèm khóa atomic + check finalized +
  validate amount (`:291-303`).
- F-COM-01b (✅ ĐÃ ĐÓNG slice sysdesign-p16): 2 test mới trong
  `commercial/tests.py` (`StripeWebhookSignatureTestCase`: thiếu header → 400,
  chữ ký sai → 400 + verify gọi đúng 1 lần) — chạy local 16/16 OK. Phát hiện khi
  viết test: singleton `stripe_service` đọc settings lúc import nên trong test
  luôn unconfigured (503) — phải mock `is_configured` như test hiện có
  (`stripe_service.py:27-37`).
- F-COM-02 (⚠): `RequiresTenantPermission` dùng ở đâu ngoài 3 route — rà ở dossier sâu.

## 6. Test khóa + trạng thái

`tests.py` (1 file — tồn tại đo được; phủ luồng thanh toán chưa rà).
