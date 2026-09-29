# Migration Path: Legacy DB → Native vnbroker

## Current State (During SAAS Migration)
- **Data Source**: Legacy portfolio_tickersessionclose table (read-only)
- **Write Target**: core_db SymbolSnapshot
- **Why Legacy?** Shadow run safety - verify parity before cutover
- **Risk**: Depends on legacy DB staying available

```
Legacy DB (portfolio_tickersessionclose)
           ↓ (read-only via LEGACY_DATABASE_URL)
    Materializer Task
           ↓ (upsert)
core_db SymbolSnapshot → API Responses
```

## Post-Migration (After Legacy Monolith Decommission)

### Phase 1: Flag & Plan
1. Verify **parity_score >= 0.99** on SymbolSnapshot for 7+ trading days
2. Get stakeholder approval to decommission legacy backend
3. Mark legacy DB for deletion

### Phase 2: Switch Data Source
Change `materialize_symbol_snapshot()` task:

**Before:**
```python
# packages/core/backend/src/market_serving/materializers.py
def materialize_symbol_snapshot(self):
    legacy_url = _get_legacy_db_url()
    rows = _fetch_from_legacy("SELECT ... FROM portfolio_tickersessionclose")
    # write to SymbolSnapshot
```

**After:**
```python
# packages/core/backend/src/market_serving/materializers.py
from market_serving.vnbroker_materializer import (
    materialize_symbol_snapshot_from_vnbroker
)

@shared_task(bind=True, max_retries=3)
def materialize_symbol_snapshot(self):
    # Drop-in replacement - same contract, different source
    return materialize_symbol_snapshot_from_vnbroker()
```

### Phase 3: Decommission Legacy
1. Remove `LEGACY_DATABASE_URL` from compose files
2. Stop legacy backend service
3. Delete legacy database backups (after retention period)

## Technical Details

### Contract Preservation
- **Read**: Legacy DB (portfolio_tickersessionclose) → SymbolSnapshot model
- **Write**: Same SymbolSnapshot fields (price, ceiling, floor, volume, etc.)
- **API Output**: Same ticket response (no frontend changes)
- **Downstream Impact**: NONE (contract maintained)

### Data Loss Prevention
Before Phase 2, ensure:
- [ ] SymbolSnapshot backfilled for 60+ VN100 symbols, 30+ trading days
- [ ] DailyPrice contains prev-close for ceiling/floor calculation
- [ ] Parity test passes on both legacy → vnbroker for 5 symbols
- [ ] Rollback procedure documented (restore LEGACY_DATABASE_URL)

### Migration Test (Optional Pre-Cut)
```bash
# Run both materializers in parallel (shadow mode)
python materialize_symbol_snapshot()  # Current: legacy DB
python materialize_symbol_snapshot_from_vnbroker()  # New: vnbroker

# Compare results
# If parity >= 99%, safe to cut over
```

### Cutover Checklist
- [ ] Feature flag added (if needed for rollback)
- [ ] Monitoring alerts setup (detect stale SymbolSnapshot)
- [ ] Communication to stakeholders
- [ ] Runbook for emergency rollback
- [ ] Legacy DB backups retained (per compliance)

## Files to Modify at Cutover

1. **market_serving/materializers.py**
   - Import vnbroker_materializer
   - Swap implementation in materialize_symbol_snapshot()
   - Remove _get_legacy_db_url() call

2. **docker-compose files**
   - Remove `LEGACY_DATABASE_URL` env var

3. **market_serving/vnbroker_materializer.py**
   - Already created, ready to use
   - Will be imported at cutover

## Estimated Timeline
- **Shadow Run**: 7-14 trading days (verify parity)
- **Cutover**: 1-2 hours (task swap + monitoring)
- **Cleanup**: Post-cutover (legacy DB deletion)

## Risks & Mitigations
| Risk | Mitigation |
|------|-----------|
| vnbroker API unavailable | Fallback to cached SymbolSnapshot (mark stale) |
| Price data mismatch | Pre-cutover parity test >= 99% |
| Missing fields (ceiling/floor) | DailyPrice backfill before cutover |
| Downstream API breakage | Contract tested (same output format) |

## Success Criteria
✓ SymbolSnapshot populated for 60+ symbols
✓ Parity with legacy = 99%+ for 5+ trading days
✓ Frontend displays ceiling/floor without errors
✓ API response times maintained (<500ms)
✓ No customer-facing data gaps

---

**Owner**: SAAS Migration Lead
**Target Date**: Post-SAAS-15 (Next phase after current work)
**Rollback**: Keep LEGACY_DATABASE_URL config for 2 weeks post-cutover
