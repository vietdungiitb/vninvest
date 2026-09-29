# RUN SPEC AUDIT — SOC Config UI Upgrade & Admin-Ops Decommission

**Ngày**: 2026-05-16  
**Scope**: Cross-check 30 requirements từ TRACEABILITY_MATRIX với implementation thực tế.

---

## Nguyên tắc

1. Mỗi requirement phải có ít nhất một verificable artifact (code / test / curl / screenshot).
2. Status: ✅ PASS / ⚠ PARTIAL / ❌ FAIL / ⏳ NOT YET
3. Chạy spec audit sau khi tất cả slices DONE, trước sign-off final.

---

## Audit Checklist

### Group A: Prefetch (SCD-REQ-01 → 04)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-01 | PrefetchPanel có form editable với 11 runtime config fields | `PrefetchPanel.jsx` có đúng 11 `<input type="number">` fields | ⏳ |
| SCD-REQ-02 | Universe Groups multiselect hoạt động | Multiselect component, payload có `universe_group_ids` | ⏳ |
| SCD-REQ-03 | 6 time policy profile intervals editable | 6 input components, map to profile keys | ⏳ |
| SCD-REQ-04 | Warm Now async và sync buttons | 2 buttons, gọi đúng `?mode=async` vs sync | ⏳ |

```powershell
# Verify: đếm số inputs trong PrefetchPanel
Select-String -Path "frontend/src/components/soc/PrefetchPanel.jsx" -Pattern "type=\"number\"" | Measure-Object -Line
# Expected: 11 lines

# Verify: warm-now modes
Select-String -Path "frontend/src/components/soc/PrefetchPanel.jsx" -Pattern "warm-now" | Measure-Object -Line
# Expected: >= 2 (async + sync)
```

---

### Group B: DataOps (SCD-REQ-05 → 07)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-05 | DataOps backfill UI hỗ trợ 4+ dataset types | `DataOpsPanel.jsx` render 4+ checkboxes | ⏳ |
| SCD-REQ-06 | Dry-run preview hiển thị estimate | Preview response được render ra UI | ⏳ |
| SCD-REQ-07 | Intraday Tick backfill dùng đúng task | API call target: `run_intraday_side_backfill_apply` | ⏳ |

```powershell
# Verify dataset types count
Select-String -Path "frontend/src/components/soc/DataOpsPanel.jsx" -Pattern "daily_prices|session_facts|intraday_bars|whale_events|dark_flow|signal_snapshots|intraday_tick" | Measure-Object -Line
# Expected: >= 4
```

---

### Group C: Screener Config (SCD-REQ-08 → 09, 13)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-08 | ScreenerPanel config form 7 editable fields | JSX form có 7 config field inputs | ⏳ |
| SCD-REQ-09 | Manual scan gửi `{symbols}` không phải `{rule_ids}` | `socApi.js` manualScan body | ⏳ |
| SCD-REQ-13 | Pagination cho rules list và alert history | `page`/`page_size` params trong API calls | ⏳ |

```powershell
# CRITICAL: verify no rule_ids
$hits = Select-String -Path "frontend/src/api/socApi.js" -Pattern "rule_ids"
if ($hits) {
    Write-Host "❌ FAIL: rule_ids vẫn còn trong socApi.js"
    $hits | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
} else {
    Write-Host "✅ PASS: Không còn rule_ids trong manualScan"
}
```

---

### Group D: Screener Rule CRUD (SCD-REQ-10 → 12, 15 → 19)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-10 | Rule create form: name + type + conditions + enabled | JSX có form, 9 type options | ⏳ |
| SCD-REQ-11 | Rule edit: PUT endpoint | `PUT /api/soc/screener/rules/<id>/` → 200 | ⏳ |
| SCD-REQ-12 | Rule delete: confirm + DELETE | Delete confirm dialog + 204 | ⏳ |
| SCD-REQ-15 | `createScreenerRule` tồn tại | `grep createScreenerRule socApi.js` | ⏳ |
| SCD-REQ-16 | `updateScreenerRule(id, payload)` tồn tại | `grep updateScreenerRule socApi.js` | ⏳ |
| SCD-REQ-17 | `deleteScreenerRule(id)` tồn tại | `grep deleteScreenerRule socApi.js` | ⏳ |
| SCD-REQ-18 | Backend PUT view + unit test | Test PASS | ⏳ |
| SCD-REQ-19 | Backend DELETE view + unit test | Test PASS | ⏳ |

```powershell
# Check all 3 CRUD functions exist
$funcs = @("createScreenerRule", "updateScreenerRule", "deleteScreenerRule")
foreach ($f in $funcs) {
    $hit = Select-String -Path "frontend/src/api/socApi.js" -Pattern "export.*$f|function $f|const $f"
    Write-Host "$(if ($hit) { '✅' } else { '❌' }) $f in socApi.js"
}

# Backend tests
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test service_ops.tests.test_screener_rule_crud --keepdb -v 2 2>&1
Pop-Location
# Expected: OK
```

---

### Group E: VnBroker (SCD-REQ-21 → 24)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-21 | VnbrokerPanel structured form | JSX có form fields, không có JSON textarea | ⏳ |
| SCD-REQ-22 | DNSE credential từ env, không có input | JSX: no `<input>` for DNSE keys | ⏳ |
| SCD-REQ-23 | Benchmark tool hiển thị kết quả | Benchmark result state được render | ⏳ |
| SCD-REQ-24 | Reset confirm dialog | Confirm dialog trước reset | ⏳ |

```powershell
# Verify: không có input field cho DNSE keys
$dnseInputs = Select-String -Path "frontend/src/components/soc/VnbrokerPanel.jsx" `
    -Pattern "DNSE_API_ID|DNSE_API_KEY|dnse.*input|input.*dnse" -CaseSensitive:$false
Write-Host "$(if (-not $dnseInputs) { '✅ PASS' } else { '❌ FAIL (DNSE input found)' }): No DNSE input fields"
```

---

### Group F: SOCPage Routing (SCD-REQ-25)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-25 | SOCPage có tabs `vnbroker` và `runtime-kpi` | Tab routing works | ⏳ |

```powershell
$tabHits = Select-String -Path "frontend/src/pages/SOCPage.jsx" -Pattern "'vnbroker'|\"vnbroker\"|'runtime-kpi'|\"runtime-kpi\""
Write-Host "$(if ($tabHits.Count -ge 2) { '✅ PASS' } else { '❌ FAIL' }): vnbroker + runtime-kpi tabs in SOCPage ($($tabHits.Count) matches)"
```

---

### Group G: Decommission (SCD-REQ-26 → 30)

| Req | Requirement text | Verification | Status |
|-----|-----------------|--------------|--------|
| SCD-REQ-26 | `/api/admin-ops/*` trả 410 GONE | 5 endpoints → 410 | ⏳ |
| SCD-REQ-27 | `client.js` không còn bridge functions | grep = 0 | ⏳ |
| SCD-REQ-28 | `App.jsx` không còn admin-ops routes | grep = 0 | ⏳ |
| SCD-REQ-29 | `npm run build` pass | Exit 0 | ⏳ |
| SCD-REQ-30 | Stack healthy sau D3 | `/core/v1/health` = healthy | ⏳ |

```powershell
# Quick final spec audit summary
Write-Host "=== Final Spec Audit ==="

# G1: 410 check (sample)
try {
    $r = Invoke-WebRequest -Uri "http://localhost/api/admin-ops/stats/" -ErrorAction Stop
    Write-Host "❌ SCD-REQ-26: Got $($r.StatusCode) (expected 410)"
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    Write-Host "$(if ($code -eq 410) { '✅' } else { '❌' }) SCD-REQ-26: /admin-ops/stats/ → $code"
}

# G2: client.js clean
$bridgeHits = (Select-String -Path "frontend/src/api/client.js" -Pattern "admin-ops" | Measure-Object -Line).Lines
Write-Host "$(if ($bridgeHits -eq 0) { '✅' } else { '❌' }) SCD-REQ-27: bridge functions in client.js = $bridgeHits"

# G3: App.jsx clean
$appHits = (Select-String -Path "frontend/src/App.jsx" -Pattern "admin-ops|AdminOps" | Measure-Object -Line).Lines
Write-Host "$(if ($appHits -eq 0) { '✅' } else { '❌' }) SCD-REQ-28: admin-ops routes in App.jsx = $appHits"

# G4: Build
Push-Location ./frontend; npm run build 2>&1 | Out-Null; $be = $LASTEXITCODE; Pop-Location
Write-Host "$(if ($be -eq 0) { '✅' } else { '❌' }) SCD-REQ-29: Build exit code = $be"

# G5: Health
$h = Invoke-RestMethod -Uri "http://localhost/core/v1/health"
Write-Host "$(if ($h.status -eq 'healthy') { '✅' } else { '❌' }) SCD-REQ-30: Stack = $($h.status)"
```

---

## Spec Audit Summary

```
Total requirements: 30
✅ PASS:    ___
⚠ PARTIAL: ___
❌ FAIL:    ___
⏳ NOT YET: ___

Sign-off (Tech Lead): ___________
Date: ___________
```

**Pass threshold**: Tất cả P0 requirements = ✅ PASS. P1/P2 không có ❌ FAIL.
