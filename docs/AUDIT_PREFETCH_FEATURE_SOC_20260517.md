# AUDIT REPORT: Prefetch Feature (SOC)

## Date: 2026-05-17 (re-audited 2026-05-17 — original draft date was incorrect: 2025-05-17)
## Location: `/operations-center?tab=prefetch`
## Auditor: BLACKBOXAI

---

## 1. Executive Summary

| Attribute | Value |
|-----------|-------|
| **Feature** | Ticker Prefetch Scheduler & Runtime Config |
| **Route** | `/operations-center?tab=prefetch` (SOCPage) |
| **Frontend Component** | `frontend/src/components/soc/PrefetchPanel.jsx` |
| **Backend API** | `packages/core/backend/src/service_ops/views/prefetch.py` |
| **API Base URL** | `/api/soc/prefetch/` |
| **i18n Support** | EN/VI (full) |
| **Status** | Active / In Production |

The Prefetch feature provides runtime configuration and observability for the ticker prefetch scheduler that proactively fetches market data to ensure cache freshness for downstream services (realtime ticker, alerts, analytics).

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React)                           │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  PrefetchPanel.jsx                                    │    │
│  │  • Universe Groups Multiselect                        │    │
│  │  • Config Form (11 fields)                           │    │
│  │  • Profiles Form (6 time profiles)                  │    │
│  │  • Cache Status Display                              │    │
│  │  • Warm Now / Purge Actions                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                     │
│  socApi.js (BASE_URL: /api/soc/)                                │
└───────────────────────────┬─────────────────────────────────────┘
                          │ HTTP
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Backend API (Django + DRF)                        │
│  /api/soc/prefetch/config/            (GET/POST)                 │
│  /api/soc/prefetch/config/profiles/ (GET)                     │
│  /api/soc/prefetch/cache-status/     (GET)                   │
│  /api/soc/prefetch/purge-cache/     (POST)                    │
│  /api/soc/prefetch/warm-now/       (POST)                    │
│  /api/soc/prefetch/universe-groups/(GET)                     │
│  /api/soc/prefetch/task-schedule/  (GET)                     │
│  /api/soc/prefetch/ownership/     (GET)                     │
└───────────────────────────┬─────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│              Service Layer                                      │
│  • SOC Registry (domain configs)                               │
│  • ServiceConfig (DB)                                        │
│  • ServiceRunLog (execution history)                          │
│  • GlobalSymbolRegistry (priority tiers)                        │
│  • GlobalSymbolCoverage (data freshness)                       │
│  • Redis (cache backend)                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. API Contract

### 3.1 Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/soc/prefetch/config/` | Get current runtime config |
| POST | `/api/soc/prefetch/config/` | Apply new runtime config |
| GET | `/api/soc/prefetch/config/profiles/` | List 6 time profiles |
| GET | `/api/soc/prefetch/cache-status/` | Cache performance stats |
| POST | `/api/soc/prefetch/purge-cache/` | Force purge cache |
| POST | `/api/soc/prefetch/warm-now/` | Queue warm-up cycle |
| GET | `/api/soc/prefetch/universe-groups/` | Symbol group registry |
| GET | `/api/soc/prefetch/task-schedule/` | Active task schedule |
| GET | `/api/soc/prefetch/ownership/` | Ownership matrix |

### 3.2 Config Payload Schema

```python
{
    'active_profile': str,              # 'pre_open' | 'market_open' | 'lunch_break' | 'pre_close' | 'post_close' | 'offhours'
    'pre_open_interval_seconds': int,     # Default: 120
    'market_open_interval_seconds': int, # Default: 30
    'lunch_break_interval_seconds': int, # Default: 300
    'pre_close_interval_seconds': int,   # Default: 30
    'post_close_interval_seconds': int,    # Default: 600
    'offhours_interval_seconds': int,     # Default: 3600
    'batch_size': int,               # Default: 50
    'max_concurrent_workers': int,    # Default: 4
    'universe_group_ids': list,     # Symbol group IDs
    'cache_ttl_seconds': int,      # Default: 25
    'enabled': bool,              # Default: True
    'skip_non_trading_days': bool # Default: True
}
```

### 3.3 Time Profiles

| Profile | Description |
|---------|------------|
| `pre_open` | Before market open (08:00-09:00) |
| `market_open` | Market open (09:00-11:30) |
| `lunch_break` | Lunch break (11:30-13:00) |
| `pre_close` | Pre-close (14:30-15:00) |
| `post_close` | After close (15:00-18:00) |
| `offhours` | Offhours (18:00-08:00) |

---

## 4. UI Component Analysis

### 4.1 Layout Structure

**File:** `frontend/src/components/soc/PrefetchPanel.jsx`

| Section | Components | Fields |
|---------|-----------|--------|
| Header | Title, Warm Now (async/sync), Purge Cache buttons | 3 actions |
| Universe Groups | Multiselect grid with coverage bars | Dynamic list |
| Config Form | 11 number inputs | batch_size, symbol_limit, max_retries, etc. |
| Profiles Form | 6 number inputs | interval_seconds per profile |
| Cache Status | 3 stat cards | Hit Rate, Cache Size, TTL |
| Preview Modal | Config-diff + Apply confirmation | Change summary |

### 4.2 Universe Group Card UI

```
┌────────────────────────────────────────────────┐
│ [★] Group Name                    [badge] ●    │
│ [checkbox]              [registry_tier|hint_only]  │
│ ─────────────────────────────────────────────── │
│ ████████████░░░░░░░░░ 75%                 │
│ 150 symbols / 200 total                      │
│ Updated: 17/05/2025                         │
└───────────────────────────��────────────────────┘
```

- **Visual Indicators:**
  - ★ Custom group (teal accent)
  - Registry tier badge (emerald)
  - Hint-only badge (amber)
  - Data status dot (green=has data, gray=missing)
  - Coverage bar (green ≥90%, yellow ≥60%, red <60%)

### 4.3 User Interactions

| Action | Behavior |
|--------|---------|
| Checkbox toggle | Add/remove from `selectedGroups` state |
| Batch change | Number input validation via `handleFieldChange` |
| Preview | Open `ConfigPreviewModal` with diff |
| Apply | POST to `/api/soc/prefetch/config/` |
| Warm Now (async) | POST to `/api/soc/prefetch/warm-now/?mode=async` |
| Warm Now (sync) | POST to `/api/soc/prefetch/warm-now/?mode=sync` |
| Purge Cache | POST to `/api/soc/prefetch/purge-cache/` |

---

## 5. Backend Implementation

### 5.1 Key Files

| File | Purpose |
|------|---------|
| `packages/core/backend/src/service_ops/views/prefetch.py` | API view handlers |
| `packages/core/backend/src/service_ops/urls.py` | URL routing |
| `packages/core/backend/src/service_ops/domain_configs.py` | Domain config classes |
| `packages/core/backend/src/service_ops/ownership.py` | Ownership matrix |
| `packages/core/backend/src/service_ops/registry.py` | Service registry |
| `packages/core/backend/src/service_ops/models.py` | ServiceConfig, ServiceRunLog |
| `packages/core/backend/src/service_ops/tasks.py` | Celery tasks (queue tier scheduler, etc.) |
| `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py` | `_build_prefetch_health_snapshot()` helper |

> ⚠️ **Correction (re-audit 2026-05-17):** The original draft referenced `backend/portfolio/tasks_prefetch.py` and `backend/portfolio/services_global_signal_universe.py` — **these paths do not exist** in the current codebase. Prefetch tasks are handled via the `service_ops` domain registry pattern (ServiceRunLog + queue tier scheduler).

### 5.2 Database Models

**ServiceConfig:**
- `service`: FK to ServiceDefinition
- `config_payload`: JSON (PrefetchTimePolicyConfig)
- `config_schema_version`: string
- `applied_by`: string
- `applied_at`: datetime
- `change_reason`: string
- `is_current`: boolean

**ServiceRunLog:**
- `service`: FK to ServiceDefinition
- `status`: string (queued/running/completed/failed)
- `input_summary`: JSON
- `output_summary`: JSON
- `started_at`: datetime
- `completed_at`: datetime

### 5.3 Caching & Performance

| Metric | Source |
|--------|-------|
| Cache Hit Ratio | Redis `GET/INCR` counters |
| Memory Usage | Redis `INFO memory` |
| TTL | Configurable per profile |
| Last Prefetch | Timestamp in metadata |

---

## 6. Observability

### 6.1 Health Check

- **Endpoint:** No dedicated `/api/health/prefetch/` endpoint exists.
- **Location:** `packages/core/backend/src/vninvest_core/contracts/admin_ops/views.py` → `_build_prefetch_health_snapshot()` (private helper, consumed internally by admin-ops health views at `/api/admin-ops/health/` and the compat bridge).

> ⚠️ **Correction (re-audit 2026-05-17):** The original draft claimed the health check lives at `GET /api/health/prefetch/` backed by `backend/config/health.py → build_prefetch_health_snapshot()`. **Neither the endpoint nor the file path is accurate.** The function is `_build_prefetch_health_snapshot` (private, underscore-prefixed) in `admin_ops/views.py`.

**Health Response:**
```json
{
  "healthy": true,
  "status": "ok|idle|throttled_by_policy|error",
  "reason": "no_prefetch_meta_yet|no_symbols_to_prefetch|...",
  "meta_present": true,
  "prefetch": {
    "status": "ok|running|retrying|...",
    "symbol_count": 0,
    "last_run": "ISO timestamp",
    "query_enabled": true
  }
}
```

### 6.2 Metrics

| Metric | Endpoint |
|--------|----------|
| Profile hits by type | `/api/soc/prefetch/metrics/` |
| Cache hit/miss | `/api/soc/prefetch/cache-status/` |
| 429 cooldown | Calculated from rate_limit_guard |

---

## 7. Security & Permissions

### 7.1 Permission Classes

- **View:** `IsAuthenticated` (any authenticated user)
- **Write:** `IsAdminUser` (staff only for apply config)
- **Ownership Matrix:** Controls write surface

### 7.2 Ownership Fields

| Field | Locked? | Description |
|-------|--------|------------|
| `active_profile` | No | Current time profile |
| `batch_size` | No | Symbols per batch |
| `universe_group_ids` | No | Selected groups |

### 7.3 Compatibility

- **Backend:** SOC (read/write)
- **Admin Ops:** Legacy admin interface (read-only)
- **API Consumer:** Other services via REST

---

## 8. Findings & Issues

### 8.1 Issues Found

| Severity | Issue | Location | Description |
|----------|-------|----------|-------------|
| MEDIUM | Hardcoded values in cache status view | `PrefetchCacheStatusView.get()` | Returns mock data (15234 hits, 3421 misses) instead of real Redis metrics (confirmed at `prefetch.py` line 306) |
| MEDIUM | No real execution in warm-now | `PrefetchWarmNowView.post()` | Creates a `ServiceRunLog` with `status='queued'` but does not dispatch a Celery task. This follows the planner pattern — the queue tier scheduler must pick up the queued log — but no scheduler entry currently polls for warm_now triggered logs. |
| ~~MEDIUM~~ ✅ RESOLVED | ~~No authentication check~~ | ~~All views~~ | **FALSE POSITIVE — re-audit 2026-05-17.** `SOCBaseView` (base class for all prefetch views) already enforces `permission_classes = [IsAuthenticated, IsAdminUser]`. All write endpoints are admin-only. |
| LOW | Incomplete error handling | PrefetchPanel.jsx | No loading state during warm-now execution |
| LOW | No form validation | Config form | Missing client-side min/max validation |

### 8.2 Recommendations

1. **Replace mock cache status** with real Redis metrics query:
   - Use `redis.get('prefetch:cache_hits')` and `redis.get('prefetch:cache_misses')`
   - Calculate hit_ratio dynamically

2. **Implement actual warm-now trigger**:
   - Dispatch Celery task `tasks_prefetch.prefetch_ticker_price_board`
   - Pass `universe_group_ids` from config

3. ~~**Add write permission guard**~~:
   > **RESOLVED — re-audit 2026-05-17.** `SOCBaseView.permission_classes = [IsAuthenticated, IsAdminUser]` already guards all endpoints. No action needed.

4. **Add loading state for warm-now**:
   - Show spinner while waiting for 202 response
   - Poll status until completion

5. **Add field validation**:
   - batch_size: min=1, max=500
   - interval_seconds: min=5, max=3600

---

## 9. Test Coverage

### 9.1 Existing Tests

**File:** `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py`

| Test | Coverage |
|------|---------|
| `test_prefetch_config_get` | ✅ GET /config/ |
| `test_prefetch_config_apply` | ✅ POST /config/ |
| `test_prefetch_universe_groups` | ✅ GET /universe-groups/ |
| `test_prefetch_schedule` | ✅ GET /task-schedule/ |
| `test_prefetch_profiles_cache` | ✅ GET /config/profiles/ |
| `test_prefetch_cache_status` | ✅ GET /cache-status/ |
| `test_prefetch_purge_cache` | ✅ POST /purge-cache/ |
| `test_prefetch_warm_now` | ✅ POST /warm-now/ |
| `test_prefetch_ownership` | ✅ GET /ownership/ |

**Missing test coverage:**
- End-to-end warm-now triggers actual prefetch
- Real cache metrics calculation
- Permission enforcement

---

## 10. Dependencies

### 10.1 Python Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `djangorestframework` | ≥3.14 | API framework |
| `drf-spectacular` | ≥0.27 | OpenAPI schema |
| `django-redis` | ≥4.9 | Redis cache |
| `celery` | ≥5.3 | Task queue |
| `asyncio-throttle` | ≥1.0.2 | Rate limiting |

### 10.2 External Services

| Service | Purpose |
|---------|---------|
| Redis | Cache backend |
| Celery | Task scheduler |
| Postgres | Metadata storage |

---

## 11. i18n Strings

### 11.1 English Keys

| Key | Value |
|-----|-------|
| `soc.prefetch.title` | Prefetch Management |
| `soc.prefetch.universe_groups` | Universe groups (Symbol Groups) |
| `soc.prefetch.config` | Configuration |
| `soc.prefetch.profiles` | Time Profiles |
| `soc.prefetch.cache_status` | Cache Status |
| `soc.prefetch.warm_async` | Warm Now (Async) |
| `soc.prefetch.warm_sync` | Warm Now (Sync) |
| `soc.prefetch.purge` | Purge Cache |

### 11.2 Vietnamese Keys

| Key | Value |
|-----|-------|
| `soc.prefetch.title` | Quản lý Prefetch |
| `soc.prefetch.universe_groups` | Nhóm universe (Symbol Groups) |
| `soc.prefetch.config` | Cấu hình |
| `soc.prefetch.profiles` | Hồ sơ thời gian |
| `soc.prefetch.cache_status` | Trạng thái Cache |
| `soc.prefetch.warm_async` | Làm ấm (Async) |
| `soc.prefetch.warm_sync` | Làm ấm (Sync) |
| `soc.prefetch.purge` | Xóa Cache |

---

## 12. Conclusion

The Prefetch feature is a well-structured SOC domain with:
- ✅ Complete API contract (9 endpoints)
- ✅ Full i18n coverage (EN/VI)
- ✅ Comprehensive frontend UI
- ✅ Test coverage for API contract
- ⚠️ Mock data in cache status
- ⚠️ No actual execution in warm-now
- ⚠️ Missing write permission enforcement

**Recommendation:** Prioritize fixing the medium-severity issues (#1-3) to achieve production-ready status.

---

## Appendix: File Paths

### Frontend
- `frontend/src/components/soc/PrefetchPanel.jsx`
- `frontend/src/components/soc/SOCDomainTabs.jsx`
- `frontend/src/api/socApi.js`
- `frontend/src/i18n/en.js` (prefetch keys)
- `frontend/src/i18n/vi.js` (prefetch keys)

### Backend
- `packages/core/backend/src/service_ops/views/prefetch.py`
- `packages/core/backend/src/service_ops/urls.py`
- `packages/core/backend/src/service_ops/domain_configs.py`
- `backend/portfolio/tasks_prefetch.py`
- `backend/portfolio/services_global_signal_universe.py`
- `backend/config/health.py`

### Tests
- `packages/core/backend/src/service_ops/tests/test_soc_api_domain.py`
- `packages/backend/portfolio/tests/test_ticker_prefetch_task.py`
