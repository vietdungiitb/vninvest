# Sprint 12 - Sign-off Report (Starter Portfolios Provisioning)

Date: 2026-04-08
Scope: S12-17, S12-18, S12-19, S12-20
Release window: Pending QA GO/NO-GO
Environment: Staging/Internal test
Build/Commit: 1e830e3e

## 1) Change summary

- Auto-provision starter portfolios after signup completed.
- Coverage includes:
  - Email/password signup path
  - Google OAuth signup path for newly created users
- Idempotent create behavior implemented (no duplicate default data on retry).
- Fail-soft behavior implemented (provisioning errors do not block signup).
- Backfill command implemented for existing users.

## 2) Implemented items status

- [x] S12-17: Starter portfolio service
- [x] S12-18: Signup integration hooks
- [x] S12-19: Feature flags + UserConfig tracking + backfill command
- [~] S12-20: Browser QA + PM sign-off (manual, in progress)

## 3) Technical evidence

Automated tests (executed):
- `manage.py test portfolio.tests.test_starter_portfolio_service -v 2`
- `manage.py test portfolio.tests.test_backfill_starter_portfolios_command -v 2`
- `manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_creates_unverified_user_and_sends_verification_email portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy -v 2`
- `manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_fail_soft_when_starter_provisioning_fails portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails -v 2`

Result summary:
- Service + command + integration + fail-soft targeted tests: PASS.

Execution note:
- Automated coverage complete.
- Remaining gate is manual browser QA execution and signatures.

## 4) Browser QA checklist execution

Checklist artifact:
- `docs/SPRINT12_BROWSER_QA_CHECKLIST_STARTER_PORTFOLIOS_20260408.md`

Execution owner: QA team (pending assignment)
Execution date/time: Pending

Mandatory manual checks:
- [ ] Register (email/password) creates starter portfolios/subaccounts.
- [ ] Verify email -> login flow works as expected.
- [ ] New Google OAuth user receives starter portfolios.
- [ ] Existing seeded user does not get duplicate default data.
- [ ] Backfill dry-run and actual run behave correctly.

## 5) Risk and rollback

Residual risk:
- Browser runtime regression not fully closed until manual QA sign-off.

Containment/rollback levers:
- Feature flag OFF: `STARTER_PORTFOLIOS_ENABLED=False`
- Canary reduce: `STARTER_PORTFOLIOS_CANARY_PERCENT=0`

Backfill safety:
- Use `--dry-run` before `--all` in production-like environments.

## 6) Go/No-Go decision

Decision templates:
- GO template: `docs/SPRINT12_SIGNOFF_DECISION_GO_TEMPLATE_20260408.md`
- NO-GO template: `docs/SPRINT12_SIGNOFF_DECISION_NOGO_TEMPLATE_20260408.md`

- QA decision: PENDING
- BE decision: PASS (automation)
- PM decision: PENDING
- Final decision: PENDING

Decision notes:

Automation tests passed for S12-17/18/19 and fail-soft branch of S12-20.
Pending manual browser QA checklist execution before final GO.

________________________________________________________________
________________________________________________________________

## 7) Signatures

- QA: ____________________  Date: __________
- BE Lead: ____________________  Date: __________
- PM: ____________________  Date: __________
- Ops/Release: ____________________  Date: __________
