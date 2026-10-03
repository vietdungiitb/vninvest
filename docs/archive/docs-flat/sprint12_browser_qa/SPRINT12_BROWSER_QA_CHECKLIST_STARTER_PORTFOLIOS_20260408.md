# Sprint 12 - Browser QA Checklist (Starter Portfolios Provisioning)

Date: 2026-04-08
Scope: Signup/register + verify email + first login + starter portfolios auto-provisioning
Owner: QA + PM + BE
Estimated time: 15-20 minutes

## 1) Pre-check (2 min)

1. Ensure latest backend migration applied:
- `python manage.py migrate`

2. Verify feature flags:
- `STARTER_PORTFOLIOS_ENABLED=True`
- `STARTER_PORTFOLIOS_CANARY_PERCENT=100`

3. Open admin pages:
- `/admin/portfolio/userconfig/`
- `/admin/portfolio/portfolio/`
- `/admin/portfolio/subaccount/`

Expected:
- No migration error.
- Admin pages accessible.

## 2) Email/password signup path (5 min)

1. Open login/register UI.
2. Register with a fresh account:
- username: `qa_starter_user_01`
- email: `qa_starter_user_01@example.com`
- password/password_confirm: valid and matching

3. Confirm register response/UI message indicates email verification required.
4. In admin, find this user and verify:
- UserConfig exists
- `starter_portfolios_seeded=True`
- `starter_portfolios_seeded_at` is not null
- `starter_portfolios_template_version=v1`

5. In Portfolio admin, verify exactly 3 default portfolios created.
6. In SubAccount admin, verify total 9 subaccounts for this user.

Expected:
- Register succeeds.
- Starter data exists immediately after signup.

## 3) Verify email and first login (3 min)

1. Complete email verification for the test account (through verify endpoint/link flow).
2. Login with verified credentials.
3. Open portfolio screen.

Expected:
- Login succeeds only after verify.
- User can see starter portfolios without manual creation.

## 4) Google OAuth new-user path (3 min)

1. Execute Google OAuth signup with a new Google email.
2. Confirm API response: `created=True`.
3. Check admin for that user:
- 3 portfolios
- 9 subaccounts

Expected:
- New OAuth user also receives starter portfolios.

## 5) Existing user non-duplication (2 min)

1. Repeat login/signup action for an already seeded account (without force).
2. Recheck counts in admin.

Expected:
- No duplicate default portfolios/subaccounts.

## 6) Backfill command sanity (3 min)

1. Dry-run check:
- `python manage.py backfill_starter_portfolios --username qa_starter_user_01 --dry-run`
2. Real run for one user:
- `python manage.py backfill_starter_portfolios --username qa_starter_user_01`

Expected:
- Dry-run does not create data.
- Real run reports skip or no duplication for already seeded user.

## 7) Fail-soft sanity note (automation-backed)

Automated tests already cover fail-soft behavior:
- register succeeds when starter provisioning raises exception
- oauth signup succeeds when starter provisioning raises exception

Reference tests:
- `portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_fail_soft_when_starter_provisioning_fails`
- `portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails`

## 8) Sign-off block

- QA: PASS / FAIL
- PM: PASS / FAIL
- BE: PASS / FAIL
- Decision: GO / NO-GO
- Notes:
