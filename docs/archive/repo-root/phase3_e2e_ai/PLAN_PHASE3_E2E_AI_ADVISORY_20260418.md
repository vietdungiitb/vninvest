# Phase 3 Implementation Plan: AI Advisory Canonical prompt_config E2E Testing
## Full Integration Verification — April 18, 2026

---

## Objective
Verify end-to-end integration of canonical `prompt_config` across:
- ✅ Frontend localStorage persistence (user preferences)
- ✅ Frontend → Backend API payload (prompt_config transmitted correctly)
- ✅ Backend prompt_config parser + source routing (only enabled sources used)
- ✅ Summary metadata display (shows which sources were active)

---

## Phase 3 Scope: 5 Work Items

### Item 1: localStorage E2E Test Suite
**Target:** `frontend/src/__tests__/AIAdvisoryPromptConfig.e2e.test.js`

**Test Cases:**
1. Load default config when no localStorage data exists
2. Save config to localStorage on first settings change
3. Load persisted config on page reload (symbol-specific)
4. Toggle source → verify localStorage updates immediately
5. Toggle technical indicator → verify localStorage updates
6. Switch to different symbol → verify symbol-specific config isolation
7. Invalid config in localStorage → fallback to defaults gracefully

**Success Criteria:** All 7 tests pass

---

### Item 2: API Payload Validation Test
**Target:** `frontend/src/__tests__/AIAdvisoryPromptConfig.api.test.js`

**Test Cases:**
1. Generate correct prompt_config payload structure
2. Verify enabled sources included in request body
3. Verify disabled sources excluded from request body
4. Verify technical indicators array only includes enabled indicators
5. Verify default source selection (whale/dark_flow/technical/news/market enabled)
6. Verify lookback values respect min/max bounds
7. Mock fetch: capture outgoing request → validate prompt_config shape

**Success Criteria:** All 7 tests pass; request payload matches schema

---

### Item 3: Backend Integration Test
**Target:** `backend/tests/test_ai_advisory_e2e_integration.py`

**Test Cases:**
1. Call regenerate endpoint with prompt_config payload
   - Verify only enabled sources build context blocks
   - Verify disabled sources skip context building
   - Verify response includes `prompt_config_version`
2. Call with minimal prompt_config (only version + sources enabled keys)
   - Verify parser merges with defaults correctly
3. Call with all sources disabled
   - Verify synthesis still works (backend applies fallback defaults)
4. Call with invalid indicator names in technical.indicators
   - Verify they're filtered out gracefully
5. Call without prompt_config (backward compat)
   - Verify synthesis uses old behavior (all defaults)
6. Round-trip: frontend sends prompt_config → backend processes → response metadata matches

**Success Criteria:** All 6 tests pass; backward compatibility verified

---

### Item 4: Component Integration Test  
**Target:** `frontend/src/__tests__/StockDetail.prompt_config.test.js`

**Test Cases:**
1. Render StockDetail with symbol → check localStorage init
2. Click ⚙️ Settings button → verify drawer opens
3. Toggle source in drawer → verify state updates
4. Close drawer → verify prompt_config persists
5. Click Regenerate → verify API call includes prompt_config
6. Verify enabled sources badges render on summary view
7. Verify settings button + drawer integrate smoothly with existing UI

**Success Criteria:** All 7 tests pass; no regressions in StockDetail

---

### Item 5: Manual End-to-End Walkthrough Script
**Target:** `docs/E2E_TESTING_GUIDE_PROMPT_CONFIG_20260418.md`

**Walkthrough Steps:**
1. Start dev compose stack
2. Load Stock Detail page for symbol (e.g., MWG)
3. Verify default enabled sources show (whale, dark_flow, technical, news, market)
4. Open ⚙️ Settings drawer
5. Toggle "fundamental" ON → verify localStorage persists
6. Toggle "whale" OFF → verify UI reflects change
7. Click Regenerate Synthesis
8. Verify request includes prompt_config with new settings
9. Verify summary badges show only enabled sources
10. Reload page → verify settings persisted from localStorage
11. Repeat for different symbol → verify isolation

**Success Criteria:** Manual walkthrough completes without errors; all expectations met

---

## Implementation Sequence

```
Phase 3a: Unit + Component Tests (Days 1-2)
├─ Item 1: localStorage tests (Jest)
├─ Item 2: API payload validation (Jest)
└─ Item 4: Component integration (Jest)

Phase 3b: Backend Integration (Day 2-3)
└─ Item 3: Backend e2e tests (Django TestCase)

Phase 3c: Manual Verification (Day 3)
└─ Item 5: Manual walkthrough (documented + verified by user)

Phase 3d: Fix + Iterate (As needed)
└─ Fix any failures discovered
```

---

## Success Criteria (Overall)

- ✅ All 27 test cases pass (localStorage + API + backend + component)
- ✅ No console errors during manual walkthrough
- ✅ localStorage data isolated per symbol
- ✅ API payload structure matches canonical schema
- ✅ Backend only builds enabled sources (verified in test)
- ✅ Summary UI displays enabled sources correctly
- ✅ Backward compatibility: old calls still work (no prompt_config)
- ✅ Default config applied consistently across frontend/backend

---

## Dependencies

- Jest setup (frontend unit tests)
- Django test fixtures (backend tests)
- dev compose stack running (manual testing)

---

## Effort Estimate

- **Item 1** (localStorage tests): ~2 hours
- **Item 2** (API payload validation): ~1.5 hours
- **Item 3** (Backend E2E): ~2 hours
- **Item 4** (Component tests): ~1.5 hours
- **Item 5** (Manual guide + walkthrough): ~1 hour

**Total Phase 3: ~8 hours**

---

## Ownership

- Frontend Tests: src code in `frontend/src/__tests__/`
- Backend Tests: src code in `backend/tests/`
- Manual Guide: docs in `docs/`
- Audit Trail: `AUDIT_PHASE3_E2E_AI_ADVISORY_20260418.md` (created at end)

---

## Next Phase (Phase 4)

After Phase 3 passes:
1. i18n translations for drawer labels (Vietnamese + English)
2. Performance testing with large source sets
3. Production deployment checklist
