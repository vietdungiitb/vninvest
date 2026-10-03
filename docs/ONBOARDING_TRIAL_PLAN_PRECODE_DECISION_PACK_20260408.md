# Onboarding Trial Plan - Pre-code Decision Pack (2026-04-08)

## 1) Executive summary
Tai lieu nay la goi quyet dinh truoc khi coding cho tinh nang:
- Admin cau hinh goi trai nghiem cho user dang ky moi.
- Auto assign khi signup.
- Auto downgrade ve goi fallback khi het han.

Trang thai hien tai:
- Da hoan tat planning + implementation checklist.
- Tai lieu nay chot cac thong so ky thuat de vao coding ngay sau khi ban phe duyet.

## 2) Inputs da duoc xac nhan
1. Danh sach plan he thong hien co: free, basic, pro, premium, admin.
2. Chi bo qua superuser.
3. Ap dung cho moi kieu dang ky.
4. Chi 1 policy active tai moi thoi diem.
5. Admin UI day du ngay phase 1.

## 3) Scope freeze (de code)
### In-scope
- Data model policy + audit log + user config extension.
- Registration integration (email/password + OAuth).
- Expiry job (Celery).
- Admin UI full: policy CRUD, user override, audit filter.
- Test unit + integration + admin.

### Out-of-scope
- Billing/payment integration.
- Frontend self-service management plan cho end-user.
- Multi-policy scheduling phuc tap (chi 1 active).

## 4) Detailed technical design
## 4.1 Data model changes
### A. New model: OnboardingPlanPolicy
- Muc dich: policy cap he thong cho user moi.
- Fields:
  - id
  - is_active: bool, default false
  - trial_plan: char(20), choices {free,basic,pro,premium}
  - trial_duration_days: positive int, default 30
  - fallback_plan: char(20), choices {free,basic,pro,premium}, default basic
  - effective_from: datetime nullable
  - effective_to: datetime nullable
  - created_by: FK auth_user nullable
  - updated_by: FK auth_user nullable
  - created_at, updated_at
- Validation:
  - trial_duration_days > 0
  - effective_to > effective_from neu ca hai khong null
  - trial_plan != admin, fallback_plan != admin
- Constraint:
  - Chi 1 record active tai 1 thoi diem (DB constraint + app-level guard).

### B. New model: PlanAssignmentLog
- Muc dich: audit trail cho moi thay doi plan.
- Fields:
  - id
  - user: FK auth_user
  - old_plan, new_plan
  - old_expires_at, new_expires_at
  - reason: {signup_trial,trial_expired,admin_override,payment_upgrade}
  - actor_type: {system,admin}
  - actor_user: FK auth_user nullable
  - metadata_json: JSON nullable
  - created_at
- Index:
  - (user, created_at desc)
  - (reason, created_at desc)

### C. Extend UserConfig
- Add fields:
  - plan_source: {system_default,onboarding_trial,manual_admin,paid}
  - auto_downgrade_enabled: bool default true
  - plan_locked_by_admin: bool default false
  - plan_assigned_at: datetime nullable
  - downgraded_at: datetime nullable
- Backfill:
  - plan_source=system_default
  - auto_downgrade_enabled=true
  - plan_locked_by_admin=false

## 4.2 Domain services
### Service 1: apply_onboarding_trial_for_new_user(user, signup_method)
- Preconditions:
  - user moi tao, co UserConfig.
- Steps:
  1. Neu user.is_superuser -> return no-op.
  2. Tim active policy trong khoang hieu luc.
  3. Neu khong co policy -> return no-op.
  4. Neu user co plan_source=paid -> no-op.
  5. Gan:
     - plan = policy.trial_plan
     - plan_expires_at = now + duration
     - plan_source = onboarding_trial
     - plan_assigned_at = now
  6. Ghi PlanAssignmentLog reason=signup_trial actor=system.

### Service 2: process_expired_onboarding_trials(batch_size, now)
- Query:
  - plan_source=onboarding_trial
  - plan_expires_at <= now
  - auto_downgrade_enabled=true
  - plan_locked_by_admin=false
  - user.is_superuser=false
- Action:
  - update plan -> fallback_plan cua policy active tai thoi diem xu ly
  - clear expires_at
  - plan_source=system_default
  - downgraded_at=now
  - log reason=trial_expired
- Safety:
  - transaction + select_for_update(skip_locked neu co)
  - idempotent khi chay lai.

## 4.3 Registration integration points
- Hook vao flow register tao user thanh cong:
  - email/password register endpoint
  - OAuth new-user creation path
- Rule:
  - chi apply luc user moi tao (khong apply cho login).

## 4.4 Admin UI design (full)
### A. OnboardingPlanPolicyAdmin
- List:
  - is_active, trial_plan, trial_duration_days, fallback_plan, effective_from/to, updated_at
- Form:
  - validation active uniqueness
  - validation thoi gian
- Actions:
  - Activate selected policy (auto deactivate policy cu)

### B. UserConfigAdmin extension
- Display va edit:
  - plan, plan_expires_at, plan_source
  - auto_downgrade_enabled
  - plan_locked_by_admin
- Custom actions:
  - Override plan (yeu cau reason)
  - Reset ve policy default
- Moi thao tac override phai tao PlanAssignmentLog reason=admin_override.

### C. PlanAssignmentLogAdmin
- List filter:
  - reason
  - actor_type
  - created_at range
- Search:
  - username, email

## 4.5 Celery schedule
- Task name: portfolio.tasks.process_onboarding_trial_expiry
- Beat interval env:
  - ONBOARDING_TRIAL_EXPIRY_INTERVAL_SECONDS (default 3600)
- Feature flags env:
  - ONBOARDING_TRIAL_POLICY_ENABLED=true/false
  - ONBOARDING_TRIAL_APPLY_ON_SIGNUP=true/false
  - ONBOARDING_TRIAL_EXPIRY_JOB_ENABLED=true/false

## 5) Migration and rollout plan
## Phase R1 - Deploy schema (safe, feature off)
- Release migration + model + admin registration.
- Tat ca feature flags OFF.
- Verify migration pass tren production.

## Phase R2 - Enable policy in admin
- Tao policy active dau tien.
- Khong bat apply_on_signup/job ngay.
- Verify admin CRUD + validation active uniqueness.

## Phase R3 - Enable signup assignment
- Bat ONBOARDING_TRIAL_APPLY_ON_SIGNUP.
- Test tao user moi nhan plan trial.

## Phase R4 - Enable expiry job
- Bat ONBOARDING_TRIAL_EXPIRY_JOB_ENABLED.
- Theo doi log downgrade trong 24h.

## Rollback strategy
- Neu co su co:
  1. Tat 3 feature flags tren.
  2. Giu schema, dung service.
  3. Neu can, script restore plan cho user bi anh huong tu PlanAssignmentLog.

## 6) Testing matrix (must pass)
1. Signup email/password -> assign trial.
2. Signup OAuth -> assign trial.
3. Superuser signup -> no assign.
4. Expiry job downgrade dung fallback.
5. Locked user -> no downgrade.
6. Paid user -> no downgrade.
7. Admin override -> tao audit log.
8. Chi 1 policy active (DB + form validation).
9. Job idempotent khi run 2 lan lien tiep.

## 7) Observability and operations
- Structured log keys:
  - event=onboarding_trial_assigned
  - event=onboarding_trial_downgraded
  - event=onboarding_trial_skipped
- Metrics counters:
  - onboarding_trial_assigned_total
  - onboarding_trial_downgraded_total
  - onboarding_trial_skipped_total
- Alert de xuat:
  - downgrade failures > N lan/1h

## 8) Security and compliance notes
- Khong expose API public cho policy.
- Chi admin/staff co quyen thao tac UI policy.
- Audit log luu actor va reason bat buoc.

## 9) Delivery plan (commit-level)
### M1 - Schema
- models + migrations + constraints + admin register basic.

### M2 - Service core
- onboarding_trial_service + unit tests.

### M3 - Registration hook
- integrate auth flows + integration tests.

### M4 - Expiry task
- celery task + beat + tests idempotent.

### M5 - Full admin UI + audit filter
- policy admin + user override + log admin.

### M6 - Observability + docs finalize
- structured logs + runbook + release notes.

## 10) Estimation and capacity
- Tong: 3.5 - 4.5 ngay dev effort.
- Risk buffer: +0.5 ngay (auth edge cases, migration conflicts).

## 11) Go/No-Go decision checklist (ban duyet truoc code)
1. Scope freeze nhu muc 3.
2. Rollout 4 pha nhu muc 5.
3. Feature flags ON/OFF strategy duoc chap nhan.
4. Test matrix muc 6 la bat buoc merge.
5. Khong bo sung yeu cau moi trong sprint nay.

## 12) De xuat quyet dinh ngay
- GO de vao coding Phase M1-M2.
- Sau khi xong M2 se gui ban review checkpoint truoc khi tiep M3-M4.
