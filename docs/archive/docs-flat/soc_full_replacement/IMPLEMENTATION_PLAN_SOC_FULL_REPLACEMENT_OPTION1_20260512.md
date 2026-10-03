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

---

---

# SUPPLEMENT A — GAP ANALYSIS & DESIGN ENHANCEMENTS
**Ngày bổ sung**: 2026-05-13  
**Tác giả**: Audit AI Session  
**Lý do**: Kế hoạch gốc thiếu 3 nhóm thiết kế quan trọng; Admin-Ops hiện tại có 6 điểm vượt trội cần kế thừa; đề xuất thêm kiến trúc matrix scraping đa provider.

---

## SUPPLEMENT A.1 — NHỮNG ĐIỂM ADMIN-OPS ĐANG LÀM TỐT HƠN (PHẢI KẾ THỪA)

### A.1.1 Domain Config Schemas — Typed, không phải Generic Blob

Admin-Ops hiện quản lý **4 domain config schema** hoàn toàn khác nhau với validation rules riêng. SOC **không được** flatten thành generic `config_json` blob mà phải giữ nguyên tính typed này.

#### Domain 1: VNBroker Config Schema

```python
# backend/service_ops/domain_configs/vnbroker_config.py

from dataclasses import dataclass, field
from typing import List, Dict, Optional

VNBROKER_ALLOWED_SOURCES = frozenset({'VCI', 'KBS', 'TCBS', 'SSI', 'MSI'})

@dataclass
class VnbrokerTimeoutConfig:
    price_board: int = 8
    intraday: int = 8
    financial_ratio: int = 10
    history: int = 15
    listing: int = 15
    general: int = 10
    
    def validate(self):
        for field_name, val in self.__dict__.items():
            if not isinstance(val, int) or val < 1:
                raise ValueError(f"timeout {field_name} must be >= 1 second")

@dataclass
class VnbrokerDomainConfig:
    source_priority: List[str] = field(default_factory=lambda: ['VCI'])
    retry_backoff_seconds: float = 0.5
    rate_limit_cooldown_seconds: int = 30
    fallback_sources: List[str] = field(default_factory=lambda: ['VCI'])
    timeout_config: VnbrokerTimeoutConfig = field(default_factory=VnbrokerTimeoutConfig)
    enable_caching: bool = True
    enable_rate_limit_detection: bool = True
    enable_concurrent_limit: bool = True
    changelog: List[Dict] = field(default_factory=list)
    
    def validate(self):
        unknown = set(self.source_priority) - VNBROKER_ALLOWED_SOURCES
        if unknown:
            raise ValueError(f"Unknown sources: {unknown}. Allowed: {VNBROKER_ALLOWED_SOURCES}")
        if self.retry_backoff_seconds < 0:
            raise ValueError("retry_backoff_seconds must be >= 0")
        self.timeout_config.validate()
    
    @classmethod
    def from_json(cls, data: dict) -> 'VnbrokerDomainConfig':
        timeout = VnbrokerTimeoutConfig(**data.pop('timeout_config', {}))
        return cls(timeout_config=timeout, **data)
    
    def to_json(self) -> dict:
        d = self.__dict__.copy()
        d['timeout_config'] = self.timeout_config.__dict__
        return d

# Rulebook for frontend validation
VNBROKER_RULEBOOK = {
    'source_priority': {'type': 'array<str>', 'allowed': list(VNBROKER_ALLOWED_SOURCES)},
    'retry_backoff_seconds': {'type': 'float', 'min': 0},
    'rate_limit_cooldown_seconds': {'type': 'int', 'min': 5},
    'timeout_config': {
        'price_board': {'type': 'int', 'min': 1, 'max': 60},
        'intraday': {'type': 'int', 'min': 1, 'max': 60},
    },
    'recommended': VnbrokerDomainConfig().to_json(),
}
```

#### Domain 2: Prefetch Time Policy Schema

```python
# backend/service_ops/domain_configs/prefetch_time_policy.py

@dataclass
class PrefetchProfile:
    query_enabled: bool = True
    interval_seconds: int = 35
    batch_size: int = 20
    symbol_limit: int = 40
    max_retries: int = 4
    
    def validate(self):
        assert self.interval_seconds >= 1, "interval_seconds >= 1"
        assert self.batch_size >= 1, "batch_size >= 1"
        assert self.max_retries >= 0, "max_retries >= 0"

PREFETCH_PROFILE_KEYS = [
    'pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours'
]

@dataclass
class PrefetchMarketConfig:
    open_time: str = '09:00'
    close_time: str = '15:00'
    pre_open_minutes: int = 30
    post_close_minutes: int = 30
    holiday_dates: List[str] = field(default_factory=list)
    lunch_break_enabled: bool = True
    lunch_start: str = '11:30'
    lunch_end: str = '13:00'
    weekend_mode: str = 'offhours'

@dataclass
class PrefetchTimePolicyConfig:
    timezone: str = 'Asia/Ho_Chi_Minh'
    market_code: str = 'VN_STOCK'
    market: PrefetchMarketConfig = field(default_factory=PrefetchMarketConfig)
    profiles: Dict[str, PrefetchProfile] = field(default_factory=lambda: {
        k: PrefetchProfile() for k in PREFETCH_PROFILE_KEYS
    })
    jitter_percent: float = 15.0
    cooldown_multiplier_on_429: float = 2.0
    max_interval_seconds: int = 1800
    
    def validate(self):
        missing = set(PREFETCH_PROFILE_KEYS) - set(self.profiles.keys())
        if missing:
            raise ValueError(f"Missing profiles: {missing}")
        for name, profile in self.profiles.items():
            profile.validate()
        assert 0 <= self.jitter_percent <= 50, "jitter_percent must be 0-50"

# Rulebook for frontend validation
PREFETCH_TIME_POLICY_RULEBOOK = {
    'profiles': {
        'interval_seconds_min': 1,
        'batch_size_min': 1,
        'symbol_limit_min': 0,
        'max_retries_min': 0,
    },
    'jitter_percent': {'min': 0, 'max': 50},
    'cooldown_multiplier_on_429': {'min': 1.0},
    'max_interval_seconds': {'min': 60},
}
```

#### Domain 3: Signal Services Schema

```python
# backend/service_ops/domain_configs/signal_services_config.py

@dataclass
class WhaleServiceConfig:
    enabled: bool = True
    default_threshold_vnd: int = 500_000_000
    cooldown_seconds: int = 120
    
    def validate(self):
        assert self.default_threshold_vnd >= 1_000_000, "threshold must be >= 1M VND"
        assert self.cooldown_seconds >= 0

@dataclass
class DarkFlowServiceConfig:
    enabled: bool = True
    window_seconds: int = 300
    warning_strength: int = 40
    urgent_strength: int = 70
    cooldown_seconds: int = 300
    
    def validate(self):
        assert 0 <= self.warning_strength < self.urgent_strength <= 100
        assert self.window_seconds >= 30

@dataclass
class SignalDistributionConfig:
    websocket_enabled: bool = True
    history_enabled: bool = True
    fanout_batch_size: int = 200

@dataclass
class SignalServicesDomainConfig:
    enabled: bool = True
    whale_service: WhaleServiceConfig = field(default_factory=WhaleServiceConfig)
    dark_flow_service: DarkFlowServiceConfig = field(default_factory=DarkFlowServiceConfig)
    distribution: SignalDistributionConfig = field(default_factory=SignalDistributionConfig)
    
    def validate(self):
        self.whale_service.validate()
        self.dark_flow_service.validate()
```

#### Domain 4: Screener Config Schema

```python
# backend/service_ops/domain_configs/screener_config.py

import re

VALID_CRON_PATTERN = re.compile(
    r'^(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)$'
)

@dataclass
class ScreenerDomainConfig:
    cron_expression: str = '*/5 * * * *'
    is_user_custom_screener_enabled: bool = True
    
    def validate(self):
        if not VALID_CRON_PATTERN.match(self.cron_expression.strip()):
            raise ValueError(f"Invalid cron expression: {self.cron_expression}")
```

#### Integrate vào ServiceDefinition

```python
# backend/service_ops/models.py

DOMAIN_CONFIG_CLASSES = {
    'vnbroker': VnbrokerDomainConfig,
    'realtime_prefetch': PrefetchTimePolicyConfig,
    'signal_intelligence': SignalServicesDomainConfig,
    'screener': ScreenerDomainConfig,
}

class ServiceDefinition(models.Model):
    ...
    domain = models.CharField(max_length=64)
    config_json = models.JSONField(default=dict)
    
    def get_typed_config(self):
        """Return validated typed config object for this domain"""
        cls = DOMAIN_CONFIG_CLASSES.get(self.domain)
        if cls is None:
            return self.config_json  # Generic fallback
        return cls.from_json(self.config_json.copy())
    
    def set_typed_config(self, typed_config):
        """Validate then save typed config"""
        typed_config.validate()
        self.config_json = typed_config.to_json()
```

---

### A.1.2 Signal Governance / Ownership Matrix — Phải giữ nguyên

Admin-Ops hiện tại có **Ownership Matrix** trả về trong mỗi response, điều khiển write-guards trong frontend. SOC **phải kế thừa** mechanism này, không đơn giản hoá thành `enabled=True/False`.

```python
# backend/service_ops/ownership.py

from enum import Enum

class OwnershipStatus(str, Enum):
    NATIVE_WRITE = 'native-write'           # SOC owns fully, can write
    BRIDGE_WRITE = 'bridge-write'           # SOC routes write through legacy bridge
    READ_PREVIEW = 'read-preview'           # SOC read-only, legacy owns write
    GUARDED_WRITE = 'guarded-write'         # SOC owns with additional approval gate
    BRIDGE_PREVIEW = 'bridge-preview'       # Read from bridge, preview only

WRITABLE_STATUSES = frozenset({
    OwnershipStatus.NATIVE_WRITE,
    OwnershipStatus.BRIDGE_WRITE,
    OwnershipStatus.GUARDED_WRITE,
})

@dataclass
class DomainOwnershipEntry:
    owner: str
    status: OwnershipStatus
    notes: str = ''

@dataclass  
class ServiceOwnershipMatrix:
    """Attached to each ServiceDefinition response; frontend reads this to enable/disable write controls"""
    surface: str
    mode: str  # e.g., 'native-read-preview', 'native-read-legacy-write-through'
    domains: Dict[str, DomainOwnershipEntry] = field(default_factory=dict)
    compatibility: Dict[str, DomainOwnershipEntry] = field(default_factory=dict)
    deprecation_notes: List[str] = field(default_factory=list)
    
    def is_domain_writable(self, domain_key: str) -> bool:
        entry = self.domains.get(domain_key)
        if entry is None:
            return True  # Unknown domain: allow by default
        return entry.status in WRITABLE_STATUSES
    
    def get_write_block_reason(self, domain_key: str) -> Optional[str]:
        entry = self.domains.get(domain_key)
        if entry is None or entry.status in WRITABLE_STATUSES:
            return None
        return (
            f"Domain '{domain_key}' bị khóa write: "
            f"owner={entry.owner}, status={entry.status}. {entry.notes}"
        )
    
    def to_response_dict(self) -> dict:
        return {
            'surface': self.surface,
            'mode': self.mode,
            'domains': {
                k: {'owner': v.owner, 'status': v.status, 'notes': v.notes}
                for k, v in self.domains.items()
            },
            'deprecation_notes': self.deprecation_notes,
        }
```

#### Ownership Matrix mặc định cho từng domain

```python
# Per-domain ownership SSOT
SIGNAL_INTELLIGENCE_OWNERSHIP = ServiceOwnershipMatrix(
    surface='signal_control_center',
    mode='native-read-legacy-write-through',
    domains={
        'services_config': DomainOwnershipEntry(
            owner='legacy-global-signal-policy', status=OwnershipStatus.BRIDGE_WRITE,
            notes='Signal config write goes through legacy SSOT bridge'
        ),
        'universe_policy': DomainOwnershipEntry(
            owner='legacy-global-signal-policy', status=OwnershipStatus.BRIDGE_WRITE,
        ),
        'retention_policy': DomainOwnershipEntry(
            owner='data-ops-runtime-policy', status=OwnershipStatus.READ_PREVIEW,
            notes='Retention owned by Data Ops; Signal Center read-only preview'
        ),
        'materialization_preview': DomainOwnershipEntry(
            owner='core-market-serving', status=OwnershipStatus.NATIVE_WRITE,
        ),
        'jobs': DomainOwnershipEntry(
            owner='core-admin-ops', status=OwnershipStatus.GUARDED_WRITE,
        ),
        'whale_governance': DomainOwnershipEntry(
            owner='whale-mission-control', status=OwnershipStatus.BRIDGE_PREVIEW,
            notes='Whale policy via pending/draft bridge; requires mission-control approval'
        ),
    },
    deprecation_notes=[
        'Signal policy writer vẫn thuộc legacy global-signal SSOT; SOC ở slice này chỉ mở native read-side và preview an toàn.',
        'raw_intraday_keep_days vẫn do Data Ops runtime owner quyết định.',
    ]
)

VNBROKER_OWNERSHIP = ServiceOwnershipMatrix(
    surface='data_ops_center',
    mode='native-write',
    domains={
        'vnbroker_config': DomainOwnershipEntry(owner='core-admin-ops', status=OwnershipStatus.NATIVE_WRITE),
        'benchmark': DomainOwnershipEntry(owner='core-admin-ops', status=OwnershipStatus.NATIVE_WRITE),
        'changelog': DomainOwnershipEntry(owner='core-admin-ops', status=OwnershipStatus.NATIVE_WRITE),
    }
)
```

---

### A.1.3 Preview Endpoints — Phải có diff + impact trước khi apply

Admin-Ops có 5 preview endpoints với semantic "xem trước thay đổi". SOC phải giữ pattern này:

```python
# backend/service_ops/views/preview_mixin.py

class ConfigPreviewMixin:
    """
    Mixin cho mọi config update endpoint.
    GET ?preview=1 → trả về diff + impacted_count + warnings, không apply
    POST/PUT → apply thật
    """
    
    def get_config_diff(self, current_config, proposed_config) -> dict:
        """Return human-readable diff between current and proposed config"""
        diff = {}
        for key in set(list(current_config.keys()) + list(proposed_config.keys())):
            old_val = current_config.get(key)
            new_val = proposed_config.get(key)
            if old_val != new_val:
                diff[key] = {'from': old_val, 'to': new_val}
        return diff
    
    def estimate_impact(self, service_id, proposed_config) -> dict:
        """Estimate how many symbols/tasks will be affected by this config change"""
        # Domain-specific impact calculation
        from signal_intelligence.models import WhaleAlertCanonical
        from market_serving.models import SymbolSnapshot
        
        if service_id == 'signal_whale_detection':
            new_threshold = proposed_config.get('default_threshold_vnd', 500_000_000)
            affected = WhaleAlertCanonical.objects.filter(
                amount_vnd__lt=new_threshold
            ).count()
            return {
                'signals_would_be_suppressed': affected,
                'warning': f'{affected} historical signals below new threshold' if affected else None
            }
        
        return {'estimated_symbols': SymbolSnapshot.objects.count()}
```

---

## SUPPLEMENT A.2 — SYMBOL UNIVERSE MATRIX: KIẾN TRÚC SONG SONG ĐA PROVIDER

### A.2.1 Vấn đề hiện tại

Hiện tại prefetch shard logic chạy theo shard tuyến tính:
- Shard 1: VCI → symbols 1-50
- Shard 2: VCI → symbols 51-100
- Không có provider awareness, không có fallback assignment, không có dedup guarantee

**Hậu quả**: Khi VCI rate-limit (429), toàn bộ queue bị block. Không tận dụng được KBS/TCBS/SSI song song.

### A.2.2 Symbol Universe Matrix Design

```
Khái niệm: ma trận (SymbolGroup × Provider) với state machine per cell

             VCI    KBS    TCBS   SSI
            ──────────────────────────
Group A (G1) [DONE] [    ] [    ] [    ]  ← VCI đã lấy xong, các cột khác trống
Group B (G2) [FAIL] [DONE] [    ] [    ]  ← VCI thất bại, KBS lấy xong
Group C (G3) [    ] [    ] [WORK] [    ]  ← TCBS đang lấy
Group D (G4) [WORK] [    ] [    ] [    ]  ← VCI đang lấy
Group E (G5) [PEND] [PEND] [    ] [    ]  ← Chờ assignment
...
```

**Rules**:
1. Mỗi row (SymbolGroup) chỉ cần **một cell DONE** là xong — không cần tất cả providers lấy xong
2. Một cell được **claim trước khi scrape** (optimistic lock với TTL)
3. Nếu cell FAIL, coordinator assign row đó sang provider khác
4. Coordinator track **provider load** để balance

### A.2.3 Database Models

```python
# backend/service_ops/models_matrix.py

from django.db import models
import uuid
from django.utils import timezone
from datetime import timedelta

class ScrapeMatrix(models.Model):
    """
    Một scrape cycle — ma trận đầy đủ cho một lần chạy.
    Mỗi cycle có nhiều ScrapeMatrixCell (rows × providers).
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    
    DATA_TYPE_CHOICES = [
        ('realtime_price', 'Giá realtime'),
        ('ohlcv_daily', 'OHLCV ngày'),
        ('intraday_tape', 'Tape intraday'),
        ('financial_ratio', 'Chỉ số tài chính'),
        ('price_board_snapshot', 'Bảng giá snapshot'),
    ]
    data_type = models.CharField(max_length=64, choices=DATA_TYPE_CHOICES)
    
    TIER_CHOICES = [('hot', 'Hot'), ('warm', 'Warm'), ('cold', 'Cold')]
    tier = models.CharField(max_length=16, choices=TIER_CHOICES, default='hot')
    
    # Trạng thái cycle
    STATUS_CHOICES = [
        ('planning', 'Đang lên kế hoạch'),
        ('in_progress', 'Đang chạy'),
        ('completed', 'Hoàn thành'),
        ('partial', 'Hoàn thành một phần'),
        ('failed', 'Thất bại'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='planning')
    
    # Thống kê
    total_symbols = models.IntegerField(default=0)
    completed_symbols = models.IntegerField(default=0)
    failed_symbols = models.IntegerField(default=0)
    
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    # Metadata
    triggered_by = models.CharField(max_length=64, default='scheduled')
    session_label = models.CharField(max_length=128, blank=True)  # e.g., 'market_open_2026-05-13'
    
    class Meta:
        indexes = [
            models.Index(fields=['data_type', 'tier', '-started_at']),
            models.Index(fields=['status']),
        ]
        ordering = ['-started_at']
    
    def completion_rate(self) -> float:
        if self.total_symbols == 0:
            return 0.0
        return self.completed_symbols / self.total_symbols
    
    def is_done(self) -> bool:
        """True khi tất cả symbols đã có ít nhất một cell DONE"""
        return self.cells.filter(
            status__in=['pending', 'claimed', 'in_progress']
        ).count() == 0


class ScrapeMatrixCell(models.Model):
    """
    Một ô trong ma trận: (ScrapeMatrix, SymbolGroup, Provider).
    State machine: pending → claimed → in_progress → done / failed → reassigned
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    matrix = models.ForeignKey(ScrapeMatrix, on_delete=models.CASCADE, related_name='cells')
    
    # Định danh ô
    group_key = models.CharField(max_length=64)           # e.g., 'hot_0', 'hot_1', 'warm_vn30'
    symbols = models.JSONField()                           # ['VCB', 'VPB', 'TCB', ...] (≤50 symbols)
    symbol_count = models.IntegerField()
    
    PROVIDER_CHOICES = [
        ('VCI', 'VCI'), ('KBS', 'KBS'), ('TCBS', 'TCBS'), ('SSI', 'SSI'), ('MSI', 'MSI'),
    ]
    provider = models.CharField(max_length=16, choices=PROVIDER_CHOICES)
    
    # Priority: lower = higher priority
    priority = models.IntegerField(default=100)
    
    # State machine
    STATUS_CHOICES = [
        ('pending', 'Chờ'),
        ('claimed', 'Đã nhận'),
        ('in_progress', 'Đang lấy'),
        ('done', 'Xong'),
        ('failed', 'Lỗi'),
        ('reassigned', 'Đã chuyển provider'),
        ('skipped', 'Bỏ qua (row đã done bởi provider khác)'),
    ]
    status = models.CharField(max_length=32, choices=STATUS_CHOICES, default='pending')
    
    # Claim info (optimistic lock)
    claimed_by_worker = models.CharField(max_length=256, null=True, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True)
    claim_ttl_seconds = models.IntegerField(default=30)        # Claim hết hạn sau N giây
    last_heartbeat_at = models.DateTimeField(null=True, blank=True)
    
    # Execution
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    
    # Results
    fetched_count = models.IntegerField(default=0)
    failed_symbol_list = models.JSONField(default=list)       # Symbols that failed
    error_message = models.TextField(blank=True)
    retry_count = models.IntegerField(default=0)
    
    # Reassignment tracking
    previous_provider = models.CharField(max_length=16, blank=True)
    reassignment_reason = models.CharField(max_length=256, blank=True)
    
    class Meta:
        unique_together = [['matrix', 'group_key', 'provider']]
        indexes = [
            models.Index(fields=['matrix', 'status', 'priority']),
            models.Index(fields=['claimed_by_worker', 'status']),
            models.Index(fields=['claim_ttl_seconds', 'claimed_at']),
        ]
    
    def is_claim_expired(self) -> bool:
        if self.claimed_at is None:
            return False
        deadline = self.claimed_at + timedelta(seconds=self.claim_ttl_seconds)
        # Extend by heartbeat
        if self.last_heartbeat_at and self.last_heartbeat_at > self.claimed_at:
            deadline = self.last_heartbeat_at + timedelta(seconds=self.claim_ttl_seconds)
        return timezone.now() > deadline
    
    @classmethod
    def try_claim(cls, cell_id: str, worker_id: str) -> bool:
        """
        Atomic claim: chỉ thành công nếu cell vẫn pending.
        Sử dụng select_for_update để tránh race condition.
        """
        from django.db import transaction
        with transaction.atomic():
            cell = cls.objects.select_for_update().filter(
                id=cell_id, status='pending'
            ).first()
            if cell is None:
                return False
            cell.status = 'claimed'
            cell.claimed_by_worker = worker_id
            cell.claimed_at = timezone.now()
            cell.save(update_fields=['status', 'claimed_by_worker', 'claimed_at'])
            return True


class SymbolGroupConfig(models.Model):
    """
    Cấu hình nhóm symbol: quy tắc phân nhóm, provider affinity, và tier assignment.
    """
    group_key = models.CharField(max_length=64, unique=True)
    display_name = models.CharField(max_length=128)
    
    TIER_CHOICES = [('hot', 'Hot'), ('warm', 'Warm'), ('cold', 'Cold')]
    tier = models.CharField(max_length=16, choices=TIER_CHOICES)
    
    # Danh sách symbol
    symbols = models.JSONField()
    symbol_count = models.IntegerField()
    
    # Provider affinity (providers phù hợp nhất cho group này)
    preferred_providers = models.JSONField(default=list)      # ['VCI', 'KBS']
    fallback_providers = models.JSONField(default=list)       # ['TCBS', 'SSI']
    
    # Rate limit hints
    max_concurrent_per_provider = models.IntegerField(default=2)
    
    updated_at = models.DateTimeField(auto_now=True)
```

### A.2.4 Matrix Coordinator

```python
# backend/service_ops/matrix_coordinator.py

from celery import shared_task
from django.db import transaction
from .models_matrix import ScrapeMatrix, ScrapeMatrixCell, SymbolGroupConfig
import uuid

class MatrixCoordinator:
    """
    Điều phối một scrape cycle:
    1. Tạo ScrapeMatrix
    2. Phân cell cho providers (assignment algorithm)
    3. Dispatch Celery tasks
    4. Monitor + reassign failed cells
    5. Mark cycle complete
    """
    
    def __init__(self, data_type: str, tier: str = 'hot'):
        self.data_type = data_type
        self.tier = tier
    
    def build_matrix(self, session_label: str = '') -> ScrapeMatrix:
        """
        Bước 1: Tạo matrix mới từ SymbolGroupConfig.
        Mỗi group được assign cho một primary provider.
        """
        groups = SymbolGroupConfig.objects.filter(tier=self.tier)
        matrix = ScrapeMatrix.objects.create(
            data_type=self.data_type,
            tier=self.tier,
            total_symbols=sum(g.symbol_count for g in groups),
            session_label=session_label or f'{self.data_type}_{self.tier}_{uuid.uuid4().hex[:8]}',
        )
        
        cells_to_create = []
        for i, group in enumerate(groups):
            # Primary provider = preferred_providers[0] (nếu có) hoặc VCI mặc định
            primary_provider = (
                group.preferred_providers[0]
                if group.preferred_providers else 'VCI'
            )
            cells_to_create.append(ScrapeMatrixCell(
                matrix=matrix,
                group_key=group.group_key,
                symbols=group.symbols,
                symbol_count=group.symbol_count,
                provider=primary_provider,
                priority=i,  # priority theo thứ tự tier sort
                status='pending',
            ))
        
        ScrapeMatrixCell.objects.bulk_create(cells_to_create)
        return matrix
    
    def dispatch_all(self, matrix: ScrapeMatrix):
        """
        Bước 2: Dispatch Celery tasks cho tất cả pending cells.
        Tôn trọng provider concurrency limits.
        """
        pending_cells = matrix.cells.filter(status='pending').order_by('priority')
        
        provider_dispatch_count = {}
        MAX_CONCURRENT_PER_PROVIDER = 4
        
        for cell in pending_cells:
            count = provider_dispatch_count.get(cell.provider, 0)
            if count >= MAX_CONCURRENT_PER_PROVIDER:
                continue  # Skip: provider đã đạt giới hạn concurrent
            
            scrape_cell_task.delay(str(cell.id))
            provider_dispatch_count[cell.provider] = count + 1
    
    def reassign_failed_cells(self, matrix: ScrapeMatrix):
        """
        Bước 3: Với các cell FAILED hoặc claim expired, 
        assign lại sang fallback provider.
        """
        # Thu hồi expired claims
        for cell in matrix.cells.filter(status='claimed'):
            if cell.is_claim_expired():
                cell.status = 'pending'
                cell.claimed_by_worker = None
                cell.claimed_at = None
                cell.save(update_fields=['status', 'claimed_by_worker', 'claimed_at'])
        
        failed_cells = matrix.cells.filter(status='failed')
        for cell in failed_cells:
            group_config = SymbolGroupConfig.objects.filter(
                group_key=cell.group_key
            ).first()
            
            if group_config is None:
                continue
            
            # Tìm fallback provider chưa thử
            tried_providers = {cell.provider, cell.previous_provider}
            fallbacks = [
                p for p in group_config.fallback_providers
                if p not in tried_providers
            ]
            
            if not fallbacks:
                # Không còn provider nào → đánh dấu permanent failure
                continue
            
            next_provider = fallbacks[0]
            
            # Tạo cell mới với provider mới
            ScrapeMatrixCell.objects.create(
                matrix=matrix,
                group_key=cell.group_key,
                symbols=cell.symbols,
                symbol_count=cell.symbol_count,
                provider=next_provider,
                priority=cell.priority,
                previous_provider=cell.provider,
                reassignment_reason=f'Primary {cell.provider} failed: {cell.error_message[:100]}',
                status='pending',
            )
            
            # Đánh dấu cell cũ là reassigned
            cell.status = 'reassigned'
            cell.save(update_fields=['status'])
    
    def check_completion(self, matrix: ScrapeMatrix) -> bool:
        """
        Bước 4: Kiểm tra xem tất cả row đã có ít nhất một cell DONE chưa.
        Nếu có row chưa done → partial.
        """
        done_groups = set(
            matrix.cells.filter(status='done').values_list('group_key', flat=True)
        )
        all_groups = set(
            SymbolGroupConfig.objects.filter(tier=self.tier).values_list('group_key', flat=True)
        )
        
        undone = all_groups - done_groups
        
        if not undone:
            matrix.status = 'completed'
            matrix.completed_at = timezone.now()
            matrix.save(update_fields=['status', 'completed_at'])
            return True
        
        # Check nếu tất cả undone groups đều đã failed hết providers
        has_hope = matrix.cells.filter(
            group_key__in=undone,
            status__in=['pending', 'claimed', 'in_progress']
        ).exists()
        
        if not has_hope:
            matrix.status = 'partial'
            matrix.completed_at = timezone.now()
            matrix.save(update_fields=['status', 'completed_at'])
        
        return False


@shared_task(
    name='service_ops.scrape_cell_task',
    bind=True,
    max_retries=3,
    soft_time_limit=25,
    time_limit=30,
)
def scrape_cell_task(self, cell_id: str):
    """
    Worker task: nhận một cell, claim, scrape, report.
    """
    from market_data.vnbroker_adapter import (
        fetch_realtime_price, fetch_price_board_snapshot
    )
    
    worker_id = self.request.hostname
    
    # Claim cell
    claimed = ScrapeMatrixCell.try_claim(cell_id, worker_id)
    if not claimed:
        # Cell đã được claim bởi worker khác → skip
        return {'skipped': True, 'reason': 'already_claimed'}
    
    cell = ScrapeMatrixCell.objects.get(id=cell_id)
    cell.status = 'in_progress'
    cell.started_at = timezone.now()
    cell.save(update_fields=['status', 'started_at'])
    
    try:
        # Kiểm tra xem row đã done bởi provider khác chưa
        already_done = ScrapeMatrixCell.objects.filter(
            matrix=cell.matrix,
            group_key=cell.group_key,
            status='done',
        ).exclude(id=cell.id).exists()
        
        if already_done:
            cell.status = 'skipped'
            cell.save(update_fields=['status'])
            return {'skipped': True, 'reason': 'row_already_done_by_another_provider'}
        
        # Gọi SSOT adapter
        if cell.matrix.data_type == 'realtime_price':
            results = fetch_price_board_snapshot(cell.symbols)
        elif cell.matrix.data_type == 'intraday_tape':
            results = {s: fetch_realtime_price(s) for s in cell.symbols}
        else:
            raise NotImplementedError(f"data_type={cell.matrix.data_type}")
        
        # Heartbeat trong khi scrape
        cell.last_heartbeat_at = timezone.now()
        cell.save(update_fields=['last_heartbeat_at'])
        
        # Đánh dấu done
        cell.status = 'done'
        cell.fetched_count = len(results)
        cell.completed_at = timezone.now()
        cell.duration_seconds = (cell.completed_at - cell.started_at).total_seconds()
        cell.save(update_fields=['status', 'fetched_count', 'completed_at', 'duration_seconds'])
        
        # Update matrix counter
        ScrapeMatrix.objects.filter(id=cell.matrix_id).update(
            completed_symbols=models.F('completed_symbols') + cell.fetched_count
        )
        
        return {'done': True, 'fetched': cell.fetched_count}
    
    except Exception as exc:
        cell.status = 'failed'
        cell.error_message = str(exc)[:500]
        cell.retry_count += 1
        cell.save(update_fields=['status', 'error_message', 'retry_count'])
        
        ScrapeMatrix.objects.filter(id=cell.matrix_id).update(
            failed_symbols=models.F('failed_symbols') + cell.symbol_count
        )
        
        raise  # Let Celery handle retry


@shared_task(name='service_ops.run_scrape_cycle')
def run_scrape_cycle(data_type: str, tier: str = 'hot', session_label: str = ''):
    """
    Entry point: tạo cycle, build matrix, dispatch.
    Được gọi bởi Celery Beat theo schedule.
    """
    coordinator = MatrixCoordinator(data_type=data_type, tier=tier)
    matrix = coordinator.build_matrix(session_label=session_label)
    matrix.status = 'in_progress'
    matrix.started_at = timezone.now()
    matrix.save(update_fields=['status', 'started_at'])
    
    coordinator.dispatch_all(matrix)
    return {'matrix_id': str(matrix.id), 'total_symbols': matrix.total_symbols}


@shared_task(name='service_ops.monitor_scrape_cycle')
def monitor_scrape_cycle(matrix_id: str):
    """
    Monitor task chạy mỗi 15 giây: reassign failed cells + check completion.
    """
    try:
        matrix = ScrapeMatrix.objects.get(id=matrix_id)
    except ScrapeMatrix.DoesNotExist:
        return
    
    if matrix.status in ('completed', 'partial', 'failed'):
        return  # Cycle đã kết thúc
    
    coordinator = MatrixCoordinator(data_type=matrix.data_type, tier=matrix.tier)
    coordinator.reassign_failed_cells(matrix)
    
    # Dispatch lại pending cells mới (từ reassignment)
    new_pending = matrix.cells.filter(status='pending')
    for cell in new_pending:
        scrape_cell_task.delay(str(cell.id))
    
    coordinator.check_completion(matrix)
```

### A.2.5 REST Endpoints cho Matrix Dashboard

```python
# backend/service_ops/views/matrix_views.py

class ScrapeMatrixViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ScrapeMatrix.objects.all()
    serializer_class = ScrapeMatrixSerializer
    filterset_fields = ['data_type', 'tier', 'status']
    ordering = ['-started_at']
    
    @action(detail=False, methods=['post'])
    def trigger_cycle(self, request):
        """POST /api/soc/matrix/trigger_cycle/"""
        data_type = request.data.get('data_type', 'realtime_price')
        tier = request.data.get('tier', 'hot')
        
        task = run_scrape_cycle.delay(data_type=data_type, tier=tier)
        return Response({'task_id': task.id, 'status': 'dispatched'}, status=202)
    
    @action(detail=True, methods=['get'])
    def cell_heatmap(self, request, pk=None):
        """GET /api/soc/matrix/{id}/cell_heatmap/ — Matrix visualization data"""
        matrix = self.get_object()
        cells = matrix.cells.values(
            'group_key', 'provider', 'status', 'fetched_count',
            'duration_seconds', 'retry_count'
        )
        return Response({
            'matrix_id': str(matrix.id),
            'data_type': matrix.data_type,
            'completion_rate': matrix.completion_rate(),
            'cells': list(cells),
        })
    
    @action(detail=True, methods=['get'])
    def progress(self, request, pk=None):
        """GET /api/soc/matrix/{id}/progress/ — Live progress polling"""
        matrix = self.get_object()
        return Response({
            'status': matrix.status,
            'total_symbols': matrix.total_symbols,
            'completed_symbols': matrix.completed_symbols,
            'failed_symbols': matrix.failed_symbols,
            'completion_pct': round(matrix.completion_rate() * 100, 1),
            'elapsed_seconds': (
                (timezone.now() - matrix.started_at).total_seconds()
                if matrix.started_at else None
            ),
        })
```

---

## SUPPLEMENT A.3 — BACKEND API DESIGN CHI TIẾT (PER SERVICE DOMAIN)

### A.3.1 URL Structure chuẩn hóa

```python
# packages/core/backend/src/vninvest_core/contracts/soc/urls.py

from django.urls import path, include
from rest_framework import routers

router = routers.DefaultRouter()
router.register(r'services', ServiceDefinitionViewSet, basename='soc-service')
router.register(r'health', ServiceHealthViewSet, basename='soc-health')
router.register(r'runs', ServiceRunViewSet, basename='soc-run')
router.register(r'config', ServiceConfigViewSet, basename='soc-config')
router.register(r'matrix', ScrapeMatrixViewSet, basename='soc-matrix')

urlpatterns = [
    path('', include(router.urls)),
    
    # Domain-specific endpoints (preserve Admin-Ops semantic)
    path('domains/vnbroker/', include('service_ops.domain_urls.vnbroker')),
    path('domains/prefetch/', include('service_ops.domain_urls.prefetch')),
    path('domains/signals/', include('service_ops.domain_urls.signals')),
    path('domains/screener/', include('service_ops.domain_urls.screener')),
    
    # Matrix scraping
    path('matrix/', include('service_ops.domain_urls.matrix')),
    
    # Operator views
    path('operator/overview/', OperatorOverviewView.as_view(), name='soc-operator-overview'),
    path('operator/health/', OperatorHealthView.as_view(), name='soc-operator-health'),
]

# In core urls.py: path('api/soc/', include('vninvest_core.contracts.soc.urls'))
```

### A.3.2 VNBroker Domain Endpoints

```
GET  /api/soc/domains/vnbroker/config/current/         → typed VnbrokerDomainConfig + ownership
PUT  /api/soc/domains/vnbroker/config/update/          → validate + save + changelog entry
POST /api/soc/domains/vnbroker/config/reset/           → reset to defaults
GET  /api/soc/domains/vnbroker/config/changelog/       → cursor-paginated audit log
GET  /api/soc/domains/vnbroker/benchmark/latest/       → latest benchmark report
POST /api/soc/domains/vnbroker/benchmark/run/          → trigger async benchmark task
GET  /api/soc/domains/vnbroker/config/preview/         → diff vs current + impact estimate
```

**Response contract mẫu cho `config/current/`**:
```json
{
  "ok": true,
  "domain": "vnbroker",
  "config": {
    "source_priority": ["VCI"],
    "retry_backoff_seconds": 0.5,
    "rate_limit_cooldown_seconds": 30,
    "fallback_sources": ["VCI"],
    "timeout_config": {
      "price_board": 8,
      "intraday": 8,
      "history": 15
    },
    "enable_caching": true
  },
  "ownership": {
    "surface": "data_ops_center",
    "mode": "native-write",
    "domains": {
      "vnbroker_config": {"owner": "core-admin-ops", "status": "native-write"}
    }
  },
  "rulebook": {
    "source_priority": {"allowed": ["VCI", "KBS", "TCBS", "SSI", "MSI"]},
    "timeout_config": {"price_board": {"min": 1, "max": 60}}
  },
  "version": 7,
  "updated_at": "2026-05-13T08:00:00Z"
}
```

### A.3.3 Prefetch Domain Endpoints

```
GET  /api/soc/domains/prefetch/time-policy/            → PrefetchTimePolicyConfig + 6 profiles
PUT  /api/soc/domains/prefetch/time-policy/            → validate all profiles + save
GET  /api/soc/domains/prefetch/time-policy/preview/    → diff + affected schedule count
POST /api/soc/domains/prefetch/warm/                   → trigger warm task với symbols list
GET  /api/soc/domains/prefetch/runtime-settings/       → current runtime settings snapshot
PUT  /api/soc/domains/prefetch/runtime-settings/       → update runtime settings
POST /api/soc/domains/prefetch/intraday-universe/warm-now/  → warm intraday universe
```

### A.3.4 Signal Intelligence Domain Endpoints

```
GET  /api/soc/domains/signals/summary/                 → lifecycle + materialization lag + ownership
GET  /api/soc/domains/signals/config/                  → SignalServicesDomainConfig + ownership matrix
GET  /api/soc/domains/signals/config/preview/          → diff + impact (thresholds → N signals suppressed)
PUT  /api/soc/domains/signals/config/                  → [GUARDED] validate + bridge-write to legacy SSOT
GET  /api/soc/domains/signals/universe/preview/        → preview detection universe (total symbols)
POST /api/soc/domains/signals/universe/apply/          → [GUARDED] apply universe via bridge
GET  /api/soc/domains/signals/materialization/preview/ → materialization forecast + impacted_counts
GET  /api/soc/domains/signals/retention/preview/       → retention preview + estimated freed storage
GET  /api/soc/domains/signals/events/recent/           → recent events với symbol_filter + cursor
GET  /api/soc/domains/signals/jobs/                    → IngestRun list với cursor pagination
POST /api/soc/domains/signals/jobs/run/                → [GUARDED] manual trigger
POST /api/soc/domains/signals/jobs/{id}/retry/         → [GUARDED] retry failed job
GET  /api/soc/domains/signals/whale-governance/        → whale mission-control bridge preview
```

### A.3.5 Screener Domain Endpoints

```
GET  /api/soc/domains/screener/config/                 → ScreenerDomainConfig
PUT  /api/soc/domains/screener/config/                 → update cron + enabled flag
GET  /api/soc/domains/screener/rules/                  → list GlobalScreenerRule
POST /api/soc/domains/screener/rules/                  → create rule
PUT  /api/soc/domains/screener/rules/{id}/             → update rule
DELETE /api/soc/domains/screener/rules/{id}/           → delete rule
POST /api/soc/domains/screener/run-manual/             → trigger manual screener run
```

---

## SUPPLEMENT A.4 — FRONTEND COMPONENT DESIGN (TAILWIND DARK THEME)

### A.4.1 Design System — Phải nhất quán với Admin-Ops hiện tại

**Màu sắc chuẩn**:
```
Background:     bg-slate-950       #020617
Card:           bg-slate-950/70    với border-slate-800
Surface light:  bg-slate-900/70
Text primary:   text-slate-100
Text secondary: text-slate-400
Text muted:     text-slate-500

Status colors:
  Healthy/Done:   text-emerald-300  bg-emerald-500/10  border-emerald-500/40
  Degraded/Warn:  text-amber-300    bg-amber-500/10    border-amber-500/40
  Unhealthy/Fail: text-rose-300     bg-rose-500/10     border-rose-500/40
  Running:        text-sky-300      bg-sky-500/10      border-sky-500/40
  Pending:        text-slate-300    bg-slate-900       border-slate-700
  
Ownership badges:
  Owner:          text-cyan-200     bg-cyan-500/10     border-cyan-500/30
  Mode:           text-violet-200   bg-violet-500/10   border-violet-500/30
  Status:         text-slate-300    bg-slate-900       border-slate-700
```

### A.4.2 Component Library cho SOC

#### Component 1: `ServiceHealthCard.jsx`
```jsx
// frontend/src/components/soc/ServiceHealthCard.jsx

import { useI18n } from '../../context/LangContext';

const STATUS_STYLES = {
  healthy:   'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  degraded:  'border-amber-500/40   bg-amber-500/10   text-amber-300',
  unhealthy: 'border-rose-500/40    bg-rose-500/10    text-rose-300',
  running:   'border-sky-500/40     bg-sky-500/10     text-sky-300',
  unknown:   'border-slate-700      bg-slate-900      text-slate-300',
};

export default function ServiceHealthCard({ service }) {
  const { t } = useI18n();
  const status = service.latest_health?.status ?? 'unknown';
  const lastRun = service.latest_run?.started_at;
  const failures = service.latest_health?.consecutive_failures ?? 0;
  
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 hover:border-slate-600 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">{service.name}</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">{service.domain}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
          {t(`soc.status.${status}`, { defaultValue: status })}
        </span>
      </div>
      
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {t('soc.lastRun', { defaultValue: 'Lần chạy gần nhất' })}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            {lastRun ? new Date(lastRun).toLocaleString('vi-VN') : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {t('soc.consecutiveFailures', { defaultValue: 'Lỗi liên tiếp' })}
          </p>
          <p className={`mt-1 text-xs font-semibold ${failures > 0 ? 'text-rose-300' : 'text-slate-300'}`}>
            {failures}
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### Component 2: `OwnershipBadgeRow.jsx`
```jsx
// frontend/src/components/soc/OwnershipBadgeRow.jsx
// Kế thừa BoundaryPanel logic từ Admin-Ops

export default function OwnershipBadgeRow({ ownership, domainKey }) {
  const { t } = useI18n();
  if (!ownership || !domainKey) return null;
  
  const entry = ownership?.domains?.[domainKey];
  if (!entry) return null;
  
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
      <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-cyan-200">
        {entry.owner}
      </span>
      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-violet-200">
        {ownership.mode}
      </span>
      <span className={`rounded-full border px-2.5 py-1 ${
        ['native-write', 'bridge-write', 'guarded-write'].includes(entry.status)
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-700 bg-slate-900 text-slate-300'
      }`}>
        {entry.status}
      </span>
    </div>
  );
}
```

#### Component 3: `WriteGuardBanner.jsx`
```jsx
// frontend/src/components/soc/WriteGuardBanner.jsx
// Kế thừa write-guard banner từ SignalControlCenter

const WRITABLE_STATUSES = new Set(['canonical', 'native-write', 'bridge-write', 'guarded-write']);

export function isOwnershipWritable(status) {
  if (!status) return true;
  return WRITABLE_STATUSES.has(String(status).trim().toLowerCase());
}

export default function WriteGuardBanner({ ownership, domainKeys = [], t }) {
  const blockedReasons = domainKeys
    .map((key) => {
      const entry = ownership?.domains?.[key];
      if (!entry || isOwnershipWritable(entry.status)) return null;
      return t(`soc.writeGuard.${key}`, {
        defaultValue: `Thao tác write đang bị khóa — ${key} thuộc ${entry.owner} (${entry.status})`,
      });
    })
    .filter(Boolean);
  
  if (blockedReasons.length === 0) return null;
  
  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
      <p className="text-sm font-semibold text-amber-300">
        {t('soc.writeGuardTitle', { defaultValue: 'Write bị khóa có chủ đích' })}
      </p>
      <ul className="mt-2 space-y-1">
        {blockedReasons.map((r, i) => (
          <li key={i} className="text-xs text-amber-200/80">{r}</li>
        ))}
      </ul>
      {ownership?.deprecation_notes?.map((note, i) => (
        <p key={i} className="mt-2 text-[11px] text-slate-400">{note}</p>
      ))}
    </div>
  );
}
```

#### Component 4: `ConfigPreviewModal.jsx`
```jsx
// frontend/src/components/soc/ConfigPreviewModal.jsx
// Hiển thị diff + impact trước khi apply — giữ semantic Admin-Ops

export default function ConfigPreviewModal({ isOpen, onClose, onConfirm, diff, impact, warnings }) {
  const { t } = useI18n();
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-6 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-100">
          {t('soc.previewTitle', { defaultValue: 'Xem trước thay đổi config' })}
        </h3>
        
        {/* Diff section */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {t('soc.diff', { defaultValue: 'Thay đổi' })}
          </p>
          <div className="mt-2 space-y-1 rounded-xl border border-slate-800 bg-slate-900 p-3">
            {Object.entries(diff || {}).map(([key, change]) => (
              <div key={key} className="flex items-center gap-3 text-xs">
                <span className="w-40 truncate text-slate-400">{key}</span>
                <span className="text-rose-300 line-through">{String(change.from)}</span>
                <span className="text-slate-500">→</span>
                <span className="text-emerald-300">{String(change.to)}</span>
              </div>
            ))}
            {Object.keys(diff || {}).length === 0 && (
              <p className="text-xs text-slate-500">{t('soc.noDiff', { defaultValue: 'Không có thay đổi' })}</p>
            )}
          </div>
        </div>
        
        {/* Impact section */}
        {impact && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {t('soc.impact', { defaultValue: 'Tác động ước tính' })}
            </p>
            <pre className="mt-2 rounded-xl border border-slate-800 bg-slate-900 p-3 text-xs text-slate-300 whitespace-pre-wrap">
              {JSON.stringify(impact, null, 2)}
            </pre>
          </div>
        )}
        
        {/* Warnings */}
        {warnings?.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-200">{w}</p>
            ))}
          </div>
        )}
        
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {t('common.cancel', { defaultValue: 'Hủy' })}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            {t('soc.applyConfig', { defaultValue: 'Áp dụng' })}
          </button>
        </div>
      </div>
    </div>
  );
}
```

#### Component 5: `MatrixScrapeMonitor.jsx`
```jsx
// frontend/src/components/soc/MatrixScrapeMonitor.jsx
// Visualize scrape matrix heatmap — tính năng mới hoàn toàn

export default function MatrixScrapeMonitor({ matrixId }) {
  const { t } = useI18n();
  const [heatmap, setHeatmap] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (!matrixId) return;
    
    const fetchAll = async () => {
      const [hmRes, prRes] = await Promise.all([
        fetch(`/api/soc/matrix/${matrixId}/cell_heatmap/`),
        fetch(`/api/soc/matrix/${matrixId}/progress/`),
      ]);
      setHeatmap(await hmRes.json());
      setProgress(await prRes.json());
      setLoading(false);
    };
    
    fetchAll();
    // Poll mỗi 5 giây khi đang in_progress
    const timer = setInterval(fetchAll, 5000);
    return () => clearInterval(timer);
  }, [matrixId]);
  
  const STATUS_COLORS = {
    pending:    'bg-slate-800',
    claimed:    'bg-sky-900',
    in_progress:'bg-sky-500/50 animate-pulse',
    done:       'bg-emerald-500/70',
    failed:     'bg-rose-500/70',
    reassigned: 'bg-amber-500/40',
    skipped:    'bg-slate-700',
  };
  
  // Group cells by group_key → row; provider → column
  const providers = [...new Set(heatmap?.cells?.map((c) => c.provider) || [])];
  const groups = [...new Set(heatmap?.cells?.map((c) => c.group_key) || [])];
  const cellMap = {};
  heatmap?.cells?.forEach((c) => { cellMap[`${c.group_key}__${c.provider}`] = c; });
  
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
        <p className="text-sm text-slate-400">{t('soc.loading', { defaultValue: 'Đang tải...' })}</p>
      </div>
    );
  }
  
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-100">
          {t('soc.matrixMonitorTitle', { defaultValue: 'Ma trận scraping song song' })}
        </h3>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span>{progress?.completion_pct ?? 0}% hoàn thành</span>
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
            progress?.status === 'completed'  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' :
            progress?.status === 'in_progress'? 'border-sky-500/40 bg-sky-500/10 text-sky-300' :
            progress?.status === 'partial'    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' :
            'border-slate-700 bg-slate-900 text-slate-300'
          }`}>
            {progress?.status}
          </span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${progress?.completion_pct ?? 0}%` }}
        />
      </div>
      
      {/* Matrix heatmap */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="py-1 pr-3 text-left text-[11px] uppercase tracking-[0.14em] text-slate-500">
                {t('soc.symbolGroup', { defaultValue: 'Nhóm symbol' })}
              </th>
              {providers.map((p) => (
                <th key={p} className="px-2 py-1 text-center text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <tr key={group} className="border-t border-slate-800/50">
                <td className="py-1.5 pr-3 font-mono text-slate-400">{group}</td>
                {providers.map((p) => {
                  const cell = cellMap[`${group}__${p}`];
                  const status = cell?.status ?? 'empty';
                  return (
                    <td key={p} className="px-2 py-1.5 text-center">
                      <div
                        className={`mx-auto h-5 w-16 rounded ${STATUS_COLORS[status] || 'bg-slate-900'} cursor-pointer`}
                        title={cell ? `${status} · ${cell.fetched_count ?? 0} symbols · ${cell.duration_seconds?.toFixed(1) ?? '—'}s` : 'Không có cell'}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(STATUS_COLORS).map(([s, cls]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`h-3 w-5 rounded ${cls.replace(' animate-pulse', '')}`} />
            <span className="text-[11px] text-slate-500">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

#### Component 6: `SOCDomainTabs.jsx`
```jsx
// frontend/src/components/soc/SOCDomainTabs.jsx
// Container chính thay AdminOps.jsx — 5 domain tabs

import { useState } from 'react';
import { useI18n } from '../../context/LangContext';
import DataOpsDomainPanel from './DataOpsDomainPanel';
import SignalIntelligenceDomainPanel from './SignalIntelligenceDomainPanel';
import PrefetchDomainPanel from './PrefetchDomainPanel';
import ScreenerDomainPanel from './ScreenerDomainPanel';
import MatrixScrapePanel from './MatrixScrapePanel';
import ServiceRegistryPanel from './ServiceRegistryPanel';

const TABS = [
  { key: 'overview',  labelKey: 'soc.tabOverview',  defaultLabel: 'Tổng quan' },
  { key: 'signals',   labelKey: 'soc.tabSignals',   defaultLabel: 'Trung tâm tín hiệu' },
  { key: 'dataops',   labelKey: 'soc.tabDataOps',   defaultLabel: 'Data Ops' },
  { key: 'prefetch',  labelKey: 'soc.tabPrefetch',  defaultLabel: 'Prefetch' },
  { key: 'screener',  labelKey: 'soc.tabScreener',  defaultLabel: 'Bộ lọc' },
  { key: 'matrix',    labelKey: 'soc.tabMatrix',    defaultLabel: 'Ma trận scraping' },
];

export default function SOCDomainTabs() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState('overview');
  
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">
          {t('soc.pageTitle', { defaultValue: 'Trung tâm vận hành dịch vụ (SOC)' })}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {t('soc.pageSubtitle', { defaultValue: 'Quản lý và giám sát toàn bộ dịch vụ nền' })}
        </p>
      </div>
      
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-slate-800 bg-slate-900/50 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t(tab.labelKey, { defaultValue: tab.defaultLabel })}
          </button>
        ))}
      </div>
      
      {/* Tab content */}
      <div>
        {activeTab === 'overview'  && <ServiceRegistryPanel />}
        {activeTab === 'signals'   && <SignalIntelligenceDomainPanel />}
        {activeTab === 'dataops'   && <DataOpsDomainPanel />}
        {activeTab === 'prefetch'  && <PrefetchDomainPanel />}
        {activeTab === 'screener'  && <ScreenerDomainPanel />}
        {activeTab === 'matrix'    && <MatrixScrapePanel />}
      </div>
    </div>
  );
}
```

---

## SUPPLEMENT A.5 — I18N KEY MAPPING

```javascript
// Thêm vào frontend/src/i18n/vi.js (hoặc tương đương)

const socKeys = {
  // General
  'soc.pageTitle': 'Trung tâm vận hành dịch vụ (SOC)',
  'soc.pageSubtitle': 'Quản lý và giám sát toàn bộ dịch vụ nền',
  'soc.loading': 'Đang tải...',
  'soc.noDiff': 'Không có thay đổi',
  
  // Tabs
  'soc.tabOverview': 'Tổng quan',
  'soc.tabSignals': 'Trung tâm tín hiệu',
  'soc.tabDataOps': 'Data Ops',
  'soc.tabPrefetch': 'Prefetch',
  'soc.tabScreener': 'Bộ lọc toàn thị trường',
  'soc.tabMatrix': 'Ma trận scraping',
  
  // Status
  'soc.status.healthy': 'Khỏe mạnh',
  'soc.status.degraded': 'Suy giảm',
  'soc.status.unhealthy': 'Lỗi',
  'soc.status.running': 'Đang chạy',
  'soc.status.unknown': 'Không xác định',
  'soc.status.done': 'Hoàn thành',
  'soc.status.pending': 'Chờ',
  'soc.status.failed': 'Thất bại',
  'soc.status.reassigned': 'Đã chuyển provider',
  
  // Config
  'soc.applyConfig': 'Áp dụng cấu hình',
  'soc.previewTitle': 'Xem trước thay đổi config',
  'soc.diff': 'Thay đổi',
  'soc.impact': 'Tác động ước tính',
  
  // Matrix
  'soc.matrixMonitorTitle': 'Ma trận scraping song song',
  'soc.symbolGroup': 'Nhóm symbol',
  'soc.provider': 'Nhà cung cấp dữ liệu',
  'soc.triggerCycle': 'Chạy chu kỳ mới',
  
  // Write guard
  'soc.writeGuardTitle': 'Thao tác write bị khóa có chủ đích',
  
  // Fields
  'soc.lastRun': 'Lần chạy gần nhất',
  'soc.consecutiveFailures': 'Lỗi liên tiếp',
  'soc.slaUptime': 'Độ ổn định SLA',
  'soc.circuitBreaker': 'Circuit breaker',
};
```

---

## SUPPLEMENT A.6 — REVISED TIMELINE

Bổ sung 3 sub-phase mới vào kế hoạch gốc:

| Phase mới | Nội dung | Tuần | Điều kiện | DoD |
|-----------|----------|------|-----------|-----|
| **1.6** | Implement `DOMAIN_CONFIG_CLASSES` + typed schema validation cho 4 domains | Tuần 1 | Sau Phase 1.2 | `get_typed_config()` trả đúng dataclass cho từng domain; `validate()` reject bad data |
| **1.7** | Implement `ServiceOwnershipMatrix` + tích hợp vào tất cả domain views | Tuần 2 | Sau Phase 1.3 | Mọi domain response có field `ownership`; `is_domain_writable()` pass/block đúng |
| **2.5** | Tạo `ScrapeMatrix` + `ScrapeMatrixCell` models + `MatrixCoordinator` | Tuần 2-3 | Song song Phase 2 | `run_scrape_cycle` tạo matrix, dispatch tasks; dedup hoạt động; `cell_heatmap` API OK |
| **4.1** | Build 6 SOC components (Tailwind dark, i18n đầy đủ) | Tuần 4 | Sau Phase 3.2 | Tất cả components render đúng; `WriteGuardBanner` hiện khi ownership không writable; `MatrixScrapeMonitor` poll và update |
| **4.2** | Migrate `SignalControlCenter` sang domain panel mới (kế thừa ownership matrix) | Tuần 4-5 | Sau Phase 4.1 | Browser smoke: tab tín hiệu render đúng; write guard banner đúng; không mất ownership logic |

---

## SUPPLEMENT A.7 — REVISED SUCCESS METRICS

| Tiêu chí | Admin-Ops cũ | SOC target | Ghi chú |
|----------|--------------|------------|---------|
| API Endpoints | 27 | 35–40 (tăng, vì thêm matrix) | Thêm chất lượng, không cắt giảm domain coverage |
| Config Locations | 6+ | 1 SSOT (`ServiceConfig`) | Vẫn typed per domain |
| Typed config validation | Partial (inline) | 4 domain dataclass | Validate trước khi save |
| Ownership matrix coverage | 100% (signal domain) | 100% (tất cả 4 domains) | Mở rộng từ signal sang vnbroker/prefetch/screener |
| Write guard trong UI | ✅ (signals only) | ✅ (tất cả domains) | Kế thừa `WRITABLE_STATUSES` pattern |
| Parallel scraping | ❌ (shard sequential) | ✅ (matrix, N providers song song) | Cell claim dedup; reassignment on failure |
| Scraping throughput | 1x (VCI only) | 2–4x (multi-provider parallel) | Tuỳ provider availability |
| Dedup guarantee | ❌ (không có) | ✅ (atomic claim + skip-if-done-by-other) | `try_claim()` select_for_update |
| Config diff preview | ✅ (partial) | ✅ (diff + impact estimate) | Mọi update endpoint có `?preview=1` |
| i18n coverage | ✅ 100% | ✅ 100% | `soc.*` key namespace |
| UI design consistency | ✅ Tailwind dark | ✅ Tailwind dark (giữ nguyên) | Không dùng Ant Design |
