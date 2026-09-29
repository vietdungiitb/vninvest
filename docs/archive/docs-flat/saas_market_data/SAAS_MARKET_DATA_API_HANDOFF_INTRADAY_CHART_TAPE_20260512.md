# HANDOFF — PURE SaaS Market Data API: Intraday Chart + Tape
**Ngày**: 2026-05-12  
**Receiver**: Backend Team (packages/core)  
**Goal**: Implement 2 missing endpoints to unblock frontend migration to pure SaaS  
**Scope**: `/core/v1/market-data/intraday-prices/` + `/core/v1/market-data/intraday-tape/`  
**Timeline**: 5-7 ngày dev + 2 ngày test + 2 ngày integration  

---

## 1. EXECUTIVE SUMMARY

Frontend hiện đang fallback sang legacy `/api/stock-management/stocks/{symbol}/chart/` cho intraday OHLCV bars. Để tắt legacy container hoàn toàn, backend SaaS phải cung cấp **2 endpoints bắt buộc**:

| Endpoint | Purpose | Legacy Source | Priority |
|----------|---------|--|---|
| `GET /core/v1/market-data/intraday-prices/{symbol}/` | Intraday OHLCV bars (1m, 5m, 15m, 1H, etc.) | `/api/stock-management/stocks/{symbol}/chart/` | P0 |
| `GET /core/v1/market-data/intraday-tape/{symbol}/` | Intraday tick trades (for tape chart) | `/api/realtime/intraday/{symbol}/` | P0 |

**Bàn giao này bao gồm**:
- ✅ Đầy đủ schema contract TypeScript
- ✅ Query parameters + defaults
- ✅ Data source priority chain
- ✅ Unit normalization (THOUSAND_VND)
- ✅ Model updates cần thiết (IntradayTick migration)
- ✅ Implementation roadmap + breaking points
- ✅ Test strategy + validation checklist

---

## 2. ENDPOINT SPEC #1: INTRADAY OHLCV BARS

### 2.1 Route Definition

```python
# File: packages/core/backend/src/market_data/urls.py
path('market-data/intraday-prices/<str:symbol>/', 
     views.IntradayPricesView.as_view(), 
     name='intraday-prices'),
```

### 2.2 Query Parameters

| Param | Type | Default | Validators | Description |
|-------|------|---------|--|---|
| `timeframe` | String | `1H` | 1m, 5m, 15m, 30m, 1H, 2H, 4H, D, W, M | Candlestick period |
| `date_from` | String | -30 days ago | YYYY-MM-DD | Filter start (inclusive) |
| `date_to` | String | Today | YYYY-MM-DD | Filter end (inclusive) |
| `limit` | Integer | 500 | 1-5000 | Max bars to return |
| `cursor` | String (optional) | null | Opaque string | Pagination cursor |

**Validation Rules**:
- `timeframe` phải supported; return 400 nếu invalid
- `date_from` >= `date_to` → return 400
- `date_to - date_from` không vượt quá **lookback cap** theo timeframe:
  - 1m: 5 ngày
  - 5m: 20 ngày
  - 15m: 60 ngày
  - 1H: 180 ngày
  - 2H, 4H: 365 ngày
  - D, W, M: unlimited

### 2.3 Response Schema

```typescript
interface IntradayBar {
  ts: string;           // ISO8601 timestamp (market timezone)
  timeframe: string;    // e.g. '1H'
  open: number;         // Price in canonical unit (THOUSAND_VND)
  high: number;
  low: number;
  close: number;
  volume: number;       // Share count
}

interface IntradayPricesResponse {
  symbol: string;
  timeframe: string;
  date_from: string;    // YYYY-MM-DD
  date_to: string;      // YYYY-MM-DD
  results: IntradayBar[];
  next_cursor: string | null;  // If more results available
  source: 'redis_stream' | 'vnbroker' | 'db' | 'fallback';
  is_stale: boolean;    // True if latest bar > 5 min old
  fetched_at: string;   // ISO8601
}
```

### 2.4 Implementation Notes

#### Data Source Priority

```
1. Redis Stream (real-time, <1s old)
   ↓ If empty
2. vnbroker API (via cached adapter, ~2s latency)
   ↓ If rate-limited or unavailable
3. IntradayTick DB (historical depth, > 5s latency)
   ↓ If gap in DB
4. Aggregated DailyPrice (fallback, EOD only)
```

#### Aggregation Logic

- **1m, 5m, 15m**: Fetch ticks từ `IntradayTick` table + apply OHLC aggregation
- **1H+**: Fetch từ vnbroker (dù có stored ticks hay không) → cache lên Redis 15 phút
- **D, W, M**: Fetch từ `market_data.DailyPrice` + do rolling aggregation

#### Unit Normalization

All prices **MUST** be returned as **THOUSAND_VND** (canonical):

```python
def normalize_price_to_canonical(raw_price_vnd: Decimal) -> float:
    """VCB @ 92,500 VND → 92.5"""
    return float(raw_price_vnd) / 1000.0

def denormalize_price_from_canonical(canonical_price: float) -> Decimal:
    """92.5 → 92,500 VND"""
    return Decimal(str(canonical_price * 1000))
```

#### Stale Detection

```python
is_stale = (now - latest_bar_ts).total_seconds() > 300  # 5 minutes
```

Khi `is_stale=True`, frontend sẽ hiển thị warning badge "Dữ liệu có thể chưa cập nhật".

#### Rate Limiting

- Throttle scope: `market_data`
- Recommended: 100 requests/minute per user
- Return 429 với `Retry-After` header

---

## 3. ENDPOINT SPEC #2: INTRADAY TAPE (Tick Trades)

### 3.1 Route Definition

```python
# File: packages/core/backend/src/market_data/urls.py
path('market-data/intraday-tape/<str:symbol>/', 
     views.IntradayTapeView.as_view(), 
     name='intraday-tape'),
```

### 3.2 Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|---|
| `date_from` | String | Today | YYYY-MM-DD |
| `date_to` | String | Today | YYYY-MM-DD |
| `limit` | Integer | 500 | Max ticks to return |
| `offset` | Integer | 0 | Skip this many records |
| `side_filter` | String (optional) | null | 'buy', 'sell', 'all' |

**Validation Rules**:
- `date_to - date_from` không vượt quá **7 ngày**
- `limit` không vượt quá **5000**
- `offset + limit` không vượt quá **50,000** (prevent table scans)

### 3.3 Response Schema

```typescript
interface IntradayTrade {
  ts: string;           // ISO8601 timestamp
  time: string;         // HH:MM:SS format
  price: number;        // Matched price (THOUSAND_VND)
  volume: number;       // Share count
  side: 'buy' | 'sell' | 'unknown';  // Buy/Sell side
  match_type: string;   // 'BUY', 'SELL', 'ATO', 'ATC', etc.
}

interface IntradayTapeResponse {
  symbol: string;
  date_from: string;    // YYYY-MM-DD
  date_to: string;      // YYYY-MM-DD
  total_count: number;  // Total records matching filter (estimated)
  results: IntradayTrade[];
  has_more: boolean;    // True if more records available
  source: 'redis_stream' | 'vnbroker' | 'db' | 'fallback';
  is_stale: boolean;    // True if latest trade > 5 min old
  fetched_at: string;   // ISO8601
  source_event_at: string | null;  // Latest tick timestamp
}
```

### 3.4 Implementation Notes

#### Data Source Priority

```
1. Redis Stream (real-time)
   ↓ If empty
2. vnbroker live stream (pull fresh)
   ↓ If unavailable
3. IntradayTick DB (historical)
   ↓ If no recent data
4. Empty array (market closed or no data)
```

#### IntradayTick Model

Current model (backend/portfolio/models.py):
```python
class IntradayTick(models.Model):
    symbol: CharField
    trade_date: DateField        # YYYY-MM-DD
    trade_time: TimeField        # HH:MM:SS
    price: DecimalField          # In VND (NOT canonical)
    volume: BigIntegerField
    side: CharField              # BUY, SELL, UNKNOWN
    match_type: CharField
    stream_id: CharField         # Redis stream ID
    created_at: DateTimeField
    
    class Meta:
        indexes = [
            Index(fields=['symbol', 'trade_date', 'trade_time']),
            Index(fields=['symbol', 'trade_date', 'side']),
        ]
```

**Action Required**: 
- ✅ No schema changes needed (price column already supports VND scale)
- ⚠️ Ensure `created_at` is indexed for fast "today's trades" queries
- 🔧 Add query optimization: filter by `trade_date` first, then paginate by `trade_time`

#### Query Optimization

```python
# Efficient query pattern:
IntradayTick.objects.filter(
    symbol=symbol.upper(),
    trade_date__range=[date_from, date_to],
    side__in=side_filter  # If specified
).order_by('-trade_date', '-trade_time')[offset:offset+limit]
```

---

## 4. DATA MIGRATION & SEEDING

### 4.1 Seed Requirements (Critical Blocker)

Frontend currently tests with **VCB, TPB, FPT, SSI** minimum. Before cutover, populate:

#### Daily Prices (market_data.DailyPrice)

```sql
-- Seed 3 years of daily OHLCV for primary symbols
INSERT INTO market_data_daily_price (
    symbol, date, open, high, low, close, volume, value, source, is_adjusted
)
SELECT ... FROM legacy_daily_price
WHERE symbol IN ('VCB', 'TPB', 'FPT', 'SSI', 'VNM', 'VIC')
AND date >= DATE('2023-05-12')
ORDER BY date;
```

**Status**: Check packages/core/backend test data fixtures

#### Intraday Ticks (portfolio.IntradayTick)

```sql
-- Seed latest 10 trading days for main symbols
INSERT INTO portfolio_intradaytick (
    symbol, trade_date, trade_time, price, volume, side, match_type, stream_id
)
SELECT ... FROM legacy_intraday_ticks
WHERE symbol IN ('VCB', 'TPB')
AND trade_date >= DATE_SUB(CURDATE(), INTERVAL 10 DAY)
ORDER BY trade_date, trade_time;
```

**Status**: Needed (currently empty in dev DB)

### 4.2 Materialization Strategy

Intraday bars aggregation phải **lazy-computed** (not materialized upfront):

```python
def aggregate_ticks_to_ohlc(ticks: List[IntradayTick], timeframe: str) -> List[dict]:
    """
    Group ticks by timeframe bucket and compute OHLC.
    For 1m: 09:30-09:31, 09:31-09:32, etc.
    """
    buckets = defaultdict(list)
    for tick in ticks:
        bucket_key = round_timestamp_to_bucket(tick.timestamp, timeframe)
        buckets[bucket_key].append(tick)
    
    results = []
    for bucket_key, bucket_ticks in sorted(buckets.items()):
        results.append({
            'ts': bucket_key.isoformat(),
            'open': bucket_ticks[0].price,
            'high': max(t.price for t in bucket_ticks),
            'low': min(t.price for t in bucket_ticks),
            'close': bucket_ticks[-1].price,
            'volume': sum(t.volume for t in bucket_ticks),
        })
    return results
```

**Rationale**: 
- Saves DB space (no pre-computed 1m/5m/15m tables)
- Tolerates late ticks (streaming corrections)
- Allows future granularity changes without rebuild

---

## 5. IMPLEMENTATION ROADMAP

### Phase A: Scaffolding (Day 1)

**Deliverable**: Views + Serializers + URLs configured

```
backend/
├── packages/core/backend/src/market_data/
│   ├── views.py                        [ADD: IntradayPricesView, IntradayTapeView]
│   ├── serializers.py                  [ADD: IntradayBarSerializer, IntradayTradeSerializer]
│   ├── urls.py                         [UPDATE: Add both routes]
│   ├── adapters/
│   │   ├── intraday_aggregator.py      [NEW: OHLC bucket logic]
│   │   └── tick_stream_adapter.py      [NEW: Redis stream consumer for ticks]
│   └── tests/
│       └── test_intraday_api.py        [NEW: Unit tests]
```

**Breaking Point A1**: Views resolve to correct view class
```bash
curl -X GET "http://localhost:8000/core/v1/market-data/intraday-prices/VCB/?timeframe=1H"
# Should return 401 (auth required) or 200 with schema
```

### Phase B: Data Layer (Day 2)

**Deliverable**: Seed data + efficient queries

**Tasks**:
1. Verify DailyPrice table has seed data for VCB, TPB
2. Verify IntradayTick table has recent (last 30 days) trade data
3. Test query performance:
   ```bash
   time django-admin shell
   >>> IntradayTick.objects.filter(symbol='VCB', trade_date=date.today()).count()
   # Should run < 50ms
   ```

**Breaking Point B1**: Data exists and queries fast
```bash
python manage.py dbshell
select count(*) from portfolio_intradaytick where symbol='VCB' and trade_date >= date_sub(curdate(), interval 10 day);
# Result should be > 1000
```

### Phase C: Core Logic (Day 3-4)

**Deliverable**: Full endpoint implementation with edge cases

**Tasks**:
1. Implement `IntradayPricesView.get()`:
   - Parse + validate query params
   - Build query per timeframe (ticks vs vnbroker vs daily)
   - Apply OHLC aggregation
   - Return paginated results
   
2. Implement `IntradayTapeView.get()`:
   - Parse + validate query params
   - Query IntradayTick table
   - Apply side filtering
   - Calculate `total_count` (for pagination UI)
   - Return results with `has_more` flag

3. Unit tests (80% coverage minimum):
   - Valid queries return 200 + correct schema
   - Invalid timeframe returns 400
   - Out-of-range lookback returns 400
   - Empty date range returns empty array (not 404)
   - Pagination works (cursor/offset)
   - Unit conversion correct (price/1000)

**Breaking Point C1**: Both endpoints return valid JSON
```bash
curl -X GET "http://localhost:8000/core/v1/market-data/intraday-prices/VCB/?timeframe=1H"
# Status: 200
# Response has: symbol, results[], next_cursor, source, is_stale

curl -X GET "http://localhost:8000/core/v1/market-data/intraday-tape/VCB/"
# Status: 200
# Response has: symbol, results[], has_more, total_count, source
```

### Phase D: Integration (Day 5)

**Deliverable**: Endpoints work with actual data pipeline

**Tasks**:
1. Test with real vnbroker data (if available):
   - Fallback to vnbroker when IntradayTick empty
   - Cache vnbroker results 15 minutes
   - Handle rate limits gracefully
   
2. Test Redis stream consumer (if running):
   - New ticks appear in tape endpoint < 2s after ingest
   - OHLC bars update in real-time
   
3. Performance load test:
   - 100 concurrent requests to same symbol
   - p95 latency < 500ms
   - p99 latency < 2s

**Breaking Point D1**: Endpoints handle 100 req/s without errors
```bash
ab -n 1000 -c 100 'http://localhost:8000/core/v1/market-data/intraday-prices/VCB/?timeframe=1H'
# Requests per second >= 50
# Failures == 0
```

### Phase E: Audit & Sign-off (Day 6-7)

**Deliverable**: Evidence package + frontend integration ready

**Tasks**:
1. Update `docs/CODE_CHANGE_AUDIT_LEDGER.md` with:
   - All new files
   - All modified files
   - Line count delta
   - Breaking changes (none expected)

2. Generate execution evidence:
   - Screenshot of both endpoints working
   - Test output (pytest)
   - Load test result
   - Database count verification

3. Notify frontend team:
   - Both endpoints live at `/core/v1/market-data/*`
   - Schema locked (no breaking changes planned)
   - Seed data ready (VCB, TPB, FPT tested)

---

## 6. TESTING STRATEGY

### 6.1 Unit Tests (Framework: pytest)

**File**: `packages/core/backend/tests/test_intraday_api.py`

```python
# Test valid queries
def test_intraday_prices_valid_1h_query():
    """GET intraday-prices/{symbol}/?timeframe=1H returns 200 + correct schema"""
    response = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=1H')
    assert response.status_code == 200
    data = response.json()
    assert 'symbol' in data
    assert 'results' in data
    assert all('ts' in r and 'open' in r for r in data['results'])

# Test invalid params
def test_intraday_prices_invalid_timeframe():
    """Invalid timeframe returns 400"""
    response = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=INVALID')
    assert response.status_code == 400

def test_intraday_prices_lookback_exceeded():
    """Lookback cap enforced: 1m can only go back 5 days"""
    response = client.get(
        '/core/v1/market-data/intraday-prices/VCB/',
        {'timeframe': '1m', 'date_from': '2020-01-01'}
    )
    assert response.status_code == 400
    assert 'lookback' in response.data['detail'].lower()

# Test empty results
def test_intraday_prices_no_data():
    """No data available returns 200 with empty results (not 404)"""
    response = client.get('/core/v1/market-data/intraday-prices/NOTEXIST/')
    assert response.status_code == 200
    assert response.json()['results'] == []

# Test pagination
def test_intraday_tape_pagination():
    """Pagination works: limit + cursor"""
    response1 = client.get('/core/v1/market-data/intraday-tape/VCB/?limit=100')
    assert response1.status_code == 200
    data1 = response1.json()
    if data1['has_more']:
        cursor = data1['next_cursor']
        response2 = client.get(f'/core/v1/market-data/intraday-tape/VCB/?cursor={cursor}')
        assert response2.status_code == 200
        data2 = response2.json()
        # Verify no overlap
        ids1 = [t['ts'] for t in data1['results']]
        ids2 = [t['ts'] for t in data2['results']]
        assert len(set(ids1) & set(ids2)) == 0

# Test unit conversion
def test_price_unit_normalization():
    """Prices returned in THOUSAND_VND (canonical)"""
    response = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=D')
    data = response.json()
    # Verify prices are reasonable floats (not huge integers)
    assert all(50 < r['open'] < 500 for r in data['results'])  # Typical VN range

# Test auth
def test_intraday_requires_authentication():
    """Unauthenticated requests return 401"""
    client.force_authenticate(user=None)
    response = client.get('/core/v1/market-data/intraday-prices/VCB/')
    assert response.status_code == 401
```

### 6.2 Integration Tests

**File**: `packages/core/backend/tests/test_intraday_integration.py`

```python
# Test against real seed data
def test_intraday_with_seed_data():
    """Both endpoints work with pre-seeded VCB + TPB data"""
    # Arrange: Seed IntradayTick + DailyPrice
    for symbol in ['VCB', 'TPB']:
        # ... create fixtures
        pass
    
    # Act: Query both endpoints
    prices = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=1H')
    tape = client.get('/core/v1/market-data/intraday-tape/VCB/')
    
    # Assert
    assert prices.status_code == 200
    assert tape.status_code == 200
    assert len(prices.json()['results']) > 0
    assert len(tape.json()['results']) > 0

# Test data consistency
def test_intraday_bars_match_ticks():
    """OHLC aggregation from ticks is correct"""
    # Create 10 ticks for VCB
    ticks = [
        IntradayTick(symbol='VCB', price=100, volume=100),
        IntradayTick(symbol='VCB', price=102, volume=200),
        ...
    ]
    IntradayTick.objects.bulk_create(ticks)
    
    # Get aggregated 1m bar
    response = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=1m')
    bar = response.json()['results'][0]
    
    # Verify aggregation
    assert bar['open'] == 100
    assert bar['high'] == 105
    assert bar['low'] == 98
    assert bar['volume'] == 1500  # sum of all volumes
```

### 6.3 Contract Validation Tests

**File**: `packages/core/backend/tests/test_intraday_contracts.py`

```python
# Validate JSON schema matches TypeScript interfaces
def test_intraday_prices_response_schema():
    """Response matches IntradayPricesResponse interface"""
    response = client.get('/core/v1/market-data/intraday-prices/VCB/?timeframe=1H')
    data = response.json()
    
    # Top-level fields required
    required = {'symbol', 'timeframe', 'results', 'next_cursor', 'source', 'is_stale', 'fetched_at'}
    assert required.issubset(data.keys())
    
    # Each bar has correct fields
    for bar in data['results']:
        assert all(f in bar for f in ['ts', 'open', 'high', 'low', 'close', 'volume'])
        assert all(isinstance(bar[f], (int, float)) for f in ['open', 'high', 'low', 'close', 'volume'])
        assert isinstance(bar['ts'], str)

def test_intraday_tape_response_schema():
    """Response matches IntradayTapeResponse interface"""
    response = client.get('/core/v1/market-data/intraday-tape/VCB/')
    data = response.json()
    
    # Top-level fields required
    required = {'symbol', 'results', 'has_more', 'total_count', 'source', 'is_stale'}
    assert required.issubset(data.keys())
    
    # Each trade has correct fields
    for trade in data['results']:
        assert all(f in trade for f in ['ts', 'time', 'price', 'volume', 'side', 'match_type'])
        assert trade['side'] in {'buy', 'sell', 'unknown'}
```

### 6.4 Running Tests

```bash
cd backend

# Run all intraday tests
python manage.py test packages.core.backend.tests.test_intraday_api \
                          packages.core.backend.tests.test_intraday_integration \
                          packages.core.backend.tests.test_intraday_contracts \
  --keepdb --parallel 2 --verbosity 2

# Run with coverage
coverage run --source='packages/core/backend' manage.py test ...
coverage report --skip-covered
coverage html  # View at htmlcov/index.html
```

---

## 7. VALIDATION CHECKLIST

Before marking endpoints as "READY":

### Functional (Must Pass)

- [ ] Both endpoints exist and resolve to correct view class
- [ ] Query params validated (invalid returns 400 with clear message)
- [ ] Response schema matches TypeScript interfaces exactly
- [ ] Pagination works (cursor-based or offset)
- [ ] Unit conversion correct (price / 1000)
- [ ] Auth required (unauthenticated returns 401)
- [ ] Rate limiting applied (throttle_scope='market_data')
- [ ] Empty results return 200 (not 404)
- [ ] VCB + TPB have seed data (> 1000 records each)

### Performance (Must Meet)

- [ ] Single request latency p95 < 500ms
- [ ] Concurrent 100 req/s: p95 < 1s, failures < 1%
- [ ] Query explain plan uses indexes (no table scans)
- [ ] Memory usage stable (no memory leaks)

### Integration (Must Work)

- [ ] Frontend client consumes both endpoints without error
- [ ] Frontend charts render daily + intraday data correctly
- [ ] Frontend whale alerts update in real-time (if Redis enabled)
- [ ] No 500 errors in backend logs

### Data Quality (Must Verify)

- [ ] Prices always > 0
- [ ] Volume always > 0
- [ ] High >= Open, Low <= Close (OHLC sanity)
- [ ] Timestamps monotonically increasing
- [ ] No duplicate ticks (same ts + price + volume)

---

## 8. HANDOFF CHECKLIST

Before frontend team migrates from legacy endpoints:

- [ ] Code review passed (RUN_CODE_REVIEW_SAAS_MIGRATION_20260504.md)
- [ ] All tests passing (RUN_INTEGRATION_TESTS_SAAS_MIGRATION_20260504.md)
- [ ] Spec audit passed (RUN_SPEC_AUDIT_SAAS_MIGRATION_20260504.md)
- [ ] Seed data verified for VCB, TPB, FPT, SSI, VNM, VIC
- [ ] Documentation updated (this file + inline docstrings)
- [ ] Execution evidence collected (screenshots + logs)
- [ ] Zero breaking changes to existing `/core/v1/*` endpoints
- [ ] Monitoring/alerts configured (if using Sentry/Prometheus)

**Sign-off Template**:
```markdown
## Intraday API Ready for Production

**Endpoints**: 
- ✅ GET /core/v1/market-data/intraday-prices/{symbol}/
- ✅ GET /core/v1/market-data/intraday-tape/{symbol}/

**Evidence**:
- Tests: 145/145 passing (0 failures)
- Coverage: 89% line, 94% branch
- Load test: 100 req/s, p95=320ms
- Seed data: VCB (5,420 ticks), TPB (4,103 ticks)

**Approved by**: [Tech Lead name]
**Date**: YYYY-MM-DD
**Next step**: Frontend migration begins
```

---

## 9. RISK & MITIGATION

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| IntradayTick table empty (no seed) | High | Blocking | Pre-populate 30 days of VCB+TPB data before Phase B |
| Queries slow (table scan) | Medium | 500ms+ latency | Add indexes on (symbol, trade_date, trade_time) |
| Unit conversion bugs | Medium | Charts misaligned | Comprehensive test with known VCB price (e.g. 92.5) |
| vnbroker fallback rate-limited | Low | Stale data | Implement exponential backoff + cache longer (30min) |
| Redis stream unavailable | Low | No real-time tape | Document fallback: IntradayTick DB is always available |
| Time zone issues (market vs UTC) | Medium | Wrong timestamps | Explicitly set timezone='Asia/Ho_Chi_Minh' in model |
| Memory spike with large result sets | Low | OOM | Enforce limit <= 5000 + pagination mandatory |

---

## 10. COMMUNICATION PLAN

### Kickoff (Day 0)
- Share this document with backend team
- Answer any clarification questions
- Confirm Scrum board tickets created

### Daily Standup (Days 1-7)
- Report phase completion status (A/B/C/D/E)
- Flag blockers immediately
- Share breaking point validation results

### Handoff (Day 7)
- Present execution evidence (test results + screenshots)
- Get sign-off from tech lead
- Deploy to staging for frontend integration test

### Follow-up (Week 2)
- Monitor production errors for intraday endpoints
- Track frontend migration timeline
- Plan legacy endpoint sunset (when frontend fully migrated)

---

## 11. APPENDIX: Reference Schema

### TypeScript Interfaces (for frontend)

```typescript
// Query types
export interface IntradayPricesQuery {
  timeframe?: '1m' | '5m' | '15m' | '30m' | '1H' | '2H' | '4H' | 'D' | 'W' | 'M';
  date_from?: string;
  date_to?: string;
  limit?: number;
  cursor?: string;
}

export interface IntradayTapeQuery {
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  side_filter?: 'buy' | 'sell' | 'all';
}

// Response types
export interface IntradayBar {
  ts: string;
  timeframe: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IntradayPricesResponse {
  symbol: string;
  timeframe: string;
  date_from: string;
  date_to: string;
  results: IntradayBar[];
  next_cursor: string | null;
  source: 'redis_stream' | 'vnbroker' | 'db' | 'fallback';
  is_stale: boolean;
  fetched_at: string;
}

export interface IntradayTrade {
  ts: string;
  time: string;
  price: number;
  volume: number;
  side: 'buy' | 'sell' | 'unknown';
  match_type: string;
}

export interface IntradayTapeResponse {
  symbol: string;
  date_from: string;
  date_to: string;
  total_count: number;
  results: IntradayTrade[];
  has_more: boolean;
  source: 'redis_stream' | 'vnbroker' | 'db' | 'fallback';
  is_stale: boolean;
  fetched_at: string;
  source_event_at: string | null;
}
```

### Django Model Reference

```python
# Key existing models to know
from portfolio.models import IntradayTick, DailyPrice, TickerSessionClose
from market_data.models import StockProfile, DailyPrice as CoreDailyPrice

# IntradayTick current structure
symbol: str               # 'VCB'
trade_date: date         # 2026-05-12
trade_time: time         # 09:30:45
price: Decimal           # 92500.00 (VND, NOT canonical)
volume: int              # 5000
side: str                # 'BUY', 'SELL', 'UNKNOWN'
match_type: str          # Custom classifier
stream_id: str           # Redis stream position
created_at: datetime     # When record was created
```

---

**Document Version**: 1.0  
**Last Updated**: 2026-05-12  
**Status**: READY FOR BACKEND TEAM EXECUTION
