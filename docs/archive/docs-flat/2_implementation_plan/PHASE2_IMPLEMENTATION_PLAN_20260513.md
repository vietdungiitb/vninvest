# Phase 2 Implementation Plan - Core API OpenAPI Standardization (A4+A5+A6+B1+B3)

Date: 2026-05-13
Status: **Pending confirmation**

---

## Executive Summary

Phase 2 delivers 5 P0 tasks:
- **A4**: HTTP status code normalization (200/201/204/4xx/5xx)
- **A5**: Standard error envelope (detail/code/timestamp/request_id/field_errors)
- **A6**: Complete exception handling audit + fixes
- **B1**: Rate limiting on auth endpoints (register/login/password-reset)
- **B3**: Tenant query filter enforcement (market_data/advisory/admin_ops)

Total scope: ~80-120 code changes across 8 domains, 60+ tests

---

## Slice Breakdown

### Slice A4-A5: Status Codes + Error Envelope (Tight)
**Duration**: ~4 hours, **Risk**: Medium, **Blast Radius**: All domains

**Tasks:**
1. Create `vninvest_core/exceptions.py` with standard error envelope class + DRF exception handler
2. Audit and fix status codes in identity_access endpoints (register→201, login→200, password-reset-confirm→200)
3. Audit and fix status codes in market_serving endpoints (list→200, get→200)
4. Audit and fix status codes in advisory endpoints (create session→201, list→200)
5. Update DRF settings to use custom exception handler
6. Add 15 status code contract tests per affected module
7. Docker rebuild + test validation (should be 49+15 = 64 tests)
8. Git commit + push

**Acceptance:**
- All new error responses follow standard envelope
- All endpoints return correct status codes (201 for create, 204 for delete, etc.)
- 64+ tests passing, no regressions

---

### Slice B1: Rate Limiting Auth Endpoints
**Duration**: ~2 hours, **Risk**: Low, **Blast Radius**: Auth only

**Tasks:**
1. Install `django-ratelimit` (if not present)
2. Add rate limit decorators to:
   - `register_view`: 5 req/hour per IP
   - `login_view` (if exists): 10 req/hour per IP
   - `password_reset_request_view`: 5 req/hour per IP
3. Implement rate limit response with standard error envelope (429 status)
4. Add 8 rate limit contract tests
5. Docker rebuild + test (64+8 = 72 tests)
6. Git commit + push

**Acceptance:**
- Rate limit triggers at configured threshold
- Returns 429 with standard error envelope
- IP-based counting works correctly

---

### Slice A6: Complete Exception Audit
**Duration**: ~3 hours, **Risk**: Medium, **Blast Radius**: All API paths

**Tasks:**
1. Grep full API path code for `except: pass` and `except Exception: pass` patterns
2. Inventory remaining swallow exception locations (beyond C2's 5 fixes)
3. Add proper logging to each location with context:
   - request_id (if available)
   - user (if authenticated)
   - endpoint path
   - exception type and message
4. Add 12 exception path tests (negative cases that trigger exceptions)
5. Docker rebuild + test (72+12 = 84 tests)
6. Git commit + push

**Acceptance:**
- Zero remaining silent exception handlers in API paths
- All failures logged with full context
- No regressions in existing tests

---

### Slice B3: Tenant Query Filter Enforcement
**Duration**: ~3 hours, **Risk**: High, **Blast Radius**: Market data, advisory, admin ops

**Tasks:**
1. Audit list endpoints in market_serving, advisory, admin_ops for tenant scoping:
   - Identify which endpoints need tenant filter
   - Check if queryset already filters by tenant
   - Add filter where missing
2. Create `get_tenant_context(request)` helper in a shared utility
3. Update 6-10 list views to enforce tenant filter:
   - market_serving: market list, session list
   - advisory: session list, portfolio list
   - admin_ops: audit log list
4. Add 12 cross-tenant denial tests per module
5. Docker rebuild + test (84+12 = 96 tests)
6. Git commit + push

**Acceptance:**
- All tenant-scoped list endpoints filter by request tenant
- Cross-tenant access denied (403 or empty list, as per policy)
- 96+ tests passing

---

## Execution Sequence

```
Slice 1: A4-A5 (Status codes + Error envelope)
  ↓ git commit + push
Slice 2: B1 (Rate limiting)
  ↓ git commit + push
Slice 3: A6 (Exception audit)
  ↓ git commit + push
Slice 4: B3 (Tenant filters)
  ↓ git commit + push

Final: 96+ tests passing, all P0 items done
```

---

## Per-Slice DoD (Definition of Done)

Each slice must have:
1. Code changes (views, serializers, exception handlers, decorators, filters)
2. Tests (contract tests, negative tests, cross-tenant tests)
3. Docker rebuild + container startup
4. Test execution (all tests passing, no regressions)
5. Audit documentation (changed files, test evidence, risks)
6. Git commit with detailed message
7. Git push to dev branch

---

## Risk Mitigation

| Risk | Slice | Mitigation |
|------|-------|-----------|
| Status code breaking clients | A4-A5 | Frontend mocked tests use contracts first; gradual rollout |
| Error envelope breaking parsers | A4-A5 | Old and new envelope compatible during rollout |
| Rate limit blocking legitimate traffic | B1 | Set conservative thresholds; monitor logs |
| Tenant filter breaking queries | B3 | Gradual rollout; shadow run recommended |
| Silent exception handlers | A6 | Grep validation + manual code review |

---

## Success Criteria

- ✅ 96+ tests passing (baseline 49 + new 47)
- ✅ Zero regressions
- ✅ All 5 P0 items (A4, A5, A6, B1, B3) implemented
- ✅ No silent exception handlers remaining
- ✅ Standard error envelope on all errors
- ✅ Rate limiting working on auth endpoints
- ✅ Tenant filters enforced
- ✅ Code Review gates pass (Constitution R1-R10)
- ✅ All evidence documented

---

## Timeline Estimate

- **A4-A5**: 4 hours (Slice 1)
- **B1**: 2 hours (Slice 2)
- **A6**: 3 hours (Slice 3)
- **B3**: 3 hours (Slice 4)
- **Total**: ~12 hours wall time (can parallelize testing)

---

## Owner / Reviewer

- **Implementation**: AI Agent
- **Code Review**: Tech Lead (constitution R1-R10)
- **Testing**: QA (49→96 test expansion)
- **Sign-off**: Tech Lead approval required before Phase 3

---

## Next Step

**User confirmation required:**
- ✅ Approve plan as-is?
- 🔄 Modify scope (split/merge slices)?
- ❌ Cancel and select subset?
