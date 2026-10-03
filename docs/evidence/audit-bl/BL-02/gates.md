# BL-02 gates — password + session/cookie fail-closed (2026-09-24)

## Change
- `settings.py`: `AUTH_PASSWORD_VALIDATORS` (similarity + min_length 10 + common + numeric, always on); prod block applies `prod_cookie_security_settings()` (secure-by-default, explicit insecure → `ImproperlyConfigured`); dev keeps `SESSION_COOKIE_AGE` default 2 weeks.
- `env_validation.py`: new testable `prod_cookie_security_settings(env)` + `_env_bool`.
- New `identity_access/tests/test_auth_security.py`: 9 tests.

## Deviation khỏi backlog (ghi rõ, an toàn hơn bản gốc)
- Backlog DoD-(1) viết "prod thiếu env → boot fail". Thực hiện: **secure-by-default + reject-explicit-insecure** (env examples/compose hiện tại chưa có 4 biến này — required-env sẽ làm prod sập boot sau deploy). Vẫn fail-closed, không fallback im lặng.

## Gates
- `manage.py test test_auth_security + test_register_upgrade + test_password_change + test_password_reset`: **Ran 46 OK** (9 mới + 37 cũ, validators không gây regression).
- Prod-mode boot (DEBUG=false, env mẫu): **check 0, exit 0** (secure defaults).
- Prod-mode + `DJANGO_SECURE_SSL_REDIRECT=false`: **ImproperlyConfigured "must be true in production", exit 1**.
- Set-Cookie flags: suy từ settings path đã verify (runtime header check thuộc BL-10 follow-up từ host có access).

## DoD tick
- [x] weak passwords rejected · [x] prod secure boot · [x] insecure override rejected · [x] 46 tests OK.
