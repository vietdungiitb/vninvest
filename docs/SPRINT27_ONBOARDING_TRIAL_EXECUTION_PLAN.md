# Sprint 27 - Onboarding Trial Plan Execution Plan

Status: CODE COMPLETE - READY FOR STAGING SMOKE + GO/NO-GO
Timebox: 5 ngay lam viec
Focus: Admin-configured onboarding trial policy cho user dang ky moi + auto expiry downgrade

## 1) Scope freeze

In scope:
1. Onboarding policy model + validation + single-active guard.
2. UserConfig extension cho plan lifecycle metadata.
3. PlanAssignmentLog audit trail.
4. Signup assignment service cho moi signup method.
5. Expiry downgrade task + Celery beat schedule.
6. Full admin UI: policy + user override + audit filters.
7. Test matrix unit/integration/admin.

Out of scope:
1. Payment gateway, billing orchestration.
2. End-user subscription self-service page.
3. Multi-policy active scheduling phuc tap.

## 2) Input artifacts bat buoc

1. docs/ONBOARDING_TRIAL_PLAN_ADMIN_POLICY_20260408.md
2. docs/ONBOARDING_TRIAL_PLAN_IMPLEMENTATION_CHECKLIST_20260408.md
3. docs/ONBOARDING_TRIAL_PLAN_PRECODE_DECISION_PACK_20260408.md
4. docs/SPRINT27_TASKBOARD.csv
5. docs/SPRINT27_ACCEPTANCE_CHECKLIST.md
6. docs/SPRINT_EXECUTION_LOG.md
7. docs/ROADMAP_STATUS.md

## 3) Sprint backlog (code-level)

| Story ID | Muc tieu | Code area du kien | Output bat buoc | Test bat buoc | Status |
|---|---|---|---|---|---|
| S27-01 | Schema + migration | backend/portfolio/models.py, migrations/* | OnboardingPlanPolicy + PlanAssignmentLog + UserConfig fields | migration up/down smoke | Done |
| S27-02 | Service core | backend/portfolio/services/onboarding_trial_service.py | signup assign + expiry downgrade + audit helper | unit tests service + idempotent tests | Done |
| S27-03 | Registration integration | backend/portfolio/auth_views.py (+ oauth signup path) | apply onboarding trial sau khi user moi tao | integration test email/password + oauth | Done |
| S27-04 | Expiry task + schedule | backend/portfolio/tasks.py, backend/config/settings.py | celery task + beat interval + feature flags | task run tests + schedule validation | Done |
| S27-05 | Full admin UI | backend/portfolio/admin.py | policy admin + user override + audit filter | admin behavior tests | Done |
| S27-06 | Rollout + observability | docs + logging points | structured logs + rollout runbook | smoke in staging | Done |

## 4) Milestones and checkpoints

1. M1 (Day 1): S27-01 done (schema and migration).
2. M2 (Day 2): S27-02 done (service core + tests).
3. CHECKPOINT REVIEW (End Day 2): Product Owner review truoc khi tiep registration/task.
4. M3 (Day 3): S27-03 done (registration integration).
5. M4 (Day 4): S27-04 done (expiry task + schedule).
6. M5 (Day 5): S27-05 + S27-06 done (admin UI + rollout prep + sign-off).

## 5) Definition of Done for Sprint 27

1. User dang ky moi nhan trial plan theo active policy (tat ca signup methods).
2. Chi bo qua superuser, cac user khac ap dung binh thuong.
3. Chi ton tai mot policy active tai mot thoi diem.
4. Expired onboarding_trial duoc downgrade dung fallback, idempotent khi job chay lap.
5. Admin co the override/lock plan va thao tac duoc audit day du.
6. Test matrix trong docs/SPRINT27_ACCEPTANCE_CHECKLIST.md dat trang thai pass.

## 6) Mandatory commands checklist

```powershell
# Backend checks
cd backend
python manage.py makemigrations --check
python manage.py migrate
python manage.py check

# Unit/integration tests (adjust testcase names when implemented)
python manage.py test portfolio.tests.test_onboarding_trial_service
python manage.py test portfolio.tests.test_onboarding_trial_registration
python manage.py test portfolio.tests.test_onboarding_trial_expiry_task
python manage.py test portfolio.tests.test_admin_onboarding_policy

# Optional regression smoke
python manage.py test portfolio.tests.test_api_routes
```

## 7) Risk controls

1. Block merge neu co >1 active policy.
2. Block merge neu expiry job co the downgrade user paid/locked.
3. Block merge neu signup path OAuth va email/password khong dong nhat service call.
4. Block merge neu audit log khong ghi actor/reason day du.
5. Rollout by feature flags, co rollback plan truoc khi enable expiry job.

## 8) Rollout sequence (production)

1. Deploy code + migration voi feature flags OFF.
2. Tao active policy tren admin va verify behavior tren staging.
3. Enable ONBOARDING_TRIAL_APPLY_ON_SIGNUP.
4. Theo doi assignment logs 24h.
5. Enable ONBOARDING_TRIAL_EXPIRY_JOB_ENABLED.
6. Theo doi downgrade logs + skipped counters.

## 9) Execution note

- Tuyet doi khong mo rong scope ngoai sprint (billing/payment) trong khi chua dong acceptance gates S27.
- Sau M2 bat buoc checkpoint review voi Product Owner truoc khi tiep tuc M3-M5.
- Trang thai hien tai: coding va technical verification da xong; con buoc manual staging smoke + ky GO/NO-GO truoc production deploy.
