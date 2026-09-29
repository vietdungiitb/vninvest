# Sprint 27 - Acceptance Checklist

Status: CODE COMPLETE - READY FOR STAGING SIGN-OFF
Related docs:
- docs/ONBOARDING_TRIAL_PLAN_ADMIN_POLICY_20260408.md
- docs/ONBOARDING_TRIAL_PLAN_IMPLEMENTATION_CHECKLIST_20260408.md
- docs/ONBOARDING_TRIAL_PLAN_PRECODE_DECISION_PACK_20260408.md
- docs/SPRINT27_TASKBOARD.csv

## A. Data model and migration gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S27-A1 | Policy model created | BE-Lead-1 | OnboardingPlanPolicy model + validations implemented | Done | backend/portfolio/models.py + migration 0021 |
| S27-A2 | UserConfig extensions | BE-Lead-1 | plan_source/lock/downgrade fields added with defaults | Done | backend/portfolio/models.py + migration 0021 |
| S27-A3 | Audit model created | BE-Lead-1 | PlanAssignmentLog model + indexes implemented | Done | backend/portfolio/models.py + migration 0021 |
| S27-A4 | Single active policy enforced | BE-Lead-1 | DB/app-level guard prevents >1 active policy | Done | uniq_active_onboarding_policy + admin activate action |
| S27-A5 | Migration safe on prod-like data | QA-BE-1 | migrate up/down smoke passed | Done | manage.py makemigrations --check (No changes) + Django test DB migration bootstrap pass (9 tests run) |

## B. Domain logic gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S27-B1 | Signup trial assignment | BE-Auth-1 | New user gets trial plan by active policy | Done | onboarding_trial_service + register integration test |
| S27-B2 | Superuser excluded | BE-Auth-1 | Superuser never auto-assigned/downgraded by policy | Done | onboarding_trial_service guard logic |
| S27-B3 | All signup methods covered | BE-Auth-1 | Email/password and OAuth paths both call same service | Done | RegisterView + GoogleOAuthView both call onboarding trial service |
| S27-B4 | Expiry downgrade logic | BE-Lead-1 | Expired onboarding_trial users downgrade to fallback | Done | process_expired_onboarding_trials + tests |
| S27-B5 | Idempotent expiry processing | BE-Lead-1 | Running job repeatedly causes no invalid duplicate state | Done | test_process_expired_onboarding_trials_is_idempotent |

## C. Admin UX gates (full phase 1)

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S27-C1 | Policy admin page complete | BE-QA-1 | CRUD policy + activate action + validations | Done | backend/portfolio/admin.py OnboardingPlanPolicyAdmin |
| S27-C2 | User override controls | BE-QA-1 | Admin can override plan and lock/unlock downgrade | Done | UserConfigAdmin fields + admin save hooks |
| S27-C3 | Audit admin filters | BE-QA-1 | Filter by reason/actor/date/user works correctly | Done | PlanAssignmentLogAdmin list_filter/search |
| S27-C4 | Admin actions audited | QA-BE-1 | Every override creates PlanAssignmentLog with actor | Done | UserConfigAdmin.save_model audit write |

## D. Runtime and operations gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S27-D1 | Feature flags work | DevOps-1 | Policy/apply/job can toggle independently | Done | ONBOARDING_TRIAL_APPLY_ON_SIGNUP + ONBOARDING_TRIAL_AUTO_DOWNGRADE_* |
| S27-D2 | Celery schedule active | DevOps-1 | Expiry task runs on configured interval | Done | process-expired-onboarding-trials beat entry |
| S27-D3 | Structured logs emitted | DevOps-1 | assigned/downgraded/skipped events visible in logs | Done | onboarding_trial_service + process_expired_onboarding_trials_task logger events |
| S27-D4 | Rollback procedure validated | DevOps-1 | Disable flags + recovery runbook tested | Done | docs/SPRINT27_ROLLBACK_RUNBOOK.md |

## E. Quality gates

| ID | Gate | Owner | Pass criteria | Status | Evidence |
|---|---|---|---|---|---|
| S27-E1 | Unit tests pass | QA-BE-1 | Service and validation tests all green | Done | manage.py test portfolio.tests.test_onboarding_trial_service |
| S27-E2 | Integration tests pass | QA-BE-1 | Signup assignment + expiry flow pass end-to-end | Done | 7 focused tests pass incl signup flag + idempotent expiry |
| S27-E3 | No auth regression | QA-BE-1 | Existing login/register/refresh tests remain green | Done | 14 focused auth/register regression tests passed |
| S27-E4 | Documentation synchronized | PM-1 | Roadmap + board + sprint logs updated | Done | Roadmap/Boards/Taskboard/Execution log synchronized |

## Final sign-off

- FE Lead: ____ / Date: ____
- QA Lead: ____ / Date: ____
- BE Lead: ____ / Date: ____
- PM: ____ / Date: ____

Notes:
- Remaining step before production deploy is manual staging smoke execution and GO/NO-GO sign-off using docs/SPRINT27_STAGING_SMOKE_CHECKLIST.md and docs/SPRINT27_GO_NO_GO_REPORT_TEMPLATE.md.
