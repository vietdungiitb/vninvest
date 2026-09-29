# T11 Legacy Code Removal - Phase 2 Remaining Work (API Migration)

**Date:** 2025-05-12  
**Status:** ⏳ In Progress (Phase 1-3 complete, Phase 4+ pending)  
**Objective:** Complete legacy code removal by updating/deleting all imports of deleted models

---

## Executive Summary

Phases 1-3 of T11 (model deletion, admin cleanup) are **complete**. However, 22 additional files still import the 4 deleted models:
- **Portfolio** (legacy backend.portfolio.Portfolio → core model)
- **PriceAlertRule** (legacy → core PriceAlert)
- **WatchlistGroup** (legacy → core Watchlist)
- **WatchlistItem** (legacy → core WatchlistItem)

**Phase 4+ Goal:** Update/delete these files to use core models exclusively OR delete deprecated legacy code.

---

## Files Requiring Update/Deletion (22 Total)

### Category A: Legacy API Views (Should use core models or be deleted)
**Status:** Candidate for deletion OR migration to packages/core API routes

1. **views.py** (Legacy portfolio API views)
   - Line 69: `from .models import Portfolio, ... WatchlistGroup, WatchlistItem, PriceAlertRule`
   - Usage: All portfolio/watchlist/pricealert endpoints
   - **Action Required:** Replace with core API routes (packages/core/backend/src/user_workspace/views.py)
   - Impact: HIGH (primary API interface)

2. **views_portfolio_watchlist.py** (Portfolio/watchlist management)
   - Line 22: Imports Portfolio, WatchlistGroup, WatchlistItem
   - Line 21: `from .services import sync_portfolio_prices, sync_watchlist_prices`
   - **Action Required:** Update to core models OR delete if functionality moved to core
   - Impact: HIGH

3. **views_analytics_extended.py** (Analytics)
   - Line 9: `from .models import Portfolio, DailyPrice`
   - **Action Required:** Update to core Portfolio OR delete
   - Impact: MEDIUM

4. **views_dashboard_risk.py** (Risk dashboard)
   - Line 12: `from .models import OrderFlowSignal, Portfolio, WhaleAlertEvent`
   - **Action Required:** Update to core Portfolio OR delete
   - Impact: MEDIUM

5. **views_stock_workspace_admin.py** (Stock workspace admin)
   - Line 14: `from .models import ... Portfolio, ... WatchlistItem`
   - **Action Required:** Update to core models OR delete
   - Impact: MEDIUM

6. **serializers.py** (DRF serializers for legacy API)
   - Line 6: `from .models import Portfolio, ... WatchlistGroup, WatchlistItem, PriceAlertRule`
   - **Action Required:** Delete - should use packages/core serializers
   - Impact: HIGH (blocks API migration)

### Category B: Legacy Business Logic Services (Deprecate or rewrite)
**Status:** Candidate for deprecation OR migration to packages/core

7. **starter_portfolio_service.py** (Portfolio initialization)
   - Line 11: `from .models import Portfolio, SubAccount, UserConfig`
   - **Action Required:** Rewrite to use core Portfolio OR delete
   - Impact: MEDIUM

8. **services_global_signal_universe.py** (Signal universe)
   - Line 7: `from .models import PriceAlertRule, ... WatchlistItem`
   - **Action Required:** Update to use core models OR delete
   - Impact: MEDIUM

9. **services_global_signal_distribution.py** (Signal distribution)
   - Line 7: `from portfolio.models import ... WatchlistItem`
   - **Action Required:** Update to core WatchlistItem OR delete
   - Impact: LOW-MEDIUM

10. **view_helpers.py** (Stock management helpers)
    - Line 8: `from .models import PriceAlertRule, SecuritiesGroup`
    - **Action Required:** Update to core PriceAlert OR delete
    - Impact: MEDIUM

11. **stock_workspace_helpers.py** (Stock workspace helpers)
    - Line 7: `from .models import ... WatchlistItem`
    - **Action Required:** Update to core WatchlistItem OR delete
    - Impact: MEDIUM

### Category C: Celery/Background Tasks (Update or deprecate)
**Status:** Candidate for deletion if functionality moved to core

12. **tasks_sync.py** (Sync tasks)
    - Line 6: `from portfolio.models import TrackedSymbol, WatchlistGroup`
    - **Action Required:** Update to core Watchlist OR delete
    - Impact: MEDIUM

13. **tasks_news_digest.py** (News digest generation)
    - Line 53: `from portfolio.models import PortfolioNewsDigest, WatchlistItem`
    - Line 167: `from portfolio.models import WatchlistItem`
    - **Action Required:** Update to core WatchlistItem OR delete
    - Impact: MEDIUM

14. **tasks_order_flow.py** (Order flow monitoring)
    - Line 15: `from portfolio.models import TrackedSymbol, UserConfig, WatchlistItem`
    - **Action Required:** Update to core WatchlistItem OR delete
    - Impact: LOW-MEDIUM

15. **tasks_stock_profile_sync.py** (Stock profile sync)
    - Line 53: `from portfolio.models import StockProfile, TrackedSymbol, WatchlistItem`
    - **Action Required:** Update to core WatchlistItem OR delete
    - Impact: MEDIUM

16. **tasks_whale_broadcast.py** (Whale alerts broadcast)
    - Line 7: `from portfolio.models import TrackedSymbol, UserAlertHistory, WatchlistItem`
    - **Action Required:** Update to core WatchlistItem OR delete
    - Impact: LOW-MEDIUM

### Category D: Integration/Support Services (Update or deprecate)
**Status:** Lower priority, update as part of general cleanup

17. **trading_service.py** (Trading operations)
    - Line 5: `from .models import Portfolio, SubAccount, Transaction`
    - **Action Required:** Update to core Portfolio OR delete
    - Impact: MEDIUM

18. **telegram_service.py** (Telegram bot service)
    - Line 195: `from portfolio.models import WatchlistGroup`
    - Line 284: `from portfolio.models import WatchlistItem`
    - **Action Required:** Update to core Watchlist/WatchlistItem OR delete
    - Impact: LOW

19. **whale_feed_helpers.py** (Whale feed processing)
    - Line 25: `from .models import TrackedSymbol, UserConfig, WatchlistGroup`
    - **Action Required:** Update to core Watchlist OR delete
    - Impact: LOW

### Category E: AI/Advisory Services (Check if deprecated)
**Status:** Verify if used; may already be superseded

20. **ai_context.py** (AI context building)
    - Line 10: `from .models import ... PriceAlertRule, ...`
    - **Action Required:** Update to core PriceAlert OR delete if deprecated
    - Impact: MEDIUM

21. **views_stock_management.py** (Stock management admin)
    - Line 13: `from .models import PriceAlertRule, ...`
    - **Action Required:** Update to core PriceAlert OR delete
    - Impact: LOW-MEDIUM

22. **views_partner_admin.py** (Partner administration)
    - Line 14: May import from partner/tenant models
    - **Action Required:** Check imports; likely OK (tenant/service account models not deleted)
    - Impact: LOW (verify)

---

## Recommended Cleanup Strategy

### Phase 4a: High-Impact API Views (1-3 weeks)
**Priority:** CRITICAL  
**Files:** views.py, serializers.py, views_portfolio_watchlist.py  
**Action:**
1. Identify which endpoints are actively used by frontend
2. Verify core models have equivalent functionality
3. Migrate endpoints to use core models
4. Update/create core serializers in packages/core
5. Test all CRUD operations
6. Delete legacy views.py imports and registrations

### Phase 4b: Medium-Impact Services (1-2 weeks)
**Priority:** HIGH  
**Files:** starter_portfolio_service.py, trading_service.py, services_global_signal_*.py  
**Action:**
1. Audit usage (grep for imports of these services)
2. Decide: migrate to core or delete entirely
3. If migrating: update imports and model references
4. If deleting: verify no active code depends on it
5. Remove/deprecate as needed

### Phase 4c: Low-Impact Tasks & Helpers (1 week)
**Priority:** MEDIUM  
**Files:** tasks_*, telegram_service.py, whale_feed_helpers.py  
**Action:**
1. Audit Celery task usage (check beat schedule)
2. Update active tasks to use core models
3. Deprecate/delete unused tasks
4. Update helpers for new model paths

### Phase 4d: Verification & Testing (1 week)
**Priority:** HIGH  
**Action:**
1. Run full test suite (all backends, packages/core)
2. Test API endpoints with real data
3. Verify no lingering imports of deleted models
4. Integration test with frontend
5. Production readiness assessment

---

## Success Criteria

✅ **ALL of the following must be true:**
- [ ] 0 imports of Portfolio, PriceAlertRule, WatchlistGroup, WatchlistItem from backend.portfolio
- [ ] All active API endpoints tested and working with core models
- [ ] All Celery tasks updated or deprecated
- [ ] Full test suite passing (100% on packages/core + relevant legacy tests)
- [ ] Django check: 0 issues
- [ ] No migration conflicts or data inconsistencies

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Breaking API contracts | HIGH | Comprehensive API testing + version gates if needed |
| Data loss from cascade deletes | MEDIUM | No production data exists (fresh system) |
| Celery task failures | MEDIUM | Monitor task queues + alert on errors |
| Serializer incompatibility | MEDIUM | Test serialization of core models matches legacy API contract |

---

## Timeline Estimate

- **Phase 4a (API views):** 1-3 weeks
- **Phase 4b (services):** 1-2 weeks  
- **Phase 4c (tasks):** 1 week
- **Phase 4d (testing):** 1 week
- **Total:** 4-7 weeks (T12 Epic)

---

## Next Steps (Immediate)

1. **Choose strategy:** Decide which files to migrate vs delete
2. **Prioritize:** Focus on high-impact API views first (views.py, serializers.py)
3. **Create task breakdown:** T12a, T12b, T12c subtasks
4. **Start T12a:** "API Views Migration" - update views.py to use core models
5. **Parallel:** Run grep audit to find all function calls to deleted model queries

---

## References

- **Models deleted:** Portfolio, WatchlistGroup, WatchlistItem, PriceAlertRule
- **Authority models (core):** packages/core/backend/src/user_workspace/models.py
- **Previous audits:** AUDIT_T11_LEGACY_CODE_REMOVAL_COMPLETE_20260512.md
- **Module tree:** module_tree_full.md (may need regeneration after cleanup)
