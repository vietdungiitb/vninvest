# SAAS-15 Phase 3: Shadow Run Planning & Parity Verification

**Ngày:** 2026-05-10  
**Phase:** 3 of 6 (Decommission sequence)  
**Duration:** ≥3 days (live trading environment)  
**Owner:** Tech Lead + DevOps + Backend Lead  
**Purpose:** Verify core endpoint parity with legacy before production cutover  
**Success Criteria:** Parity score ≥ 99% for ≥3 consecutive trading days

---

## 1. Shadow Run Architecture

### Overview: Dual-track execution

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React + React Native)              │
│                    (unchanged routing logic)                    │
└────────────┬────────────────────────────────────┬───────────────┘
             │                                    │
             v                                    v
    ┌─────────────────┐              ┌──────────────────┐
    │  Legacy Backend │              │   Core API       │
    │  (Primary)      │              │   (Shadow)       │
    │                 │              │                  │
    │ ✅ Production   │              │ 🧪 Experimental  │
    │    live traffic │              │    dual-read     │
    │                 │              │                  │
    └────────┬────────┘              └────────┬─────────┘
             │                               │
             v                               v
    ┌─────────────────┐              ┌──────────────────┐
    │  Legacy DB      │              │   Core DB        │
    │  (portfolio_*)  │              │   (identity_*,   │
    │                 │              │    market_*,     │
    │  vninvest       │              │    signal_*,     │
    │                 │              │    commercial_*) │
    │                 │              │                  │
    └─────────────────┘              └──────────────────┘
             ^                               ^
             └───────────┬───────────────────┘
                         │
                ┌────────v─────────┐
                │  Parity Logger   │
                │  (Request/       │
                │   Response       │
                │   Comparison)    │
                └──────────────────┘
```

### Request flow during shadow run:

```
1. Frontend sends request to legacy backend endpoint
   ↓
2. Legacy backend processes request
   ↓
3. (Async) Core API receives dual-read request via queue/webhook
   ↓
4. Core API processes request in parallel
   ↓
5. Parity logger compares:
   - Response status codes (200, 4xx, 5xx)
   - Response payload structure
   - Response data values (row count, aggregates, etc.)
   - Latency difference (legacy vs core)
   ↓
6. Mismatch → logged + alerted to DevOps
   ↓
7. Match → metric recorded (parity_match = 1)
```

### Key principle:
- **Primary path:** Legacy backend serves production traffic (users see this)
- **Shadow path:** Core API processes same requests asynchronously
- **No user impact:** Core failures don't affect user experience
- **Capture & compare:** Every request logged for parity analysis

---

## 2. Parity Verification Strategy

### 2.1 Request Capture & Dual-read Implementation

**Location:** Middleware in legacy backend (`backend/config/middleware.py`)

```python
import logging
import json
import hashlib
from django.utils.decorators import sync_and_async_middleware
from celery import shared_task
import requests

logger = logging.getLogger('shadow_run.parity')

class ShadowRunDualReadMiddleware:
    """
    Capture all legacy API requests and send to core for shadow processing.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        self.core_api_base = os.getenv('CORE_API_SHADOW_URL', 'http://core-api:8000')
        self.shadow_enabled = os.getenv('SHADOW_RUN_ENABLED', 'false').lower() == 'true'
    
    def __call__(self, request):
        # Serve primary legacy response
        response = self.get_response(request)
        
        # Queue shadow request (non-blocking)
        if self.shadow_enabled and should_shadow_request(request):
            shadow_request_async.delay(
                method=request.method,
                path=request.path,
                query_params=dict(request.GET),
                body=request.body.decode('utf-8') if request.body else '',
                headers=dict(request.headers),
                response_status=response.status_code,
                response_body=response.content.decode('utf-8') if response.content else '',
                timestamp=datetime.utcnow().isoformat(),
            )
        
        return response

def should_shadow_request(request):
    """Filter: only shadow API endpoints, not static files or health checks."""
    shadow_paths = [
        '/api/portfolios/',
        '/api/transactions/',
        '/api/watchlist-items/',
        '/api/tracked-symbols/',
        '/api/stocks/',
        '/api/signals/',
    ]
    return request.path.startswith('/api/') and any(
        request.path.startswith(p) for p in shadow_paths
    )

@shared_task(name='shadow_run.tasks.shadow_request_async', bind=True, max_retries=2)
def shadow_request_async(self, method, path, query_params, body, headers, response_status, response_body, timestamp):
    """
    Async shadow request: call core endpoint, compare response, log parity.
    """
    try:
        # Construct core API URL (map legacy path to core path)
        core_path = map_legacy_path_to_core(path)
        core_url = f"{self.core_api_base}{core_path}"
        
        # Execute shadow request
        shadow_response = requests.request(
            method=method,
            url=core_url,
            params=query_params,
            data=body,
            headers={k: v for k, v in headers.items() if k.lower() not in ['host', 'content-length']},
            timeout=30,
        )
        
        # Compare responses
        parity_result = compare_responses(
            legacy_status=response_status,
            legacy_body=response_body,
            core_status=shadow_response.status_code,
            core_body=shadow_response.text,
            path=path,
        )
        
        # Log result
        log_parity_result(parity_result, timestamp)
        
    except Exception as exc:
        logger.error(f'[shadow] Request failed: {path} - {exc}')
        raise self.retry(exc=exc)

def map_legacy_path_to_core(legacy_path: str) -> str:
    """Map legacy API path to core equivalent."""
    mapping = {
        '/api/portfolios/': '/core/v1/workspace/portfolios/',
        '/api/transactions/': '/core/v1/workspace/transactions/',
        '/api/watchlist-items/': '/core/v1/workspace/watchlist-items/',
        '/api/tracked-symbols/': '/core/v1/workspace/tracked-symbols/',
        '/api/stocks/': '/core/v1/market-data/stocks/',
        '/api/signals/': '/core/v1/signals/',
    }
    for legacy, core in mapping.items():
        if legacy_path.startswith(legacy):
            return core + legacy_path[len(legacy):]
    return legacy_path  # Fallback: return as-is

def compare_responses(legacy_status, legacy_body, core_status, core_body, path):
    """Compare legacy vs core responses for parity."""
    
    result = {
        'path': path,
        'timestamp': datetime.utcnow().isoformat(),
        'legacy_status': legacy_status,
        'core_status': core_status,
        'status_match': legacy_status == core_status,
        'parity_score': 0,
    }
    
    try:
        legacy_json = json.loads(legacy_body) if legacy_body else {}
        core_json = json.loads(core_body) if core_body else {}
    except json.JSONDecodeError:
        result['parity_score'] = 0.5 if result['status_match'] else 0
        result['error'] = 'JSON parse failed'
        return result
    
    # Check structure
    legacy_keys = set(legacy_json.keys()) if isinstance(legacy_json, dict) else set()
    core_keys = set(core_json.keys()) if isinstance(core_json, dict) else set()
    
    missing_in_core = legacy_keys - core_keys
    extra_in_core = core_keys - legacy_keys
    
    result['missing_in_core'] = list(missing_in_core)
    result['extra_in_core'] = list(extra_in_core)
    
    # Check count for list endpoints
    if isinstance(legacy_json, dict) and 'count' in legacy_json and 'count' in core_json:
        legacy_count = legacy_json['count']
        core_count = core_json['count']
        result['legacy_count'] = legacy_count
        result['core_count'] = core_count
        result['count_match'] = legacy_count == core_count
    
    # Calculate parity score (0.0 = no parity, 1.0 = perfect parity)
    if not result['status_match']:
        result['parity_score'] = 0.0
    elif missing_in_core or extra_in_core:
        result['parity_score'] = 0.7
    elif result.get('count_match') is False:
        result['parity_score'] = 0.8
    else:
        result['parity_score'] = 1.0
    
    return result

def log_parity_result(result, timestamp):
    """Log parity result for dashboard + alerting."""
    parity_score = result['parity_score']
    
    if parity_score == 1.0:
        logger.info(f"[shadow] PARITY MATCH: {result['path']} @ {timestamp}")
    elif parity_score >= 0.8:
        logger.warning(f"[shadow] PARITY WARN: {result['path']} score={parity_score} @ {timestamp}")
    else:
        logger.error(f"[shadow] PARITY FAIL: {result['path']} score={parity_score} @ {timestamp}")
    
    # Persist to metrics DB
    PurityLog.objects.create(
        path=result['path'],
        legacy_status=result['legacy_status'],
        core_status=result['core_status'],
        parity_score=result['parity_score'],
        details=json.dumps(result),
    )
```

### 2.2 Parity Database Schema

**Location:** `packages/core/backend/src/ops_audit/models.py`

```python
class ParityLog(models.Model):
    """Track parity verification results during shadow run."""
    
    PARITY_STATUS_CHOICES = [
        ('match', 'Perfect Match'),
        ('warn', 'Acceptable Mismatch'),
        ('fail', 'Critical Mismatch'),
    ]
    
    path = models.CharField(max_length=500)
    method = models.CharField(max_length=10, default='GET')
    legacy_status = models.IntegerField()
    core_status = models.IntegerField()
    parity_score = models.FloatField(default=0.0)  # 0.0 to 1.0
    parity_status = models.CharField(max_length=20, choices=PARITY_STATUS_CHOICES, default='fail')
    details = models.JSONField(default=dict)  # {missing_keys, extra_keys, count_mismatch, etc}
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['path', 'timestamp']),
            models.Index(fields=['parity_status', 'timestamp']),
        ]
        verbose_name_plural = 'Parity Logs'
    
    def save(self, *args, **kwargs):
        # Infer status from score
        if self.parity_score >= 0.99:
            self.parity_status = 'match'
        elif self.parity_score >= 0.85:
            self.parity_status = 'warn'
        else:
            self.parity_status = 'fail'
        super().save(*args, **kwargs)
```

### 2.3 Daily Parity Report

**Location:** `packages/core/backend/src/ops_audit/tasks.py` — new task

```python
@shared_task(name='ops_audit.tasks.shadow_run_daily_parity_report', bind=True)
def shadow_run_daily_parity_report(self):
    """
    Generate daily parity report.
    Schedule: daily at 22:00 (after market close)
    """
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models import Avg, Q
    
    yesterday = timezone.now().date() - timedelta(days=1)
    logs = ParityLog.objects.filter(timestamp__date=yesterday)
    
    if not logs.exists():
        logger.warning('[shadow] No parity logs for yesterday')
        return {'status': 'skipped', 'reason': 'no_logs'}
    
    # Calculate metrics
    total_requests = logs.count()
    perfect_matches = logs.filter(parity_status='match').count()
    warnings = logs.filter(parity_status='warn').count()
    failures = logs.filter(parity_status='fail').count()
    avg_score = logs.aggregate(Avg('parity_score'))['parity_score__avg']
    
    # Group by path
    by_path = {}
    for path in logs.values_list('path', flat=True).distinct():
        path_logs = logs.filter(path=path)
        by_path[path] = {
            'count': path_logs.count(),
            'parity_score': path_logs.aggregate(Avg('parity_score'))['parity_score__avg'],
            'fail_count': path_logs.filter(parity_status='fail').count(),
        }
    
    report = {
        'date': yesterday.isoformat(),
        'total_requests': total_requests,
        'perfect_matches': perfect_matches,
        'warnings': warnings,
        'failures': failures,
        'overall_parity_score': avg_score,
        'parity_score_pct': f"{avg_score * 100:.1f}%",
        'by_path': by_path,
        'go_nogo': 'GO' if avg_score >= 0.99 else 'REVIEW' if avg_score >= 0.95 else 'NO-GO',
    }
    
    # Save report
    ParityReport.objects.create(
        report_date=yesterday,
        overall_parity_score=avg_score,
        total_requests=total_requests,
        pass_count=perfect_matches,
        warn_count=warnings,
        fail_count=failures,
        details=report,
    )
    
    logger.info(f'[shadow] Daily report: date={yesterday}, score={avg_score:.2%}, go={report["go_nogo"]}')
    
    # Alert if failures detected
    if failures > 0:
        send_alert_to_devops(f'[SHADOW-RUN] Parity failures detected: {failures} requests', report)
    
    return {'status': 'ok', 'report': report}
```

---

## 3. Timeline & Execution Schedule

### Shadow Run Window: 3 consecutive trading days (Monday-Wednesday or Tuesday-Thursday)

| Day | Time | Activity | Owner | Success Criteria |
|-----|------|----------|-------|------------------|
| Day 0 (Fri) | EOD | Enable shadow run in legacy backend (SHADOW_RUN_ENABLED=true) | DevOps | Flag set, no errors in logs |
| Day 1 (Mon) | 09:00 | Start shadow run + parity logging | DevOps | First parity logs appearing |
| Day 1 | 22:00 | Daily parity report #1 | Automation | Parity score ≥98% |
| Day 2 (Tue) | 09:00 | Continue shadow run (normal market activity) | Ops | No new failures in alert feed |
| Day 2 | 22:00 | Daily parity report #2 | Automation | Parity score ≥99% |
| Day 3 (Wed) | 09:00 | Final shadow run day (stress test if possible) | Ops | Monitor for edge cases |
| Day 3 | 22:00 | Daily parity report #3 | Automation | Parity score ≥99% for 3 consecutive days |
| Day 3 | 23:00 | Tech Lead review + go/no-go decision | Tech Lead | Sign-off for Phase 4 cutover |
| Day 4 (Thu) | 08:00 | If GO: disable shadow run, prepare for Phase 4 cutover | DevOps | Clean logs, checkpoint DB |

### Checkpoint intervals:
- **Hourly:** Check error logs for new failures
- **End of market (17:00):** Pause check-in call (Tech Lead + DevOps)
- **EOD (22:00):** Automated parity report generation

---

## 4. Go/No-Go Decision Criteria

### GREEN (GO) — Proceed to Phase 4 Cutover

```
✅ Parity score >= 99% for all 3 days
✅ Zero critical failures (parity_status = 'fail')
✅ No new errors in legacy backend logs
✅ No new errors in core backend logs
✅ Response latency difference < 500ms (core vs legacy)
✅ All 6 major endpoints passing parity check
✅ Tech Lead sign-off
```

**Action:** Disable shadow run, schedule Phase 4 cutover (usually next Monday)

### YELLOW (REVIEW) — Extend shadow run

```
⚠️  Parity score 95-99% for all 3 days (acceptable but worth investigating)
⚠️  1-5 failures detected in non-critical endpoints
⚠️  Response latency difference 500ms-1s
⚠️  All major endpoints passing, but minor issues remain
```

**Action:** Extend shadow run 1-2 more days, focus on failing endpoints, investigate root cause

### RED (NO-GO) — Abort, investigate, fix

```
❌ Parity score < 95% on any day
❌ >= 5 critical failures in any endpoint
❌ New data corruption detected
❌ Core database integrity compromised
❌ Response latency difference > 1s
❌ Any endpoint completely unavailable in core
```

**Action:** 
1. Disable shadow run immediately
2. Root cause analysis (compare code, DB state)
3. Rollback core changes if needed
4. Fix issues, test in dev/staging
5. Reschedule shadow run (not before 1 week)

---

## 5. Key Endpoints to Monitor

### Portfolio & Transactions
- `GET /api/portfolios/` — list portfolios (cursor pagination)
- `GET /api/portfolios/{id}/` — portfolio detail
- `GET /api/transactions/` — list transactions (cursor pagination)
- `POST /api/transactions/` — create transaction
- `PATCH /api/transactions/{id}/` — update transaction

### Watchlist & Symbols
- `GET /api/watchlist-items/` — list tracked symbols (cursor pagination)
- `POST /api/watchlist-items/` — add tracked symbol
- `GET /api/stocks/{symbol}/` — symbol details (company, price)

### Signals & Alerts
- `GET /api/signals/whale-feed/` — whale feed (cursor pagination)
- `GET /api/signals/unified-alert/` — unified alerts (cursor pagination)
- `GET /api/signals/session-facts/` — session facts (cursor pagination)

### Advisory
- `GET /api/stocks/{symbol}/ai-advisory-session/` — AI advisory session

**Expected parity issues (known, not failures):**
- Response order may differ (sorted differently in core vs legacy)
- Field names may be slightly different (snake_case vs camelCase)
- Null vs missing field handling (core may omit null, legacy includes)

---

## 6. Monitoring & Alerting

### Metrics Dashboard (Grafana / Datadog)

```
1. Parity Score Over Time
   - Y-axis: parity_score (0.0 - 1.0)
   - X-axis: time
   - Alert: < 0.95 for > 30 min

2. Request Volume by Path
   - Histogram of requests per endpoint
   - Expected: 100-1000 per day per endpoint

3. Latency Comparison
   - Legacy latency (p50, p95, p99)
   - Core latency (p50, p95, p99)
   - Difference (should be < 500ms)

4. Failure Rate by Path
   - Failures / total requests per path
   - Alert: > 5% failure rate
```

### Alert Rules

```
CRITICAL:
  - Parity score < 0.80 for > 10 min → page on-call
  - Core API unresponsive → page on-call
  - Data mismatch (count_mismatch) → page Tech Lead

WARNING:
  - Parity score < 0.95 for > 30 min → slack #incidents
  - Latency diff > 1s → slack #incidents
  - New endpoint failure → slack #incidents

INFO:
  - Daily parity report → slack #shadow-run
```

---

## 7. Incident Response During Shadow Run

### If critical failure detected:

**Scenario 1: Core API returns wrong data (parity_score = 0)**

```
Step 1: Disable shadow dual-read for that endpoint
  → Set SHADOW_EXCLUDED_PATHS = [/api/portfolios/] in env

Step 2: Create incident ticket
  → Title: "[SHADOW] Parity failure: /api/portfolios/"
  → Severity: P1
  → Assign to Backend Lead

Step 3: Investigate
  → Compare legacy vs core request/response
  → Check core DB data
  → Review recent code changes in core

Step 4: Fix in core
  → Update code, test in dev
  → Re-enable shadow dual-read for endpoint
  → Verify parity recover >= 0.99

Step 5: If fix takes > 2 hours
  → Notify Tech Lead
  → Consider extending shadow run window
```

**Scenario 2: Core API performance degradation (latency > 1s)**

```
Step 1: Check core-api container resources
  → CPU, memory, database connections
  → Check slow query logs

Step 2: Increase timeout in shadow request task
  → From 30s to 60s (temporary)

Step 3: If still slow:
  → Scale core-api replicas (if in k8s)
  → Optimize query if possible
  → Escalate to DevOps

Step 4: Re-check latency metrics
  → Goal: latency diff < 500ms
```

**Scenario 3: Shadow run itself failing (middleware errors)**

```
Step 1: Check legacy backend logs for middleware exceptions
  → Look for ShadowRunDualReadMiddleware errors

Step 2: Disable shadow run temporarily
  → Set SHADOW_RUN_ENABLED = false

Step 3: Fix middleware issue
  → Test in dev, restart legacy backend

Step 4: Re-enable and monitor for 1 hour
```

---

## 8. Success Metrics & Post-Shadow Run Actions

### Success definition:
- **Parity score ≥ 99%** on all 3 days
- **Zero critical failures**
- **Latency difference < 500ms**
- **All endpoint pairs passing**
- **Tech Lead sign-off**

### If successful:

1. **Generate shadow run summary report**
   - Overall parity score: X%
   - Endpoints tested: N
   - Failures by category
   - Top 3 lessons learned

2. **Schedule Phase 4 Cutover**
   - Target date: Next Monday (usually)
   - Notify stakeholders 48h in advance
   - Prepare runbooks for incident response

3. **Update documentation**
   - Add shadow run results to SAAS-15 evidence
   - Document any code changes made during shadow run
   - Update architecture diagram with Phase 4 plan

4. **Disable shadow run**
   - Set SHADOW_RUN_ENABLED = false
   - Clean up parity logs (archive to S3)
   - Decommission ParityLog table (optional)

### If unsuccessful (parity < 99%):

1. **Root cause analysis**
   - What endpoint is failing?
   - Why is core returning different data?
   - Is it a code bug or data mismatch?

2. **Fix plan**
   - Code fix? → Test in dev, re-deploy core
   - Data sync issue? → Run data migration, re-verify

3. **Re-run shadow run**
   - Extend window by 1-2 days
   - Verify parity recovers to ≥ 99%

4. **Document lessons learned**
   - What should we have caught before shadow run?
   - How to prevent this in future cutover?

---

## 9. Configuration & Environment Variables

### Enable shadow run in docker-compose.prod.yml:

```yaml
backend:
  environment:
    SHADOW_RUN_ENABLED: "true"
    CORE_API_SHADOW_URL: "http://core-api:8000"
    SHADOW_EXCLUDED_PATHS: ""  # Comma-separated paths to skip
```

### Disable after shadow run:

```yaml
backend:
  environment:
    SHADOW_RUN_ENABLED: "false"
```

---

## 10. Phase 3 Completion Checklist

**Pre-shadow run:**
- [ ] Deploy shadow run middleware to legacy backend
- [ ] Create ParityLog table + migrations
- [ ] Deploy parity logging task to Celery beat
- [ ] Verify Grafana dashboard for parity metrics
- [ ] Set up alert rules in alerting system
- [ ] Brief team on shadow run procedure
- [ ] Verify legacy + core databases in sync (pre-cutover snapshot)

**During shadow run (daily):**
- [ ] Check parity logs at 09:00 (market open)
- [ ] Review hourly error logs
- [ ] Pause check-in call at 17:00
- [ ] Review daily parity report at 22:00
- [ ] Verify parity_score >= 98% (target >= 99%)
- [ ] Escalate any critical failures immediately

**Post-shadow run (if GO):**
- [ ] Generate shadow run summary report
- [ ] Archive parity logs to S3
- [ ] Update SAAS-15 evidence with shadow run results
- [ ] Schedule Phase 4 cutover
- [ ] Notify stakeholders (product, ops, support)
- [ ] Prepare Phase 4 runbooks

**Post-shadow run (if NO-GO):**
- [ ] Create incident post-mortem
- [ ] Document root cause
- [ ] Plan code/data fixes
- [ ] Reschedule shadow run (≥1 week later)
- [ ] Update SAAS-15 evidence with delays

---

## 11. Escalation Contacts

| Role | Name | Phone | Slack | Availability |
|------|------|-------|-------|--------------|
| Tech Lead | [Name] | [Phone] | @tech-lead | 07:00-20:00 HCM |
| DevOps Lead | [Name] | [Phone] | @devops-lead | 07:00-20:00 HCM |
| Backend Lead | [Name] | [Phone] | @backend-lead | 07:00-20:00 HCM |
| On-call | [Rotation] | [Rotation] | @oncall-rotation | 24/7 |

---

## 12. Success Criteria Summary

### Phase 3 completion = ✅ GREEN when:

1. ✅ **Parity verification complete**
   - Parity score ≥ 99% for ≥3 consecutive trading days
   - All 6 major endpoints tested and passing
   - Zero critical failures

2. ✅ **Data integrity verified**
   - Core database contains all legacy data (or equivalently transformed)
   - No data loss detected during shadow run
   - Transaction counts match within ±0.1%

3. ✅ **Performance acceptable**
   - Core API latency < 200ms (p95) for GET requests
   - Latency difference (core vs legacy) < 500ms
   - No timeout-related failures

4. ✅ **Production readiness confirmed**
   - Tech Lead sign-off
   - All incident response procedures tested
   - Rollback procedure verified (per Gate F)

5. ✅ **Documentation updated**
   - Shadow run results documented
   - Lessons learned captured
   - SAAS-15 evidence updated

### Next phase:
**Phase 4: Production Cutover** — Switch production traffic from legacy to core (go-live)

---

**Document owner:** Tech Lead  
**Last updated:** 2026-05-10  
**Status:** 📋 READY FOR PHASE 3 EXECUTION  
**Approval:** Pending stakeholder sign-off
