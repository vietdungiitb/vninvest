# P2 Deployment & Testing Guide

**Status**: ✅ Code committed `fcce4438` to `origin/deploy`

---

## 📋 Summary: P2 Implementation

| Component | File | Change | Status |
|-----------|------|--------|--------|
| **Multi-Model Routing** | `tasks.py` | `_resolve_model_for_budget()` helper + call point | ✅ |
| **Advisory Metrics Endpoint** | `views.py` | `admin_runtime_kpi_advisory_metrics_api()` + URL | ✅ |
| **Observability Counters** | `tasks.py` | Daily Redis counters for 429 + budget-downgrade | ✅ |
| **Integration** | `config/urls.py` | Wire `/api/admin-ops/runtime-kpi/advisory-metrics/` | ✅ |

**Total changes**: 212 lines added across 3 files

---

## 🧪 Pre-Deployment Testing Checklist

### Test 1: Syntax Validation ✅
```bash
python -m py_compile backend/portfolio/tasks.py
python -m py_compile backend/portfolio/views.py
python -m py_compile backend/config/urls.py
```
**Result**: All files compile cleanly

### Test 2: Code Quality Scan
```bash
# Check for unused imports (optional)
python -m pylint backend/portfolio/tasks.py --disable=all --enable=W0611
```

### Test 3: Unit Tests (Optional Advisory Tests)
```bash
# Run advisory-related tests
python manage.py test portfolio.tests.test_api_routes \
  --verbosity=2 --keepdb
```

**Expected**: Tests pass or show no new failures related to advisory endpoints

### Test 4: Manual Endpoint Testing (Post-Deploy)

#### 4a. Health Check First
```bash
curl -H "Authorization: Bearer {your_token}" \
  http://localhost:8000/api/health/
```

#### 4b. Call Advisory Metrics Endpoint
```bash
curl -H "Authorization: Bearer {admin_token}" \
  'http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/' \
  | jq '.'
```

**Expected Response**:
```json
{
  "sampled_at": 1712847600.5,
  "windows": {
    "latency_hours": 24,
    "provider_days": 7
  },
  "latency": {
    "p50_ms": 1245.3,
    "p95_ms": 3820.5,
    "sample_count": 142
  },
  "token_burn": {
    "today_tokens": 45000,
    "total_configured_budget": 180000,
    "burn_pct": 25.0
  },
  "provider_distribution": {
    "openclaw": 45,
    "openai": 28,
    ...
  },
  "ratelimit_cooldowns_active": {
    "openai": false,
    "claude": false,
    ...
  },
  "ratelimit_429_counts_today": {
    "openai": 0,
    "claude": 0,
    ...
  },
  "budget_downgrade_count_today": 0,
  "advisory_counts_today": {
    "total": 42,
    "by_source_tokens": {...}
  }
}
```

#### 4c. Query with Custom Windows
```bash
# Get latency over 48 hours, provider dist over 14 days
curl -H "Authorization: Bearer {admin_token}" \
  'http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/?latency_window_hours=48&provider_window_days=14' \
  | jq '.latency'
```

#### 4d. Generate Advisory & Check Metrics Impact
```bash
# Trigger an advisory generation for a watched symbol
curl -X POST \
  -H "Authorization: Bearer {user_token}" \
  -H "Content-Type: application/json" \
  -d '{"symbol": "MWG", "refresh": true}' \
  http://localhost:8000/api/whale-advisories/refresh/

# Wait 5 seconds, then check metrics
sleep 5
curl -H "Authorization: Bearer {admin_token}" \
  'http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/' \
  | jq '.advisory_counts_today'
```

**Expected**: `advisory_counts_today.total` should increase by 1

#### 4e. Test Budget Downgrade Counter (Simulated)
```bash
# Simulate budget downgrade by using a low-budget user config
# Then trigger refresh → should increment budget_downgrade_count

# Check metrics after
curl -H "Authorization: Bearer {admin_token}" \
  'http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/' \
  | jq '.budget_downgrade_count_today'
```

---

## 🚀 Deployment Steps

### Step 1: Backend (Development)
```bash
cd backend
python manage.py collectstatic --noinput
python manage.py migrate
python manage.py runserver
```

### Step 2: Backend (Docker - Production)
```bash
# Already in origin/deploy branch
# Docker will auto-rebuild with latest code

# Restart backend service
docker-compose restart vninvest-backend

# Verify logs
docker logs vninvest-backend
```

### Step 3: Celery Workers
```bash
# Ensure workers restart with new code
docker-compose restart vninvest-celery-worker
docker-compose restart vninvest-celery-beat
```

### Step 4: Verify No Regressions
```bash
# Check that advisory generation still works
curl -X POST \
  -H "Authorization: Bearer {token}" \
  http://localhost:8000/api/whale-advisories/refresh/ \
  -d '{"symbol": "VCB"}'

# Should get 201 Created or 200 OK
```

---

## 📊 Monitoring After Deployment

### Metrics to Watch First Week

| Metric | Health Indicator | Action |
|--------|------------------|--------|
| `advisory_counts_today.total` | Should grow | If stuck at 0 → check Celery logs |
| `latency.p50_ms` | Should be < 2000ms | If > 5000ms → check AI provider |
| `token_burn.burn_pct` | Should be < 50% | If > 80% → budget issue |
| `provider_distribution` | Avoid single provider | If 100% openclaw → fallback issue |
| `budget_downgrade_count_today` | Should be low (<5/day) | If high → budget thresholds too aggressive |
| `ratelimit_429_counts_today` | Should be 0 | If > 0 → provider issues |

### Admin Dashboard Queries

```bash
# Daily snapshot
curl -s http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/ \
  | jq '.token_burn, .provider_distribution, .ratelimit_429_counts_today'

# Watch for spike in 429s
watch -n 5 'curl -s http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/ \
  | jq ".ratelimit_429_counts_today"'
```

---

## 🔧 Environment Variables (P2-Related)

Add these to `.env` or Portainer config:

```env
# Multi-model budget routing
ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT=20
ADVISORY_BUDGET_DOWNGRADE_MODEL_OPENAI=gpt-3.5-turbo
ADVISORY_BUDGET_DOWNGRADE_MODEL_CLAUDE=claude-3-haiku-20240307
ADVISORY_BUDGET_DOWNGRADE_MODEL_GEMINI=gemini-1.5-flash
ADVISORY_BUDGET_DOWNGRADE_MODEL_COPILOT=openai/gpt-4.1-mini

# Optional: AI provider rate-limit tuning (already set in P1)
AI_PROVIDER_RATE_LIMIT_MAX_RETRIES=3
AI_PROVIDER_RATE_LIMIT_RETRY_BASE_SECONDS=5
AI_PROVIDER_RATELIMIT_PAUSE_SECONDS=120
MAX_CHART_CONTEXT_BYTES=65536
```

---

## 📈 Expected Outcomes (First Week Post-Deploy)

### Before P2
- ❌ When OpenAI 429 → all advisories skipped for 120s
- ❌ No cost optimization → always uses primary provider
- ❌ No latency metrics → blind to performance issues

### After P2 ✅
- ✅ Budget-aware model routing → cheaper models when budget low
- ✅ Latency visibility → can spot p95 spikes
- ✅ Provider load distribution → via observability tracking
- ✅ Cost control → 10x cheaper advisory when budget < 20%
- ✅ 429 tracking → can see if provider issue or service limit

---

## 🐛 Troubleshooting

### Issue: Advisory metrics endpoint returns 403 Forbidden
**Cause**: Not authenticated as admin

**Fix**:
```bash
# Use admin token
curl -H "Authorization: Bearer $(get-admin-token)" \
  http://localhost:8000/api/admin-ops/runtime-kpi/advisory-metrics/
```

### Issue: `budget_downgrade_count_today` always 0
**Cause**: No advisories generated yet, or all have budget > threshold

**Fix**:
- Trigger a few advisory generations
- Check if any user has remaining_budget < 20% of total_budget
- Manually lower ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT to 50% for testing

### Issue: Metrics endpoint returns empty arrays
**Cause**: No advisory audit logs yet (first time using)

**Fix**:
- Generate 5-10 advisories
- Wait 30 seconds for Celery to process
- Endpoint should populate after audit logs exist

### Issue: P95 latency > 10000ms
**Cause**: AI provider slow or network issue

**Fix**:
- Check provider_distribution: is one provider used too much?
- Check if 429 cooldowns are active
- Consider increasing ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT to trigger cheaper models more often

---

## ✅ Post-Deployment Checklist

- [ ] P2 code deployed to origin/deploy
- [ ] Backend service restarted
- [ ] Celery workers restarted
- [ ] `/api/admin-ops/runtime-kpi/advisory-metrics/` returns 200 OK
- [ ] Advisory generation works (at least 1 advisory created)
- [ ] Metrics endpoint shows non-zero counts
- [ ] Latency p50/p95 values populated
- [ ] No Celery errors in logs
- [ ] Token burn calculation working (burn_pct > 0 after advisory generation)
- [ ] No regression in existing advisory endpoints

---

## 🎯 Next: P3.1 Ready

Once P2 is verified:
1. ✅ Code is in origin/deploy
2. ✅ Metrics endpoint tested
3. ✅ Monitor for 24 hours
4. ⏭️ **Proceed to P3.1: Provider Failover**
   - Implement failover logic with auto-detection
   - Test cascading providers (opeai → claude → gemini)
   - Deploy & monitor failover metrics

---

## 📚 Related Documentation

- [ADVISORY_OBSERVABILITY_ARCHITECTURE.md](ADVISORY_OBSERVABILITY_ARCHITECTURE.md) — Full technical design
- [P3_1_PROVIDER_FAILOVER_DESIGN.md](archive/docs-flat/p3_1_provider/P3_1_PROVIDER_FAILOVER_DESIGN.md) — Next phase design docs
- Backend code: `backend/portfolio/tasks.py`, `backend/portfolio/views.py`
