# RUN INTEGRATION TESTS - SAAS NATIVE PACKAGES WEB AUTH CUTOVER

## 1) Backend suites (core auth)

1. packages/core/backend:
   - manage.py test src.identity_access.tests.test_login_upgrade --keepdb
   - manage.py test src.identity_access.tests.test_register_upgrade --keepdb

## 2) Frontend suites (packages/web)

1. adapter auth tests
2. auth pages component tests
3. route integration tests for /login /register /verify-email /reset-password

## 3) End-to-end smoke

1. register -> verify -> login -> refresh -> logout
2. invalid credentials path
3. unverified account + resend path

## 4) Runtime mandatory gate

1. Run `./start_dev.ps1` from repo root.
2. Verify `Core API health: OK` and `Frontend health: OK`.

## 5) Fail gate

1. Any auth route 500 error.
2. Any redirect loop.
3. Any missing Vietnamese i18n key on auth pages.
