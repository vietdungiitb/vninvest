# RUN CODE REVIEW — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Mục đích**: Checklist code review per-slice. Reviewer chạy commands, điền kết quả, sign-off.

---

## Slice DM-00 — Fix 5 Dashboard Bugs

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | `currentUnifiedPage` trong return | `Select-String frontend/src/hooks/useAlertCenterFeed.js -Pattern "currentUnifiedPage"` | ≥ 1 match | |
| 2 | `hasPreviousUnifiedPage` trong return | `Select-String frontend/src/hooks/useAlertCenterFeed.js -Pattern "hasPreviousUnifiedPage"` | ≥ 1 match | |
| 3 | `hasLastUnifiedPage` trong return | `Select-String frontend/src/hooks/useAlertCenterFeed.js -Pattern "hasLastUnifiedPage"` | ≥ 1 match | |
| 4 | Audience filter `holdings_only` | `Select-String frontend/src/components/UnifiedAlertCenter.jsx -Pattern "holdings_only"` | ≥ 1 match | |
| 5 | Audience filter `watchlist_only` | `Select-String frontend/src/components/UnifiedAlertCenter.jsx -Pattern "watchlist_only"` | ≥ 1 match | |
| 6 | `session_date` trong client.js | `Select-String frontend/src/api/client.js -Pattern "session_date"` | ≥ 1 match | |
| 7 | i18n key `breadthLabel` trong SmartStatsHeader | `Select-String frontend/src/components/modern/SmartStatsHeader.jsx -Pattern "breadthLabel"` | ≥ 1 match | |
| 8 | `breadthLabel` key trong vi.js | `Select-String frontend/src/i18n/vi.js -Pattern "breadthLabel"` | 1 match | |
| 9 | Không còn hardcode `"Độ rộng danh mục"` trong SmartStatsHeader | `Select-String frontend/src/components/modern/SmartStatsHeader.jsx -Pattern "Độ rộng danh mục"` | 0 matches | |
| 10 | Build PASS | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 | |

```powershell
# DM-00 bulk review script
Write-Host "=== DM-00 Code Review ==="
$file_feed = "frontend/src/hooks/useAlertCenterFeed.js"
$file_alert = "frontend/src/components/UnifiedAlertCenter.jsx"
$file_client = "frontend/src/api/client.js"
$file_stats = "frontend/src/components/modern/SmartStatsHeader.jsx"
$file_vi = "frontend/src/i18n/vi.js"

$checks = @(
  @{F=$file_feed; P="currentUnifiedPage"; Min=1},
  @{F=$file_feed; P="hasPreviousUnifiedPage"; Min=1},
  @{F=$file_feed; P="hasLastUnifiedPage"; Min=1},
  @{F=$file_alert; P="holdings_only"; Min=1},
  @{F=$file_alert; P="watchlist_only"; Min=1},
  @{F=$file_client; P="session_date"; Min=1},
  @{F=$file_stats; P="breadthLabel"; Min=1},
  @{F=$file_vi; P="breadthLabel"; Min=1}
)

foreach ($c in $checks) {
  $hits = (Select-String $c.F -Pattern $c.P -ErrorAction SilentlyContinue | Measure-Object).Count
  $pass = $hits -ge $c.Min
  Write-Host "$(if ($pass) { '[PASS]' } else { '[FAIL]' }) $($c.P) in $($c.F | Split-Path -Leaf)"
}

# Check no hardcode
$hc = Select-String $file_stats -Pattern "Độ rộng danh mục" -ErrorAction SilentlyContinue
Write-Host "$(if (-not $hc) { '[PASS]' } else { '[FAIL]' }) No hardcode in SmartStatsHeader"
```

---

## Slice DM-01 — coreApiAdapter Portfolio Analytics Methods

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | `legacyApiGet` private helper tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "legacyApiGet"` | ≥ 1 | |
| 2 | `legacyApiGet` KHÔNG được export | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "export.*legacyApiGet"` | 0 | |
| 3 | `getPortfolioHoldings` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getPortfolioHoldings"` | ≥ 2 | |
| 4 | `getPortfolioSummary` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getPortfolioSummary"` | ≥ 2 | |
| 5 | `getPortfolioAnalytics` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getPortfolioAnalytics"` | ≥ 2 | |
| 6 | `getPortfolioTechnicals` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getPortfolioTechnicals"` | ≥ 2 | |
| 7 | `getBulkTechnicalsBySymbols` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getBulkTechnicalsBySymbols"` | ≥ 2 | |
| 8 | `getTrackedSymbols` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getTrackedSymbols"` | ≥ 2 | |
| 9 | `getLegacyWatchlistGroups` tồn tại | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "getLegacyWatchlistGroups"` | ≥ 2 | |
| 10 | Bulk technicals dùng `/stock-management/technicals/bulk` | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "technicals/bulk"` | 1 match | |
| 11 | portfolioId guard (throw/Error) | `Select-String packages/web/src/adapters/coreApiAdapter.js -Pattern "throw new Error.*portfolioId"` | ≥ 4 | |
| 12 | Test file tồn tại | `Test-Path packages/web/src/adapters/coreApiAdapter.test.js` | True | |
| 13 | Tất cả tests PASS | `cd packages/web && npx jest src/adapters/coreApiAdapter.test.js` | All PASS | |

```powershell
# DM-01 bulk review script
Write-Host "=== DM-01 Code Review ==="
$f = "packages/web/src/adapters/coreApiAdapter.js"

$methods = @("getPortfolioHoldings","getPortfolioSummary","getPortfolioAnalytics","getPortfolioTechnicals","getBulkTechnicalsBySymbols","getTrackedSymbols","getLegacyWatchlistGroups")
foreach ($m in $methods) {
  $count = (Select-String $f -Pattern $m | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '[PASS]' } else { '[FAIL]' }) $m ($count occurrences)"
}

# legacyApiGet not exported
$exported = Select-String $f -Pattern "export.*legacyApiGet"
Write-Host "$(if (-not $exported) { '[PASS]' } else { '[FAIL]' }) legacyApiGet not exported"

# portfolioId guard
$guards = (Select-String $f -Pattern "throw new Error.*portfolioId" | Measure-Object).Count
Write-Host "$(if ($guards -ge 4) { '[PASS]' } else { '[WARN]' }) portfolioId guards: $guards"

# Bulk path
$bulkPath = Select-String $f -Pattern "technicals/bulk"
Write-Host "$(if ($bulkPath) { '[PASS]' } else { '[FAIL]' }) Bulk technicals path"
```

---

## Slice DM-02 — useCoreDashboardData Hook

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | File tồn tại | `Test-Path packages/web/src/features/dashboard/useCoreDashboardData.js` | True | |
| 2 | Không import `apiClient` | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "apiClient"` | 0 | |
| 3 | Không import từ `frontend/src` | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "frontend/src"` | 0 | |
| 4 | `AbortController` dùng | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "AbortController"` | ≥ 1 | |
| 5 | `signal.aborted` hoặc `mountedRef` check | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "aborted\|mountedRef"` | ≥ 2 | |
| 6 | `refresh` trong return | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "refresh"` | ≥ 3 | |
| 7 | `coreApiAdapter` import | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "coreApiAdapter"` | ≥ 1 | |
| 8 | `alertFeed.loading` state riêng | `Select-String packages/web/src/features/dashboard/useCoreDashboardData.js -Pattern "alertFeed"` | ≥ 3 | |
| 9 | `getBulkTechnicalsBySymbols` gọi sau holdings | Code review (manual) | Phase 2 pattern | |

```powershell
# DM-02 bulk review script
Write-Host "=== DM-02 Code Review ==="
$f = "packages/web/src/features/dashboard/useCoreDashboardData.js"

$checks = @(
  @{P="apiClient"; MaxExpected=0; Label="No apiClient import"},
  @{P="frontend/src"; MaxExpected=0; Label="No frontend/src import"},
  @{P="AbortController"; MinExpected=1; Label="AbortController used"},
  @{P="aborted|mountedRef"; MinExpected=2; Label="Unmount protection"},
  @{P="refresh"; MinExpected=3; Label="refresh() exported"},
  @{P="alertFeed"; MinExpected=3; Label="alertFeed state exists"}
)

foreach ($c in $checks) {
  $count = (Select-String $f -Pattern $c.P | Measure-Object).Count
  if ($c.MaxExpected -ne $null) {
    $pass = $count -le $c.MaxExpected
  } else {
    $pass = $count -ge $c.MinExpected
  }
  Write-Host "$(if ($pass) { '[PASS]' } else { '[FAIL]' }) $($c.Label) ($count matches)"
}
```

---

## Slice DM-03 — DashboardPage.js Full-Featured

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | Không có JSX `<div ` | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "<div "` | 0 | |
| 2 | Không có JSX `<span ` | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "<span "` | 0 | |
| 3 | Không có JSX component `<[A-Z]` | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "<[A-Z][a-zA-Z]"` | 0 | |
| 4 | `createElement` dùng | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "createElement"` | ≥ 10 | |
| 5 | `renderStatsHeader` slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderStatsHeader"` | ≥ 2 | |
| 6 | `renderPositionDeck` slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderPositionDeck"` | ≥ 2 | |
| 7 | `renderAlertCenter` slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderAlertCenter"` | ≥ 2 | |
| 8 | `renderHeatmap` slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderHeatmap"` | ≥ 2 | |
| 9 | `renderBubble` slot | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "renderBubble"` | ≥ 2 | |
| 10 | Không import `apiClient` | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "apiClient"` | 0 | |
| 11 | Không import từ `frontend/src` | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "frontend/src"` | 0 | |
| 12 | Loading skeleton class | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "loading\|skeleton"` | ≥ 2 | |
| 13 | `useCoreDashboardData` import | `Select-String packages/web/src/pages/DashboardPage.js -Pattern "useCoreDashboardData"` | ≥ 1 | |
| 14 | Build PASS | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 | |

```powershell
# DM-03 bulk review script
Write-Host "=== DM-03 Code Review ==="
$f = "packages/web/src/pages/DashboardPage.js"

# JSX check
$jsxPatterns = @("<div ", "<span ", "<p ", "<ul ")
foreach ($p in $jsxPatterns) {
  $count = (Select-String $f -Pattern [regex]::Escape($p) | Measure-Object).Count
  Write-Host "$(if ($count -eq 0) { '[PASS]' } else { '[FAIL]' }) No JSX '$p' ($count found)"
}

# Slots
$slots = @("renderStatsHeader","renderPositionDeck","renderAlertCenter","renderHeatmap","renderBubble")
foreach ($s in $slots) {
  $count = (Select-String $f -Pattern $s | Measure-Object).Count
  Write-Host "$(if ($count -ge 2) { '[PASS]' } else { '[FAIL]' }) $s slot ($count occurrences)"
}

# createElement
$ce = (Select-String $f -Pattern "createElement" | Measure-Object).Count
Write-Host "$(if ($ce -ge 10) { '[PASS]' } else { '[WARN]' }) createElement usage ($ce occurrences)"
```

---

## Slice DM-04 — PackageDashboardHost.jsx

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | File tồn tại | `Test-Path frontend/src/pages/PackageDashboardHost.jsx` | True | |
| 2 | Import từ `@vninvest/web` | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "@vninvest/web"` | ≥ 1 | |
| 3 | Không import từ `packages/web/src` directly | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "packages/web/src"` | 0 | |
| 4 | Không import `apiClient` | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "apiClient"` | 0 | |
| 5 | `renderStatsHeader` inject | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "renderStatsHeader"` | ≥ 2 | |
| 6 | `renderPositionDeck` inject | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "renderPositionDeck"` | ≥ 2 | |
| 7 | `renderAlertCenter` inject | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "renderAlertCenter"` | ≥ 2 | |
| 8 | `renderHeatmap` inject | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "renderHeatmap"` | ≥ 2 | |
| 9 | `usePortfolio()` dùng để lấy portfolioId | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "usePortfolio"` | ≥ 1 | |
| 10 | `packageShellHostEnv` import | `Select-String frontend/src/pages/PackageDashboardHost.jsx -Pattern "packageShellHostEnv"` | ≥ 1 | |
| 11 | Build PASS | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 | |

```powershell
# DM-04 bulk review script
Write-Host "=== DM-04 Code Review ==="
$f = "frontend/src/pages/PackageDashboardHost.jsx"

$checks = @(
  @{P="@vninvest/web"; Min=1; Label="Import from @vninvest/web"},
  @{P="packages/web/src"; Max=0; Label="No direct packages/web/src import"},
  @{P="apiClient"; Max=0; Label="No apiClient import"},
  @{P="renderStatsHeader"; Min=2; Label="renderStatsHeader slot"},
  @{P="renderPositionDeck"; Min=2; Label="renderPositionDeck slot"},
  @{P="renderAlertCenter"; Min=2; Label="renderAlertCenter slot"},
  @{P="renderHeatmap"; Min=2; Label="renderHeatmap slot"},
  @{P="usePortfolio"; Min=1; Label="usePortfolio() for portfolioId"},
  @{P="packageShellHostEnv"; Min=1; Label="packageShellHostEnv used"}
)

foreach ($c in $checks) {
  $count = (Select-String $f -Pattern $c.P | Measure-Object).Count
  $pass = if ($c.ContainsKey("Max")) { $count -le $c.Max } else { $count -ge $c.Min }
  Write-Host "$(if ($pass) { '[PASS]' } else { '[FAIL]' }) $($c.Label)"
}
```

---

## Slice DM-05 — Route Swap

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | `PackageDashboardHost` import trong App.jsx | `Select-String frontend/src/App.jsx -Pattern "PackageDashboardHost"` | ≥ 2 | |
| 2 | Route `path="dashboard"` trỏ `PackageDashboardHost` | `Select-String frontend/src/App.jsx -Pattern "dashboard.*PackageDashboardHost"` | ≥ 1 | |
| 3 | Shadow route `dashboard/legacy` tồn tại | `Select-String frontend/src/App.jsx -Pattern "dashboard/legacy"` | ≥ 1 | |
| 4 | Build PASS | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 | |

```powershell
# DM-05 review script
Write-Host "=== DM-05 Code Review ==="
$f = "frontend/src/App.jsx"
Select-String $f -Pattern "PackageDashboardHost|dashboard/legacy|ModernDashboard"
Write-Host "---"
Write-Host "Expected: PackageDashboardHost >=2, dashboard/legacy >= 1, ModernDashboard = 1 (legacy route only)"
```

---

## Slice DM-07 — Decommission

### Checklist

| # | Check | Command | Expected | Status |
|---|-------|---------|----------|--------|
| 1 | `ModernDashboard.jsx` đã xóa | `Test-Path frontend/src/pages/modern/ModernDashboard.jsx` | False | |
| 2 | Không còn import `ModernDashboard` | `Select-String -Path frontend/src -Pattern "ModernDashboard" -Recurse` | 0 matches | |
| 3 | Shadow route `dashboard/legacy` đã xóa | `Select-String frontend/src/App.jsx -Pattern "dashboard/legacy"` | 0 | |
| 4 | Build PASS | `Push-Location ./frontend; npm run build; Pop-Location` | exit 0 | |
| 5 | `CODE_CHANGE_AUDIT_LEDGER.md` updated | `(Get-Item docs/CODE_CHANGE_AUDIT_LEDGER.md).LastWriteTime` | Hôm nay | |
| 6 | `module_tree_full.md` regenerated | `(Get-Item module_tree_full.md).LastWriteTime` | Hôm nay | |

```powershell
# DM-07 final decommission check
Write-Host "=== DM-07 Decommission Review ==="

$fileGone = -not (Test-Path "frontend/src/pages/modern/ModernDashboard.jsx")
Write-Host "$(if ($fileGone) { '[PASS]' } else { '[FAIL]' }) ModernDashboard.jsx deleted"

$refs = Select-String -Path "frontend/src" -Pattern "ModernDashboard" -Recurse -ErrorAction SilentlyContinue
Write-Host "$(if (-not $refs) { '[PASS]' } else { '[FAIL]' }) No remaining references ($($refs.Count) found)"

$shadowRoute = Select-String "frontend/src/App.jsx" -Pattern "dashboard/legacy"
Write-Host "$(if (-not $shadowRoute) { '[PASS]' } else { '[FAIL]' }) Shadow route removed"

# Build
Push-Location ./frontend; npm run build; $code = $LASTEXITCODE; Pop-Location
Write-Host "$(if ($code -eq 0) { '[PASS]' } else { '[FAIL]' }) Final build"
```
