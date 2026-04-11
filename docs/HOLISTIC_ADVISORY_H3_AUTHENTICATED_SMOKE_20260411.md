# HOLISTIC ADVISORY H3 AUTHENTICATED SMOKE (2026-04-11)

## Scope

- Execute protected H3 advisory endpoints with authenticated test user.
- Capture real runtime behavior for Session v2 and Observability APIs.

## Method

- Authentication and API calls executed inside backend container with Django test client (`HTTP_HOST=localhost`) to avoid host-side timeout noise observed on direct host calls.
- Test user: `testuser` (seeded by `seed_demo_data`).

## Commands

### 1) Auth + Session/Observability probe

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

### 2) Multi-symbol session v2 probe

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

## Interpretation

- H3 observability release lane is reachable and contract shape is valid.
- Session v2 conflict behavior is a runtime guard/lock condition that should be triaged before full GO for authenticated end-to-end walkthrough.

## Next Action (H3-step-11 candidate)

1. Instrument and classify 409 conflict causes in session endpoint.
2. Add deterministic fallback/retry policy for UI when receiving 409.
3. Add backend smoke test for expected 409 contract and recovery path.
