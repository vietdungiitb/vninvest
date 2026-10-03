# Sprint 21 ops runbook (command-by-command)

Trang thai: READY TO RUN

Muc tieu: cung cap lenh thao tac theo timeline de thuc thi S21-01, S21-04, S21-12.

Phan nay khong thay the checklist. Dung song song voi:
- docs/SPRINT21_OPERATIONS_CHECKLIST.md
- docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md

## 0) Chuan bi bien moi truong (PowerShell)

Dat bien duong dan theo moi truong thuc te cua team:

```powershell
$APP_DIR = "c:/Mujoco Projects/vninvest/backend"
$PY = "c:/Mujoco Projects/vninvest/backend/.venv/Scripts/python.exe"
$API_BASE = "http://127.0.0.1:8000"
$REPORT_DIR = "c:/Mujoco Projects/vninvest/docs/ops-evidence/sprint21"
New-Item -ItemType Directory -Force -Path $REPORT_DIR | Out-Null
```

## 1) T-60 den T-15: pre-flight

### 1.1 Health check nhanh

```powershell
Invoke-WebRequest "$API_BASE/admin/login/" -UseBasicParsing | Select-Object StatusCode
Invoke-WebRequest "$API_BASE/api/health/realtime/" -UseBasicParsing | Select-Object StatusCode
```

### 1.2 Snapshot settings flags hien tai

```powershell
Set-Location $APP_DIR
& $PY manage.py shell -c "from django.conf import settings; print({'ENABLE_NEW_MARKET_VIEWS': settings.ENABLE_NEW_MARKET_VIEWS, 'ENABLE_NEW_TRADING_VIEWS': settings.ENABLE_NEW_TRADING_VIEWS, 'ENABLE_REALTIME_CONNECTION_MANAGER': settings.ENABLE_REALTIME_CONNECTION_MANAGER})" | Tee-Object "$REPORT_DIR/flags.before.txt"
```

### 1.3 Baseline test contract/regression truoc canary

```powershell
Set-Location $APP_DIR
& $PY manage.py test portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_realtime_ticker_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_endpoint_uses_refactored_market_view_when_flag_enabled portfolio.tests.test_api_routes.ApiRouteSmokeTests.test_whale_feed_aggregate_endpoint_uses_refactored_market_view_when_flag_enabled | Tee-Object "$REPORT_DIR/baseline.tests.txt"
```

## 2) T-15 den T0: S21-01 measurement contract

### 2.1 Tao bien ban measurement contract nhanh

```powershell
$measurement = @"
Sprint 21 Measurement Contract
Date: $(Get-Date -Format o)
Metrics: p95 latency, 5xx rate, throttle error rate, cache hit/miss ratio
Rollback triggers:
- 5xx > 1.5% / 5 minutes
- p95 > 500ms / 5 minutes
Benchmark acceptance:
- p95 new path not worse than legacy > 10%
"@
$measurement | Out-File "$REPORT_DIR/measurement-contract.txt" -Encoding utf8
```

### 2.2 Xac nhan owner ky tay trong file sign-off

- Mo docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md
- Dien metadata + owner + timestamp.

## 3) T0 den T+60: S21-04 dashboard baseline + alert fire

Phan nay phu thuoc stack observability. Chon 1 trong cac mode duoi.

### Mode A: Prometheus endpoint scrape (neu co)

```powershell
Invoke-WebRequest "$API_BASE/metrics" -UseBasicParsing | Select-Object -ExpandProperty Content | Out-File "$REPORT_DIR/metrics.baseline.prom.txt" -Encoding utf8
```

### Mode B: App log snapshot lam baseline tam thoi

```powershell
Set-Location $APP_DIR
Get-ChildItem -Recurse -File -Filter "*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 3 FullName,LastWriteTime | Tee-Object "$REPORT_DIR/log-files.txt"
```

### 3.1 Alert fire test (manual trigger checklist)

- Trigger 1 canh bao test trong Grafana/APM.
- Luu screenshot + link event vao:
  - $REPORT_DIR/alert-fire-evidence.txt

Template:

```powershell
@"
Alert fire test
Date: $(Get-Date -Format o)
Rule: ____
Result: PASS/FAIL
Event link: ____
Ack by: ____
"@ | Out-File "$REPORT_DIR/alert-fire-evidence.txt" -Encoding utf8
```

## 4) T+60 den T+24h: S21-12 benchmark + canary 10%

Canary 10% can duoc thuc thi theo co che routing thuc te cua he thong (ingress/service mesh/load balancer).

### 4.1 Bat flag market views tren canary scope

Neu dung env file + restart service:

```powershell
# Chinh env file cua canary deployment thanh ENABLE_NEW_MARKET_VIEWS=true
# Sau do restart process/service theo stack cua ban.
```

Neu dung Kubernetes:

```powershell
# Vi du:
# kubectl -n <namespace> set env deploy/<deployment-name> ENABLE_NEW_MARKET_VIEWS=true
# kubectl -n <namespace> rollout status deploy/<deployment-name>
```

### 4.2 Smoke check ngay sau bat canary

```powershell
Invoke-WebRequest "$API_BASE/api/realtime/ticker/VNM/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$REPORT_DIR/canary-smoke-ticker.txt"
Invoke-WebRequest "$API_BASE/api/realtime/whale-feed/aggregate/" -UseBasicParsing | Select-Object StatusCode | Tee-Object "$REPORT_DIR/canary-smoke-whale-aggregate.txt"
```

### 4.3 Lay mau benchmark theo moc thoi gian

```powershell
$checkpoints = @("T+1h","T+4h","T+12h","T+24h")
foreach ($cp in $checkpoints) {
  "Checkpoint $cp - $(Get-Date -Format o)" | Out-File "$REPORT_DIR/canary-checkpoints.txt" -Append -Encoding utf8
  Invoke-WebRequest "$API_BASE/api/realtime/ticker/VNM/" -UseBasicParsing | Select-Object StatusCode | Out-File "$REPORT_DIR/canary-checkpoints.txt" -Append
}
```

### 4.4 Rollback rehearsal

```powershell
# Chuyen ENABLE_NEW_MARKET_VIEWS=false tren canary scope
# Rollout restart
# Verify lai 2 endpoint smoke o tren
```

### 4.5 Incident rollback nhanh neu cham trigger

```powershell
# 1) Tat canary flag
# 2) Rollout restart
# 3) Ghi incident note vao file
@"
Incident note
Date: $(Get-Date -Format o)
Trigger: ____
Action: disable ENABLE_NEW_MARKET_VIEWS
Recovery time: ____
"@ | Out-File "$REPORT_DIR/incident-note.txt" -Encoding utf8
```

## 5) Chot gate va ky bien ban

### 5.1 Tong hop artifact

```powershell
Get-ChildItem $REPORT_DIR | Select-Object Name,Length,LastWriteTime | Tee-Object "$REPORT_DIR/_artifact-index.txt"
```

### 5.2 Dien bien ban gate

- Mo docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md
- Dien du KPI, link evidence, quyet dinh GO/NO-GO.

## 6) Deliverables cuoi cung cho Sprint 21

1. measurement-contract.txt
2. alert-fire-evidence.txt
3. canary-checkpoints.txt
4. incident-note.txt (neu co)
5. _artifact-index.txt
6. docs/SPRINT21_EXIT_GATE_SIGNOFF_TEMPLATE.md da ky
7. docs/SPRINT21_EXECUTION_EVIDENCE_TEMPLATE_20260405.md da dien day du
8. docs/SPRINT21_EXECUTION_EVIDENCE_STAGING_PREFILL_20260405.md da duoc cap nhat so lieu thuc te
