# RUN SPEC AUDIT — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Mục đích**: Cross-check 25 requirements (DM-REQ-01 → DM-REQ-25) với verification commands.  
**Khi nào chạy**: Trước khi sign-off mỗi slice; bắt buộc trước DM-07.

**Legend**: ⏳ Chưa verify | ✅ PASS | ❌ FAIL | 🔒 Gate (blocking nếu FAIL)

---

## DM-REQ-01 — useAlertCenterFeed return keys

**Mô tả**: `useAlertCenterFeed` return object phải có `currentUnifiedPage`, `hasPreviousUnifiedPage`, `hasLastUnifiedPage`

```powershell
$file = "frontend/src/hooks/useAlertCenterFeed.js"
$keys = @("currentUnifiedPage", "hasPreviousUnifiedPage", "hasLastUnifiedPage")
foreach ($k in $keys) {
  $hit = Select-String $file -Pattern $k
  Write-Host "$(if ($hit) { '✅' } else { '❌' }) $k"
}
```

**Expected**: Tất cả 3 keys ✅  
**Status**: ⏳

---

## DM-REQ-02 — Audience filter enum `_only` suffix

**Mô tả**: `UnifiedAlertCenter` phải dùng `'holdings_only'` và `'watchlist_only'`

```powershell
$file = "frontend/src/components/UnifiedAlertCenter.jsx"
Select-String $file -Pattern "holdings_only|watchlist_only"
```

**Expected**: 2 matches (1 per enum value)  
**Status**: ⏳

---

## DM-REQ-03 — session_date trong client.js

**Mô tả**: `client.js` truyền `session_date` khi `window === 'session'`

```powershell
$file = "frontend/src/api/client.js"
Select-String $file -Pattern "session_date"
```

**Expected**: ≥ 1 match trong getAlertCenterFeed function  
**Status**: ⏳

---

## DM-REQ-04 — SmartStatsHeader i18n

**Mô tả**: `SmartStatsHeader` dùng `t('dashboard.breadthLabel')`, key tồn tại trong `vi.js`

```powershell
$file_stats = "frontend/src/components/modern/SmartStatsHeader.jsx"
$file_vi = "frontend/src/i18n/vi.js"

# Check t() call
$tCall = Select-String $file_stats -Pattern "breadthLabel"
Write-Host "$(if ($tCall) { '✅' } else { '❌' }) t() call với breadthLabel trong SmartStatsHeader"

# Check no hardcode
$hardcode = Select-String $file_stats -Pattern "Độ rộng danh mục"
Write-Host "$(if (-not $hardcode) { '✅' } else { '❌' }) No hardcode text"

# Check vi.js key
$viKey = Select-String $file_vi -Pattern "breadthLabel"
Write-Host "$(if ($viKey) { '✅' } else { '❌' }) breadthLabel key trong vi.js"
```

**Expected**: Tất cả ✅  
**Status**: ⏳

---

## DM-REQ-05 — legacyApiGet private transport 🔒

**Mô tả**: `coreApiAdapter.js` có private `legacyApiGet` cho `/api/` paths, không export

```powershell
$file = "packages/web/src/adapters/coreApiAdapter.js"

$exists = Select-String $file -Pattern "legacyApiGet|legacyApi"
Write-Host "$(if ($exists) { '✅' } else { '❌' }) legacyApiGet helper tồn tại"

$exported = Select-String $file -Pattern "export.*legacyApiGet"
Write-Host "$(if (-not $exported) { '✅' } else { '❌' }) legacyApiGet KHÔNG export"
```

**Expected**: tồn tại ✅, không export ✅  
**Status**: ⏳

---

## DM-REQ-06 — getPortfolioHoldings + getPortfolioSummary 🔒

```powershell
$file = "packages/web/src/adapters/coreApiAdapter.js"
$methods = @("getPortfolioHoldings", "getPortfolioSummary")
foreach ($m in $methods) {
  $count = (Select-String $file -Pattern $m | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '✅' } else { '❌' }) $m ($count occurrences)"
}
# Verify guard
$guard = Select-String $file -Pattern "throw new Error.*portfolioId"
Write-Host "$(if ($guard.Count -ge 2) { '✅' } else { '❌' }) portfolioId guard (found: $($guard.Count))"
```

**Expected**: ≥ 2 occurrences each (definition + call), ≥ 2 guards  
**Status**: ⏳

---

## DM-REQ-07 — getPortfolioAnalytics + getPortfolioTechnicals 🔒

```powershell
$file = "packages/web/src/adapters/coreApiAdapter.js"
$methods = @("getPortfolioAnalytics", "getPortfolioTechnicals")
foreach ($m in $methods) {
  $count = (Select-String $file -Pattern $m | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '✅' } else { '❌' }) $m ($count occurrences)"
}
# Analytics days param
$daysParam = Select-String $file -Pattern "days"
Write-Host "$(if ($daysParam) { '✅' } else { '❌' }) days param trong getPortfolioAnalytics"
```

**Expected**: ≥ 2 occurrences each  
**Status**: ⏳

---

## DM-REQ-08 — getBulkTechnicalsBySymbols dùng legacyApiGet 🔒

```powershell
$file = "packages/web/src/adapters/coreApiAdapter.js"
$method = Select-String $file -Pattern "getBulkTechnicalsBySymbols"
Write-Host "$(if ($method.Count -ge 2) { '✅' } else { '❌' }) getBulkTechnicalsBySymbols tồn tại ($($method.Count) occurrences)"

$bulkPath = Select-String $file -Pattern "technicals/bulk"
Write-Host "$(if ($bulkPath) { '✅' } else { '❌' }) Bulk technicals path dùng legacy /api/ path"

# Empty guard
$emptyGuard = Select-String $file -Pattern "length === 0|\.length == 0|Promise.resolve\(\[\]\)"
Write-Host "$(if ($emptyGuard) { '✅' } else { '❌' }) Empty symbols guard"
```

**Expected**: Tất cả ✅  
**Status**: ⏳

---

## DM-REQ-09 — getTrackedSymbols + getLegacyWatchlistGroups

```powershell
$file = "packages/web/src/adapters/coreApiAdapter.js"
$methods = @("getTrackedSymbols", "getLegacyWatchlistGroups")
foreach ($m in $methods) {
  $count = (Select-String $file -Pattern $m | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '✅' } else { '❌' }) $m ($count occurrences)"
}
```

**Status**: ⏳

---

## DM-REQ-10 — useCoreDashboardData với AbortController + refresh() 🔒

```powershell
$file = "packages/web/src/features/dashboard/useCoreDashboardData.js"
Write-Host "$(if (Test-Path $file) { '✅' } else { '❌' }) File tồn tại"

$abort = (Select-String $file -Pattern "AbortController" | Measure-Object).Count
Write-Host "$(if ($abort -ge 1) { '✅' } else { '❌' }) AbortController used ($abort)"

$mounted = (Select-String $file -Pattern "aborted|mountedRef" | Measure-Object).Count
Write-Host "$(if ($mounted -ge 2) { '✅' } else { '❌' }) Unmount protection ($mounted)"

$refresh = (Select-String $file -Pattern "refresh" | Measure-Object).Count
Write-Host "$(if ($refresh -ge 3) { '✅' } else { '❌' }) refresh() exported ($refresh)"

$noApiClient = -not (Select-String $file -Pattern "apiClient")
Write-Host "$(if ($noApiClient) { '✅' } else { '❌' }) Không import apiClient"
```

**Status**: ⏳

---

## DM-REQ-11 — Bulk technicals sau holdings resolve

```powershell
$file = "packages/web/src/features/dashboard/useCoreDashboardData.js"
# Manual review: getBulkTechnicalsBySymbols được gọi sau khi holdings Promise resolved
$bulk = Select-String $file -Pattern "getBulkTechnicalsBySymbols"
Write-Host "$(if ($bulk) { '✅' } else { '❌' }) getBulkTechnicalsBySymbols called in hook"
Write-Host "[MANUAL] Verify gọi sau holdings resolve (Phase 2 pattern)"
```

**Status**: ⏳

---

## DM-REQ-12 — alertFeed fetching với loading state riêng

```powershell
$file = "packages/web/src/features/dashboard/useCoreDashboardData.js"
$alertFeed = (Select-String $file -Pattern "alertFeed" | Measure-Object).Count
Write-Host "$(if ($alertFeed -ge 3) { '✅' } else { '❌' }) alertFeed state ($alertFeed occurrences)"
$alertLoading = Select-String $file -Pattern "alertFeed.*loading|loading.*alertFeed"
Write-Host "$(if ($alertLoading) { '✅' } else { '⚠️' }) alertFeed.loading state riêng"
```

**Status**: ⏳

---

## DM-REQ-13 — DashboardPage full layout với 5 slots 🔒

```powershell
$file = "packages/web/src/pages/DashboardPage.js"
$slots = @("renderStatsHeader","renderPositionDeck","renderAlertCenter","renderHeatmap","renderBubble")
foreach ($s in $slots) {
  $count = (Select-String $file -Pattern $s | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '✅' } else { '❌' }) $s ($count occurrences)"
}
$jsx = (Select-String $file -Pattern "<[A-Z][a-zA-Z]|<div |<span " | Measure-Object).Count
Write-Host "$(if ($jsx -eq 0) { '✅' } else { '❌' }) No JSX syntax ($jsx found)"
```

**Status**: ⏳

---

## DM-REQ-14 — Fallback UI cho 3 slots

```powershell
$file = "packages/web/src/pages/DashboardPage.js"
$fallbacks = @("BuiltinStats|fallback.*stats","BuiltinDeck|fallback.*deck","BuiltinAlert|fallback.*alert")
foreach ($f in $fallbacks) {
  $hit = Select-String $file -Pattern $f
  Write-Host "$(if ($hit) { '✅' } else { '⚠️' }) Fallback: $f"
}
Write-Host "[MANUAL] Verify fallbacks render khi slot = null"
```

**Status**: ⏳

---

## DM-REQ-15 — Skeleton loading state

```powershell
$file = "packages/web/src/pages/DashboardPage.js"
$skeleton = Select-String $file -Pattern "skeleton|loading"
Write-Host "$(if ($skeleton.Count -ge 2) { '✅' } else { '❌' }) Loading/skeleton state ($($skeleton.Count) occurrences)"
```

**Status**: ⏳

---

## DM-REQ-16 — i18n tiếng Việt trong packages/web 🔒

```powershell
$file = "packages/web/src/pages/DashboardPage.js"
# Check không có English-only phrases
$engPhrases = @("No data","Loading...","Error","Portfolio")
foreach ($p in $engPhrases) {
  $hit = Select-String $file -Pattern [regex]::Escape($p)
  if ($hit) { Write-Host "⚠️ Possible English text: '$p'" }
}
Write-Host "[MANUAL] Review toàn bộ string literals trong DashboardPage.js"
```

**Status**: ⏳

---

## DM-REQ-17 — PackageDashboardHost inject slots 🔒

```powershell
$file = "frontend/src/pages/PackageDashboardHost.jsx"
Write-Host "$(if (Test-Path $file) { '✅' } else { '❌' }) File tồn tại"
$webImport = Select-String $file -Pattern "@vninvest/web"
Write-Host "$(if ($webImport) { '✅' } else { '❌' }) Import từ @vninvest/web"
$slots = @("renderStatsHeader","renderPositionDeck","renderAlertCenter","renderHeatmap")
foreach ($s in $slots) {
  $hit = Select-String $file -Pattern $s
  Write-Host "$(if ($hit) { '✅' } else { '❌' }) $s injected"
}
```

**Status**: ⏳

---

## DM-REQ-18 — Không import apiClient trong packages/web 🔒

```powershell
# Check toàn bộ packages/web/src
$apiclientRefs = Select-String -Path "packages/web/src" -Pattern "import.*apiClient|from.*apiClient" -Recurse
if ($apiclientRefs) {
  Write-Host "❌ apiClient references found:"
  $apiclientRefs | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber): $($_.Line)" }
} else {
  Write-Host "✅ No apiClient references in packages/web/src"
}
```

**Expected**: 0 references  
**Status**: ⏳

---

## DM-REQ-19 — Route swap với shadow 🔒

```powershell
$file = "frontend/src/App.jsx"
$host = Select-String $file -Pattern "PackageDashboardHost"
Write-Host "$(if ($host.Count -ge 2) { '✅' } else { '❌' }) PackageDashboardHost in App.jsx ($($host.Count))"
$shadow = Select-String $file -Pattern "dashboard/legacy"
Write-Host "$(if ($shadow) { '✅' } else { '❌' }) Shadow route dashboard/legacy"
```

**Status**: ⏳

---

## DM-REQ-20 — Build PASS + Smoke PASS 🔒

```powershell
Push-Location ./frontend
npm run build
$exitCode = $LASTEXITCODE
Pop-Location
Write-Host "$(if ($exitCode -eq 0) { '✅' } else { '❌' }) npm run build exit code: $exitCode"
Write-Host "[MANUAL] Verify smoke test checklist (Suite 6 in integration tests)"
```

**Status**: ⏳

---

## DM-REQ-21 — 3-day parity evidence 🔒

```powershell
$parityFile = "docs/DASHBOARD_MIGRATION_PARITY_REPORT.md"
Write-Host "$(if (Test-Path $parityFile) { '✅' } else { '❌' }) Parity report file tồn tại"
if (Test-Path $parityFile) {
  $content = Get-Content $parityFile -Raw
  $dayCount = ([regex]::Matches($content, "## Ngày \d")).Count
  Write-Host "$(if ($dayCount -ge 3) { '✅' } else { '❌' }) Đủ 3 ngày ($dayCount found)"
}
```

**Status**: ⏳

---

## DM-REQ-22 — Parity ≥ 99% + Tech Lead sign-off 🔒

```powershell
$parityFile = "docs/DASHBOARD_MIGRATION_PARITY_REPORT.md"
if (Test-Path $parityFile) {
  $content = Get-Content $parityFile -Raw
  $signoff = $content -match "Sign-off|Tech Lead"
  Write-Host "$(if ($signoff) { '✅' } else { '❌' }) Tech Lead sign-off section"
  Write-Host "[MANUAL] Verify 6 metrics PASS >= 99% trong mỗi ngày"
}
```

**Status**: ⏳

---

## DM-REQ-23 — 7 pre-decommission gates 🔒

```powershell
# Checklist manual — mỗi gate phải PASS trước khi delete ModernDashboard
$gates = @("A: Parity report tồn tại","B: 6 metrics PASS 3 ngày","C: Tech Lead sign-off","D: 1-day advance notice","E: Clean build","F: No open P0/P1 bugs","G: module_tree_full.md sẽ regenerate")
Write-Host "=== Pre-decommission gates ==="
foreach ($g in $gates) {
  Write-Host "[ ] Gate $g"
}
Write-Host "Điền [x] vào từng gate sau khi confirm."
```

**Status**: ⏳

---

## DM-REQ-24 — ModernDashboard deleted, no dead imports 🔒

```powershell
$fileGone = -not (Test-Path "frontend/src/pages/modern/ModernDashboard.jsx")
Write-Host "$(if ($fileGone) { '✅' } else { '❌' }) ModernDashboard.jsx đã xóa"

$refs = Select-String -Path "frontend/src" -Pattern "ModernDashboard" -Recurse -ErrorAction SilentlyContinue
Write-Host "$(if (-not $refs) { '✅' } else { '❌' }) Không còn references ($($refs.Count) found)"

Push-Location ./frontend; npm run build; $code = $LASTEXITCODE; Pop-Location
Write-Host "$(if ($code -eq 0) { '✅' } else { '❌' }) Build PASS sau decommission"
```

**Status**: ⏳

---

## DM-REQ-25 — Governance artifacts updated

```powershell
$today = (Get-Date).Date

$ledger = Get-Item "docs/CODE_CHANGE_AUDIT_LEDGER.md" -ErrorAction SilentlyContinue
$ledgerUpdated = $ledger -and ($ledger.LastWriteTime.Date -ge $today)
Write-Host "$(if ($ledgerUpdated) { '✅' } else { '❌' }) CODE_CHANGE_AUDIT_LEDGER.md updated today"

$progress = Get-Item "PROGRESS_DASHBOARD.md" -ErrorAction SilentlyContinue
$progressUpdated = $progress -and ($progress.LastWriteTime.Date -ge $today)
Write-Host "$(if ($progressUpdated) { '✅' } else { '❌' }) PROGRESS_DASHBOARD.md updated today"

$moduleTree = Get-Item "module_tree_full.md" -ErrorAction SilentlyContinue
$moduleUpdated = $moduleTree -and ($moduleTree.LastWriteTime.Date -ge $today)
Write-Host "$(if ($moduleUpdated) { '✅' } else { '❌' }) module_tree_full.md updated today"
```

**Status**: ⏳

---

## Full Spec Audit Summary

```powershell
Write-Host "=== FULL SPEC AUDIT — Dashboard SaaS Native Migration ==="
Write-Host ""
Write-Host "Slice DM-00 (Bug Fixes):"
Write-Host "  REQ-01 useAlertCenterFeed return keys       : ⏳"
Write-Host "  REQ-02 Audience filter enum                 : ⏳"
Write-Host "  REQ-03 session_date in client.js            : ⏳"
Write-Host "  REQ-04 SmartStatsHeader i18n                : ⏳"
Write-Host ""
Write-Host "Slice DM-01 (coreApiAdapter):"
Write-Host "  REQ-05 legacyApiGet private transport       : ⏳"
Write-Host "  REQ-06 getPortfolioHoldings + Summary       : ⏳"
Write-Host "  REQ-07 getPortfolioAnalytics + Technicals   : ⏳"
Write-Host "  REQ-08 getBulkTechnicalsBySymbols           : ⏳"
Write-Host "  REQ-09 getTrackedSymbols + WatchlistGroups  : ⏳"
Write-Host ""
Write-Host "Slice DM-02 (useCoreDashboardData):"
Write-Host "  REQ-10 Hook với AbortController + refresh   : ⏳"
Write-Host "  REQ-11 Bulk technicals sau holdings         : ⏳"
Write-Host "  REQ-12 alertFeed separate loading           : ⏳"
Write-Host ""
Write-Host "Slice DM-03 (DashboardPage):"
Write-Host "  REQ-13 Full layout 5 slots, no JSX          : ⏳"
Write-Host "  REQ-14 Fallback UI cho 3 slots              : ⏳"
Write-Host "  REQ-15 Skeleton loading state               : ⏳"
Write-Host "  REQ-16 i18n tiếng Việt                      : ⏳"
Write-Host ""
Write-Host "Slice DM-04 (PackageDashboardHost):"
Write-Host "  REQ-17 Host inject 4 slots                  : ⏳"
Write-Host "  REQ-18 No apiClient in packages/web         : ⏳"
Write-Host ""
Write-Host "Slice DM-05 (Route Swap):"
Write-Host "  REQ-19 Route swap + shadow                  : ⏳"
Write-Host "  REQ-20 Build + Smoke PASS                   : ⏳"
Write-Host ""
Write-Host "Slice DM-06 (Parity):"
Write-Host "  REQ-21 3-day parity evidence                : ⏳"
Write-Host "  REQ-22 99% parity + Tech Lead sign-off      : ⏳"
Write-Host ""
Write-Host "Slice DM-07 (Decommission):"
Write-Host "  REQ-23 7 pre-decommission gates             : ⏳"
Write-Host "  REQ-24 ModernDashboard deleted + build      : ⏳"
Write-Host "  REQ-25 Governance artifacts updated         : ⏳"
```
