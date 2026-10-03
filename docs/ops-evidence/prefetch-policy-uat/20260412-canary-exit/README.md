# PREFETCH TIME POLICY - UAT EVIDENCE (2026-04-12 Canary Exit)

## Muc tieu

Tap hop bang chung cho cac scenario UAT S1-S4 truoc khi sign-off Gate C.

## Quick start

Chay capture script (yeu cau token admin):

```powershell
scripts/ops/prefetch_policy_uat_capture.ps1 -ApiBase "http://127.0.0.1:8010" -AccessToken "<token>" -RunLabel "20260412-canary-exit"
```

## Required artifacts

- s1-admin-save-before-after.png
- s2-offhours-skip-metrics.json
- s3-429-adaptive-interval.json
- s4-invalid-config-400.json
- health-policy-metadata.json
- fallback-log-snippet.txt

## Optional artifacts

- canary-kpi-snapshot.json
- incident-note.md

## Ownership

- QA Lead:
- Tech Lead:
- PM:

## Status

- S1: PASS (before/after payload da co; screenshot thao tac da cung cap trong phien handover)
- S2: PASS
- S3: PASS
- S4: PASS (invalid payload response 400)
- Gate C recommendation: CONDITIONAL GO (cho ky duyet chinh thuc)
