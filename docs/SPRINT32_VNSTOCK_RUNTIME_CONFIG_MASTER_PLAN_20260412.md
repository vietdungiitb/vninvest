# 🚀 SPRINT 32: Vnstock Runtime Configuration - Master Plan

**Sprint Duration:** 4 weeks (Weeks 13-16, April 12 - May 9, 2026)  
**Team:** 1 Backend Dev, 1 Frontend Dev, 1 QA  
**Priority:** P1 (Operational efficiency)  
**Status:** PLANNING

---

## 📊 Executive Summary

**Problem:** Every vnstock configuration change requires full system restart (30-60s downtime), blocking rapid tuning and troubleshooting.

**Solution:** Add `RuntimeVnstockConfig` model + AdminOps UI to adjust 18 vnstock parameters (concurrency, timeout, rate limits, provider sources) **without restart**.

**Impact:** 
- ✅ Zero-downtime config changes
- ✅ Real-time parameter tuning
- ✅ Audit trail for compliance
- ✅ Faster incident response

**Effort:** 40-48 dev-hours (3 phases, 2 weeks implementation + 2 weeks testing/polish)

---

## 🎯 Sprint Goals

| Goal | Success Criteria | Owner |
|------|-----------------|-------|
| **Phase 1 Complete:** Backend model + API | Migrations run, API endpoints tested, admin UI works | BE Dev |
| **Phase 2 Complete:** Adapter live reload | VnstockConfigManager integrated, signal handlers active | BE Dev |
| **Phase 3 Complete:** Frontend UI | VnstockConfigPanel component, all 18 fields editable | FE Dev |
| **UAT Complete:** All scenarios pass | S1-S4 pass on staging, no P1/P2 blockers | QA + PM |
| **Documentation Complete:** Ready for handover | Runbook, changelog, troubleshooting guide | BE Dev + QA |

---

## 📅 Timeline (4 weeks)

### **Week 1 (Apr 12-18): Phase 1 Backend**

| Day | Task | Owner | Hours | Status |
|-----|------|-------|-------|--------|
| Fri 12 | Design review + code freeze | BE Dev | 2 | 🟦 Ready |
| Mon 15 | Create RuntimeVnstockConfig model | BE Dev | 4 | 🟩 Todo |
| Tue 16 | Create serializer + ViewSet + URLs | BE Dev | 4 | 🟩 Todo |
| Wed 17 | Django admin interface + migration | BE Dev | 3 | 🟩 Todo |
| Thu 18 | Local testing + API validation | BE Dev + QA | 2 | 🟩 Todo |
| Fri 19 | Code review + fix issues | BE Dev | 2 | 🟩 Todo |
| **Total** | | | **17h** | |

**Deliverables:**
- ✅ RuntimeVnstockConfig model (Django ORM)
- ✅ DRF serializers (validation + coercion)
- ✅ ViewSet with 4 endpoints (GET, PATCH, POST reset, GET changelog)
- ✅ Django admin interface with audit
- ✅ Database migration script
- ✅ Unit tests (100% coverage on serializer)

---

### **Week 2 (Apr 22-26): Phase 2 Adapter Integration**

| Day | Task | Owner | Hours | Status |
|-----|------|-------|-------|--------|
| Mon 22 | Implement VnstockConfigManager | BE Dev | 3 | 🟩 Todo |
| Tue 23 | Add signal handlers + cache invalidation | BE Dev | 3 | 🟩 Todo |
| Wed 24 | Update adapter lazy-load logic | BE Dev | 4 | 🟩 Todo |
| Thu 25 | Integration testing (adapter + DB) | BE Dev + QA | 3 | 🟩 Todo |
| Fri 26 | Deploy to staging + smoke test | BE Dev | 2 | 🟩 Todo |
| **Total** | | | **15h** | |

**Deliverables:**
- ✅ VnstockConfigManager (lazy load + caching)
- ✅ Signal handlers (post_save invalidation)
- ✅ Timeout resolvers (per-channel from DB)
- ✅ Rate limit detection (from DB)
- ✅ Integration tests
- ✅ Staging deployment runbook

---

### **Week 3 (Apr 29-May 3): Phase 3 Frontend**

| Day | Task | Owner | Hours | Status |
|-----|------|-------|-------|--------|
| Mon 29 | Design UI mockups + API contract | FE Dev | 2 | 🟩 Todo |
| Tue 30 | Build VnstockConfigPanel component | FE Dev | 5 | 🟩 Todo |
| Wed May 1 | Add form validation + error handling | FE Dev | 3 | 🟩 Todo |
| Thu May 2 | Integration with AdminOps + API calls | FE Dev | 3 | 🟩 Todo |
| Fri May 3 | Testing + screenshot collection | FE Dev + QA | 2 | 🟩 Todo |
| **Total** | | | **15h** | |

**Deliverables:**
- ✅ VnstockConfigPanel.jsx (with 6 sections)
- ✅ Form inputs (18 configurable fields)
- ✅ Client-side validation
- ✅ Changelog viewer (expandable)
- ✅ Reset to defaults button
- ✅ Status indicator (last updated by user)
- ✅ i18n labels (Vietnamese)

---

### **Week 4 (May 6-9): UAT + Handover**

| Day | Task | Owner | Hours | Status |
|-----|------|-------|-------|--------|
| Tue 6 | Run UAT scenarios (S1-S4) | QA + PM | 4 | 🟩 Todo |
| Wed 7 | Bug fixes + re-test | BE Dev + FE Dev | 3 | 🟩 Todo |
| Thu 8 | Performance testing + edge cases | QA | 2 | 🟩 Todo |
| Fri 9 | Documentation + sign-off | All | 2 | 🟩 Todo |
| **Total** | | | **11h** | |

**Deliverables:**
- ✅ UAT evidence (screenshots, API responses, logs)
- ✅ All 4 scenarios passing (S1-S4 ✓)
- ✅ Troubleshooting guide
- ✅ Operational runbook
- ✅ Sign-off from QA/PM/Tech Lead

**Total Sprint Effort:** ~58 dev-hours

---

## 🛠️ Phase-by-Phase Code Specifications

### **Phase 1: Backend Model + API (Week 1)**

#### 1.1 Model File: `backend/portfolio/models.py`

```python
# ADD at end of file:
import datetime

class RuntimeVnstockConfig(models.Model):
    """
    Singleton configuration for vnstock adapter at runtime.
    Supports zero-downtime config changes via admin UI + API.
    """
    
    # === CONCURRENCY & RETRY ===
    max_concurrency = models.IntegerField(
        default=12,
        validators=[MinValueValidator(1)],
        help_text="Max concurrent vnstock requests (1-50)"
    )
    retry_attempts = models.IntegerField(
        default=1,
        validators=[MinValueValidator(0)],
        help_text="Number of retry attempts on failure (0-5)"
    )
    retry_backoff_seconds = models.FloatField(
        default=0.35,
        validators=[MinValueValidator(0.0)],
        help_text="Backoff time between retries in seconds (0.0-5.0)"
    )
    
    # === RATE LIMIT ===
    rate_limit_cooldown_seconds = models.IntegerField(
        default=20,
        validators=[MinValueValidator(5), MaxValueValidator(120)],
        help_text="Cooldown after detecting rate limit (5-120 seconds)"
    )
    
    # === TIMEOUT PER CHANNEL (JSON) ===
    timeout_config = models.JSONField(
        default=dict,
        help_text="Timeout per channel in seconds"
    )
    
    # === PRICE BOARD SOURCE ===
    price_board_source = models.CharField(
        max_length=50,
        default="price_board",
        choices=[("price_board", "VNStock Price Board (VCI)"), ("stock_intraday_data", "Stock Intraday (KBS)")],
        help_text="Primary source for price board"
    )
    fallback_sources = models.JSONField(
        default=list,
        help_text='Fallback sources, e.g. ["stock_intraday_data"]'
    )
    
    # === FEATURE TOGGLES ===
    enable_caching = models.BooleanField(default=True)
    enable_rate_limit_detection = models.BooleanField(default=True)
    enable_concurrent_limit = models.BooleanField(default=True)
    
    # === AUDIT ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    changelog = models.JSONField(default=list)
    
    class Meta:
        verbose_name = "Vnstock Runtime Configuration"
    
    @classmethod
    def get_or_create_singleton(cls):
        obj, created = cls.objects.get_or_create(pk=1)
        if created:
            obj.timeout_config = {
                "price_board": 8, "intraday": 8, "financial_ratio": 10,
                "history": 12, "listing": 12, "general": 8,
            }
            obj.save()
        return obj
    
    def record_change(self, user, changes: dict):
        entry = {
            "timestamp": str(datetime.datetime.now()),
            "user": user.username if user else "system",
            "changes": changes
        }
        if not isinstance(self.changelog, list):
            self.changelog = []
        self.changelog.append(entry)
        self.updated_by = user
        self.save()
    
    def to_dict(self):
        return {
            'max_concurrency': self.max_concurrency,
            'retry_attempts': self.retry_attempts,
            'retry_backoff_seconds': self.retry_backoff_seconds,
            'rate_limit_cooldown_seconds': self.rate_limit_cooldown_seconds,
            'timeout_config': self.timeout_config or {},
            'price_board_source': self.price_board_source,
            'fallback_sources': self.fallback_sources or [],
            'enable_caching': self.enable_caching,
            'enable_rate_limit_detection': self.enable_rate_limit_detection,
            'enable_concurrent_limit': self.enable_concurrent_limit,
            'updated_at': self.updated_at.isoformat(),
            'updated_by': self.updated_by.username if self.updated_by else None,
        }
```

**Success Criteria:**
- ✅ Model loads without errors
- ✅ All validators work (concurrency 1-50, timeout > 0, etc.)
- ✅ JSONField stores dict + list safely
- ✅ Singleton pattern works (`get_or_create_singleton()`)
- ✅ Test: `python manage.py shell` → `RuntimeVnstockConfig.get_or_create_singleton()`

---

#### 1.2 Serializer: `backend/portfolio/serializers.py`

```python
# ADD new class
from rest_framework import serializers
from portfolio.models import RuntimeVnstockConfig

class RuntimeVnstockConfigSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)
    
    class Meta:
        model = RuntimeVnstockConfig
        fields = [
            'max_concurrency', 'retry_attempts', 'retry_backoff_seconds',
            'rate_limit_cooldown_seconds', 'timeout_config',
            'price_board_source', 'fallback_sources',
            'enable_caching', 'enable_rate_limit_detection', 'enable_concurrent_limit',
            'updated_at', 'updated_by_username', 'changelog',
        ]
    
    def validate_max_concurrency(self, value):
        if not (1 <= value <= 50):
            raise serializers.ValidationError("max_concurrency must be between 1 and 50")
        return value
    
    def validate_timeout_config(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("timeout_config must be a JSON object")
        for key, val in value.items():
            if not isinstance(val, (int, float)) or val < 0:
                raise serializers.ValidationError(f"timeout for '{key}' must be positive")
        return value
```

**Success Criteria:**
- ✅ Serializer validates all fields
- ✅ Unit tests pass (100% coverage)
- ✅ Invalid data rejected with clear messages
- ✅ Test: `pytest portfolio/tests/test_serializers.py::TestRuntimeVnstockConfig`

---

#### 1.3 ViewSet: `backend/portfolio/views.py`

```python
# ADD new class
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser

class RuntimeVnstockConfigViewSet(viewsets.ViewSet):
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        config = RuntimeVnstockConfig.get_or_create_singleton()
        serializer = RuntimeVnstockConfigSerializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_config(self, request):
        config = RuntimeVnstockConfig.get_or_create_singleton()
        serializer = RuntimeVnstockConfigSerializer(config, data=request.data, partial=True)
        
        if serializer.is_valid():
            changes = {}
            for field in request.data.keys():
                old_val = getattr(config, field)
                new_val = request.data[field]
                if old_val != new_val:
                    changes[field] = {'old': str(old_val), 'new': str(new_val)}
            
            config = serializer.save()
            if changes:
                config.record_change(request.user, changes)
            
            return Response({
                'status': 'success',
                'message': 'Vnstock configuration updated',
                'config': RuntimeVnstockConfigSerializer(config).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def changelog(self, request):
        config = RuntimeVnstockConfig.get_or_create_singleton()
        return Response({'changelog': config.changelog, 'total_changes': len(config.changelog or [])})
    
    @action(detail=False, methods=['post'])
    def reset_to_defaults(self, request):
        config = RuntimeVnstockConfig.get_or_create_singleton()
        config.max_concurrency = 12
        config.retry_attempts = 1
        config.retry_backoff_seconds = 0.35
        config.rate_limit_cooldown_seconds = 20
        config.timeout_config = {...}  # Default dict
        config.price_board_source = "price_board"
        config.fallback_sources = ["stock_intraday_data"]
        config.enable_caching = True
        config.enable_rate_limit_detection = True
        config.enable_concurrent_limit = True
        config.record_change(request.user, {'action': 'reset_to_defaults'})
        config.save()
        
        return Response({
            'status': 'success',
            'message': 'Configuration reset to defaults',
            'config': RuntimeVnstockConfigSerializer(config).data
        })
```

**Success Criteria:**
- ✅ All 4 endpoints return 200 OK
- ✅ Partial PATCH works (e.g., only `max_concurrency`)
- ✅ Changelog records changes correctly
- ✅ Reset works and records in changelog
- ✅ Test: `pytest portfolio/tests/test_views.py::TestRuntimeVnstockConfigViewSet`

---

#### 1.4 URL Routing: `backend/config/urls.py`

```python
# UPDATE existing router registration or add new:
from rest_framework.routers import DefaultRouter
from portfolio.views import RuntimeVnstockConfigViewSet

router = DefaultRouter()
router.register(r'admin-ops/vnstock-config', RuntimeVnstockConfigViewSet, basename='vnstock-config')

urlpatterns = [
    # ... keep existing patterns ...
    path('api/', include(router.urls)),
]
```

**Success Criteria:**
- ✅ `GET /api/admin-ops/vnstock-config/current/` returns 200
- ✅ `PATCH /api/admin-ops/vnstock-config/update_config/` accepts valid data
- ✅ `POST /api/admin-ops/vnstock-config/reset_to_defaults/` works
- ✅ `GET /api/admin-ops/vnstock-config/changelog/` returns list

---

#### 1.5 Migration

```bash
# Week 1 Friday
cd backend
python manage.py makemigrations portfolio
python manage.py migrate portfolio
python manage.py shell
>>> from portfolio.models import RuntimeVnstockConfig
>>> RuntimeVnstockConfig.get_or_create_singleton()
>>> config = RuntimeVnstockConfig.objects.get(pk=1)
>>> print(config.to_dict())
```

**Success Criteria:**
- ✅ Migration file created (e.g., `0042_runtimevnstockconfig.py`)
- ✅ Migration applies without errors
- ✅ Singleton created with correct defaults
- ✅ Model queryable from Django shell

---

### **Phase 2: Adapter Integration (Week 2)**

#### 2.1 VnstockConfigManager: `backend/portfolio/adapters/vnstock_adapter.py`

```python
# ADD new class to adapter file:
from django.core.cache import cache as django_cache

_CONFIG_CACHE_KEY = "vnstock:runtime:config"
_CONFIG_CACHE_TIMEOUT = 300  # 5 minutes

class VnstockConfigManager:
    """Manage runtime vnstock configuration with caching."""
    
    @staticmethod
    def get_current_config():
        """Get current configuration from DB cache layer."""
        cached = django_cache.get(_CONFIG_CACHE_KEY)
        if cached:
            return cached
        
        try:
            from portfolio.models import RuntimeVnstockConfig
            config = RuntimeVnstockConfig.get_or_create_singleton()
            config_dict = config.to_dict()
            django_cache.set(_CONFIG_CACHE_KEY, config_dict, _CONFIG_CACHE_TIMEOUT)
            return config_dict
        except Exception as e:
            logger.error(f"Failed to load runtime config: {e}")
            return _get_default_config()
    
    @staticmethod
    def invalidate_cache():
        """Invalidate config cache (called after update)."""
        django_cache.delete(_CONFIG_CACHE_KEY)

def _get_default_config():
    return {
        'max_concurrency': 12, 'retry_attempts': 1, 'retry_backoff_seconds': 0.35,
        'rate_limit_cooldown_seconds': 20,
        'timeout_config': {"price_board": 8, "intraday": 8, "financial_ratio": 10, ...},
        'enable_caching': True, 'enable_rate_limit_detection': True,
        'enable_concurrent_limit': True,
    }
```

**Success Criteria:**
- ✅ Config loads from DB on first call
- ✅ Config cached for 5 minutes
- ✅ `invalidate_cache()` clears Redis entry
- ✅ Fallback to defaults if DB fails

---

#### 2.2 Signal Handler: `backend/portfolio/signals.py` (or models.py)

```python
# ADD after RuntimeVnstockConfig model:
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=RuntimeVnstockConfig)
def invalidate_vnstock_config_cache(sender, instance, created, **kwargs):
    """Invalidate adapter cache when config changes."""
    if not created:  # Only on update
        from portfolio.adapters.vnstock_adapter import VnstockConfigManager, _initialize_adapter
        VnstockConfigManager.invalidate_cache()
        _initialize_adapter()
        logger.info(f"Vnstock adapter reloaded. Updated by: {instance.updated_by}")
```

**Success Criteria:**
- ✅ Signal fires after config update
- ✅ Cache invalidated in Redis
- ✅ Adapter reloaded with new settings
- ✅ Log message appears

---

#### 2.3 Lazy-Load Timeout Resolver

```python
# UPDATE existing _get_timeout function:
def _get_timeout(channel: str) -> int:
    """Get timeout for channel from runtime config."""
    config = VnstockConfigManager.get_current_config()
    timeout_config = config.get('timeout_config', {})
    return timeout_config.get(channel, timeout_config.get('general', 8))
```

**Success Criteria:**
- ✅ Timeout loaded from DB config, not env var
- ✅ Per-channel timeouts respected
- ✅ Fallback to 'general' channel if specific not found

---

### **Phase 3: Frontend UI (Week 3)**

#### 3.1 Component: `frontend/src/components/AdminOps/VnstockConfigPanel.jsx`

See full implementation in [VNSTOCK_RUNTIME_CONFIG_ROADMAP_20260412.md](VNSTOCK_RUNTIME_CONFIG_ROADMAP_20260412.md) Phase 3.

**Success Criteria:**
- ✅ All 18 fields editable
- ✅ Form validation (min/max ranges)
- ✅ Save/Reset buttons functional
- ✅ Changelog expandable
- ✅ Status indicator shows last updater

---

#### 3.2 Integration into AdminOps

```jsx
// frontend/src/pages/AdminOps.jsx - UPDATE tabs array:
const tabs = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'whale', label: 'Whale Ops' },
  { key: 'governance', label: 'Governance' },
  { key: 'prefetch', label: 'Prefetch' },
  { key: 'kpi', label: 'Runtime KPI' },
  { key: 'vnstock', label: '⚙️ Vnstock Config' },  // NEW
];

// ADD import at top:
import VnstockConfigPanel from '../components/AdminOps/VnstockConfigPanel';

// ADD conditional render in content section:
{activePage === 'vnstock' && <VnstockConfigPanel />}
```

**Success Criteria:**
- ✅ Tab appears in UI
- ✅ Panel loads on click
- ✅ All form inputs render
- ✅ API calls work (GET /current, PATCH /update, etc.)

---

## ✅ UAT Scenarios (Week 4)

### **S1: Configure policy from AdminOps**

```gherkin
Given: Admin opens AdminOps → Vnstock Config tab
When:
  1. Change max_concurrency from 12 → 20
  2. Click "Lưu Config"
Then:
  ✅ Response 200 OK
  ✅ Health endpoint shows max_concurrency=20
  ✅ Changelog records [timestamp, admin_user, changes]
```

**Evidence:**
- Screenshot of form before/after
- API response payload
- Changelog entry

---

### **S2: Timeout per channel**

```gherkin
Given: Current timeout_config = {price_board: 8, intraday: 8, ...}
When:
  1. Update price_board timeout → 12s
  2. Save config
  3. vnstock calls price_board API with timeout=12s
Then:
  ✅ Request respects new timeout (monitored via logs)
  ✅ No timeout errors for slow responses
```

**Evidence:**
- Form screenshot
- Backend log showing timeout=12s
- Metrics showing no 504/timeout errors

---

### **S3: Rate limit cooldown multiplier**

```gherkin
Given: cooldown_multiplier_on_429 = 2.0, current interval = 35s
When:
  1. Vnstock detects 429 error
  2. Adapter applies multiplier
Then:
  ✅ Next interval = 35s × 2.0 = 70s
  ✅ Does not exceed max_interval_seconds (e.g., 1800s)
```

**Evidence:**
- Metrics showing interval increase after 429
- Log showing "Rate limit detected, multiplying interval"

---

### **S4: Invalid config prevention**

```gherkin
Given: Form has validation rules (e.g., max_concurrency 1-50)
When:
  1. Try to set max_concurrency = 100
  2. Click Save
Then:
  ✅ Frontend validation blocks or shows error
  ✅ Backend returns 400 with field error message
  ✅ Config not saved
```

**Evidence:**
- Screenshot showing validation error
- API response with error details

---

## 📋 Task Breakdown for Developers

### **Backend Developer Tasks**

**Week 1:**
- [ ] Day 1: Create model (3h)
- [ ] Day 1: Create serializer (2h)
- [ ] Day 2: Create ViewSet (3h)
- [ ] Day 2: Update URLs (1h)
- [ ] Day 3: Create migration (1h)
- [ ] Day 3: Django admin setup (2h)
- [ ] Day 4: Unit tests (2h)
- [ ] Day 4: Integration tests (1h)
- [ ] Day 5: Code review + fixes (2h)

**Week 2:**
- [ ] Day 1: VnstockConfigManager (3h)
- [ ] Day 2: Signal handlers (2h)
- [ ] Day 2: Lazy-load updates (2h)
- [ ] Day 3-4: Integration testing (3h)
- [ ] Day 5: Staging deployment (2h)

---

### **Frontend Developer Tasks**

**Week 3:**
- [ ] Day 1: Mockup review (1h)
- [ ] Day 1-2: VnstockConfigPanel component (5h)
- [ ] Day 3: Form validation (3h)
- [ ] Day 4: Integration into AdminOps (2h)
- [ ] Day 5: Testing + screenshots (2h)

---

### **QA Tasks**

**Week 4:**
- [ ] Prepare UAT data/scripts (2h)
- [ ] Execute UAT S1-S4 (4h)
- [ ] Log bugs + track (2h)
- [ ] Re-test after fixes (3h)
- [ ] Sign-off (1h)

---

## 📦 Auto-Generated Support Documents

### Document 1: `SPRINT32_CODE_TEMPLATES.md`
- Model boilerplate
- Serializer template
- ViewSet template
- Signal handler template
- Migration example

### Document 2: `SPRINT32_APIdoc.md`
- 4 endpoints with curl examples
- Request/response schemas
- Error codes and messages
- Rate limiting behavior

### Document 3: `SPRINT32_TESTING_GUIDE.md`
- Unit test cases
- Integration test setup
- Manual test scenarios (S1-S4)
- Performance benchmarks

### Document 4: `SPRINT32_DEPLOYMENT_RUNBOOK.md`
- Pre-deployment checklist
- Migration commands
- Rollback procedure
- Health checks post-deploy

### Document 5: `SPRINT32_TROUBLESHOOTING.md`
- Common issues + solutions
- Log patterns to watch
- Performance tuning tips
- Emergency procedures

---

## 📈 Success Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| **Code coverage** | ≥ 95% | |
| **Config change latency** | < 100ms | |
| **Cache hit rate** | ≥ 98% | |
| **UAT pass rate** | 100% (S1-S4) | |
| **Zero-downtime deployment** | Yes | |
| **Documentation completeness** | 100% | |

---

## 🚨 Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Config corruption** | High | Validation on all fields + changelog backup |
| **Cache staleness** | Medium | 5-min TTL + signal invalidation |
| **Concurrent updates** | Low | Singleton pattern + optimistic locking |
| **Permission bypass** | High | `IsAdminUser` permission + audit log |
| **Performance regression** | Medium | Benchmark before/after, load test on staging |

---

## 📞 Communication Plan

**Weekly Sync:** Monday 10:00 AM (all roles)
- Sprint progress update
- Blockers + decisions
- Code review feedback

**Daily Standup:** 9:30 AM (Dev + QA)
- What done yesterday
- Today's focus
- Any blockers

**Sign-off Call:** Friday May 9 (PM + QA + Tech Lead)
- UAT results
- Release go/no-go
- Handover documentation

---

## 🎯 Acceptance Criteria (DoD)

- [ ] All 3 phases complete with code review approved
- [ ] 100% unit test coverage on new code
- [ ] All 4 UAT scenarios passing (S1-S4)
- [ ] Zero P1/P2 blockers
- [ ] Documentation complete + reviewed
- [ ] Zero-downtime deployment verified on staging
- [ ] Performance benchmarks meet targets
- [ ] Changelog audit trail functional
- [ ] Admin UI tested on Chrome/Firefox/Safari
- [ ] Signed off by QA + PM + Tech Lead

---

## 📚 Related Documents

- [VNSTOCK_RUNTIME_CONFIG_ROADMAP_20260412.md](VNSTOCK_RUNTIME_CONFIG_ROADMAP_20260412.md) - Detailed implementation guide
- [PREFETCH_POLICY_VS_VNSTOCK_CONFIG_ANALYSIS_20260412.md](PREFETCH_POLICY_VS_VNSTOCK_CONFIG_ANALYSIS_20260412.md) - Architecture analysis
- [SPRINT32_CODE_TEMPLATES.md](SPRINT32_CODE_TEMPLATES.md) - Code templates (auto-generated)
- [SPRINT32_APIdoc.md](SPRINT32_APIdoc.md) - API documentation (auto-generated)
- [SPRINT32_TESTING_GUIDE.md](SPRINT32_TESTING_GUIDE.md) - Testing guide (auto-generated)
- [SPRINT32_DEPLOYMENT_RUNBOOK.md](SPRINT32_DEPLOYMENT_RUNBOOK.md) - Deployment steps (auto-generated)
- [SPRINT32_TROUBLESHOOTING.md](SPRINT32_TROUBLESHOOTING.md) - Troubleshooting (auto-generated)

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12  
**Owner:** Engineering Team  
**Status:** READY FOR SPRINT

