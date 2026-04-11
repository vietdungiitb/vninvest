# HOLISTIC ADVISORY H3 AUTHENTICATED SMOKE (2026-04-11)

## Scope

- Execute protected H3 advisory endpoints with authenticated test user.
- Capture real runtime behavior for Session v2 and Observability APIs.
- Record triage result for Session v2 `409 Conflict` observed in initial authenticated smoke.

## Method

- Authentication and API calls executed inside backend container with Django test client (`HTTP_HOST=localhost`) to avoid host-side timeout noise observed on direct host calls.
- Test user: `testuser` (seeded by `seed_demo_data`).

## Commands

### 1) Initial Auth + Session/Observability probe (before fix)

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
docker exec vninvest-dev-backend python manage.py shell -c "..."
```

Key output payload:

```json
{
  "auth_status": 200,
  "token_issued": true,
  "session_status": 409,
  "observability_status": 200,
  "observability_keys": [
    "ok",
    "symbol",
    "window_hours",
    "limit",
    "summary",
    "timeline"
  ],
  "observability_summary_keys": [
    "current_severity",
    "current_severity_score",
    "baseline_severity_score",
    "severity_delta",
    "severity_drift_label",
    "avg_aggregate_quality_score",
    "sample_size"
  ],
  "observability_timeline_count": 0
}
```

### 2) Initial multi-symbol session v2 probe (before fix)

```powershell
docker exec vninvest-dev-backend python manage.py shell -c "... symbols=['HPG','FPT','VCB','VNM'] ..."
```

Result:

```json
{
  "HPG": 409,
  "FPT": 409,
  "VCB": 409,
  "VNM": 409
}
```

## Findings

1. Authentication path is healthy:
- `/api/auth/token/` returns 200 and issues JWT for `testuser`.

2. Observability endpoint is healthy under auth:
- `/api/stock-management/stocks/<symbol>/ai-advisory-observability/` returns 200.

3. Session v2 endpoint currently returns 409 Conflict for tested seeded symbols:
- `/api/stock-management/stocks/<symbol>/ai-advisory-session/?contract=v2&include_benchmarks=1`

## Step-11 fix applied

1. `seed_demo_data` now bootsraps an active `SystemAISettings` (`default`) for local dev smoke flow.
2. Seeded `WhaleAdvisory` records are now linked to the demo user (`user=testuser`) so session endpoint can return latest advisory for authenticated user context.

## Verification after fix

### 1) Backend unit/regression check

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest\backend"
$env:DB_ENGINE='sqlite'
..\.venv\Scripts\python.exe manage.py test portfolio.tests.test_seed_demo_data_whale_frontend -v 2
```

Result:

- PASS (1 test, 0 failures)

### 2) Docker runtime verification (after rebuild + reseed)

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml build backend celery_worker celery_beat
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d backend celery_worker celery_beat
docker exec vninvest-dev-backend python manage.py seed_demo_data --reset
```

Then probe:

```powershell
docker exec vninvest-dev-backend python manage.py shell -c "... GET /api/stock-management/stocks/HPG/ai-advisory-session/?contract=v2&include_benchmarks=1 ..."
```

Result:

- Session v2 for `HPG`: **200 OK** (previously 409)
- Response contains advisory payload for user `testuser`

## Interpretation

- H3 observability release lane is reachable and contract shape is valid.
- Session v2 conflict seen in initial run was caused by demo bootstrap data/config gap.
- After step-11 fix, authenticated seeded-symbol flow returns 200 and is suitable for release smoke walkthrough.

## Next Action (post step-11) - Status Update

1. UI retry/backoff policy: DONE.
- FE da bo sung conflict-safe fallback + manual retry + auto-retry backoff cho conflict tam thoi.
- Da bo sung telemetry counters va persisted retry-events timeline trong observability panel.

2. Observability artifact hardening: DONE.
- Retry telemetry da duoc luu backend qua `POST /ai-advisory-observability/`.
- `GET /ai-advisory-observability/` da tra `retry_events` + summary totals + server-side filters/sort.

3. H3 phase closure:
- H3 da du maturity de chuyen sang H tiep theo (sang sprint scope moi) theo masterplan.
