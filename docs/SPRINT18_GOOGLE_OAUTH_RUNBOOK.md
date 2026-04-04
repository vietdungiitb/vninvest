# Sprint 18 Runbook — Google OAuth2 Mail Account in Django Admin

**Ngay cap nhat**: 2026-04-04  
**Pham vi**: Huong dan cau hinh Google OAuth2 de gui mail he thong qua Django Admin.

---

## 1) Muc tieu

- Cau hinh tai khoan Google de he thong gui mail bang OAuth2 token.
- Khong su dung SMTP password/app password cho flow moi.
- Van giu fallback SMTP legacy neu can.

---

## 2) Preconditions

1. Da migrate DB voi migration moi:
   - `python manage.py migrate`
2. User admin co quyen vao trang:
   - Django Admin -> `SystemEmailAccount`
3. Moi truong co internet de goi Google OAuth va Gmail API.

---

## 3) Cau hinh Google Cloud Console

## 3.1 Tao project
1. Vao Google Cloud Console.
2. Tao project moi (VD: `vninvest-mail-oauth`).

## 3.2 Enable APIs
1. Enable `Gmail API`.
2. Enable `Google OAuth2` endpoints (mac dinh co san).

## 3.3 OAuth consent screen
1. Chon User Type:
   - Internal (neu Google Workspace noi bo)
   - External (neu dung tai khoan ca nhan)
2. Dien app name, support email.
3. Them scope:
   - `https://www.googleapis.com/auth/gmail.send`
   - `openid`
   - `email`
4. Neu app dang test mode, add test users.

## 3.4 Tao OAuth Client ID
1. Credentials -> Create credentials -> OAuth client ID.
2. Application type: Web application.
3. Authorized redirect URI (quan trong):
   - Dev: `http://127.0.0.1:8000/admin/portfolio/systememailaccount/google/callback/`
   - Staging: `https://<staging-domain>/admin/portfolio/systememailaccount/google/callback/`
   - Prod: `https://<prod-domain>/admin/portfolio/systememailaccount/google/callback/`
4. Luu lai:
   - Client ID
   - Client Secret

---

## 4) Cau hinh trong Django Admin

1. Vao `SystemEmailAccount` -> Add.
2. Dien thong tin co ban:
   - `name`
   - `from_email`
   - `auth_type = google_oauth2`
   - `google_client_id`
   - `google_client_secret`
   - `google_token_scope` (co the de mac dinh)
3. Save record.
4. Bam `Connect Google`.
5. Dang nhap Google va chap nhan consent.
6. Sau callback thanh cong, kiem tra:
   - `Google Refresh Token: Da luu`
   - `oauth_connected_at` co gia tri
   - `google_account_email` duoc cap nhat
7. Bam action `Gui mail kiem tra`.

---

## 5) Verification checklist

- [ ] `last_test_status = success`
- [ ] `last_test_message` hien email nguoi nhan
- [ ] `token_last_refreshed_at` duoc cap nhat sau lan gui
- [ ] `token_last_error` rong
- [ ] Nhan duoc email test trong inbox

---

## 6) Troubleshooting

## 6.1 callback loi `redirect_uri_mismatch`
- Nguyen nhan: URI callback tren Google Cloud khong trung URI backend.
- Cach xu ly:
  1. Copy dung URL callback backend.
  2. Cap nhat lai trong OAuth client.

## 6.2 callback loi `invalid_client`
- Nguyen nhan: Client ID/Secret sai.
- Cach xu ly:
  1. Paste lai Client ID/Secret.
  2. Save account.
  3. Connect lai.

## 6.3 gui mail loi `invalid_grant`
- Nguyen nhan: refresh token het han/revoked.
- Cach xu ly:
  1. Bam `Revoke Token`.
  2. Connect Google lai de cap refresh token moi.

## 6.4 gui mail loi quota/rate limit
- Nguyen nhan: qua nguong Gmail API.
- Cach xu ly:
  1. Giam tan suat test.
  2. Theo doi quota trong Google Cloud Metrics.

---

## 7) Rollback plan

1. Vao account mac dinh:
   - doi `auth_type` ve `smtp_password`
   - dam bao SMTP password con hop le
2. Save va dat `is_default=true`.
3. Gui test mail de xac nhan fallback thanh cong.

---

## 8) Bao mat van hanh

1. Khong copy/paste refresh token vao chat/log.
2. Khong dump plaintext secrets trong bug report.
3. Khong cap quyen admin mail account cho user khong can thiet.
4. Khi nhan su roi team, revoke token va rotate client secret.

---

## 9) Smoke command

```bash
cd backend
python manage.py check
python manage.py test portfolio.tests.test_admin_mail_accounts
```

Neu can verify migration:

```bash
python manage.py migrate --plan
```

---

## 10) Canary rollout checklist

Tham chieu checklist staging canary chi tiet tai:
- `docs/SPRINT18_STAGING_CANARY_CHECKLIST.md`
