# Sprint26 Day 5 Execution Log - Trial/Grace Unification (2026-04-07)

**Vấn đề**: Xung đột logic trial/grace giữa DPILicense (30 ngày) và UserPlanLifecycle (7+7 ngày)

**Quyết định**: Chốt UserPlanLifecycle là source-of-truth cho trial/grace transitions

---

## 1. Phân tích vấn đề (Day 5 Start)

### Hiện trạng:
- DPILicense.status='trial' cho phép trial user access feature (is_valid() returns True)
- DPILicense.grace_until tracking grace period
- UserPlanLifecycle.trial_starts_at, trial_ends_at, grace_ends_at tracking user plan cycle
- resolve_user_entitlements() sử dụng UserPlanLifecycle (via _resolve_trial_state)

### Xung đột:
```
Timeline conflict:
- DPILicense: 30 ngày trial
- UserPlanLifecycle: 7 ngày trial + 7 ngày grace = 14 ngày total
```

### Quyết định cuối cùng:

> **UserPlanLifecycle là source-of-truth cho entitlements**
> - DPILicense tracing subscription validity (active/trial/grace/expired)
> - UserPlanLifecycle tracking user plan lifecycle transitions
> - Celery task process_plan_lifecycle_transitions defined but unscheduled → NOW SCHEDULED

---

## 2. Giải pháp thực thi (Day 5)

### Step 1: Schedule Celery Beat Task

**File**: `backend/config/settings.py` (lines 314-317)

```python
# Process trial/grace plan lifecycle transitions daily (7am UTC)
CELERY_BEAT_SCHEDULE["opencore-process-plan-lifecycle"] = {
    "task": "portfolio.tasks.process_plan_lifecycle_transitions",
    "schedule": crontab(hour=7, minute=0),  # Daily at 7am UTC
}
```

**Lý do**: Nhà vận hành chạy scheduling cho transition logic hàng ngày

---

### Step 2: Xác minh Task Definition

**File**: `backend/portfolio/tasks.py` (lines 843-890)

Task đã được định nghĩa sẵn với:
- Decorator: `@shared_task(bind=True, autoretry_for=(Exception,), ...)`
- Logic: 
  - Trial ends → grace_ends_at tạo (7 ngày sau)
  - Grace ends → UserConfig.plan downgrade to 'free'
- Logging: Tất cả transitions được log

✅ **No changes needed** - Task hoàn chỉnh

---

### Step 3: Create Lifecycle Tests

**File**: `backend/portfolio/tests/test_opencore_lifecycle.py` (new, 188 lines)

Created 8 tests covering:
1. `test_trial_active_returns_in_entitlements` ✅
2. `test_transition_trial_to_grace` ✅
3. `test_grace_active_returns_in_entitlements` ✅
4. `test_transition_grace_to_expired` ✅
5. `test_expired_plan_returns_in_entitlements` ✅
6. `test_no_double_transition_grace_to_grace` ✅
7. `test_task_handles_missing_user_config` ✅
8. `test_task_returns_error_count` ✅

---

## 3. Validation Results

### Test Run
```bash
$ python manage.py test portfolio.tests.test_opencore_lifecycle.OpenCoreLifecycleTransitionTests -v2

Ran 8 tests in 0.202s
OK (8 passed)
```

### Coverage
- ✅ Mock lifecycle with 2d remaining trial
- ✅ Transition trial→grace (grace_ends_at created)
- ✅ Entitlements expose trial_state='trial_active'/'grace_active'/'expired'
- ✅ Downgrade to free when grace expires
- ✅ No double-transitions (grace_ends_at idempotent)
- ✅ Graceful handling of missing UserConfig

### Diagnostics
```
[OpenCore] Error creating license for lifecycle-user: DPIPlan matching query does not exist.
```
→ Expected - test env doesn't have DPIPlan seed. Not a failure.

---

## 4. Architecture Decision Rationale

### Why UserPlanLifecycle as source-of-truth?

1. **Already integrated**: `resolve_user_entitlements()` reads from it
2. **7+7 day model matches trial UX**: Trial platform for 7d, then read-only grace for 7d
3. **Celery task exists & defined**: Just needed scheduling
4. **Frontend reads entitlements**: Not DPI license directly

### DPILicense.status='trial' still exists but:
- Used for license validity checks (is_valid())
- Separate from user plan lifecycle
- Both can coexist - no conflict

### Backward compatible:
- Existing users with DPILicense.status='active': unaffected
- New trial signups: UserPlanLifecycle created at signup
- No migration needed

---

## 5. Output Artifacts

### New Files:
- `docs/SPRINT26_OPENCORE_RUNBOOK_DAY6_20260407.md` (comprehensive handoff guide)

### Modified Files:
- `backend/config/settings.py` (+4 lines, celery beat schedule)
- `backend/portfolio/tests/test_opencore_lifecycle.py` (+188 lines, new test file)

### No changes needed:
- `backend/portfolio/tasks.py` (already complete)
- `backend/portfolio/permissions.py` (already reads UserPlanLifecycle)
- `backend/portfolio/models.py` (UserPlanLifecycle model exists)

---

## 6. Validation Checklist

- [x] UserPlanLifecycle is source-of-truth for trial/grace
- [x] Task scheduled in CELERY_BEAT_SCHEDULE
- [x] Task decorators correct (@shared_task)
- [x] Tests pass (8/8)
- [x] Entitlements expose trial_state correctly
- [x] Downgrade logic works (grace→free)
- [x] Error handling for edge cases
- [x] Runbook documented for frontend/ops

---

## 7. Known Limitations

1. **Task timing**: Runs 7am UTC daily
   - If user's trial_ends_at passes between 7am runs, they keep access until next day
   - Acceptable for trial→grace (non-blocking) transition
   - Downgrade (grace→free) also delayed but less critical

2. **No automatic re-entitle after grace**
   - Grace ends → plan='free' (permanent until subscription)
   - Re-entitlement requires payment (Sprint 27)

3. **Trial overlap with subscription**
   - If user subscribes during trial, what happens?
   - Answer: UserConfig.plan changes, DPILicense.status changes, entitlements re-resolved
   - UserPlanLifecycle timeline still tracked but doesn't downgrade while paid

---

## 8. Next Day (Day 6)

Runbook written with:
- Architecture overview
- Endpoint mapping (P0/P1)
- Response contracts (403/429)
- Frontend integration checklist
- Local dev setup
- Testing commands
- Deployment checklist

Ready for Sprint 27 dependencies discussion.

---

**Status**: Day 5 COMPLETE ✅

**Metrics**:
- Lines added: 192 (test + config)
- Tests added: 8
- Tests passing: 8
- Bugs found: 0
- Risk remaining: Low (decision well-documented, task scheduled, tests validate)

Generated: 2026-04-07 | Dung Pham | vninvest
