# SPRINT 32: Troubleshooting Guide

**Auto-Generated:** 2026-04-12  
**Purpose:** Quick diagnosis & resolution for common issues

---

## 🚨 Common Issues & Solutions

---

## Issue #1: Config Changes Not Taking Effect

### Symptoms
- Update config via API (e.g., max_concurrency=20)
- API returns 200 OK
- But vnbroker adapter still uses old value (12)
- Current vnbroker calls ignore new concurrency

### Root Causes & Solutions

#### **Cause 1: Cache not invalidated (5-min TTL)**

```bash
# Check current cache TTL
redis-cli

> GET vnbroker:runtime:config
(nil)  # Cache miss, will load from DB

> TTL vnbroker:runtime:config
-2  # Expired
-1  # No expiry set (permanent)
(integer) 234  # 234 seconds remaining

# If TTL is too long, wait or manually invalidate
FLUSHDB
# or
DEL vnbroker:runtime:config
```

**Fix:** Wait 5 minutes OR manually clear Redis

#### **Cause 2: Signal handler not registered**

```bash
# Check if signal handler is imported
cd backend
python manage.py shell

>>> from django.db.models.signals import post_save
>>> from portfolio.models import RuntimeVnbrokerConfig
>>> from django.dispatch import Signal

# Verify signal handlers
>>> Signal().receivers
# Should show invalidate_vnbroker_config_cache in list

# Manual trigger if needed
>>> config = RuntimeVnbrokerConfig.objects.get(pk=1)
>>> from portfolio.adapters.vnbroker_adapter import VnbrokerConfigManager
>>> VnbrokerConfigManager.invalidate_cache()
>>> print("Cache cleared")
```

**Fix:** Restart Django (signal lost after code reload)

#### **Cause 3: Multiple Django processes (gunicorn/uWSGI)**

```bash
# Each process has its own _VNBROKER_GATE semaphore
# Cache invalidation only affects current process

# Check running processes
ps aux | grep gunicorn
# Output: 4 worker processes running

# Fix: Use shared cache backend (Redis) instead of per-process
# Verify Redis configured in settings.py
# CACHES['default']['BACKEND'] = 'django_redis.cache.RedisCache'
```

**Fix:** Ensure Redis cache backend configured for all processes

---

## Issue #2: API Returns 400 on Valid Config

### Symptoms
```bash
curl -X PATCH /api/admin-ops/vnbroker-config/update_config/ \
  -d '{"max_concurrency": 20}'

# Response
HTTP 400 Bad Request
{
  "errors": {
    "max_concurrency": ["must be between 1 and 50"]
  }
}
```

But 20 is between 1-50, so why rejected?

### Diagnosis

```python
# Test serializer validation directly
from portfolio.serializers import RuntimeVnbrokerConfigSerializer

test_data = {'max_concurrency': 20}
s = RuntimeVnbrokerConfigSerializer(data=test_data, partial=True)
s.is_valid()  # Should be True
s.errors  # Check error details
```

### Root Causes & Solutions

#### **Cause 1: JSON parsing error (sent as string)**

```bash
# Wrong: Sent as string "20", not number 20
curl -d '{"max_concurrency": "20"}'

# Fix: Send as number
curl -d '{"max_concurrency": 20}'

# Or in Python
import json
data = json.dumps({"max_concurrency": 20})
```

**Fix:** Ensure JSON valid (use `json.dumps()` or JSON formatter)

#### **Cause 2: Serializer validation bug**

```python
# Check if validator is working
from portfolio.models import RuntimeVnbrokerConfig
from django.core.exceptions import ValidationError

config = RuntimeVnbrokerConfig.get_or_create_singleton()
config.max_concurrency = 100  # > 50

# Model validation
from django.core.validators import MaxValueValidator
validator = MaxValueValidator(50)
try:
    validator(100)
except ValidationError as e:
    print(f"Validator error: {e}")
```

**Fix:** Check serializer.py `validate_max_concurrency()` method

---

## Issue #3: Admin UI Tab Not Appearing

### Symptoms
- AdminOps page loads ✓
- Other tabs (Overview, Whale, Governance) visible ✓
- Vnbroker Config tab NOT visible ✗
- No JavaScript errors in console

### Root Causes & Solutions

#### **Cause 1: Tab not added to frontend tabs array**

```bash
# Check AdminOps.jsx
grep -n "key: 'vnbroker'" frontend/src/pages/AdminOps.jsx

# If not found, tab not defined
```

**Fix:** Add to tabs array in AdminOps.jsx:

```jsx
const tabs = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'whale', label: 'Whale Ops' },
  { key: 'governance', label: 'Governance' },
  { key: 'prefetch', label: 'Prefetch' },
  { key: 'kpi', label: 'Runtime KPI' },
  { key: 'vnbroker', label: '⚙️ Vnbroker Config' },  // ADD THIS
];
```

#### **Cause 2: Component import missing**

```bash
# Check import statement
grep -n "VnbrokerConfigPanel" frontend/src/pages/AdminOps.jsx

# If import not found:
```

**Fix:** Add import at top of AdminOps.jsx:

```jsx
import VnbrokerConfigPanel from '../components/AdminOps/VnbrokerConfigPanel';
```

#### **Cause 3: Conditional render missing**

```bash
# Check if render condition exists
grep -n "activePage === 'vnbroker'" frontend/src/pages/AdminOps.jsx

# If not found:
```

**Fix:** Add conditional render in content section:

```jsx
{activePage === 'vnbroker' && <VnbrokerConfigPanel />}
```

#### **Cause 4: Frontend rebuild not done**

```bash
# After editing JSX files, must rebuild
cd frontend
npm run build

# For development mode with hot reload
npm start  # Will automatically rebuild
```

**Fix:** Rebuild frontend (`npm run build` or `npm start`)

---

## Issue #4: Permission Denied (403 Forbidden)

### Symptoms
```bash
curl -X GET /api/admin-ops/vnbroker-config/current/ \
  -H "Authorization: Bearer <token>"

# Response
HTTP 403 Forbidden
{"detail": "You do not have permission to perform this action"}
```

### Root Causes & Solutions

#### **Cause 1: User not admin/superuser**

```python
# Check user permissions
from django.contrib.auth.models import User

user = User.objects.get(username='testuser')
print(f"Is superuser: {user.is_superuser}")
print(f"Is staff: {user.is_staff}")

# Fix: Make user superuser
user.is_superuser = True
user.is_staff = True
user.save()
```

**Fix:** Make user superuser: `User.is_superuser = True`

#### **Cause 2: Permission classes not set in ViewSet**

```python
# Check portfolio/views.py
from rest_framework.permissions import IsAdminUser

class RuntimeVnbrokerConfigViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]  # Must have this!
```

**Fix:** Add `permission_classes = [IsAdminUser]` to ViewSet

---

## Issue #5: Adapter Not Respecting New Timeout

### Symptoms
- Update timeout_config["price_board"] = 15
- Save config ✓
- Next vnbroker call to price_board still times out at 8s
- Old timeout (8) still in effect

### Root Causes & Solutions

#### **Cause 1: _get_timeout() not updated to use DB config**

```python
# Check adapter code
# OLD (WRONG):
timeout = 8  # Hardcoded, ignores DB

# NEW (CORRECT):
def _get_timeout(channel: str) -> int:
    config = VnbrokerConfigManager.get_current_config()
    timeout_config = config.get('timeout_config', {})
    return timeout_config.get(channel, timeout_config.get('general', 8))
```

**Fix:** Update `_get_timeout()` to load from `VnbrokerConfigManager`

#### **Cause 2: ThreadPoolExecutor result() not using timeout**

```python
# Check vnbroker_adapter.py - the call site

# OLD (WRONG):
result = executor.submit(fetch_price_board_dataframe, symbols).result()
# Timeout not specified!

# NEW (CORRECT):
timeout = _get_timeout('price_board') or 8
result = executor.submit(fetch_price_board_dataframe, symbols).result(timeout=timeout)
```

**Fix:** Add `timeout=_get_timeout()` parameter

---

## Issue #6: Changelog Not Recording Changes

### Symptoms
- Update config successfully (200 OK)
- Check changelog: `GET /api/admin-ops/vnbroker-config/changelog/`
- Changelog is empty `[]`
- Or changelog doesn't show recent changes

### Root Causes & Solutions

#### **Cause 1: record_change() not called in ViewSet**

```python
# Check views.py - update_config action

# OLD (WRONG):
config = serializer.save()
return Response({...})
# No record_change() call!

# NEW (CORRECT):
config = serializer.save()
if changes:
    config.record_change(request.user, changes)  # ADD THIS
return Response({...})
```

**Fix:** Add `config.record_change(request.user, changes)` after save

#### **Cause 2: Changes dict is empty**

```python
# Check if changes dict has any entries
changes = {}
for field in request.data.keys():
    old_val = getattr(config, field)
    new_val = request.data[field]
    if old_val != new_val:  # This comparison might fail
        changes[field] = {'old': str(old_val), 'new': str(new_val)}

# Debug:
print(f"Changes: {changes}")  # Should not be empty
```

**Fix:** Check comparison logic (type coercion issues?)

```python
# Example fix:
old_val_str = str(getattr(config, field))
new_val_str = str(request.data[field])
if old_val_str != new_val_str:
    changes[field] = {'old': old_val_str, 'new': new_val_str}
```

---

## Issue #7: Database Migration Fails

### Symptoms
```bash
python manage.py migrate portfolio

# Error:
django.db.utils.OperationalError: column "max_concurrency" already exists
```

### Root Causes & Solutions

#### **Cause 1: Migration already applied (idempotent issue)**

```bash
# Check migration status
python manage.py showmigrations portfolio | grep runtime

# If you see a checkmark ✓, migration already applied

# Safe to skip (Django handles duplicates)
python manage.py migrate portfolio --skip-checks
```

**Fix:** Check if migration already applied, skip if yes

#### **Cause 2: Conflicting migrations**

```bash
# If multiple migrations add same column

# Option 1: Start fresh on dev
python manage.py migrate portfolio zero
python manage.py migrate portfolio

# Option 2: On production, use --fake to skip failed migration
python manage.py migrate portfolio --fake 0001_initial
python manage.py migrate portfolio
```

**Fix:** Resolve migration conflicts or rebuild DB

#### **Cause 3: PostgreSQL migration syntax**

```bash
# PostgreSQL vs SQLite differences
# JSONField might need different syntax

# Check migration file
cat backend/portfolio/migrations/000X_add_runtimevnbrokerconfig.py

# Verify JSONField syntax for Postgres:
# models.JSONField(default=dict, blank=True)  # ✓ Good
# models.JSONField(default='{}')  # ✗ Bad (string default)
```

**Fix:** Use `default=dict` or `default=list` (callable, not value)

---

## Issue #8: Performance - Slow API Responses

### Symptoms
- `GET /api/admin-ops/vnbroker-config/current/` takes > 500ms
- Expected < 100ms
- Django debug toolbar shows N+1 queries

### Root Causes & Solutions

#### **Cause 1: Missing database index**

```python
# Check model
class RuntimeVnbrokerConfig(models.Model):
    # pk=1 lookup without index?
    
    class Meta:
        indexes = [
            models.Index(fields=['pk']),  # Add this if not present
        ]
```

**Fix:** Add database index on `pk` (usually automatic for primary key)

#### **Cause 2: Serializer doing extra queries**

```python
# Check serializer - is it querying related User?
updated_by_username = serializers.CharField(
    source='updated_by.username',  # This requires USER join!
    read_only=True,
)

# Optimization might be needed:
# Configure select_related in ViewSet
class RuntimeVnbrokerConfigViewSet(viewsets.ViewSet):
    def current(self, request):
        config = RuntimeVnbrokerConfig.objects.select_related('updated_by').get(pk=1)
        serializer = RuntimeVnbrokerConfigSerializer(config)
```

**Fix:** Add `.select_related('updated_by')` to optimize query

#### **Cause 3: Redis network latency**

```bash
# Check Redis response time
redis-cli

> PING
PONG  # < 1ms

# If slow:
# - Check network connectivity
# - Verify Redis not overloaded
# - Use local Redis or optimize connection pool
```

**Fix:** Optimize Redis or use local cache for development

---

## Issue #9: Concurrency Limit Not Working

### Symptoms
- Set max_concurrency = 5
- Make 10 concurrent requests to vnbroker
- All 10 complete (not limited to 5)
- No "vnbroker_busy" responses

### Root Causes & Solutions

#### **Cause 1: BoundedSemaphore not used in adapter**

```python
# Check vnbroker_adapter.py

# OLD (WRONG):
_VNBROKER_MAX_CONCURRENCY = 12
# Semaphore not created

# NEW (CORRECT):
_VNBROKER_GATE = threading.BoundedSemaphore(value=_VNBROKER_MAX_CONCURRENCY)

# In adapter call:
with _VNBROKER_GATE:  # MUST use context manager
    result = adapter_call(...)
```

**Fix:** Use `BoundedSemaphore` with `with` statement

#### **Cause 2: enable_concurrent_limit = False**

```bash
# Check configuration
curl -X GET /api/admin-ops/vnbroker-config/current/ | grep concurrent_limit

# If enable_concurrent_limit: false, bypassed
```

**Fix:** Set `enable_concurrent_limit = true`

#### **Cause 3: Each Django worker has own semaphore**

```python
# Gunicorn 4 workers = 4 separate semaphores
# Each allows 5 = effectively 20 concurrent

# Solution: Use shared coordination (e.g., Redis)
# Or use single-threaded worker
```

**Fix:** Use shared backend OR single worker (performance tradeoff)

---

## Issue #10: Test Failures After Deployment

### Symptoms
```bash
pytest portfolio/tests/test_runtime_vnbroker_config.py

# Error:
FAILED - portfolio/tests/test_runtime_vnbroker_config.py::TestModel::test_singleton
RuntimeVnbrokerConfig matching query does not exist
```

### Root Causes & Solutions

#### **Cause 1: Database not migrated in test environment**

```bash
# Pytest uses test DB, must migrate first
pytest --no-migrations  # Don't run migrations - WRONG!
pytest  # Include migrations - CORRECT!

# Force migration:
python manage.py migrate portfolio --run-syncdb
pytest
```

**Fix:** Don't use `--no-migrations` flag

#### **Cause 2: Test database transaction rollback**

```python
# If test doesn't use @pytest.mark.django_db
@pytest.mark.django_db  # Add this!
def test_something():
    config = RuntimeVnbrokerConfig.objects.create(...)
```

**Fix:** Add `@pytest.mark.django_db` to test methods

#### **Cause 3: Cache not cleared between tests**

```python
# Tests may see stale cache from previous test
from django.core.cache import cache

def setUp(self):
    cache.clear()  # Clear before each test
    # or
    cache.set('test_key', 'value', 1)  # Short TTL
```

**Fix:** Clear cache in `setUp()` method

---

## 🆘 Emergency Procedures

### Scenario: API Completely Down

```bash
# 1. Check API server
curl http://localhost:8000/api/health/

# 2. Check logs
docker-compose logs backend | tail -50

# 3. Restart backend
docker-compose restart backend

# 4. Check database
docker-compose exec postgres psql -U postgres -d vninvest -c "SELECT COUNT(*) FROM portfolio_runtimevnbrokerconfig;"

# 5. Rollback if needed
git checkout previous-stable-commit
docker-compose up -d --build backend
```

### Scenario: Database Corrupted

```bash
# Restore from backup
docker-compose down
pg_restore -U postgres -d postgres < /backups/vninvest_pre-deploy.sql
docker-compose up -d
```

### Scenario: Cache Poisoned (Wrong Values)

```bash
# Full cache clear
redis-cli FLUSHDB
# Or specific key
redis-cli DEL vnbroker:runtime:config
```

---

## Quick Reference: Diagnostic Commands

```bash
# Configuration check
curl http://localhost:8000/api/admin-ops/vnbroker-config/current/ | jq

# Cache check
redis-cli GET vnbroker:runtime:config

# Signal handlers
python manage.py shell
>>> from django.db.models.signals import pre_delete, post_save
>>> post_save.receivers
[...]  # Check RuntimeVnbrokerConfig row

# Database check
psql -U postgres -d vninvest
SELECT * FROM portfolio_runtimevnbrokerconfig;

# Migration status
python manage.py showmigrations portfolio

# Admin UI check
curl http://localhost/admin/portfolio/runtimevnbrokerconfig/

# Performance profile
python manage.py runserver --profile
# Then measure API call
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12  
**Owner:** Engineering Team

