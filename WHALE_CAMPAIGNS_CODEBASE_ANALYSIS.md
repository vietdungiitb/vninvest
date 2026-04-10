# Whale Campaign Implementation - Codebase Analysis
**Date**: April 10, 2026  
**Analysis Scope**: Backend whale campaign/grouping implementation  
**Commit**: `042cc3e0` - feat(whale): add campaigns API, cursor pagination, and hub automation tests

---

## FINDINGS SUMMARY

### 1. ✅ WhaleCampaign Model Status
**RESULT**: NO DJANGO MODEL EXISTS
- Campaigns are **computed dynamically** on each request
- Built by grouping `IntradayTick` events into campaign clusters
- Returns plain Python dictionaries (no ORM persistence)
- Stateless - no campaign history stored in DB

### 2. ✅ Campaign Grouping Implementation Status  
**RESULT**: FULLY IMPLEMENTED & TESTED
- **Service Method**: `market_data_service.get_whale_campaigns()` 
- **Core Algorithm**: `_group_events_into_campaigns(events, max_gap_minutes)`
- **Status**: Live in production
- **Test Coverage**: 4 test cases, all passing

### 3. ✅ WhaleEvent/Whale Events Data Structure
**RESULT**: Events stored in `IntradayTick` model, converted to dict on retrieval

**Individual Event Dict**:
```python
{
    'event_id': 'whale:FPT:2026-04-10T09:15:00+07:00:buy:700000000.0:500000.0',
    'symbol': 'FPT',
    'side': 'buy' | 'sell' | 'neutral',
    'ts': '2026-04-10T09:15:00+07:00',
    'matched_value': 700000000.0,  # VND
    'price': 100000.0,
    'volume': 7000.0,
    'source': 'redis_stream' | 'intraday_tick_db' | 'vnstock',
    'event_score': 0.75,    # 0-1 scoring
    'display_score': 85,    # 0-100 for UI
    'threshold_source': 'user_default' | 'user_override',
    'size_class': 'shark' | 'whale' | 'small'
}
```

### 4. ✅ Campaign Data Structure
**RESULT**: Campaign dict returned from API (no model)

**Campaign Dict**:
```python
{
    'campaign_id': 'camp:md5_hash[:16]',  # Deterministic ID from event cluster
    'contract_version': '1.0',
    'symbol': 'FPT',
    'side_bias': 'buy' | 'sell' | 'mixed',
    'campaign_type': 'accumulation' | 'distribution' | 'mixed',
    'campaign_strength': 45.32,         # 0-100 computed score
    'event_count': 2,                   # Number of events in cluster
    'total_matched_value': 1502000000.0, # VND
    'avg_event_score': 0.75,
    'duration_seconds': 300,            # Time span
    'created_at': '2026-04-10T09:15:00+07:00',
    'last_event_at': '2026-04-10T09:20:00+07:00',
    'source_mix': {'redis_stream': 1, 'intraday_tick_db': 1},
    'baseline_context': {  # Optional, added if BASELINE_CACHE_ENABLED=True
        'adv_relative': 0.12,
        'session_percentile': 75,
        'adv_vnd': 5000000000.0,
        'price_anchor': 100000.0
    },
    'events': [  # Array of individual event dicts
        { event_dict },
        { event_dict }
    ]
}
```

---

## IMPLEMENTATION STATUS

### ✅ Fully Implemented Features
1. **Campaign Grouping Algorithm** 
   - File: `market_data_service.py:1078-1180`
   - Clusters events by (symbol, side, time_gap)
   - Strength score: `(count*8) + (value/1B*2.5) + (event_score*0.45)`

2. **Multi-Sort Campaign Support**
   - By strength (default)
   - By latest timestamp
   - By total matched value

3. **Cursor Pagination**
   - Methods: `_encode_campaign_cursor()`, `_decode_campaign_cursor()`, `_build_campaign_next_cursor()`
   - Works with all 3 sort strategies
   - Tested in `test_whale_campaigns_supports_cursor_pagination()`

4. **Multi-Source Event Aggregation**
   - Redis stream (realtime)
   - IntradayTick DB (historical today)
   - vnstock (fallback)

5. **Optional Baseline Enrichment**
   - File: `baseline_cache_service.py:219-239`
   - Adds ADV relative, session percentile
   - Only if `BASELINE_CACHE_ENABLED=True`
   - Non-blocking (best-effort)

6. **API Endpoint**
   - Route: `GET /api/realtime/whale-campaigns/`
   - Class: `WhaleCampaignsView` (both views.py and market_views.py)
   - URL: `urls_realtime.py:53`
   - Query params: window, campaign_limit, campaign_sort, cursor, campaign_gap_minutes

### ❌ NOT Implemented
1. **Django Campaign Model** - No `WhaleCampaign` model exists
2. **Campaign Persistence** - No DB storage for campaigns
3. **Campaign History** - No archival or time-series tracking
4. **Campaign Webhooks** - No campaign lifecycle events
5. **User Campaign Relations** - Can't save/favorite campaigns
6. **Campaign Alerts** - No per-campaign notification rules

---

## CURRENT DATA SOURCES & FLOW

```
Raw Data Sources:
├── redis_stream (realtime tick subscription)
├── IntradayTick DB (today's trades)
└── vnstock API (fallback)
          ↓
get_whale_feed_aggregate()
  - Filter by threshold
  - Filter by window (session/5d)
  - Sort events
          ↓
List[whale_event_dict]
          ↓
_group_events_into_campaigns()
  - Normalize events (symbol, side, ts)
  - Sort by (symbol, side, ts)
  - Cluster by gap_minutes threshold
  - Score each cluster
          ↓
List[campaign_dict]
          ↓
Sort campaigns by (strength|latest|value)
          ↓
Cursor pagination (limit=25, default)
          ↓
Optional: enrich_campaign_with_baseline()
          ↓
API Response: {results, next_cursor, has_more, ...}
```

---

## RECENT COMMIT CHANGES (042cc3e0)

**Added Files/Methods**:
- Campaign grouping service method (market_data_service.py)
- Cursor pagination helpers
- WhaleCampaignsView endpoint
- 247 new test lines
- Frontend WhaleAlertsHub refactor for campaign display

**Changed**:
- market_data_service.py: +488 lines
- views.py: +179 lines  
- whale_feed_helpers.py: +110 lines
- test_api_routes.py: +247 lines
- Multiple i18n string additions

---

## TEST COVERAGE (4 Tests)

| Test | Status | Purpose |
|------|--------|---------|
| `test_whale_campaigns_groups_events_into_campaigns()` | ✅ PASS | Verifies 3 ticks→2 campaigns grouping |
| `test_whale_campaigns_rejects_invalid_campaign_limit()` | ✅ PASS | Campaign limit validation |
| `test_whale_campaigns_supports_cursor_pagination()` | ✅ PASS | Multi-page cursor navigation |
| `test_whale_campaigns_applies_baseline_enrichment_hook()` | ✅ PASS | Optional baseline enrichment |

---

## KEY FILES REFERENCE

| File | Key Methods/Classes |
|------|---------------------|
| market_data_service.py | `get_whale_campaigns()`, `_group_events_into_campaigns()`, `_build_campaign_next_cursor()`, `_apply_campaign_cursor()` |
| market_views.py | `WhaleCampaignsView` (new market view refactor) |
| views.py | `WhaleCampaignsView` (legacy view) |
| realtime/compute.py | `WhaleSignal` dataclass |
| baseline_cache_service.py | `enrich_campaign_with_baseline()` |
| urls_realtime.py | Route registration |
| tests/test_api_routes.py | Campaign test cases (3532-3700) |

---

## DEPLOYMENT NOTES

✅ **Status**: READY FOR PRODUCTION
- Live in commit 042cc3e0 (merged to deploy branch)
- Cursor pagination handles large result sets efficiently
- Multi-source fallback ensures availability
- Optional baseline enrichment doesn't block API

⚠️ **Monitoring**:
- `record_whale_event_observation()` tracks event pipeline metrics
- Source layer observability (redis_stream, intraday_tick_db, vnstock)
- Rate limiting backoff tracked for vnstock

📊 **Performance**:
- Campaign grouping: O(n log n) sorting + O(n) clustering
- Cursor pagination: Efficient offset-less pagination
- Caching: Individual whale feeds cached, campaigns computed fresh

---

## CONCLUSION

The whale campaign feature is **fully implemented** at the service layer with no persistent model needed. Campaigns are computed on-demand by clustering whale events based on symbol, side, and time proximity. The implementation includes robust pagination, multiple sort strategies, and optional baseline enrichment for context. All business logic is tested and production-ready.
