# Sprint 18 Detailed Plan — Django Admin Google Mail OAuth2 Token Management

**Ngay lap ke hoach**: 2026-04-04  
**Trang thai**: PLANNED  
**Muc tieu sprint**: Bo sung chuc nang quan tri tai khoan gui mail Google theo OAuth2 token (khong dung SMTP password), tich hop day du vao Django Admin va luong gui mail he thong.

---

## 1) Muc tieu kinh doanh va ky thuat

### Muc tieu kinh doanh
1. Admin co the quan ly tai khoan Google Workspace/Gmail de gui mail he thong an toan.
2. Giam rui ro bi khoa dang nhap do phu thuoc SMTP password/app-password.
3. Tang kha nang van hanh: test ket noi, theo doi token status, revoke khi can.

### Muc tieu ky thuat
1. Ho tro song song 2 co che: `smtp_password` (legacy) va `google_oauth2` (new).
2. Token duoc luu an toan (encrypted/signed), khong log plaintext.
3. Luong gui mail tu dong chon transport theo `SystemEmailAccount`.

---

## 2) Scope Sprint 18

### In-scope
1. Data model mo rong cho Google OAuth2 mail account.
2. OAuth connect/callback flow trong Django Admin.
3. Token refresh service + Gmail API send service.
4. Admin UI: connect/disconnect/revoke/test-email/token status.
5. Logging + audit + hardening co ban.
6. Test backend cho flow token va send mail.

### Out-of-scope
1. Generic OAuth provider khac ngoai Google.
2. Multi-tenant delegated domain-wide send-as phuc tap.
3. Frontend client cho user thuong (chi admin ops).

---

## 3) Kien truc de xuat

## 3.1 Data model (`SystemEmailAccount`)
Them cac truong:
- `auth_type`: `smtp_password | google_oauth2` (default `smtp_password`)
- `oauth_provider`: `google` (nullable cho SMTP)
- `google_client_id`
- `google_client_secret_ciphertext`
- `google_refresh_token_ciphertext`
- `google_token_scope`
- `google_account_email`
- `token_last_refreshed_at`
- `token_last_error`
- `oauth_connected_at`

Nguyen tac:
- Secret/token luu encrypted hoac signed (theo pattern hien co).
- Khong expose plaintext trong admin list/detail.

## 3.2 Service layer
- `google_oauth_service.py`
  - build authorize url
  - exchange auth code -> refresh token
  - refresh access token
- `gmail_service.py`
  - build MIME RFC822
  - call Gmail API `users.messages.send`
- Cap nhat `mail_service.py`
  - branch theo `auth_type`
  - fallback SMTP khi account legacy

## 3.3 Admin flow
1. Admin tao/chinh sua `SystemEmailAccount` voi `auth_type=google_oauth2`.
2. Bam `Connect Google` -> redirect consent.
3. Callback -> luu refresh token + metadata.
4. Bam `Send test email` -> gui qua Gmail API.
5. Bam `Revoke` -> xoa token local + revoke endpoint (neu available).

---

## 4) Work Breakdown theo giai doan

## Phase 0 — Discovery & Security Baseline (0.5-1 ngay)
**Muc tieu**: Chot OAuth config va guardrails.

Tasks:
1. Chot redirect URI cho dev/staging/prod.
2. Chot scope toi thieu: `https://www.googleapis.com/auth/gmail.send`.
3. Chot policy luu secret/token, masking va audit.
4. Chot feature flag rollout (`MAIL_GOOGLE_OAUTH_ENABLED`).

Deliverables:
1. Security checklist cho OAuth mail.
2. Env matrix cho 3 moi truong.

## Phase 1 — Schema & Migration (1 ngay)
**Muc tieu**: Mo rong schema nhung khong pha vo flow SMTP cu.

Tasks:
1. Migration them fields OAuth2 vao `SystemEmailAccount`.
2. Bo sung helper methods set/get encrypted token.
3. Them validation:
   - `google_oauth2` bat buoc client_id va client_secret.
   - `smtp_password` giu logic cu.

Acceptance phase:
1. Migration apply OK, khong tac dong du lieu cu.
2. SMTP account cu gui mail binh thuong.

## Phase 2 — OAuth Connect/Callback trong Admin (1.5-2 ngay)
**Muc tieu**: Hoan tat ket noi Google ngay trong Django Admin.

Tasks:
1. Them admin custom URLs:
   - connect
   - callback
   - revoke
2. Implement state/nonce chong CSRF cho OAuth callback.
3. Exchange code -> refresh token + luu metadata.
4. Hien status trong admin: connected/disconnected/error.

Acceptance phase:
1. Connect thanh cong va luu refresh token.
2. Loi callback hien message ro rang tren admin.

## Phase 3 — Gmail Send Transport Integration (1.5 ngay)
**Muc tieu**: Gui mail he thong qua Gmail API khi account OAuth2 active.

Tasks:
1. Implement refresh token flow truoc khi gui.
2. Tao Gmail send adapter (MIME + base64url encode).
3. Noi vao `send_system_email` va `send_test_email`.
4. Mapping loi Google API -> message van hanh de hieu.

Acceptance phase:
1. Test mail gui thanh cong qua OAuth2 account.
2. Token het han tu dong refresh va gui lai thanh cong.

## Phase 4 — Admin UX Hardening + Observability (1 ngay)
**Muc tieu**: Van hanh de dang, triage nhanh.

Tasks:
1. Admin fields/read-only badges:
   - token age
   - last refresh
   - last error
2. Action: `Send test email to current admin`.
3. Action: `Set default account` (giu hanh vi cu).
4. Structured logging + audit cho connect/revoke/send-fail.

Acceptance phase:
1. Admin co the tu xac dinh nguyen nhan fail ma khong can doc raw logs.

## Phase 5 — QA, Rollout, Runbook (1 ngay)
**Muc tieu**: Chot release an toan.

Tasks:
1. Test matrix:
   - smtp legacy
   - oauth connected
   - refresh fail
   - revoked token
2. Update runbook van hanh mail account.
3. Canary rollout tren 1 account default.
4. Monitoring sau release 24-48h.

Acceptance phase:
1. Khong regression flow email verification.
2. Co rollback ro rang ve smtp legacy.

---

## 5) Ke hoach thoi gian (de xuat 7 ngay cong)

Day 1: Phase 0 + Phase 1  
Day 2-3: Phase 2  
Day 4-5: Phase 3  
Day 6: Phase 4  
Day 7: Phase 5 + sign-off

---

## 6) RACI de xuat

- BE Lead: design schema, service integration, code review
- BE Dev: admin oauth flow + gmail transport + tests
- QA: integration test matrix + regression email flows
- DevOps: env vars, secret handling, rollout monitoring
- PM/BA: acceptance sign-off va runbook

---

## 7) KPI va Success Metrics

1. Ty le test mail thanh cong voi Google OAuth2 >= 98% tren moi truong test.
2. Thoi gian triage loi mail giam >= 40% (do co token status + last error).
3. Khong co regression tren luong gui email verification.
4. 100% secret/token duoc mask trong logs.

---

## 8) Risk register & Mitigation

1. OAuth consent/review chua xong:
- Mitigation: dung app internal/testing mode cho sprint dau.

2. Refresh token bi revoke:
- Mitigation: detect som, show admin warning, fallback account default.

3. Gioi han API quota:
- Mitigation: retry policy co backoff + alert khi vuot nguong.

4. Sai redirect URI theo moi truong:
- Mitigation: env-driven config + preflight check trong admin.

---

## 9) Deliverables cuoi Sprint 18

1. Migration + model cap nhat cho `SystemEmailAccount` OAuth2.
2. Admin connect/callback/revoke/test cho Google mail account.
3. Mail transport Gmail API tich hop voi `send_system_email`.
4. Test suite + checklist sign-off.
5. Runbook van hanh va rollback.
