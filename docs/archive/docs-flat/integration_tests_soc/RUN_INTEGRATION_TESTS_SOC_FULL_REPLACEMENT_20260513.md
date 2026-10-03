# SOC Full Replacement — Run Integration Tests
**Ngày**: 2026-05-13  
**Status**: Mandatory  
**Trigger**: Sau T09 (tests), trước T10 (docker final audit)  
**Parent**: `docs/SOC_FULL_REPLACEMENT_HANDOFF_MASTER_20260513.md`

---

## Prerequisites

Trước khi chạy integration tests, đảm bảo:
1. Docker stack đang chạy: `docker compose -f docker-compose.dev.yml up -d core-api frontend redis`
2. Migrations đã apply: `python manage.py migrate service_ops`
3. Có test admin user và token

---

## INT-01: Service Lifecycle Integration Test

```powershell
cd "C:\Mujoco Projects\vninvest\backend"

# Tạo service definition → config → health → log → audit
../.venv/Scripts/python.exe -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()

from vninvest_core.service_ops.models import ServiceDefinition, ServiceConfig, ServiceHealth, ServiceRunLog, ConfigChangeAudit

# Create service
svc = ServiceDefinition.objects.create(
    service_key='test_vnbroker_quote',
    name='Test VNBroker Quote',
    domain='vnbroker',
    owner_team='test'
)
print('Service created:', svc.service_key)

# Create config
cfg = ServiceConfig.objects.create(
    service=svc,
    config_payload={'timeout': {'read': 30.0}},
    applied_by='test_runner',
    is_current=True
)
print('Config created:', cfg.id, 'is_current:', cfg.is_current)

# Create second config → first should auto become not-current
cfg2 = ServiceConfig.objects.create(
    service=svc,
    config_payload={'timeout': {'read': 45.0}},
    applied_by='test_runner',
    is_current=True
)
cfg.refresh_from_db()
assert not cfg.is_current, 'First config should no longer be current'
print('Config versioning OK')

# Cleanup
svc.delete()
print('INT-01 PASS')
"
```

---

## INT-02: API Endpoint Integration Tests

```powershell
# Lấy token (thay YOUR_USERNAME/PASSWORD)
$TOKEN = (../.venv/Scripts/python.exe -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()
from django.test import Client
c = Client()
r = c.post('/api/auth/token/', {'username': 'admin', 'password': 'admin'}, content_type='application/json')
import json
print(json.loads(r.content)['access'])
")

# Test: Overview
$resp = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/soc/overview/" `
  -Headers @{Authorization="Bearer $TOKEN"} `
  -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json
Write-Host "INT-02a overview status:", $resp.StatusCode
Write-Host "INT-02a summary:", ($data.summary | ConvertTo-Json -Compress)

# Test: 401 on unauthenticated
try {
    $resp401 = Invoke-WebRequest -Uri "http://localhost:8001/api/soc/overview/" -UseBasicParsing
    Write-Host "INT-02b FAIL: should be 401 but got", $resp401.StatusCode
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "INT-02b PASS: 401 for unauthenticated"
    }
}

# Test: VNBroker config GET
$resp3 = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/soc/vnbroker/config/" `
  -Headers @{Authorization="Bearer $TOKEN"} `
  -UseBasicParsing
Write-Host "INT-02c vnbroker config status:", $resp3.StatusCode

# Test: VNBroker config apply — invalid data → 400
try {
    $body = '{"timeout": {"read": 1.0}}' 
    $resp4 = Invoke-WebRequest `
      -Uri "http://localhost:8001/api/soc/vnbroker/config/apply/" `
      -Method POST `
      -Body $body `
      -ContentType "application/json" `
      -Headers @{Authorization="Bearer $TOKEN"} `
      -UseBasicParsing
    Write-Host "INT-02d FAIL: should be 400 but got", $resp4.StatusCode
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "INT-02d PASS: 400 for invalid config"
    }
}

# Test: Signals ownership → can_apply=False
$resp5 = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/soc/signals/ownership/" `
  -Headers @{Authorization="Bearer $TOKEN"} `
  -UseBasicParsing
$ownership = $resp5.Content | ConvertFrom-Json
if ($ownership.can_apply -eq $false) {
    Write-Host "INT-02e PASS: signals can_apply=False"
} else {
    Write-Host "INT-02e FAIL: signals can_apply should be False"
}

# Test: Signals config apply → 403
try {
    $body = '{"whale_detection": {"enabled": true, "min_value_threshold": 10000000, "lookback_periods": 20}}'
    $resp6 = Invoke-WebRequest `
      -Uri "http://localhost:8001/api/soc/signals/config/apply/" `
      -Method POST `
      -Body $body `
      -ContentType "application/json" `
      -Headers @{Authorization="Bearer $TOKEN"} `
      -UseBasicParsing
    Write-Host "INT-02f FAIL: should be 403 but got", $resp6.StatusCode
} catch {
    if ($_.Exception.Response.StatusCode -in 403, 405) {
        Write-Host "INT-02f PASS: write blocked for signals domain"
    }
}
```

---

## INT-03: Matrix Coordinator Integration Test

```powershell
../.venv/Scripts/python.exe -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vninvest.settings')
django.setup()

import uuid
from concurrent.futures import ThreadPoolExecutor
from vninvest_core.service_ops.matrix_coordinator import MatrixCoordinator
from vninvest_core.service_ops.models_matrix import ScrapeMatrixCell

cycle_id = f'integration_test_{uuid.uuid4().hex[:8]}'
coordinator = MatrixCoordinator(cycle_id, providers=['vci', 'kbs'])
matrix = coordinator.create_cycle(['G1', 'G2', 'G3'])
print('Cells created:', matrix.cells.count())
# Expected: 6 (3 groups × 2 providers)
assert matrix.cells.count() == 6

# Test atomic claim
results = []
with ThreadPoolExecutor(max_workers=4) as executor:
    futures = [executor.submit(coordinator.try_claim_cell, 'G1', 'vci', f'worker_{i}') for i in range(4)]
    results = [f.result() for f in futures]

success_count = results.count(True)
print('Claim results:', results, '→ successful claims:', success_count)
assert success_count == 1, f'Expected exactly 1 successful claim, got {success_count}'
print('INT-03 atomic claim PASS')

# Test mark done + skip peers
coordinator.mark_cell_done('G2', 'vci', 10)
skipped = ScrapeMatrixCell.objects.filter(
    matrix__cycle_id=cycle_id,
    symbol_group_id='G2',
    status='skipped'
).count()
print('Skipped peers after G2-vci done:', skipped)
# Expected: 1 (kbs cell for G2 should be skipped)
assert skipped >= 1

# Cleanup
from vninvest_core.service_ops.models_matrix import ScrapeMatrix
ScrapeMatrix.objects.filter(cycle_id=cycle_id).delete()
print('INT-03 PASS')
"
```

---

## INT-04: Prefetch Config Integration Test

```powershell
# Test 6 profiles response structure
$resp = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/soc/prefetch/config/" `
  -Headers @{Authorization="Bearer $TOKEN"} `
  -UseBasicParsing
$config = $resp.Content | ConvertFrom-Json

$requiredProfiles = @('pre_open', 'market_open', 'lunch_break', 'pre_close', 'post_close', 'offhours')
foreach ($profile in $requiredProfiles) {
    if ($config.config.$profile) {
        Write-Host "INT-04 Profile '$profile': OK"
    } else {
        Write-Host "INT-04 FAIL: Missing profile '$profile'"
    }
}
```

---

## INT-05: Pagination Integration Test

```powershell
# List endpoint phải có pagination structure
$resp = Invoke-WebRequest `
  -Uri "http://localhost:8001/api/soc/services/?page=1" `
  -Headers @{Authorization="Bearer $TOKEN"} `
  -UseBasicParsing
$data = $resp.Content | ConvertFrom-Json

if ($data.count -ne $null -and $data.results -ne $null) {
    Write-Host "INT-05 PASS: pagination structure present (count=$($data.count), results=$($data.results.Count))"
} else {
    Write-Host "INT-05 FAIL: missing pagination fields"
    Write-Host "Got keys:", ($data | Get-Member -MemberType NoteProperty).Name
}
```

---

## INT-06: Error Envelope Integration Test

```powershell
# 404 error phải có đúng envelope
try {
    $resp = Invoke-WebRequest `
      -Uri "http://localhost:8001/api/soc/services/nonexistent_service_xyz/" `
      -Headers @{Authorization="Bearer $TOKEN"} `
      -UseBasicParsing
    Write-Host "INT-06 FAIL: expected 404"
} catch {
    $body = $_.ErrorDetails.Message | ConvertFrom-Json
    $requiredFields = @('detail', 'code', 'timestamp', 'request_id')
    $missing = $requiredFields | Where-Object { $body.$_ -eq $null }
    if ($missing.Count -eq 0) {
        Write-Host "INT-06 PASS: error envelope complete"
    } else {
        Write-Host "INT-06 FAIL: missing envelope fields:", $missing
    }
}
```

---

## INT-07: Frontend Route Integration Test

```powershell
# Test /operations-center route loads
$resp = Invoke-WebRequest `
  -Uri "http://localhost:3000/operations-center" `
  -UseBasicParsing
if ($resp.StatusCode -eq 200) {
    Write-Host "INT-07a PASS: /operations-center returns 200"
} else {
    Write-Host "INT-07a FAIL: status", $resp.StatusCode
}

# Test /admin-ops redirect
$resp2 = Invoke-WebRequest `
  -Uri "http://localhost:3000/admin-ops" `
  -MaximumRedirection 0 `
  -UseBasicParsing `
  -ErrorAction SilentlyContinue
if ($resp2.StatusCode -in 301, 302) {
    Write-Host "INT-07b PASS: /admin-ops redirects to /operations-center"
} elseif ($resp2.StatusCode -eq 200) {
    # React SPA handles redirect client-side
    Write-Host "INT-07b INFO: SPA handles redirect client-side"
}
```

---

## Integration Test Summary

```
INT-01: Service lifecycle (create, version, delete) ........ [ ]
INT-02: API endpoints (overview, auth, vnbroker, signals) .. [ ]
INT-03: Matrix coordinator (create, atomic claim, skip) .... [ ]
INT-04: Prefetch config (6 profiles structure) ............. [ ]
INT-05: Pagination (count, results) ........................ [ ]
INT-06: Error envelope (detail, code, timestamp, request_id) [ ]
INT-07: Frontend routes (/operations-center, /admin-ops) ... [ ]

OVERALL: [ ] ALL PASS / [ ] FAILURES (list below)
```
