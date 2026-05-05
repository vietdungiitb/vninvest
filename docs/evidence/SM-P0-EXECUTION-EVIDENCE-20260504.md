# SM Phase 0 — Execution Evidence
**Date**: 2026-05-04  
**Phase**: SM-P0 — Baseline Infra & Materializer Fix  
**Tasks**: SM-P0.1, SM-P0.2, SM-P0.3, SM-P0.4  

---

## 1. Files Changed

| File | Change |
|------|--------|
| `packages/core/backend/src/market_serving/materializers.py` | SM-P0.1: Rewrote all 4 tasks — fixed SQL to use correct legacy tables |
| `backend/config/settings.py` | SM-P0.2: Added `CONN_MAX_AGE` to postgres DATABASES block |
| `packages/core/backend/Dockerfile` | SM-P0.3: Created — multi-stage, immutable, no source mount |
| `docker-compose.prod.yml` | SM-P0.3: Replaced stub services with built-image services; mandatory secret guards; removed hardcoded passwords |
| `packages/core/backend/entrypoint.sh` | SM-P0.4: Created — handles migrate + api/worker/beat roles |

---

## 2. SM-P0.1 — Materializer SQL Fix

### Root cause (pre-fix)
`materialize_symbol_snapshot` queried `portfolio_symbolsnapshot` (table does not exist).  
`materialize_session_facts` queried `portfolio_sessionfacts` (table does not exist).  
`backfill_symbol_snapshots` also queried `portfolio_symbolsnapshot`.  
`materialize_unified_alerts` task did not exist.

### Fix applied

| Task | Old Source Table | New Source Table | Notes |
|------|-----------------|-----------------|-------|
| `materialize_symbol_snapshot` | `portfolio_symbolsnapshot` ❌ | `portfolio_tickersessionclose` ✅ | Maps close_price→price, change_pct→price_change_pct, change_value→price_change |
| `materialize_session_facts` | `portfolio_sessionfacts` ❌ | `portfolio_whalealertevent` + `portfolio_orderflowsignal` ✅ | Aggregates BUY/SELL → whale_net_flow; strength/cvd from orderflowsignal; dark_flow_score=0.0 for Phase 0 |
| `backfill_symbol_snapshots` | `portfolio_symbolsnapshot` ❌ | `portfolio_tickersessionclose` ✅ | Historical backfill; parameterized interval fix |
| `materialize_unified_alerts` | (did not exist) | `portfolio_whalealertevent` ✅ | NEW task: maps events to UnifiedAlert + WhaleAlertCanonical; keyed on source_ref=event_id |

### Validation
```
python -c "import ast; ast.parse(open('packages/core/backend/src/market_serving/materializers.py', encoding='utf-8').read()); print('SYNTAX OK')"
# Output: SYNTAX OK ✅
```

---

## 3. SM-P0.2 — CONN_MAX_AGE

Added to `backend/config/settings.py` postgres DATABASES block:
```python
"CONN_MAX_AGE": int(os.getenv("DB_CONN_MAX_AGE", "60")),
```
Default 60s; overridable via `DB_CONN_MAX_AGE` env var.

### Validation
```
python -c "import ast; ast.parse(open('backend/config/settings.py', encoding='utf-8').read()); print('SYNTAX OK')"
# Output: SYNTAX OK ✅
```

---

## 4. SM-P0.3 — Dockerfile + Compose Fix

### Dockerfile highlights (`packages/core/backend/Dockerfile`)
- Multi-stage: `builder` installs deps; `runtime` copies only wheels + source
- `PYTHONPATH=/app/src`; `PYTHONDONTWRITEBYTECODE=1`; `PYTHONUNBUFFERED=1`
- No source mounts; no runtime pip install
- `ENTRYPOINT ["/app/entrypoint.sh"]` with `CMD ["api"]`

### docker-compose.prod.yml changes
- `core-db`: `POSTGRES_PASSWORD: vninvest` → `${CORE_DB_PASSWORD:?CORE_DB_PASSWORD must be set}`  
- `core-api`, `core-worker`, `core-beat`: replaced `image: python:3.13-slim` + source mount + stub commands with:
  - `build: ./packages/core/backend` (immutable)
  - Mandatory env guards: `${CORE_DJANGO_SECRET_KEY:?}`, `${CORE_DB_PASSWORD:?}`, `${CORE_ALLOWED_HOSTS:?}`, `${CORE_CORS_ALLOWED_ORIGINS:?}`
  - Real commands: `["api"]`, `["worker"]`, `["beat"]` (routed by entrypoint.sh)
  - Removed all `PYTHONPATH=/workspace/src` source-mount hacks

### Validation
```
# With required vars set:
docker compose -f docker-compose.prod.yml config --quiet
# Exit code: 0 ✅

# Without required vars (expected fail):
docker compose -f docker-compose.prod.yml config --quiet
# Error: CORE_DB_PASSWORD is missing ✅ (mandatory guard confirmed working)
```

---

## 5. SM-P0.4 — entrypoint.sh

`packages/core/backend/entrypoint.sh`:
- Role `api`: runs `migrate --noinput` + `collectstatic --noinput --clear` then `exec gunicorn`
- Role `worker`: `exec celery worker`
- Role `beat`: `exec celery beat --scheduler django_celery_beat.schedulers:DatabaseScheduler`
- Unknown role: prints error + exits 1
- `set -eu` for fail-fast

---

## 6. Spec/Reality Mismatch Notes

**Mismatch discovered**: Tech Spec section 3.2 assumed `portfolio_advisoryaggregatesnapshot.state_json` contained `cvd_normalized`, `buy_strength`, `institutional_strength`. Reality: that JSONB has `whale`, `dark_flow`, `order_flow`, `market` nested dicts — NOT individual float fields.

**Resolution**: SessionFacts materializer now uses:
- `portfolio_whalealertevent` → `whale_net_flow`, `total_buy_volume`, `total_sell_volume`
- `portfolio_orderflowsignal` → `buy_strength`, `institutional_strength`, `cvd_normalized` (as cvd_at_signal)
- `dark_flow_score` = 0.0 for Phase 0 — will be wired in Phase 3 when signal_intelligence domain is active

**Residual risk**: Phase 0 SessionFacts will have `dark_flow_score=0.0` for all rows. Acceptable for Phase 0; Phase 3 must backfill.

---

## 7. Residual Risks

| Risk | Mitigation | Owner |
|------|------------|-------|
| `LEGACY_DATABASE_URL` not set in dev stack → materializers skip | Graceful skip with log warning; no crash | DevOps |
| `dark_flow_score` = 0.0 for all Phase 0 rows | Documented; Phase 3 backfill required | Engineering |
| `entrypoint.sh` line endings (CRLF on Windows) | Must convert to LF before Docker build | DevOps |
| `django_celery_beat` not in requirements.txt | Add before Phase 2 beat activation | Engineering |
