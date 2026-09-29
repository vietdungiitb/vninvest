# RUN INTEGRATION TESTS — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: E2E integration test scripts — chạy sau D1 gate PASS, trước D2.

---

## Yêu cầu môi trường

```powershell
# Stack phải đang chạy
# ./start_dev.ps1 đã được chạy và healthy

$BASE = "http://localhost"
$SOC = "$BASE/api/soc"

# Lấy token (thay bằng token admin thật)
$TOKEN = (Invoke-RestMethod -Uri "$BASE/core/v1/auth/token/" -Method POST `
  -Body @{username="admin_test"; password="test_password"} `
  -ContentType "application/x-www-form-urlencoded").access

$H = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}
```

---

## Test Suite 1: Screener CRUD Flow

```powershell
Write-Host "=== Screener CRUD Integration Test ==="

# 1. Load screener config
$config = Invoke-RestMethod -Uri "$SOC/screener/config/" -Headers $H
Write-Host "[1] Config load: $(if ($config.config) { 'PASS' } else { 'FAIL' })"

# 2. Save screener config  
$savePayload = @{
    enabled = $true
    scan_interval_seconds = 90
    max_symbols_per_scan = 1500
    alert_cooldown_seconds = 300
    max_alerts_per_symbol_per_hour = 5
    result_retention_hours = 24
    publish_to_redis = $true
} | ConvertTo-Json

$saveResult = Invoke-RestMethod -Uri "$SOC/screener/config/" -Method POST -Headers $H -Body $savePayload
Write-Host "[2] Config save: $(if ($saveResult) { 'PASS' } else { 'FAIL' })"

# 3. Create rule
$rulePayload = @{
    name = "Integration Test Rule"
    type = "whale_count"
    value = @(@{field="whale_count"; op="gte"; value=3})
    enabled = $true
} | ConvertTo-Json -Depth 5

$createdRule = Invoke-RestMethod -Uri "$SOC/screener/rules/" -Method POST -Headers $H -Body $rulePayload
$ruleId = $createdRule.rule_id
Write-Host "[3] Create rule (id=$ruleId): $(if ($ruleId) { 'PASS' } else { 'FAIL' })"

# 4. Update rule
$updatePayload = @{ name = "Integration Test Rule Updated"; enabled = $false } | ConvertTo-Json
$updated = Invoke-RestMethod -Uri "$SOC/screener/rules/$ruleId/" -Method PUT -Headers $H -Body $updatePayload
Write-Host "[4] Update rule: $(if ($updated.name -eq 'Integration Test Rule Updated') { 'PASS' } else { 'FAIL' })"

# 5. Rule shows in list
$rules = Invoke-RestMethod -Uri "$SOC/screener/rules/" -Headers $H
$found = $rules.results | Where-Object { $_.rule_id -eq $ruleId }
Write-Host "[5] Rule in list: $(if ($found) { 'PASS' } else { 'FAIL' })"

# 6. Manual scan với symbols (không phải rule_ids)
$scanPayload = @{ symbols = @("VNM", "VIC") } | ConvertTo-Json
$scan = Invoke-RestMethod -Uri "$SOC/screener/manual-scan/" -Method POST -Headers $H -Body $scanPayload
Write-Host "[6] Manual scan (symbols): $(if ($scan.scan_id) { 'PASS' } else { 'FAIL' })"

# 7. Delete rule
$deleteStatus = (Invoke-WebRequest -Uri "$SOC/screener/rules/$ruleId/delete/" -Method DELETE -Headers $H).StatusCode
Write-Host "[7] Delete rule (204): $(if ($deleteStatus -eq 204) { 'PASS' } else { 'FAIL (got $deleteStatus)' })"

# 8. Rule not found after delete
try {
    Invoke-RestMethod -Uri "$SOC/screener/rules/$ruleId/" -Method PUT -Headers $H -Body "{}" | Out-Null
    Write-Host "[8] Deleted rule 404: FAIL (should have raised 404)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "[8] Deleted rule 404: $(if ($code -eq 404) { 'PASS' } else { 'FAIL (got $code)' })"
}

Write-Host "=== Screener CRUD: Done ==="
```

---

## Test Suite 2: Prefetch Config Round-Trip

```powershell
Write-Host "=== Prefetch Config Round-Trip Test ==="

# 1. Load current
$current = Invoke-RestMethod -Uri "$SOC/prefetch/config/" -Headers $H
$originalBatchSize = $current.config.batch_size
Write-Host "[1] Load: batch_size=$originalBatchSize"

# 2. Modify and save
$newConfig = $current.config
$newConfig.batch_size = 77  # Sentinel value
$savePayload = @{ config_payload = $newConfig } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$SOC/prefetch/config/" -Method POST -Headers $H -Body $savePayload | Out-Null
Write-Host "[2] Saved batch_size=77"

# 3. Reload and verify
$reloaded = Invoke-RestMethod -Uri "$SOC/prefetch/config/" -Headers $H
Write-Host "[3] Reload: $(if ($reloaded.config.batch_size -eq 77) { 'PASS' } else { 'FAIL (got $($reloaded.config.batch_size))' })"

# 4. Restore original
$newConfig.batch_size = $originalBatchSize
$restorePayload = @{ config_payload = $newConfig } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$SOC/prefetch/config/" -Method POST -Headers $H -Body $restorePayload | Out-Null
Write-Host "[4] Restored to batch_size=$originalBatchSize"

# 5. Warm Now async
$wn = Invoke-RestMethod -Uri "$SOC/prefetch/warm-now/?mode=async" -Method POST -Headers $H
Write-Host "[5] Warm Now async: $(if ($wn) { 'PASS' } else { 'FAIL' })"

Write-Host "=== Prefetch Round-Trip: Done ==="
```

---

## Test Suite 3: DataOps Planner Dispatch

```powershell
Write-Host "=== DataOps Planner Dispatch Test ==="

# 1. Dry-run preview
$previewPayload = @{
    symbols = @()
    datasets = @("daily_prices")
    mode = "missing_only"
    force_refresh = $false
    execution_mode = "async"
    reason = "integration_test"
} | ConvertTo-Json

$preview = Invoke-RestMethod -Uri "$SOC/dataops/planner/preview/" -Method POST -Headers $H -Body $previewPayload
Write-Host "[1] Dry-run preview: $(if ($preview) { 'PASS' } else { 'FAIL' })"
Write-Host "    Preview result: $($preview | ConvertTo-Json -Depth 2)"

Write-Host "=== DataOps Planner: Done ==="
```

---

## Test Suite 4: 410 GONE Verification (D2)

```powershell
Write-Host "=== D2: 410 GONE Verification ==="

$adminOpsEndpoints = @(
    @{ path = "/api/admin-ops/stats/"; expected_410_migrate = "/api/soc/overview/" },
    @{ path = "/api/admin-ops/runtime-kpi/"; expected_410_migrate = "/api/soc/runtime-kpi/" },
    @{ path = "/api/admin-ops/vnbroker-config/current/"; expected_410_migrate = "/api/soc/vnbroker/config/" },
    @{ path = "/api/admin-ops/prefetch/config/"; expected_410_migrate = "/api/soc/prefetch/config/" },
    @{ path = "/api/admin-ops/signals/config/"; expected_410_migrate = "/api/soc/screener/config/" }
)

foreach ($ep in $adminOpsEndpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$BASE$($ep.path)" -Headers $H -ErrorAction Stop
        Write-Host "✗ FAIL: $($ep.path) returned $($response.StatusCode) (expected 410)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 410) {
            # Verify migrate_to field
            $body = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            $hasMigrateTo = $body.migrate_to -ne $null
            Write-Host "$(if ($hasMigrateTo) { '✓ PASS' } else { '⚠ PARTIAL (410 but no migrate_to)' }): $($ep.path) → 410 migrate_to=$($body.migrate_to)"
        } else {
            Write-Host "✗ FAIL: $($ep.path) → $code (expected 410)"
        }
    }
}

# SOC vẫn hoạt động sau decommission
$socHealth = (Invoke-WebRequest -Uri "$SOC/overview/" -Headers $H).StatusCode
Write-Host "$(if ($socHealth -eq 200) { '✓ PASS' } else { '✗ FAIL' }): /api/soc/overview/ → $socHealth"

Write-Host "=== D2 Verification: Done ==="
```

---

## Test Suite 5: Full Stack Health (Post D3)

```powershell
Write-Host "=== D3: Full Stack Health Test ==="

# 1. Build clean
Push-Location ./frontend
$buildOutput = npm run build 2>&1
$buildOk = $LASTEXITCODE -eq 0
Write-Host "[1] Build: $(if ($buildOk) { '✓ PASS' } else { '✗ FAIL' })"
Pop-Location

# 2. No admin-ops imports
$grep = Select-String -Path "frontend/src/api/client.js" -Pattern "admin-ops" -ErrorAction SilentlyContinue
Write-Host "[2] No admin-ops in client.js: $(if (-not $grep) { '✓ PASS' } else { '✗ FAIL (' + $grep.Count + ' matches)' })"

# 3. Stack health
$health = Invoke-RestMethod -Uri "$BASE/core/v1/health"
Write-Host "[3] Stack health: $(if ($health.status -eq 'healthy') { '✓ PASS' } else { '✗ FAIL: ' + $health.status })"

# 4. Core SOC endpoints
$socEndpoints = @("/api/soc/overview/", "/api/soc/prefetch/config/", "/api/soc/screener/config/", "/api/soc/screener/rules/")
foreach ($ep in $socEndpoints) {
    $code = (Invoke-WebRequest -Uri "$BASE$ep" -Headers $H).StatusCode
    Write-Host "[4] $ep → $code $(if ($code -eq 200) { '✓' } else { '✗' })"
}

Write-Host "=== Full Stack Health: Done ==="
```

---

## Execution order

```
Suite 1 (Screener CRUD)      → After S5-BE + S5-FE complete
Suite 2 (Prefetch Round-Trip) → After S1 complete
Suite 3 (DataOps Planner)    → After S3 complete
Suite 4 (410 GONE)           → After D2 complete
Suite 5 (Stack Health)       → After D3 complete
```

**All suites PASS** = production-ready signal.
