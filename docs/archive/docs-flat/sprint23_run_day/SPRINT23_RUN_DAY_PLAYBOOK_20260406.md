# Sprint 23 run-day playbook (2026-04-06)

Trang thai: READY TO EXECUTE

Muc tieu: thuc thi S23-08 theo metric gate va rollback-safe protocol.
- Canary gate: 10% -> 50% -> 100%
- Rollback rehearsal: kill-switch + verify recovery
- Go/No-Go: co bien ban va chu ky owner

Tai lieu lien quan:
- docs/SPRINT23_BACKEND_AUDIT_CODING_PLAN.md
- docs/SPRINT23_ACCEPTANCE_CHECKLIST.md
- docs/SPRINT23_EXECUTION_EVIDENCE_TEMPLATE.md
- docs/SPRINT23_CANARY_LOG_20260406.md
- docs/SPRINT23_ROLLBACK_REHEARSAL_REPORT_20260406.md
- docs/SPRINT23_GO_NO_GO_SIGNOFF_20260406.md
- scripts/ops/sprint23_collect_rollout_evidence.ps1

## 1) Metadata va owner

- Environment: staging / production
- Release window: ____ -> ____
- Incident channel: ____
- Evidence directory: docs/ops-evidence/sprint23

Owner:
- Tech Lead: ____
- DevOps Lead: ____
- QA Lead: ____
- Backend owner: ____
- PM owner: ____

## 2) KPI gate (S23)

Gate metrics:
1. p95 latency per endpoint (intraday, price-board, whale-aggregate)
2. HTTP 5xx ratio
3. Fallback hit ratio
4. External timeout count/ratio

Rollback trigger:
1. p95 tang > 30% trong 15 phut
2. 5xx > 2x baseline trong 10 phut
3. fallback ratio vuot nguong da ky

Canary control switch:
1. `ENABLE_NEW_MARKET_VIEWS=true` bat routing refactor.
2. `MARKET_VIEWS_CANARY_PERCENT=10|50|100` chia traffic deterministic theo user/ip.
3. `MARKET_VIEWS_CANARY_PERCENT=0` hoac `ENABLE_NEW_MARKET_VIEWS=false` de rollback ve legacy route.

## 3) Timeline dieu phoi theo moc

| Moc | Task | Owner | Action | Pass criteria | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-45 | Pre-flight | DevOps + QA | health checks + flag snapshot | health 200, flags hop le | preflight.txt |
| T-30 | Baseline capture | Ops | capture p95/5xx/fallback/timeout | co baseline du 4 KPI | baseline.txt |
| T0 | Canary 10% start | DevOps | route 10% traffic qua refactored path | no red trigger 30m | canary-10-start.txt |
| T+30m | Canary 10% checkpoint | QA | compare KPI vs baseline | GO/NO-GO len 50% | canary-10-checkpoint.txt |
| T+40m | Canary 50% start | DevOps | route 50% traffic | no red trigger 60m | canary-50-start.txt |
| T+100m | Canary 50% checkpoint | QA + Tech Lead | KPI + route contract smoke | GO/NO-GO len 100% | canary-50-checkpoint.txt |
| T+110m | Canary 100% start | DevOps | route full traffic | no red trigger 60m | canary-100-start.txt |
| T+170m | Rollback rehearsal | Ops + QA | simulate rollback + verify | rollback <= 5 phut, smoke PASS | rollback-rehearsal.txt |
| T+200m | Final sign-off | PM + Tech Lead + QA + DevOps | dien bien ban GO/NO-GO | co chu ky owner | go-no-go.txt |

## 4) Command blocks (PowerShell)

```powershell
$APP_DIR = "c:/Mujoco Projects/vninvest/backend"
$PY = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe"
$API_BASE = "http://127.0.0.1:8000"
$OUT = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint23"
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

Invoke-WebRequest "$API_BASE/api/health/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$OUT/preflight.txt"
Invoke-WebRequest "$API_BASE/api/health/market-observability/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OUT/preflight.txt"

Set-Location $APP_DIR
& $PY manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS, 'MARKET_OBSERVABILITY_ENABLED': settings.MARKET_OBSERVABILITY_ENABLED})" | Tee-Object "$OUT/flags-snapshot.txt"

# Rollout switches (thuc thi theo lan luot 10 -> 50 -> 100)
$env:ENABLE_NEW_MARKET_VIEWS = "true"
$env:MARKET_VIEWS_CANARY_PERCENT = "10"
# ... monitor KPI window ...
$env:MARKET_VIEWS_CANARY_PERCENT = "50"
# ... monitor KPI window ...
$env:MARKET_VIEWS_CANARY_PERCENT = "100"
```

## 5) Rollback drill protocol (target <= 5 phut)

1. Trigger rollback switch (routing or feature gate) ve stable path.
2. Capture timestamp T0 rollback.
3. Verify 3 endpoint smoke:
   - /api/realtime/intraday/<symbol>/
   - /api/realtime/price-board/<symbol>/
   - /api/realtime/whale-feed/aggregate/
4. Verify /api/health/market-observability/ con response.
5. Capture timestamp T1 recovery.
6. Tinh rollback duration = T1 - T0.

PASS criteria:
1. rollback duration <= 5 phut
2. smoke 3 endpoint PASS
3. khong phat sinh 5xx spike > trigger trong 10 phut sau rollback

## 6) Definition of done cho S23-08 run-day

1. Co canary log day du 10/50/100.
2. Co rollback rehearsal report (PASS/FAIL + timing).
3. Co go/no-go sign-off du chu ky owner.
4. Acceptance checklist C2..C5 co evidence link hop le.
