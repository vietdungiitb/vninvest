# HOLISTIC ADVISORY H3 RELEASE SMOKE (2026-04-11)

## Scope

- Verify H3 rollout readiness after step-8 release/rollback checklist.
- Capture operational evidence for Docker runtime, frontend build/test, and backend API reachability.

## Environment

- Date: 2026-04-11
- Workspace: vninvest
- Runtime mode: docker compose dev stack

## Command Evidence

### 1) Docker stack status

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml ps
```

Result:

- backend: Up (healthy)
- celery_worker: Up (healthy)
- celery_beat: Up (healthy)
- db: Up (healthy)
- redis: Up (healthy)
- mailpit: Up (healthy)
- frontend: Up

### 2) Backend health API

Command:

```powershell
Invoke-RestMethod http://127.0.0.1:8000/api/health/ | ConvertTo-Json -Depth 4
```

Result:

```json
{
  "status": "ok",
  "service": "vninvest-backend"
}
```

### 3) Frontend focused smoke test

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest\frontend"
npm test -- --watchAll=false --runInBand src/pages/WhaleAlertsHub.test.jsx
```

Result:

- PASS `src/pages/WhaleAlertsHub.test.jsx`
- 1 test suite passed
- 4 tests passed
- Notes: React Router v7 future-flag warnings observed; non-blocking.

### 4) Frontend production build

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest\frontend"
npm run build
```

Result:

- Compiled successfully.
- Output artifacts generated under `frontend/build/`.

### 5) Advisory session v2 endpoint (no auth token)

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
Invoke-RestMethod "http://127.0.0.1:8000/api/stock-management/stocks/HPG/ai-advisory-session/?contract=v2&include_benchmarks=1"
```

Result:

- HTTP 401 Unauthorized (expected when no authenticated session/token is provided).

### 6) Observability endpoint (no auth token)

Command:

```powershell
Set-Location "c:\Mujoco Projects\vninvest"
Invoke-RestMethod "http://127.0.0.1:8000/api/stock-management/stocks/HPG/ai-advisory-observability/?window_hours=24&limit=10"
```

Result:

- HTTP 401 Unauthorized (expected when no authenticated session/token is provided).

## Go/No-Go Snapshot

- Docker runtime health: GO
- Frontend build: GO
- Frontend H3 symbol investigation smoke test: GO
- Protected advisory endpoints: authorization behavior confirmed (401 without auth)

## Follow-up for full authenticated E2E

1. Run API smoke using a valid authenticated test user token/session.
2. Capture sample response payloads for session v2 aggregate and observability timeline.
3. Attach payload excerpts to release note if required by audit gate.
