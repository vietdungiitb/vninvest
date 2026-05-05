# SFI-B2 Execution Evidence — Auth Native

**Phase**: B2 — Auth Native  
**Status**: ✅ COMPLETE  
**Timestamp**: 2026-05-04T23:25:00Z

---

## Slice Summary

| Slice | Description | Status |
|-------|-------------|--------|
| B2.1 | Email backend config in settings.py | ✅ |
| B2.2 | register_view in views_auth.py | ✅ |
| B2.3 | verify_email_view in views_auth.py | ✅ |
| B2.4 | password_reset_request_view + password_reset_confirm_view | ✅ |
| B2.5 | Routes in compat_urls.py | ✅ |
| B2.6 | scripts/migrate_users_to_core.py | ✅ |
| B2.7 | Smoke tests | ✅ |

---

## Spec Audit Results

| Check | Description | Result |
|-------|-------------|--------|
| SA-B2-01 | register view exists | ✅ PASS |
| SA-B2-02 | register route exists | ✅ PASS |
| SA-B2-03 | EMAIL_HOST config | ✅ PASS |
| SA-B2-04 | verify-email endpoint | ✅ PASS |
| SA-B2-05 | password-reset endpoints | ✅ PASS |
| SA-B2-06 | migration script exists | ✅ PASS |
| SA-B2-07 | no hardcoded passwords | ✅ PASS |

---

## Smoke Test Results

| Test | Endpoint | Expected | Actual | Result |
|------|----------|----------|--------|--------|
| B2-SMOKE-01 | POST /api/auth/register/ (new user) | 201 | 201 | ✅ PASS |
| B2-SMOKE-01b | POST /api/auth/register/ (duplicate) | 409 | 409 | ✅ PASS |
| B2-SMOKE-02 | POST /api/auth/password-reset/ | 200 | 200 | ✅ PASS |

---

## Files Modified

| File | Change |
|------|--------|
| `packages/core/backend/src/vninvest_core/settings.py` | Added EMAIL_BACKEND, EMAIL_HOST, EMAIL_PORT, EMAIL_USE_TLS, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD, DEFAULT_FROM_EMAIL |
| `packages/core/backend/src/identity_access/views_auth.py` | Added register_view, verify_email_view, password_reset_request_view, password_reset_confirm_view |
| `packages/core/backend/src/identity_access/compat_urls.py` | Added 4 new routes: register, verify-email, password-reset, password-reset/confirm |
| `scripts/migrate_users_to_core.py` | NEW — user migration script (psycopg2, dry-run support) |

---

## Security Notes

- Password enumeration prevention: `password_reset_request_view` always returns 200 regardless of whether email exists (OWASP A01).
- No hardcoded credentials: all email settings read from env vars.
- Password minimum length enforced: 8 characters (both register and reset confirm).
- Token-based email verification: random 32-byte URL-safe token, 24h TTL.
