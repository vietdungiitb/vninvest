# T12 Phase 4a - API Views Migration Implementation Plan

**Date:** 2025-05-12  
**Scope:** Update legacy API views (views.py, views_portfolio_watchlist.py, views_stock_management.py, serializers.py) to use core models  
**Priority:** CRITICAL (blocking API functionality)  
**Timeline:** 2-3 weeks  

---

## Executive Summary

The legacy API views in `backend/portfolio/` still import 4 deleted models:
- **Portfolio** → Core Portfolio (packages/core.Portfolio)
- **WatchlistGroup** → Core Watchlist  
- **WatchlistItem** → Core WatchlistItem
- **PriceAlertRule** → Core PriceAlert

These imports cause Django initialization to fail, blocking all tests and API endpoints.

### Migration Strategy

**Option A: Direct Import from packages/core (RECOMMENDED)**
- Add packages/core/backend/src to Python path
- Import core models directly: `from user_workspace.models import Portfolio, Watchlist, PriceAlert, WatchlistItem`
- Update views + serializers to use core models
- Keep legacy code in backend/portfolio as a compatibility layer (deprecated but still there)

**Option B: Complete Refactor (Not chosen - too risky)**
- Move all portfolio/watchlist/pricealert logic to packages/core API views
- Delete legacy backend/portfolio API views
- Risk: Breaks all existing frontend clients immediately

**Selected:** Option A (minimum viable migration)

---

## Detailed Migration Plan

### Phase 4a-1: Serializers Migration (Day 1)

**File:** `backend/portfolio/serializers.py`

**Current State:**
```python
from .models import Portfolio, Transaction, ... WatchlistGroup, WatchlistItem, PriceAlertRule
```

**Action:**
1. Add sys.path setup to import from packages/core
2. Update imports to use core models:
   ```python
   # Add at top of serializers.py after other imports:
   import sys
   import os
   
   # Add packages/core/backend/src to path for core model imports
   _packages_core_src = os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
   if os.path.exists(_packages_core_src) and _packages_core_src not in sys.path:
       sys.path.insert(0, _packages_core_src)
   
   # Now import core models
   from user_workspace.models import Portfolio, Watchlist, PriceAlert, WatchlistItem
   ```

3. Update serializer classes:
   - `PortfolioSerializer`: `model = Portfolio` (from core)
   - `WatchlistGroupSerializer` → `WatchlistSerializer`: `model = Watchlist` (from core)
   - `WatchlistItemSerializer`: `model = WatchlistItem` (from core)
   - `PriceAlertRuleSerializer` → `PriceAlertSerializer`: `model = PriceAlert` (from core)

4. Update field mappings if any differ between legacy and core models

**Success Criteria:**
- ✅ All serializers instantiate core models without import errors
- ✅ Serializer validation passes for core model fields
- ✅ No lingering references to deleted legacy models

---

### Phase 4a-2: Portfolio/Watchlist Views Migration (Day 2-3)

**File:** `backend/portfolio/views_portfolio_watchlist.py`

**Current State:**
```python
from .models import Portfolio, WatchlistGroup, WatchlistItem
class WatchlistGroupListCreateView(generics.ListCreateAPIView):
    serializer_class = WatchlistGroupSerializer
    queryset = WatchlistGroup.objects.filter(user=...)
```

**Action:**
1. Add sys.path setup (same as serializers.py)
2. Update imports:
   ```python
   from user_workspace.models import Portfolio, Watchlist, PriceAlert, WatchlistItem
   ```
3. Update view classes:
   - Rename `WatchlistGroupListCreateView` → keep same for backward compat, but use core Watchlist
   - Rename `WatchlistGroupDetailView` → keep same, use core Watchlist
   - Update querysets: `WatchlistGroup.objects` → `Watchlist.objects`
   - Update `group` foreign key references → `watchlist` (if applicable)

4. Example change:
   ```python
   # BEFORE:
   class WatchlistGroupListCreateView(generics.ListCreateAPIView):
       queryset = WatchlistGroup.objects.all()
       serializer_class = WatchlistGroupSerializer
       
       def get_queryset(self):
           return WatchlistGroup.objects.filter(user=self.request.user)
   
   # AFTER:
   class WatchlistGroupListCreateView(generics.ListCreateAPIView):
       queryset = Watchlist.objects.all()
       serializer_class = WatchlistSerializer
       
       def get_queryset(self):
           return Watchlist.objects.filter(user=self.request.user)
   ```

5. Fix model relationships:
   - WatchlistItem FK: `watchlist` (core) vs `group` (legacy) - need to update queryset filters
   - For backward compatibility with API contracts, may need to create aliases in views

6. Update sync_watchlist_prices calls (now deprecated but still in code)

**Success Criteria:**
- ✅ All views instantiate core models without import errors
- ✅ Watchlist queries return core Watchlist objects
- ✅ WatchlistItem creation links to core Watchlist
- ✅ API response structure matches legacy contract (backward compat)

---

### Phase 4a-3: Price Alert Views Migration (Day 3-4)

**File:** `backend/portfolio/views_stock_management.py`

**Current State:**
```python
from .models import PriceAlertRule
class PriceAlertRuleListCreateView(generics.ListCreateAPIView):
    queryset = PriceAlertRule.objects.all()
```

**Action:**
1. Add sys.path setup
2. Update imports:
   ```python
   from user_workspace.models import PriceAlert
   ```
3. Update view classes:
   - Keep class names same (PriceAlertRuleListCreateView, PriceAlertRuleDetailView) for backward compat
   - Update queryset: `PriceAlertRule` → `PriceAlert`
   - Update serializer: use core PriceAlertSerializer
   - Note: Core PriceAlert has different notification fields vs legacy (notify_email, notify_sms, notify_push)

4. Field mapping example:
   ```python
   # Legacy PriceAlertRule fields:
   - condition, threshold, alert_type, is_enabled
   
   # Core PriceAlert fields:
   - alert_type (ABOVE/BELOW/EQUAL), price_threshold, status, is_enabled
   - notify_email, notify_sms, notify_push (new in core)
   ```

5. Update URL routing to match core model naming if needed

**Success Criteria:**
- ✅ All PriceAlert views use core models
- ✅ Serializer handles new notification fields
- ✅ Existing API contracts honored (backward compat)

---

### Phase 4a-4: Main Views Import Updates (Day 4)

**File:** `backend/portfolio/views.py`

**Current State:**
```python
from .models import Portfolio, Transaction, ... WatchlistGroup, WatchlistItem, PriceAlertRule
```

**Action:**
1. Add sys.path setup at top of file
2. Update model imports:
   ```python
   # Legacy imports (keep for non-portfolio items like Transaction, DailyPrice)
   from .models import (
       Transaction, DailyPrice, IntradayTick, OrderFlowSignal, AIAdvisoryComponentRecord, ... 
       # [DELETED: Portfolio, WatchlistGroup, WatchlistItem, PriceAlertRule → packages/core]
   )
   
   # Core model imports
   from user_workspace.models import Portfolio, Watchlist as WatchlistGroup, PriceAlert as PriceAlertRule, WatchlistItem
   ```
3. Update serializer imports if needed

**Success Criteria:**
- ✅ All portfolio/watchlist/pricealert imports reference core models
- ✅ No import errors on Django startup
- ✅ Backward compatibility maintained

---

### Phase 4a-5: Testing & Validation (Day 5-7)

**Action:**
1. **Syntax validation:**
   ```bash
   cd backend
   python -m py_compile portfolio/serializers.py
   python -m py_compile portfolio/views_portfolio_watchlist.py
   python -m py_compile portfolio/views_stock_management.py
   python -m py_compile portfolio/views.py
   ```

2. **Import validation:**
   ```bash
   python manage.py check
   ```

3. **Test execution:**
   ```bash
   # First, just try Django startup
   python manage.py shell < /dev/null
   
   # Then run portfolio tests
   python manage.py test portfolio.tests --keepdb
   
   # Run API tests
   python manage.py test portfolio.tests.test_api --keepdb
   ```

4. **API endpoint smoke tests:**
   - GET /api/portfolio/portfolios/ (list)
   - POST /api/portfolio/portfolios/ (create)
   - GET /api/portfolio/watchlists/ (list)
   - POST /api/portfolio/watchlists/items/ (add to watchlist)
   - GET /api/portfolio/pricealerts/ (list)
   - POST /api/portfolio/pricealerts/ (create price alert)

5. **Parity check:**
   - Verify API response structure matches legacy contract
   - Ensure no missing fields
   - Check tenant isolation still works (core models have tenant FK)

**Success Criteria:**
- ✅ Django startup: 0 errors
- ✅ Django check: 0 issues
- ✅ All portfolio tests passing
- ✅ All API smoke tests passing
- ✅ Response structure backward compatible

---

## Import Path Strategy

### Recommended sys.path Setup

Place at the top of each modified file after standard imports:

```python
import sys
import os

# Setup path for packages/core imports
_core_backend_src = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '../../packages/core/backend/src')
)
if os.path.exists(_core_backend_src) and _core_backend_src not in sys.path:
    sys.path.insert(0, _core_backend_src)

# Now safe to import from packages/core
from user_workspace.models import Portfolio, Watchlist, PriceAlert, WatchlistItem
```

This approach:
- ✅ Works in both standalone backend context and full Django setup
- ✅ Minimal changes to existing code structure
- ✅ Temporary solution (should be replaced by proper package installation in prod)
- ✅ No dependency on PYTHONPATH environment variables

---

## Files to Modify

| File | Changes | Lines Affected | Status |
|------|---------|-----------------|--------|
| serializers.py | Import + serialize core models | 50-100 | ⏳ PENDING |
| views_portfolio_watchlist.py | Update queryset + imports | 200-300 | ⏳ PENDING |
| views_stock_management.py | Update queryset + imports | 150-200 | ⏳ PENDING |
| views.py | Update imports | 70-90 | ⏳ PENDING |
| ai_context.py | Update PriceAlertRule import | 10-20 | ⏳ PENDING |
| view_helpers.py | Update PriceAlertRule import | 5-10 | ⏳ PENDING |

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Core model API incompatible | HIGH | Comprehensive API testing, response structure validation |
| Circular import dependency | MEDIUM | Test imports in isolation, validate sys.path setup |
| Tenant isolation broken | HIGH | Verify tenant FK in core models, test isolation |
| Backward compat broken | HIGH | Keep class names same, test API response contract |
| Performance regression | MEDIUM | Monitor query performance, add indexes if needed |

---

## Success Criteria (Overall)

✅ **ALL of the following must be TRUE:**
- [ ] 0 import errors for deleted models
- [ ] Django startup succeeds (0 errors)
- [ ] Django check: 0 issues
- [ ] Portfolio API tests: 100% PASS
- [ ] Watchlist API tests: 100% PASS
- [ ] PriceAlert API tests: 100% PASS
- [ ] API response structure matches legacy contract (backward compat)
- [ ] Tenant isolation verified (multi-tenant queries)
- [ ] Full test suite passing

---

## Timeline Estimate

| Phase | Duration | Status |
|-------|----------|--------|
| 4a-1: Serializers | 1 day | ⏳ Not started |
| 4a-2: Portfolio/Watchlist Views | 2 days | ⏳ Not started |
| 4a-3: PriceAlert Views | 1 day | ⏳ Not started |
| 4a-4: Main Views Import | 0.5 days | ⏳ Not started |
| 4a-5: Testing & Validation | 2 days | ⏳ Not started |
| **Total** | **6.5 days** | **⏳ Ready to start** |

---

## Next Steps (Immediate)

1. ✅ User approves plan (THIS STEP)
2. Implement Phase 4a-1 (serializers)
3. Implement Phase 4a-2 (portfolio/watchlist views)
4. Implement Phase 4a-3 (pricealert views)
5. Implement Phase 4a-4 (main views imports)
6. Execute Phase 4a-5 (testing)
7. Commit with audit evidence

---

## References

- **Previous audit:** docs/AUDIT_T11_LEGACY_CLEANUP_PHASE2_REMAINING_WORK_20260512.md
- **Core models:** packages/core/backend/src/user_workspace/models.py
- **Legacy models (deleted):** backend/portfolio/models.py (Portfolio, WatchlistGroup, WatchlistItem, PriceAlertRule removed)
- **Test suite location:** backend/portfolio/tests/

