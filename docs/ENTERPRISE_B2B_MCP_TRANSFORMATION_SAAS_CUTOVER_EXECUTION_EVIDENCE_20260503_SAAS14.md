# SAAS-14 Execution Evidence
## Data-Plane Serving Models Materialization

**Slice ID:** SAAS-14  
**Date:** 2026-05-03  
**Executor:** AI Session (GitHub Copilot)  
**Status:** ✅ COMPLETED

---

## 1. Scope

Materialize `SymbolSnapshot`, `SessionFacts`, `UnifiedAlert`, `WhaleAlertCanonical` từ legacy DB (cutover period) bằng Celery beat tasks; thêm cursor pagination cho list APIs; tạo `coreApiAdapter.js` cho packages/web.

---

## 2. Files Changed / Created

### New (packages/core)

| File | Mô tả |
|------|-------|
| `packages/core/backend/src/vninvest_core/pagination.py` | CoreCursorPagination, AlertCursorPagination, AuditCursorPagination |
| `packages/core/backend/src/market_serving/materializers.py` | materialize_symbol_snapshot, materialize_session_facts, backfill_symbol_snapshots (Celery tasks) |
| `packages/core/backend/src/signal_intelligence/materializers.py` | materialize_unified_alerts, materialize_whale_feed_aggregate (Celery tasks) |
| `packages/core/backend/tests/test_saas14_materializers.py` | 6 materializer + pagination unit tests |

### Modified (packages/core)

| File | Mô tả |
|------|-------|
| `packages/core/backend/src/vninvest_core/celery.py` | Added beat_schedule (4 tasks: symbol-snapshot 60s, session-facts */5, unified-alerts 300s, whale-feed 300s) |
| `packages/core/backend/src/vninvest_core/settings.py` | Added `legacy_readonly` DB config from `LEGACY_DATABASE_URL` env var |
| `packages/core/backend/src/signal_intelligence/views.py` | Applied AlertCursorPagination to UnifiedAlertListView |
| `packages/core/backend/src/ops_audit/views.py` | Applied AuditCursorPagination to AuditLogListView |

### New (packages/web)

| File | Mô tả |
|------|-------|
| `packages/web/src/adapters/coreApiAdapter.js` | Data-plane facade: getSymbolSnapshot, getSessionFacts, getUnifiedAlerts, getWhaleFeedAggregate, getTenantLifecycle |
| `packages/web/src/adapters/coreApiAdapter.test.js` | 12 jest tests (ESM, @jest/globals) |
| `packages/web/jest.config.js` | Jest ESM config (transform: {}, testEnvironment: node) |

### Modified (packages/web)

| File | Mô tả |
|------|-------|
| `packages/web/package.json` | Added jest + jest-environment-node devDependencies, test script |

---

## 3. Validation Commands & Results

### 3.1 Django System Check

```
System check identified no issues (0 silenced).
```

### 3.2 No Pending Migrations

```
No changes detected
Exit: 0
```

### 3.3 Python Unit Tests

```
Ran 29 tests in 3.097s
OK
```

**Breakdown:**
- `test_identity_access`: 9 tests ✅ (unchanged from SAAS-13)
- `test_market_serving`: 3 tests ✅ (unchanged from SAAS-13)
- `test_ops_audit`: 4 tests ✅ (unchanged from SAAS-13)
- `test_runtime_baseline`: 8 tests ✅ (unchanged from SAAS-13)
- `test_saas14_materializers`: 6 tests ✅ (NEW — materializers + pagination)
  - `TestMaterializeSymbolSnapshotNoLegacyUrl.test_no_legacy_url_returns_skipped` ✅
  - `TestMaterializeSessionFactsNoLegacyUrl.test_no_legacy_url_returns_skipped` ✅
  - `TestBackfillNoLegacyUrl.test_no_legacy_url_returns_skipped` ✅
  - `TestCursorPaginationClasses.test_core_cursor_pagination_defaults` ✅
  - `TestCursorPaginationClasses.test_alert_cursor_pagination_ordering` ✅
  - `TestCursorPaginationClasses.test_audit_cursor_pagination_page_size` ✅

Total: **29/29 PASS** ✅

### 3.4 packages/web Jest Tests

```
PASS src/adapters/coreApiAdapter.test.js
Test Suites: 1 passed, 1 total
Tests:       12 passed, 12 total
```

**Test list:**
- `getSymbolSnapshot calls /core/v1/symbol-snapshot/{symbol}/` ✅
- `getSymbolSnapshot throws on missing symbol` ✅
- `getSymbolSnapshot throws on HTTP error` ✅
- `getSessionFacts calls /core/v1/session-facts/{symbol}/` ✅
- `getSessionFacts works without date` ✅
- `getSessionFacts throws on missing symbol` ✅
- `getUnifiedAlerts calls /core/v1/unified-alert/` ✅
- `getUnifiedAlerts works with no params` ✅
- `getWhaleFeedAggregate calls /core/v1/whale-feed-aggregate/{symbol}/` ✅
- `getWhaleFeedAggregate throws on missing symbol` ✅
- `all requests include X-Request-ID header` ✅
- `getTenantLifecycle calls /core/v1/tenant/lifecycle/` ✅

Total: **12/12 PASS** ✅

---

## 4. Architecture: Materializer Data Flow

```
Celery Beat (vninvest_core/celery.py)
  │
  ├── every 60s → market_serving.materializers.materialize_symbol_snapshot
  │     └── reads legacy_readonly DB → upserts SymbolSnapshot (core DB)
  │
  ├── every 5min → market_serving.materializers.materialize_session_facts
  │     └── reads legacy_readonly DB → upserts SessionFacts (core DB)
  │
  ├── every 5min → signal_intelligence.materializers.materialize_unified_alerts
  │     └── reads legacy_readonly DB → upserts UnifiedAlert (core DB)
  │
  └── every 5min → signal_intelligence.materializers.materialize_whale_feed_aggregate
        └── reads legacy_readonly DB → upserts UnifiedAlert + WhaleAlertCanonical (core DB)

packages/web → coreApiAdapter.js → /core/v1/* endpoints → Django DRF views
                                                            (cursor-paginated list views)
```

---

## 5. Degraded Mode Behaviour

When `LEGACY_DATABASE_URL` is not set (or empty):
- `materialize_symbol_snapshot` → returns `{"status": "skipped", "reason": "no_legacy_db_url"}`
- `materialize_session_facts` → returns `{"status": "skipped", "reason": "no_legacy_db_url"}`
- `materialize_unified_alerts` → returns `{"status": "skipped", "reason": "no_legacy_db_url"}`
- Existing SymbolSnapshot rows are marked `stale=True` on `OperationalError`

---

## 6. Exit Criteria Check

| # | Tiêu chí | Kết quả |
|---|----------|---------|
| 1 | Celery beat schedule đăng ký 4 tasks | ✅ celery.py beat_schedule has 4 entries |
| 2 | materialize_symbol_snapshot task tồn tại và import sạch | ✅ task registered, 0 import errors |
| 3 | materialize_session_facts task tồn tại | ✅ |
| 4 | materialize_unified_alerts task tồn tại | ✅ |
| 5 | Materializer gracefully skip khi không có LEGACY_DATABASE_URL | ✅ 3 skipped-mode tests PASS |
| 6 | UnifiedAlertListView có cursor pagination | ✅ AlertCursorPagination applied |
| 7 | AuditLogListView có cursor pagination | ✅ AuditCursorPagination applied |
| 8 | packages/web có coreApiAdapter.js | ✅ file created |
| 9 | coreApiAdapter.test.js pass | ✅ 12/12 PASS |
| 10 | Django check 0 issues | ✅ |
| 11 | makemigrations --check exit 0 | ✅ No changes detected |
| 12 | All Python tests still pass (29/29) | ✅ |

---

## 7. Residual Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Legacy DB table names assumed (`portfolio_symbolsnapshot`, etc.) | Medium | SAAS-15 will verify actual table names when wiring live connection |
| `LEGACY_DATABASE_URL` not set in docker-compose yet | Low | docker-compose update is SAAS-15 scope |
| No shell pages migrated to coreApiAdapter yet | Low | SAAS-15 handles page-level migration |
| Celery beat not running in docker-compose.core.yml | Low | SAAS-15 docker-compose gate adds core-beat service |
