# SPRINT 32: Code Templates & Boilerplate

**Auto-Generated:** 2026-04-12  
**Purpose:** Ready-to-use code snippets for implementation

---

## 1️⃣ Model Boilerplate

### `backend/portfolio/models.py`

```python
from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
import datetime

class RuntimeVnbrokerConfig(models.Model):
    """
    Singleton configuration for vnbroker adapter at runtime.
    One record (pk=1) is created once and updated thereafter.
    Supports zero-downtime configuration changes via admin UI + API.
    """
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ CONCURRENCY & RETRY CONFIGURATION                     ║
    # ╚════════════════════════════════════════════════════════╝
    max_concurrency = models.IntegerField(
        default=12,
        validators=[MinValueValidator(1), MaxValueValidator(50)],
        help_text="Maximum number of concurrent vnbroker API requests (1-50). "
        "Benchmark: 12 is stable throughput. Increase for higher volume, "
        "but risk hitting upstream rate limits."
    )
    retry_attempts = models.IntegerField(
        default=1,
        validators=[MinValueValidator(0), MaxValueValidator(5)],
        help_text="Number of retry attempts on transient failures (0-5). "
        "0=no retry, 5=aggressive retry (slower on failures)."
    )
    retry_backoff_seconds = models.FloatField(
        default=0.35,
        validators=[MinValueValidator(0.0), MaxValueValidator(5.0)],
        help_text="Backoff time in seconds between retry attempts (0.0-5.0). "
        "Example: 0.35 → 1st retry after 350ms, 2nd after 700ms, etc."
    )
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ RATE LIMIT DETECTION & GUARD                          ║
    # ╚════════════════════════════════════════════════════════╝
    rate_limit_cooldown_seconds = models.IntegerField(
        default=20,
        validators=[MinValueValidator(5), MaxValueValidator(120)],
        help_text="Cooldown period in seconds after detecting rate limit 429 (5-120). "
        "Adapter skips queries during this window. Works with prefetch multiplier."
    )
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ TIMEOUT CONFIGURATION PER CHANNEL (JSON)              ║
    # ╚════════════════════════════════════════════════════════╝
    timeout_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Timeout in seconds per vnbroker function channel. "
        "Format: {\"price_board\": 8, \"intraday\": 8, \"financial_ratio\": 10, "
        "\"history\": 12, \"listing\": 12, \"general\": 8}. "
        "All values positive integers."
    )
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ PRICE BOARD SOURCE & FALLBACKS                        ║
    # ╚════════════════════════════════════════════════════════╝
    price_board_source = models.CharField(
        max_length=50,
        default="price_board",
        choices=[
            ("price_board", "VNBroker Price Board (VCI source)"),
            ("stock_intraday_data", "Stock Intraday Data (KBS source)"),
        ],
        help_text="Primary data source for price board. "
        "price_board=VCI (most detailed), stock_intraday_data=KBS (fallback)."
    )
    fallback_sources = models.JSONField(
        default=list,
        blank=True,
        help_text="List of fallback sources if primary fails. "
        "Example: [\"stock_intraday_data\"]. Fallback tried on 429, timeout, etc."
    )
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ FEATURE TOGGLES                                       ║
    # ╚════════════════════════════════════════════════════════╝
    enable_caching = models.BooleanField(
        default=True,
        help_text="Enable Redis caching of vnbroker results. "
        "Disable for debugging or if Redis is overloaded."
    )
    enable_rate_limit_detection = models.BooleanField(
        default=True,
        help_text="Enable automatic 429 rate limit detection. "
        "Disable to ignore rate limits (risky)."
    )
    enable_concurrent_limit = models.BooleanField(
        default=True,
        help_text="Enable concurrency limiting via BoundedSemaphore. "
        "Disable to allow unlimited concurrent requests (not recommended)."
    )
    
    # ╔════════════════════════════════════════════════════════╗
    # ║ AUDIT & METADATA                                      ║
    # ╚════════════════════════════════════════════════════════╝
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        User,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        help_text="User who made the last configuration change."
    )
    changelog = models.JSONField(
        default=list,
        blank=True,
        help_text="Audit log of all configuration changes. "
        "Format: [{timestamp, user, changes: {field: {old, new}}}, ...]"
    )
    
    class Meta:
        verbose_name = "Vnbroker Runtime Configuration"
        verbose_name_plural = "Vnbroker Runtime Configuration"
    
    def __str__(self):
        return f"Vnbroker Config (updated by {self.updated_by or 'system'} at {self.updated_at})"
    
    @classmethod
    def get_or_create_singleton(cls):
        """Get or create the singleton configuration record (pk=1)."""
        obj, created = cls.objects.get_or_create(pk=1)
        if created:
            # Initialize with defaults
            obj.timeout_config = {
                "price_board": 8,
                "intraday": 8,
                "financial_ratio": 10,
                "history": 12,
                "listing": 12,
                "general": 8,
            }
            obj.fallback_sources = ["stock_intraday_data"]
            obj.save()
            logger.info("RuntimeVnbrokerConfig singleton created with defaults")
        return obj
    
    def record_change(self, user, changes: dict):
        """Record a configuration change in the changelog."""
        entry = {
            "timestamp": str(datetime.datetime.now(datetime.timezone.utc)),
            "user": user.username if user else "system",
            "changes": changes
        }
        if not isinstance(self.changelog, list):
            self.changelog = []
        self.changelog.append(entry)
        self.updated_by = user
        self.save()
        logger.info(f"Config changed by {user}: {changes}")
    
    def to_dict(self):
        """Export configuration as JSON-serializable dict."""
        return {
            'max_concurrency': self.max_concurrency,
            'retry_attempts': self.retry_attempts,
            'retry_backoff_seconds': self.retry_backoff_seconds,
            'rate_limit_cooldown_seconds': self.rate_limit_cooldown_seconds,
            'timeout_config': self.timeout_config or {},
            'price_board_source': self.price_board_source,
            'fallback_sources': self.fallback_sources or [],
            'enable_caching': self.enable_caching,
            'enable_rate_limit_detection': self.enable_rate_limit_detection,
            'enable_concurrent_limit': self.enable_concurrent_limit,
            'updated_at': self.updated_at.isoformat(),
            'updated_by': self.updated_by.username if self.updated_by else None,
        }
```

---

## 2️⃣ Serializer Template

### `backend/portfolio/serializers.py` - Add

```python
from rest_framework import serializers
from portfolio.models import RuntimeVnbrokerConfig

class RuntimeVnbrokerConfigSerializer(serializers.ModelSerializer):
    """
    Serializer for RuntimeVnbrokerConfig with validation.
    """
    updated_by_username = serializers.CharField(
        source='updated_by.username',
        read_only=True,
        help_text="Username of person who made last change"
    )
    
    class Meta:
        model = RuntimeVnbrokerConfig
        fields = [
            'max_concurrency',
            'retry_attempts',
            'retry_backoff_seconds',
            'rate_limit_cooldown_seconds',
            'timeout_config',
            'price_board_source',
            'fallback_sources',
            'enable_caching',
            'enable_rate_limit_detection',
            'enable_concurrent_limit',
            'updated_at',
            'updated_by_username',
            'changelog',
        ]
        read_only_fields = ['updated_at', 'updated_by_username', 'changelog']
    
    def validate_max_concurrency(self, value):
        """Validate max_concurrency is in allowed range."""
        if not (1 <= value <= 50):
            raise serializers.ValidationError(
                f"max_concurrency must be between 1 and 50, got {value}"
            )
        return value
    
    def validate_retry_attempts(self, value):
        """Validate retry_attempts is in allowed range."""
        if not (0 <= value <= 5):
            raise serializers.ValidationError(
                f"retry_attempts must be between 0 and 5, got {value}"
            )
        return value
    
    def validate_rate_limit_cooldown_seconds(self, value):
        """Validate cooldown is in allowed range."""
        if not (5 <= value <= 120):
            raise serializers.ValidationError(
                f"rate_limit_cooldown_seconds must be between 5 and 120, got {value}"
            )
        return value
    
    def validate_timeout_config(self, value):
        """Validate timeout_config is dict with positive numeric values."""
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                f"timeout_config must be a JSON object, got {type(value).__name__}"
            )
        for key, val in value.items():
            if not isinstance(val, (int, float)):
                raise serializers.ValidationError(
                    f"timeout_config['{key}'] must be a number, got {type(val).__name__}"
                )
            if val < 0:
                raise serializers.ValidationError(
                    f"timeout_config['{key}'] must be positive, got {val}"
                )
        return value
    
    def validate_fallback_sources(self, value):
        """Validate fallback_sources is list of valid source names."""
        if not isinstance(value, list):
            raise serializers.ValidationError(
                f"fallback_sources must be a list, got {type(value).__name__}"
            )
        valid_sources = {"price_board", "stock_intraday_data"}
        for source in value:
            if source not in valid_sources:
                raise serializers.ValidationError(
                    f"Invalid source '{source}'. Must be one of: {valid_sources}"
                )
        return value
```

---

## 3️⃣ ViewSet Template

### `backend/portfolio/views.py` - Add

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from portfolio.models import RuntimeVnbrokerConfig
from portfolio.serializers import RuntimeVnbrokerConfigSerializer

class RuntimeVnbrokerConfigViewSet(viewsets.ViewSet):
    """
    API ViewSet for managing runtime vnbroker configuration.
    
    Endpoints:
      GET    /current/              - Get current configuration
      PATCH  /update_config/        - Update configuration (partial)
      POST   /reset_to_defaults/    - Reset to default values
      GET    /changelog/            - Get audit changelog
    """
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current vnbroker configuration."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        serializer = RuntimeVnbrokerConfigSerializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_config(self, request):
        """Update vnbroker configuration (partial update allowed)."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        serializer = RuntimeVnbrokerConfigSerializer(
            config,
            data=request.data,
            partial=True
        )
        
        if serializer.is_valid():
            # Track changes for changelog
            changes = {}
            for field in request.data.keys():
                old_val = getattr(config, field)
                new_val = request.data[field]
                if old_val != new_val:
                    changes[field] = {
                        'old': str(old_val),
                        'new': str(new_val)
                    }
            
            # Save changes
            config = serializer.save()
            
            # Record in changelog
            if changes:
                config.record_change(request.user, changes)
            
            return Response({
                'status': 'success',
                'message': 'Vnbroker configuration updated successfully',
                'config': RuntimeVnbrokerConfigSerializer(config).data
            }, status=status.HTTP_200_OK)
        
        return Response({
            'status': 'error',
            'message': 'Validation failed',
            'errors': serializer.errors
        }, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def changelog(self, request):
        """Get audit changelog of all configuration changes."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        return Response({
            'status': 'success',
            'changelog': config.changelog or [],
            'total_changes': len(config.changelog or [])
        })
    
    @action(detail=False, methods=['post'])
    def reset_to_defaults(self, request):
        """Reset configuration to default values."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        
        # Save old values for changelog
        old_config = config.to_dict()
        
        # Reset to defaults
        config.max_concurrency = 12
        config.retry_attempts = 1
        config.retry_backoff_seconds = 0.35
        config.rate_limit_cooldown_seconds = 20
        config.timeout_config = {
            "price_board": 8, "intraday": 8, "financial_ratio": 10,
            "history": 12, "listing": 12, "general": 8,
        }
        config.price_board_source = "price_board"
        config.fallback_sources = ["stock_intraday_data"]
        config.enable_caching = True
        config.enable_rate_limit_detection = True
        config.enable_concurrent_limit = True
        
        # Record reset in changelog
        config.record_change(request.user, {
            'action': 'reset_to_defaults',
            'old_values': old_config
        })
        
        return Response({
            'status': 'success',
            'message': 'Configuration reset to defaults',
            'config': RuntimeVnbrokerConfigSerializer(config).data
        })
```

---

## 4️⃣ Signal Handler Template

### `backend/portfolio/models.py` - Add after RuntimeVnbrokerConfig

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=RuntimeVnbrokerConfig)
def invalidate_vnbroker_config_cache(sender, instance, created, **kwargs):
    """
    Signal handler: Invalidate vnbroker adapter cache when configuration changes.
    
    Flow:
      1. Admin updates config via API/admin
      2. Django saves to DB
      3. Signal fires
      4. Clear Redis cache
      5. Adapter reloads config on next use
    """
    if created:
        # Skip on initial creation
        return
    
    try:
        # Import here to avoid circular imports
        from portfolio.adapters.vnbroker_adapter import (
            VnbrokerConfigManager,
            _initialize_adapter
        )
        
        # Clear cache
        VnbrokerConfigManager.invalidate_cache()
        logger.info(f"Vnbroker config cache invalidated")
        
        # Reinitialize adapter with new settings
        _initialize_adapter()
        logger.info(
            f"Vnbroker adapter reinitialized. "
            f"Changed by: {instance.updated_by or 'system'}"
        )
    except Exception as e:
        logger.error(f"Failed to invalidate vnbroker cache: {e}")
        # Don't raise - let config save succeed even if cache clear fails
```

---

## 5️⃣ Migration Template

### `backend/portfolio/migrations/000X_add_runtimevnbrokerconfig.py`

```python
from django.db import migrations, models
from django.contrib.auth.models import User

def create_default_config(apps, schema_editor):
    """Create default singleton config on migration."""
    RuntimeVnbrokerConfig = apps.get_model('portfolio', 'RuntimeVnbrokerConfig')
    RuntimeVnbrokerConfig.objects.get_or_create(
        pk=1,
        defaults={
            'max_concurrency': 12,
            'retry_attempts': 1,
            'retry_backoff_seconds': 0.35,
            'rate_limit_cooldown_seconds': 20,
            'timeout_config': {
                'price_board': 8, 'intraday': 8, 'financial_ratio': 10,
                'history': 12, 'listing': 12, 'general': 8,
            },
            'price_board_source': 'price_board',
            'fallback_sources': ['stock_intraday_data'],
            'enable_caching': True,
            'enable_rate_limit_detection': True,
            'enable_concurrent_limit': True,
        }
    )

class Migration(migrations.Migration):
    dependencies = [
        ('portfolio', '000X_previous_migration'),
    ]

    operations = [
        migrations.CreateModel(
            name='RuntimeVnbrokerConfig',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('max_concurrency', models.IntegerField(default=12, help_text='Max concurrent requests (1-50)')),
                ('retry_attempts', models.IntegerField(default=1, help_text='Retry attempts (0-5)')),
                ('retry_backoff_seconds', models.FloatField(default=0.35, help_text='Backoff seconds (0.0-5.0)')),
                ('rate_limit_cooldown_seconds', models.IntegerField(default=20, help_text='Cooldown seconds (5-120)')),
                ('timeout_config', models.JSONField(default=dict, blank=True, help_text='Timeout per channel (JSON)')),
                ('price_board_source', models.CharField(choices=[('price_board', 'VNBroker Price Board (VCI)'), ('stock_intraday_data', 'Stock Intraday (KBS)')], default='price_board', max_length=50)),
                ('fallback_sources', models.JSONField(default=list, blank=True, help_text='Fallback sources (list)')),
                ('enable_caching', models.BooleanField(default=True)),
                ('enable_rate_limit_detection', models.BooleanField(default=True)),
                ('enable_concurrent_limit', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('changelog', models.JSONField(default=list, blank=True)),
                ('updated_by', models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, to='auth.user')),
            ],
            options={'verbose_name': 'Vnbroker Runtime Configuration', 'verbose_name_plural': 'Vnbroker Runtime Configuration'},
        ),
        migrations.RunPython(create_default_config),
    ]
```

---

## 6️⃣ Unit Test Template

### `backend/portfolio/tests/test_runtime_vnbroker_config.py`

```python
from django.test import TestCase
from django.contrib.auth.models import User
from rest_framework.test import APITestCase
from rest_framework import status
from portfolio.models import RuntimeVnbrokerConfig
from portfolio.serializers import RuntimeVnbrokerConfigSerializer

class RuntimeVnbrokerConfigModelTests(TestCase):
    def setUp(self):
        self.config = RuntimeVnbrokerConfig.get_or_create_singleton()
    
    def test_singleton_pattern(self):
        """Only one config record (pk=1) exists."""
        self.assertEqual(RuntimeVnbrokerConfig.objects.count(), 1)
        self.assertEqual(self.config.pk, 1)
    
    def test_record_change_appends_to_changelog(self):
        """record_change() appends entry to changelog."""
        user = User.objects.create_user('testuser', password='test')
        self.config.record_change(user, {'test_field': {'old': 'a', 'new': 'b'}})
        
        self.assertEqual(len(self.config.changelog), 1)
        entry = self.config.changelog[0]
        self.assertEqual(entry['user'], 'testuser')
        self.assertEqual(entry['changes']['test_field']['old'], 'a')

class RuntimeVnbrokerConfigSerializerTests(TestCase):
    def setUp(self):
        self.config = RuntimeVnbrokerConfig.get_or_create_singleton()
    
    def test_serialize_valid(self):
        """Serializer outputs all fields correctly."""
        serializer = RuntimeVnbrokerConfigSerializer(self.config)
        data = serializer.data
        
        self.assertEqual(data['max_concurrency'], 12)
        self.assertEqual(data['retry_attempts'], 1)
    
    def test_validate_max_concurrency_range(self):
        """Serializer rejects invalid max_concurrency."""
        serializer = RuntimeVnbrokerConfigSerializer(
            self.config,
            data={'max_concurrency': 100},
            partial=True
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('max_concurrency', serializer.errors)
    
    def test_validate_timeout_config_numeric(self):
        """Serializer rejects non-numeric timeout values."""
        serializer = RuntimeVnbrokerConfigSerializer(
            self.config,
            data={'timeout_config': {'price_board': 'invalid'}},
            partial=True
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn('timeout_config', serializer.errors)

class RuntimeVnbrokerConfigAPITests(APITestCase):
    def setUp(self):
        self.admin_user = User.objects.create_superuser('admin', 'admin@test.com', 'admin')
        self.client.force_authenticate(user=self.admin_user)
    
    def test_get_current_config(self):
        """GET /api/admin-ops/vnbroker-config/current/ returns config."""
        response = self.client.get('/api/admin-ops/vnbroker-config/current/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['max_concurrency'], 12)
    
    def test_patch_update_config(self):
        """PATCH /api/admin-ops/vnbroker-config/update_config/ updates config."""
        data = {'max_concurrency': 20}
        response = self.client.patch(
            '/api/admin-ops/vnbroker-config/update_config/',
            data
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['config']['max_concurrency'], 20)
    
    def test_post_reset_to_defaults(self):
        """POST /api/admin-ops/vnbroker-config/reset_to_defaults/ resets."""
        # First change something
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        config.max_concurrency = 30
        config.save()
        
        # Then reset
        response = self.client.post(
            '/api/admin-ops/vnbroker-config/reset_to_defaults/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['config']['max_concurrency'], 12)
```

---

**Usage:** Copy these templates into respective files, follow naming conventions, and run tests to verify.

