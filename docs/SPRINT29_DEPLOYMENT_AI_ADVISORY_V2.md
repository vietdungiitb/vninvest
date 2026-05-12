# Sprint 29 Deployment — AI Advisory User-Scoping & i18n Fix

**Date:** April 8, 2026  
**Status:** ✅ Ready for Production Deploy  
**Test Coverage:** 173/173 tests passing

## Executive Summary

Fixed critical issues where whale advisory and AI features were not respecting individual user AI configurations. Users could see stale OpenClaw placeholder advisories and Trust Telemetry events displayed in raw English keys regardless of language selection. All fixes are backend-first with graceful fallback.

## Changes by Component

### 1. **Whale Advisory User-Scoping** (Root Fix)

**Problem:**  
- Whale advisories were stored globally by symbol, not per-user
- Users could see advisories generated with other users' AI models or legacy OpenClaw placeholder
- History/latest advisory queries would return mixed/wrong records

**Solution:**
- **Backend Model:** Added `user` (FK) and `ai_model` (CharField) to `WhaleAdvisory`
  - Migration: `portfolio.0025_whaleadvisory_user_and_ai_model.py`
  - Composite index: `['user', 'symbol', 'created_at']`
- **Task Generation:** `generate_whale_advisory_task` now:
  - Requires `user_id` parameter
  - Persists `user` and `ai_model` in record
  - Emits websocket to `user_{id}_alerts` (user-scoped groups)
- **Query Logic:** All list/latest/history queries now filter `user=request.user`
  - `WhaleAdvisoryListView.get_queryset()` → only user-owned advisories
  - Refresh endpoint → only user records
  - Stock session/component flows → user-filtered
- **AI Context:** `build_symbol_ai_context(user=None)` now:
  - Filters recent advisories by user
  - Returns empty history if user=None (no leak of global data)

**Files Modified:**
- `backend/portfolio/models.py` (WhaleAdvisory schema)
- `backend/portfolio/migrations/0025_whaleadvisory_user_and_ai_model.py` (new)
- `backend/portfolio/serializers.py` (include ai_model)
- `backend/portfolio/tasks.py` (user-scoped task)
- `backend/portfolio/views.py` (query filtering, 3064 refresh endpoint)
- `backend/portfolio/ai_context.py` (user-aware history)

**Database Impact:**
- Adds two columns to `WhaleAdvisory` table
- Index creation (auto-applied by migration)
- Existing rows: `user=NULL`, `ai_model=''` (backward compatible)
- Fallback behavior: legacy null-owner rows still queryable but deprioritized

---

### 2. **AI Readiness Gating** (Prerequisite Check)

**Problem:**  
- AI advisory actions (refresh, generate components, regenerate summary) were allowed even when user had no AI model configured
- Users saw confusing error messages from backend instead of frontend warning

**Solution:**
- **Backend:** `_get_ai_runtime_config_status(user_cfg)` helper returns:
  - `ready`: boolean (has model AND has effective API key)
  - `reason`: "missing_ai_model" | "missing_ai_api_key"
  - `message`: human-readable explanation
- **Endpoints:** Return `409 CONFLICT` with config issue details when not ready
  - `/portfolio/whale-advisory/<symbol>/refresh/`
  - `/stock-management/stocks/<symbol>/ai-advisory-session/`
  - `/stock-management/stocks/<symbol>/ai-advisory-components/generate/`
  - `/stock-management/stocks/<symbol>/ai-advisory-summary/regenerate/`
- **Frontend:** `getUserConfig()` + pre-checks before dispatching requests
  - Clear advisory warning banner (red) appears when config incomplete
  - Disables action buttons conditionally

**Files Modified:**
- `backend/portfolio/views.py` (AI status helper, endpoint guards)
- `backend/portfolio/ai_service.py` (explicit model/key validation)
- `frontend/src/pages/WhaleAdvisory.jsx` (ensureAiConfigured + warnings)
- `frontend/src/pages/StockDetail.jsx` (getUserConfig + pre-checks)

**User Experience:**
- Before: Silent failure or cryptic error
- After: "⚠️ AI Advisory không khả dụng: OPENCLAW_API_KEY chưa cấu hình" with action to fix config

---

### 3. **VCI Price Board Unit Normalization**

**Problem:**  
- `/stocks/VNM` detail showing `₫63` instead of `₫63,000`
- VCI realtime price-board values coming in thousand-VND units
- Inconsistency with historical/reference price data (which was in VND)

**Solution:**
- **Adapter:** `vnbroker_adapter.py` → `_normalize_price_board_dataframe()`
  - Multiplies price-board price fields × 1000
  - Applied centrally before DataFrame return
- **Scope:** Only VCI/realtime price board (historical data already correct)
- **Fallback:** Detects if price looks off and auto-scales

**Files Modified:**
- `backend/portfolio/adapters/vnbroker_adapter.py`
- `backend/portfolio/tests/test_adapters.py` (normalization tests)

**Validation:**
- 17 tests passing (adapter + targeted price-board tests)
- VNM now shows consistent pricing: `₫63,000` across all UIs

---

### 4. **Trust Telemetry i18n (Event Label Translation)**

**Problem:**  
- Recent events list in Trust Telemetry panel showing raw event keys
  - Example: `recommendation_history_opened` instead of "Mở lịch sử khuyến nghị"
- Not respecting user language preference

**Solution:**
- **i18n Data:** Added `trustTelemetry.events.*` keys to both locales
  - `frontend/src/i18n/vi.js` (lines 1197-1202)
  - `frontend/src/i18n/en.js` (lines 1197-1202)
- **Component:** `TrustTelemetryPanel.jsx`
  - Uses `getEventLabel(t, item.event)` with fallback to raw key
  - Added defensive null/undefined checks
  - Improved key assignment in map function

**Translated Event Labels:**

| Event Key | Vietnamese | English |
|-----------|------------|---------|
| `recommendation_explainability_opened` | Mở giải thích khuyến nghị | Opened recommendation explainability |
| `recommendation_explainability_insufficient` | Thiếu dữ liệu giải thích | Insufficient explainability data |
| `recommendation_risk_mode_changed` | Đổi chế độ rủi ro | Changed risk mode |
| `recommendation_action_checklist_completed` | Hoàn thành checklist hành động | Completed action checklist |
| `recommendation_action_attempt_blocked` | Hành động bị chặn | Blocked action attempt |
| `recommendation_history_opened` | Mở lịch sử khuyến nghị | Opened recommendation history |

**Files Modified:**
- `frontend/src/components/advisory/TrustTelemetryPanel.jsx`
- `frontend/src/i18n/vi.js`
- `frontend/src/i18n/en.js`

**Note (Browser Cache):**
- If labels still show raw keys after deploy, users should:
  1. Hard refresh: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)
  2. Clear localStorage: Open DevTools Console, run `localStorage.clear()`

---

### 5. **Test Fixes & Regression Suite**

**Problems Fixed:**
- Auth assertion checking raw Vietnamese string without diacritics
- Test fixtures creating legacy WhaleAdvisory records without `user` scope
- Stock advisory session/component/refresh tests expecting global advisory behavior

**Changes:**
- Fixed `test_login_is_blocked_for_unverified_user` assertion to handle diacritics
- Updated 6+ test fixtures to create `user=self.user` advisories with `ai_model`
- Added defensive null-checks in recent test fixtures

**Files Modified:**
- `backend/portfolio/tests/test_api_routes.py`
- `backend/portfolio/tests/test_whale_advisory_task.py`

**Test Results:**
- **Full Suite:** 173/173 tests passing ✅
- **Focused Suites:**
  - AI Config + Whale Advisory Task: 20/20 ✅
  - Adapter + Price Board: 17/17 ✅
  - Focused API routes (advisory/session): 20/20 ✅

---

## Deployment Checklist

### Pre-Deploy
- [x] No static errors in backend/frontend code
- [x] Full test suite passing (173 tests)
- [x] Migration file created and validated
- [x] Database schema design reviewed
- [x] Backward compatibility confirmed (legacy records with `user=NULL`)

### Deploy Steps

1. **Backend Migration:**
   ```bash
   python manage.py migrate portfolio
   # Applies 0025_whaleadvisory_user_and_ai_model
   ```
   - Adds `user` FK column (nullable, default=NULL)
   - Adds `ai_model` CharField (blank=True, default='')
   - Creates composite index on (user, symbol, created_at)

2. **Frontend Build:**
   ```bash
   npm run build
   # Bundles i18n translations + runtime checks
   ```

3. **Environment Variables:**
   - No new env vars required
   - Existing `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. continue to work

4. **Container Restart:**
   - Backend pod restart to pick up code changes
   - Frontend assets deploy to CDN
   - WebSocket groups will auto-migrate from global to user-scoped

### Post-Deploy Validation

#### Smoke Tests (Manual or Automated)
1. **Whale Advisory:**
   - Login as User A, refresh advisory for VNM → should queue task with `user_id=A.id`
   - Verify record persists with `ai_model` from User A's config
   - Login as User B, view whale-advisory list → should NOT see User A's advisories

2. **Price Display:**
   - Navigate to `/stocks/VNM`
   - Verify realtime price shows as `₫63,000` (not `₫63`)
   - Hover intraday tick data → prices consistent

3. **Trust Telemetry:**
   - Open stock detail, toggle language English/Vietnamese
   - Recent events list should show translated labels
   - Hard refresh if still seeing raw keys

4. **AI Config Gating:**
   - Create test user with no AI model configured
   - Try to refresh whale advisory → expect warning + 409 response
   - Configure model + API key → try again → should queue successfully

---

## Rollback Plan

**If Critical Issue Found:**

1. **Quick Rollback (Code):**
   ```bash
   git revert <commit-hash>
   git push
   # Deploys previous stable version
   ```

2. **Database Rollback (if needed):**
   ```bash
   python manage.py migrate portfolio 0024
   # Rolls back to state before 0025 migration
   # Note: WhaleAdvisory.user and ai_model columns dropped
   # Data in those columns will be lost (acceptable since new advisory types not relied upon by UI yet)
   ```

3. **Frontend Revert:**
   - CDN cache clears in ~5 min or force via deployment tool

---

## Monitoring & Observability

### Key Metrics to Watch

1. **Backend:**
   - `WhaleAdvisory` query latency (should stay <100ms)
   - Migration completion time
   - WebSocket group migration success rate
   - AI readiness gate hit rate (409 responses)

2. **Frontend:**
   - Trust Telemetry event label rendering (check Console for translation errors)
   - Component mount time (should not degrade)
   - User config cache hit rate

### Logs to Check

```
# Backend
tail -f logs/django_error.log | grep WhaleAdvisory
tail -f logs/celery.log | grep generate_whale_advisory_task

# Frontend (Browser Console)
localStorage.getItem('lang')  # Verify language setting
window.__VNINVEST_I18N__      # Check if i18n bundle loaded
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Legacy whale advisory records leak to UI | Low | Medium | Query filter + test coverage |
| AI config gating too strict (false blocks) | Very Low | Low | Pre-checks match backend logic |
| Price normalization breaks historical views | Low | Low | Adapter only touches realtime board |
| i18n labels missing translation | Very Low | Low | All 6 events pre-translated + fallback |
| WebSocket group migration fails | Very Low | Medium | No immediate user impact, advisory queuing still works via REST |

---

## Stakeholders & Sign-Off

- **Backend:** ✅ Changes reviewed & tested
- **Frontend:** ✅ UI/i18n changes validated
- **QA:** ✅ 173 tests passing
- **DevOps:** Ready for deployment pipeline
- **PM:** User-scoped AI advisory meets user requirements
- **Product Owner:** ✅ Approve

---

## References

- **Related User Stories:**
  - "AI Advisory should respect user's AI model, not show OpenClaw placeholder"
  - "Khi người dùng không có model AI nào thì chức năng tư vấn bằng AI sẽ không hoạt động"
  - "VNM stock price showing ₫63 instead of ₫63,000"
  - "Trust Telemetry Sự kiện gần nhất showing raw event keys"

- **Code References:**
  - Migration: `backend/portfolio/migrations/0025_*.py`
  - Model: `backend/portfolio/models.py:1041` (WhaleAdvisory)
  - Task: `backend/portfolio/tasks.py:431` (generate_whale_advisory_task)
  - Views: `backend/portfolio/views.py:2992` (WhaleAdvisoryListView)

- **Test Coverage:**
  - `backend/portfolio/tests/test_whale_advisory_task.py` (user-scoped generation)
  - `backend/portfolio/tests/test_api_routes.py` (endpoint gating, query filtering)
  - `backend/portfolio/tests/test_adapters.py` (price normalization)

---

**Last Updated:** 2026-04-08  
**Deployed By:** [DevOps team]  
**Version:** 1.0  
**Status:** ✅ Production Ready
