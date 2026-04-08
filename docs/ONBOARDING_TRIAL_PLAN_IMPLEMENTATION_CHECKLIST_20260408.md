# Onboarding Trial Plan - Implementation Checklist (2026-04-08)

## 1) Muc tieu implementation
- Implement day du co che admin cau hinh goi trai nghiem cho user moi.
- Tu dong gan plan khi signup, tu dong downgrade khi het han.
- Chi bo qua superuser.
- Ap dung moi kieu dang ky.
- Chi 1 policy active.
- Admin UI day du (policy + user override + audit filter).

## 2) Scope va output bat buoc
### Backend bat buoc
- Migration tao model policy + audit log + bo sung field UserConfig.
- Service cho signup assignment va expiry downgrade.
- Hook vao registration flow.
- Celery task + beat schedule xu ly expiry.
- Admin pages day du cho policy va audit.

### Test bat buoc
- Unit tests service layer.
- API/integration tests cho signup assignment.
- Task tests cho expiry job (idempotent + race-safe).

### Van hanh bat buoc
- Feature flags rollout.
- Log + metric de theo doi downgrade va assignment.

## 3) Work breakdown chi tiet

## A. Database va model
### A1. Tao model OnboardingPlanPolicy
- File du kien: backend/portfolio/models.py
- Fields:
  - is_active (bool, default false)
  - trial_plan (choices: free/basic/pro/premium)
  - trial_duration_days (positive int, default 30)
  - fallback_plan (choices: free/basic/pro/premium, default basic)
  - effective_from (datetime, null)
  - effective_to (datetime, null)
  - created_by (FK auth.User, null)
  - updated_by (FK auth.User, null)
  - created_at, updated_at
- Constraints:
  - Validate trial_duration_days > 0
  - Validate effective_to > effective_from neu cung co gia tri
  - Validate trial_plan != admin va fallback_plan != admin

### A2. Enforce chi 1 policy active
- Lua chon de xuat:
  - UniqueConstraint co condition is_active=true
- Neu DB backend khong support tot partial unique:
  - enforce trong clean() + save() + admin form validation

### A3. Mo rong UserConfig
- File du kien: backend/portfolio/models.py
- Add fields:
  - plan_source (choices: system_default, onboarding_trial, manual_admin, paid)
  - auto_downgrade_enabled (bool, default true)
  - plan_assigned_at (datetime, null)
  - downgraded_at (datetime, null)
  - plan_locked_by_admin (bool, default false)

### A4. Tao model PlanAssignmentLog
- File du kien: backend/portfolio/models.py
- Fields:
  - user (FK auth.User)
  - old_plan, new_plan
  - old_expires_at, new_expires_at
  - reason (signup_trial, trial_expired, admin_override, payment_upgrade)
  - actor_type (system/admin)
  - actor_user (FK auth.User, null)
  - metadata_json (JSONField, null)
  - created_at
- Index:
  - user + created_at
  - reason + created_at

### A5. Migration + data backfill
- Tao migration moi trong backend/portfolio/migrations
- Backfill UserConfig fields cho user cu:
  - plan_source = system_default neu null
  - auto_downgrade_enabled = true
  - plan_locked_by_admin = false

## B. Service layer va domain rules
### B1. Tao service assignment cho signup
- File du kien: backend/portfolio/services/onboarding_trial_service.py
- Function:
  - get_active_policy(now)
  - apply_onboarding_trial_for_new_user(user, signup_method, actor=None)
- Rules:
  - Bo qua superuser
  - Ap dung cho moi signup method
  - Neu khong co policy active -> khong can thiệp
  - Neu user da co paid plan -> khong override

### B2. Tao service downgrade khi het han
- Function:
  - process_expired_onboarding_trials(batch_size=500, now=None)
- Rules:
  - plan_source == onboarding_trial
  - plan_expires_at <= now
  - auto_downgrade_enabled = true
  - plan_locked_by_admin = false
  - user.is_superuser = false
  - update transaction-safe, idempotent

### B3. Audit log helper
- Function:
  - log_plan_assignment(...)
- Duoc goi khi:
  - signup assignment
  - expiry downgrade
  - admin override

## C. Registration flow integration
### C1. Xac dinh diem hook sau signup
- File can check:
  - backend/portfolio/auth_views.py
  - backend/portfolio/signals.py (neu co)
- Sau khi tao UserConfig -> goi apply_onboarding_trial_for_new_user

### C2. Support OAuth signup
- Neu co path OAuth callback tao user moi:
  - goi cung service tren
- Bao dam login flow user cu khong bi re-assign plan

## D. Celery task va scheduler
### D1. Tao task xu ly expiry
- File du kien: backend/portfolio/tasks.py
- Task:
  - process_onboarding_trial_expiry
- Yeu cau:
  - retry an toan
  - log so user duoc downgrade

### D2. Add beat schedule
- File du kien: backend/config/settings.py
- Tan suat de xuat:
  - moi 60 phut
- Env tuong ung:
  - ONBOARDING_TRIAL_EXPIRY_INTERVAL_SECONDS (default 3600)

## E. Admin UI day du
### E1. Policy admin page
- File du kien: backend/portfolio/admin.py
- Features:
  - list view: is_active, trial_plan, duration, fallback, effective window
  - form validation rule active uniqueness
  - action nhanh: Activate policy
  - readonly metadata (created_by/updated_by/timestamps)

### E2. UserConfig admin page mo rong
- Hien thi va cho sua:
  - plan, plan_expires_at, plan_source
  - auto_downgrade_enabled
  - plan_locked_by_admin
- Action:
  - Override plan (co ly do)
  - Reset to default policy
  - Ghi PlanAssignmentLog bat buoc

### E3. Audit admin page
- List filter day du:
  - reason
  - actor_type
  - date range
  - user
- Search:
  - username/email

## F. API/permission considerations
### F1. Khong mo API public moi cho policy
- Chi admin site thao tac policy.

### F2. Neu can API read-only cho dashboard admin
- Gioi han IsAdminUser

## G. Test plan chi tiet
### G1. Unit tests service
- apply_onboarding_trial_for_new_user:
  - active policy -> assign dung
  - no policy -> no-op
  - superuser -> no-op
  - already paid -> no-op
- process_expired_onboarding_trials:
  - downgrade dung dieu kien
  - bo qua user bi lock
  - idempotent khi chay lai

### G2. Integration tests
- Dang ky moi email/password -> nhan trial
- Dang ky moi OAuth -> nhan trial
- Het han -> ve fallback

### G3. Admin tests
- Khong the active >1 policy
- Override plan tao audit log

## H. Rollout ke hoach
### H1. Feature flags
- ONBOARDING_TRIAL_POLICY_ENABLED=true
- ONBOARDING_TRIAL_APPLY_ON_SIGNUP=true
- ONBOARDING_TRIAL_EXPIRY_JOB_ENABLED=true

### H2. Rollout steps
1. Deploy migration + code voi policy disable.
2. Tao policy trong admin, verify tren staging.
3. Enable apply_on_signup.
4. Enable expiry job.

### H3. Observability
- Structured logs:
  - onboarding_trial_assigned
  - onboarding_trial_expired_downgraded
- Metric counters:
  - onboarding_trial_assigned_total
  - onboarding_trial_downgraded_total
  - onboarding_trial_downgrade_skipped_total

## I. Acceptance gates truoc merge
1. Full test pass.
2. Manual test 3 luong:
- signup moi
- expiry downgrade
- admin override + lock
3. Khong regression auth/login/realtime.
4. Tai lieu cap nhat day du trong docs.

## J. Definition of Done
- Policy admin hoat dong
- Signup assignment hoat dong
- Expiry downgrade hoat dong
- Audit log day du
- Da rollout tren production voi monitoring co du lieu
