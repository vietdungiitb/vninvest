# SFI-B3 Execution Evidence — Market & Realtime Compat Routes

**Phase**: B3 — Market & Realtime  
**Status**: ✅ COMPLETE  
**Timestamp**: 2026-05-04T23:30:00Z

---

## Slice Summary

| Slice | Description | Status |
|-------|-------------|--------|
| B3.1 | market_serving/compat_urls.py | ✅ |
| B3.2 | signal_intelligence/compat_urls.py | ✅ |
| B3.3 | market_data/compat_urls.py | ✅ |
| B3.4 | Register compat routes in vninvest_core/urls.py | ✅ |
| B3.5 | Smoke tests | ✅ |

---

## Smoke Test Results

| Test | Endpoint | Expected | Actual | Result |
|------|----------|----------|--------|--------|
| B3-01 | GET /api/market/symbol-snapshot/ | 401 | 401 | ✅ PASS |
| B3-02 | GET /api/signals/whale-feed/ | 401 | 401 | ✅ PASS |
| B3-03 | GET /api/market-data/symbols/ | 401 | 401 | ✅ PASS |

---

## Files Modified

| File | Change |
|------|--------|
| `packages/core/backend/src/market_serving/compat_urls.py` | NEW — /api/market/* routes |
| `packages/core/backend/src/signal_intelligence/compat_urls.py` | NEW — /api/signals/* routes |
| `packages/core/backend/src/market_data/compat_urls.py` | NEW — /api/market-data/* routes |
| `packages/core/backend/src/vninvest_core/urls.py` | Added 3 compat includes before proxy |

---

## Architecture Note

B3 routes are registered BEFORE the legacy proxy route in urls.py. This means:
- `/api/market/*`, `/api/signals/*`, `/api/market-data/*` → served natively by core-api
- All other `/api/*` → still forwarded to legacy backend via transparent proxy (B1)

This follows the progressive cutover strategy: each B-phase adds more native routes,
shrinking the proxy footprint until B8 decommission.
