# Sprint 18 Staging Canary Checklist — Google OAuth2 Mail

**Ngay cap nhat**: 2026-04-04  
**Muc tieu**: Rollout canary cho Google OAuth2 mail account tren staging voi rui ro thap va rollback nhanh.

---

## 1) Preconditions

- [ ] Da apply migration moi tren staging (`0014`, `0015`).
- [ ] Co superuser staging de vao Django Admin.
- [ ] Da tao OAuth client cho staging redirect URI.
- [ ] Da enable Gmail API tren Google Cloud project.
- [ ] Da co SMTP fallback account con hoat dong.

---

## 2) Canary Scope

- [ ] Canary chi dung cho **1 account default**.
- [ ] Canary chi gui cho **nhom email noi bo** (ops/dev).
- [ ] Chua bat cho flow broadcast hoac campaign lon.
- [ ] Dat khung theo doi toi thieu 24 gio.

---

## 3) Step-by-step Rollout

## Step A — Prepare OAuth account
- [ ] Tao `SystemEmailAccount` moi, `auth_type=google_oauth2`.
- [ ] Dien `google_client_id`, `google_client_secret`.
- [ ] Save account.
- [ ] Bam `Connect Google` va consent thanh cong.
- [ ] Xac nhan `Google Refresh Token: Da luu`.

## Step B — Functional smoke
- [ ] Gui `send_test_email` toi email admin dang login.
- [ ] Xac nhan inbox nhan duoc email.
- [ ] Xac nhan `last_test_status=success`.
- [ ] Xac nhan `token_last_error` rong.

## Step C — Switch default
- [ ] Dat account Google OAuth2 la default.
- [ ] Trigger 2-3 flow gui mail he thong:
  - [ ] verification email
  - [ ] resend verification
  - [ ] test action tu admin
- [ ] Xac nhan tat ca thanh cong.

## Step D — Observe
- [ ] Theo doi 24h:
  - [ ] so luong loi 401/403/429
  - [ ] so luong fail refresh token
  - [ ] ti le gui thanh cong
- [ ] Neu co 401/invalid_grant lap lai > 2 lan -> rollback ngay.

---

## 4) Exit Criteria

- [ ] Ti le gui mail thanh cong >= 98% trong cua so canary.
- [ ] Khong co regression o flow email verification.
- [ ] Khong co P0/P1 incident lien quan mail.
- [ ] Ops xac nhan triage duoc loi qua `token_last_error`.

---

## 5) Rollback Procedure (<= 5 phut)

1. Vao Django Admin -> `SystemEmailAccount`.
2. Chon SMTP fallback account.
3. Set `is_default=true`, `is_active=true`.
4. Gui test mail xac nhan fallback.
5. Voi account OAuth2:
   - bam `Revoke Token`
   - giu `is_active=false` tam thoi
6. Ghi nhan incident + root cause trong log sprint.

---

## 6) Post-canary Tasks

- [ ] Cap nhat `SPRINT18_ACCEPTANCE_CHECKLIST.md`.
- [ ] Cap nhat `SPRINT_EXECUTION_LOG.md` voi metric canary.
- [ ] Neu pass: mo rong rollout production theo wave 1.
- [ ] Neu fail: giu SMTP default, triage va lap hotfix.
