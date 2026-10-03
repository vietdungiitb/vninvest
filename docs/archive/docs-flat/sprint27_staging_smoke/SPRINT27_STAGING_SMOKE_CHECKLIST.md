# Sprint 27 - Staging Smoke Checklist (15-20 min)

Date: 2026-04-08
Scope: Onboarding trial policy (email/password + Google OAuth + expiry task + admin audit)

## 1) Pre-check (2 min)

1. Deploy latest code and run migrations.
2. Verify env flags:
- ONBOARDING_TRIAL_APPLY_ON_SIGNUP=True
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=True
- ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES=15 (or lower for staging)

3. Open admin pages:
- /admin/portfolio/onboardingplanpolicy/
- /admin/portfolio/userconfig/
- /admin/portfolio/planassignmentlog/

## 2) Policy setup (2 min)

1. Create or edit one active policy:
- trial_plan=pro
- trial_duration_days=7
- fallback_plan=basic
- is_active=True

2. Confirm only one policy active.

Expected:
- No validation error.
- List page shows one active policy.

## 3) Email/password signup flow (4 min)

1. POST /api/auth/register/ with new username/email.
2. Check response contains plan=pro.
3. Open admin UserConfig and confirm:
- plan=pro
- plan_source=onboarding_trial
- plan_expires_at is set

4. Check PlanAssignmentLog:
- reason=signup_trial exists for user.

Expected:
- Assignment applied and audited.

## 4) Google OAuth signup flow (4 min)

1. POST /api/auth/oauth/google/ with a valid Google access_token.
2. For a new Google email, confirm response:
- created=True
- access and refresh tokens present
- plan reflects trial policy

3. For an existing paid user, confirm:
- created=False
- existing paid plan is preserved

Expected:
- New user gets onboarding trial.
- Existing paid user is not downgraded/reassigned.

## 5) Expiry downgrade flow (4 min)

1. In admin, set one onboarding_trial user with:
- plan_expires_at in the past
- auto_downgrade_enabled=True
- plan_locked_by_admin=False

2. Trigger task manually or wait one beat interval:
- portfolio.tasks.process_expired_onboarding_trials_task

3. Verify:
- plan changed to fallback_plan (basic)
- plan_source=system_default
- downgraded_at set
- PlanAssignmentLog has reason=trial_expired

Expected:
- Eligible expired user downgraded exactly once.

## 6) Admin override + audit (2 min)

1. Edit UserConfig plan manually in admin.
2. Confirm PlanAssignmentLog auto-created with:
- reason=admin_override
- actor_type=admin
- actor_user set

Expected:
- Admin action leaves full audit trail.

## 7) Observability check (2 min)

Search logs for events:
- event=onboarding_trial_assigned
- event=onboarding_trial_skipped
- event=onboarding_trial_downgraded
- event=onboarding_trial_expiry_summary
- event=onboarding_trial_expiry_task_run

Expected:
- Events emitted with user_id and summary counters.

## 8) Rollback readiness (1 min)

1. Review runbook: docs/SPRINT27_ROLLBACK_RUNBOOK.md
2. Verify flag-only containment path is available.

Expected:
- Team can disable onboarding assignment/expiry without schema rollback.

## 9) Sign-off

- QA: PASS/FAIL
- BE: PASS/FAIL
- PM: PASS/FAIL
- Decision: GO / NO-GO
