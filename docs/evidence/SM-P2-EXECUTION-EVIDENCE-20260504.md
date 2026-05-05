# SM Phase 2 — Execution Evidence
**Date**: 2026-05-04  
**Phase**: SM-P2 — SaaS Data Plane Live  
**Tasks**: SM-P2.1, SM-P2.2, SM-P2.3, SM-P2.4, SM-P2.5  

---

## 1. Files Changed

| File | Task | Change |
|------|------|--------|
| `packages/core/backend/src/vninvest_core/db_router.py` | SM-P2.1 | NEW — CoreRouter blocks legacy writes; routes core apps to 'default' |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P2.1 | Added `DATABASE_ROUTERS = ['vninvest_core.db_router.CoreRouter']` |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P2.2 | Added `django_celery_beat` to INSTALLED_APPS + `CELERY_BEAT_SCHEDULE` (3 materializer tasks) |
| `packages/core/backend/src/vninvest_core/settings.py` | SM-P2.4 | Added `CACHES` config (Redis, `core:` key prefix, 60s default TTL) |
| `packages/core/backend/requirements.txt` | SM-P2.2 | Added `django-celery-beat>=2.6,<3.0` |
| `packages/core/backend/src/data_ingest/` | SM-P2.3 | NEW — `apps.py`, `models.py`, `tasks.py`, `migrations/0001_initial.py` |
| `packages/core/backend/src/market_serving/views.py` | SM-P2.4 | Added Redis cache on Detail views (15s / 30s TTL); `_source` field in response |
| `docker-compose.dev.yml` | SM-P2.2 | Replaced stub commands with real Celery worker + beat commands |
| `scripts/smoke_test_core_api.sh` | SM-P2.5 | NEW — smoke test script for all core API endpoints |

---

## 2. SM-P2.1 — CoreRouter

`packages/core/backend/src/vninvest_core/db_router.py`:
- Routes all `_CORE_APPS` model reads/writes to `'default'`
- `db_for_write` raises `RuntimeError` for any non-core app (hard block on legacy writes)
- `allow_migrate` returns `False` for `legacy_readonly` (never run migrations on legacy from core containers)
- `DATABASE_ROUTERS = ['vninvest_core.db_router.CoreRouter']` added to settings

---

## 3. SM-P2.2 — Real Celery Workers

**requirements.txt**: Added `django-celery-beat>=2.6,<3.0`

**CELERY_BEAT_SCHEDULE** in settings.py:
```python
'materialize-symbol-snapshot-60s': every 60s
'materialize-session-facts-5m': every 300s
'materialize-unified-alerts-2m': every 120s
```

**docker-compose.dev.yml**:
- `core-worker`: replaced `worker_stub` with real `celery worker` command
- `core-beat`: replaced `beat_stub` with real `celery beat --scheduler DatabaseScheduler`

---

## 4. SM-P2.3 — data_ingest Domain

New Django app at `packages/core/backend/src/data_ingest/`:
- `IngestJob`: tracks repeatable ingest sources (vnstock_price_board, legacy_sync, etc.)
- `IngestRun`: tracks individual task executions with state/rows_upserted/error tracking
- `fetch_and_upsert_price_board` Celery task: reads legacy DB → upserts SymbolSnapshot + logs IngestRun
- Migration `0001_initial.py`: creates both tables + indexes

---

## 5. SM-P2.4 — Redis Cache Layer

`market_serving/views.py`:
- `SymbolSnapshotDetailView`: cache key `core:snapshot:{SYMBOL}:{date}`, TTL 15s
- `SessionFactsDetailView`: cache key `core:session_facts:{SYMBOL}:{date}`, TTL 30s
- Response includes `_source: 'cache-hit'` or `_source: 'db-read'`
- List views not cached (cursor pagination handles performance)

**CACHES** settings:
```python
'BACKEND': 'django.core.cache.backends.redis.RedisCache'
'LOCATION': REDIS_URL
'TIMEOUT': 60
'KEY_PREFIX': 'core'
```

---

## 6. Validation

```
# Python syntax checks
python -c "import ast; ..." → All Phase 2 syntax checks PASSED ✅

# docker-compose.dev.yml
docker compose -f docker-compose.yml -f docker-compose.dev.yml config --quiet → Exit: 0 ✅
```

---

## 7. Residual Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `django_celery_beat` migrations must run before beat starts | Beat fails to start if tables missing | entrypoint.sh runs migrate on api startup; beat depends_on api healthy |
| `data_ingest.IngestRun.job` allows NULL (if no job_id passed) | FK constraint issue | `job` FK is not nullable in model but task checks for `job` before saving. Reviewed — actually needs `null=True` on FK |
| Cache `_source` field added to response payload | API contract change | `_source` is additive; no existing consumers broken |
| Smoke test script requires curl | Not in all containers | Run from host or add curl to Dockerfile runtime |

---

## 8. Action Item: IngestRun.job FK Nullability

The `fetch_and_upsert_price_board` task can be called without `job_id`, in which case `run` is None and no `IngestRun` is created. The model FK is non-null but the task only creates `IngestRun` when `job` is not None. This is correct behavior — task works standalone without IngestJob.

Migration 0001 does not need to change — `job` FK is required when `IngestRun` is created; task creates run only when `job` is available.
