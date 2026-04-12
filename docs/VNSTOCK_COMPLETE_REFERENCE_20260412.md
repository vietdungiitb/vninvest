# 📑 VNStock Files & Parameters - Complete Reference Table

---

## 1. FILES USING VNSTOCK (Inventory)

| File | Lines | Purpose | Vnstock Call | Fallback |
|------|-------|---------|--------------|----------|
| **vnstock_adapter.py** | 1-300 | Central adapter with timeout/retry/rate-limit wrapper | All calls go through `_run_with_timeout()` | ✅ Multi-source |
| **cache_adapter.py** | 1-50 | Rate limit detection + cooldown cache | `get_cache()`, `set_cache()`, `is_rate_limited_error()` | N/A |
| **vnstock_compat.py** | 1-100 | Runtime patches (Finance init, upgrade notice) | Patches `vnstock.common.data.Finance.__init__` | ✅ Has try/except |
| **apps.py** | 1-20 | Call patches at startup | `patch_vnstock_finance_init()`, `disable_vnstock_upgrade_notice()` | N/A |
| **realtime/collector.py** | 1-65 | Intraday ticks collection | `Vnstock().stock(symbol, 'VCI').quote.intraday()` | ✅ DB synthetic |
| **services.py:1457** | 1457-1480 | Daily price sync (OHLC) | `Vnstock().stock(symbol, 'KBS').quote.history()` | ✅ Log error, skip |
| **services.py:1722** | 1722-1750 | Sync stock profiles | `Vnstock().stock().listing.symbols_by_exchange()` | ✅ Manual fallback |
| **services.py:2016** | 2016-2050 | Exchange lookup | `Vnstock().stock('ACB', 'VCI').listing.symbols_by_exchange()` | ✅ Return empty |
| **admin.py:361** | 361-390 | Live ticker in workspace | `Vnstock().stock(symbol, 'VCI').trading.price_board()` | ✅ Last cached |
| **sync_stockprofile.py** | 1-100 | Sync all stocks + sectors (management cmd) | Calls `sync_stock_profiles()` in services.py | ✅ Manual mode |
| **seed_watchlist.py** | 1-80 | Seed watchlist from ICB sectors (management cmd) | Fallback when vnstock fails | ✅ Hardcoded list |

---

## 2. CONFIGURATION PARAMETERS (By Category)

### 🔧 CONCURRENCY & THROUGHPUT

| Parameter | Type | Default | Min | Max | Env Key | File | Impact | Notes |
|-----------|------|---------|-----|-----|---------|------|--------|-------|
| max_concurrency | int | 12 | 1 | 100 | `VNSTOCK_MAX_CONCURRENCY` | vnstock_adapter.py:74 | 🔴 High | Benchmark: 8-16 for prod |
| retry_attempts | int | 1 | 0 | 10 | `VNSTOCK_RETRY_ATTEMPTS` | vnstock_adapter.py:75 | 🟡 Medium | Retry on 5xx/timeout |
| retry_backoff_seconds | float | 0.35 | 0.0 | 10.0 | `VNSTOCK_RETRY_BACKOFF_SECONDS` | vnstock_adapter.py:76 | 🟡 Medium | Exponential: 0.35s, 0.7s, 1.05s... |

### ⏱ TIMEOUT BY CHANNEL (SECONDS)

| Parameter | Default | Env Key | File | When Used | Notes |
|-----------|---------|---------|------|-----------|-------|
| general_timeout | 8 | `VNSTOCK_GENERAL_TIMEOUT_SECONDS` | adapter:43 | Fallback for all channels | Override in specific channel |
| intraday_timeout | 8 | `VNSTOCK_INTRADAY_TIMEOUT_SECONDS` | adapter:164 | `fetch_intraday_dataframe()` | Ticks data (100 page size) |
| price_board_timeout | 8 | `VNSTOCK_PRICE_BOARD_TIMEOUT_SECONDS` | adapter:174 | `fetch_price_board_dataframe()` | Live quotes + bid-ask |
| financial_ratio_timeout | 10 | `VNSTOCK_FINANCIAL_RATIO_TIMEOUT_SECONDS` | adapter:214 | `fetch_financial_ratio_dataframe()` | Slower endpoint |
| history_timeout | 12 | `VNSTOCK_HISTORY_TIMEOUT_SECONDS` | adapter:233 | `fetch_history_dataframe()` | Daily OHLC history (slower) |
| listing_timeout | 12 | `VNSTOCK_LISTING_TIMEOUT_SECONDS` | adapter:252 | `fetch_listing_symbols_dataframe()` | All symbols (large dataset) |

### 🚨 RATE LIMIT & FALLBACK

| Parameter | Type | Default | Env Key | File | Impact | Strategy |
|-----------|------|---------|---------|------|--------|----------|
| rate_limit_cooldown_seconds | int | 20 | `VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS` | cache_adapter.py:47 | 🔴 High | When 429 detected, wait N seconds before retry |
| price_board_source | string | `VCI` | `VNSTOCK_PRICE_BOARD_SOURCE` | adapter:106 | 🟡 Medium | Primary source for price board |
| price_board_fallback_sources | string | `KBS,VCI` | `VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES` | adapter:107 | 🟡 Medium | Tried in order if rate limit on primary |
| enable_multi_source_fallback | bool | True | N/A | (future) | 🟢 Low | Feature flag for fallback enabled |
| enable_rate_limit_cache | bool | True | N/A | (future) | 🟢 Low | Feature flag for rate limit cooldown |

### 🐋 BUSINESS CONSTRAINTS

| Parameter | Type | Default | Env Key | File | Usage |
|-----------|------|---------|---------|------|-------|
| WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS | int | 6 | In .env:59 | whale_feed_helpers.py | Max symbols to fetch from vnstock in aggregate query |
| TICKER_PREFETCH_SYMBOL_LIMIT | int | 240 | In .env:56 | market_data_service.py | Max symbols in prefetch batch |
| TICKER_PREFETCH_BATCH_SIZE | int | 60 | In .env:55 | market_data_service.py | Batch size for prefetch |
| TICKER_PREFETCH_MAX_RETRIES | int | 6 | In .env:55 | market_data_service.py | Max retries for prefetch |
| TICKER_PREFETCH_RETRY_BASE_SECONDS | int | 8 | In .env:56 | market_data_service.py | Base delay for prefetch retry |
| TICKER_PREFETCH_RETRY_MAX_SECONDS | int | 120 | In .env:57 | market_data_service.py | Max delay for prefetch retry |

---

## 3. CURRENT CONFIGURATION SOURCES (Priority Order)

### Environment Variable Precedence

```
Priority 1 (Override Everything):
  os.getenv('VNSTOCK_MAX_CONCURRENCY') = 20
  ✅ Immediate (no restart in future impl)

Priority 2 (Runtime Config DB):
  RuntimeVnstockConfig.get_current().max_concurrency = 15
  ✅ Hot reload with 5 min cache (future)

Priority 3 (Hardcoded Default):
  _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12)
  ✅ Fallback
```

### Current Resolution Functions (vnstock_adapter.py)

```python
Line 58-61:   _resolve_int_env(name, default, min_value)
              → Reads: os.getenv(name) or default

Line 64-67:   _resolve_float_env(name, default, min_value)
              → Reads: os.getenv(name) or default

Line 33-44:   _resolve_timeout(channel, default_timeout)
              → Reads: os.getenv(f'VNSTOCK_{channel}_TIMEOUT_SECONDS') 
                       or os.getenv('VNSTOCK_GENERAL_TIMEOUT_SECONDS')
                       or default
```

---

## 4. INITIALIZATION FLOW

### Django Startup Sequence

```
1. settings.py loaded
   └─ .env parsed (python-dotenv)

2. vnstock_adapter.py imported
   └─ _VNSTOCK_MAX_CONCURRENCY = _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12)
   └─ _VNSTOCK_RETRY_ATTEMPTS = _resolve_int_env('VNSTOCK_RETRY_ATTEMPTS', 1)
   └─ _VNSTOCK_GATE = threading.BoundedSemaphore(value=12)

3. portfolio app ready()
   └─ portfolio/apps.py::PortfolioConfig.ready()
      ├─ patch_vnstock_finance_init()
      │  └─ Fix: vnstock.common.data.Finance.__init__ period bug
      └─ disable_vnstock_upgrade_notice()
         └─ Patch: vnstock.core.utils.upgrade.update_notice = noop

4. First request
   └─ View calls vnstock_adapter._run_with_timeout()
      ├─ Acquire BoundedSemaphore (concurrency control)
      ├─ ThreadPoolExecutor.submit(fn).result(timeout=8)
      ├─ Handle error (timeout/rate-limit/generic)
      ├─ Retry with exponential backoff (if enabled)
      └─ Release semaphore
```

---

## 5. ERROR CODES & HANDLING

### Generated Error Codes (vnstock_adapter.py:125-145)

| Code | Trigger | When | Retry? | Cache? |
|------|---------|------|--------|--------|
| `vnstock_timeout` | `cf.TimeoutError` | After timeout_seconds | ✅ If 5xx-like | N/A |
| `vnstock_rate_limited` | `is_rate_limited_error()` | HTTP 429 | ❌ No | ✅ Mark cooldown |
| `vnstock_busy` | Semaphore acquire timeout | Queue saturated | ❌ No | N/A |
| `vnstock_error` | Generic Exception/SystemExit | Any other error | ✅ If 5xx | N/A |
| `vnstock_missing` | ImportError | vnstock not installed | ❌ No | N/A |

### Rate Limit Detection (cache_adapter.py:27)

```python
def is_rate_limited_error(exc_or_message) -> bool:
    message = str(exc_or_message or '').lower()
    return (
        '429' in message
        or 'too many requests' in message
        or 'rate limit' in message
        or 'giới hạn api' in message  # Vietnamese
    )
```

### Cooldown Cache (cache_adapter.py:44-49)

```python
def mark_vnstock_rate_limited(channel='intraday', exc=None):
    cooldown_seconds = int(os.getenv('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', '20'))
    
    cache.set(
        f'vnstock:rate-limit:{channel}',  # Key
        {'triggered_at': now, 'reason': str(exc)[:200]},
        timeout=cooldown_seconds  # Expires after N seconds
    )
```

---

## 6. DATA SOURCES & FALLBACK STRATEGY

### Per-Endpoint Source Configuration

| Endpoint | Primary | Fallback Chain | Code Location |
|----------|---------|------------------|---------------|
| **price_board** | VCI (env: `VNSTOCK_PRICE_BOARD_SOURCE`) | KBS,VCI (env: `VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES`) | adapter:174-194 |
| **intraday** | VCI (hardcoded) | None (fallback to DB synthetic) | adapter:164, collector:23 |
| **history** | KBS (parameterized in services.py) | None (log error) | services:1457 |
| **finance.ratio** | VCI (parameterized) | None (log error) | adapter:214 |
| **listing** | VCI (parameterized) | None (log error) | adapter:252 |

### Fallback Logic (vnstock_adapter.py:174-194)

```python
def fetch_price_board_dataframe(symbols_list, anchor_symbol, source=None):
    timeout_seconds = _resolve_timeout('price_board', 8)
    sources = _resolve_price_board_sources(explicit_source=source)  # [VCI, KBS, ...]
    
    for candidate_source in sources:
        try:
            result = _run_with_timeout(
                lambda: stock_client.trading.price_board(symbols_list),
                timeout=timeout_seconds
            )
            return result
        except ExternalSystemException as exc:
            if exc.code == 'vnstock_rate_limited':
                logger.warning(f'Rate limited on {candidate_source}, trying next...')
                continue  # ← Try next source
            raise  # ← Other errors fail fast
    
    raise last_error
```

---

## 7. MONITORING & OBSERVABILITY

### Current (None - Blind Spot)

❌ No metrics on:
- Concurrency saturation
- Timeout frequency
- Error code distribution
- Rate limit trigger count
- Fallback usage rate

### Suggested Metrics to Add

| Metric | Calculation | Where to Track | Dashboard |
|--------|-------------|-----------------|-----------|
| Concurrency Utilization % | active_requests / max_concurrency | Pre/post `_run_with_timeout()` | Real-time |
| Timeout Rate | count('vnstock_timeout') / total_calls | In error handler | Per 5 min |
| Rate Limit Frequency | count('vnstock_rate_limited') / day | In `mark_vnstock_rate_limited()` | Hourly |
| Latency Percentiles | p50/p95/p99 of duration | Around `_run_with_timeout()` | Historical |
| Fallback Usage % | fallback_attempts / price_board_calls | In fallback loop | Per minute |
| Retry Effectiveness | successful_retries / retry_attempts | In backoff loop | Historical |

---

## 8. CURRENT LIMITATIONS & GAPS

| Gap | Current | Future (RuntimeVnstockConfig) |
|----|---------|-------------------------------|
| Config Reload | ❌ Requires restart | ✅ Hot reload (5 min cache) |
| Admin UI | ❌ None | ✅ Django admin inline |
| Audit Trail | ❌ No log | ✅ DB foreign key to User |
| Observability | ❌ None | ✅ Cache metrics |
| Patch Toggle | ❌ Hardcoded | ✅ Future feature flag |
| Per-User Config | ❌ No | ✅ Can extend model |
| Gradual Rollout | ❌ No | ✅ Feature flag per tenant |

---

## 9. DEPLOYMENT COMMANDS

### Current Setup

```bash
# View current config
grep VNSTOCK_ backend/.env

# Inspect runtime state (Django shell)
python manage.py shell
>>> from portfolio.adapters.vnstock_adapter import _VNSTOCK_MAX_CONCURRENCY
>>> print(_VNSTOCK_MAX_CONCURRENCY)
12

# Change config (REQUIRES RESTART)
# 1. Edit backend/.env
#    VNSTOCK_MAX_CONCURRENCY=20
# 2. Restart Django
systemctl restart vnin_vest_django
```

### Future Setup (After RuntimeVnstockConfig)

```bash
# Initialize config from env vars
python manage.py init_vnstock_runtime_config

# Change config (NO RESTART)
# 1. Django Admin → VNStock Runtime Configuration
# 2. Edit field
# 3. Click Save
# 4. Cache invalidates, takes effect within 5 minutes

# View audit history
RuntimeVnstockConfig.objects.filter(pk=1).values(
    'updated_at', 'updated_by__username', 'notes'
)
```

---

## 10. QUICK REFERENCE: ENV VARS

### Copy-Paste Template for .env

```bash
# === VNSTOCK CONCURRENCY & RETRY ===
VNSTOCK_MAX_CONCURRENCY=12
VNSTOCK_RETRY_ATTEMPTS=1
VNSTOCK_RETRY_BACKOFF_SECONDS=0.35

# === VNSTOCK TIMEOUTS (seconds) ===
VNSTOCK_GENERAL_TIMEOUT_SECONDS=8
VNSTOCK_INTRADAY_TIMEOUT_SECONDS=8
VNSTOCK_PRICE_BOARD_TIMEOUT_SECONDS=8
VNSTOCK_FINANCIAL_RATIO_TIMEOUT_SECONDS=10
VNSTOCK_HISTORY_TIMEOUT_SECONDS=12
VNSTOCK_LISTING_TIMEOUT_SECONDS=12

# === VNSTOCK RATE LIMIT & SOURCES ===
VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS=20
VNSTOCK_PRICE_BOARD_SOURCE=VCI
VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES=KBS,VCI

# === BUSINESS CONSTRAINTS ===
WHALE_AGGREGATE_VNSTOCK_MAX_SYMBOLS=6
TICKER_PREFETCH_SYMBOL_LIMIT=240
TICKER_PREFETCH_BATCH_SIZE=60
TICKER_PREFETCH_MAX_RETRIES=6
TICKER_PREFETCH_RETRY_BASE_SECONDS=8
TICKER_PREFETCH_RETRY_MAX_SECONDS=120
```

### Production Tuning Suggestions

```bash
# Higher concurrency for throughput
VNSTOCK_MAX_CONCURRENCY=16

# Longer timeouts for network latency
VNSTOCK_GENERAL_TIMEOUT_SECONDS=12
VNSTOCK_INTRADAY_TIMEOUT_SECONDS=10
VNSTOCK_PRICE_BOARD_TIMEOUT_SECONDS=10
VNSTOCK_HISTORY_TIMEOUT_SECONDS=15

# Aggressive rate limit cooldown
VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS=30

# More retries (if provider unstable)
VNSTOCK_RETRY_ATTEMPTS=2
VNSTOCK_RETRY_BACKOFF_SECONDS=0.5
```

---

## 11. DEPENDENCY VERSIONS

| Package | Version | From | Usage |
|---------|---------|------|-------|
| vnstock | internal/core-1.0.0 | git+https://github.com/vietdungiitb/vnstock.git | Core data provider |
| asyncio-throttle | >=1.0.2 | PyPI | Rate limiting (new in fork) |
| Django | 4.2.13 | PyPI | Web framework |
| Redis | 5.0.7 | PyPI | Cache + Celery broker |
| Pandas | >=2.2.0 | PyPI | Data manipulation |

---

## 12. TESTING CHECKLIST

| Test | Command | Expected |
|------|---------|----------|
| Import vnstock | `from vnstock import Vnstock` | ✅ No error |
| Patch applied | `from vnstock.common.data import Finance; hasattr(Finance, '_vninvest_period_patch')` | ✅ True |
| Concurrency gate ok | `_VNSTOCK_GATE._value == 12` | ✅ True |
| Intraday call works | `stock.quote.intraday(symbol='VNM', page_size=100)` | ✅ DataFrame with ticks |
| Timeout works | Set `VNSTOCK_INTRADAY_TIMEOUT_SECONDS=0.001` | ✅ ExternalSystemException('vnstock_timeout') |
| Rate limit detected | Mock 429 response | ✅ Code → 'vnstock_rate_limited' |
| Cooldown cache set | Check Redis: `redis-cli get "vnstock:rate-limit:intraday"` | ✅ JSON dict with 'triggered_at' |
| Fallback source | Mock VCI 429 → KBS | ✅ Falls back to KBS |

---

**Document Version:** 2.0 (Complete Reference)  
**Updated:** 2026-04-12  
**Status:** 📋 Comprehensive inventory complete
