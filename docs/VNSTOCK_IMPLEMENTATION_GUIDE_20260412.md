# VNStock Runtime Config - Implementation Guide (Chi Tiết)

**Mục tiêu:** Thêm khả năng thay đổi vnstock config at runtime (hot reload) qua Admin UI  
**Thời gian:** ~12 giờ  
**Độ khó:** Trung bình

---

## STEP 1: Add Model (1 giờ)

**File:** `backend/portfolio/models.py`

Tìm cuối file, thêm:

```python
class RuntimeVnstockConfig(models.Model):
    """
    Cấu hình runtime cho vnstock adapter.
    Singleton pattern: chỉ 1 config hoạt động tại một thời điểm.
    
    Load strategy:
    1. Check cache (5 phút)
    2. Load từ DB (RuntimeVnstockConfig.objects.first())
    3. Fallback env vars (VNSTOCK_* env variables)
    4. Hardcoded defaults
    """
    
    # ============ CONCURRENCY ============
    max_concurrency = models.PositiveIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
        help_text='Max concurrent vnstock requests. Benchmark: 8-16 safe. Range: 1-100.',
    )
    
    # ============ TIMEOUT (SECONDS) ============
    general_timeout_seconds = models.PositiveIntegerField(
        default=8,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Default timeout for all vnstock calls.',
    )
    intraday_timeout_seconds = models.PositiveIntegerField(
        default=8,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Intraday quotes timeout.',
    )
    price_board_timeout_seconds = models.PositiveIntegerField(
        default=8,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Price board (live quotes) timeout.',
    )
    financial_ratio_timeout_seconds = models.PositiveIntegerField(
        default=10,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Financial ratio fetch timeout.',
    )
    history_timeout_seconds = models.PositiveIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Daily price history fetch timeout.',
    )
    listing_timeout_seconds = models.PositiveIntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(60)],
        help_text='Listing/symbols fetch timeout.',
    )
    
    # ============ RETRY ============
    retry_attempts = models.PositiveIntegerField(
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text='Number of retries on timeout/5xx. 0 = no retry.',
    )
    retry_backoff_seconds = models.FloatField(
        default=0.35,
        validators=[MinValueValidator(0.0), MaxValueValidator(10.0)],
        help_text='Exponential backoff multiplier (seconds) per retry attempt.',
    )
    
    # ============ RATE LIMIT ============
    rate_limit_cooldown_seconds = models.PositiveIntegerField(
        default=20,
        validators=[MinValueValidator(5), MaxValueValidator(300)],
        help_text='Cooldown duration when HTTP 429 detected.',
    )
    
    # ============ DATA SOURCES ============
    price_board_source = models.CharField(
        max_length=50,
        default='VCI',
        choices=[
            ('VCI', 'VCI (Vietnam Holdings - quick)'),
            ('KBS', 'KBS (Official Vietnamese exchange - slower)'),
        ],
        help_text='Primary source for price board queries.',
    )
    price_board_fallback_sources = models.CharField(
        max_length=200,
        default='KBS,VCI',
        help_text='Comma-separated list of fallback sources (tried in order on rate limit).',
    )
    
    # ============ FEATURE FLAGS ============
    enable_multi_source_fallback = models.BooleanField(
        default=True,
        help_text='Allow fallback to secondary data sources on rate limit.',
    )
    enable_rate_limit_cache = models.BooleanField(
        default=True,
        help_text='Cache 429 responses to prevent repeated calls during cooldown.',
    )
    enable_retry_on_timeout = models.BooleanField(
        default=True,
        help_text='Automatically retry on timeout (respects retry_attempts).',
    )
    
    # ============ AUDIT ============
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        help_text='User who made the last change.',
    )
    notes = models.TextField(
        blank=True,
        help_text='Change notes (e.g., reason for timeout increase).',
    )
    
    class Meta:
        verbose_name = 'VNStock Runtime Configuration'
        verbose_name_plural = 'VNStock Runtime Configuration'
        db_table = 'portfolio_runtime_vnstock_config'
    
    def __str__(self):
        update_info = self.updated_at.strftime('%Y-%m-%d %H:%M') if self.updated_at else 'never'
        by_info = f' by {self.updated_by.username}' if self.updated_by else ''
        return f'VNStock Config (updated {update_info}{by_info})'
    
    def clean(self):
        """Validate fallback sources are comma-separated valid values."""
        from django.core.exceptions import ValidationError
        
        valid_sources = ['VCI', 'KBS', 'SSI', 'BSC']  # Extend as needed
        sources = [s.strip().upper() for s in self.price_board_fallback_sources.split(',')]
        
        for source in sources:
            if source and source not in valid_sources:
                raise ValidationError(f'Invalid source: {source}. Valid: {", ".join(valid_sources)}')
    
    @classmethod
    def get_current(cls) -> 'RuntimeVnstockConfig':
        """Get active config, creating default if not exists (singleton)."""
        cfg, created = cls.objects.get_or_create(pk=1, defaults={})
        return cfg
    
    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)


# Add to Django Auth User model if not using default:
# This is already done by default, just reference it
```

**What to do:**
1. Paste above model into `backend/portfolio/models.py` (at the end)
2. Import any missing dependencies at top of file:
   ```python
   from django.contrib.auth.models import User
   from django.core.validators import MinValueValidator, MaxValueValidator
   ```

---

## STEP 2: Register Admin (1 giờ)

**File:** `backend/portfolio/admin.py`

At the end of the file, add:

```python
import logging
from django.contrib import admin
from django.utils.html import format_html
from .models import RuntimeVnstockConfig

logger = logging.getLogger(__name__)


@admin.register(RuntimeVnstockConfig)
class RuntimeVnstockConfigAdmin(admin.ModelAdmin):
    """Admin interface for vnstock runtime configuration."""
    
    fieldsets = (
        ('⚙️ Concurrency Control', {
            'fields': ('max_concurrency',),
            'description': '<small>Benchmark throughput: 8-16 concurrent requests recommended for production.</small>',
        }),
        ('⏱ Timeout Configuration (seconds)', {
            'fields': (
                'general_timeout_seconds',
                'intraday_timeout_seconds',
                'price_board_timeout_seconds',
                'financial_ratio_timeout_seconds',
                'history_timeout_seconds',
                'listing_timeout_seconds',
            ),
            'description': (
                '<small>Per-channel timeouts override general_timeout_seconds. '
                'Increase if network latency high or provider slow.</small>'
            ),
        }),
        ('🔄 Retry Strategy', {
            'fields': ('retry_attempts', 'retry_backoff_seconds'),
            'description': (
                '<small>Amount of retries on timeout/5xx errors. '
                'Backoff increases exponentially: 0.35s, 0.7s, 1.05s, ...</small>'
            ),
        }),
        ('🚨 Rate Limit & Fallback', {
            'fields': (
                'rate_limit_cooldown_seconds',
                'price_board_source',
                'price_board_fallback_sources',
                'enable_multi_source_fallback',
                'enable_rate_limit_cache',
            ),
            'description': (
                '<small>Cooldown is applied when HTTP 429 (rate limit) detected. '
                'Fallback sources are tried in order on rate limit.</small>'
            ),
        }),
        ('🚀 Feature Flags', {
            'fields': ('enable_retry_on_timeout',),
        }),
        ('📝 Audit Trail', {
            'fields': ('created_at', 'updated_at', 'updated_by', 'notes'),
            'classes': ('collapse',),
        }),
    )
    
    readonly_fields = ('created_at', 'updated_at', 'updated_by')
    
    def has_delete_permission(self, request, obj=None):
        """Prevent deletion of singleton config."""
        return False
    
    def has_add_permission(self, request):
        """Prevent creating multiple configs."""
        return RuntimeVnstockConfig.objects.count() == 0
    
    def save_model(self, request, obj, form, change):
        """Update user and invalidate cache on save."""
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
        
        # Invalidate cache to force reload on next request
        try:
            from django.core.cache import cache
            cache.delete('vnstock_runtime_config_cache')
            logger.info(
                f'VNStock runtime config updated by {request.user.username}: '
                f'max_concurrency={obj.max_concurrency}, '
                f'rate_limit_cooldown={obj.rate_limit_cooldown_seconds}s'
            )
        except Exception as exc:
            logger.warning(f'Failed to invalidate vnstock config cache: {exc}')
    
    def get_readonly_fields(self, request, obj=None):
        """Make audit fields read-only after creation."""
        if obj:  # Editing existing
            return self.readonly_fields + ('max_concurrency',)  # Concurrency is also readonly in prod
        return self.readonly_fields
```

**What to do:**
1. Paste above code into `backend/portfolio/admin.py` (at the end)
2. Fix existing imports if needed

---

## STEP 3: Update Adapter to Use DB Config (3 giờ)

**File:** `backend/portfolio/adapters/vnstock_adapter.py`

### 3.1 Add Helper to Load Config from DB

After the imports (around line 12), add:

```python
# Add import at top of file:
from functools import lru_cache

# Then add this function after _resolve_float_env:

def _get_runtime_config():
    """
    Load vnstock runtime config from DB with caching.
    
    Priority:
    1. Cache (5 min TTL)
    2. DB (RuntimeVnstockConfig.get_current())
    3. Environment variables (fallback)
    4. Hardcoded defaults
    """
    try:
        from django.core.cache import cache
        
        cached = cache.get('vnstock_runtime_config_cache')
        if cached:
            return cached
    except Exception:
        pass
    
    try:
        from portfolio.models import RuntimeVnstockConfig
        
        cfg = RuntimeVnstockConfig.get_current()
        config_dict = {
            'max_concurrency': cfg.max_concurrency,
            'retry_attempts': cfg.retry_attempts,
            'retry_backoff_seconds': cfg.retry_backoff_seconds,
            'rate_limit_cooldown_seconds': cfg.rate_limit_cooldown_seconds,
            'price_board_source': cfg.price_board_source,
            'price_board_fallback_sources': cfg.price_board_fallback_sources,
            'enable_multi_source_fallback': cfg.enable_multi_source_fallback,
            'enable_rate_limit_cache': cfg.enable_rate_limit_cache,
            'general_timeout_seconds': cfg.general_timeout_seconds,
            'intraday_timeout_seconds': cfg.intraday_timeout_seconds,
            'price_board_timeout_seconds': cfg.price_board_timeout_seconds,
            'financial_ratio_timeout_seconds': cfg.financial_ratio_timeout_seconds,
            'history_timeout_seconds': cfg.history_timeout_seconds,
            'listing_timeout_seconds': cfg.listing_timeout_seconds,
        }
        
        # Cache for 5 minutes
        try:
            from django.core.cache import cache
            cache.set('vnstock_runtime_config_cache', config_dict, 300)
        except Exception:
            pass
        
        return config_dict
    except Exception as exc:
        logger.debug(f'Failed to load DB config: {exc}. Using env vars.')
        return None
```

### 3.2 Update Config Resolution Functions

Replace the existing `_resolve_int_env` and `_resolve_float_env` with:

```python
def _resolve_int_env(name: str, default_value: int, min_value: int = 0) -> int:
    """
    Resolve integer config: env var > DB config > default
    """
    # Priority 1: Environment variable (always override)
    env_val = os.getenv(name)
    if env_val:
        try:
            return max(int(env_val), min_value)
        except (ValueError, TypeError):
            logger.warning(f'Invalid env var {name}={env_val}')
    
    # Priority 2: DB config (runtime)
    db_config = _get_runtime_config()
    db_key = name.lower()  # Convert VNSTOCK_MAX_CONCURRENCY → vnstock_max_concurrency
    
    if db_config and db_key in db_config:
        db_val = db_config[db_key]
        if isinstance(db_val, int):
            return max(db_val, min_value)
    
    # Priority 3: Hardcoded default
    return max(default_value, min_value)


def _resolve_float_env(name: str, default_value: float, min_value: float = 0.0) -> float:
    """
    Resolve float config: env var > DB config > default
    """
    # Priority 1: Environment variable
    env_val = os.getenv(name)
    if env_val:
        try:
            return max(float(env_val), min_value)
        except (ValueError, TypeError):
            logger.warning(f'Invalid env var {name}={env_val}')
    
    # Priority 2: DB config
    db_config = _get_runtime_config()
    db_key = name.lower()
    
    if db_config and db_key in db_config:
        db_val = db_config[db_key]
        if isinstance(db_val, (int, float)):
            return max(float(db_val), min_value)
    
    # Priority 3: Default
    return max(default_value, min_value)
```

### 3.3 Make Concurrency Dynamic

Replace module-level concurrency initialization:

```python
# OLD (line ~74-76):
# _VNSTOCK_MAX_CONCURRENCY = _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12, 1)
# _VNSTOCK_RETRY_ATTEMPTS = _resolve_int_env('VNSTOCK_RETRY_ATTEMPTS', 1, 0)
# _VNSTOCK_RETRY_BACKOFF_SECONDS = _resolve_float_env('VNSTOCK_RETRY_BACKOFF_SECONDS', 0.35, 0.0)
# _VNSTOCK_GATE = threading.BoundedSemaphore(value=_VNSTOCK_MAX_CONCURRENCY)

# NEW:
_VNSTOCK_GATE = None  # Will be created on first call

def _get_vnstock_gate():
    """Get or recreate concurrency gate based on current config."""
    global _VNSTOCK_GATE
    
    current_max_concurrency = _resolve_int_env('VNSTOCK_MAX_CONCURRENCY', 12, 1)
    
    if _VNSTOCK_GATE is None:
        _VNSTOCK_GATE = threading.BoundedSemaphore(value=current_max_concurrency)
        logger.info(f'Created vnstock concurrency gate: max={current_max_concurrency}')
    elif _VNSTOCK_GATE._value != current_max_concurrency:
        logger.info(
            f'Updating vnstock concurrency gate: '
            f'{_VNSTOCK_GATE._value} → {current_max_concurrency}'
        )
        _VNSTOCK_GATE = threading.BoundedSemaphore(value=current_max_concurrency)
    
    return _VNSTOCK_GATE
```

### 3.4 Update _run_with_timeout to Use Dynamic Gate

In the `_run_with_timeout` function (around line 115), replace:

```python
# OLD:
def _run_with_timeout(fn, timeout=8):
    max_attempts = _VNSTOCK_RETRY_ATTEMPTS + 1
    last_error = None

    for attempt in range(max_attempts):
        acquired = _VNSTOCK_GATE.acquire(timeout=max(timeout, 1))

# NEW:
def _run_with_timeout(fn, timeout=8):
    current_retry_attempts = _resolve_int_env('VNSTOCK_RETRY_ATTEMPTS', 1, 0)
    current_backoff = _resolve_float_env('VNSTOCK_RETRY_BACKOFF_SECONDS', 0.35, 0.0)
    max_attempts = current_retry_attempts + 1
    last_error = None

    for attempt in range(max_attempts):
        gate = _get_vnstock_gate()  # Dynamic gate
        acquired = gate.acquire(timeout=max(timeout, 1))
```

And update the finally block to release the dynamic gate:

```python
        finally:
            gate = _get_vnstock_gate()  # Get current gate
            gate.release()
        
        # Update backoff calculation:
        if should_retry:
            time.sleep(current_backoff * (attempt + 1))  # Use current_backoff
            continue
```

### 3.5 Update _resolve_timeout Function

Replace the timeout resolution (around line 33):

```python
def _resolve_timeout(channel: str, default_timeout: int = 8) -> int:
    """
    Resolve timeout for a specific channel.
    
    Priority:
    1. Environment variable (VNSTOCK_{CHANNEL}_TIMEOUT_SECONDS)
    2. DB config (timeout_{channel}_seconds)
    3. Environment variable (VNSTOCK_GENERAL_TIMEOUT_SECONDS)
    4. Hardcoded default
    """
    # Priority 1: Channel-specific env var
    channel_env_key = f"VNSTOCK_{str(channel or 'general').upper()}_TIMEOUT_SECONDS"
    env_val = os.getenv(channel_env_key)
    if env_val:
        try:
            return max(int(env_val), 1)
        except (ValueError, TypeError):
            logger.warning(f'Invalid {channel_env_key}={env_val}')
    
    # Priority 2: DB config for this channel
    db_config = _get_runtime_config()
    db_key = f'{channel_env_key.lower()}'  # e.g., vnstock_intraday_timeout_seconds
    
    if db_config and db_key in db_config:
        db_val = db_config[db_key]
        if isinstance(db_val, int):
            return max(db_val, 1)
    
    # Priority 3: General timeout from env or DB
    general_env = os.getenv('VNSTOCK_GENERAL_TIMEOUT_SECONDS')
    if general_env:
        try:
            return max(int(general_env), 1)
        except (ValueError, TypeError):
            pass
    
    if db_config:
        db_general = db_config.get('general_timeout_seconds')
        if isinstance(db_general, int):
            return max(db_general, 1)
    
    # Priority 4: Default
    return max(default_timeout, 1)
```

---

## STEP 4: Create Migration (30 min)

```bash
cd backend
python manage.py makemigrations portfolio
```

This creates `backend/portfolio/migrations/XXXX_add_runtimevnstockconfig.py`

Run the migration:
```bash
python manage.py migrate portfolio
```

---

## STEP 5: Management Command to Initialize Config (1 giờ)

**File:** `backend/portfolio/management/commands/init_vnstock_runtime_config.py`

Create this file:

```python
import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from portfolio.models import RuntimeVnstockConfig


class Command(BaseCommand):
    help = 'Initialize RuntimeVnstockConfig from environment variables'
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--reset',
            action='store_true',
            help='Reset to defaults from env vars (overwrites existing config)',
        )
    
    def handle(self, *args, **options):
        try:
            admin_user = User.objects.filter(is_superuser=True).first()
        except Exception:
            admin_user = None
        
        cfg, created = RuntimeVnstockConfig.objects.get_or_create(pk=1)
        
        if created or options['reset']:
            # Load from environment variables
            cfg.max_concurrency = int(os.getenv('VNSTOCK_MAX_CONCURRENCY', 12))
            cfg.retry_attempts = int(os.getenv('VNSTOCK_RETRY_ATTEMPTS', 1))
            cfg.retry_backoff_seconds = float(os.getenv('VNSTOCK_RETRY_BACKOFF_SECONDS', 0.35))
            cfg.general_timeout_seconds = int(os.getenv('VNSTOCK_GENERAL_TIMEOUT_SECONDS', 8))
            cfg.intraday_timeout_seconds = int(os.getenv('VNSTOCK_INTRADAY_TIMEOUT_SECONDS', 8))
            cfg.price_board_timeout_seconds = int(os.getenv('VNSTOCK_PRICE_BOARD_TIMEOUT_SECONDS', 8))
            cfg.financial_ratio_timeout_seconds = int(os.getenv('VNSTOCK_FINANCIAL_RATIO_TIMEOUT_SECONDS', 10))
            cfg.history_timeout_seconds = int(os.getenv('VNSTOCK_HISTORY_TIMEOUT_SECONDS', 12))
            cfg.listing_timeout_seconds = int(os.getenv('VNSTOCK_LISTING_TIMEOUT_SECONDS', 12))
            cfg.rate_limit_cooldown_seconds = int(os.getenv('VNSTOCK_RATE_LIMIT_COOLDOWN_SECONDS', 20))
            cfg.price_board_source = os.getenv('VNSTOCK_PRICE_BOARD_SOURCE', 'VCI')
            cfg.price_board_fallback_sources = os.getenv('VNSTOCK_PRICE_BOARD_FALLBACK_SOURCES', 'KBS,VCI')
            cfg.updated_by = admin_user
            cfg.notes = 'Initialized from environment variables'
            cfg.save()
            
            self.stdout.write(self.style.SUCCESS(
                f'✅ VNStock runtime config initialized:\n'
                f'  - max_concurrency: {cfg.max_concurrency}\n'
                f'  - general_timeout: {cfg.general_timeout_seconds}s\n'
                f'  - rate_limit_cooldown: {cfg.rate_limit_cooldown_seconds}s\n'
                f'  - sources: {cfg.price_board_source} (+ {cfg.price_board_fallback_sources})\n'
            ))
        else:
            self.stdout.write(self.style.WARNING(
                f'⚠️  Config already exists. Use --reset to reinitialize from env vars.'
            ))
```

Run it:
```bash
python manage.py init_vnstock_runtime_config
```

---

## STEP 6: Test & Verify (2 giờ)

### 6.1 Test Admin UI

```bash
# Start Django
python manage.py runserver

# Go to admin
http://localhost:8000/admin/portfolio/runtimevnstockconfig/1/change/

# Try:
1. Change max_concurrency from 12 to 5
2. Save
3. Check logs: should see "Updating vnstock concurrency gate: 12 → 5"
4. Wait 5 min (cache TTL)
5. Make a vnstock call → should use new concurrency limit
```

### 6.2 Test Config Priority

```bash
# In .env, set VNSTOCK_MAX_CONCURRENCY=20

# In admin, set max_concurrency=5

# Make vnstock call → should use 20 (env var takes precedence)

# Remove env var

# Make vnstock call → should use 5 (DB config takes effect)
```

### 6.3 Test Caching

```python
# In Django shell:
from portfolio.models import RuntimeVnstockConfig
from portfolio.adapters import vnstock_adapter

cfg = RuntimeVnstockConfig.get_current()
cfg.max_concurrency = 8
cfg.save()

# Check logs within 5 seconds:
# Should show: "Updating vnstock concurrency gate"

# Check after 5 minutes:
# Cache expires, next call loads from DB
```

---

## STEP 7: Documentation (1 giờ)

Create or update docs about:

1. How admin users can change vnstock config
2. Which parameters affect what
3. When to increase timeouts (network latency)
4. When to increase concurrency (throughput)
5. Rate limit cooldown strategy

---

## FILES TO MODIFY SUMMARY

```
✅ Step 1: backend/portfolio/models.py
   └─ Add RuntimeVnstockConfig class (100 lines)

✅ Step 2: backend/portfolio/admin.py
   └─ Add RuntimeVnstockConfigAdmin class (100 lines)

✅ Step 3: backend/portfolio/adapters/vnstock_adapter.py
   ├─ Add _get_runtime_config() function
   ├─ Update _resolve_int_env()
   ├─ Update _resolve_float_env()
   ├─ Update _resolve_timeout()
   ├─ Make concurrency gate dynamic
   └─ Update _run_with_timeout()
   (≈150 lines changes)

✅ Step 4: Run migration
   └─ python manage.py makemigrations portfolio
   └─ python manage.py migrate portfolio

✅ Step 5: backend/portfolio/management/commands/init_vnstock_runtime_config.py
   └─ New file (80 lines)
```

---

## DEPLOYMENT CHECKLIST

- [ ] Code review: models.py + admin.py
- [ ] Code review: vnstock_adapter.py changes
- [ ] Staging test: Full deployment + config change via admin
- [ ] Performance test: Verify no cache overhead
- [ ] Docs: Update wiki/docs for ops team
- [ ] Production deployment:
  ```bash
  # 1. Deploy code
  git pull origin main
  
  # 2. Migrate
  python manage.py migrate portfolio
  
  # 3. Initialize config
  python manage.py init_vnstock_runtime_config
  
  # 4. Restart Django
  systemctl restart vnin_vest_django
  ```
- [ ] Verify config loads via Django admin

---

## POTENTIAL ISSUES & SOLUTIONS

| Issue | Solution |
|-------|----------|
| Config not loading from DB | Check Django shell: `RuntimeVnstockConfig.get_current()` |
| Admin change not taking effect | Execute: `cache.delete('vnstock_runtime_config_cache')` |
| Migration fails | Ensure app is in INSTALLED_APPS: `'portfolio'` |
| Concurrency gate not updating | Check logs for "Updating vnstock concurrency gate" message |
| Performance degrades | Increase cache TTL from 300s to 600s if DB queries slow |

---

**Status:** 📋 Implementation guide complete  
**Estimated Time:** 12 hours  
**Next Steps:** Start with Step 1 (models.py)
