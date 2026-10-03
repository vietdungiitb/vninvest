# Sprint 27 Rollback Runbook

Date: 2026-04-08
Scope: Onboarding trial policy (signup assignment + expiry downgrade)

## 1. Trigger conditions

Run rollback when one of these occurs:
- Unexpected mass downgrade of users.
- New signup receives wrong plan against active policy.
- Celery expiry job produces abnormal error rate.
- Admin override flow creates incorrect plan transitions.

## 2. Immediate containment (P0)

1. Disable signup assignment:
- Set ONBOARDING_TRIAL_APPLY_ON_SIGNUP=False

2. Disable expiry auto-downgrade:
- Set ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=False

3. Redeploy backend + celery worker + celery beat with updated env.

4. Verify containment:
- No new logs with event=onboarding_trial_assigned
- No new logs with event=onboarding_trial_downgraded

## 3. Data impact assessment

1. Identify impacted window:
- T0 = time feature enabled
- T1 = time rollback activated

2. Query audit logs:
- PlanAssignmentLog where reason in (signup_trial, trial_expired)
- created_at between T0 and T1

3. Build impacted user list:
- user_id
- old_plan
- new_plan
- old_expires_at
- new_expires_at
- reason

## 4. Recovery strategy

Preferred recovery source: PlanAssignmentLog records.

1. For each impacted user:
- If rollback target is pre-change state, restore old_plan and old_expires_at.
- Set plan_source to system_default unless business decides paid/manual_admin.

2. Preserve traceability:
- Write a new PlanAssignmentLog with reason=admin_override and metadata_json.source=rollback_runbook.

3. Execute recovery in batches:
- batch size 100-500 users
- verify after each batch

## 5. Validation checklist after rollback

- Register new account:
  - expected plan is default plan (no trial assignment when flag OFF)
- Trigger expiry task manually:
  - expected downgraded count = 0 when auto-downgrade flag OFF
- Admin can still edit UserConfig without errors
- Auth/login/register baseline tests pass

## 6. Re-enable procedure (controlled)

After root-cause fix:
1. Enable ONBOARDING_TRIAL_APPLY_ON_SIGNUP=True only.
2. Observe for at least 24h.
3. Enable ONBOARDING_TRIAL_AUTO_DOWNGRADE_ENABLED=True.
4. Observe expiry summary logs and error rate.

## 7. Mandatory evidence to attach

- Env diff showing flags disabled.
- Logs proving containment.
- Impacted-user export and recovery batch report.
- Test output for auth/register focused suite.
- Sign-off from BE + QA + PM.
