# VNBroker Configuration Analysis - VNInvest
**Date:** April 12, 2026  
**Project:** VNInvest (React + Django + Celery + vnbroker)  
**Scope:** Complete vnbroker integration audit + runtime config recommendations

---

## I. VNBROKER USAGE ACROSS CODEBASE

### 1.1 Files Using VNBroker (Direct Import)

#### A. Core Data Adapters
| File | Purpose | Vnbroker Methods Used |
|------|---------|---------------------|
| [backend/portfolio/adapters/vnbroker_adapter.py](backend/portfolio/adapters/vnbroker_adapter.py) | **Central adapter** for all vnbroker calls with timeout/retry/rate-limit handling | `Vnbroker().stock().quote.intraday()`, `.trading.price_board()`, `.finance.ratio()`, `.quote.history()`, `.listing.all_symbols()` |
| [backend/portfolio/adapters/cache_adapter.py](backend/portfolio/adapters/cache_adapter.py) | Rate limit detection + cooldown cache | `get_cache()`, `set_cache()` (Redis) |

#### B. Business Logic (Direct Import with Fallback)
| File | Line | Purpose | Vnbroker Call |
|------|------|---------|--------------|
| [backend/portfolio/realtime/collector.py](backend/portfolio/realtime/collector.py) | 23 | Real intraday ticks collection | `Vnbroker().stock(symbol, source='VCI').quote.intraday(symbol, page_size=100)` |
| [backend/portfolio/services.py](backend/portfolio/services.py) | 1457 | Daily price sync (OHLC) | `Vnbroker().stock(symbol, source='KBS').quote.history(start, end, interval='1D')` |
| [backend/portfolio/services.py](backend/portfolio/services.py) | 1722 | Sync stock profiles (metadata) | `Vnbroker().stock().listing.symbols_by_exchange()` |
| [backend/portfolio/services.py](backend/portfolio/services.py) | 2016 | Exchange lookup for symbols | `Vnbroker().stock(symbol='ACB', source='VCI').listing.symbols_by_exchange()` |
| [backend/portfolio/admin.py](backend/portfolio/admin.py) | 361 | Live workspace ticker display | `Vnbroker().stock(symbol, source='VCI').trading.price_board()` |

#### C. Management Commands
| File | Purpose | Trigger |
|------|---------|---------|
| [backend/portfolio/management/commands/sync_stockprofile.py](backend/portfolio/management/commands/sync_stockprofile.py) | Sync all Vietnamese stocks + sectors from vnbroker → StockProfile DB | `python manage.py sync_stockprofile --mode all` |
| [backend/portfolio/management/commands/seed_watchlist.py](backend/portfolio/management/commands/seed_watchlist.py) | Seed watchlist groups from ICB sectors (vnbroker fallback) | Manual seed (fallback when vnbroker fails) |

#### D. Setup & Compatibility
| File | Purpose | Called When |
|------|---------|------------|
| [backend/portfolio/apps.py](backend/portfolio/apps.py) | Apply runtime patches | Django app `ready()` event |
| [backend/portfolio/vnbroker_compat.py](backend/portfolio/vnbroker_compat.py) | Fix upstream regressions | App startup |

---

### 1.2 Vnbroker API Usage Pattern

```python
from vnbroker import Vnbroker

# Pattern used throughout codebase:
stock = Vnbroker().stock(symbol='VNM', source='VCI')  # source: 'VCI', 'KBS', etc.

# Quote data:
df = stock.quote.intraday(symbol='VNM', page_size=100)       # Intraday ticks
df = stock.quote.history(start='2024-01-01', end='2024-12-31', interval='1D')  # Daily OHLC

# Trading data:
df = stock.trading.price_board(symbols_list=['VNM', 'VCB'])  # Live tier-1/bid-ask

# Financial data:
df = stock.finance.ratio(period='year', lang='vi')           # Ratios

# Listing data:
df = stock.listing.all_symbols()                             # All symbols
df = stock.listing.symbols_by_exchange()                     # Symbols by exchange + metadata
```

---

## II. CURRENT RUNTIME CONFIGURATION PARAMETERS

### 2.1 Environment Variables (via `.env`)

#### Concurrency Control
```bash
# Default: 12 (based on benchmarking in code comments)
# Min: 1, Recommended: 8-16 for production
VNBROKER_MAX_CONCURRENCY=12

# Number of retries before fail (applies to 5xx/timeout)
VNBROKER_RETRY_ATTEMPTS=1

# Backoff multiplier for exponential retry delay (seconds)
VNBROKER_RETRY_BACKOFF_SECONDS=0.35
```

#### Timeout Configuration (Seconds)
```bash
# Generic timeout - fallback if channel-specific not set
VNBROKER_GENERAL_TIMEOUT_SECONDS=8

# Channel-specific (override general timeout):
VNBROKER_INTRADAY_TIMEOUT_SECONDS=8
VNBROKER_PRICE_BOARD_TIMEOUT_SECONDS=8
VNBROKER_FINANCIAL_RATIO_TIMEOUT_SECONDS=10
VNBROKER_HISTORY_TIMEOUT_SECONDS=12
VNBROKER_LISTING_TIMEOUT_SECONDS=12
```

#### Rate Limit & Fallback
```bash
# Cooldown duration when 429 (rate limit) detected
VNBROKER_RATE_LIMIT_COOLDOWN_SECONDS=20

# Primary source for price board queries
VNBROKER_PRICE_BOARD_SOURCE=VCI

# Fallback sources (comma-separated) when rate limit on primary
VNBROKER_PRICE_BOARD_FALLBACK_SOURCES=KBS,VCI
```

#### Higher-Level Business Parameters
```bash
# Max symbols to fetch from vnbroker in whale aggregate queries
WHALE_AGGREGATE_VNBROKER_MAX_SYMBOLS=6

# Ticker prefetch batch optimization
TICKER_PREFETCH_SYMBOL_LIMIT=240
TICKER_PREFETCH_BATCH_SIZE=60
TICKER_PREFETCH_MAX_RETRIES=6
TICKER_PREFETCH_RETRY_BASE_SECONDS=8
TICKER_PREFETCH_RETRY_MAX_SECONDS=120
```

---

### 2.2 Where Config Is Resolved

#### **File: `backend/portfolio/adapters/vnbroker_adapter.py`**

| Line | Code | Behavior |
|------|------|----------|
| 17-76 | `_resolve_int_env()`, `_resolve_float_env()` | Parse env var with validation + min threshold |
| 74-76 | `_VNBROKER_MAX_CONCURRENCY`, `_VNBROKER_RETRY_ATTEMPTS`, `_VNBROKER_RETRY_BACKOFF_SECONDS` | Load at module import time (immutable per process) |
| 35 | `_VNBROKER_GATE = threading.BoundedSemaphore(value=...)` | Concurrency gatekeeper |
| 33-44 | `_resolve_timeout(channel)` | Per-channel timeout lookup: `VNBROKER_{CHANNEL}_TIMEOUT_SECONDS` |
| 105-111 | `_resolve_price_board_sources()` | Multi-source fallback logic |

#### **File: `backend/portfolio/adapters/cache_adapter.py`**

| Line | Code | Behavior |
|------|------|----------|
| 26-29 | `vnbroker_rate_limit_cache_key()` | Cache key: `vnbroker:rate-limit:{channel}` |
| 44-49 | `mark_vnbroker_rate_limited()` | Sets cooldown using `VNBROKER_RATE_LIMIT_COOLDOWN_SECONDS` |

---

## III. INITIALIZATION & PATCHING FLOW

### 3.1 Django Startup Sequence

```
1. Django loads settings.py
   ↓
2. module imports → vnbroker_adapter.py loads env vars
   (_VNBROKER_MAX_CONCURRENCY, _VNBROKER_RETRY_ATTEMPTS, etc. set once)
   ↓
3. Apps ready event triggers:
   - portfolio/apps.py::PortfolioConfig.ready()
     ├─ patch_vnbroker_finance_init()      ← Fix period parameter bug
     ├─ disable_vnbroker_upgrade_notice()  ← Remove version upgrade warnings
     └─ register signals
   ↓
4. Views/Services available for requests
   ├─ Lazy import: from vnbroker import Vnbroker (per request)
   └─ Adapter wraps with timeout/retry/rate-limit
```

### 3.2 Runtime Patches Applied

#### Patch 1: Finance.__init__ Compatibility
**File:** `backend/portfolio/vnbroker_compat.py`

```python
def patch_vnbroker_finance_init() -> bool:
    """
    Problem: vnbroker upstream sets period/get_all AFTER BaseComponent.__init__,
    causing AttributeError when data source loads.
    
    Fix: Set parameters BEFORE super().__init__()
    
    Idempotent: Check _vninvest_period_patch flag to avoid double-patch
    """
```

**Impact:** Allows `Vnbroker().stock(...).finance.ratio()` to work without crashes

#### Patch 2: Disable Upgrade Notice
**File:** `backend/portfolio/vnbroker_compat.py`

```python
def disable_vnbroker_upgrade_notice() -> bool:
    """
    Problem: vnbroker spam stdout with "new version available" messages
    
    Fix: Replace update_notice() with noop
    
    Idempotent: Function already patched check built-in
    """
```

**Impact:** Cleaner logs, no version warnings in Celery/admin output

---

## IV. ERROR HANDLING & RATE LIMIT STRATEGY

### 4.1 Exception Flow

```python
# vnbroker_adapter.py::_run_with_timeout()

for attempt in range(max_attempts):
    try:
        │
        ├─ acquire(BoundedSemaphore) → timeout if queue saturated
        │     └─ ExternalSystemException('vnbroker queue saturated', code='vnbroker_busy')
        │
        ├─ ThreadPoolExecutor.submit(fn).result(timeout=...)
        │     ├─ TimeoutError → ExternalSystemException(f'vnbroker timeout {timeout}s', code='vnbroker_timeout')
        │     ├─ 429/rate_limit → ExternalSystemException(..., code='vnbroker_rate_limited')
        │     │     └─ mark_vnbroker_rate_limited() sets cooldown cache
        │     │
        │     └─ Other Exception → ExternalSystemException(..., code='vnbroker_error')
        │
        ├─ should_retry = (5xx in response AND attempt < max_attempts)
        │     └─ sleep(backoff * attempt)  # Exponential backoff
        │
        └─ finally: release(BoundedSemaphore)

    ↓
    If last error and no retry → raise ExternalSystemException
```

### 4.2 Business Logic Fallbacks

**Scenario: whale_feed_aggregate endpoint encounters vnbroker 503**

```
Primary: Redis Stream → IntradayTick DB → vnbroker
Fallback: Use previous cached aggregate response
         + mark_vnbroker_rate_limited('intraday')
         + Return 200 with degraded data
```

(See `backend/portfolio/whale_feed_helpers.py::_build_vnbroker_aggregate_records()`)

---

## V. LIMITATIONS OF CURRENT APPROACH

### ❌ Problems

1. **Immutable per Process**
   - Config loaded once at module import
   - Even env var change requires Django restart
   - No hot-reload

2. **No UI/Admin Persistence**
   - Cannot adjust timeout/concurrency without editing `.env` + restart
   - No audit trail of config changes
   - No per-environment override (dev vs staging vs prod)

3. **Limited Observability**
   - No metrics on concurrency saturation
   - No dashboard for rate limit state
   - Patch status invisible to ops

4. **Patch Hardcoding**
   - Patches applied unconditionally
   - No way to disable/toggle
   - No version detection (always patches Finance.__init__)

### ✅ What Works Well

1. **Multi-Source Fallback** - price_board tries VCI→KBS on rate limit
2. **Graceful Degradation** - Falls back to DB/synthetic data when vnbroker unavailable
3. **Exponential Backoff** - Auto-manages retry with increasing delays
4. **Concurrency Gating** - BoundedSemaphore prevents overwhelming provider

---

## VI. RECOMMENDED RUNTIME CONFIGURATION SOLUTION

### 6.1 Architecture: RuntimeVnbrokerConfig Model + Admin UI

**Goal:** Hot-updatable configuration without restart, with audit trail

#### A. Database Model

**File:** `backend/portfolio/models.py`

```python
class RuntimeVnbrokerConfig(models.Model):
    """
    Runtime configuration for vnbroker adapter.
    Singleton pattern: only 1 active config at a time.
    """
    
    # Concurrency
    max_concurrency = models.PositiveIntegerField(
        default=12,
        help_text='Max concurrent vnbroker requests. Benchmark: 8-16 stable.',
    )
    
    # Timeout (seconds)
    general_timeout_seconds = models.PositiveIntegerField(default=8)
    intraday_timeout_seconds = models.PositiveIntegerField(default=8)
    price_board_timeout_seconds = models.PositiveIntegerField(default=8)
    financial_ratio_timeout_seconds = models.PositiveIntegerField(default=10)
    history_timeout_seconds = models.PositiveIntegerField(default=12)
    listing_timeout_seconds = models.PositiveIntegerField(default=12)
    
    # Retry
    retry_attempts = models.PositiveIntegerField(default=1)
    retry_backoff_seconds = models.FloatField(default=0.35)
    
    # Rate Limit
    rate_limit_cooldown_seconds = models.PositiveIntegerField(default=20)
    
    # Sources
    price_board_source = models.CharField(max_length=50, default='VCI')
    price_board_fallback_sources = models.CharField(
        max_length=200,
        default='KBS,VCI',
        help_text='Comma-separated list of fallback sources',
    )
    
    # Feature Flags
    enable_multi_source_fallback = models.BooleanField(default=True)
    enable_rate_limit_cache = models.BooleanField(default=True)
    enable_retry_on_timeout = models.BooleanField(default=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, on_delete=models.PROTECT, null=True)
    notes = models.TextField(blank=True)
    
    class Meta:
        verbose_name = 'VNBroker Runtime Configuration'
        db_table = 'portfolio_runtime_vnbroker_config'
    
    def __str__(self):
        return f'VNBroker Config (updated {self.updated_at.strftime("%Y-%m-%d %H:%M")})'
    
    @classmethod
    def get_current(cls) -> 'RuntimeVnbrokerConfig':
        """Get active config, creating default if not exists."""
        cfg, _ = cls.objects.get_or_create(pk=1, defaults={})
        return cfg
```

#### B. Admin Registration

**File:** `backend/portfolio/admin.py` (add to existing)

```python
@admin.register(RuntimeVnbrokerConfig)
class RuntimeVnbrokerConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Concurrency Control', {
            'fields': ('max_concurrency',)
        }),
        ('Timeout Configuration (seconds)', {
            'fields': (
                'general_timeout_seconds',
                'intraday_timeout_seconds',
                'price_board_timeout_seconds',
                'financial_ratio_timeout_seconds',
                'history_timeout_seconds',
                'listing_timeout_seconds',
            ),
        }),
        ('Retry Strategy', {
            'fields': ('retry_attempts', 'retry_backoff_seconds'),
        }),
        ('Rate Limit & Fallback', {
            'fields': (
                'rate_limit_cooldown_seconds',
                'price_board_source',
                'price_board_fallback_sources',
            ),
        }),
        ('Feature Flags', {
            'fields': (
                'enable_multi_source_fallback',
                'enable_rate_limit_cache',
                'enable_retry_on_timeout',
            ),
        }),
        ('Audit', {
            'fields': ('created_at', 'updated_at', 'updated_by', 'notes'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at')
    
    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        # Invalidate cache to pick up new config
        from django.core.cache import cache
        cache.delete('vnbroker_runtime_config_cache')
        logger.info(f'VNBroker config updated by {request.user.username}')
```

#### C. Loading Mechanism (Adapter Update)

**File:** `backend/portfolio/adapters/vnbroker_adapter.py` (modify)

```python
# Add cache-backed config getter
def _get_runtime_config():
    """Load from DB with 5min cache, fallback to env vars."""
    from django.core.cache import cache
    
    cached = cache.get('vnbroker_runtime_config_cache')
    if cached:
        return cached
    
    try:
        from portfolio.models import RuntimeVnbrokerConfig
        cfg = RuntimeVnbrokerConfig.get_current()
        config_dict = {
            'max_concurrency': cfg.max_concurrency,
            'retry_attempts': cfg.retry_attempts,
            'retry_backoff_seconds': cfg.retry_backoff_seconds,
            'rate_limit_cooldown_seconds': cfg.rate_limit_cooldown_seconds,
            # ... etc
        }
        cache.set('vnbroker_runtime_config_cache', config_dict, 300)  # 5min
        return config_dict
    except Exception:
        # Fallback to env vars (handled below)
        return None

# Update config resolution:
def _resolve_int_env_or_db(name: str, default_value: int, min_value: int = 0) -> int:
    # Priority: env var > runtime config DB > hardcoded default
    env_val = os.getenv(name)
    if env_val:
        try:
            return max(int(env_val), min_value)
        except (ValueError, TypeError):
            pass
    
    cfg = _get_runtime_config()
    if cfg and name in cfg:
        return max(cfg[name], min_value)
    
    return max(default_value, min_value)

# Replace module-level loads with lazy evaluation:
_VNBROKER_MAX_CONCURRENCY_GETTER = lambda: _resolve_int_env_or_db(
    'VNBROKER_MAX_CONCURRENCY', 12, 1
)

# In _run_with_timeout, dynamically acquire semaphore:
def _run_with_timeout(fn, timeout=8):
    current_concurrency = _VNBROKER_MAX_CONCURRENCY_GETTER()
    
    # Recreate gate if config changed
    global _VNBROKER_GATE
    if _VNBROKER_GATE._value != current_concurrency:
        logger.info(f'Updating concurrency gate to {current_concurrency}')
        _VNBROKER_GATE = threading.BoundedSemaphore(value=current_concurrency)
    
    # ... rest of function
```

#### D. Management Command for Migration

**File:** `backend/portfolio/management/commands/init_vnbroker_runtime_config.py`

```python
from django.core.management.base import BaseCommand
from portfolio.models import RuntimeVnbrokerConfig

class Command(BaseCommand):
    help = 'Initialize RuntimeVnbrokerConfig from current env vars'
    
    def handle(self, *args, **options):
        import os
        
        cfg, created = RuntimeVnbrokerConfig.objects.get_or_create(pk=1)
        
        # Load from env and update
        cfg.max_concurrency = int(os.getenv('VNBROKER_MAX_CONCURRENCY', 12))
        cfg.general_timeout_seconds = int(os.getenv('VNBROKER_GENERAL_TIMEOUT_SECONDS', 8))
        # ... etc
        cfg.notes = 'Initialized from environment variables'
        cfg.save()
        
        self.stdout.write(self.style.SUCCESS(
            f'VNBroker runtime config initialized: {cfg}'
        ))
```

---

### 6.2 Implementation Roadmap

| Phase | Task | Effort | Benefit |
|-------|------|--------|---------|
| **Phase 1** | Add `RuntimeVnbrokerConfig` model + admin | 2h | UI control over timeouts/concurrency |
| **Phase 2** | Update adapter to use DB config + cache | 3h | Hot config without restart |
| **Phase 3** | Add migration command + docs | 1h | Easy deployment |
| **Phase 4** | Add metrics/monitoring dashboard | 4h | Observability into rate limit state |
| **Phase 5** | Feature flag for patch toggle | 2h | Safer vnbroker version upgrades |

**Total:** ~12 hours for full solution

---

### 6.3 Example Usage After Implementation

```bash
# Before: Edit .env, restart Django
# After: Change in admin UI, instant effect:

# Old way (still works as override):
export VNBROKER_MAX_CONCURRENCY=20
systemctl restart django

# New way (hot update):
# 1. Django Admin → VNBroker Runtime Configuration
# 2. Set max_concurrency = 20
# 3. Click Save
# 4. Config takes effect within 5 minutes (cache TTL)
# 5. Audit log: "user@example.com updated config at 2026-04-12 14:30:45"
```

---

## VII. DATA SOURCE PRIORITY & FALLBACK

### 7.1 What Each Adapter Call Uses

```python
# Price Board (multi-source with smart fallback):
fetch_price_board_dataframe()
  ├─ Try: VNBROKER_PRICE_BOARD_SOURCE (default=VCI)
  ├─ If 429: Try next in VNBROKER_PRICE_BOARD_FALLBACK_SOURCES (default=KBS,VCI)
  └─ If all fail: ExternalSystemException

# Intraday (single source, no fallback):
fetch_intraday_dataframe()
  └─ VCI only (best for tick data)

# Daily History (source parameterized):
fetch_history_dataframe(source='KBS')
  └─ KBS (official historical data)

# Financial (source parameterized):
fetch_financial_ratio_dataframe(source='VCI')
  └─ VCI (primary)

# Listing (source parameterized):
fetch_listing_symbols_dataframe(source='VCI')
  └─ VCI (primary)
```

### 7.2 Sources Available
- **VCI** - Vietnam Holdings (most frequent/low latency)
- **KBS** - Official Vietnamese stock exchange (slower but authoritative)
- **Other** - SSI, BSC, etc. (not currently used)

---

## VIII. OBSERVABILITY & MONITORING RECOMMENDATIONS

### 8.1 Metrics to Track

```python
# In vnbroker_adapter.py, add instrumentation:

@contextmanager
def _track_vnbroker_call(channel: str):
    """Track concurrency, latency, errors."""
    import time
    from django.core.cache import cache
    
    start = time.time()
    
    try:
        yield
    except ExternalSystemException as exc:
        # Log error code distribution
        cache.incr(f'vnbroker:errors:{exc.code}', 1)
        raise
    finally:
        duration = time.time() - start
        cache.incr(f'vnbroker:calls:total', 1)
        cache.incr(f'vnbroker:calls:{channel}', 1)
        
        if duration > 5:
            cache.incr(f'vnbroker:slow_calls', 1)
            logger.warning(f'Slow vnbroker call: {channel} took {duration:.2f}s')
```

### 8.2 Dashboard Metrics (Suggested)
- **Concurrency Saturation %** - (active requests / max_concurrency)
- **Error Rate by Code** - vnbroker_timeout, vnbroker_rate_limited, etc.
- **Latency Percentiles** - p50, p95, p99 by channel
- **Rate Limit Cooldown Count** - How often rate limit triggered
- **Fallback Usage** - % of price_board queries using fallback source

---

## IX. CHECKLIST FOR DEPLOYMENT

- [ ] Review patch necessity (especially Finance.__init__ fix)
- [ ] Test timeout values under production load
- [ ] Configure environment-specific concurrency (dev: 4, staging: 12, prod: 20)
- [ ] Set up alerts for vnbroker_timeout spikes
- [ ] Document vnbroker Fork version: `git+https://github.com/vietdungiitb/vnbroker.git@internal/core-1.0.0`
- [ ] Verify fallback sources (VCI, KBS) both accessible
- [ ] Test graceful degradation when vnbroker unavailable

---

## X. REFERENCES

- **Current Latest Changes:**
  - backend/CHANGELOG.md _(khong ton tai)_ - Vnbroker fork migration (04/04/2026)
  - [backend/requirements.txt](backend/requirements.txt) - Fork URL with internal/core branch

- **Key Files:**
  - [backend/portfolio/adapters/vnbroker_adapter.py](backend/portfolio/adapters/vnbroker_adapter.py) - Main adapter
  - [backend/portfolio/vnbroker_compat.py](backend/portfolio/vnbroker_compat.py) - Patches
  - [.env.example](backend/.env.example) - Configuration template

---

## APPENDIX: Quick Parameter Reference

```bash
# .env Template for Production Tuning

# Concurrency (benchmark: 12-16 stable for production)
VNBROKER_MAX_CONCURRENCY=16
VNBROKER_RETRY_ATTEMPTS=2
VNBROKER_RETRY_BACKOFF_SECONDS=0.5

# Timeout (seconds) - adjust if network latency high
VNBROKER_GENERAL_TIMEOUT_SECONDS=10
VNBROKER_INTRADAY_TIMEOUT_SECONDS=10
VNBROKER_PRICE_BOARD_TIMEOUT_SECONDS=10
VNBROKER_FINANCIAL_RATIO_TIMEOUT_SECONDS=12
VNBROKER_HISTORY_TIMEOUT_SECONDS=15
VNBROKER_LISTING_TIMEOUT_SECONDS=15

# Rate Limit Cooling (seconds)
VNBROKER_RATE_LIMIT_COOLDOWN_SECONDS=30

# Sources
VNBROKER_PRICE_BOARD_SOURCE=VCI
VNBROKER_PRICE_BOARD_FALLBACK_SOURCES=KBS,VCI

# Business Constraints
WHALE_AGGREGATE_VNBROKER_MAX_SYMBOLS=8
TICKER_PREFETCH_SYMBOL_LIMIT=300
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-12 by GitHub Copilot  
**Status:** 📋 Ready for Implementation
