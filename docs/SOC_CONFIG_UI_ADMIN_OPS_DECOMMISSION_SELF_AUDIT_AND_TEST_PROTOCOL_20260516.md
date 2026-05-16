# SELF AUDIT & TEST PROTOCOL — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: Validation protocol cho từng slice — chạy sau mỗi slice, không tích lũy.

---

## 1. Nguyên tắc validation

1. Validate ngay sau mỗi slice — không tích lũy nhiều slices mới validate.
2. Mỗi slice phải có evidence (command output + payload snapshot) trước khi đánh dấu DONE.
3. `npm run build` phải pass sau mỗi frontend slice — không để lại broken build.
4. Gate D1 là **blocking** — không decommission bất cứ thứ gì trước khi D1 PASS.

---

## 2. Phase S5-BE — Screener Rule Backend

```powershell
# Setup: activate venv và chạy tests focused
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_screener_rule_crud --keepdb -v 2
Pop-Location
```

**Expected**: Tất cả 5 tests PASS, 0 errors, 0 failures.

**Fallback nếu test file chưa exist**:
```powershell
# Manual curl test sau khi start dev stack
$BASE = "http://localhost/api/soc"
$TOKEN = "<your admin token>"
$H = @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" }

# Test tạo rule
$newRule = '{"name":"Test Rule","type":"whale_count","value":[{"field":"whale_count","op":"gte","value":3}],"enabled":true}'
$created = Invoke-RestMethod -Uri "$BASE/screener/rules/" -Method POST -Headers $H -Body $newRule
Write-Host "Created rule id: $($created.rule_id)"

# Test update rule
$ruleId = $created.rule_id
$update = '{"name":"Updated Rule","enabled":false}'
Invoke-RestMethod -Uri "$BASE/screener/rules/$ruleId/" -Method PUT -Headers $H -Body $update
Write-Host "Update: OK"

# Test delete rule
Invoke-RestMethod -Uri "$BASE/screener/rules/$ruleId/delete/" -Method DELETE -Headers $H
Write-Host "Delete: OK (204)"

# Test delete không tồn tại → 404
try {
    Invoke-RestMethod -Uri "$BASE/screener/rules/nonexistent/delete/" -Method DELETE -Headers $H
} catch {
    Write-Host "404 expected: $($_.Exception.Response.StatusCode)"
}
```

---

## 3. Phase S1 — PrefetchPanel Smoke Test

```powershell
# Sau khi rebuild frontend
Push-Location ./frontend; npm run build; Pop-Location
# Expected: exit 0, no errors

# Validate API contract (manual check)
$BASE = "http://localhost/api/soc"
$TOKEN = "<your admin token>"
$H = @{ "Authorization" = "Bearer $TOKEN" }

# Load config
$config = Invoke-RestMethod -Uri "$BASE/prefetch/config/" -Headers $H
Write-Host "Config loaded, batch_size: $($config.config.batch_size)"

# Load universe groups
$groups = Invoke-RestMethod -Uri "$BASE/prefetch/universe-groups/" -Headers $H
Write-Host "Universe groups count: $($groups.groups.Count)"

# Warm Now async
$warmResult = Invoke-RestMethod -Uri "$BASE/prefetch/warm-now/?mode=async" -Method POST -Headers $H
Write-Host "Warm Now: $($warmResult | ConvertTo-Json -Depth 3)"
# Expected: có task_id hoặc status field
```

**Browser smoke test (manual)**:
```
1. Mở http://localhost/operations-center?tab=prefetch
2. Kiểm tra: form có 11 number inputs hiển thị đúng giá trị
3. Sửa batch_size thành 25, click "Xem trước & Lưu"
4. ConfigPreviewModal mở, hiển thị diff
5. Confirm → reload config → batch_size = 25
6. Click "Warm Now (Async)" → hiển thị task_id
7. Không còn raw JSON <pre> dump
```

---

## 4. Phase S3 — DataOps Backfill Smoke Test

```powershell
# Build check
Push-Location ./frontend; npm run build; Pop-Location

# Dry-run test
$BASE = "http://localhost/api/soc"
$H = @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" }

$payload = @{
    symbols = @()
    datasets = @("daily_prices")
    mode = "missing_only"
    force_refresh = $false
    execution_mode = "async"
    reason = "test_dry_run"
} | ConvertTo-Json

$preview = Invoke-RestMethod -Uri "$BASE/dataops/planner/preview/" -Method POST -Headers $H -Body $payload
Write-Host "Preview: $($preview | ConvertTo-Json -Depth 3)"
# Expected: không lỗi, có estimate info
```

**Browser smoke test (manual)**:
```
1. Mở http://localhost/operations-center?tab=dataops
2. Kiểm tra: "Trung tâm Backfill Dữ liệu" section hiện ở đầu trang
3. Check "OHLCV ngày", chọn VN30, date range 30 ngày qua, missing_only, async
4. Click "Xem trước (Dry-run)" → preview hiển thị
5. Click "Chạy Backfill" → confirm → task_id hiển thị
6. Kiểm tra datasets khác: intraday bars, session facts
```

---

## 5. Phase S5-FE — Screener CRUD Smoke Test

```powershell
# Build check
Push-Location ./frontend; npm run build; Pop-Location
```

**Browser smoke test (manual)**:
```
1. Mở http://localhost/operations-center?tab=screener
2. Kiểm tra: Config form hiển thị (enabled toggle, scan_interval_seconds, etc.)
3. Sửa scan_interval_seconds thành 120, lưu → reload → 120
4. Manual Scan: nhập "VNM,VIC" vào symbol filter, click Gửi
   → Kiểm tra network tab: payload có "symbols": ["VNM","VIC"] (không phải rule_ids)
5. Rule CRUD:
   a. Click "Tạo luật mới" → form mở
   b. Nhập tên, chọn loại "whale_count", conditions: [{"field":"whale_count","op":"gte","value":3}]
   c. Click "Lưu luật" → rule xuất hiện trong danh sách
   d. Click "Sửa" → form load rule, sửa tên → lưu → table cập nhật
   e. Toggle bật/tắt → trạng thái đổi ngay
   f. Click "Xóa" → confirm → rule biến mất
6. Pagination: tạo 15+ rules → kiểm tra trang 2 load đúng
7. WriteGuardBanner: không hiển thị khi can_apply=True
```

**Contract validation**:
```powershell
# Verify manualScan gửi symbols, không phải rule_ids
# Bật DevTools → Network → Filter: manual-scan
# Request payload phải là: {"symbols": [...]} KHÔNG phải {"rule_ids": [...]}
```

---

## 6. Phase S2 — VnBroker Smoke Test

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

**Browser smoke test**:
```
1. Mở http://localhost/operations-center?tab=vnbroker  (hoặc trong SOC panel)
2. Kiểm tra: structured form thay vì raw JSON textarea
3. Đổi max_workers thành 15, click Xem trước & Lưu
4. ConfigPreviewModal hiển thị diff
5. Confirm → reload → max_workers = 15
6. Benchmark: chọn KBS, click Chạy Benchmark
   → Loading spinner → bảng kết quả với latency
7. DNSE: hiển thị "✓ Đã cấu hình" hoặc "✗ Chưa cấu hình" (không có input field)
8. Reset về mặc định: confirm dialog hiển thị trước khi apply
```

---

## 7. Phase S4 — SOCPage Tabs Smoke Test

```powershell
Push-Location ./frontend; npm run build; Pop-Location
```

**Browser smoke test**:
```
1. Mở http://localhost/operations-center?tab=vnbroker
   → VnbrokerPanel hiển thị
2. Mở http://localhost/operations-center?tab=runtime-kpi
   → RuntimeKPIPanel hiển thị
3. Tab bar: 2 tabs mới xuất hiện với labels tiếng Việt
4. Các 6 tabs cũ: vẫn hoạt động bình thường (không regression)
```

---

## 8. Phase D1 — Parity Gate (tất cả S1–S5)

Chạy toàn bộ sau khi confirm tất cả 5 slices DONE:

```powershell
$BASE = "http://localhost"
$SOC = "$BASE/api/soc"
$H = @{ "Authorization" = "Bearer $TOKEN" }

Write-Host "=== D1 Parity Gate ==="

# 1. Prefetch form hoạt động
$pf = Invoke-RestMethod -Uri "$SOC/prefetch/config/" -Headers $H
Write-Host "[1] Prefetch config load: $($pf.config -ne $null)"

# 2. Prefetch warm-now
$wn = Invoke-RestMethod -Uri "$SOC/prefetch/warm-now/?mode=async" -Method POST -Headers $H
Write-Host "[2] Warm Now async: $($wn -ne $null)"

# 3. DataOps dry-run
$dp = Invoke-RestMethod -Uri "$SOC/dataops/planner/preview/" -Method POST -Headers $H `
  -Body '{"datasets":["daily_prices"],"mode":"missing_only"}' -ContentType "application/json"
Write-Host "[3] DataOps dry-run: $($dp -ne $null)"

# 4. Screener config load
$sc = Invoke-RestMethod -Uri "$SOC/screener/config/" -Headers $H
Write-Host "[4] Screener config: $($sc.config -ne $null)"

# 5. Screener manual scan (symbols, not rule_ids)
$ms = Invoke-RestMethod -Uri "$SOC/screener/manual-scan/" -Method POST -Headers $H `
  -Body '{"symbols":["VNM"]}' -ContentType "application/json"
Write-Host "[5] Manual scan (symbols): $($ms.scan_id)"

# 6. Screener rule CRUD cycle
$r = Invoke-RestMethod -Uri "$SOC/screener/rules/" -Method POST -Headers $H `
  -Body '{"name":"D1 Test","type":"whale_count","value":[{"field":"whale_count","op":"gte","value":1}]}' -ContentType "application/json"
$rid = $r.rule_id
Write-Host "[6a] Create rule: $rid"
Invoke-RestMethod -Uri "$SOC/screener/rules/$rid/" -Method PUT -Headers $H `
  -Body '{"name":"D1 Test Updated"}' -ContentType "application/json" | Out-Null
Write-Host "[6b] Update rule: OK"
$status = (Invoke-WebRequest -Uri "$SOC/screener/rules/$rid/delete/" -Method DELETE -Headers $H).StatusCode
Write-Host "[6c] Delete rule status: $status"  # Expected: 204

# 7. VnBroker config
$vc = Invoke-RestMethod -Uri "$SOC/vnbroker/config/" -Headers $H
Write-Host "[7] VnBroker config: $($vc.config -ne $null)"

# 8. Build check
Push-Location ./frontend
$buildResult = npm run build 2>&1
Write-Host "[8] Build: $($LASTEXITCODE -eq 0 ? 'PASS' : 'FAIL')"
Pop-Location

# 9. Stack health
$health = Invoke-RestMethod -Uri "$BASE/core/v1/health"
Write-Host "[9] Stack health: $($health.status)"

# 10. SOC tabs exist
$tabs = @("overview", "signals", "dataops", "prefetch", "screener", "matrix", "vnbroker", "runtime-kpi")
Write-Host "[10] Expected tabs: $($tabs -join ', ')"
```

**Pass criteria**: Tất cả 10 checks pass. Không có lỗi runtime. `npm run build` exit 0.

---

## 9. Phase D2 — Admin-Ops Decommission Test

```powershell
Write-Host "=== D2 410 GONE Verification ==="

$adminOpsEndpoints = @(
    "/api/admin-ops/stats/",
    "/api/admin-ops/runtime-kpi/",
    "/api/admin-ops/vnbroker-config/current/",
    "/api/admin-ops/prefetch/config/",
    "/api/admin-ops/signals/config/"
)

foreach ($ep in $adminOpsEndpoints) {
    $status = (Invoke-WebRequest -Uri "http://localhost$ep" -ErrorAction SilentlyContinue).StatusCode
    Write-Host "$ep → $status $(if ($status -eq 410) { '✓ PASS' } else { '✗ FAIL (expected 410)' })"
}

# SOC vẫn hoạt động
$socStatus = (Invoke-WebRequest -Uri "http://localhost/api/soc/overview/").StatusCode
Write-Host "/api/soc/overview/ → $socStatus $(if ($socStatus -eq 200) { '✓ PASS' })"
```

---

## 10. Phase D3 — Frontend Cleanup Test

```powershell
# Grep check: không còn bridge functions
$bridgePattern = "admin-ops"
$hits = Select-String -Path "frontend/src/api/client.js" -Pattern $bridgePattern
if ($hits) {
    Write-Host "✗ FAIL: Còn $($hits.Count) references tới admin-ops trong client.js"
    $hits | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
} else {
    Write-Host "✓ PASS: Không còn admin-ops trong client.js"
}

# Build check
Push-Location ./frontend; npm run build; Pop-Location
Write-Host "Build: $(if ($LASTEXITCODE -eq 0) { '✓ PASS' } else { '✗ FAIL' })"

# Stack health
Invoke-RestMethod -Uri "http://localhost/core/v1/health" | Select-Object status
# Expected: healthy

# Admin redirect vẫn hoạt động
$redirect = (Invoke-WebRequest -Uri "http://localhost/admin-ops" -MaximumRedirection 0 -ErrorAction SilentlyContinue)
Write-Host "Redirect /admin-ops: $($redirect.StatusCode)"  # Expected: 301 hoặc 302
```
