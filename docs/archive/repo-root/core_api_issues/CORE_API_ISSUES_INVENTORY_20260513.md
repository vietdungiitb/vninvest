# Core-API Issues Inventory (Sortable by Priority)

**Total Issues Found:** 47  
**CRITICAL:** 5 | **HIGH:** 12 | **MEDIUM:** 18 | **LOW:** 12

---

## CRITICAL ISSUES (Must Fix Before Release)

| ID | Module | Issue | File:Line | Risk | Fix Time |
|----|--------|-------|-----------|------|----------|
| C1 | identity_access | In-memory password reset tokens (no persistence on restart) | views_auth.py:463 | Account recovery broken | 4h |
| C2 | identity_access | Bare except Exception blocks hiding errors in auth paths | views_auth.py:540-542, 614-615 | Silent production failures | 2h |
| C3 | signal_intelligence | WebSocket consumer error swallowing JSON decode errors | consumers.py:102-103 | Silent connection corruption | 1h |
| C4 | identity_access | Welcome email not implemented (onboarding broken) | onboarding_views.py:36-39 | Users can't onboard | 3h |
| C5 | vninvest_core | Hardcoded localhost fallbacks override production config | views_auth.py:530, vnbroker_adapter.py:77 | Production broken if env not set | 1h |

---

## HIGH PRIORITY ISSUES (Should Fix Before Release)

| ID | Module | Issue | File:Line | Risk | Fix Time |
|----|--------|-------|-----------|------|----------|
| H1 | signal_intelligence | Missing pagination on UnifiedAlertListView | views.py:13-33 | OOM on large datasets | 1h |
| H2 | signal_intelligence | Missing pagination on WhaleFeedAggregateView | views.py:35-50 | OOM on alert feed | 1h |
| H3 | signal_intelligence | Missing pagination on OrderFlowEventListView | views.py:51-65 | OOM on order flow | 1h |
| H4 | user_workspace | Test password 'pass' in PortfolioIsolationTest | tests.py:21-24 | Weak test credentials | 0.5h |
| H5 | tenant_lifecycle | Test password 'testpass123' in lifecycle tests | test_tasks.py:21-23 | Weak test credentials | 0.5h |
| H6 | market_serving | Cache layer broad except hides Redis failures | views.py:58-70, 108-120 | Silent cache corruption | 1h |
| H7 | ops_audit | DB password in subprocess environment variable | tasks.py:48-49 | Credential leak in ps aux | 1h |
| H8 | advisory | Symbol input only .upper() without validation | views.py:98 | No consistency check | 0.5h |
| H9 | advisory | Password validation only checks length | views_auth.py:497-499 | Weak passwords accepted | 1h |
| H10 | identity_access | No rate limiting on login/register/password-reset | views_auth.py:251-625 | Brute force attacks possible | 2h |
| H11 | identity_access | Missing tenant isolation in PartnerUsageMetersView | views.py:241-245 | Data leakage across tenants | 1h |
| H12 | market_serving | Wrong HTTP 403 for quota limit (should be 429) | views.py:150, advisory/views.py | Client retry logic breaks | 0.5h |

---

## MEDIUM PRIORITY ISSUES (Should Fix Before Release)

| ID | Module | Issue | File:Line | Risk | Fix Time |
|----|--------|-------|-----------|------|----------|
| M1 | identity_access | Missing select_related in ServiceAccountListView | views.py:34-41 | N+1 query issue | 0.5h |
| M2 | commercial | Missing select_related in QuotaRecordListView | views.py:26-28 | N+1 query issue | 0.5h |
| M3 | market_serving | SymbolSnapshotListView loads all without filtering | views.py:31-35 | No pagination + N+1 | 1h |
| M4 | user_workspace | DNSECredentialSerializer missing validation | serializers.py | Invalid data persisted | 1h |
| M5 | advisory | AdvisoryRecordSerializer missing status validation | serializers.py | No contract enforcement | 0.5h |
| M6 | advisory | Missing cooldown check for manual trigger | views.py | Quota bypass possible | 2h |
| M7 | signal_intelligence | Missing filter/pagination on query endpoints | views.py | O(N) memory usage | 1h |
| M8 | advisory | Audit logging swallowed in exception handler | views.py:76-90 | Compliance trail lost | 1h |
| M9 | market_data | Missing DNSE credential validation | vnbroker_adapter.py | Invalid API calls possible | 1h |
| M10 | identity_access | Missing tests for quota logic | tests/ | No regression detection | 2h |
| M11 | market_serving | Missing tests for cache behavior | tests/ | No regression detection | 2h |
| M12 | signal_intelligence | Missing tests for permissions | tests/ | No regression detection | 2h |
| M13 | user_workspace | Missing tests for DNSE integration | tests/ | No regression detection | 3h |
| M14 | advisory | Missing tests for permission checks | tests/ | No regression detection | 1h |
| M15 | commercial | Missing tests for subscription logic | tests/ | No regression detection | 2h |
| M16 | ops_audit | Backup task error handling missing | tasks.py | Silent backup failures | 1h |
| M17 | advisory | Inconsistent error response format | views.py | Client handling complex | 1h |
| M18 | identity_access | Missing logging in critical auth paths | views_auth.py | No monitoring possible | 1h |

---

## LOW PRIORITY ISSUES (Nice to Have)

| ID | Module | Issue | File:Line | Risk | Fix Time |
|----|--------|-------|-----------|------|----------|
| L1 | advisory | Missing docstring in _manual_trigger_period() | views.py | Poor maintainability | 0.5h |
| L2 | market_data | Missing docstring in _normalize_intraday_trade_rows() | vnbroker_adapter.py | Poor maintainability | 0.5h |
| L3 | signal_intelligence | Inconsistent error response format (detail vs error) | views.py | Client confusion | 1h |
| L4 | commercial | Missing logging of subscription changes | views.py | No audit trail | 1h |
| L5 | advisory | Missing metrics for advisory generation | views.py | No observability | 1h |
| L6 | market_data | Missing metrics for data fetch | vnbroker_adapter.py | No observability | 1h |
| L7 | identity_access | Missing audit log for PAT rotation | views.py | Compliance gap | 1h |
| L8 | user_workspace | Missing documentation of DNSE credential flow | models.py | Poor onboarding | 1h |
| L9 | tenant_lifecycle | Missing logging of tenant state transitions | tasks.py | No audit trail | 1h |
| L10 | advisory | Missing type hints in several functions | views.py | Poor IDE support | 2h |
| L11 | market_serving | Missing type hints in cache functions | views.py | Poor IDE support | 1h |
| L12 | ops_audit | Missing type hints in parity check functions | views_parity.py | Poor IDE support | 1h |

---

## Root Cause Analysis

### Pattern 1: Bare Exception Handlers (6 occurrences)
**Files:** views_auth.py, advisory/views.py, market_serving/views.py, signal_intelligence/consumers.py  
**Root Cause:** Copy-paste error handling pattern  
**Fix:** Establish exception handling guideline in code review checklist

### Pattern 2: Missing Pagination (3 occurrences)  
**Files:** signal_intelligence/views.py  
**Root Cause:** Inconsistent DRF usage  
**Fix:** Create base view class with pagination_class set

### Pattern 3: Missing Test Coverage (7+ modules)
**Files:** Most modules  
**Root Cause:** Deadline pressure, no TDD discipline  
**Fix:** Establish minimum 80% coverage gate in CI/CD

### Pattern 4: Hardcoded Fallback Values (4 occurrences)
**Files:** settings.py, views_auth.py, vnbroker_adapter.py  
**Root Cause:** Dev convenience overlooked for production  
**Fix:** Use `os.environ.get(..., None)` and require explicit env var

### Pattern 5: Symbol Validation Inconsistency (4 occurrences)
**Files:** advisory/views.py, market_data/views.py, market_serving/views.py  
**Root Cause:** No shared validation utility  
**Fix:** Extract to `vninvest_core.validators.validate_symbol()`

---

## Dependency on SaaS Migration Docs

**Issues Impacted by SAAS_MIGRATION:**
- C5: Hardcoded localhost (depends on proper env var strategy)
- H7: DB password in subprocess (depends on credential lifecycle)
- H11: Tenant isolation (depends on CoreRouter enforcement)

**References:**
- See `SAAS_MIGRATION_CODE_QUALITY_CONSTITUTION_20260504.md` for password handling standards
- See `SAAS_MIGRATION_CONFIG_OWNERSHIP_MATRIX_20260504.md` for env var requirements

---

## Quick Fix Checklist (By Time Investment)

### 1 Hour Fixes (8 items)
- [ ] C3: Fix WebSocket error response
- [ ] C5: Make localhost fallbacks require explicit env var
- [ ] H5: Update test passwords
- [ ] H6: Add cache error logging
- [ ] H7: Use .pgpass file for DB credentials
- [ ] H8: Add symbol validation helper
- [ ] H12: Fix HTTP 429 status code
- [ ] M4-M5: Add serializer validation

### 2-3 Hour Fixes (6 items)
- [ ] C1: Migrate password reset to database
- [ ] C2: Fix exception handlers (add logging)
- [ ] C4: Implement email task
- [ ] H1-H3: Add pagination (3x 1h each)
- [ ] H10: Add rate limiting
- [ ] H11: Audit tenant isolation

### 4+ Hour Fixes (3 items)
- [ ] M10-M14: Add view tests (5h)
- [ ] M6: Add cooldown check logic (2h)
- [ ] Full security audit (8h)

**Total: ~40 hours of work**

---

## Regression Test Points

After fixing each issue, verify:

1. **Password Reset Flow**
   - Token persists after restart
   - Token expires after 6 hours
   - Token invalidated after use
   - Rate limited to 5/day per email

2. **Error Handling**
   - All exceptions logged at WARNING/ERROR
   - No silent failures
   - Proper error response to client

3. **Pagination**
   - Default page size: 20 items
   - Max page size: 100 items
   - Total count included in response

4. **Tenant Isolation**
   - User A cannot see User B's data
   - Cross-tenant queries return 0 results

5. **Authentication**
   - Brute force after 10 attempts/IP
   - Account lockout after 5 failed logins
   - Password meets complexity requirements

---

## Deployment Gate Checklist

Before deploying to production:

- [ ] All CRITICAL issues resolved
- [ ] All HIGH issues resolved  
- [ ] Code review by tech lead
- [ ] Load test: 1000+ concurrent users
- [ ] Security test: OWASP Top 10 scan
- [ ] Smoke test: All critical paths
- [ ] Email delivery test (Gmail, Outlook, corporate)
- [ ] WebSocket connection test under load
- [ ] Database backup/restore test
- [ ] Monitoring/alerting configured
- [ ] Runbook created
- [ ] On-call schedule set

---

**Generated:** 2026-05-13  
**Next Review:** After each issue fixed  
**Maintained By:** Development Team
