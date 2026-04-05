# Sprint 22 run-day playbook (2026-04-05)

Trang thai: READY TO EXECUTE

Muc tieu: dieu phoi ngay van hanh Sprint 22 cho cac muc con lai:
- S22-01: Canary 10% -> 50%
- S22-02: Canary 50% -> 100%
- S22-06: Realtime soak/regression FE/BE
- S22-11: Go/No-Go review

Tai lieu lien quan:
- docs/SPRINT22_MARKET_DATA_CANARY_LOG.md
- docs/SPRINT22_REALTIME_SOAK_CHECKLIST.md
- docs/SPRINT22_GO_NO_GO_REVIEW.md
- docs/SPRINT22_STATUS_TRACKER_20260405.md
- docs/SPRINT22_EXECUTION_EVIDENCE_TEMPLATE.md
- docs/SPRINT22_EXECUTION_EVIDENCE_STAGING_PREFILL_20260405.md
- docs/SPRINT22_EXECUTION_EVIDENCE_PRODUCTION_PREFILL_20260405.md
- scripts/ops/sprint22_collect_evidence.ps1

## 1) Metadata va owner

- Environment: staging / production
- Release window: ____ -> ____
- Incident channel: ____
- Ops notebook/path evidence: docs/ops-evidence/sprint22

Owner:
- Tech Lead: ____
- DevOps Lead: ____
- QA Lead: ____
- Frontend owner: ____
- Backend owner: ____

## 2) Timeline dieu phoi theo gio

| Moc | Task | Owner | Command/Action | Pass criteria | Evidence |
| :--- | :--- | :--- | :--- | :--- | :--- |
| T-60 | Pre-flight | DevOps + QA | Health check API/WS + flag snapshot | API/WS 200, flags dung baseline | preflight.txt |
| T-30 | Baseline capture | DevOps | Chot p95, 5xx, throttle, cache baseline | Co so lieu baseline day du | baseline-metrics.txt |
| T0 | S22-01 start | DevOps | Mo canary 50% | Deployment healthy, khong spike loi | canary-50-start.txt |
| T+1h | S22-01 checkpoint | QA | KPI check + contract mismatch check | Khong cham rollback trigger | canary-50-checkpoint-1.txt |
| T+4h | S22-01 checkpoint | QA | KPI check + smoke business flow | Khong regress nghiep vu | canary-50-checkpoint-2.txt |
| T+24h | S22-01 decision | Tech Lead + QA + DevOps | GO/NO-GO len 100% | 24h on dinh | canary-50-decision.txt |
| T+24h30m | S22-02 start | DevOps | Mo canary 100% | Rollout healthy | canary-100-start.txt |
| T+25h | S22-06 start | QA + FE | Soak test theo checklist | Khong leak socket, fallback ok | soak-phase-a.txt |
| T+28h | S22-06 checkpoint | QA + FE | Network disturbance drills | Reconnect on dinh | soak-phase-b.txt |
| T+48h | S22-02/S22-06 final | Tech Lead + QA + DevOps | Tong hop KPI + soak result | Dat gate thi GO | sprint22-final-summary.txt |
| T+48h30m | S22-11 sign-off | Tech Lead + QA + DevOps | Dien go/no-go review | Bien ban co chu ky owner | go-no-go-signed.txt |

## 3) Command blocks (PowerShell)

### 3.1 Pre-flight va baseline

```powershell
$APP_DIR = "c:/Mujoco Projects/vninvest/backend"
$PY = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe"
$API_BASE = "http://127.0.0.1:8000"
$OUT = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint22"
New-Item -ItemType Directory -Force -Path $OUT | Out-Null

Invoke-WebRequest "$API_BASE/admin/login/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$OUT/preflight.txt"
Invoke-WebRequest "$API_BASE/api/health/realtime/" -UseBasicParsing | Select-Object StatusCode | Tee-Object -Append "$OUT/preflight.txt"

Set-Location $APP_DIR
& $PY manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS, 'ENABLE_REALTIME_CONNECTION_MANAGER': settings.ENABLE_REALTIME_CONNECTION_MANAGER})" | Tee-Object "$OUT/flags-snapshot.txt"
```

### 3.2 Focused regression truoc/sau rollout

```powershell
Set-Location $APP_DIR
& $PY manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_portfolio_endpoint_uses_refactored_trading_view_when_flag_enabled | Tee-Object "$OUT/focused-regression.txt"
```

### 3.3 Frontend build evidence

```powershell
Set-Location "c:/Mujoco Projects/vninvest/frontend"
npm run build | Tee-Object "$OUT/frontend-build.txt"
```

## 4) Rollback protocol nhanh

Rollback trigger:
- 5xx > 1.5% / 5 phut
- p95 > 500ms / 5 phut

Actions:
1. Tat canary/feature gate ngay tren scope rollout.
2. Rollout restart.
3. Verify nhanh ticker + whale aggregate + auth flow.
4. Ghi incident note cung timestamp.

Template incident note:

```text
Time:
Trigger:
Impact:
Mitigation:
Recovery verified by:
Next action:
```

## 5) Definition of done cho run-day

1. Co du evidence cho S22-01 va S22-02 (24h moi phase).
2. Soak checklist S22-06 duoc dien day du va ket luan PASS/FAIL.
3. docs/SPRINT22_GO_NO_GO_REVIEW.md duoc cap nhat va co chu ky owner.
4. docs/SPRINT22_STATUS_TRACKER_20260405.md cap nhat trang thai task cuoi.
