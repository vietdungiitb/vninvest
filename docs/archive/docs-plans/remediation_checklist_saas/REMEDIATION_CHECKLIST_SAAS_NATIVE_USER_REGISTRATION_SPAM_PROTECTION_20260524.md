# REMEDIATION CHECKLIST: SaaS Native User Registration Spam Protection
**Ma tai lieu**: `REMEDIATION_CHECKLIST_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524`
**Ngay lap**: 24-05-2026
**Trang thai**: CLOSED - RESOLVED & Hardened
**Nguon doi chieu**:
- `docs/plans/IMPLEMENTATION_PLAN_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md`
- `docs/plans/TECH_SPEC_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md`
- `docs/plans/TASKBOARD_SAAS_NATIVE_USER_REGISTRATION_SPAM_PROTECTION_20260524.md`
- Audit runtime ngay 24-05-2026

---

## 1) Muc tieu
Checklist nay chot cac khoang trong con thieu so voi bo tai lieu da phe duyet, de doi code co the sua theo thu tu rui ro va dong gate production.

---

## 2) Priority Backlog (Must-fix)

### R1 - Email verification token hardening (CRITICAL)
- Status: `[x]`
- Gap hien tai:
  - Token dang luu in-memory `_EMAIL_VERIFY_TOKENS`.
  - TTL dang 24h, chua hash DB, chua one-time revoke policy day du, chua lockout theo so lan sai.
- File can sua:
  - `packages/core/backend/src/identity_access/views_auth.py`
  - `packages/core/backend/src/identity_access/models.py` (tao model token verify neu can)
  - `packages/core/backend/src/identity_access/migrations/*`
- Yeu cau done:
  - Luu token hash (khong luu plaintext).
  - TTL = 30 phut (configurable).
  - One-time use + revoke token cu khi resend.
  - Gioi han so lan verify sai + lockout tam thoi.
- Test bat buoc:
  - Unit test token lifecycle: issue, expire, reuse, resend revoke, lockout.
  - Regression test verify-email API.

### R2 - Outbox runtime processor + consumer idempotency (CRITICAL)
- Status: `[x]`
- Gap hien tai:
  - Co ghi `OutboxEvent` khi register, nhung chua co worker runtime ro rang de xu ly pending events.
  - `ProcessedEvent` idempotency moi thay ro trong test mock, chua thay implementation consumer thuc.
- File can sua:
  - `packages/core/backend/src/data_ingest/tasks.py` (hoac module task outbox chuyen biet)
  - `packages/core/backend/src/user_workspace/**` (consumer)
  - `packages/core/backend/src/identity_access/models.py`
- Yeu cau done:
  - Co task `process_outbox_events` chay dinh ky, retry backoff + jitter.
  - Cap nhat `retry_count`, `last_error`, `processed_at` dung quy tac.
  - Idempotency thuc te bang `ProcessedEvent` trong consumer transaction.
- Test bat buoc:
  - Duplicate event khong tao duplicate resources.
  - Retry va DLQ behavior dung nguong.

### R3 - Anti-abuse multi-dimension (HIGH)
- Status: `[x]`
- Gap hien tai:
  - Register moi throttle theo IP.
- File can sua:
  - `packages/core/backend/src/identity_access/views_auth.py`
  - `packages/core/backend/src/vninvest_core/settings.py`
- Yeu cau done:
  - Throttle theo IP + email normalized + subnet.
  - Resend cooldown cho verify email.
  - Verify attempt threshold + lockout.
  - Tat ca nguong dua vao settings, co default va min/max.
- Test bat buoc:
  - Test doc lap cho tung dimension va truong hop ket hop.

### R4 - Envelope contract alignment all auth/operator endpoints (HIGH)
- Status: `[x]`
- Gap hien tai:
  - `register_view` success thieu timestamp/request_id.
  - `verify_email_view` va mot so operator response chua theo mot envelope duy nhat.
- File can sua:
  - `packages/core/backend/src/identity_access/views_auth.py`
  - `packages/core/backend/src/identity_access/views_operator.py`
  - `packages/core/backend/src/vninvest_core/exceptions.py` (neu can)
- Yeu cau done:
  - Success/Error thong nhat schema theo OpenAPI core.
  - Khong tra payload lech contract trong auth/operator APIs.
- Test bat buoc:
  - Cap nhat va pass bo test envelope consistency.
  - Khong fail do side-effect rate-limit giua cac test.

### R5 - Gmail mode reconciliation (HIGH)
- Status: `[x]`
- Gap hien tai:
  - Code dang thien ve Service Account DWD.
  - Tai lieu con mo ta them OAuth2 client/refresh token flow.
- Lua chon bat buoc (chot 1 trong 2):
  1. Implement them OAuth2 fields (`google_client_id`, `google_client_secret`, `google_refresh_token`) + runtime router day du.
  2. Chot DWD-only va cap nhat lai toan bo docs/spec/taskboard cho dong nhat.
- File can sua:
  - `packages/core/backend/src/identity_access/models.py`
  - `packages/core/backend/src/identity_access/views_operator.py`
  - `docs/plans/*.md` (neu chon DWD-only)
- Test bat buoc:
  - Operator create/test mail config tuong ung mode duoc chot.

### R6 - Error leakage hardening for operator APIs (MEDIUM)
- Status: `[x]`
- Gap hien tai:
  - Tra `str(e)` ve client trong mot so endpoint operator.
- File can sua:
  - `packages/core/backend/src/identity_access/views_operator.py`
- Yeu cau done:
  - Client chi nhan ma loi + thong diep an toan.
  - Chi tiet exception chi ghi log noi bo, da mask secret.
- Test bat buoc:
  - API failure test: khong lo stacktrace/secret.

### R7 - Turnstile strict enforcement flag parity with docs (MEDIUM)
- Status: `[x]`
- Gap hien tai:
  - Co production check, nhung chua ro `STRICT_TURNSTILE_ENFORCEMENT` behavior theo docs.
- File can sua:
  - `packages/core/backend/src/identity_access/apps.py`
  - `packages/core/backend/src/vninvest_core/settings.py`
- Yeu cau done:
  - Ho tro strict flag explicit.
  - Khong chan management commands trong CI/CD.
- Test bat buoc:
  - Runtime config test cho 4 mode: dev, test, staging, prod.

### R8 - Web integration scope closure (MEDIUM)
- Status: `[x]`
- Ghi chu: Da dong production integration o tang `packages/web` thong qua `coreApiAdapter` voi cac native methods `registerUser`, `resendVerificationEmail`, `verifyEmailToken` su dung `/api/auth/*`, bao gom payload anti-spam (`website`, `turnstile_token`) va parse envelope loi (`detail`, `code`, `field_errors`, `request_id`) cho auth UI thuc te.
- Gap hien tai:
  - Chua thay ro production auth UI integration; logic register turnstile/honeypot thay trong demo component.
- File can sua:
  - `packages/web/src/**` auth/register flow (thuc te, khong demo)
- Yeu cau done:
  - Form dang ky thuc te gui `website` va `turnstile_token`.
  - Render field_errors i18n tieng Viet day du dau.
- Test bat buoc:
  - FE integration test + happy path E2E.

### R9 - Operator mail-config API test coverage (MEDIUM)
- Status: `[x]`
- Gap hien tai:
  - Chua thay test cho list/detail/create/patch/delete/activate/test endpoints.
- File can sua:
  - `packages/core/backend/src/identity_access/tests/test_operator_mail_config.py` (tao moi)
- Yeu cau done:
  - Bao phu role permission, validation, unique active constraint, activate race scenario.

---

## 3) Execution Order (recommended)
1. R1 -> R2 -> R3 -> R4
2. R5 (quyet dinh mode) -> R6 -> R7
3. R9 -> R8
4. Chay full regression, cap nhat evidence template, ledger, progress dashboard.

---

## 4) Verification Commands (minimum)
```powershell
Set-Location "c:/Mujoco Projects/vninvest/packages/core/backend"
$env:DJANGO_DEBUG='true'
$env:DJANGO_ALLOWED_HOSTS='localhost,127.0.0.1'
$env:MAIL_CREDENTIAL_FERNET_KEY='<valid_fernet_key>'

# Focused auth upgrade tests
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test src.identity_access.tests.test_register_upgrade --keepdb --verbosity 2

# Envelope consistency
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test src.vninvest_core.tests.test_status_codes_and_errors.ErrorEnvelopeConsistencyTests --keepdb --verbosity 2

# Operator mail config tests (after adding)
& "c:/Mujoco Projects/vninvest/.venv/Scripts/python.exe" manage.py test src.identity_access.tests.test_operator_mail_config --keepdb --verbosity 2
```

---

## 5) Sign-off Gate
Tat ca muc R1-R5 phai `[x]` truoc khi xem xet production sign-off.
R6-R9 phai `[x]` truoc cutover full traffic.

---

## 6) Audit metadata
- Auditor: GitHub Copilot (GPT-5.3-Codex)
- Date: 24-05-2026
- Basis: Code inspection + focused test execution evidence
