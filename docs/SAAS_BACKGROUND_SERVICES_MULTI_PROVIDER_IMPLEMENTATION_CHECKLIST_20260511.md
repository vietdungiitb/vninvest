# IMPLEMENTATION CHECKLIST — Phase P0 Technical Details

**Ngày**: 2026-05-11  
**Phase**: P0 — Baseline and Guardrails  
**Mục tiêu**: Queue drift checker + worker topology foundation

---

## P0.1: Queue Drift Checker (Priority HIGH)

### 1.1.1 Management Command

**File**: `packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py`

```python
import sys
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask

class Command(BaseCommand):
    help = 'Check for queue drift between code and DB scheduler'

    EXPECTED_QUEUES = {
        # Format: task_name: expected_queue
        'materialize-symbol-snapshot-60s': 'realtime_prefetch',
        'materialize-session-facts-5m': 'realtime_prefetch',
        'materialize-unified-alerts-2m': 'realtime_prefetch',
        'materialize-symbol-snapshot-30s': 'realtime_prefetch',
        'materialize-bucket-facts-5m': 'realtime_prefetch',
        'detect_and_store_global_whale_alerts': 'analytics_heavy',
        'detect_order_flow': 'analytics_heavy',
        'run_stream_consumer_batch': 'realtime_stream',
        'enrich_history_bars': 'enrichment_offhours',
        'enrich_fundamentals': 'enrichment_offhours',
        'manual_refresh_task': 'manual_on_demand',
    }

    def add_arguments(self, parser):
        parser.add_argument('--warn-only', action='store_true',
                          help='Warn but do not fail')

    def handle(self, *args, **options):
        drift_count = 0
        drifts = []
        
        for task in PeriodicTask.objects.all():
            expected = self.EXPECTED_QUEUES.get(task.name)
            if expected and task.queue != expected:
                drift_count += 1
                drifts.append({
                    'task': task.name,
                    'expected': expected,
                    'actual': task.queue
                })
        
        if drifts:
            self.stdout.write(self.style.WARNING(
                f'DRIFT DETECTED: {drift_count} tasks'))
            for d in drifts:
                self.stdout.write(
                    f"  {d['task']}: expected={d['expected']}, "
                    f"actual={d['actual']}")
            
            if not options['warn_only']:
                sys.exit(1)
        else:
            self.stdout.write(self.style.SUCCESS(
                'No queue drift detected'))
```

### 1.1.2 Management Command — Sync Scheduler

**File**: `packages/core/backend/src/vninvest_core/management/commands/sync_scheduler_queues.py`

```python
from django.core.management.base import BaseCommand
from django_celery_beat.models import PeriodicTask

class Command(BaseCommand):
    help = 'Sync scheduler queue fields to expected values'

    QUEUE_MAP = {
        'materialize-symbol-snapshot-60s': 'realtime_prefetch',
        # ... (same as drift checker)
    }

    def handle(self, *args, **options):
        updated = 0
        for task in PeriodicTask.objects.all():
            expected_queue = self.QUEUE_MAP.get(task.name)
            if expected_queue and task.queue != expected_queue:
                task.queue = expected_queue
                task.save(update_fields=['queue'])
                updated += 1
                self.stdout.write(f"Updated {task.name} -> {expected_queue}")
        
        self.stdout.write(self.style.SUCCESS(f'Updated {updated} tasks'))
```

### 1.1.3 Docker Compose Integration

**File**: `docker-compose.dev.yml` — Add healthcheck to backend-beat

```yaml
backend-beat:
  healthcheck:
    test: ["CMD-SHELL", "python manage.py check_scheduler_queue_drift --warn-only"]
    interval: 5m
    timeout: 30s
    retries: 3
```

### 1.1.4 Execution Commands

```bash
# Test drift checker
docker exec vninvest-dev-core-beat python manage.py check_scheduler_queue_drift

# Sync queues (run once before first deployment)
docker exec vninvest-dev-core-beat python manage.py sync_scheduler_queues

# Enable cron (add to worker entrypoint or external cron)
# */5 * * * * docker exec vninvest-dev-core-beat python manage.py check_scheduler_queue_drift --warn-only
```

---

## P0.2: Queue Map Definition

### 1.2.1 Celery Configuration

**File**: `packages/core/backend/src/vninvest_core/celery.py`

```python
from celery import Celery

app = Celery('vninvest_core')

# Queue definitions
app.conf.task_queues = {
    'celery': {},
    'realtime_prefetch': {},
    'realtime_stream': {},
    'enrichment_offhours': {},
    'analytics_heavy': {},
    'manual_on_demand': {},
}

# Default queue
app.conf.task_default_queue = 'celery'

# Route map
app.conf.task_routes = {
    'materialize-symbol-snapshot*': {'queue': 'realtime_prefetch'},
    'materialize-session-facts*': {'queue': 'realtime_prefetch'},
    'materialize-unified-alerts*': {'queue': 'realtime_prefetch'},
    'detect_and_store_global_whale_alerts': {'queue': 'analytics_heavy'},
    'detect_order_flow': {'queue': 'analytics_heavy'},
    'run_stream_consumer_batch': {'queue': 'realtime_stream'},
    'enrich_*': {'queue': 'enrichment_offhours'},
    'manual_*': {'queue': 'manual_on_demand'},
}
```

---

## P0.3: Baseline Metrics Dashboard

Status: implemented in the core admin-ops runtime KPI dashboard via live scheduler queue lag/freshness snapshot.

### 1.3.1 Prometheus Metrics (if available)

Add to Celery tasks:

```python
from celery import signals
from prometheus_client import Counter, Gauge

queue_depth = Gauge('celery_queue_depth', 'Queue depth',
                   ['queue'])
task_latency = Histogram('celery_task_latency_seconds', 'Task latency',
                       ['task_name'])
provider_timeout = Counter('provider_timeout_total',
                         'Provider timeouts',
                         ['provider', 'channel'])
```

### 1.3.2 Alternative: Redis-based Metrics

**File**: `packages/core/backend/src/vninvest_core/monitoring/queue_metrics.py`

```python
import redis
import json
from datetime import datetime

def get_queue_depths():
    r = redis.Redis.from_url(settings.CELERY_BROKER_URL)
    return {
        q: r.llen(f'celery:{q}')
        for q in ['celery', 'realtime_prefetch', 'realtime_stream',
                 'enrichment_offhours', 'analytics_heavy', 'manual_on_demand']
    }

def report_queue_health():
    depths = get_queue_depths()
    # Log or alert if any queue > threshold
    for queue, depth in depths.items():
        if depth > 1000:
            logger.warning(f"Queue {queue} depth {depth} exceeds threshold")
```

---

## Execution Evidence Template

### Slice: SBMP-P0.1 (Drift Checker)

| Field | Value |
|---|---|
| Slice ID | SBMP-P0.1 |
| Executor | [Name] |
| Reviewer | [Name] |
| Date | YYYY-MM-DD |

**Files changed**:
- `packages/core/backend/src/vninvest_core/management/commands/check_scheduler_queue_drift.py` (NEW)
- `packages/core/backend/src/vninvest_core/management/commands/sync_scheduler_queues.py` (NEW)
- `docker-compose.dev.yml` (MODIFIED - healthcheck)

**Validation**:
```bash
# 1. Test drift checker outputs correctly
docker exec vninvest-dev-core-beat python manage.py check_scheduler_queue_drift
# Expected: "No queue drift detected" or list of drifts

# 2. Test sync updates queues
docker exec vninvest-dev-core-beat python manage.py sync_scheduler_queues
# Expected: "Updated N tasks"

# 3. Post-sync drift check returns clean
docker exec vninvest-dev-core-beat python manage.py check_scheduler_queue_drift --warn-only
# Expected: exit code 0
```

**Decision**: PASS / CONDITIONAL PASS / FAIL

---

## Next Slice

After P0.1-P0.3:
- Proceed to P1.1: Define queue map (already in P0)
- Proceed to P3.1: Manual trigger API (P1.1-P2.4 already aligned)

---

## Phase P1 Details (Preview)

### Worker Configuration

**docker-compose.dev.yml**:

```yaml
services:
    # Fallback worker for high-priority queues
    core-worker:
        command: celery -A vninvest_core worker -Q celery,realtime_prefetch,realtime_stream,analytics_heavy,manual_on_demand -c 2
        deploy:
            replicas: 1

    # Existing worker - split to domain-specific workers
  core-worker-realtime-prefetch:
    command: celery -A vninvest_core worker -Q realtime_prefetch -c 4
    deploy:
      replicas: 3
  
  core-worker-realtime-stream:
    command: celery -A vninvest_core worker -Q realtime_stream -c 4
    deploy:
      replicas: 4
  
  core-worker-enrichment:
    command: celery -A vninvest_core worker -Q enrichment_offhours -c 6
    deploy:
      replicas: 2
  
  core-worker-analytics:
    command: celery -A vninvest_core worker -Q analytics_heavy -c 4
    deploy:
      replicas: 2
  
  core-worker-manual:
    command: celery -A vninvest_core worker -Q manual_on_demand -c 3
    deploy:
      replicas: 2
```

---

## Sign-off Template

**Phase P0 Sign-off**

| Item | Status | Notes |
|---|---|---|
| Drift checker implemented | [ ] | |
| Sync script working | [ ] | |
| Healthcheck configured | [ ] | |
| Baseline metrics | [ ] | |
| Queue map defined | [ ] | |

**Executor**: _____________  
**Reviewer**: _____________  
**Date**: _____________  
**Decision**: GO / CONDITIONAL / NO-GO
