# Backend Progress Tracker: Audit Fixes Status
**Updated**: 2026-04-07  
**Scope**: portfolio/ + SPRINT23/24 improvements from prior audits

## Fix Status Matrix

| Issue | Original | Current Status | Evidence | Blocker Level |
|-------|----------|----------------|----------|---------------|
| Hardcoded Thresholds | 50M duplicated | ✅ FIXED | `domain_constants.py` centralizes ORDER_FLOW_*_THRESHOLD_VND | LOW (static) |
| Magic Numbers | Scattered 50M/1B | ✅ PARTIAL+ | Whale buckets + user threshold + per-symbol override (`TrackedSymbol.whale_alert_threshold_million`) | MEDIUM |
| Inline Imports | models import in functions | ❌ PENDING | No repositories.py | HIGH |
| Dynamic ADV | No ADV_10d scaling | ❌ PENDING | Static 50M | HIGH |
| Reversal Alert | Missing P1-7 | ❌ PENDING | No detect_reversal | MEDIUM |
| Severity Tags | No 🔴🟡🟢 | ❌ PENDING | No WhaleAdvisory.severity | LOW |
| Repository Pattern | Logic-DB coupling | ❌ PENDING | Inline _fetch_ticks() | MEDIUM |

## Progress Highlights
- **✅ domain_constants.py**: Central config (40% config debt fixed)
- **✅ User Thresholds**: Runtime per-user whale via UserConfig
- **✅ Symbol Threshold Overrides**: Runtime per-symbol whale threshold via TrackedSymbol API/UI
- **📈 SPRINT23 Closure**: Validation unification, no manual parsing top10 endpoints

## Immediate Next (Week1)
1. **Dynamic ADV**: `threshold = adv10d * 0.001`
2. **Severity Mapping**: strength → emoji tags
3. **repositories.py**: Extract DB from order_flow.py

**Readiness**: 8.8/10 → Target 9.5/10 post P0
