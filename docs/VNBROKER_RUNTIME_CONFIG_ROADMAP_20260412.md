# 🛠️ Kế Hoạch Cấu Hình Vnbroker Runtime - AdminOps

**Status:** READY TO IMPLEMENT  
**Timeline:** 8-10 giờ (3 phase)  
**Priority:** HIGH (Giảm downtime, tăng operational flexibility)

---

## 📌 Mục Tiêu

Thêm **tab "Vnbroker Config"** vào AdminOps để:
- ✅ Thay đổi cấu hình vnbroker **mà không cần restart** hệ thống
- ✅ Cấu hình các channel khác nhau (price_board, intraday, financial_ratio, etc.)
- ✅ Quản lý rate limit, timeout, concurrency, retry policy
- ✅ Có audit trail (ai thay đổi gì, khi nào)
- ✅ Quick apply mà không cần reload container

---

## 🎯 Phase 1: Database Model & Backend API (3 giờ)

### 1.1 Tạo Model `RuntimeVnbrokerConfig`

**File:** `backend/portfolio/models.py`

```python
from django.db import models
from django.contrib.auth.models import User
import json

class RuntimeVnbrokerConfig(models.Model):
    """
    Lưu runtime configuration cho vnbroker adapter.
    Một record duy nhất, cập nhật mỗi khi có thay đổi.
    """
    
    # === CONCURRENCY & RETRY ===
    max_concurrency = models.IntegerField(
        default=12,
        help_text="Max concurrent vnbroker requests (1-50)"
    )
    retry_attempts = models.IntegerField(
        default=1,
        help_text="Number of retry attempts on failure (0-5)"
    )
    retry_backoff_seconds = models.FloatField(
        default=0.35,
        help_text="Backoff time between retries in seconds (0.0-5.0)"
    )
    
    # === RATE LIMIT ===
    rate_limit_cooldown_seconds = models.IntegerField(
        default=20,
        help_text="Cooldown after detecting rate limit (5-120 seconds)"
    )
    
    # === TIMEOUT PER CHANNEL ===
    # JSON field: {"price_board": 8, "intraday": 8, "financial_ratio": 10, ...}
    timeout_config = models.JSONField(
        default=dict,
        help_text="Timeout per channel in seconds"
    )
    
    # === PRICE BOARD SOURCE ===
    price_board_source = models.CharField(
        max_length=50,
        default="price_board",
        choices=[
            ("price_board", "VNBroker Price Board (VCI)"),
            ("stock_intraday_data", "Stock Intraday (KBS)"),
        ],
        help_text="Primary source for price board"
    )
    fallback_sources = models.JSONField(
        default=list,
        help_text='Fallback sources, e.g. ["stock_intraday_data"]'
    )
    
    # === ENABLE/DISABLE ===
    enable_caching = models.BooleanField(
        default=True,
        help_text="Enable vnbroker result caching in Redis"
    )
    enable_rate_limit_detection = models.BooleanField(
        default=True,
        help_text="Enable automatic rate limit detection & cooldown"
    )
    enable_concurrent_limit = models.BooleanField(
        default=True,
        help_text="Enable concurrency limit via BoundedSemaphore"
    )
    
    # === AUDIT ===
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(User, null=True, blank=True, on_delete=models.SET_NULL)
    
    # === CHANGELOG ===
    changelog = models.JSONField(
        default=list,  # [{timestamp, user, field, old_value, new_value}, ...]
        help_text="Audit trail of all changes"
    )
    
    class Meta:
        verbose_name = "Vnbroker Runtime Configuration"
        verbose_name_plural = "Vnbroker Runtime Configuration"
    
    @classmethod
    def get_or_create_singleton(cls):
        """Get or create the singleton config record."""
        obj, created = cls.objects.get_or_create(pk=1)
        if created:
            obj.timeout_config = {
                "price_board": 8,
                "intraday": 8,
                "financial_ratio": 10,
                "history": 12,
                "listing": 12,
                "general": 8,
            }
            obj.save()
        return obj
    
    def record_change(self, user, changes: dict):
        """Record a configuration change in changelog."""
        entry = {
            "timestamp": str(datetime.datetime.now()),
            "user": user.username if user else "system",
            "changes": changes
        }
        if not isinstance(self.changelog, list):
            self.changelog = []
        self.changelog.append(entry)
        self.updated_by = user
        self.save()
    
    def to_dict(self):
        """Return configuration as dict."""
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

### 1.2 Tạo Django Admin Interface

**File:** `backend/portfolio/admin.py` (thêm vào)

```python
from django.contrib import admin
from django.utils.html import format_html
from .models import RuntimeVnbrokerConfig

@admin.register(RuntimeVnbrokerConfig)
class RuntimeVnbrokerConfigAdmin(admin.ModelAdmin):
    fieldsets = (
        ('Concurrency & Retry', {
            'fields': ('max_concurrency', 'retry_attempts', 'retry_backoff_seconds')
        }),
        ('Rate Limiting', {
            'fields': ('rate_limit_cooldown_seconds', 'enable_rate_limit_detection')
        }),
        ('Timeout Configuration', {
            'fields': ('timeout_config',),
            'classes': ('wide',),
            'description': 'JSON format: {"price_board": 8, "intraday": 8, "financial_ratio": 10, ...}'
        }),
        ('Price Board Source', {
            'fields': ('price_board_source', 'fallback_sources'),
            'description': 'Primary and fallback data sources'
        }),
        ('Feature Toggles', {
            'fields': ('enable_caching', 'enable_concurrent_limit')
        }),
        ('Audit Info', {
            'fields': ('updated_at', 'updated_by'),
            'classes': ('collapse',),
            'description': 'Read-only audit information'
        }),
    )
    
    readonly_fields = ('updated_at', 'updated_by', 'changelog')
    
    def has_delete_permission(self, request, obj=None):
        return False  # Prevent deletion of singleton config
    
    def save_model(self, request, obj, form, change):
        """Track changes in changelog."""
        if change:  # Update, not create
            old_obj = RuntimeVnbrokerConfig.objects.get(pk=obj.pk)
            changes = {}
            for field in form.changed_data:
                old_val = getattr(old_obj, field)
                new_val = getattr(obj, field)
                if old_val != new_val:
                    changes[field] = {
                        'old': str(old_val),
                        'new': str(new_val)
                    }
            if changes:
                obj.record_change(request.user, changes)
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
```

---

### 1.3 Tạo Serializer (DRF)

**File:** `backend/portfolio/serializers.py` (thêm vào)

```python
from rest_framework import serializers
from .models import RuntimeVnbrokerConfig

class RuntimeVnbrokerConfigSerializer(serializers.ModelSerializer):
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)
    
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
    
    def validate_max_concurrency(self, value):
        if not (1 <= value <= 50):
            raise serializers.ValidationError("max_concurrency must be between 1 and 50")
        return value
    
    def validate_rate_limit_cooldown_seconds(self, value):
        if not (5 <= value <= 120):
            raise serializers.ValidationError("cooldown must be between 5 and 120 seconds")
        return value
    
    def validate_timeout_config(self, value):
        """Ensure all timeout values are positive."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("timeout_config must be a JSON object")
        for key, val in value.items():
            if not isinstance(val, (int, float)) or val < 0:
                raise serializers.ValidationError(f"timeout for '{key}' must be positive number")
        return value
```

---

### 1.4 Tạo Viewset API

**File:** `backend/portfolio/views.py` (hoặc `admin_ops/views.py`)

```python
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from .models import RuntimeVnbrokerConfig
from .serializers import RuntimeVnbrokerConfigSerializer

class RuntimeVnbrokerConfigViewSet(viewsets.ViewSet):
    """API untuk mengelola runtime vnbroker configuration."""
    permission_classes = [IsAdminUser]
    
    @action(detail=False, methods=['get'])
    def current(self, request):
        """Get current configuration."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        serializer = RuntimeVnbrokerConfigSerializer(config)
        return Response(serializer.data)
    
    @action(detail=False, methods=['patch'])
    def update_config(self, request):
        """Update configuration (partial update allowed)."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        serializer = RuntimeVnbrokerConfigSerializer(config, data=request.data, partial=True)
        
        if serializer.is_valid():
            # Track changed fields
            changes = {}
            for field in request.data.keys():
                old_val = getattr(config, field)
                new_val = request.data[field]
                if old_val != new_val:
                    changes[field] = {
                        'old': str(old_val),
                        'new': str(new_val)
                    }
            
            config = serializer.save()
            if changes:
                config.record_change(request.user, changes)
            
            return Response({
                'status': 'success',
                'message': 'Vnbroker configuration updated',
                'config': RuntimeVnbrokerConfigSerializer(config).data
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    @action(detail=False, methods=['get'])
    def changelog(self, request):
        """Get full changelog."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        return Response({
            'changelog': config.changelog,
            'total_changes': len(config.changelog or [])
        })
    
    @action(detail=False, methods=['post'])
    def reset_to_defaults(self, request):
        """Reset configuration to defaults."""
        config = RuntimeVnbrokerConfig.get_or_create_singleton()
        old_config = config.to_dict()
        
        config.max_concurrency = 12
        config.retry_attempts = 1
        config.retry_backoff_seconds = 0.35
        config.rate_limit_cooldown_seconds = 20
        config.timeout_config = {
            "price_board": 8,
            "intraday": 8,
            "financial_ratio": 10,
            "history": 12,
            "listing": 12,
            "general": 8,
        }
        config.price_board_source = "price_board"
        config.fallback_sources = ["stock_intraday_data"]
        config.enable_caching = True
        config.enable_rate_limit_detection = True
        config.enable_concurrent_limit = True
        
        changes = {'action': 'reset_to_defaults'}
        config.record_change(request.user, changes)
        config.save()
        
        return Response({
            'status': 'success',
            'message': 'Configuration reset to defaults',
            'config': RuntimeVnbrokerConfigSerializer(config).data
        })
```

---

### 1.5 Cập nhật URL routing

**File:** `backend/config/urls.py`

```python
from rest_framework.routers import DefaultRouter
from portfolio.views import RuntimeVnbrokerConfigViewSet

router = DefaultRouter()
router.register(r'admin-ops/vnbroker-config', RuntimeVnbrokerConfigViewSet, basename='vnbroker-config')

urlpatterns = [
    # ... existing patterns ...
    path('api/', include(router.urls)),
]
```

---

### 1.6 Migration

```bash
python manage.py makemigrations portfolio
python manage.py migrate portfolio
python manage.py shell
>>> from portfolio.models import RuntimeVnbrokerConfig
>>> RuntimeVnbrokerConfig.get_or_create_singleton()
```

---

## 🎯 Phase 2: Update vnbroker_adapter để Support Runtime Config (2.5 giờ)

### 2.1 Cache Configuration dalam Memory

**File:** `backend/portfolio/adapters/vnbroker_adapter.py` (cập nhật)

```python
import redis
import json
from django.core.cache import cache as django_cache

# Cache for runtime config (live for 5 minutes)
_CONFIG_CACHE_KEY = "vnbroker:runtime:config"
_CONFIG_CACHE_TIMEOUT = 300  # 5 minutes

class VnbrokerConfigManager:
    """Manage runtime vnbroker configuration with caching."""
    
    @staticmethod
    def get_current_config():
        """Get current configuration from DB cache layer."""
        # Check in-memory cache first (300s)
        cached = django_cache.get(_CONFIG_CACHE_KEY)
        if cached:
            return cached
        
        # Load from DB if cache miss
        try:
            from portfolio.models import RuntimeVnbrokerConfig
            config = RuntimeVnbrokerConfig.get_or_create_singleton()
            config_dict = config.to_dict()
            
            # Cache for 5 minutes
            django_cache.set(_CONFIG_CACHE_KEY, config_dict, _CONFIG_CACHE_TIMEOUT)
            return config_dict
        except Exception as e:
            logger.error(f"Failed to load runtime config: {e}")
            return _get_default_config()
    
    @staticmethod
    def invalidate_cache():
        """Invalidate config cache (called after update)."""
        django_cache.delete(_CONFIG_CACHE_KEY)

def _get_default_config():
    """Return default configuration."""
    return {
        'max_concurrency': 12,
        'retry_attempts': 1,
        'retry_backoff_seconds': 0.35,
        'rate_limit_cooldown_seconds': 20,
        'timeout_config': {
            "price_board": 8,
            "intraday": 8,
            "financial_ratio": 10,
            "history": 12,
            "listing": 12,
            "general": 8,
        },
        'enable_caching': True,
        'enable_rate_limit_detection': True,
        'enable_concurrent_limit': True,
    }

# Initialize with runtime config
def _initialize_adapter():
    global _VNBROKER_MAX_CONCURRENCY, _VNBROKER_RETRY_ATTEMPTS, _VNBROKER_RETRY_BACKOFF_SECONDS
    
    config = VnbrokerConfigManager.get_current_config()
    _VNBROKER_MAX_CONCURRENCY = config.get('max_concurrency', 12)
    _VNBROKER_RETRY_ATTEMPTS = config.get('retry_attempts', 1)
    _VNBROKER_RETRY_BACKOFF_SECONDS = config.get('retry_backoff_seconds', 0.35)
    
    # Refresh semaphore
    global _VNBROKER_GATE
    _VNBROKER_GATE = threading.BoundedSemaphore(value=_VNBROKER_MAX_CONCURRENCY)

_initialize_adapter()
```

### 2.2 Lazy Load per Request

```python
def _get_timeout(channel: str) -> int:
    """Get timeout for channel from runtime config."""
    config = VnbrokerConfigManager.get_current_config()
    timeout_config = config.get('timeout_config', {})
    return timeout_config.get(channel, timeout_config.get('general', 8))

def _should_use_cache() -> bool:
    """Check if caching is enabled."""
    config = VnbrokerConfigManager.get_current_config()
    return config.get('enable_caching', True)

def _should_detect_rate_limit() -> bool:
    """Check if rate limit detection is enabled."""
    config = VnbrokerConfigManager.get_current_config()
    return config.get('enable_rate_limit_detection', True)
```

### 2.3 Cập nhật Signal Handler

```python
from django.db.models.signals import post_save
from django.dispatch import receiver

@receiver(post_save, sender=RuntimeVnbrokerConfig)
def invalidate_vnbroker_config_cache(sender, instance, created, **kwargs):
    """Invalidate adapter cache when config changes."""
    if not created:  # Only on update
        from portfolio.adapters.vnbroker_adapter import (
            VnbrokerConfigManager,
            _initialize_adapter
        )
        VnbrokerConfigManager.invalidate_cache()
        _initialize_adapter()
        logger.info(f"Vnbroker adapter reloaded. Updated by: {instance.updated_by}")
```

---

## 🎯 Phase 3: Frontend UI - AdminOps Vnbroker Tab (2.5 giờ)

### 3.1 Thêm Tab mới vào AdminOps

**File:** `frontend/src/pages/AdminOps.jsx`

```jsx
import { useState, useEffect } from 'react';
import { getAdminOpsAPI } from '../api/admin-ops';

export default function AdminOps() {
  const [activePage, setActivePage] = useState('overview');
  
  // === TAB TITLES ===
  const tabs = [
    { key: 'overview', label: 'Tổng quan' },
    { key: 'whale', label: 'Whale Ops' },
    { key: 'governance', label: 'Governance' },
    { key: 'prefetch', label: 'Prefetch' },
    { key: 'kpi', label: 'Runtime KPI' },
    { key: 'vnbroker', label: '⚙️ Vnbroker Config' },  // NEW TAB
  ];
  
  // === TAB STYLES ===
  const pageBtnClass = (key) => (
    `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      activePage === key 
        ? 'bg-blue-600 text-white shadow-lg' 
        : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
    }`
  );
  
  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 p-4 bg-gray-100 rounded-lg">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActivePage(tab.key)}
            className={pageBtnClass(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="bg-white rounded-lg shadow p-6 min-h-96">
        {activePage === 'vnbroker' && <VnbrokerConfigPanel />}
        {/* ... other tabs ... */}
      </div>
    </div>
  );
}
```

### 3.2 Tạo VnbrokerConfigPanel Component

**File:** `frontend/src/components/AdminOps/VnbrokerConfigPanel.jsx`

```jsx
import { useState, useEffect } from 'react';
import { getAdminOpsAPI } from '../../api/admin-ops';

export default function VnbrokerConfigPanel() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [changelog, setChangelog] = useState([]);
  const [showChangelog, setShowChangelog] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    max_concurrency: 12,
    retry_attempts: 1,
    retry_backoff_seconds: 0.35,
    rate_limit_cooldown_seconds: 20,
    enable_caching: true,
    enable_rate_limit_detection: true,
    enable_concurrent_limit: true,
    price_board_source: 'price_board',
    timeout_config: {},
  });
  
  // Load config
  useEffect(() => {
    loadConfig();
  }, []);
  
  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin-ops/vnbroker-config/current/');
      const data = await response.json();
      setConfig(data);
      setFormData(data);
      
      // Load changelog
      const changelogRes = await fetch('/api/admin-ops/vnbroker-config/changelog/');
      const changelogData = await changelogRes.json();
      setChangelog(changelogData.changelog || []);
    } catch (err) {
      setError(`Lỗi tải config: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };
  
  const handleTimeoutChange = (channel, value) => {
    setFormData(prev => ({
      ...prev,
      timeout_config: {
        ...prev.timeout_config,
        [channel]: parseInt(value) || 8
      }
    }));
  };
  
  const handleSave = async () => {
    try {
      setSaving(true);
      const response = await fetch(
        '/api/admin-ops/vnbroker-config/update_config/',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        }
      );
      
      if (!response.ok) throw new Error('Failed to save config');
      
      const result = await response.json();
      setConfig(result.config);
      setError('');
      alert('✅ Config updated successfully!');
      
      // Reload changelog
      const changelogRes = await fetch('/api/admin-ops/vnbroker-config/changelog/');
      const changelogData = await changelogRes.json();
      setChangelog(changelogData.changelog || []);
    } catch (err) {
      setError(`Lỗi lưu: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = async () => {
    if (!window.confirm('Bạn có chắc muốn reset về giá trị mặc định?')) return;
    
    try {
      setSaving(true);
      const response = await fetch(
        '/api/admin-ops/vnbroker-config/reset_to_defaults/',
        { method: 'POST' }
      );
      const result = await response.json();
      setConfig(result.config);
      setFormData(result.config);
      alert('✅ Configuration reset to defaults');
      loadConfig();
    } catch (err) {
      setError(`Lỗi: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) return <div className="text-center py-8">Đang tải...</div>;
  
  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-lg">{error}</div>
      )}
      
      {/* Concurrency & Retry */}
      <section>
        <h3 className="text-lg font-semibold mb-4">⚡ Concurrency & Retry</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Max Concurrency</label>
            <input
              type="number"
              min="1"
              max="50"
              value={formData.max_concurrency}
              onChange={(e) => handleChange('max_concurrency', parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Default: 12 (adjust để tối ưu)</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Retry Attempts</label>
            <input
              type="number"
              min="0"
              max="5"
              value={formData.retry_attempts}
              onChange={(e) => handleChange('retry_attempts', parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Retry Backoff (s)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              value={formData.retry_backoff_seconds}
              onChange={(e) => handleChange('retry_backoff_seconds', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </section>
      
      {/* Rate Limiting */}
      <section>
        <h3 className="text-lg font-semibold mb-4">🚦 Rate Limiting</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-2">
              Cooldown After Rate Limit (seconds)
            </label>
            <input
              type="number"
              min="5"
              max="120"
              value={formData.rate_limit_cooldown_seconds}
              onChange={(e) => handleChange('rate_limit_cooldown_seconds', parseInt(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enable_rate_limit_detection}
                onChange={(e) => handleChange('enable_rate_limit_detection', e.target.checked)}
              />
              <span>Enable automatic rate limit detection</span>
            </label>
          </div>
        </div>
      </section>
      
      {/* Timeout per Channel */}
      <section>
        <h3 className="text-lg font-semibold mb-4">⏱️ Timeout per Channel</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(formData.timeout_config || {}).map(([channel, timeout]) => (
            <div key={channel}>
              <label className="block text-sm font-medium mb-1">
                {channel.replace(/_/g, ' ').toUpperCase()}
              </label>
              <input
                type="number"
                min="1"
                max="60"
                value={timeout}
                onChange={(e) => handleTimeoutChange(channel, e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              />
              <p className="text-xs text-gray-500 mt-1">seconds</p>
            </div>
          ))}
        </div>
      </section>
      
      {/* Feature Toggles */}
      <section>
        <h3 className="text-lg font-semibold mb-4">🎛️ Feature Toggles</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enable_caching}
              onChange={(e) => handleChange('enable_caching', e.target.checked)}
            />
            <span>Enable Redis caching</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={formData.enable_concurrent_limit}
              onChange={(e) => handleChange('enable_concurrent_limit', e.target.checked)}
            />
            <span>Enable concurrency limit</span>
          </label>
        </div>
      </section>
      
      {/* Changelog */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">📋 Changelog</h3>
          <button
            onClick={() => setShowChangelog(!showChangelog)}
            className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          >
            {showChangelog ? 'Ẩn' : 'Xem'} ({changelog.length} changes)
          </button>
        </div>
        
        {showChangelog && (
          <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
            {changelog.length === 0 ? (
              <p className="text-gray-500">Chưa có thay đổi</p>
            ) : (
              <ul className="space-y-2">
                {changelog.slice().reverse().map((entry, i) => (
                  <li key={i} className="text-sm border-b pb-2">
                    <strong>{entry.user}</strong> - {entry.timestamp}
                    <pre className="text-xs bg-white p-2 mt-1 rounded overflow-x-auto">
                      {JSON.stringify(entry.changes, null, 2)}
                    </pre>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      
      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? '⏳ Lưu...' : '💾 Lưu Config'}
        </button>
        
        <button
          onClick={handleReset}
          disabled={saving}
          className="px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
        >
          🔄 Reset Defaults
        </button>
        
        <button
          onClick={loadConfig}
          disabled={saving}
          className="px-6 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500"
        >
          🔃 Reload
        </button>
      </div>
      
      {/* Current Status */}
      {config && (
        <div className="bg-blue-50 p-4 rounded-lg text-sm">
          <p className="text-gray-600">
            Last updated: <strong>{config.updated_by_username || 'system'}</strong> at{' '}
            <strong>{new Date(config.updated_at).toLocaleString('vi-VN')}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## 📋 Checklist Triển Khai

- [ ] **Phase 1: Backend** (3h)
  - [ ] Tạo RuntimeVnbrokerConfig model
  - [ ] Tạo Django admin interface
  - [ ] Tạo DRF serializer
  - [ ] Tạo ViewSet API
  - [ ] Cập nhật URL routing
  - [ ] Run migration: `python manage.py migrate`
  - [ ] Test admin interface at `/admin/portfolio/runtimevnbrokerconfig/`

- [ ] **Phase 2: Adapter Update** (2.5h)
  - [ ] Implement VnbrokerConfigManager
  - [ ] Update timeout loading
  - [ ] Add signal handler for cache invalidation
  - [ ] Test config cache layer locally
  - [ ] Verify adapter loads from DB + caches for 5min

- [ ] **Phase 3: Frontend** (2.5h)
  - [ ] Create VnbrokerConfigPanel.jsx
  - [ ] Add Vnbroker Config tab to AdminOps
  - [ ] Test form input/save flow
  - [ ] Test changelog display
  - [ ] Test reset to defaults
  - [ ] Verify config changes show in API response

- [ ] **Testing & Validation** (1h)
  - [ ] Restart frontend/backend, verify tab appears
  - [ ] Change one config value (e.g., max_concurrency=20)
  - [ ] Verify API returns new value immediately
  - [ ] Check changelog records the change
  - [ ] Verify vnbroker requests respect new concurrency limit
  - [ ] Test reset to defaults button

- [ ] **Production Deployment** (0.5h)
  - [ ] Run migration on staging
  - [ ] Deploy code to staging
  - [ ] Smoke test config panel
  - [ ] Deploy to production with zero downtime

---

## 🚀 API Endpoints Summary

```
GET  /api/admin-ops/vnbroker-config/current/
     → Get current config

PATCH /api/admin-ops/vnbroker-config/update_config/
     → Update partial config (e.g., {"max_concurrency": 15})

POST  /api/admin-ops/vnbroker-config/reset_to_defaults/
     → Reset all to defaults

GET  /api/admin-ops/vnbroker-config/changelog/
     → Get full audit changelog
```

---

## 💡 Keuntungan Implementation

| Aspek | Sebelum | Sesudah |
|-------|---------|--------|
| **Config change** | Restart Django (30-60s) | API call (0.1s) |
| **Downtime** | Full app restart needed | Zero downtime |
| **Testing** | Upload env file, rebuild image | Click button in UI |
| **Audit trail** | Manual log review | Automatic changelog |
| **Rate limit tweaks** | Rebuild + deploy | Adjust cooldown instantly |
| **Performance tuning** | Revert to old image | Rollback one config value |

---

## 📞 Troubleshooting

| Masalah | Solusi |
|--------|--------|
| Config tidak jalan setelah save | Check if signal handler registered + cache clear |
| Timeout masih pakai env var default | Verify VnbrokerConfigManager.get_current_config() called |
| Changelog kosong | Check if `record_change()` called after each save |
| UI not showing new tab | Verify AdminOps.jsx includes 'vnbroker' in tabs array |
| API returns 401 | Verify user is admin + permission_classes set correctly |

---

**Status:** Ready to implement  
**Estimated Effort:** 8-10 hours  
**Risk Level:** LOW (Isolated changes, backward compatible)

