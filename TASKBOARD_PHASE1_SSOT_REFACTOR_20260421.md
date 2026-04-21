# TASKBOARD: Phase 1 - Logic Consolidation (SSOT Refactor)
**Project**: AI Advisory Enhancement & Market Discovery  
**Phase**: 1 of 4  
**Created**: 2026-04-21 | **Target Start**: 2026-04-22  
**Owner**: Backend Team  

---

## OVERVIEW
Consolidate all whale detection logic into a single `WhaleSignalEngine` service to eliminate data interpretation drift and prepare for market-wide discovery mode.

**Key Goals**:
- ✅ Create canonical signal detection service
- ✅ Migrate existing logic without breaking changes
- ✅ Pass unified unit tests (side detection parity)
- ✅ Setup database schema for market discovery

**Blocking Dependencies**: None (can start immediately)  
**Unblocks**: Phase 2 (Market Discovery API)

---

## SLICE 1: BACKEND - SERVICE ARCHITECTURE

### Task BE-01: Create WhaleSignalEngine Service Class
**Priority**: 🔴 CRITICAL | **Effort**: 8 hours | **Owner**: Backend Lead  
**Status**: [ ] Not Started

**Description**:
Create core service class at `backend/portfolio/services/whale_engine.py` with:
- Threshold resolution logic
- Side detection algorithm (canonical)
- Signal aggregation from IntradayTick
- Multi-scope support (watchlist/market)

**Acceptance Criteria**:
- [ ] File created with proper Django app structure
- [ ] `WhaleSignalEngine` class has `__init__()` method
- [ ] Docstrings for all public methods
- [ ] Import statements validated (no circular deps)
- [ ] Service registered in `apps.py` ready function

**Files to Create**:
- `backend/portfolio/services/__init__.py` (if not exists)
- `backend/portfolio/services/whale_engine.py` (NEW)

**Dependencies**: None (foundational)

---

### Task BE-02: Extract Threshold Resolution Logic
**Priority**: 🔴 CRITICAL | **Effort**: 4 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Extract `_resolve_user_whale_threshold_vnd()` logic from existing views/helpers and move to `WhaleSignalEngine.resolve_threshold()` method.

**Source Code to Refactor**:
- `backend/portfolio/views_stock_order_flow.py` - Find current threshold logic
- `backend/portfolio/whale_feed_helpers.py` - Find duplicate threshold logic

**Method Signature** (to implement):
```python
def resolve_threshold(self, user, symbol=None, scope="watchlist"):
    """
    Resolve user's whale threshold based on profile & subscription.
    Returns: Decimal (threshold in VND)
    """
    pass
```

**Acceptance Criteria**:
- [ ] Method extracts logic from both source files
- [ ] Handles user-specific thresholds (Pro/Basic tiers)
- [ ] Handles symbol-specific overrides
- [ ] Returns Decimal type (not float)
- [ ] Existing view code can call method without modification

**Tests to Add**: At least 3 unit tests covering:
- Pro user threshold
- Basic user threshold  
- Symbol-specific override

**Dependencies**: BE-01 ✅

---

### Task BE-03: Implement Canonical Side Detection Algorithm
**Priority**: 🔴 CRITICAL | **Effort**: 6 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Consolidate side detection (Buy/Sell/Neutral) into `WhaleSignalEngine.detect_side()` method. Research current implementations in:
- Tick-by-tick algorithm (current_close vs previous_close)
- Aggregated flow algorithm (sum(buy) vs sum(sell))

**Method Signature**:
```python
def detect_side(self, tick_data, method="aggregated"):
    """
    Detect order side from tick data.
    Args:
        tick_data: IntradayTick instance or dict
        method: "tick_by_tick" | "aggregated" (default)
    Returns: str ("BUY" | "SELL" | "NEUTRAL")
    """
    pass
```

**Acceptance Criteria**:
- [ ] Method supports both detection strategies
- [ ] Returns consistent Enum (BUY/SELL/NEUTRAL)
- [ ] Handles edge cases (identical prices → NEUTRAL)
- [ ] Performance: <5ms per call (tested)
- [ ] Matches 100% of existing alert center side detection

**Tests to Add**: At least 5 unit tests:
- Tick-by-tick: price up → BUY
- Tick-by-tick: price down → SELL
- Aggregated: net_buy > 0 → BUY
- Aggregated: net_sell > 0 → SELL
- Edge case: equal buy/sell → NEUTRAL

**Performance Validation**: 
```python
# Test 1000 tick samples, assert all < 5ms
```

**Dependencies**: BE-01 ✅

---

### Task BE-04: Signal Aggregation & Filtering
**Priority**: 🟠 HIGH | **Effort**: 5 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Implement `WhaleSignalEngine.get_signals()` method to aggregate and filter signals.

**Method Signature**:
```python
def get_signals(self, symbol=None, scope="watchlist", user=None, 
                time_window_minutes=15, min_value_vnd=0):
    """
    Get large whale signals based on filters.
    Returns: QuerySet of OrderFlowSignal | list of dicts
    """
    pass
```

**Acceptance Criteria**:
- [ ] Queries IntradayTick table efficiently
- [ ] Filters by threshold (resolved via BE-02)
- [ ] Supports time window filtering (default 15 min)
- [ ] Supports minimum value threshold
- [ ] Scope parameter: "watchlist" vs "market"
- [ ] Returns consistent data structure

**Performance Requirements**:
- Watchlist query: <500ms (indexed by user + symbol)
- Market query: <2s (scans all symbols top N)

**Dependencies**: BE-01 ✅ BE-02 ✅ BE-03 ✅

---

### Task BE-05: Verify Alert/Advisory Consistency (Unit Tests)
**Priority**: 🔴 CRITICAL | **Effort**: 6 hours | **Owner**: QA/Backend  
**Status**: [ ] Not Started

**Description**:
Create comprehensive unit test suite comparing:
- New `WhaleSignalEngine` side detection output
- Existing alert center side detection output
- Goal: 100% parity

**Test Coverage**:
1. **Test Data Setup**: Load historical IntradayTick samples (100+)
2. **Legacy vs New**: Compare side detection results
3. **Threshold**: Compare threshold resolution (10+ user profiles)
4. **Edge Cases**: Identical prices, zero volume, etc.

**Test File**: 
- `backend/portfolio/tests/test_whale_signal_engine.py` (NEW)

**Acceptance Criteria**:
- [ ] All 100+ test cases pass
- [ ] Side detection parity: 100% match
- [ ] Threshold resolution: 100% match
- [ ] Test file has >90% code coverage
- [ ] CI/CD pipeline runs tests on commit

**Test Commands**:
```bash
python manage.py test portfolio.tests.test_whale_signal_engine -v 2
```

**Dependencies**: BE-01 ✅ BE-02 ✅ BE-03 ✅ BE-04 ✅

---

## SLICE 2: DATABASE SCHEMA UPDATES

### Task BE-06: Extend WhaleAdvisory Model for Market Discovery
**Priority**: 🟠 HIGH | **Effort**: 3 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Update `WhaleAdvisory` model to support market-wide advisories (not just watchlist).

**Changes Required**:
1. Add `SourceChoices` enum value: `MARKET_DISCOVERY`
2. Add optional field: `is_discovery_auto_tracked` (BooleanField, default=False)
3. Add migration file

**Model Fields to Add**:
```python
# In WhaleAdvisory model
source = models.CharField(
    max_length=50,
    choices=SourceChoices.choices,
    default=SourceChoices.USER_WATCHLIST,
    # NEW: Add MARKET_DISCOVERY choice
)

is_discovery_auto_tracked = models.BooleanField(
    default=False,
    help_text="Auto-tracked from market discovery mode"
)
```

**Files to Modify**:
- `backend/portfolio/models.py` - Extend WhaleAdvisory

**Acceptance Criteria**:
- [ ] Model updated with new fields
- [ ] Migration file created
- [ ] Migration runs without errors
- [ ] Backward compatible (existing advisories unaffected)
- [ ] Admin interface displays new fields

**Migration Testing**:
```bash
python manage.py makemigrations portfolio
python manage.py migrate --dry-run
python manage.py migrate
```

**Dependencies**: None (safe to run in parallel)

---

### Task BE-07: Create OrderFlowSignal Model (if needed)
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Check if `OrderFlowSignal` model exists. If not, create it to represent detected whale signals.

**Decision Tree**:
1. Search codebase for `OrderFlowSignal` model
   - If exists → Skip task, mark complete
   - If not exists → Create new model

**Proposed Model Structure**:
```python
class OrderFlowSignal(models.Model):
    symbol = ForeignKey(...)
    detected_at = DateTimeField(auto_now_add=True)
    matched_value_vnd = DecimalField()
    side = CharField(choices=["BUY", "SELL"])
    volume_contracts = IntegerField()
    source_ticks = JSONField()  # References to IntradayTick IDs
```

**Acceptance Criteria**:
- [ ] Model created or verified existing
- [ ] Migration created/applied
- [ ] Indexed on (symbol, detected_at) for query performance
- [ ] Admin interface configured

**Dependencies**: None

---

## SLICE 3: VIEW/API UPDATES

### Task BE-08: Refactor views_stock_order_flow.py
**Priority**: 🟠 HIGH | **Effort**: 5 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Replace inline logic with `WhaleSignalEngine` service calls.

**Current File**: `backend/portfolio/views_stock_order_flow.py`

**Changes**:
1. Import WhaleSignalEngine
2. Replace threshold resolution calls → `engine.resolve_threshold()`
3. Replace side detection calls → `engine.detect_side()`
4. Replace signal aggregation → `engine.get_signals()`

**Acceptance Criteria**:
- [ ] All service calls integrated
- [ ] Existing view responses unchanged
- [ ] Performance: No regression (same or faster)
- [ ] Unit tests pass
- [ ] Code review approved

**Validation**:
```bash
# Compare API responses before/after refactor
curl http://localhost:8000/api/portfolio/stock-order-flow/VND/
# Response structure should be identical
```

**Dependencies**: BE-01 ✅ BE-02 ✅ BE-03 ✅ BE-04 ✅

---

### Task BE-09: Refactor whale_feed_helpers.py
**Priority**: 🟠 HIGH | **Effort**: 4 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Replace inline logic with WhaleSignalEngine service calls in helper functions.

**Current File**: `backend/portfolio/whale_feed_helpers.py`

**Changes**:
1. Import WhaleSignalEngine
2. Replace all threshold/side detection with service methods
3. Update function signatures if needed

**Acceptance Criteria**:
- [ ] All service calls integrated
- [ ] Helper functions' external signatures unchanged
- [ ] Unit tests pass
- [ ] Performance: No regression

**Dependencies**: BE-01 ✅ BE-02 ✅ BE-03 ✅ BE-04 ✅

---

## SLICE 4: INTEGRATION & VALIDATION

### Task BE-10: End-to-End Sanity Test
**Priority**: 🔴 CRITICAL | **Effort**: 3 hours | **Owner**: QA  
**Status**: [ ] Not Started

**Description**:
Run manual E2E tests to validate service is working correctly:

1. **Test Scenario A**: Single symbol, watchlist mode
   - User selects VND
   - Engine detects whale signals
   - Verify output matches legacy system

2. **Test Scenario B**: Market scan mode
   - Engine scans all symbols
   - Top 5 whales identified
   - No watchlist filter applied

3. **Test Scenario C**: Threshold variations
   - Test Basic tier user
   - Test Pro tier user
   - Verify different thresholds applied

**Test Environment**: Local dev stack or staging

**Acceptance Criteria**:
- [ ] Scenario A passes
- [ ] Scenario B passes
- [ ] Scenario C passes
- [ ] No console errors/warnings
- [ ] Response times acceptable (<2s)

**Dependencies**: BE-01 ✅ through BE-09 ✅

---

### Task BE-11: Code Review & Merge to Dev Branch
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Owner**: Tech Lead  
**Status**: [ ] Not Started

**Description**:
Submit PR, address review comments, merge to `dev` branch.

**PR Checklist**:
- [ ] All tasks BE-01 to BE-10 complete
- [ ] Unit tests pass (coverage >85%)
- [ ] Code style passes linting
- [ ] No breaking changes
- [ ] Documentation updated
- [ ] Migration tested
- [ ] Approved by 1+ reviewer

**After Merge**:
- [ ] Deploy to dev environment
- [ ] Verify in dev Docker container
- [ ] Update CHANGELOG

**Dependencies**: BE-01 ✅ through BE-10 ✅

---

## SLICE 5: DOCUMENTATION & HANDOFF

### Task DOC-01: Update Technical Documentation
**Priority**: 🟡 MEDIUM | **Effort**: 2 hours | **Owner**: Backend  
**Status**: [ ] Not Started

**Description**:
Document the new `WhaleSignalEngine` service for future maintainers.

**Deliverables**:
1. **Service README**: `backend/portfolio/services/README.md`
   - High-level purpose
   - Public method signatures
   - Usage examples

2. **API Documentation**: Update existing API docs
   - Document scope parameter behavior
   - Document threshold resolution
   - Document side detection strategy

**Acceptance Criteria**:
- [ ] README created and complete
- [ ] Examples provided (>3)
- [ ] Diagrams (optional but recommended) included
- [ ] Links to related code sections

**Dependencies**: All code tasks ✅

---

### Task DOC-02: Create Migration Runbook
**Priority**: 🟡 MEDIUM | **Effort**: 1 hour | **Owner**: DevOps  
**Status**: [ ] Not Started

**Description**:
Document steps to deploy Phase 1 changes to production.

**Runbook Contents**:
1. Pre-migration checks
2. Migration steps
3. Rollback procedure
4. Validation commands
5. Known issues/gotchas

**File**: `docs/RUNBOOK_PHASE1_DEPLOYMENT_20260421.md`

**Acceptance Criteria**:
- [ ] Runbook complete
- [ ] Tested on staging environment
- [ ] Rollback procedure verified

**Dependencies**: BE-06 ✅ BE-07 ✅

---

## SUMMARY TABLE

| Task ID | Title | Effort | Priority | Status | Owner | Dependencies |
|---------|-------|--------|----------|--------|-------|--------------|
| **BE-01** | Create WhaleSignalEngine Service | 8h | 🔴 CRITICAL | [ ] | Backend Lead | None |
| **BE-02** | Extract Threshold Resolution | 4h | 🔴 CRITICAL | [ ] | Backend | BE-01 |
| **BE-03** | Canonical Side Detection | 6h | 🔴 CRITICAL | [ ] | Backend | BE-01 |
| **BE-04** | Signal Aggregation | 5h | 🟠 HIGH | [ ] | Backend | BE-01,02,03 |
| **BE-05** | Unit Tests - Alert/Advisory Parity | 6h | 🔴 CRITICAL | [ ] | QA/Backend | BE-01,02,03,04 |
| **BE-06** | WhaleAdvisory Model Extension | 3h | 🟠 HIGH | [ ] | Backend | None |
| **BE-07** | OrderFlowSignal Model (if needed) | 2h | 🟡 MEDIUM | [ ] | Backend | None |
| **BE-08** | Refactor views_stock_order_flow.py | 5h | 🟠 HIGH | [ ] | Backend | BE-01,02,03,04 |
| **BE-09** | Refactor whale_feed_helpers.py | 4h | 🟠 HIGH | [ ] | Backend | BE-01,02,03,04 |
| **BE-10** | E2E Sanity Test | 3h | 🔴 CRITICAL | [ ] | QA | All BE tasks |
| **BE-11** | Code Review & Merge to Dev | 2h | 🟡 MEDIUM | [ ] | Tech Lead | BE-01 to BE-10 |
| **DOC-01** | Update Technical Docs | 2h | 🟡 MEDIUM | [ ] | Backend | All code tasks |
| **DOC-02** | Create Migration Runbook | 1h | 🟡 MEDIUM | [ ] | DevOps | BE-06,07 |

**Total Effort**: ~51 hours (~1.3 weeks for 1 developer, or 3-4 days for full team)

---

## EXECUTION STRATEGY

### Recommended Timeline
- **Day 1 (22-Apr)**: BE-01, BE-06, BE-07 in parallel (foundation + schema)
- **Day 2 (23-Apr)**: BE-02, BE-03, BE-04 in sequence (core logic)
- **Day 3 (24-Apr)**: BE-05 (comprehensive tests)
- **Day 4 (25-Apr)**: BE-08, BE-09 (refactoring)
- **Day 5 (26-Apr)**: BE-10, BE-11, DOC-01, DOC-02 (integration + release)

### Resource Allocation
- **Backend Lead**: BE-01 (initial architecture)
- **Backend Developer 1**: BE-02, BE-03, BE-04
- **Backend Developer 2**: BE-06, BE-07, BE-08, BE-09
- **QA Engineer**: BE-05, BE-10
- **Tech Lead**: BE-11
- **DevOps/Docs**: DOC-01, DOC-02

### Go/No-Go Criteria for Phase 2
✅ All tasks completed  
✅ Unit test coverage >85%  
✅ E2E tests pass  
✅ Code review approved  
✅ Merged to dev branch  
✅ Deployed to dev environment

**Phase 2 can begin only after all these criteria met.**

---

## ROLLBACK PLAN

If Phase 1 encounters critical issues:
1. Revert commit to last stable state
2. Keep schema migrations (backward compatible)
3. Disable WhaleSignalEngine in views (use old logic as fallback)
4. Maintain API response compatibility

---

**Created By**: GitHub Copilot  
**Last Updated**: 2026-04-21  
**Next Review**: After Phase 1 completion or before Phase 2 start
