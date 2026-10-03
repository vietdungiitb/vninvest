# Sprint 27 - GO/NO-GO Report (2026-04-08)

Date: 2026-04-08
Environment: staging
Owner: BE

## 1) Build and migration status

- manage.py makemigrations --check: PASS (No changes detected)
- manage.py check: PASS (System check identified no issues)
- migrate: PENDING STAGING EXECUTION

Notes:
- Migration files Sprint 27 da du: 0021 + 0022.

## 2) Functional checks

- Email/password signup trial assignment: PASS
- Google OAuth signup trial assignment: PASS
- Existing paid user preserved on OAuth login: PASS
- Expiry downgrade task behavior: PASS
- Admin override and audit logging: PASS

Notes:
- Evidence tu focused test suite trong backend.

## 3) Quality evidence

- Focused tests executed:
  - portfolio.tests.test_onboarding_trial_service
  - ApiRouteSmokeTests.test_register_endpoint_applies_active_onboarding_policy
  - ApiRouteSmokeTests.test_register_endpoint_respects_signup_trial_feature_flag
  - ApiRouteSmokeTests.test_google_oauth_endpoint_creates_user_and_applies_onboarding_policy
  - ApiRouteSmokeTests.test_google_oauth_endpoint_existing_user_no_reassignment
- Result summary:
  - Ran 9 tests in 4.834s
  - OK

Notes:
- Co warning OpenCore DPIPlan trong test setup, khong lam fail test Sprint 27.

## 4) Runtime observability

- onboarding_trial_assigned logs present: PENDING STAGING CHECK
- onboarding_trial_skipped logs present: PENDING STAGING CHECK
- onboarding_trial_downgraded logs present: PENDING STAGING CHECK
- onboarding_trial_expiry_summary/task_run logs present: PENDING STAGING CHECK

Notes:
- Logging points da implement trong onboarding service va celery task.

## 5) Rollback readiness

- Runbook available: docs/SPRINT27_ROLLBACK_RUNBOOK.md
- Flag-only containment verified: READY (runbook + flags available), PENDING LIVE STAGING DRILL

Notes:
- Flags: ONBOARDING_TRIAL_APPLY_ON_SIGNUP, ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED.

## 6) Risks and open points

- Risk 1: Chua co ket qua staging smoke runtime tren environment release candidate.
- Risk 2: OpenCore DPIPlan warning co the gay nhieu noise log neu khong co plan seed data.
- Open issue: Can QA/PM ky duyet GO/NO-GO sau khi chay checklist staging.

## 7) Final decision

- Decision: GO FOR STAGING SMOKE / PENDING FINAL PRODUCTION GO
- Approved by QA: ____
- Approved by BE: ____
- Approved by PM: ____
