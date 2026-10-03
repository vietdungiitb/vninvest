# Service Operations Center (SOC) — Audit & Proposal
**Ngày**: 2026-05-12  
**Mục tiêu**: Chuẩn hóa quản trị các services chạy ngầm (Celery Beat + Worker) với một trung tâm quản trị tập trung (SOC).

---

## I. AUDIT HIỆN TRẠNG — Phân tán Governance

### A. Services Đang Chạy — Không Chuẩn Hóa

| Domain | Task Name | Schedule | Queue | Status | Config | Control |
|---|---|---|---|---|---|---|
| **Realtime Ticker Prefetch** | `build_realtime_symbol_universe_snapshot` | 60s (TICKER_UNIVERSE_REFRESH_SECONDS) | realtime_prefetch | ✅ Running | 🔧 Env vars + cache | ❌ None |
| | `schedule_realtime_prefetch_shards` | 3s (TICKER_PREFETCH_SCHEDULER_INTERVAL_SECONDS) | realtime_prefetch | ✅ Running | 🔧 Runtime settings | ❌ None |
| | `prefetch_realtime_ticker_shard` | Per shard (hot=3s, warm=5s, cold=15s) | realtime_prefetch | ✅ Running | 🔧 Topology cache | ❌ None |
| **Data Ingest — Off-peak** | `offpeak_vnbroker_ingest` | Cron 18:10 (OFFPEAK_VNBROKER_INGEST_CRON_*) | enrichment_offhours | ✅ Beat | 🔧 Cron + env | ❌ None |
| | `sync_market_groups` | On-demand | default | ❌ Not scheduled | 🔧 None | ❌ None |
| | `fetch_and_upsert_price_board` | On-demand | default | ❌ Not scheduled | 🔧 Config record | ❌ None |
| **Whale Alert Detection** | `detect_and_store_global_whale_alerts` | 30s (WHALE_ALERT_DETECTION_INTERVAL_SECONDS) | default | ✅ Beat | 🔧 Env flag | ❌ None |
| | `distribute_whale_alert_event` | On-demand | default | ⚙️ Queue | 🔧 None | ❌ None |
| **Order Flow Detection** | `detect_and_store_order_flow` | 30s (ORDER_FLOW_DETECTION_INTERVAL_SECONDS) | default | ✅ Beat | 🔧 Env flag | ❌ None |
| | `distribute_order_flow_signal` | On-demand | default | ⚙️ Queue | 🔧 None | ❌ None |
| **Advisory Generation** | `auto_generate_advisories_for_all_tracked` | 240m (ADVISORY_AUTO_GENERATION_INTERVAL_MINUTES) | default | ✅ Beat | 🔧 Env flag + batch | ❌ None |
| | `generate_whale_advisory_task` | On-demand | manual_on_demand | ⚙️ Queue | 🔧 User config | ❌ None |
| | `flush_merged_advisory_event` | On-demand | default | ⚙️ Queue | 🔧 Cache | ❌ None |
| **Stream Consumers** | `run_stream_consumer_batch` (db-writer) | 5s (STREAM_CONSUMER_INTERVAL) | default | ✅ Beat | 🔧 Env + gate | ❌ None |
| | `run_stream_consumer_batch` (ws-broadcaster) | 5s | default | ✅ Beat | 🔧 Env + gate | ❌ None |
| | `run_stream_consumer_batch` (alert-engine) | 5s | default | ✅ Beat | 🔧 Env + gate | ❌ None |
| **Watchlist Sync** | `sync_all_watch_assets` | 1m (WATCHLIST_SYNC_MINUTES) | default | ✅ Beat | 🔧 Env flag | ❌ None |
| | `sync_user_watch_assets` | Per-user | default | ⚙️ Queue | 🔧 None | ❌ None |
| **Portfolio Sync (DNSE)** | `sync_all_dnse_balances_task` | 1m | default | ✅ Beat | 🔧 Env | ❌ None |
| | `sync_dnse_balances_task` | Per-user | default | ⚙️ Queue | 🔧 DNSE credential | ❌ None |
| | `reconcile_all_dnse_transactions_task` | 5m | default | ✅ Beat | 🔧 Env | ❌ None |
| **Config Rollout** | `activate_due_whale_config_rollouts` | 60s (MISSION_CONTROL_SCHEDULED_ROLLOUTS_INTERVAL_SECONDS) | default | ✅ Beat | 🔧 Env flag | ❌ None |
| | `monitor_whale_config_anomalies` | 60s | default | ✅ Beat | 🔧 Env flag | ❌ None |
| **Maintenance** | `trim_streams` | 3600s | default | ✅ Beat | 🔧 Hardcoded | ❌ None |
| | `cleanup_old_intraday_ticks` | 86400s | default | ✅ Beat | 🔧 Env (INTRADAY_TICK_KEEP_DAYS) | ❌ None |
| | `cleanup_old_signal_service_runs` | 86400s | default | ✅ Beat | 🔧 Hardcoded | ❌ None |
| **Lifecycle/Trial** | `process_expired_onboarding_trials_task` | 1m (ONBOARDING_TRIAL_AUTO_DOWNGRADE_MINUTES) | default | ✅ Beat | 🔧 Env flag | ❌ None |

**Summary**:
- **23+ services** chạy qua Celery Beat
- **~15 services** có thể trigger on-demand qua queue
- **Configuration**: Phân tán (env vars, cache, models, hardcoded)
- **Control**: **KHÔNG CÓ** unified dashboard, monitor, pause/resume, manual trigger, override, audit trail

### B. Pain Points Hiện Tại

| Issue | Impact | Severity |
|---|---|---|
| 🔴 **Không có dashboard quản lý tập trung** | Không biết services nào đang chạy, trạng thái, lỗi gì | CRITICAL |
| 🔴 **Config phân tán (env + cache + models + hardcoded)** | Khó maintain, dễ mâu thuẫn, impossible to audit | CRITICAL |
| 🔴 **Pause/resume/override services** | Chỉ có cách restart beat hoặc clear cache, không graceful | HIGH |
| 🔴 **Manual trigger capability** | Phải dùng Django shell hoặc admin, không consistent | HIGH |
| 🔴 **Health check + alerting** | Nếu service fail im lặng, chỉ biết đến khi user report | HIGH |
| 🔴 **No run history / audit trail** | Không biết khi nào task chạy, output gì, lỗi như thế nào | HIGH |
| 🔴 **Throttling / rate limiting** | Realtime prefetch bị starve khi other tasks chạy heavy | MEDIUM |
| 🔴 **Circuit breaker / fallback** | Nếu API bị rate-limit, không có graceful degradation | MEDIUM |
| 🔴 **Dependent task coordination** | whale alerts phải chạy trước để distribute events, nhưng không có DAG | MEDIUM |
| 🔴 **Data enrichment priority** | Offpeak ingest, prefetch, whale detection không có priority queue | MEDIUM |

### C. Current Service Dependencies (Ad-hoc)

```
┌─────────────────────────────────────────────────────┐
│ Prefetch Services (realtime ticker)                 │
│ - build_realtime_symbol_universe_snapshot           │
│ - schedule_realtime_prefetch_shards                 │
│ - prefetch_realtime_ticker_shard                    │
└──────────────────┬──────────────────────────────────┘
                   │ feeds ticker cache
                   ▼
┌─────────────────────────────────────────────────────┐
│ Dashboard / UI                                      │
│ - GET /api/realtime/tickers (cache miss → fallback)│
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Whale Alert Detection                               │
│ - detect_and_store_global_whale_alerts              │
└──────────────────┬──────────────────────────────────┘
                   │ creates WhaleAlertEvent
                   ▼
┌─────────────────────────────────────────────────────┐
│ Event Distribution                                  │
│ - distribute_whale_alert_event                      │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Advisory Generation                                 │
│ - auto_generate_advisories_for_all_tracked (240m)  │
│ - generate_whale_advisory_task (on-demand)          │
│ - flush_merged_advisory_event (on-demand)           │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Stream Consumers                                    │
│ - run_stream_consumer_batch (db-writer, ws, alert)  │
│ - trim_streams (cleanup)                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Data Enrichment (off-peak)                          │
│ - offpeak_vnbroker_ingest (cron 18:10)               │
│ - sync_market_groups (on-demand)                    │
│ - fetch_and_upsert_price_board (on-demand)          │
│ - sync_all_watch_assets (1m)                        │
│ - sync_all_dnse_balances_task (1m)                  │
└─────────────────────────────────────────────────────┘
```

**Problem**: Services chạy độc lập, không có coordination, không có priority, không có dependency DAG.

---

## II. PROPOSAL — Service Operations Center (SOC)

### Goal
Tạo một hệ thống quản lý dịch vụ tập trung với các khả năng:
1. ✅ **Unified Registry** — mọi service được register + metadata
2. ✅ **Real-time Dashboard** — monitor health, status, last run, errors
3. ✅ **Configuration Management** — centralized config + version control
4. ✅ **Manual Control** — pause, resume, trigger, override
5. ✅ **Health Checks** — periodic health probes + alerting
6. ✅ **Run History** — audit trail, logs, metrics
7. ✅ **Error Recovery** — circuit breaker, retry policy, fallback
8. ✅ **Priority & Coordination** — queue prioritization, task DAG, dependent scheduling

### A. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend Admin UI (React)                    │
│  - Service registry dashboard                                    │
│  - Real-time health/status grid                                  │
│  - Manual trigger modal                                          │
│  - Config editor with validation                                 │
│  - Run history timeline                                          │
│  - Alert rules + notifications                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                  SOC REST API (Django)                           │
│  - GET /api/soc/services/                    (list + filter)     │
│  - GET /api/soc/services/{id}/status         (health check)      │
│  - POST /api/soc/services/{id}/trigger       (manual run)        │
│  - PATCH /api/soc/services/{id}/config       (update config)     │
│  - POST /api/soc/services/{id}/pause         (pause service)     │
│  - POST /api/soc/services/{id}/resume        (resume service)    │
│  - GET /api/soc/runs/                        (history + filter)   │
│  - GET /api/soc/alerts/                      (active alerts)      │
│  - GET /api/soc/health/                      (SOC health)        │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│              Service Registry & State Manager (Django)           │
│  Models:                                                         │
│  - ServiceDefinition (name, description, type, schedule)         │
│  - ServiceConfig (service, config_json, version, active)         │
│  - ServiceHealthCheck (service, last_check, status, message)     │
│  - ServiceRun (service, task_id, status, started_at, finished_at)│
│  - ServiceRunLog (run, level, message, timestamp)                │
│  - ServiceAlert (service, rule, trigger_at, ack_at, resolved_at) │
│  - ServiceDependency (parent, child, order, required)            │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│         Celery Task Adapter & Execution Engine                   │
│  - Fetch config from registry                                    │
│  - Pre-flight validation (dependencies met?)                     │
│  - Execute task with monitoring                                  │
│  - Capture output + metrics                                      │
│  - Store run record + logs                                       │
│  - Trigger alerts if failed                                      │
│  - Retry with circuit breaker                                    │
└──────────────────────┬──────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│     Existing Celery Beat + Workers (No Change)                   │
│  - Scheduled tasks from registry (not hardcoded)                 │
│  - Queue prioritization (realtime_prefetch > default > offhours) │
│  - Auto-scaling workers per queue                                │
└─────────────────────────────────────────────────────────────────┘
```

### B. Database Models (New Django App: `service_ops`)

```python
# service_ops/models.py

class ServiceDefinition(models.Model):
    """Registry entry for each background service."""
    
    DOMAIN_CHOICES = [
        ('realtime_ticker', 'Realtime Ticker Prefetch'),
        ('whale_detection', 'Whale Alert Detection'),
        ('order_flow', 'Order Flow Detection'),
        ('advisory', 'Advisory Generation'),
        ('data_ingest', 'Data Enrichment & Ingest'),
        ('stream_consumer', 'Stream Consumers'),
        ('portfolio_sync', 'Portfolio Sync (DNSE)'),
        ('config_mgmt', 'Config Management'),
        ('maintenance', 'Maintenance & Cleanup'),
    ]
    
    TYPE_CHOICES = [
        ('beat_scheduled', 'Celery Beat Scheduled'),
        ('queue_task', 'Queue-triggered Task'),
        ('manual_only', 'Manual Trigger Only'),
        ('child_task', 'Dependent Child Task'),
    ]
    
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('paused', 'Paused'),
        ('disabled', 'Disabled'),
        ('deprecated', 'Deprecated'),
    ]
    
    # Identity
    name = CharField(max_length=100, unique=True)  # e.g., 'prefetch_realtime_ticker_shard'
    domain = CharField(choices=DOMAIN_CHOICES)
    type = CharField(choices=TYPE_CHOICES)
    status = CharField(choices=STATUS_CHOICES, default='active')
    
    # Metadata
    display_name = CharField(max_length=200)  # Vietnamese friendly name
    description = TextField()
    celery_task_name = CharField(max_length=200)  # e.g., 'portfolio.tasks.prefetch_realtime_ticker_shard'
    celery_queue = CharField(max_length=50, default='default')  # e.g., 'realtime_prefetch'
    
    # Scheduling
    is_scheduled = BooleanField(default=True)  # If True, schedule via beat
    schedule_expression = CharField(max_length=100, blank=True)  # e.g., 'crontab(0 18 * * 1-5)'
    schedule_interval_seconds = IntegerField(null=True)  # e.g., 3 (for 3 seconds)
    
    # Execution policy
    timeout_seconds = IntegerField(default=300)
    max_retries = IntegerField(default=3)
    retry_backoff_seconds = IntegerField(default=10)
    max_concurrent_runs = IntegerField(default=1)  # Prevent parallel runs of same service
    
    # Health check
    health_check_enabled = BooleanField(default=True)
    health_check_interval_minutes = IntegerField(default=5)
    failure_threshold = IntegerField(default=3)  # Alert after 3 consecutive failures
    stale_threshold_minutes = IntegerField(default=30)  # Alert if no run in 30min
    
    # Dependencies
    depends_on = ManyToManyField('self', through='ServiceDependency', symmetrical=False, blank=True)
    
    # Ownership
    owner = ForeignKey(User, on_delete=SET_NULL, null=True)  # Ops team owner
    pagerduty_service_id = CharField(max_length=100, blank=True)  # For alerting
    
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.display_name} ({self.name})"
    
    class Meta:
        ordering = ['domain', 'name']


class ServiceConfig(models.Model):
    """Centralized configuration versioning."""
    
    service = ForeignKey(ServiceDefinition, on_delete=CASCADE)
    config_json = JSONField()  # Structured config dictionary
    version = IntegerField(default=1)
    is_active = BooleanField(default=True)
    comment = TextField(blank=True)
    
    created_by = ForeignKey(User, on_delete=SET_NULL, null=True)
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        unique_together = ('service', 'version')
        ordering = ['service', '-version']
    
    def __str__(self):
        return f"{self.service.name} v{self.version}"


class ServiceHealthCheck(models.Model):
    """Latest health status snapshot."""
    
    STATUS_CHOICES = [
        ('healthy', 'Healthy'),
        ('degraded', 'Degraded'),
        ('failed', 'Failed'),
        ('unknown', 'Unknown'),
    ]
    
    service = OneToOneField(ServiceDefinition, on_delete=CASCADE)
    status = CharField(choices=STATUS_CHOICES, default='unknown')
    last_check_at = DateTimeField(null=True)
    last_successful_run_at = DateTimeField(null=True)
    message = TextField(blank=True)
    
    consecutive_failures = IntegerField(default=0)
    minutes_since_last_run = IntegerField(null=True)
    
    updated_at = DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"{self.service.name}: {self.status}"


class ServiceRun(models.Model):
    """Execution record for each task run."""
    
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('running', 'Running'),
        ('success', 'Success'),
        ('failed', 'Failed'),
        ('skipped', 'Skipped'),
        ('timeout', 'Timeout'),
        ('cancelled', 'Cancelled'),
    ]
    
    service = ForeignKey(ServiceDefinition, on_delete=CASCADE)
    task_id = CharField(max_length=100, unique=True)  # Celery task UUID
    status = CharField(choices=STATUS_CHOICES, default='pending')
    
    trigger_type = CharField(max_length=50)  # 'beat_scheduled', 'manual_trigger', 'on_demand'
    trigger_user = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)  # If manual
    
    started_at = DateTimeField(null=True)
    finished_at = DateTimeField(null=True)
    duration_seconds = FloatField(null=True)
    
    # Execution metrics
    items_processed = IntegerField(null=True)
    items_failed = IntegerField(null=True)
    error_message = TextField(blank=True)
    
    # Return value
    result_json = JSONField(null=True)  # Task return value
    
    retry_count = IntegerField(default=0)
    next_retry_at = DateTimeField(null=True)
    
    created_at = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            Index(fields=['service', '-created_at']),
            Index(fields=['status', '-created_at']),
        ]
    
    def __str__(self):
        return f"{self.service.name} @ {self.started_at} ({self.status})"


class ServiceRunLog(models.Model):
    """Detailed log lines for each run."""
    
    LEVEL_CHOICES = [
        ('DEBUG', 'Debug'),
        ('INFO', 'Info'),
        ('WARNING', 'Warning'),
        ('ERROR', 'Error'),
        ('CRITICAL', 'Critical'),
    ]
    
    run = ForeignKey(ServiceRun, on_delete=CASCADE, related_name='logs')
    level = CharField(choices=LEVEL_CHOICES)
    message = TextField()
    timestamp = DateTimeField(auto_now_add=True)
    
    class Meta:
        ordering = ['timestamp']


class ServiceDependency(models.Model):
    """Task dependencies for DAG scheduling."""
    
    parent = ForeignKey(ServiceDefinition, on_delete=CASCADE, related_name='children_through')
    child = ForeignKey(ServiceDefinition, on_delete=CASCADE, related_name='parents_through')
    
    order = IntegerField(default=1)  # Execution order (1=first, 2=after parent1, etc.)
    is_required = BooleanField(default=True)  # If False, child runs even if parent fails
    
    class Meta:
        unique_together = ('parent', 'child')


class ServiceAlert(models.Model):
    """Alert state tracking."""
    
    RULE_TYPE_CHOICES = [
        ('failure_threshold', 'Consecutive Failures'),
        ('stale_run', 'No Run for Too Long'),
        ('timeout', 'Task Timeout'),
        ('slowness', 'Execution Slowness'),
    ]
    
    service = ForeignKey(ServiceDefinition, on_delete=CASCADE)
    rule_type = CharField(choices=RULE_TYPE_CHOICES)
    
    is_active = BooleanField(default=True)
    triggered_at = DateTimeField(null=True)
    acknowledged_at = DateTimeField(null=True)
    ack_by = ForeignKey(User, on_delete=SET_NULL, null=True, blank=True)
    
    resolved_at = DateTimeField(null=True)
    
    message = TextField()
    context = JSONField(default=dict)  # e.g., {'consecutive_failures': 5, 'threshold': 3}
    
    notification_sent_at = DateTimeField(null=True)
    notification_channel = CharField(max_length=50, blank=True)  # 'slack', 'pagerduty', 'email'
    
    class Meta:
        ordering = ['-triggered_at']
```

### C. REST API Endpoints

#### Service Registry
```
GET /api/soc/services/
  ?domain=realtime_ticker&status=active&type=beat_scheduled
  → List ServiceDefinition with filters + pagination

GET /api/soc/services/{id}/
  → ServiceDefinition detail + latest health check + last 10 runs

POST /api/soc/services/
  → Create new service definition (admin only)

PATCH /api/soc/services/{id}/
  → Update service definition (admin only)

DELETE /api/soc/services/{id}/
  → Mark as deprecated (not hard delete) (admin only)
```

#### Configuration Management
```
GET /api/soc/services/{id}/config/
  → Get active config (with version)

GET /api/soc/services/{id}/config/history/
  ?limit=10
  → Get config version history

POST /api/soc/services/{id}/config/
  {"config_json": {...}, "comment": "Updated thresholds"}
  → Create new config version (validated)

POST /api/soc/services/{id}/config/{version}/activate/
  → Rollback to previous version
```

#### Manual Control
```
POST /api/soc/services/{id}/trigger/
  {"params": {...}, "priority": "high"}
  → Manually trigger service immediately (ops only)
  → Returns task_id + ServiceRun record

POST /api/soc/services/{id}/pause/
  {"until": "2026-05-12T18:00:00Z", "reason": "maintenance"}
  → Pause service (no more scheduled runs)

POST /api/soc/services/{id}/resume/
  → Resume service

POST /api/soc/services/{id}/cancel-run/{run_id}/
  → Cancel specific running task
```

#### Run History & Monitoring
```
GET /api/soc/runs/
  ?service_id=123&status=failed&days=7
  → ServiceRun records + pagination (newest first)

GET /api/soc/runs/{run_id}/
  → ServiceRun detail + all logs + result_json

GET /api/soc/runs/{run_id}/logs/
  ?level=ERROR
  → ServiceRunLog stream + level filter

GET /api/soc/health/
  → SocHealthSnapshot
  {
    "status": "healthy",
    "services_total": 25,
    "services_healthy": 23,
    "services_degraded": 1,
    "services_failed": 1,
    "active_alerts": 3,
    "last_check_at": "2026-05-12T10:15:00Z"
  }
```

#### Health & Alerts
```
GET /api/soc/alerts/
  ?is_active=true
  → ServiceAlert records (newest first)

POST /api/soc/alerts/{alert_id}/acknowledge/
  {"acknowledged_by_note": "investigating..."}
  → Mark alert as acknowledged

POST /api/soc/alerts/{alert_id}/resolve/
  → Mark alert as resolved
```

### D. Frontend Dashboard Components (React)

#### 1. Service Registry Grid
- Filterable table: Domain, Name, Status, Last Run, Health, Next Scheduled Run
- Bulk actions: Pause All, Resume All, Export Config
- Quick stats: X active, Y paused, Z failed

#### 2. Health Heatmap
- Real-time status by domain + service
- Color-coded: 🟢 healthy, 🟡 degraded, 🔴 failed, ⚪ unknown
- Click for details

#### 3. Manual Trigger Modal
```
Service: [dropdown prefilled]
Priority: [low|normal|high] (maps to queue)
Parameters: [JSON editor with schema validation]
[Trigger Button] → Shows task_id + live log stream
```

#### 4. Config Editor
```
Service: [dropdown]
Version History: [v5 (current), v4, v3...]
Config:
{
  "schedule_interval_seconds": 3,
  "timeout_seconds": 300,
  "max_retries": 3,
  "retry_backoff_seconds": 10,
  "health_check_interval_minutes": 5,
  ...
}
[Validate Config] [Save as v6] [Rollback to v5]
Change log: "Increased interval from 5s to 3s for prefetch shards"
```

#### 5. Run History Timeline
```
Service: [dropdown]
Date Range: [picker]

2026-05-12T10:15:30Z | prefetch_realtime_ticker_shard | ✅ SUCCESS | 2.3s | 1800 symbols
2026-05-12T10:15:27Z | prefetch_realtime_ticker_shard | ✅ SUCCESS | 2.1s | 1800 symbols
2026-05-12T10:14:59Z | detect_global_whale_alerts     | 🔴 FAILED | 15.2s | [error details]
                       └─ Logs: [show/hide]
                       └─ Result: {"created": 2, "updated": 1, "errors": 0}
```

#### 6. Alert Dashboard
```
Active Alerts (3)
├─ ⚠️ detect_global_whale_alerts: 5 consecutive failures (threshold: 3)
│  └─ Triggered: 2026-05-12T09:45:00Z
│  └─ [Acknowledge] [Resolve]
├─ ⚠️ sync_dnse_balances: No run for 40 minutes (threshold: 30)
│  └─ Last successful: 2026-05-12T08:30:00Z
└─ ⚠️ offpeak_vnbroker_ingest: Not running (scheduled 18:10, off-hours)
   └─ Next run: 2026-05-13T18:10:00Z

Historical Alerts (resolved in last 7 days): [link]
```

### E. Implementation Plan

#### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Create `service_ops` Django app with models
- [ ] Database migrations
- [ ] Admin interface for ServiceDefinition + ServiceConfig
- [ ] Health check scheduler task
- [ ] Basic REST API endpoints (list, detail, trigger, logs)

#### Phase 2: Dashboard & Control (Week 2-3)
- [ ] React admin dashboard
  - Service registry grid
  - Health heatmap
  - Run history timeline
- [ ] Manual trigger modal
- [ ] Config editor with rollback
- [ ] Alert acknowledgment UI

#### Phase 3: Integration with Existing Services (Week 3-4)
- [ ] Register all 23+ existing services in database
- [ ] Migrate hardcoded configs → database
  - Prefetch topology (hot/warm/cold)
  - Whale detection intervals
  - Advisory batch sizes
  - Stream consumer gates
  - Data ingest cron
- [ ] Update Celery Beat to read from ServiceDefinition
- [ ] Migrate existing service run logging → ServiceRun + ServiceRunLog

#### Phase 4: Advanced Features (Week 4-5)
- [ ] Service dependency DAG
- [ ] Circuit breaker + fallback policies
- [ ] Queue prioritization (realtime_prefetch > default > offhours)
- [ ] Rate limiting & throttling per service
- [ ] Slack/PagerDuty integration

#### Phase 5: Metrics & Observability (Week 5-6)
- [ ] Performance metrics per service (p50, p95, p99 latency)
- [ ] Cost metrics (API calls, data transferred)
- [ ] SLA tracking (uptime, availability)
- [ ] Trend analysis (charts for last 30 days)

---

## III. Benefits & Expected Outcomes

### Before SOC
```
├─ No visibility into service health
├─ Manual troubleshooting via logs grep
├─ Config spread across env vars + code + cache
├─ Pause/resume requires restart or Redis manipulation
├─ No audit trail
└─ Services starve each other (prefetch loses to whale detection)

Result: ⚠️ 10-15% data freshness miss, random service failures
```

### After SOC
```
├─ Real-time dashboard → ops team sees health immediately
├─ Config versioning → rollback in 30s if needed
├─ Pause/resume graceful → no restart required
├─ Audit trail → who changed what & when
├─ Queue prioritization → realtime prefetch never starves
├─ Circuit breaker → fail gracefully, retry smartly
├─ Dependency DAG → whale alerts + distribution coordinated
└─ Manual trigger → one-click "fetch latest symbol list now"

Result: ✅ 99%+ data freshness, proactive alerting, 10x faster ops response
```

### Specific Improvements

| Service | Current | After SOC |
|---|---|---|
| **Realtime Prefetch** | Starves when whale detection heavy | Dedicated queue, never starves |
| **Whale Alerts** | Fail silently, no health check | Alert after 3 failures, auto-retry |
| **Data Ingest** | Manual cron, no tracking | UI trigger, run history, metrics |
| **Advisory Generation** | Config in code, 240min hard interval | Config in DB, interval adjustable via UI |
| **Watchlist Sync** | DNSE failures unnoticed for hours | Alert after 30min stale, acknowledge UI |
| **Maintenance** | Hardcoded cleanup, no logs | Configurable retention, full audit trail |

---

## IV. Estimated Scope

### Development
- **Backend**: 200-250 lines (models) + 400-500 lines (API views + serializers) + 300 lines (Celery adapter)
- **Frontend**: 800-1000 lines (React components)
- **Migration**: 100 lines per existing service (5-10 hours to register all 23)
- **Tests**: 600+ lines (integration tests for trigger, config, health check)
- **Total**: ~3500-4000 lines (6-8 weeks for full implementation)

### Dependencies
- Django ORM (existing)
- DRF (existing)
- Celery Beat (existing, already configured)
- React Admin (existing stack)
- PostgreSQL JSONB (for config_json, result_json)

### No Breaking Changes
- Existing services continue to run
- Gradual migration to SOC management
- Opt-in for each service (can run both beat + SOC in parallel)

---

## V. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SOC API bottleneck (health checks hammer DB) | Medium | High | Cache health snapshot for 1min, dedicated read replica |
| Config rollback causes cascade failures | Low | Critical | Dry-run validation before apply, gradual rollout |
| Manual trigger abuse (spam services) | Medium | Medium | Rate limit per user, require approval for some services |
| Service hangs during execution tracking | Low | Medium | Celery soft+hard timeouts, task.revoke() fallback |
| Data loss if ServiceRun records deleted | Low | High | Separate logging table, archival strategy after 90 days |

---

## VI. Next Steps

1. **Week 1**: Approve architecture + create project structure
2. **Week 1-2**: Implement Phase 1 (models + basic API + health check)
3. **Week 2-3**: Implement Phase 2 (dashboard UI)
4. **Week 3-4**: Register existing services + migrate configs
5. **Week 4+**: Iterate on features based on ops team feedback

---

## VII. Success Metrics

- ✅ All 23+ services registered in SOC database
- ✅ Zero manual restart required for config changes (all via SOC UI)
- ✅ 100% of service failures alerted within 5 minutes
- ✅ Average MTTD (Mean Time To Detect) < 2 minutes
- ✅ Average MTTR (Mean Time To Recover) < 5 minutes
- ✅ Config audit trail 100% complete (no silent changes)
- ✅ Dashboard uptime 99.5%+
- ✅ Realtime prefetch never starves (<1% cache miss due to starvation)

---

## Appendix A. Service Registry Bootstrap (Initial Dataset)

See attached `SERVICE_REGISTRY_BOOTSTRAP_DATA.json` with 23 service definitions ready to import.

---

**Document prepared for SOC Architecture Review**  
**Status**: PROPOSAL  
**Next Review**: After architecture approval  
**Owner**: Ops/Platform Team  
**Stakeholders**: Backend, DevOps, Product
