# TECH SPEC: Background Services Control Plane

**Ngày tạo**: 2026-04-22  
**Trạng thái**: DRAFT — kèm theo Implementation Plan

---

## 1. Module Location

### Backend dự kiến
1. `backend/portfolio/models.py`
2. `backend/portfolio/serializers.py`
3. `backend/portfolio/views_admin_service_control.py` (NEW)
4. `backend/portfolio/services_service_control.py` (NEW)
5. `backend/portfolio/tasks_service_control.py` (NEW)
6. `backend/portfolio/service_registry.py` (NEW)
7. `backend/portfolio/observability.py`

### Frontend dự kiến
1. `frontend/src/pages/AdminServiceControl.jsx` hoặc thư mục tương đương
2. `frontend/src/api/client.js`
3. `frontend/src/i18n/vi.js`

---

## 2. Data Model Draft

### 2.1 ServiceDefinition
```python
code: CharField(unique=True)
name: CharField
service_type: CharField  # crawl/backfill/prefetch/realtime/sync/advisory
domain: CharField        # vnstock_adapter / ai_advisory / whale_alert / darkmoney_flow / market_data
enabled: BooleanField
criticality: CharField   # low/medium/high/critical
default_queue: CharField
write_mode_default: CharField
owner_team: CharField
config_schema_version: CharField
```

### 2.2 ServiceExecutionPolicy
```python
service = FK(ServiceDefinition)
overlap_policy: CharField   # reject_new / queue_after_current / replace_if_same_initiator
soft_time_limit_sec: IntegerField
time_limit_sec: IntegerField
heartbeat_interval_sec: IntegerField
stalled_after_sec: IntegerField
max_retries: IntegerField
retry_backoff_policy: JSONField
off_peak_only: BooleanField
requires_reason_on_bypass: BooleanField
approval_required_modes: JSONField
```

### 2.3 ServiceRun
```python
run_id: UUIDField / CharField(unique=True)
service = FK(ServiceDefinition)
task_id: CharField(null=True)
state: CharField
trigger_type: CharField     # scheduled/manual/retry/system
scope_hash: CharField(db_index=True)
scope_json: JSONField
idempotency_key: CharField(null=True)
write_mode: CharField
queued_at: DateTimeField
started_at: DateTimeField(null=True)
last_heartbeat_at: DateTimeField(null=True)
finished_at: DateTimeField(null=True)
release_sha: CharField(null=True)
image_tag: CharField(null=True)
worker_hostname: CharField(null=True)
config_fingerprint: CharField(null=True)
rows_processed: BigIntegerField(default=0)
rows_total: BigIntegerField(default=0)
rows_mutated: BigIntegerField(default=0)
error_code: CharField(null=True)
error_message: TextField(null=True)
mutation_summary: JSONField(default=dict)
```

### 2.4 ServiceRunEvent
```python
run = FK(ServiceRun)
event_type: CharField
event_at: DateTimeField
payload_json: JSONField
```

### 2.5 ServiceSchedule
```python
service = FK(ServiceDefinition)
cron_expr: CharField
timezone: CharField(default='Asia/Ho_Chi_Minh')
active: BooleanField
misfire_policy: CharField
blackout_policy_json: JSONField(default=dict)
```

---

## 3. Redis Key Contract

1. Lease key
```text
lease:{service_code}:{scope_hash}
```

2. Stop key
```text
service:run:{run_id}:stop_requested
```

3. Heartbeat key
```text
service:run:{run_id}:heartbeat
```

4. Idempotency key
```text
service:idempotency:{service_code}:{scope_hash}:{idempotency_key}
```

5. Active worker version key
```text
service:worker:{worker_hostname}:version
```

---

## 4. Generic Runner Contract

### Pseudo flow
```python
def execute_service_run(run_id):
    run = load_run(run_id)
    policy = load_policy(run.service)
    acquire_lease(run.service.code, run.scope_hash)
    update_state(run, 'running')
    emit_event(run, 'started')

    while work_remaining:
        assert_not_stop_requested(run_id)
        do_next_batch()
        update_progress(run_id, rows_processed, rows_total, rows_mutated)
        heartbeat(run_id)

    finalize_success(run_id)
```

### Checkpoint soft-stop
1. Sau mỗi batch symbol.
2. Sau mỗi chunk mutation DB.
3. Sau mỗi vòng retry boundary.

---

## 5. State Machine

### Allowed states
`queued`, `dispatching`, `running`, `stop_requested`, `stopping`, `succeeded`, `failed`, `canceled`, `timeout`, `stalled`, `zombie`, `orphan`

### Guard rules
1. `queued -> dispatching -> running` chỉ qua orchestrator/worker.
2. `running -> stop_requested` chỉ qua control API.
3. `running -> stalled` qua monitor job.
4. `stalled -> failed/retry_queued` theo policy.
5. Terminal: `succeeded`, `failed`, `canceled`, `timeout`.

---

## 6. API Contract Draft

### 6.1 Run service
`POST /api/v1/admin-ops/services/{service_code}/run/`

```json
{
  "scope": {"symbols": ["VCB", "FPT"], "start_date": "2026-04-01", "end_date": "2026-04-20"},
  "write_mode": "reconcile",
  "idempotency_key": "manual-20260422-001",
  "bypass_off_peak": false,
  "reason": "Điều hành kiểm tra dữ liệu"
}
```

### 6.2 Run response
```json
{
  "ok": true,
  "run_id": "srvrun_20260422_0001",
  "service_code": "intraday_side_backfill",
  "state": "queued",
  "task_id": "celery-uuid",
  "scope_hash": "sha256:..."
}
```

### 6.3 Error contract
1. `409 overlap_running`
2. `409 duplicate_idempotency_key`
3. `422 invalid_write_mode`
4. `422 off_peak_violation`
5. `423 service_paused`
6. `403 insufficient_permission`

---

## 7. Write Mode Governance

| Write mode | Mô tả | Approval | Ví dụ |
|---|---|---|---|
| `append_only` | chỉ thêm mới | No | ingest log/event |
| `fill_missing` | chỉ điền dữ liệu trống | No | backfill field null |
| `upsert_if_newer` | update nếu record mới hơn | No | profile sync |
| `reconcile` | update có kiểm soát + diff | Maybe | recompute side |
| `force_overwrite` | ghi đè chủ động | Yes | repair khẩn cấp |

### Guardrails
1. `force_overwrite` bắt buộc `reason` + ticket id.
2. `reconcile` trên scope lớn phải có preview trước.
3. `rows_mutated` vượt ngưỡng phải raise confirm gate.

---

## 8. Version Drift Detection

### Rule
1. Nếu active runs cùng `service_code` có `release_sha` khác nhau -> emit `version_drift_detected`.
2. Nếu worker đang chạy tag ngoài allowlist release hiện tại -> emit `outdated_worker_detected`.

### Event payload mẫu
```json
{
  "service_code": "intraday_side_backfill",
  "active_releases": ["abc123", "def456"],
  "workers": ["worker-a", "worker-b"]
}
```

---

## 9. Permission Extension Draft

1. `IsServiceControlAdmin`
- full control: create/update/run/stop/retry/pause/resume.

2. `IsServiceControlOperator`
- run/stop/retry services trong allowlist, không sửa policy nền.

3. `IsServiceControlViewer`
- chỉ xem registry, run detail, metrics.

Ghi chú: cắm vào `backend/portfolio/permissions.py`, map dần từ mô hình plan hiện tại.

---

## 10. Metrics Naming Draft

1. `vninvest_service_runs_total{service_code,state}`
2. `vninvest_service_run_duration_seconds{service_code}`
3. `vninvest_service_queue_latency_seconds{service_code}`
4. `vninvest_service_stalled_total{service_code}`
5. `vninvest_service_version_drift_total{service_code}`
6. `vninvest_service_rows_mutated_total{service_code,write_mode}`

---

## 11. Migration Order

1. Additive models + migrations.
2. Redis helpers + backend services.
3. API layer + serializers.
4. Pilot worker integrations.
5. Frontend UI.
6. Alert rules + runbook rehearsal.

Không được đảo thứ tự 3 và 1. UI không được đi trước pilot API ổn định.