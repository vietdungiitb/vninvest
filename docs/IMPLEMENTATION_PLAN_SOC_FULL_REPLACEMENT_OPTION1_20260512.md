# IMPLEMENTATION PLAN: SOC Full Replacement (Option 1)
**Ngày**: 2026-05-12  
**Scope**: Complete replacement of Admin-Ops with unified Service Operations Center  
**Timeline**: 7 weeks (1 developer) / 2 weeks (4 developers parallel)

---

## EXECUTIVE SUMMARY

This plan replaces the fragmented Admin-Ops system (50+ endpoints, scattered config, duplicate functionality) with a unified Service Operations Center managing all 23 background services.

### Key Objectives
- ✅ Single SSOT for all service governance (ServiceDefinition, ServiceConfig, ServiceHealthCheck, ServiceRun)
- ✅ Unified UI dashboard replacing 5 existing Admin-Ops panels
- ✅ Eliminate duplicate health checks, config locations, run history
- ✅ Enable advanced features: circuit breaker, queue prioritization, dependency DAG
- ✅ Reduce API surface from 50+ → 15 endpoints
- ✅ Complete config migration with zero data loss

### Success Criteria
- 100% of existing Admin-Ops functionality migrated to SOC
- All 23 services registered + operational in ServiceDefinition
- Config validation: Old Admin-Ops configs ≡ New SOC configs (100%)
- SOC dashboard shows all services + health + run history
- All Admin-Ops endpoints deleted, zero dual code
- Operator training complete, zero failed manual triggers

---

## I. PHASE 1: DATABASE & BACKEND INFRASTRUCTURE (Weeks 1-2)

### 1.1 Create Django App: `service_ops`

**Duration**: 1 day (8 hours)

**Deliverables**:
```
backend/
├─ service_ops/
│  ├─ __init__.py
│  ├─ models.py               (6 models: ServiceDefinition, ServiceConfig, etc.)
│  ├─ serializers.py          (DRF serializers for all models)
│  ├─ views.py                (REST API views)
│  ├─ urls.py                 (routing)
│  ├─ admin.py                (Django admin interface)
│  ├─ management/
│  │  └─ commands/
│  │     ├─ register_services.py       (bootstrap 23 services)
│  │     └─ migrate_config_from_admin_ops.py
│  ├─ tasks.py                (Celery tasks)
│  ├─ migrations/
│  │  └─ 0001_initial.py
│  └─ tests/
│     ├─ test_models.py
│     ├─ test_api.py
│     └─ test_health_checks.py
```

**Tasks**:
- [ ] Initialize Django app: `python manage.py startapp service_ops`
- [ ] Add to INSTALLED_APPS in settings.py
- [ ] Create models (see section 1.2)

**Success Criteria**:
- App initializes without errors
- Django checks pass: `python manage.py check`

---

### 1.2 Create 6 Database Models

**Duration**: 2 days (16 hours)

**Models** (with fields):

#### Model 1: ServiceDefinition
```python
class ServiceDefinition(models.Model):
    # Identity
    id = models.CharField(max_length=64, primary_key=True)  # e.g., "prefetch_realtime_ticker"
    name = models.CharField(max_length=256)                 # e.g., "Prefetch Realtime Ticker"
    domain = models.CharField(max_length=64)                # e.g., "realtime_prefetch"
    
    # Service type
    SERVICE_TYPE_CHOICES = [
        ('scheduled', 'Scheduled Task'),
        ('on_demand', 'On-Demand Task'),
        ('stream_consumer', 'Stream Consumer'),
    ]
    service_type = models.CharField(max_length=32, choices=SERVICE_TYPE_CHOICES)
    
    # Celery binding
    celery_task_name = models.CharField(max_length=256)     # e.g., "portfolio.tasks.prefetch_realtime_ticker"
    celery_queue = models.CharField(max_length=64)          # e.g., "realtime_prefetch"
    
    # Schedule (for scheduled tasks)
    schedule_crontab = models.CharField(max_length=256, null=True, blank=True)  # "*/5 * * * *"
    schedule_interval_seconds = models.IntegerField(null=True, blank=True)     # e.g., 300
    
    # Timeout & retry
    timeout_seconds = models.IntegerField(default=300)
    max_retries = models.IntegerField(default=3)
    retry_backoff_seconds = models.IntegerField(default=60)
    
    # Health check config
    health_check_interval_minutes = models.IntegerField(default=5)
    alert_threshold_failures = models.IntegerField(default=3)
    stale_threshold_minutes = models.IntegerField(default=30)
    
    # Metadata
    description = models.TextField(blank=True)
    enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Config reference
    config_json = models.JSONField(default=dict)  # Service-specific parameters
    
    class Meta:
        ordering = ['domain', 'name']
        verbose_name = "Service Definition"
        verbose_name_plural = "Service Definitions"
        indexes = [
            models.Index(fields=['domain']),
            models.Index(fields=['enabled']),
        ]
```

#### Model 2: ServiceConfig
```python
class ServiceConfig(models.Model):
    service = models.OneToOneField(ServiceDefinition, on_delete=models.CASCADE, related_name='current_config')
    
    # Configuration data
    config_json = models.JSONField()  # Full config (timeout, retries, thresholds, etc.)
    
    # Versioning
    version = models.IntegerField(default=1)
    is_active = models.BooleanField(default=True)
    
    # Audit trail
    changed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    change_reason = models.CharField(max_length=256, blank=True)
    
    # Rollback capability
    previous_version = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='next_version')
    
    class Meta:
        verbose_name = "Service Configuration"
        verbose_name_plural = "Service Configurations"
        ordering = ['-version']
```

#### Model 3: ServiceHealthCheck
```python
class ServiceHealthCheck(models.Model):
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='health_checks')
    
    # Health status
    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('unhealthy', 'Unhealthy'),
        ('unknown', 'Unknown'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='unknown')
    
    # Metrics
    last_run_time = models.DateTimeField(null=True, blank=True)
    time_since_last_run_seconds = models.IntegerField(null=True, blank=True)
    consecutive_failures = models.IntegerField(default=0)
    last_error_message = models.TextField(blank=True)
    
    # Performance
    avg_duration_seconds = models.FloatField(null=True, blank=True)
    success_rate = models.FloatField(null=True, blank=True)  # 0-1
    
    # Timestamp
    checked_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = "Service Health Check"
        verbose_name_plural = "Service Health Checks"
        indexes = [
            models.Index(fields=['service', '-checked_at']),
            models.Index(fields=['status']),
        ]
```

#### Model 4: ServiceRun
```python
class ServiceRun(models.Model):
    service = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='runs')
    
    # Execution info
    task_id = models.CharField(max_length=256, unique=True)  # Celery task_id
    triggered_by = models.CharField(max_length=64)  # 'scheduled', 'manual', 'retry', 'dependency'
    triggered_by_user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    
    # Status
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failure', 'Failure'),
        ('retry', 'Retry'),
        ('timeout', 'Timeout'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    
    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    
    # Result
    result_json = models.JSONField(null=True, blank=True)  # Task result / output
    error_message = models.TextField(blank=True)
    
    # Input parameters
    parameters_json = models.JSONField(default=dict)
    
    class Meta:
        verbose_name = "Service Run"
        verbose_name_plural = "Service Runs"
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['service', '-started_at']),
            models.Index(fields=['status']),
            models.Index(fields=['task_id']),
        ]
```

#### Model 5: ServiceRunLog
```python
class ServiceRunLog(models.Model):
    run = models.ForeignKey(ServiceRun, on_delete=models.CASCADE, related_name='logs')
    
    # Log entry
    level = models.CharField(
        max_length=32,
        choices=[('DEBUG', 'Debug'), ('INFO', 'Info'), ('WARNING', 'Warning'), ('ERROR', 'Error')],
        default='INFO'
    )
    message = models.TextField()
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = "Service Run Log"
        verbose_name_plural = "Service Run Logs"
        ordering = ['timestamp']
```

#### Model 6: ServiceDependency
```python
class ServiceDependency(models.Model):
    parent = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='dependencies')
    child = models.ForeignKey(ServiceDefinition, on_delete=models.CASCADE, related_name='dependents')
    
    # Dependency type
    DEPENDENCY_TYPE_CHOICES = [
        ('blocking', 'Blocking (child waits for parent)'),
        ('soft', 'Soft (informational only)'),
    ]
    dependency_type = models.CharField(max_length=32, choices=DEPENDENCY_TYPE_CHOICES, default='soft')
    
    # Metadata
    description = models.CharField(max_length=256, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = [['parent', 'child']]
        verbose_name = "Service Dependency"
        verbose_name_plural = "Service Dependencies"
```

**Tasks**:
- [ ] Define all 6 models in `backend/service_ops/models.py`
- [ ] Add docstrings to all fields
- [ ] Create initial migration: `python manage.py makemigrations service_ops`
- [ ] Apply migration: `python manage.py migrate service_ops`

**Success Criteria**:
- `python manage.py sqlmigrate service_ops 0001` shows all 6 tables
- Database schema correct (check via `python manage.py dbshell`)
- No migration errors

---

### 1.3 Create REST API Serializers & Views

**Duration**: 2 days (16 hours)

**Serializers** (DRF):
```python
# backend/service_ops/serializers.py

class ServiceDefinitionSerializer(serializers.ModelSerializer):
    current_config = serializers.SerializerMethodField()
    latest_health = serializers.SerializerMethodField()
    latest_run = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceDefinition
        fields = [
            'id', 'name', 'domain', 'service_type', 'celery_task_name',
            'celery_queue', 'enabled', 'description', 'current_config',
            'latest_health', 'latest_run'
        ]

class ServiceConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceConfig
        fields = ['service', 'config_json', 'version', 'is_active', 'changed_by', 'changed_at']

class ServiceHealthCheckSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceHealthCheck
        fields = [
            'service', 'status', 'last_run_time', 'consecutive_failures',
            'last_error_message', 'avg_duration_seconds', 'success_rate', 'checked_at'
        ]

class ServiceRunSerializer(serializers.ModelSerializer):
    logs = serializers.SerializerMethodField()
    
    class Meta:
        model = ServiceRun
        fields = [
            'id', 'service', 'task_id', 'triggered_by', 'triggered_by_user',
            'status', 'started_at', 'ended_at', 'duration_seconds',
            'result_json', 'error_message', 'parameters_json', 'logs'
        ]
```

**API Views** (15 endpoints):

```python
# backend/service_ops/views.py

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from celery.app import current_app as celery_app

# 1. List all services + health + runs
class ServiceDefinitionViewSet(viewsets.ModelViewSet):
    queryset = ServiceDefinition.objects.all()
    serializer_class = ServiceDefinitionSerializer
    filterset_fields = ['domain', 'enabled', 'service_type']
    ordering_fields = ['name', 'domain', 'created_at']
    
    @action(detail=False, methods=['get'])
    def summary(self, request):
        """GET /api/soc/services/summary/ — Overview of all services"""
        services = ServiceDefinition.objects.all()
        total = services.count()
        enabled = services.filter(enabled=True).count()
        health_status = {}
        for status_choice in ServiceHealthCheck.STATUS_CHOICES:
            count = ServiceHealthCheck.objects.filter(status=status_choice[0]).values_list('service').distinct().count()
            health_status[status_choice[0]] = count
        
        return Response({
            'total_services': total,
            'enabled_services': enabled,
            'health_summary': health_status,
            'services': ServiceDefinitionSerializer(services, many=True).data
        })
    
    @action(detail=True, methods=['post'])
    def trigger(self, request, pk=None):
        """POST /api/soc/services/{id}/trigger/ — Manual trigger"""
        service = self.get_object()
        parameters = request.data.get('parameters', {})
        
        # Queue task
        task = celery_app.send_task(
            service.celery_task_name,
            kwargs=parameters,
            queue=service.celery_queue
        )
        
        # Create ServiceRun record
        run = ServiceRun.objects.create(
            service=service,
            task_id=task.id,
            triggered_by='manual',
            triggered_by_user=request.user if request.user.is_authenticated else None,
            status='pending',
            parameters_json=parameters
        )
        
        return Response({
            'run_id': run.id,
            'task_id': task.id,
            'status': 'queued'
        }, status=status.HTTP_202_ACCEPTED)
    
    @action(detail=True, methods=['post'])
    def pause(self, request, pk=None):
        """POST /api/soc/services/{id}/pause/ — Pause service"""
        service = self.get_object()
        service.enabled = False
        service.save()
        return Response({'status': 'paused'})
    
    @action(detail=True, methods=['post'])
    def resume(self, request, pk=None):
        """POST /api/soc/services/{id}/resume/ — Resume service"""
        service = self.get_object()
        service.enabled = True
        service.save()
        return Response({'status': 'resumed'})

# 2. Health checks
class ServiceHealthCheckViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ServiceHealthCheck.objects.all()
    serializer_class = ServiceHealthCheckSerializer
    filterset_fields = ['service', 'status']
    ordering = ['-checked_at']
    
    @action(detail=False, methods=['get'])
    def heatmap(self, request):
        """GET /api/soc/health/heatmap/ — All services + latest health"""
        services = ServiceDefinition.objects.filter(enabled=True)
        result = []
        for service in services:
            latest = ServiceHealthCheck.objects.filter(service=service).latest('checked_at')
            result.append({
                'service_id': service.id,
                'service_name': service.name,
                'status': latest.status if latest else 'unknown',
                'last_run': latest.last_run_time,
                'consecutive_failures': latest.consecutive_failures if latest else 0
            })
        return Response(result)

# 3. Config management
class ServiceConfigViewSet(viewsets.ModelViewSet):
    queryset = ServiceConfig.objects.all()
    serializer_class = ServiceConfigSerializer
    filterset_fields = ['service', 'is_active']
    
    @action(detail=False, methods=['get'])
    def history(self, request):
        """GET /api/soc/config/history/?service={id} — Config version history"""
        service_id = request.query_params.get('service')
        if not service_id:
            return Response({'error': 'service parameter required'}, status=400)
        
        configs = ServiceConfig.objects.filter(service=service_id).order_by('-version')
        return Response(ServiceConfigSerializer(configs, many=True).data)
    
    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        """POST /api/soc/config/{id}/rollback/ — Rollback to previous version"""
        config = self.get_object()
        if not config.previous_version:
            return Response({'error': 'No previous version'}, status=400)
        
        # Mark current as inactive
        config.is_active = False
        config.save()
        
        # Activate previous
        config.previous_version.is_active = True
        config.previous_version.save()
        
        return Response({'status': 'rolled back', 'version': config.previous_version.version})

# 4. Run history
class ServiceRunViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ServiceRun.objects.all()
    serializer_class = ServiceRunSerializer
    filterset_fields = ['service', 'status', 'triggered_by']
    ordering = ['-started_at']
    pagination_class = CursorPagination  # For large run histories

# 5. Alerts
class ServiceAlertViewSet(viewsets.ModelViewSet):
    # Future: ServiceAlert model + viewset
    pass
```

**URL Routing**:
```python
# backend/service_ops/urls.py

from rest_framework import routers
from .views import (
    ServiceDefinitionViewSet, ServiceHealthCheckViewSet,
    ServiceConfigViewSet, ServiceRunViewSet, ServiceAlertViewSet
)

router = routers.DefaultRouter()
router.register(r'services', ServiceDefinitionViewSet, basename='service')
router.register(r'health', ServiceHealthCheckViewSet, basename='health')
router.register(r'config', ServiceConfigViewSet, basename='config')
router.register(r'runs', ServiceRunViewSet, basename='run')
router.register(r'alerts', ServiceAlertViewSet, basename='alert')

urlpatterns = router.urls

# In backend/config/urls.py, add:
# path('api/soc/', include('service_ops.urls')),
```

**Tasks**:
- [ ] Create `backend/service_ops/serializers.py` with 4 serializers
- [ ] Create `backend/service_ops/views.py` with 5 viewsets + custom actions
- [ ] Create `backend/service_ops/urls.py` with router
- [ ] Add to `backend/config/urls.py`: `path('api/soc/', include('service_ops.urls'))`
- [ ] Test all 15 endpoints: `pytest backend/service_ops/tests/test_api.py`

**Success Criteria**:
- All 15 REST endpoints respond with 200/201/202 status
- Filter + ordering work correctly
- Manual trigger creates ServiceRun record + queues task
- Config rollback works (activates previous_version)

---

### 1.4 Create Health Check Scheduler Task

**Duration**: 1 day (8 hours)

**Task**: `backend/service_ops/tasks.py`

```python
from celery import shared_task
from celery.app import current_app as celery_app
from .models import ServiceDefinition, ServiceHealthCheck, ServiceRun
from datetime import timedelta
from django.utils import timezone

@shared_task(name='service_ops.check_service_health')
def check_service_health(service_id):
    """
    Check health of a single service:
    - Query latest run time
    - Count consecutive failures
    - Update ServiceHealthCheck status
    - Alert if unhealthy
    """
    try:
        service = ServiceDefinition.objects.get(id=service_id)
        
        # Get latest run
        latest_run = ServiceRun.objects.filter(service=service).order_by('-started_at').first()
        
        if not latest_run:
            status = 'unknown'
            time_since_last_run = None
        else:
            time_since_last_run = (timezone.now() - latest_run.started_at).total_seconds()
            
            # Count consecutive failures
            recent_runs = ServiceRun.objects.filter(
                service=service,
                status__in=['failure', 'timeout']
            ).order_by('-started_at')[:5]
            consecutive_failures = len(recent_runs)
            
            # Determine status
            if consecutive_failures >= service.alert_threshold_failures:
                status = 'unhealthy'
            elif time_since_last_run > (service.stale_threshold_minutes * 60):
                status = 'unhealthy'  # Stale (no run in N minutes)
            elif consecutive_failures > 0:
                status = 'degraded'
            else:
                status = 'healthy'
        
        # Update or create health check
        health_check, created = ServiceHealthCheck.objects.update_or_create(
            service=service,
            defaults={
                'status': status,
                'last_run_time': latest_run.started_at if latest_run else None,
                'time_since_last_run_seconds': time_since_last_run,
                'consecutive_failures': consecutive_failures,
                'last_error_message': latest_run.error_message if latest_run else '',
            }
        )
        
        # Alert if unhealthy
        if status == 'unhealthy':
            send_alert_to_slack(service, status, health_check.last_error_message)
        
        return {'service': service_id, 'status': status}
    except Exception as e:
        return {'error': str(e)}

@shared_task(name='service_ops.check_all_services_health')
def check_all_services_health():
    """
    Scheduled every 5 minutes: check all enabled services
    """
    services = ServiceDefinition.objects.filter(enabled=True)
    for service in services:
        check_service_health.delay(service.id)
    
    return {'total_services': services.count()}

def send_alert_to_slack(service, status, error_message):
    """Send Slack notification for unhealthy service"""
    # TODO: Implement Slack notification
    pass
```

**Schedule** (add to `backend/config/settings.py`):
```python
CELERY_BEAT_SCHEDULE = {
    # ... existing tasks ...
    
    'check_all_services_health': {
        'task': 'service_ops.check_all_services_health',
        'schedule': crontab(minute='*/5'),  # Every 5 minutes
    },
}
```

**Tasks**:
- [ ] Create `backend/service_ops/tasks.py` with health check tasks
- [ ] Add to CELERY_BEAT_SCHEDULE
- [ ] Test: `celery -A portfolio worker -l info` + manually call task

**Success Criteria**:
- Health check task runs every 5 minutes
- ServiceHealthCheck records created/updated
- Status correctly reflects latest run state

---

### 1.5 Management Command: Register 23 Services

**Duration**: 1 day (8 hours)

**Command**: `backend/service_ops/management/commands/register_services.py`

```python
from django.core.management.base import BaseCommand
from service_ops.models import ServiceDefinition
import json

class Command(BaseCommand):
    help = 'Register all 23 existing services in ServiceDefinition'
    
    SERVICES = [
        # Realtime Prefetch
        {
            'id': 'build_realtime_symbol_universe',
            'name': 'Build Realtime Symbol Universe',
            'domain': 'realtime_prefetch',
            'service_type': 'scheduled',
            'celery_task_name': 'portfolio.tasks_prefetch.build_realtime_symbol_universe_snapshot',
            'celery_queue': 'realtime_prefetch',
            'schedule_interval_seconds': 60,
            'timeout_seconds': 30,
        },
        {
            'id': 'schedule_realtime_prefetch_shards',
            'name': 'Schedule Realtime Prefetch Shards',
            'domain': 'realtime_prefetch',
            'service_type': 'scheduled',
            'celery_task_name': 'portfolio.tasks_prefetch.schedule_realtime_prefetch_shards',
            'celery_queue': 'realtime_prefetch',
            'schedule_interval_seconds': 3,
            'timeout_seconds': 2,
        },
        # ... 21 more services (see SERVICE_REGISTRY_BOOTSTRAP_DATA.json)
    ]
    
    def handle(self, *args, **options):
        created_count = 0
        for service_data in self.SERVICES:
            obj, created = ServiceDefinition.objects.update_or_create(
                id=service_data['id'],
                defaults=service_data
            )
            if created:
                created_count += 1
                self.stdout.write(self.style.SUCCESS(f"Created: {service_data['name']}"))
            else:
                self.stdout.write(f"Updated: {service_data['name']}")
        
        self.stdout.write(self.style.SUCCESS(f'\nTotal created: {created_count}'))
```

**Tasks**:
- [ ] Create `backend/service_ops/management/commands/register_services.py`
- [ ] Run: `python manage.py register_services`
- [ ] Verify: `ServiceDefinition.objects.count()` == 23

**Success Criteria**:
- All 23 services registered
- Can query ServiceDefinition.objects.all() and see 23 records

---

## II. PHASE 2: CONFIG MIGRATION (Weeks 2-3)

### 2.1 Audit Existing Config Locations

**Duration**: 1 day (8 hours)

**Current config locations** (scattered):

```
1. settings.py (hardcoded)
   ├─ TICKER_PREFETCH_HOT_LIMIT = 500
   ├─ TICKER_PREFETCH_WARM_LIMIT = 1000
   ├─ TICKER_PREFETCH_COLD_LIMIT = 2000
   └─ ... 20+ settings

2. Redis (runtime settings)
   ├─ VNBROKER_RUNTIME_SETTINGS_CACHE_KEY
   ├─ PREFETCH_TOPOLOGY_CACHE_KEY
   └─ ... various cache keys

3. Django Models
   ├─ VnbrokerRuntimeConfig (fields: concurrency, timeout, rate_limit)
   ├─ SystemAISettings (whale_threshold, dark_flow_confidence)
   ├─ AdminGlobalScreenerConfig (cron, enabled)
   └─ ... 4+ models

4. Hardcoded in Task Definitions
   ├─ whale_detection_cooldown_seconds = 30
   ├─ order_flow_max_symbols = 50
   └─ ... inline defaults
```

**Audit tasks**:
- [ ] List all CELERY_BEAT_SCHEDULE entries (23 services)
- [ ] For each service, find its config (env var, cache key, model field, hardcoded)
- [ ] Document mapping: Service ID → Config Location
- [ ] Create audit spreadsheet: `docs/CONFIG_MIGRATION_AUDIT.csv`

**Success Criteria**:
- Complete mapping of all 23 services to config locations
- No "unknown config" services

---

### 2.2 Design ServiceConfig JSON Schema

**Duration**: 1 day (8 hours)

**Schema** (per service):

```json
{
  "realtime_prefetch": {
    "prefetch_realtime_ticker_shard": {
      "enabled": true,
      "timeout_seconds": 15,
      "retry_max_attempts": 3,
      "retry_backoff_seconds": 60,
      "batch_size": 100,
      "queue": "realtime_prefetch"
    }
  },
  "data_ingest": {
    "vnbroker_offpeak_ingest": {
      "enabled": true,
      "concurrency": 10,
      "timeout_seconds": 120,
      "rate_limit_per_second": 100,
      "retry_max_attempts": 5
    }
  },
  // ... service-specific configs
}
```

**Task**:
- [ ] Define JSON schema for each service (23 schemas)
- [ ] Add to ServiceDefinition.config_json as default template

---

### 2.3 Create Migration Script: Old → ServiceConfig

**Duration**: 2 days (16 hours)

**Script**: `backend/service_ops/management/commands/migrate_config_from_admin_ops.py`

```python
from django.core.management.base import BaseCommand
from service_ops.models import ServiceDefinition, ServiceConfig
from portfolio.models import VnbrokerRuntimeConfig, SystemAISettings
from django.core.cache import cache
import json

class Command(BaseCommand):
    help = 'Migrate all configs from scattered locations to ServiceConfig'
    
    def handle(self, *args, **options):
        self.migrate_vnbroker_config()
        self.migrate_prefetch_config()
        self.migrate_ai_settings()
        self.migrate_screener_config()
        
        self.stdout.write(self.style.SUCCESS('Config migration complete'))
    
    def migrate_vnbroker_config(self):
        """VnbrokerRuntimeConfig → ServiceConfig"""
        vnbroker_configs = VnbrokerRuntimeConfig.objects.all()
        for cfg in vnbroker_configs:
            # Create config_json from model fields
            config_json = {
                'concurrency': cfg.concurrency,
                'timeout_seconds': cfg.timeout_seconds,
                'rate_limit_per_second': cfg.rate_limit_per_second,
            }
            
            # Find which service uses this config
            # (assumption: one VnbrokerRuntimeConfig → multiple vnbroker services)
            services = ServiceDefinition.objects.filter(domain='data_ingest')
            
            for service in services:
                ServiceConfig.objects.update_or_create(
                    service=service,
                    defaults={
                        'config_json': config_json,
                        'version': 1,
                        'is_active': True,
                        'change_reason': 'Migrated from VnbrokerRuntimeConfig'
                    }
                )
                self.stdout.write(f"✓ Migrated {service.id}")
    
    def migrate_prefetch_config(self):
        """settings.py TICKER_PREFETCH_* → ServiceConfig"""
        from django.conf import settings
        
        config_json = {
            'hot_limit': settings.TICKER_PREFETCH_HOT_LIMIT,
            'warm_limit': settings.TICKER_PREFETCH_WARM_LIMIT,
            'cold_limit': settings.TICKER_PREFETCH_COLD_LIMIT,
            'interval_seconds': settings.TICKER_PREFETCH_INTERVAL,
        }
        
        services = ServiceDefinition.objects.filter(domain='realtime_prefetch')
        for service in services:
            ServiceConfig.objects.update_or_create(
                service=service,
                defaults={
                    'config_json': config_json,
                    'version': 1,
                    'is_active': True,
                    'change_reason': 'Migrated from settings.py'
                }
            )
            self.stdout.write(f"✓ Migrated {service.id}")
    
    def migrate_ai_settings(self):
        """SystemAISettings → ServiceConfig"""
        ai_settings = SystemAISettings.objects.all()
        for settings_obj in ai_settings:
            config_json = {
                'whale_threshold': settings_obj.whale_threshold,
                'dark_flow_confidence': settings_obj.dark_flow_confidence,
                'advisory_budget': settings_obj.advisory_budget,
            }
            
            # Find signal detection services
            services = ServiceDefinition.objects.filter(domain='signal_intelligence')
            for service in services:
                ServiceConfig.objects.update_or_create(
                    service=service,
                    defaults={
                        'config_json': config_json,
                        'version': 1,
                        'is_active': True,
                        'change_reason': 'Migrated from SystemAISettings'
                    }
                )
                self.stdout.write(f"✓ Migrated {service.id}")
    
    def migrate_screener_config(self):
        """AdminGlobalScreenerConfig → ServiceConfig"""
        from portfolio.models import AdminGlobalScreenerConfig
        
        screener_configs = AdminGlobalScreenerConfig.objects.all()
        for cfg in screener_configs:
            config_json = {
                'cron_expression': cfg.cron_expression,
                'enabled': cfg.enabled,
            }
            
            service = ServiceDefinition.objects.get(id='global_screener_rule')
            ServiceConfig.objects.update_or_create(
                service=service,
                defaults={
                    'config_json': config_json,
                    'version': 1,
                    'is_active': True,
                    'change_reason': 'Migrated from AdminGlobalScreenerConfig'
                }
            )
            self.stdout.write(f"✓ Migrated {service.id}")
```

**Validation script**: `validate_config_migration.py`

```python
# After migration, verify all configs match

from service_ops.models import ServiceDefinition, ServiceConfig
from portfolio.models import VnbrokerRuntimeConfig
import json

def validate_vnbroker_config():
    """Verify ServiceConfig['concurrency'] == VnbrokerRuntimeConfig.concurrency"""
    old_config = VnbrokerRuntimeConfig.objects.first()
    new_config = ServiceConfig.objects.filter(service__domain='data_ingest').first()
    
    assert new_config.config_json['concurrency'] == old_config.concurrency
    print("✓ VNBroker config matches")

def validate_all_services():
    """Check all 23 services have config"""
    services = ServiceDefinition.objects.all()
    for service in services:
        config = ServiceConfig.objects.filter(service=service, is_active=True).first()
        assert config is not None, f"No config for {service.id}"
        assert config.config_json, f"Empty config for {service.id}"
    print(f"✓ All {services.count()} services have valid config")

if __name__ == '__main__':
    validate_vnbroker_config()
    validate_all_services()
```

**Tasks**:
- [ ] Create migration script
- [ ] Run: `python manage.py migrate_config_from_admin_ops`
- [ ] Validate: `python validate_config_migration.py`
- [ ] Spot-check: Compare 5+ configs manually (old → new)

**Success Criteria**:
- All 23 services have ServiceConfig records
- Config values match old locations (100% validation)
- No config data loss

---

### 2.4 Double-Write Phase (Week 2-3)

**Objective**: Run both old + new config systems simultaneously, compare results.

**Implementation**:
- [ ] Update all config reads to check ServiceConfig FIRST, fall back to old location
- [ ] Update all config writes to write to BOTH old + new (for 1 week)
- [ ] Log conflicts: When old ≠ new, log warning
- [ ] Monitor conflicts for 1 week

**Code changes**:

```python
# backend/portfolio/config_loader.py (new module)

from service_ops.models import ServiceConfig
from django.conf import settings

def get_service_config(service_id, field_name, default=None):
    """
    Get config value for a service.
    
    Try ServiceConfig first (new SSOT), fall back to old locations.
    """
    try:
        config = ServiceConfig.objects.get(service__id=service_id, is_active=True)
        return config.config_json.get(field_name, default)
    except ServiceConfig.DoesNotExist:
        # Fall back to old location (hardcoded, cache, model)
        return get_old_config(service_id, field_name, default)

def get_old_config(service_id, field_name, default):
    """Legacy config loader (will be deleted in Phase 3)"""
    if service_id == 'vnbroker_offpeak_ingest':
        from portfolio.models import VnbrokerRuntimeConfig
        cfg = VnbrokerRuntimeConfig.objects.first()
        return getattr(cfg, field_name, default)
    # ... handle other services
```

**Logging conflicts**:
```python
# backend/service_ops/config_parity_checker.py

def check_config_parity():
    """Daily task: compare old vs new configs, log mismatches"""
    from service_ops.models import ServiceDefinition, ServiceConfig
    
    for service in ServiceDefinition.objects.all():
        config = ServiceConfig.objects.get(service=service, is_active=True)
        old_value = get_old_config(service.id, 'timeout_seconds', None)
        new_value = config.config_json.get('timeout_seconds', None)
        
        if old_value != new_value:
            logger.warning(
                f"CONFIG PARITY MISMATCH: {service.id}",
                f"old={old_value}, new={new_value}"
            )

# Schedule: run daily in CELERY_BEAT_SCHEDULE
```

**Tasks**:
- [ ] Create `backend/portfolio/config_loader.py` with dual-read logic
- [ ] Update all task code to use `get_service_config()`
- [ ] Create `config_parity_checker.py` task
- [ ] Monitor logs for conflicts (Week 2-3)
- [ ] Fix conflicts as they appear

**Success Criteria**:
- Zero config parity mismatches in logs after 1 week
- All service reads use new config_loader
- Services behave identically with both old + new configs

---

## III. PHASE 3: DEPRECATE ADMIN-OPS CODE (Weeks 3-4)

### 3.1 Identify All Admin-Ops Code

**Duration**: 1 day (8 hours)

**Code locations**:

```
Backend (50+ endpoints):
├─ backend/portfolio/views_admin_ops.py (300+ lines)
├─ backend/portfolio/admin_ops_api.py (500+ lines)
├─ backend/config/urls.py (/api/admin-ops/* routes)
├─ backend/portfolio/models.py (5+ admin models)
│  ├─ VnbrokerRuntimeConfig
│  ├─ SystemAISettings
│  ├─ AdminGlobalScreenerConfig
│  └─ AdminOpsAuditLog
└─ backend/portfolio/admin.py (admin interface for above)

Frontend (5 components):
├─ frontend/src/pages/AdminOps.jsx (260+ lines)
├─ frontend/src/pages/AdminOpsShellHost.jsx
├─ frontend/src/components/adminops/GlobalScreenerAdminPanel.jsx
├─ frontend/src/components/adminops/SignalControlCenter.jsx
└─ frontend/src/components/adminops/VnbrokerBenchmarkPanel.jsx

Tests:
├─ backend/portfolio/tests/test_admin_ops_api.py
└─ frontend/src/__tests__/AdminOps.test.jsx
```

**Tasks**:
- [ ] Create file manifest: `docs/ADMIN_OPS_CODE_MANIFEST.txt`
- [ ] List all 50+ API endpoints
- [ ] List all 5 frontend components
- [ ] List all 5+ Django models

**Success Criteria**:
- Complete inventory of all Admin-Ops code

---

### 3.2 Create Replacement React Components (SOC Dashboard)

**Duration**: 2 days (16 hours)

**New components** (in `frontend/src/components/soc/`):

```
frontend/src/components/soc/
├─ SOCDashboard.jsx                    (main container)
├─ ServiceRegistry.jsx                  (grid of all 23 services)
├─ HealthHeatmap.jsx                    (status visualization)
├─ ManualTriggerModal.jsx               (trigger any service)
├─ ConfigEditor.jsx                     (edit config + rollback)
├─ RunHistoryTimeline.jsx               (timeline of service runs)
└─ AlertDashboard.jsx                   (failure alerts)
```

**Example: ServiceRegistry.jsx**

```jsx
import React, { useEffect, useState } from 'react';
import { Table, Button, Tag, Space, Modal, Form, Input, InputNumber } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, SettingOutlined } from '@ant-design/icons';
import axios from 'axios';

const ServiceRegistry = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [triggerModalVisible, setTriggerModalVisible] = useState(false);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const response = await axios.get('/api/soc/services/');
    setServices(response.data.results);
    setLoading(false);
  };

  const handleTrigger = async (values) => {
    await axios.post(`/api/soc/services/${selectedService.id}/trigger/`, {
      parameters: values
    });
    Modal.success({ title: 'Triggered', content: `Service queued for execution` });
    setTriggerModalVisible(false);
  };

  const columns = [
    {
      title: 'Service Name',
      dataIndex: 'name',
      key: 'name',
      width: 200,
    },
    {
      title: 'Domain',
      dataIndex: 'domain',
      key: 'domain',
      render: (domain) => <Tag color="blue">{domain}</Tag>,
    },
    {
      title: 'Type',
      dataIndex: 'service_type',
      key: 'service_type',
      render: (type) => <Tag color={type === 'scheduled' ? 'green' : 'orange'}>{type}</Tag>,
    },
    {
      title: 'Health',
      key: 'health',
      render: (_, record) => {
        const status = record.latest_health?.status || 'unknown';
        const colorMap = { healthy: 'green', degraded: 'orange', unhealthy: 'red', unknown: 'gray' };
        return <Tag color={colorMap[status]}>{status}</Tag>;
      },
    },
    {
      title: 'Last Run',
      dataIndex: ['latest_run', 'started_at'],
      key: 'last_run',
      render: (timestamp) => timestamp ? new Date(timestamp).toLocaleString() : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<PlayCircleOutlined />}
            onClick={() => {
              setSelectedService(record);
              setTriggerModalVisible(true);
            }}
          >
            Trigger
          </Button>
          <Button size="small" icon={<SettingOutlined />}>
            Config
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '20px' }}>
      <h2>Service Registry</h2>
      <Table
        columns={columns}
        dataSource={services}
        loading={loading}
        rowKey="id"
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`Trigger Service: ${selectedService?.name}`}
        visible={triggerModalVisible}
        onCancel={() => setTriggerModalVisible(false)}
        footer={null}
      >
        <Form onFinish={handleTrigger}>
          <Form.Item label="Parameters" name="params">
            <Input.TextArea placeholder="JSON parameters" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            Trigger
          </Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ServiceRegistry;
```

**Example: HealthHeatmap.jsx**

```jsx
import React, { useEffect, useState } from 'react';
import { Statistic, Row, Col, Spin } from 'antd';
import axios from 'axios';

const HealthHeatmap = () => {
  const [health, setHealth] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchHealth = async () => {
    setLoading(true);
    const response = await axios.get('/api/soc/health/heatmap/');
    setHealth(response.data);
    setLoading(false);
  };

  const statusCounts = {
    healthy: health.filter(h => h.status === 'healthy').length,
    degraded: health.filter(h => h.status === 'degraded').length,
    unhealthy: health.filter(h => h.status === 'unhealthy').length,
  };

  return (
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginBottom: '20px' }}>
        <Col span={8}>
          <Statistic title="Healthy" value={statusCounts.healthy} valueStyle={{ color: '#52c41a' }} />
        </Col>
        <Col span={8}>
          <Statistic title="Degraded" value={statusCounts.degraded} valueStyle={{ color: '#faad14' }} />
        </Col>
        <Col span={8}>
          <Statistic title="Unhealthy" value={statusCounts.unhealthy} valueStyle={{ color: '#f5222d' }} />
        </Col>
      </Row>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
        {health.map(h => (
          <div key={h.service_id} style={{
            padding: '10px',
            border: `2px solid ${h.status === 'healthy' ? '#52c41a' : h.status === 'degraded' ? '#faad14' : '#f5222d'}`,
            borderRadius: '4px'
          }}>
            <strong>{h.service_name}</strong>
            <p>{h.status}</p>
            {h.consecutive_failures > 0 && <p>Failures: {h.consecutive_failures}</p>}
          </div>
        ))}
      </div>
    </Spin>
  );
};

export default HealthHeatmap;
```

**Tasks**:
- [ ] Create `frontend/src/components/soc/` directory
- [ ] Build 6 components above
- [ ] Add routing: `frontend/src/pages/SOCDashboard.jsx`
- [ ] Integrate into main layout/menu
- [ ] Test all components with mock data

**Success Criteria**:
- SOC dashboard displays all 23 services
- Health heatmap updates every 30 seconds
- Manual trigger modal accepts parameters
- Config editor allows rollback

---

### 3.3 Update Frontend Routes

**Duration**: 1 day (8 hours)

**Replace admin-ops routes**:

```jsx
// frontend/src/App.jsx or routing config

// OLD (to be removed):
// <Route path="/admin-ops" element={<AdminOps />} />

// NEW (to be added):
import SOCDashboard from './pages/SOCDashboard';

// In routes config:
<Route path="/operations-center" element={<SOCDashboard />} />

// Eventually redirect old route:
<Route path="/admin-ops" element={<Navigate to="/operations-center" />} />
```

**Update navigation menu**:

```jsx
// Change menu entry from "Admin Operations" to "Operations Center"
// Update icon/styling to match new SOC branding
```

**Tasks**:
- [ ] Update routing in App.jsx / router config
- [ ] Update navigation menu
- [ ] Add redirect from old /admin-ops → new /operations-center
- [ ] Update breadcrumbs / page titles

---

### 3.4 Delete Admin-Ops Backend Code

**Duration**: 2 days (16 hours)

**Deletions**:

```python
# backend/portfolio/views_admin_ops.py → DELETE (300+ lines)
# backend/portfolio/admin_ops_api.py → DELETE (500+ lines)
```

**URL cleanup**:

```python
# backend/config/urls.py

# REMOVE all lines like:
# path('api/admin-ops/stats/', admin_stats_view),
# path('api/admin-ops/runtime-kpi/', admin_kpi_view),
# ... (remove all 50+ admin-ops routes)
```

**Model cleanup**:

```python
# backend/portfolio/models.py

# REMOVE or KEEP EMPTY:
# class VnbrokerRuntimeConfig(models.Model): → DELETE
# class SystemAISettings(models.Model): → DELETE
# class AdminGlobalScreenerConfig(models.Model): → DELETE
# class AdminOpsAuditLog(models.Model): → DELETE
```

**Create migration**:

```bash
python manage.py makemigrations portfolio --name="remove_admin_ops_models"
```

**Tasks**:
- [ ] Delete `backend/portfolio/views_admin_ops.py`
- [ ] Delete `backend/portfolio/admin_ops_api.py`
- [ ] Remove all 50+ routes from `backend/config/urls.py`
- [ ] Remove Admin-Ops models from `backend/portfolio/models.py` OR keep as legacy (commented)
- [ ] Create migration for model removal
- [ ] Apply migration: `python manage.py migrate`
- [ ] Run tests: `pytest backend/portfolio/tests/` (should pass without those views)

**Success Criteria**:
- No 404s when visiting /api/admin-ops/* (should redirect to /api/soc/ or return 410 Gone)
- All unit tests pass
- No references to old Admin-Ops views in code

---

### 3.5 Delete Admin-Ops Frontend Code

**Duration**: 1 day (8 hours)

**Deletions**:

```
frontend/src/pages/AdminOps.jsx → DELETE
frontend/src/pages/AdminOpsShellHost.jsx → DELETE
frontend/src/components/adminops/GlobalScreenerAdminPanel.jsx → DELETE
frontend/src/components/adminops/SignalControlCenter.jsx → DELETE
frontend/src/components/adminops/VnbrokerBenchmarkPanel.jsx → DELETE
frontend/src/components/adminops/ → DELETE (directory)
frontend/src/__tests__/AdminOps.test.jsx → DELETE
```

**Update imports**:
- [ ] Search for `AdminOps` imports in code
- [ ] Remove all `import AdminOps from '...'` statements
- [ ] Search for `GlobalScreenerAdminPanel`, etc. and remove

**Tasks**:
- [ ] Delete 5 Admin-Ops components
- [ ] Delete `adminops/` directory
- [ ] Remove AdminOps imports/exports
- [ ] Search codebase for stray references
- [ ] Build frontend: `npm run build`

**Success Criteria**:
- Frontend builds without errors
- No import errors
- No references to deleted components

---

### 3.6 Delete Tests & Documentation

**Duration**: 1 day (8 hours)

**Deletions**:
- [ ] `backend/portfolio/tests/test_admin_ops_api.py`
- [ ] `frontend/src/__tests__/AdminOps.test.jsx`
- [ ] Old Admin-Ops documentation (if any)

**Update README**:
- [ ] Change "Admin Operations" section to "Operations Center"
- [ ] Update API documentation to show new SOC endpoints
- [ ] Update operator guide to reference SOC dashboard

**Tasks**:
- [ ] Delete test files
- [ ] Update README.md + docs
- [ ] Create `MIGRATION_GUIDE.md` for operators

**Success Criteria**:
- No broken documentation links
- All tests pass (without deleted tests)

---

## IV. PHASE 4: BUILD SOC UI COMPONENTS (Weeks 4-5)

*(Detailed component specs above in Phase 3.2)*

**Components to build** (continued from Phase 3.2):

1. **SOCDashboard.jsx** (main container)
2. **ServiceRegistry.jsx** (grid)
3. **HealthHeatmap.jsx** (status cards)
4. **ManualTriggerModal.jsx** (trigger UI)
5. **ConfigEditor.jsx** (edit + rollback)
6. **RunHistoryTimeline.jsx** (timeline)
7. **AlertDashboard.jsx** (alerts)

**Additional components** (Weeks 4-5):

#### 8. ServiceDependencyDAG.jsx
```jsx
// Visualize service dependencies (parent → child)
// Libraries: D3.js or Cytoscape.js
// Show which services block which others
```

#### 9. ConfigChangeAuditLog.jsx
```jsx
// Show history of config changes
// Fields: service, old_value, new_value, changed_by, changed_at, reason
// Allow reverting to any historical version
```

#### 10. QueueMetricsPanel.jsx
```jsx
// Show queue depths by queue_name
// Realtime_prefetch: 45 tasks
// Default: 120 tasks
// Offhours: 8 tasks
```

**Tasks**:
- [ ] Build all 10 React components
- [ ] Integration testing with mock API
- [ ] Add to SOC dashboard page
- [ ] Style consistently with existing UI
- [ ] Add Vietnamese i18n

**Success Criteria**:
- All components render without errors
- API integration working
- Dashboard fully functional

---

## V. PHASE 5: ADVANCED FEATURES (Weeks 5-6)

### 5.1 Circuit Breaker Implementation

**Concept**: Pause service if it fails too many times

```python
# backend/service_ops/circuit_breaker.py

class CircuitBreaker:
    def __init__(self, service, failure_threshold=5, timeout_minutes=10):
        self.service = service
        self.failure_threshold = failure_threshold
        self.timeout_minutes = timeout_minutes
    
    def check_and_trip(self):
        """
        Check if service should trip (pause) circuit breaker
        """
        failures = ServiceRun.objects.filter(
            service=self.service,
            status__in=['failure', 'timeout'],
            started_at__gte=timezone.now() - timedelta(hours=1)
        ).count()
        
        if failures >= self.failure_threshold:
            # Trip circuit
            self.service.enabled = False
            self.service.save()
            ServiceAlert.objects.create(
                service=self.service,
                alert_type='circuit_breaker_tripped',
                message=f'Service {self.service.name} circuit breaker tripped after {failures} failures'
            )
            return True
        return False
    
    def reset(self):
        """Reset circuit breaker (re-enable service)"""
        self.service.enabled = True
        self.service.save()
```

### 5.2 Queue Prioritization

```python
# backend/service_ops/queue_manager.py

QUEUE_PRIORITY = {
    'realtime_prefetch': 1,      # Highest priority
    'default': 2,
    'enrichment_offhours': 3,
    'manual_on_demand': 2,       # High priority (manual ops)
}

def trigger_service_with_priority(service, parameters):
    """Queue task with priority"""
    priority = QUEUE_PRIORITY.get(service.celery_queue, 2)
    
    task = celery_app.send_task(
        service.celery_task_name,
        kwargs=parameters,
        queue=service.celery_queue,
        priority=priority  # Celery priority (higher = earlier)
    )
```

### 5.3 Slack Integration

```python
# backend/service_ops/slack_notifier.py

import slack_sdk

def send_alert_to_slack(service, status, error_message):
    """Send Slack notification for unhealthy service"""
    client = slack_sdk.WebClient(token=settings.SLACK_BOT_TOKEN)
    
    color_map = {
        'unhealthy': '#f5222d',
        'degraded': '#faad14',
        'healthy': '#52c41a'
    }
    
    client.chat_postMessage(
        channel=settings.SLACK_ALERTS_CHANNEL,
        blocks=[
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"🚨 *Service Alert*: {service.name}\nStatus: {status}\nError: {error_message}"
                }
            },
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "View in Dashboard"},
                "url": f"{settings.SITE_URL}/operations-center"
            }
        ]
    )
```

### 5.4 SLA Tracking

```python
# backend/service_ops/sla_tracker.py

class SLATracker:
    def calculate_uptime(self, service, days=7):
        """Calculate % of successful runs in last N days"""
        runs = ServiceRun.objects.filter(
            service=service,
            started_at__gte=timezone.now() - timedelta(days=days)
        )
        
        if not runs.exists():
            return None
        
        successful = runs.filter(status='success').count()
        total = runs.count()
        
        return (successful / total) * 100
    
    def get_sla_report(self):
        """Generate SLA report for all services"""
        services = ServiceDefinition.objects.all()
        report = {}
        
        for service in services:
            uptime = self.calculate_uptime(service, days=7)
            sla_target = 99.5  # Target 99.5% uptime
            status = 'PASS' if uptime >= sla_target else 'FAIL'
            
            report[service.id] = {
                'name': service.name,
                'uptime': uptime,
                'sla_target': sla_target,
                'status': status
            }
        
        return report
```

**Tasks**:
- [ ] Implement circuit breaker logic
- [ ] Implement queue prioritization
- [ ] Implement Slack notifications
- [ ] Implement SLA tracking
- [ ] Test all features

---

## VI. PHASE 6: FINAL TESTING & DEPLOYMENT (Weeks 6-7)

### 6.1 Unit Tests

**Coverage targets**: >80% code coverage

```python
# backend/service_ops/tests/test_models.py
# Test all model methods

# backend/service_ops/tests/test_api.py
# Test all 15 REST endpoints

# backend/service_ops/tests/test_health_checks.py
# Test health check logic

# backend/service_ops/tests/test_circuit_breaker.py
# Test circuit breaker
```

**Run tests**:
```bash
pytest backend/service_ops/tests/ --cov=service_ops --cov-report=html
```

### 6.2 Integration Tests

**Scenarios**:
- [ ] Manual trigger → task queued → ServiceRun created → health check updated
- [ ] Config change → rollback → verify old config restored
- [ ] Circuit breaker trips after 5 failures
- [ ] Health check sends Slack alert
- [ ] Queue prioritization orders tasks correctly

### 6.3 Load Testing

**Test with realistic load**:
- [ ] 23 services running simultaneously
- [ ] 100 manual triggers/min
- [ ] Health check every 5 minutes
- [ ] 10,000+ ServiceRun records in database

### 6.4 User Acceptance Testing (UAT)

**Operator training**:
- [ ] Demo SOC dashboard to team
- [ ] Train on manual triggers
- [ ] Train on config rollback
- [ ] Train on alert acknowledgment

### 6.5 Deployment Checklist

```
Pre-deployment:
- [ ] All unit tests pass (>80% coverage)
- [ ] All integration tests pass
- [ ] Load tests pass
- [ ] UAT sign-off from operators
- [ ] Database backups taken
- [ ] Rollback plan documented

Deployment:
- [ ] Create database migrations
- [ ] Deploy backend code + SOC app
- [ ] Run migrations: python manage.py migrate
- [ ] Register services: python manage.py register_services
- [ ] Migrate configs: python manage.py migrate_config_from_admin_ops
- [ ] Validate configs: python validate_config_migration.py
- [ ] Deploy frontend
- [ ] Test all 15 API endpoints
- [ ] Health check all 23 services

Post-deployment:
- [ ] Monitor logs for errors
- [ ] Monitor health check tasks
- [ ] Monitor Slack alerts
- [ ] Check manual trigger functionality
- [ ] Verify config reads/writes work
- [ ] After 1 week: delete Admin-Ops code (Phase 3)
```

**Tasks**:
- [ ] Write 50+ unit tests
- [ ] Write 10+ integration tests
- [ ] Load test with 23 services + 1000 runs
- [ ] 4-hour UAT session with operators
- [ ] Execute deployment checklist

**Success Criteria**:
- All tests pass
- Zero errors in deployment
- All 23 services operational
- Dashboard fully functional
- Operators confident with new system

---

## VII. ROLLBACK PLAN

**If critical issues discovered**:

```
1. Stop all new SOC tasks (disable in Celery)
2. Switch frontend back to old Admin-Ops route (revert routing)
3. Restore database from pre-migration backup
4. Revert backend code to commit before SOC
5. Notify operators via Slack
6. Root cause analysis (24-48 hours)
7. Fix issues + re-test
8. Schedule re-deployment
```

**Rollback timeline**: 15-30 minutes (if prepared in advance)

---

## VIII. RESOURCE REQUIREMENTS

### Team Composition
```
1 Backend Developer (lead)
1 Frontend Developer
1 QA Engineer
1 DevOps Engineer (for deployment)
Total: 4 people
```

### Timeline (Parallel Execution)
```
Week 1-2:  Backend (8h/day) + Frontend (6h/day)
Week 2-3:  Backend (10h/day) + QA (4h/day)
Week 3-4:  Backend (8h/day) + Frontend (10h/day) + QA (4h/day)
Week 4-5:  Frontend (10h/day) + QA (6h/day)
Week 5-6:  QA (8h/day) + Backend (4h/day)
Week 6-7:  DevOps (4h/day) + QA (4h/day) + Backend (2h/day)
```

### Infrastructure
```
Development:
- Local Docker dev stack (already exists)
- Test database (copy of prod)

Staging:
- Full replica of prod
- Staging Slack channel for alerts
- Staging Celery workers

Production:
- Backup database before migration
- Extra Celery worker for SOC tasks
```

---

## IX. SUCCESS METRICS

### Technical Metrics
```
✅ API Endpoints: 50+ → 15 (70% reduction)
✅ Config Locations: 6+ → 1 (100% consolidation)
✅ Health Checks: Duplicate → Single SSOT
✅ Code Duplication: Admin-Ops + SOC → SOC only
✅ Test Coverage: >80% code coverage
✅ Deploy Time: <5 minutes (no breaking changes)
```

### Operational Metrics
```
✅ MTTR (Mean Time To Restore): Reduce from 1 hour → 10 minutes
✅ Alert Detection: From manual → Proactive Slack notifications
✅ Config Consistency: 100% (audit validation)
✅ Service Uptime: Target 99.5% across all services
✅ Operator Training: 100% team trained on SOC
```

### User Adoption Metrics
```
✅ % of manual triggers via SOC: 100% (vs 0% Admin-Ops)
✅ Config change cycle time: 5 minutes (SOC) vs 20 minutes (Admin-Ops scattered forms)
✅ Support tickets: Reduce from 2-3/week → 0/week
```

---

## X. RISK MITIGATION SUMMARY

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Config migration bug | 30% | HIGH | Double-write validation (Week 2-3) |
| Service break during cutover | 20% | HIGH | Feature flag, gradual rollout, rollback plan |
| Operator confusion (old vs new UI) | 60% | MEDIUM | Clear deprecation warnings, training docs |
| Performance regression | 10% | MEDIUM | Load testing before deployment |
| Data loss | 5% | CRITICAL | Database backup + validation script |

---

## CONCLUSION

This 7-week implementation plan replaces the fragmented Admin-Ops system with a unified Service Operations Center. The plan:

✅ Eliminates 35+ duplicate endpoints  
✅ Consolidates config from 6 locations → 1 SSOT  
✅ Enables proactive health monitoring & alerting  
✅ Sets foundation for advanced features (circuit breaker, DAG, SLA tracking)  
✅ Minimizes operational disruption with gradual deprecation  

**Next Steps**:
1. Review this plan with team
2. Adjust timeline if needed
3. Assign resources
4. Begin Phase 1 (Week 1)
5. Daily standups to track progress
