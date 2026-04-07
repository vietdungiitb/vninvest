# Sprint26 OpenCore Runbook - Day 6 Handoff (2026-04-07)

**Trang thái**: Sprint26 Day 4-5 hoàn tất, sẵn sàng handoff cho Sprint27 + Frontend

---

## 1. Architecture Overview - Trial/Grace Evolution (Day 5)

### Source of Truth: UserPlanLifecycle (Chốt)

```
Timeline:
- User signs up (account created)
  → UserPlanLifecycle.trial_starts_at = now
  → UserPlanLifecycle.trial_ends_at = now + 7d
  → UserConfig.plan = 'pro' (free trial of pro features)

- After 7 days (trial_ends_at passes)
  → Celery task process_plan_lifecycle_transitions runs (7am UTC daily)
  → grace_ends_at = trial_ends_at + 7d
  → resolve_user_entitlements returns trial_state='grace_active'

- After 14 days (grace_ends_at passes)
  → Celery task downgrades UserConfig.plan = 'free'
  → resolve_user_entitlements returns trial_state='expired', plan='free'
  → Feature gates return 403 Forbidden
```

**Schedule**: `config/settings.py` CELERY_BEAT_SCHEDULE
```python
CELERY_BEAT_SCHEDULE["opencore-process-plan-lifecycle"] = {
    "task": "portfolio.tasks.process_plan_lifecycle_transitions",
    "schedule": crontab(hour=7, minute=0),  # Daily at 7am UTC
}
```

---

## 2. Stock Workspace Endpoints - Complete Mapping

### Feature & Quota Keys (Day 3-4)

All stock workspace endpoints now gate on `sentiment_score` feature:

| Endpoint | HTTP | Feature | Quota Key | Unlock Tier |
|----------|------|---------|-----------|------------|
| `/api/stock-management/stocks/<symbol>/order-flow/` | GET/POST | `sentiment_score` | `api_calls_per_day` | Pro+ |
| `/api/stock-management/stocks/<symbol>/ai-advisory-session/` | GET | `sentiment_score` | `api_calls_per_day` | Pro+ |
| `/api/stock-management/stocks/<symbol>/ai-advisory-session/` | POST | `sentiment_score` | `ai_regenerate_per_day` | Pro+ |
| `/api/stock-management/ai-advisory-components/<id>/refresh/` | POST | `sentiment_score` | `ai_regenerate_per_day` | Pro+ |
| `/api/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/` | POST | `sentiment_score` | `ai_regenerate_per_day` | Pro+ |
| `/api/stock-management/ai-advisory-components/<id>/toggle-include/` | POST | `sentiment_score` | `api_calls_per_day` | Pro+ |
| `/api/stock-management/ai-advisory-components/<id>/` | DELETE | `sentiment_score` | `api_calls_per_day` | Pro+ |
| `/api/stock-management/ai-advisory-components/<id>/restore/` | POST | `sentiment_score` | `api_calls_per_day` | Pro+ |

**Quota Caps by Tier** (from `settings.py`):
- **Free**: `api_calls_per_day`=300, `ai_regenerate_per_day`=0 (locked)
- **Pro**: `api_calls_per_day`=3000, `ai_regenerate_per_day`=30
- **Premium/Admin**: `api_calls_per_day`=10000, `ai_regenerate_per_day`=100+
- **Trial/Grace**: Same as underlying plan (Pro if trial user)

---

## 3. Response Contracts - Gating & Quota

### 403 Forbidden (Feature Locked)

```json
{
  "ok": false,
  "code": "feature_locked",
  "feature_key": "sentiment_score",
  "message": "Tinh nang nay yeu cau goi cao hon hoac license hop le.",
  "reason": "License free"  // or "Feature not in free plan" etc.
}
```

**When returned**:
- User's plan doesn't include feature
- User's license status is 'expired'
- Free users accessing pro-only endpoints

**HTTP**: 403 Forbidden

---

### 429 Too Many Requests (Quota Exceeded)

```json
{
  "ok": false,
  "code": "quota_exceeded",
  "quota_key": "api_calls_per_day",  // or "ai_regenerate_per_day"
  "limit": 300,
  "used": 301,
  "remaining": 0,
  "reset_at": "2026-04-08T00:00:00Z",
  "message": "Da vuot han api goi trong ngay."
}
```

**When returned**:
- User consumed all quota for the period
- Current call would exceed limit

**HTTP**: 429 Too Many Requests
**Reset**: Daily at midnight UTC (automatically reset via task)

---

### 200 Success (Normal Response)

```json
{
  "ok": true,
  "data": { /* endpoint-specific payload */ },
  // ... normal response fields ...
}
```

**Tracked**: All success responses call `track_api_call(feature, status_code)`

---

## 4. Integration Checklist for Frontend

### Prerequisite: Get Entitlements

```bash
GET /api/auth/me/
```

Response includes:
```json
{
  "user": { /* ... */ },
  "entitlements": {
    "plan": "pro|premium|free|admin|trial",
    "tier": "community|pro_individual|enterprise",
    "trial_state": "trial_active|grace_active|expired|none",
    "trial_ends_at": "2026-04-12T00:00:00Z",  // null if none
    "grace_ends_at": "2026-04-19T00:00:00Z",  // null if none
    "quota_caps": {
      "api_calls_per_day": 300,
      "ai_regenerate_per_day": 0  // 0 = not allowed
    },
    "can_read_whale_feed": true,
    "can_read_whale_advisory": true,  // if plan >= pro
    "can_read_whale_advisory_detail": false  // if plan >= premium
  }
}
```

### Handle 403 in UI

When calling any stock workspace endpoint and receiving 403:
1. **Show feature lock modal/banner** with icon
2. **Display**: "Tính năng này yêu cầu gói cao hơn"
3. **Action**: Link to upgrade or try premium (trial if eligible)
4. **Reference**: Use `response.feature_key` to log which feature

### Handle 429 in UI

When calling any endpoint and receiving 429:
1. **Show quota warning** with progress bar
2. **Display**: "Đã vượt hạn 300 gọi API hôm nay"
3. **Show reset time**: `response.reset_at` formatted (hôm nay hết hạn)
4. **Suggest**: Alternative features with lower quota cost or suggest pro plan
5. **Disable button**: Typically disable endpoint button until next day (or show countdown)

### Usage Dashboard Request (Future - Day 6+)

```bash
GET /api/opencore/usage/summary/  # Coming in Sprint 27
```

Will return:
```json
{
  "period": "2026-04",
  "quota_usage": {
    "api_calls_per_day": {
      "used": 250,
      "limit": 300,
      "remaining": 50,
      "percent_used": 83
    },
    "ai_regenerate_per_day": {
      "used": 10,
      "limit": 30,
      "remaining": 20,
      "percent_used": 33
    }
  },
  "reset_at": "2026-04-08T00:00:00Z"
}
```

---

## 5. Local Development Setup

### Prerequisites

1. **Python environment**: See backend/.venv setup
2. **Database**: PostgreSQL or SQLite (test uses SQLite)
3. **Celery Redis**: For beat scheduler
   ```bash
   redis-server --port 6379
   ```

### Step 1: Backend Setup

```bash
cd backend

# Install deps
pip install -r requirements.txt

# Migrations
python manage.py migrate

# Create test user
python manage.py shell
>>> from django.contrib.auth.models import User
>>> from portfolio.models import UserConfig, UserPlanLifecycle
>>> from portfolio.opencore_dpi import DPIPlan, DPILicense
>>> u = User.objects.create_user('testuser', 'test@local.dev', 'test123')
>>> UserConfig.objects.create(user=u, plan='pro', email_verified=True)
>>> uc, _ = UserPlanLifecycle.objects.get_or_create(user=u, defaults={
      'trial_starts_at': timezone.now(),
      'trial_ends_at': timezone.now() + timedelta(days=7),
  })
```

### Step 2: Enable OpenCore Quota Enforcement

```bash
# .env or environment:
OPENCORE_ENABLED=true
OPENCORE_QUOTA_ENFORCEMENT_ENABLED=true  # Enable for testing
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=50  # Lower for testing
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=500
```

### Step 3: Start Backend with Celery Beat

```bash
# Terminal 1: Django server
python manage.py runserver

# Terminal 2: Celery worker
celery -A config worker -l info

# Terminal 3: Celery beat (scheduler for lifecycle transitions)
celery -A config beat -l info --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

### Step 4: Test Stock Ordering Endpoint

```bash
# Order flow endpoint (should pass for pro user)
curl -X GET http://localhost:8000/api/stock-management/stocks/VNM/order-flow/ \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json"

# Expected: 200 OK with order flow data
```

### Step 5: Test Quota Exhaustion

```bash
# Make repeated calls until 429
for i in {1..60}; do
  curl -X GET http://localhost:8000/api/stock-management/stocks/VNM/order-flow/ \
    -H "Authorization: Bearer <access_token>"
done

# Should see 429 after quota exceeded
```

---

## 6. Testing - Run Full Suite

### Unit Tests (Lifecycle Transitions)

```bash
cd backend
python manage.py test portfolio.tests.test_opencore_lifecycle.OpenCoreLifecycleTransitionTests -v2
```

Expected: 8/8 tests pass (trial→grace, grace→expired, entitlements, etc.)

### Integration Tests (Endpoints)

```bash
# P0 endpoints (order-flow, ai-advisory-session, components-generate)
python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_workspace_p0_role_matrix_blocks_free_dpi_license -v2

# P1 endpoints (refresh, regenerate, toggle, delete, restore)
python manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_ai_advisory_component_refresh_returns_403_when_feature_locked_for_free_dpi_license -v2

# All 19 tests (Full sprint26 regression)
python manage.py test \
  portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_workspace_p0_role_matrix_blocks_free_dpi_license \
  portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_stock_workspace_p0_role_matrix_allows_access_for_pro_premium_admin_trial_grace \
  ... (19 total)
```

---

## 7. Known Limitations & Notes

### 1. Trial/Grace Source of Truth

- **UserPlanLifecycle** is authoritative source (Day 5 decision)
- **DPILicense.status='trial'** exists but is separate from entitlements
- Both work together: license validity + user plan lifecycle
- Frontend should read `entitlements.trial_state` from `/api/auth/me/`, not DPI license

### 2. Quota Reset

- Reset happens at **midnight UTC** automatically
- Configured in `settings.py` CELERY_BEAT_SCHEDULE
- No manual reset needed (but can force via admin panel if needed)

### 3. Trial Users & Quota

- Trial users inherit **underlying plan quota** (e.g., trial of Pro gets 3000 calls/day)
- 30-day Pro trial (free) vs 7-day trial of premium features (unclear - not implemented)
- Current: 7-day trial → 7-day grace (UserPlanLifecycle model)

### 4. Grace Period Read Access

- Grace users **can still read** but **cannot regenerate** (ai_regenerate_per_day=0)
- This is intentional: read-only during grace before full expiry
- Quota enforcement prevents POST/regenerate calls

### 5. Free User Behavior

- Free users can call endpoints but get **403 Forbidden** (feature_locked)
- Not 429 quota exceeded - the feature itself is locked
- This is by design: feature gate first, then quota

---

## 8. Deployment Checklist

- [ ] DPILicense created for all existing users (backfill script)
- [ ] UserPlanLifecycle created for new trial signups
- [ ] OPENCORE_QUOTA_ENFORCEMENT_ENABLED=true in production
- [ ] Celery beat schedule running (`process_plan_lifecycle_transitions` at 7am UTC)
- [ ] Frontend updated to handle 403/429 responses
- [ ] Frontend updated to read entitlements from `/api/auth/me/`
- [ ] Test 403 flow in staging with free user
- [ ] Test 429 flow in staging with low quota cap
- [ ] Test grace period transition in staging
- [ ] Monitor error logs for `process_plan_lifecycle_transitions` failures

---

## 9. Next Steps (Sprint 27+)

### Sprint 27:
- [ ] Payment gateway integration (Stripe/PayPal)
- [ ] Subscription creation endpoint
- [ ] License renewal on payment
- [ ] Usage dashboard UI (shows quota usage)

### Sprint 28:
- [ ] Billing/invoice history
- [ ] Subscription management UI
- [ ] Plan upgrade/downgrade flows
- [ ] Churn/renewal tracking

---

## 10. Support & Debugging

### Common Issues

**Q: User still sees free after upgrade?**
- Check: UserConfig.plan and DPILicense.plan both updated
- Check: resolve_user_entitlements() reads UserConfig.plan first

**Q: Trial never expires?**
- Check: Celery beat running (logs)
- Check: `process_plan_lifecycle_transitions` task exists in CELERY_BEAT_SCHEDULE
- Manual trigger: `python manage.py shell` then `from portfolio.tasks import process_plan_lifecycle_transitions; process_plan_lifecycle_transitions()`

**Q: 429 doesn't reset next day?**
- Check: Redis cache running (quota stored there)
- Check: Celery beat running (quota reset task)
- Manual reset via Django admin: UserConfig → clear cache

**Q: 403 should be 200?**
- Check: Feature key in endpoint matches DPIPlan.features
- Check: User's DPILicense.status (expired? invalid?)
- Test with: `check_feature_access(user, 'sentiment_score')`

---

Generated: 2026-04-07 | Sprint26 Day 6 Handoff | Ready for Sprint27
