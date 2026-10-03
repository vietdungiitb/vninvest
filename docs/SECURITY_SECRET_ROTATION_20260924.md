# Secret Rotation Runbook (BL-17) — 2026-09-24

## Phạm vi & tần suất
Hàng quý (hoặc ngay khi nghi lộ): `DJANGO_SECRET_KEY`, `CORE_PAT_PEPPER`, `CORE_DB_PASSWORD`, `STRIPE_WEBHOOK_SECRET`, `MAIL_CREDENTIAL_FERNET_KEY`, `VNBROKER_GITHUB_TOKEN`, `TURNSTILE_SECRET_KEY`.

## Quy trình chung
1. Tạo giá trị mới (vd `python -c "import secrets; print(secrets.token_urlsafe(50))"`), lưu vào secret store/portainer env — KHÔNG commit.
2. Canary 1 container → smoke (login, 1 API authed, worker job) → roll toàn bộ.
3. Xác nhận log không còn auth-fail spike 15 phút.

## Ma trận impact (bắt buộc đọc trước khi xoay)

| Secret | Xoay xong ảnh hưởng gì | Cửa sổ |
|---|---|---|
| `DJANGO_SECRET_KEY` | Mọi session/CSRF/password-reset token cũ chết → toàn bộ user phải login lại | Maintenance window + thông báo trước |
| `CORE_PAT_PEPPER` | Mọi PAT hash cũ vô hiệu → reissue PAT cho service accounts + user (danh sách trong TenantAdmin PATs) | Window + reissue runbook |
| `CORE_DB_PASSWORD` | Phải đổi đồng thời: PG role + mọi compose env + pgbouncer `POSTGRESQL_PASSWORD`; restart db → pooler → api/workers theo thứ tự | Window, giữ old password 1h rollback |
| `STRIPE_WEBHOOK_SECRET` | Đổi ở Stripe dashboard trước, deploy sau (khe 5 phút nhận song song nếu Stripe hỗ trợ 2 secret) | Ngoài giờ billing batch |
| `MAIL_CREDENTIAL_FERNET_KEY` | Credential mail mã hóa cũ không giải được → re-save trong TenantAdmin mail config | Giờ thấp điểm |
| `VNBROKER_GITHUB_TOKEN` | Chỉ ảnh hưởng build image (không runtime) → rotate + rebuild thử 1 image | Bất cứ lúc nào |

## MFA — verdict BL-17 (verify 2026-09-24)
Grep `totp|hotp|pyotp|qrcode|two-factor|2fa|backup-codes|webauthn|passkey` = **0 hit** BE + FE → MFA chưa tồn tại.
Quyết định: accepted-risk ngắn hạn (đã có rate-limit + Turnstile + validators BL-02); roadmap: TOTP staff/admin trước (pyotp + QR enroll + backup codes), rồi opt-in user. Không implement trong P1 (cần quyết định product + UX enroll flow).
