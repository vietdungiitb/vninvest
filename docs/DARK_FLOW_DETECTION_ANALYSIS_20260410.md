# Dark Money Flow Detection Pipeline — Comprehensive Analysis
**Date**: 2026-04-10  
**Status**: Sprint 15 Implementation Complete (38/38 tests PASS)  
**Scope**: Backend order flow detection system analysis

---

## EXECUTIVE SUMMARY

The vninvest project implements a sophisticated dark money flow detection engine in **Sprint 15** comprising:
- **4 detection algorithms** (CVD, Tick Rate, Absorption, Iceberg Clustering)
- **Aggregated signal synthesis** (mixing multiple detectors → `signal_type`)
- **Celery-based continuous monitoring** (runs every 30s for tracked symbols)
- **WebSocket real-time alerts** (strength > 50 threshold)

**⚠️ Critical Finding**: Event IDs are generated but **NOT persisted** to the database, making event deduplication and idempotency problematic. No pagination cursor system exists.

---

## 1. CURRENT DARK FLOW DETECTION CODE

### 1.1 Function Location & Signature
**File**: [portfolio/order_flow.py](portfolio/order_flow.py#L427-L521)  
**Function**: `detect_dark_flow(symbol, avg_tick_rate_baseline=None)`

```python
def detect_dark_flow(
    symbol: str,
    avg_tick_rate_baseline: float | None = None,
) -> dict:
    """
    Gọi tất cả compute functions, aggregate thành signal tổng hợp.
    {signal_type, strength, confidence, components, triggered_at}
    signal_type: 'none' | 'absorption' | 'iceberg' | 'twap_bot' | 'mixed'
    """
```

**Return Structure**:
```python
{
    "signal_type": str,        # One of: none, absorption, iceberg, twap_bot, mixed
    "strength": float,         # 0-100 normalized score
    "confidence": str,         # low | medium | high
    "components": {
        "absorption": {...},           # See Section 1.5 for structure
        "iceberg": {...},
        "tick_rate": {...},
        "size_distribution": {...},
    },
    "triggered_at": str,       # ISO 8601 timestamp UTC
}
```

### 1.2 Event ID Generation & Persistence

**⚠️ CRITICAL ISSUE**: Event IDs are generated but NOT stored in the database.

**Event ID Format**:
```
dark_flow:{symbol}:{triggered_at_iso}:{signal_type}
```

**Example**:
```
dark_flow:VNM:2026-04-10T15:30:45.123456+00:00:iceberg
```

**Where Generated**:
- **File**: [portfolio/tasks.py](portfolio/tasks.py#L1397)
- **Code Location**: Line 1397 in `detect_and_store_order_flow()` task

```python
event_id = f"dark_flow:{sym}:{result.get('triggered_at', timezone.now().isoformat())}:{signal_type}"
```

**Current Persistence**: 
- ✅ Included in WebSocket payload (`data['event_id']`)
- ❌ NOT stored in `OrderFlowSignal` model
- ❌ NOT available for event deduplication or historical query
- ❌ NO audit trail in database

**Impact**: 
- Event replay vulnerability
- No way to query "was this event already processed?"
- Browser refresh → duplicate signal subscriptions possible

### 1.3 Severity/Strength Calculation Logic

**Three-layer strength calculation**:

#### Layer 1: Component Strength (algorithm-specific)

**A. Absorption Strength** (if `detected` flag true):
```python
# From detect_absorption(): 
strength_component = min(cvd_change_pct / 20 * 100, 100.0)
```
- `cvd_change_pct`: Absolute CVD change normalized to coefficient of variation
- Formula: `strength = (|cvd_change| / |mean_cvd| * 100) / 20 * 100`
- Interpretation: 20% CVD change → 100 strength

**B. Iceberg Clustering Strength**:
```python
# From detect_iceberg_clustering():
repeat_count = len(best_ticks)  # Number of repeated orders at same price level
strength_component = min(repeat_count / 2 * 10, 100.0)
```
- Example: 10 repeat orders → strength = 50

**C. TWAP Bot Strength**:
```python
# From detect_dark_flow():
baseline = avg_tick_rate_baseline or 5.0
tick_rate = tick_info["tick_rate_per_min"]
strength_component = min((tick_rate / baseline) * 20, 100.0)
```
- Example: 15 ticks/min vs 5 baseline → (15/5)*20 = 60 strength

#### Layer 2: Component Aggregation
```python
strength_sources: list[float] = []
if absorption["detected"]:
    strength_sources.append(absorption["strength"])
if iceberg["detected"]:
    strength_sources.append(iceberg_strength)
if "twap_bot" in signals_active:
    strength_sources.append(twap_strength)

strength = max(strength_sources) if strength_sources else 0.0
```
**Rule**: Takes highest component (pessimistic approach)

#### Layer 3: Confidence Classification
```python
if strength >= 70:
    confidence = "high"
elif strength >= 40:
    confidence = "medium"
else:
    confidence = "low"
```

#### 1.4 Data Sources & Priority Order

**Source 1: Redis Cache (Highest Priority)**
```python
# From compute_tick_rate():
cache_key = f"order_flow:tick_rate:{symbol}:{window_seconds}"
cached = cache.get(cache_key)  # 10-second TTL
```
- Used for tick_rate_per_min calculation
- TTL: `TICK_RATE_CACHE_TTL = 10` seconds
- Avoids repeated DB queries

**Source 2: IntradayTick Database (Primary Data)**
```python
# From _fetch_ticks():
qs: QuerySet = IntradayTick.objects.filter(
    symbol=symbol,
    trade_date=today,
).values("trade_time", "price", "volume", "side")
```
- 5-minute window (300 seconds recent)
- Window sizes:
  - CVD: `window_minutes=5, bucket_seconds=30`
  - Tick rate: `window_seconds=300`
  - Iceberg: `window_seconds=300`

**Source 3: No vnstock Fallback**
- System relies purely on IntradayTick database
- NO fallback to vnstock API
- Empty tick list → returns `signal_type='none', strength=0`

### 1.5 Signal Components Structure

**Complete component breakdown**:

```python
{
    "absorption": {
        "detected": bool,
        "strength": float,                    # 0-100
        "price_locked": bool,                 # price_range_pct < 0.3%
        "price_range_pct": float,             # Percentage price volatility
        "cvd_change": float,                  # Cumulative CVD delta
        "description": str,                   # Human-readable explanation
    },
    "iceberg": {
        "detected": bool,
        "level": float,                       # Average price of repeated orders
        "repeat_count": int,                  # Number of orders at same level
        "value_per_occurrence_avg": float,    # Avg order size
        "confidence": str,                    # low | medium | high (based on repeat_count)
    },
    "tick_rate": {
        "tick_rate_per_min": float,          # Normalized to per-minute rate
        "small_order_count": int,            # Ticks < 50M VND
        "total_count": int,                  # Total ticks in window
        "small_order_ratio": float,          # small_order_count / total_count
        "window_seconds": int,               # Analysis window (300s)
    },
    "size_distribution": {
        "avg_value": float,                  # Mean order value
        "median_value": float,
        "p95_value": float,                  # 95th percentile
        "small_ratio": float,                # Ratio < 50M VND threshold
        "large_ratio": float,                # Ratio >= 5B VND threshold
        "bucket_histogram": {
            "<50m": int,
            "50-200m": int,
            "200-500m": int,
            "500m-2b": int,
            ">2b": int,
        },
        "total_ticks": int,                  # Sample size
    },
}
```

### 1.6 Signal Type Classification Rules

**Signal Activation Conditions**:

| Signal | Condition | Strength Formula |
|--------|-----------|------------------|
| **absorption** | `detected AND price_locked` | `cvd_change_pct / 20 * 100` |
| **iceberg** | `detected AND small_ratio > 0.70` | `repeat_count / 2 * 10` |
| **twap_bot** | `tick_rate > 3×baseline AND small_ratio > 0.60 AND cvd_steady` | `(tick_rate / baseline) * 20` |
| **mixed** | ≥ 2 signals active simultaneously | `max(all_components)` |
| **none** | No conditions met | `0.0` |

**TWAP Bot CVD Steadiness Check**:
```python
cvd_steady = False
if len(cvd_series) >= 3:
    cvd_deltas = [abs(cvd_series[i]["cvd"] - cvd_series[i-1]["cvd"]) for i in range(1, len(cvd_series))]
    if cvd_deltas:
        delta_std = statistics.pstdev(cvd_deltas) if len(cvd_deltas) > 1 else 0.0
        delta_mean = statistics.mean(cvd_deltas) or 1.0
        cvd_steady = (delta_std / delta_mean) < 0.5  # Coefficient of Variation < 50%
```

---

## 2. CURRENT PAGINATION IMPLEMENTATION

### 2.1 API Endpoint Pagination

**File**: [portfolio/views.py](portfolio/views.py#L4023)

**Current Implementation (hardcoded limit)**:
```python
recent_signals = list(
    OrderFlowSignal.objects.filter(symbol=normalized_symbol)
    .order_by('-created_at')
    .values(
        'id', 'symbol', 'signal_type', 'strength', 'confidence', 'tick_rate',
        'small_order_ratio', 'cvd_at_signal', 'price_at_signal', 'created_at'
    )[:8]  # ← HARDCODED LIMIT
)
```

**Response Structure**:
```python
{
    'ok': True,
    'symbol': 'VNM',
    'window': '30m',
    'window_minutes': 30,
    'latest_signal': {...},  # or None
    'signals': [
        {
            'id': int,
            'symbol': str,
            'signal_type': str,
            'strength': float,
            'confidence': str,
            'tick_rate': float,
            'small_order_ratio': float,
            'cvd_at_signal': float,
            'price_at_signal': float,
            'created_at': str,
        },
        # ... up to 8 records
    ],
    'cvd_series': [...],
    'dark_flow': {...},
}
```

### 2.2 Pagination Issues & Limitations

**Issue 1: No Cursor-Based Navigation**
- ❌ No `next_cursor` field
- ❌ No `prev_cursor` field
- ❌ Unable to fetch records beyond the first 8

**Issue 2: No Continuation Metadata**
- ❌ No `has_more` flag
- ❌ No `total_count` indicator
- ❌ No offset/limit parameters in query

**Issue 3: Ordering Assumptions**
- ✅ Ordering: `-created_at` (newest first)
- ✅ Consistent: `OrderFlowSignal.Meta.ordering = ['-created_at']`
- ❌ No secondary sort key (potential consistency issues with same-second timestamps)

**Issue 4: Query Consistency Risk**
```
Time: 10:00:00
Request 1 → Records 1-8 (created_at 10:00:00.0 to 09:59:00.0)
[New record 5a created between requests with same created_at as record 5]
Request 2 → But window is fixed, may include/exclude record 5a inconsistently
```

### 2.3 Known Pagination Edge Cases

**Edge Case 1: Concurrent Record Creation**
- Two signals created in same millisecond
- Secondary sort not defined → unstable ordering

**Edge Case 2: Queryset Evaluates Stale**
- If network slow or DB busy between `.order_by()` and `[:8]` fetch
- Pagination may skip or duplicate records

**Edge Case 3: No Historic Access**
- Frontend cannot access signals beyond most recent 8
- No "load more" functionality

---

## 3. EVENT STRUCTURE & PAYLOADS

### 3.1 OrderFlowSignal Database Model

**File**: [portfolio/models.py](portfolio/models.py#L1548-L1580)

```python
class OrderFlowSignal(models.Model):
    class SignalType(models.TextChoices):
        NONE       = 'none',        'Không có tín hiệu'
        ABSORPTION = 'absorption',  'Hấp thụ (Absorption)'
        ICEBERG    = 'iceberg',     'Lệnh tảng băng (Iceberg)'
        TWAP_BOT   = 'twap_bot',    'TWAP Bot'
        MIXED      = 'mixed',       'Kết hợp nhiều dấu hiệu'

    symbol            = models.CharField(max_length=10, db_index=True)
    signal_type       = models.CharField(max_length=20, choices=SignalType.choices)
    strength          = models.FloatField(default=0)
    confidence        = models.CharField(max_length=10, default='low')
    tick_rate         = models.FloatField(default=0)
    small_order_ratio = models.FloatField(default=0)
    cvd_at_signal     = models.FloatField(default=0)
    price_at_signal   = models.FloatField(default=0)
    window_seconds    = models.PositiveIntegerField(default=300)
    components_json   = models.JSONField(default=dict)  # Full component details
    created_at        = models.DateTimeField(auto_now_add=True, db_index=True)
```

### 3.2 WebSocket Event Payload

**File**: [portfolio/tasks.py](portfolio/tasks.py#L1407-L1424)

**Event ID**: NOT persisted (in-memory only)

**Payload Structure**:
```python
{
    'type': 'dark_flow_alert',
    'data': {
        'event_type': 'dark_flow_alert',
        'contract_version': '1.0',
        'symbol': str,                    # e.g. 'VNM'
        'signal_type': str,               # One of: none, absorption, iceberg, twap_bot, mixed
        'strength': float,                # 0-100
        'confidence': str,                # low, medium, high
        'tick_rate': float,               # Per minute
        'small_order_ratio': float,       # 0-1
        'cvd_at_signal': float,           # CVD value
        'description': str,               # Human-readable (e.g. "Phat hien 7 lenh lap tai 78200 VND")
        'event_id': str,                  # Format: dark_flow:{symbol}:{triggered_at}:{signal_type}
        'ts': str,                        # ISO 8601 timestamp
    },
}
```

### 3.3 Event ID Composition

**Format**: 
```
dark_flow:{symbol}:{triggered_at_iso}:{signal_type}
```

**Components**:
1. **Prefix**: `dark_flow:` (literal)
2. **Symbol**: Uppercase stock code (e.g., `VNM`)
3. **Triggered At**: Full ISO 8601 with microseconds and timezone
4. **Signal Type**: One of `{none, absorption, iceberg, twap_bot, mixed}`

**Example**:
```
dark_flow:VNM:2026-04-10T15:30:45.123456+00:00:iceberg
dark_flow:FPT:2026-04-10T10:15:22.654321+00:00:mixed
```

**Generation Code** (tasks.py:1397):
```python
event_id = f"dark_flow:{sym}:{result.get('triggered_at', timezone.now().isoformat())}:{signal_type}"
```

### 3.4 Severity/Strength Classification Scheme

**Classification Levels**:

| Strength Range | Confidence | Risk Level | Action |
|---|---|---|---|
| 0-19 | low | None | Monitor |
| 20-39 | low | Low | Log to history |
| 40-69 | medium | Medium | Alert user (if subscribed) |
| 70-89 | high | High | WebSocket notify (strength > 50) |
| 90-100 | high | Critical | WebSocket notify + pin to dashboard |

**Determination Logic**:
```python
if strength >= 70:
    confidence = "high"
elif strength >= 40:
    confidence = "medium"
else:
    confidence = "low"
```

**Storage Decision** (tasks.py:1375-1376):
```python
if signal_type != 'none' or strength > 20:
    OrderFlowSignal.objects.create(...)  # Persist to DB
```

**WebSocket Publication Decision** (tasks.py:1383):
```python
if strength > 50:
    # Publish dark_flow_alert event to whale_{symbol} group
    channel_layer.group_send(f'whale_{sym}', {...})
```

### 3.5 Time Normalization Approach

**Timestamp Format**: ISO 8601 with microseconds and timezone

**Generation**: 
```python
"triggered_at": datetime.now(timezone.utc).isoformat()
# Output: '2026-04-10T15:30:45.123456+00:00'
```

**Consistency**: 
- All events use UTC timezone
- Microsecond precision for ordering
- No timezone conversion in pipeline

**Database Storage**:
- `created_at` field uses Django's `auto_now_add=True`
- Operates in DATABASE's configured timezone (typically UTC)
- Indexed with `db_index=True` for fast range queries

---

## 4. TEST COVERAGE ANALYSIS

### 4.1 Test File Location

**File**: [portfolio/tests/test_order_flow.py](portfolio/tests/test_order_flow.py)

**Statistics**: 38/38 tests PASS (as of Sprint 15)

### 4.2 Dark Flow Detection Tests

**Location**: Lines 273-361

```python
class TestDetectDarkFlow(SimpleTestCase):
```

**Tests included**:

1. **test_no_signal_when_no_ticks** (L301-310)
   - Verifies: Empty data → `signal_type='none'`
   - Mocks: `_fetch_ticks()` returns `[]`

2. **test_result_has_required_keys** (L312-321)
   - Verifies: Result contains `signal_type, strength, confidence, components, triggered_at`
   - Checks: Structure integrity

3. **test_twap_bot_detected_when_high_tick_rate_and_small_orders** (L323-345)
   - Verifies: TWAP bot detection logic
   - Setup: 30 small ticks, tick_rate=30/min, small_ratio=1.0
   - Assert: `signal_type in ('twap_bot', 'mixed')`
   - File: L335, condition: `tick_rate > baseline * 3 AND small_ratio > 0.60`

4. **test_confidence_high_when_strength_above_70** (L347-356)
   - Verifies: Confidence classification
   - Edge case: Empty data → strength=0 → confidence='low'

5. **test_components_keys_present** (L358-361)
   - Verifies: All component types present:
     - `absorption, iceberg, tick_rate, size_distribution`

**Additional Tests**:
- `test_iceberg_detected_when_repeat_count_high` (L239-263)
- `test_absorption_detected_when_price_locked_and_cvd_strong` (L190-237)
- Size distribution tests (5 variants)
- CVD series tests (6 variants)
- Tick rate tests (5 variants)

### 4.3 Pagination Tests

**Current Status**: ❌ NO PAGINATION TESTS

**Why**: 
- Pagination not implemented in endpoint
- Hardcoded limit of 8 records
- No cursor/offset mechanism

**Needed** (missing from codebase):
- Test for `next_cursor` presence/absence
- Test for `has_more` flag behavior
- Test for consistency with same-second timestamps
- Test for offset parameter validation

### 4.4 Event Identity Tests

**Location**: Embedded in OrderFlowSignalTask tests (L507-541)

**Test: test_task_stores_signal_when_strength_above_20** (L507-541)
```python
@patch("portfolio.order_flow.detect_dark_flow")
def test_task_stores_signal_when_strength_above_20(self, mock_detect):
    # Setup
    user = get_user_model().objects.create_user(username="of_user", password="Test@123456")
    TrackedSymbol.objects.create(user=user, symbol="VNM")
    mock_detect.return_value = {
        "signal_type": "iceberg",
        "strength": 65.0,
        "confidence": "high",
        "components": {
            "tick_rate": {"tick_rate_per_min": 12.5},
            "size_distribution": {"small_ratio": 0.8},
            "absorption": {"cvd_change": 123456789},
            "iceberg": {"repeat_count": 8, "level": 78200},
        },
        "triggered_at": "2026-04-04T06:00:00+00:00",
    }
    # Execute
    result = detect_and_store_order_flow.run(symbol="VNM")
    # Assert
    self.assertEqual(result["stored"], 1)
    self.assertEqual(OrderFlowSignal.objects.count(), 1)
```

**Missing Event ID Assertions**:
- ❌ Does NOT verify `event_id` field existence
- ❌ Does NOT verify `event_id` persistence in DB
- ❌ Does NOT verify `event_id` uniqueness for same symbol+timestamp

### 4.5 API Endpoint Tests

**Location**: Lines 562-604

**Test: test_order_flow_endpoint_returns_payload** (L562-604)

```python
@patch("portfolio.order_flow.detect_dark_flow")
@patch("portfolio.order_flow.compute_cvd_series")
def test_order_flow_endpoint_returns_payload(self, mock_cvd, mock_detect):
    # Verifies endpoint returns 200 with required fields
    response = self.client.get("/api/stock-management/stocks/FPT/order-flow/")
    self.assertEqual(response.status_code, 200)
    self.assertTrue(response.data["ok"])
    self.assertEqual(response.data["symbol"], "FPT")
    self.assertEqual(response.data["latest_signal"]["signal_type"], "iceberg")
    self.assertEqual(len(response.data["cvd_series"]), 1)
```

**Coverage**:
- ✅ Endpoint returns 200
- ✅ Response contains required keys
- ✅ Signal data correctly populated
- ❌ Does NOT test pagination limits
- ❌ Does NOT test `has_more` or cursor fields

### 4.6 Reference Test File Paths

| Test Class | Line Range | Purpose |
|---|---|---|
| TestDetectDarkFlow | 273-361 | Dark flow detection logic |
| TestComputeCVDSeriesDB | 363-411 | CVD series calculation |
| TestComputeTickRateDB | 413-461 | Tick rate caching |
| TestOrderFlowSignalTask | 507-541 | Database persistence |
| TestOrderFlowApi | 562-604 | REST API endpoint |

---

## 5. DATA FLOW ARCHITECTURE

### 5.1 End-to-End Event Flow

```
┌─────────────────────┐
│  IntradayTick DB    │
│  (raw tick data)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│  _fetch_ticks()                 │
│  (5-minute window query)         │
└──────────┬──────────────────────┘
           │
           ├─────────────────────────────┐
           │                             │
           ▼                             ▼
   ┌─────────────────┐        ┌──────────────────┐
   │ compute_cvd_    │        │ compute_tick_    │
   │ series()        │        │ rate() [Redis    │
   │                 │        │  cache 10s TTL]  │
   └────────┬────────┘        └────────┬─────────┘
            │                          │
            ├──────────────────────────┤
            │                          │
            ▼                          ▼
     ┌──────────────────────────────────────┐
     │  detect_dark_flow(symbol)             │
     │  ├─ detect_absorption()               │
     │  ├─ detect_iceberg_clustering()       │
     │  └─ Signal aggregation & strength     │
     └────────┬─────────────────────────────┘
              │
              ▼
    Result: {
      signal_type: str,
      strength: float,
      confidence: str,
      components: {...},
      triggered_at: str,  ← ISO timestamp
    }
              │
    ┌─────────┴──────────────┐
    │                        │
    ▼                        ▼
 IF strength > 20    IF strength > 50
    │
    ▼
┌─────────────────────────────────┐
│  OrderFlowSignal.create()        │  ← DB storage
│  (async safe, no event_id saved) │
└─────────────────────────────────┘
    │
    ├─ event_id generated (in memory)
    │  Format: dark_flow:{sym}:{triggered_at}:{type}
    │
    ▼
┌──────────────────────────────────────┐
│  WebSocket Push (to whale_{symbol})  │
│  ├─ payload['event_id'] = event_id   │
│  └─ type='dark_flow_alert'           │
└───────────────────┬──────────────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │  RealtimeConsumer      │
         │  .dark_flow_alert()    │
         │  → send_json()         │
         └────────────────────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │  Frontend (React)      │
         │  useRealtimeFeed       │
         │  darkFlowAlerts stream │
         └────────────────────────┘
```

### 5.2 Celery Task Scheduling

**File**: [portfolio/tasks.py](portfolio/tasks.py#L1330)

**Task**: `detect_and_store_order_flow`
- **Schedule**: Every 30 seconds (Celery Beat)
- **Symbols**: Up to 30 (TrackedSymbol + WatchlistItem)
- **Cooldown**: 300s per symbol (ORDER_FLOW_COOLDOWN_SECONDS)
- **Persistence Threshold**: `strength > 20`
- **Alert Threshold**: `strength > 50`

**Pseudocode**:
```python
for sym in collected_symbols[:30]:
    if cache.get(f'order_flow_lock:{sym}'):
        continue  # Cooldown active
    
    result = detect_dark_flow(sym)
    
    if result['strength'] > 20 or result['signal_type'] != 'none':
        OrderFlowSignal.create(...)
        cache.set(f'order_flow_lock:{sym}', True, 300)  # 5min cooldown
    
    if result['strength'] > 50:
        channel_layer.group_send(f'whale_{sym}', {
            'type': 'dark_flow_alert',
            'data': {..., 'event_id': event_id, ...}
        })
```

---

## 6. CRITICAL ISSUES & RECOMMENDATIONS

### Issue #1: Event ID Not Persisted

**Severity**: 🔴 **HIGH**

**Problem**:
- Event IDs generated in memory at WebSocket publish time
- Not stored in `OrderFlowSignal` model
- Impossible to deduplicate events
- Browser refresh causes duplicate alert subscriptions

**Root Cause**:
```python
# tasks.py:1397 — Event ID created but not linked to OrderFlowSignal
event_id = f"dark_flow:{sym}:{result.get('triggered_at', ...)}:{signal_type}"

# tasks.py:1375-1379 — OrderFlowSignal created WITHOUT event_id field
OrderFlowSignal.objects.create(
    symbol=sym,
    signal_type=signal_type,
    strength=strength,
    # ... no event_id field!
    components_json=comps,
)
```

**Recommendation**:
1. Add `event_id` field to `OrderFlowSignal` model:
   ```python
   class OrderFlowSignal(models.Model):
       event_id = models.CharField(max_length=150, unique=True, db_index=True)
       # ...
   ```

2. Generate and persist event_id:
   ```python
   event_id = f"dark_flow:{sym}:{result.get('triggered_at')}:{signal_type}"
   OrderFlowSignal.objects.create(event_id=event_id, ...)
   ```

### Issue #2: No Pagination Mechanism

**Severity**: 🟡 **MEDIUM**

**Problem**:
- Only 8 most recent signals returned
- No way to browse older signals
- No continuation tokens or cursors
- Desktop UI dead-end past top 8 records

**Root Cause**:
```python
# views.py:4023 — Hardcoded limit
recent_signals = [...].values(...)[:8]
```

**Recommendation**:
1. Add `limit` and `offset` query parameters:
   ```python
   limit = int(request.query_params.get('limit', 20))
   offset = int(request.query_params.get('offset', 0))
   recent_signals = [...][offset:offset+limit]
   ```

2. Add continuation metadata:
   ```python
   total_count = OrderFlowSignal.objects.filter(symbol=symbol).count()
   has_more = (offset + limit) < total_count
   return Response({
       'signals': recent_signals,
       'has_more': has_more,
       'offset': offset,
       'limit': limit,
       'total_count': total_count,
   })
   ```

### Issue #3: No Event Deduplication

**Severity**: 🟡 **MEDIUM**

**Problem**:
- Same event can be published multiple times
- No idempotency check
- Network retry → duplicate alerts to frontend

**Recommendation**:
- Leverage `event_id` uniqueness constraint
- Check before publishing: `if OrderFlowSignal.objects.filter(event_id=event_id).exists()`

### Issue #4: Missing Secondary Sort Key

**Severity**: 🟡 **MEDIUM**

**Problem**:
- Events created in same millisecond have undefined order
- Pagination may skip/duplicate records
- Inconsistent across requests

**Recommendation**:
```python
# Change ordering by ID as tiebreaker
OrderFlowSignal.objects.filter(symbol=symbol).order_by('-created_at', '-id')
```

### Issue #5: No Test Coverage for Pagination

**Severity**: 🟢 **LOW** (because pagination not implemented)

**Missing Tests**:
- Offset validation
- Limit boundary conditions
- `has_more` flag accuracy
- Record stability across requests

---

## 7. APPENDIX: CODE REFERENCES

### A. Function Locations

| Function | File | Lines | Purpose |
|---|---|---|---|
| `detect_dark_flow()` | order_flow.py | 427-521 | Main detection aggregator |
| `compute_cvd_series()` | order_flow.py | 95-147 | CVD calculation |
| `compute_tick_rate()` | order_flow.py | 153-199 | Tick frequency + caching |
| `detect_absorption()` | order_flow.py | 220-276 | Price-locked absorption |
| `detect_iceberg_clustering()` | order_flow.py | 282-340 | Repeated orders at same level |
| `detect_and_store_order_flow()` | tasks.py | 1330-1450 | Celery task orchestrator |
| `stock_order_flow_api()` | views.py | 3993-4040 | REST API endpoint |
| `dark_flow_alert()` | consumers.py | 86-90 | WebSocket handler |

### B. Model Indexes

```python
class OrderFlowSignal(models.Model):
    # ...
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['symbol', 'created_at']),  # Primary lookup
        ]
```

**Query Performance**: 
- Symbol + created_at indexed → Fast "get recent signals for symbol"
- No composite index on (symbol, -created_at, -id)

### C. Constants & Configuration

```python
# order_flow.py
SMALL_ORDER_THRESHOLD = 50_000_000  # 50M VND
LARGE_ORDER_THRESHOLD = 5_000_000_000  # 5B VND
PRICE_LOCK_THRESHOLD_PCT = 0.003  # 0.3%
TICK_RATE_CACHE_TTL = 10  # seconds

# tasks.py
ORDER_FLOW_COOLDOWN_SECONDS = 300  # 5 minutes per symbol
ORDER_FLOW_MAX_SYMBOLS = 30  # Max symbols per task run
```

---

## 8. SUMMARY TABLE

| Aspect | Status | Details |
|---|---|---|
| **Detection Algorithms** | ✅ Complete | 4 algorithms (CVD, Tick, Absorption, Iceberg) |
| **Event ID Generation** | ✅ Complete | Format: `dark_flow:{sym}:{ts}:{type}` |
| **Event ID Persistence** | ❌ Missing | Not stored in DB, only in WS payload |
| **Pagination Cursors** | ❌ Missing | No cursor/offset implementation |
| **Pagination Metadata** | ❌ Missing | No `has_more`, `total_count` fields |
| **Database Indexing** | ✅ Partial | Symbol + created_at indexed |
| **WebSocket Integration** | ✅ Complete | dark_flow_alert event type defined |
| **Strength Calculation** | ✅ Complete | 3-layer formula with confidence mapping |
| **Data Source Fallback** | ❌ None | DB-only, no vnstock fallback |
| **Test Coverage** | ✅ Good | 38/38 tests PASS (no pagination tests) |
| **Time Normalization** | ✅ Complete | UTC ISO 8601 with microseconds |

---

*Analysis Date: 2026-04-10*  
*Project: VNInvest Stock Advisory Platform*  
*Sprint: 15 (Order Flow Detection)*
