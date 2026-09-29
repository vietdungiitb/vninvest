# Sprint 12 - Stack Handoff Ready (Starter Portfolios)

Date: 2026-04-08
Build/Commit: 1e830e3e
Status: ENGINEERING COMPLETE, WAITING MANUAL QA SIGN-OFF

## 1) What is completed

- S12-17 completed:
  - Starter provisioning service implemented.
  - Idempotent create behavior verified.

- S12-18 completed:
  - Register (email/password) integrated.
  - Google OAuth new-user flow integrated.
  - Fail-soft behavior in signup paths implemented.

- S12-19 completed:
  - Feature flags added:
    - `STARTER_PORTFOLIOS_ENABLED`
    - `STARTER_PORTFOLIOS_CANARY_PERCENT`
  - UserConfig tracking fields + migration implemented.
  - Backfill command implemented (`backfill_starter_portfolios`).

- S12-20 engineering part completed:
  - Browser QA checklist artifact prepared.
  - Sign-off report + GO/NO-GO templates prepared.
  - Fail-soft automated tests completed.

## 2) Final automated validation snapshot

Executed commands:
- `manage.py check`
- `manage.py test portfolio.tests.test_starter_portfolio_service portfolio.tests.test_backfill_starter_portfolios_command portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_creates_unverified_user_and_sends_verification_email portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_register_endpoint_fail_soft_when_starter_provisioning_fails portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_google_oauth_endpoint_fail_soft_when_starter_provisioning_fails -v 2`

Result:
- System check: PASS.
- Targeted suite: 12/12 PASS.

## 3) Manual gate still pending

- Browser QA execution (manual): pending.
- PM final GO/NO-GO decision: pending.

Use these artifacts:
- `docs/SPRINT12_BROWSER_QA_CHECKLIST_STARTER_PORTFOLIOS_20260408.md`
- `docs/SPRINT12_SIGNOFF_REPORT_STARTER_PORTFOLIOS_20260408.md`
- `docs/SPRINT12_SIGNOFF_DECISION_GO_TEMPLATE_20260408.md`
- `docs/SPRINT12_SIGNOFF_DECISION_NOGO_TEMPLATE_20260408.md`

## 4) Handoff to next stack (minimal checklist)

Before switching focus:
1. Assign QA owner and execute browser checklist.
2. Fill sign-off report and choose GO/NO-GO template.
3. If GO: start with canary 10%, monitor 24h.
4. If NO-GO: set `STARTER_PORTFOLIOS_ENABLED=False` and document blocker.

## 5) Operational quick commands

- Migrate:
  - `python manage.py migrate`

- Backfill dry-run single user:
  - `python manage.py backfill_starter_portfolios --username <username> --dry-run`

- Backfill actual single user:
  - `python manage.py backfill_starter_portfolios --username <username>`

- Backfill all (careful):
  - `python manage.py backfill_starter_portfolios --all --limit 200`

## 6) Owner map for closure

- QA closure: QA team
- Technical owner: Backend owner Sprint 12
- Final decision owner: PM
- Rollback owner: DevOps
