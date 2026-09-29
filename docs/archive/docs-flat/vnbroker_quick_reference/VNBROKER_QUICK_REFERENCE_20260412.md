# 🎯 VNBroker Configuration - Tóm Tắt Thực Thi (Quick Start)

**Ngày:** 12/04/2026 | **Trạng thái:** Sẵn triển khai

---

## I. DANH SÁCH FILE LIÊN QUAN (6 file chính)

### Core Integration
```
backend/portfolio/adapters/vnbroker_adapter.py       ← Central adapter (timeout/retry/rate-limit)
backend/portfolio/adapters/cache_adapter.py        ← Cache + rate limit detection
backend/portfolio/vnbroker_compat.py                ← Runtime patches (Finance init, upgrade notice)
backend/portfolio/apps.py                          ← Gọi patches tại startup
```

### Direct Usage (với fallback)
```
backend/portfolio/realtime/collector.py            ← Intraday ticks
backend/portfolio/services.py                      ← Daily prices, exchange lookup, sync profiles
backend/portfolio/admin.py                         ← Live ticker in admin
```

### Management Commands
```
backend/portfolio/management/commands/sync_stockprofile.py  ← Sync stocks/sectors
backend/portfolio/management/commands/seed_watchlist.py     ← Seed từ sectors
```

---

## II. THAM SỐ CẤU HÌNH RUNTIME (Có Thể Thay Đổi)

### 🔧 Có Thể Thay Đổi Tại Runtime (qua `.env` + restart)

| Tham số | Mặc định | File | Ghi chú |
|--------|---------|------|--------|
| `VNBROKER_MAX_CONCURRENCY` | 12 | vnbroker_adapter.py:74 | Max requests đồng thời |
| `VNBROKER_RETRY_ATTEMPTS` | 1 | vnbroker_adapter.py:75 | Retry khi timeout/5xx |
| `VNBROKER_RETRY_BACKOFF_SECONDS` | 0.35 | vnbroker_adapter.py:76 | Exponential backoff delay |
| `VNBROKER_GENERAL_TIMEOUT_SECONDS` | 8 | vnbroker_adapter.py:43 | Default timeout |
| `VNBROKER_*_TIMEOUT_SECONDS` | Per channel | vnbroker_adapter.py:33-44 | Timeout per channel (intraday, price_board, etc.) |
| `VNBROKER_RATE_LIMIT_COOLDOWN_SECONDS` | 20 | cache_adapter.py:47 | Cooldown khi gặp 429 |
| `VNBROKER_PRICE_BOARD_SOURCE` | VCI | vnbroker_adapter.py:106 | Primary source (VCI, KBS) |
| `VNBROKER_PRICE_BOARD_FALLBACK_SOURCES` | KBS,VCI | vnbroker_adapter.py:107 | Fallback sources |

### 🔒 Không Thể Thay Đổi Runtime (hardcoded)
```python
# Patches (luôn áp dụng):
- patch_vnbroker_finance_init()       # Fix period parameter bug
- disable_vnbroker_upgrade_notice()   # Tắt version upgrade warnings

# Behavior (hardcoded):
- BoundedSemaphore concurrency control
- ThreadPoolExecutor timeout enforcement
- Error code mapping (vnbroker_timeout, vnbroker_rate_limited, etc.)
```

---

## III. INITIALIZATION ORDER

```
1. Django App Load
2. vnbroker_adapter.py module imports
   → Load env vars (_VNBROKER_MAX_CONCURRENCY, etc.)
   → Init BoundedSemaphore
3. PortfolioConfig.ready() triggered
   → patch_vnbroker_finance_init()
   → disable_vnbroker_upgrade_notice()
4. First request hits /api/whale-feed (example)
   → Lazy import: from vnbroker import Vnbroker
   → Adapter wraps with timeout/retry
   → Execute request
```

---

## IV. HIỆN TẠI CÓ GÌ, THIẾU GÌ?

### ✅ CÓ (Hoạt động tốt)

| Tính năng | Vị trí | Mô tả |
|----------|--------|-------|
| Multi-source fallback | vnbroker_adapter.py:174-194 | price_board gọi VCI→KBS khi rate limit |
| Graceful degradation | collector.py, services.py | Fallback DB/synthetic khi vnbroker lỗi |
| Exponential backoff | vnbroker_adapter.py:121-128 | Auto-retry với delay tăng dần |
| Concurrency gating | vnbroker_adapter.py:35 | BoundedSemaphore ngăn quá tải provider |
| Rate limit detection | cache_adapter.py:27 | Detect 429 → cache cooldown |

### ❌ THIẾU (Cần triển khai)

| Tính năng | Vấn đề | Tác động |
|----------|--------|---------|
| **Runtime config UI** | Không có giao diện admin để thay timeout/concurrency | Phải edit .env + restart → downtime |
| **Hot reload** | Config load một lần tại startup | Env var change không có hiệu lực ngay |
| **Patch toggle** | Patches luôn bật | Không thể disable nếu vnbroker version thay đổi |
| **Observability** | Không có metrics/dashboard | Không thấy rate limit state, concurrency saturation |
| **Audit trail** | Không log ai thay đổi config, khi nào | Khó debug config issues |

---

## V. GIẢI PHÁP ĐỀ XUẤT: RuntimeVnbrokerConfig

### A. Schema (add vào `models.py`)

```python
class RuntimeVnbrokerConfig(models.Model):
    """Config duy nhất, load từ DB với cache 5 phút"""
    
    # Concurrency
    max_concurrency = IntegerField(default=12)
    
    # Timeout per channel
    general_timeout_seconds = IntegerField(default=8)
    intraday_timeout_seconds = IntegerField(default=8)
    price_board_timeout_seconds = IntegerField(default=8)
    ... # etc
    
    # Retry
    retry_attempts = IntegerField(default=1)
    retry_backoff_seconds = FloatField(default=0.35)
    
    # Rate limit
    rate_limit_cooldown_seconds = IntegerField(default=20)
    
    # Sources
    price_board_source = CharField(max_length=50, default='VCI')
    price_board_fallback_sources = CharField(default='KBS,VCI')
    
    # Feature flags
    enable_multi_source_fallback = BooleanField(default=True)
    enable_rate_limit_cache = BooleanField(default=True)
    
    # Audit
    updated_at = DateTimeField(auto_now=True)
    updated_by = ForeignKey(User, on_delete=DO_NOTHING)
    notes = TextField(blank=True)
```

### B. Admin Registration

```python
@admin.register(RuntimeVnbrokerConfig)
class RuntimeVnbrokerConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Concurrency Control', {'fields': ('max_concurrency',)}),
        ('Timeout (seconds)', {'fields': ('general_timeout_seconds', 'intraday_timeout_seconds', ...)}),
        ('Retry', {'fields': ('retry_attempts', 'retry_backoff_seconds')}),
        ('Rate Limit & Fallback', {'fields': (...)}),
        ('Feature Flags', {'fields': (...)}),
    )
    
    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(...)
        cache.delete('vnbroker_runtime_config_cache')  # ← Hot invalidate
```

### C. Adapter Update (lazy load)

```python
# In vnbroker_adapter.py:

def _get_runtime_config():
    """Load từ DB (cache 5 phút), fallback env vars"""
    cached = cache.get('vnbroker_runtime_config_cache')
    if cached:
        return cached
    
    try:
        cfg = RuntimeVnbrokerConfig.get_current()
        config_dict = {
            'max_concurrency': cfg.max_concurrency,
            'retry_attempts': cfg.retry_attempts,
            ...
        }
        cache.set('vnbroker_runtime_config_cache', config_dict, 300)
        return config_dict
    except:
        return None

def _resolve_int_env_or_db(name, default):
    # Priority: env var > DB config > default
    env = os.getenv(name)
    if env:
        return int(env)
    
    cfg = _get_runtime_config()
    if cfg and name in cfg:
        return cfg[name]
    
    return default

# Update _run_with_timeout để dynamic acquire semaphore:
def _run_with_timeout(fn, timeout=8):
    current_concurrency = _resolve_int_env_or_db('VNBROKER_MAX_CONCURRENCY', 12)
    
    # Recreate gate khi config thay đổi
    global _VNBROKER_GATE
    if _VNBROKER_GATE._value != current_concurrency:
        _VNBROKER_GATE = threading.BoundedSemaphore(value=current_concurrency)
    
    # ... rest
```

---

## VI. IMPLEMENTATION ROADMAP

| Phase | Tác vụ | Thời gian | Lợi ích |
|-------|--------|----------|---------|
| **1** | Add RuntimeVnbrokerConfig model + admin | 2h | UI control tất cả parameters |
| **2** | Update adapter lazy-load config + cache | 3h | Config changes take effect in 5 min |
| **3** | Migration command + docs | 1h | Easy deployment |
| **4** | Metrics dashboard | 4h | Monitor rate limit, concurrency saturation |
| **5** | Patch toggle/version detection | 2h | Safe vnbroker upgrades |

**Total:** ~12h

---

## VII. USAGE EXAMPLE (Sau khi triển khai)

### Trước (cũ)
```bash
# Edit .env
VNBROKER_MAX_CONCURRENCY=20

# Restart
systemctl restart django           # ← Downtime!
```

### Sau (mới)
```
1. Goto Django Admin:
   http://localhost:8000/admin/portfolio/runtimevnbrokerconfig/1/change/
   
2. Set max_concurrency = 20
   Set intraday_timeout_seconds = 12
   Set rate_limit_cooldown_seconds = 30
   
3. Click Save
   
4. Config effective within 5 minutes (cache invalidation)
   
5. Audit log: 
   "user@example.com changed max_concurrency from 12 to 20 (2026-04-12 14:30:45)"
```

---

## VIII. VNBROKER API USAGE PATTERNS (Toàn Codebase)

**Pattern duy nhất được sử dụng:**

```python
from vnbroker import Vnbroker

# Instantiate client
stock = Vnbroker().stock(symbol='VNM', source='VCI')

# Methods available
df = stock.quote.intraday(symbol, page_size)              # Ticks
df = stock.quote.history(start, end, interval='1D')       # Daily OHLC
df = stock.trading.price_board(symbols_list)              # Live quotes
df = stock.finance.ratio(period='year', lang='vi')        # Financials
df = stock.listing.all_symbols()                          # All stocks
df = stock.listing.symbols_by_exchange()                  # By exchange
```

**Sources available:** VCI (quick), KBS (authoritative), others (SSI, BSC, etc.)

---

## IX. DATABASE MIGRATIONS REQUIRED

```bash
# 1. Add model
python manage.py makemigrations portfolio

# 2. Apply migration
python manage.py migrate portfolio

# 3. Initialize config from env vars
python manage.py init_vnbroker_runtime_config
```

---

## X. ERROR CODES VÀ HANDLING

| Code | Trigger | Recovery |
|------|---------|----------|
| `vnbroker_timeout` | Timeout exceed | Retry with backoff (if enabled) |
| `vnbroker_rate_limited` | HTTP 429 | Mark cache cooldown, try fallback source |
| `vnbroker_busy` | Semaphore saturated | Return error immediately (queue full) |
| `vnbroker_error` | Generic error | Retry with backoff (if 5xx) |
| `vnbroker_missing` | Import fails | Fall back to DB/synthetic |

---

## XI. DEPLOYMENT CHECKLIST

- [ ] Add RuntimeVnbrokerConfig model
- [ ] Register in admin.py
- [ ] Update vnbroker_adapter.py lazy loading
- [ ] Run migrations
- [ ] Test admin UI: change timeout, verify effect within 5 min
- [ ] Monitor error logs during change
- [ ] Document for ops team

---

## 📚 LỌC QUICK REFERENCE

```bash
# View current config (env vars):
grep VNBROKER_ backend/.env
grep VNBROKER_ backend/.env.example

# Files to modify:
backend/portfolio/models.py           # Add model
backend/portfolio/admin.py            # Register admin
backend/portfolio/adapters/vnbroker_adapter.py  # Lazy loading

# Create migration:
python manage.py makemigrations portfolio

# Test config change impact:
# 1. Django admin: change max_concurrency to 5
# 2. Monitor: curl http://localhost:8000/api/vnbroker-health
# 3. Verify: vnbroker requests respect new limit
```

---

**Status:** 📋 Sẵn triển khai  
**Effort:** ~12 hours  
**Risk:** Thấp (backward compatible, env vars still work)  
**Benefit:** Hot config, audit trail, observability
