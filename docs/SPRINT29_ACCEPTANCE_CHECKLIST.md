# Sprint 29 Acceptance Checklist

## Phase 1: AI Advisory User-Scoping & Configuration Gating

### A. Whale Advisory User-Scoping (Root Fix)
- [x] Added `user` FK + `ai_model` CharField to WhaleAdvisory model
- [x] Migration 0025_whaleadvisory_user_and_ai_model.py created & tested
- [x] Task `generate_whale_advisory_task` accepts `user_id` parameter
- [x] Task persists `user` and `ai_model` in generated records
- [x] WebSocket broadcast changed to user-scoped group `user_{id}_alerts`
- [x] List endpoint filters to `user=request.user` only
- [x] Refresh endpoint locked to user-owned advisories
- [x] Stock session/component flows query user-scoped records
- [x] AI context supports user-filtering for recent history

### B. AI Readiness Gating
- [x] Backend checks: `missing_ai_model` + `missing_ai_api_key` before generation
- [x] Endpoints return 409 CONFLICT when AI not ready
- [x] Frontend warns before AI actions (WhaleAdvisory refresh, Stock detail tabs)
- [x] AI config status visible via `/api/ai-config/` endpoint
- [x] Test connection validates both model AND API key presence

### C. Legacy Record Handling
- [x] Existing advisories with `user=NULL` fallback (backward compat)
- [x] Query prioritizes user-owned records first
- [x] List view returns only new user-scoped advisories
- [x] No leakage of legacy/placeholder records in user-facing views

---

## Phase 2: Data Normalization & UI Fixes

### D. VCI Price Board Normalization
- [x] Adapter centralizes price-board normalization (* 1000, thousand → VND)
- [x] VNM stock detail shows `₫63,000` (not `₫63`)
- [x] Realtime prices consistent with historical data
- [x] Tested with fallback detection for auto-scaling

### E. Trust Telemetry i18n
- [x] All 6 event keys translated to Vietnamese
- [x] All 6 event keys translated to English
- [x] Recent events list uses `getEventLabel(t, item.event)`
- [x] Defensive null/undefined checks added
- [x] Fallback to raw key if translation missing
- [x] Browser cache clear documented

---

## Phase 3: Test Coverage & Validation

### F. Test Fixes
- [x] Fixed auth assertion to handle Vietnamese diacritics
- [x] Updated 6+ fixtures to create user-scoped advisories
- [x] All stock advisory tests now expect user-scoped behavior
- [x] Component tests include defensive null-checks

### G. Test Results
- [x] Full API routes suite: 173/173 tests passing
- [x] AI Config: 8/8 tests passing
- [x] Whale Advisory Task: 2/2 tests passing
- [x] Focused advisory flows: 20/20 tests passing
- [x] Adapter tests: 17/17 tests passing

---

## Phase 4: Kline Chart Context (Original Sprint 29)

### H. Backend Contract
- [x] Endpoint generate components receive `chart_context` optional
- [x] Invalid payload doesn't crash request, has fallback
- [x] Response includes `chart_context_used`
- [x] Response includes `chart_context_warnings` when needed

### I. Prompt Integration
- [x] Prompt has chart context block when payload valid
- [x] Prompt skips chart block when payload invalid/missing
- [x] OHLCV point count clamped to limit

### J. Frontend Integration
- [x] FE builds chart_context from Kline chart
- [x] FE sends payload when creating AI tab
- [x] FE fallbacks to old payload if collector fails
- [x] Badge/warning UI matches response flags

### K. Regression
- [x] All indicator toggles (MA/EMA/BOLL/MACD/RSI/KDJ/STOCH/SAR/ATR/OBV/VOL) work
- [x] Screenshot/fullscreen toolbar works correctly
- [x] Stock detail doesn't crash without chart data

---

## Deployment Sign-Off

- [x] **Backend:** Schema + logic validated, 173 tests passing
- [x] **Frontend:** UI checks + i18n complete, cache strategy documented
- [x] **Database:** Migration file ready, backward compatible
- [x] **DevOps:** Deployment steps documented, rollback plan ready
- [x] **QA:** Smoke test matrix prepared
- [x] **Monitoring:** Key metrics identified

**Status:** ✅ **READY FOR PRODUCTION DEPLOY**

**Release Date:** April 8, 2026  
**Version:** 1.0  
**Commitments Met:** ✅ 100%

