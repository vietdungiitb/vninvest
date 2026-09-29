# SELF AUDIT & TEST PROTOCOL — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Scope**: Validation protocol sau mỗi slice — chạy ngay, không tích lũy.

---

## 1. Nguyên tắc validation

1. **Validate ngay sau mỗi slice** — không tích lũy nhiều slices mới validate.
2. Mỗi slice phải có output evidence (command output + screenshot nếu UI) trước khi đánh dấu DONE.
3. `npm run build` phải pass sau mỗi frontend slice — không để broken build.
4. **DM-06 gate là blocking** — không decommission bất cứ thứ gì trước khi 3 ngày parity PASS.
5. Không dùng `--force` hay bỏ qua gate nào trong quá trình decommission.

---

## 2. DM-00 — Fix 5 Dashboard Bugs

### Validation commands

```powershell
# 1. Verify useAlertCenterFeed return keys
Select-String -Path "frontend/src/hooks/useAlertCenterFeed.js" -Pattern "currentUnifiedPage|hasPreviousUnifiedPage|hasLastUnifiedPage" | Measure-Object -Line
# Expected: >= 3 lines (3 keys trong return object)

# 2. Verify audience filter enum
Select-String -Path "frontend/src/components/UnifiedAlertCenter.jsx" -Pattern "holdings_only|watchlist_only"
# Expected: 2 matches

# 3. Verify session_date in client.js
Select-String -Path "frontend/src/api/client.js" -Pattern "session_date"
# Expected: >= 1 match trong getAlertCenterFeed

# 4. Verify i18n fix
Select-String -Path "frontend/src/components/modern/SmartStatsHeader.jsx" -Pattern "breadthLabel"
# Expected: >= 1 match

Select-String -Path "frontend/src/i18n/vi.js" -Pattern "breadthLabel"
# Expected: 1 match

# 5. Build validation
Push-Location ./frontend
npm run build
Pop-Location
# Expected: exit 0
```

| Check | Expected | Status |
|-------|----------|--------|
| `currentUnifiedPage` trong useAlertCenterFeed return | ✓ | |
| `hasPreviousUnifiedPage` trong useAlertCenterFeed return | ✓ | |
| `hasLastUnifiedPage` trong useAlertCenterFeed return | ✓ | |
| `'holdings_only'` trong UnifiedAlertCenter | ✓ | |
| `'watchlist_only'` trong UnifiedAlertCenter | ✓ | |
| `session_date` trong getAlertCenterFeed của client.js | ✓ | |
| `t('dashboard.breadthLabel')` trong SmartStatsHeader | ✓ | |
| `breadthLabel` key trong vi.js | ✓ | |
| `npm run build` exit 0 | ✓ | |

---

## 3. DM-01 — coreApiAdapter Portfolio Analytics Methods

### Validation commands

```powershell
# 1. Verify 7 methods tồn tại trong factory return
$methods = @(
  "getPortfolioHoldings",
  "getPortfolioSummary",
  "getPortfolioAnalytics",
  "getPortfolioTechnicals",
  "getBulkTechnicalsBySymbols",
  "getTrackedSymbols",
  "getLegacyWatchlistGroups"
)
foreach ($m in $methods) {
  $hit = Select-String -Path "packages/web/src/adapters/coreApiAdapter.js" -Pattern $m
  Write-Host "$(if ($hit) { '[PASS]' } else { '[FAIL]' }) $m"
}

# 2. Verify legacyApiGet helper tồn tại
Select-String -Path "packages/web/src/adapters/coreApiAdapter.js" -Pattern "legacyApiGet|legacyApi|/api/"
# Expected: >= 2 matches

# 3. Verify getBulkTechnicalsBySymbols dùng /api/ path
Select-String -Path "packages/web/src/adapters/coreApiAdapter.js" -Pattern "stock-management/technicals/bulk"
# Expected: 1 match (trong legacyApiGet call)

# 4. Chạy tests
Push-Location ./packages/web
# Tùy setup test runner (jest hoặc vitest)
npx jest src/adapters/coreApiAdapter.test.js --no-coverage 2>&1 | Tail -20
Pop-Location
# Expected: All tests PASS
```

| Check | Expected | Status |
|-------|----------|--------|
| `getPortfolioHoldings` tồn tại | ✓ | |
| `getPortfolioSummary` tồn tại | ✓ | |
| `getPortfolioAnalytics` tồn tại | ✓ | |
| `getPortfolioTechnicals` tồn tại | ✓ | |
| `getBulkTechnicalsBySymbols` tồn tại | ✓ | |
| `getTrackedSymbols` tồn tại | ✓ | |
| `getLegacyWatchlistGroups` tồn tại | ✓ | |
| `legacyApiGet` helper (private) tồn tại | ✓ | |
| `getBulkTechnicalsBySymbols([])` không fetch | ✓ | |
| Tất cả 9+ test cases PASS | ✓ | |

---

## 4. DM-02 — useCoreDashboardData Hook

### Validation commands

```powershell
# 1. Verify file tồn tại
Test-Path "packages/web/src/features/dashboard/useCoreDashboardData.js"
# Expected: True

# 2. Verify không import apiClient
$hit = Select-String -Path "packages/web/src/features/dashboard/useCoreDashboardData.js" -Pattern "apiClient"
if ($hit) { Write-Host "[FAIL] apiClient import found!" } else { Write-Host "[PASS] No apiClient import" }

# 3. Verify AbortController dùng
Select-String -Path "packages/web/src/features/dashboard/useCoreDashboardData.js" -Pattern "AbortController"
# Expected: >= 1 match

# 4. Verify refresh() exported
Select-String -Path "packages/web/src/features/dashboard/useCoreDashboardData.js" -Pattern "refresh"
# Expected: >= 1 match

# 5. Verify coreApiAdapter import
Select-String -Path "packages/web/src/features/dashboard/useCoreDashboardData.js" -Pattern "coreApiAdapter"
# Expected: >= 1 match
```

| Check | Expected | Status |
|-------|----------|--------|
| File tồn tại tại đúng path | ✓ | |
| Không import `apiClient` | ✓ | |
| `AbortController` được dùng | ✓ | |
| `refresh()` trong return object | ✓ | |
| `coreApiAdapter` được import và dùng | ✓ | |
| `portfolioId === null` → không fetch | ✓ (code review) | |
| `mountedRef` pattern để tránh stale state | ✓ (code review) | |

---

## 5. DM-03 — DashboardPage.js Full-Featured

### Validation commands

```powershell
# 1. Verify không có JSX
$jsxHits = Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "<[A-Z][a-zA-Z]|<div |<span |<p |<ul "
if ($jsxHits) {
  Write-Host "[FAIL] JSX syntax found!"
  $jsxHits | ForEach-Object { Write-Host "  Line $($_.LineNumber): $($_.Line)" }
} else {
  Write-Host "[PASS] No JSX syntax"
}

# 2. Verify createElement usage
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "createElement" | Measure-Object -Line
# Expected: >= 10 occurrences

# 3. Verify 5 slot props
$slots = @("renderStatsHeader", "renderPositionDeck", "renderAlertCenter", "renderHeatmap", "renderBubble")
foreach ($s in $slots) {
  $hit = Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern $s
  Write-Host "$(if ($hit) { '[PASS]' } else { '[FAIL]' }) $s slot"
}

# 4. Verify loading skeleton
Select-String -Path "packages/web/src/pages/DashboardPage.js" -Pattern "loading|skeleton"
# Expected: >= 2 matches

# 5. Build validation
Push-Location ./frontend; npm run build; Pop-Location
# Expected: exit 0
```

| Check | Expected | Status |
|-------|----------|--------|
| Không có JSX syntax (`<` element) | ✓ | |
| `createElement` được dùng ≥ 10 lần | ✓ | |
| `renderStatsHeader` slot tồn tại | ✓ | |
| `renderPositionDeck` slot tồn tại | ✓ | |
| `renderAlertCenter` slot tồn tại | ✓ | |
| `renderHeatmap` slot tồn tại | ✓ | |
| `renderBubble` slot tồn tại | ✓ | |
| Loading skeleton UI tồn tại | ✓ | |
| Error state hiển thị message | ✓ | |
| Build PASS | ✓ | |

---

## 6. DM-04 — PackageDashboardHost.jsx

### Validation commands

```powershell
# 1. Verify file tồn tại
Test-Path "frontend/src/pages/PackageDashboardHost.jsx"
# Expected: True

# 2. Verify import từ @vninvest/web, không từ packages/web/src
Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "@vninvest/web"
# Expected: 1+ match

$badImport = Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "packages/web/src"
if ($badImport) { Write-Host "[FAIL] Direct packages/web/src import found!" } else { Write-Host "[PASS]" }

# 3. Verify 4 render props
$slots = @("renderStatsHeader", "renderPositionDeck", "renderAlertCenter", "renderHeatmap")
foreach ($s in $slots) {
  $hit = Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern $s
  Write-Host "$(if ($hit) { '[PASS]' } else { '[FAIL]' }) $s"
}

# 4. Verify không import apiClient
$apiclient = Select-String -Path "frontend/src/pages/PackageDashboardHost.jsx" -Pattern "apiClient"
if ($apiclient) { Write-Host "[FAIL] apiClient import found!" } else { Write-Host "[PASS] No apiClient" }

# 5. Build validation
Push-Location ./frontend; npm run build; Pop-Location
```

| Check | Expected | Status |
|-------|----------|--------|
| File tồn tại | ✓ | |
| Import từ `@vninvest/web` (không phải trực tiếp) | ✓ | |
| `renderStatsHeader`, `renderPositionDeck`, `renderAlertCenter`, `renderHeatmap` | ✓ | |
| Không import `apiClient` | ✓ | |
| `portfolioId` từ `usePortfolio()` | ✓ | |
| `packageShellHostEnv` được dùng | ✓ | |
| Build PASS | ✓ | |

---

## 7. DM-05 — Route Swap + Smoke Test

### Validation commands

```powershell
# 1. Verify route changes in App.jsx
Select-String -Path "frontend/src/App.jsx" -Pattern "PackageDashboardHost"
# Expected: >= 2 (import + route)

Select-String -Path "frontend/src/App.jsx" -Pattern "dashboard/legacy"
# Expected: 1 (shadow route)

# 2. Build và start stack
Push-Location ./frontend; npm run build; Pop-Location
.\start_dev.ps1

# 3. Smoke test sau khi stack healthy
$BASE = "http://localhost"
# Check /dashboard loads
$response = Invoke-WebRequest -Uri "$BASE/dashboard" -UseBasicParsing
Write-Host "Dashboard status: $($response.StatusCode)"
# Expected: 200

# 4. API health check — portfolio endpoint
$TOKEN = "<your token>"
$H = @{ "Authorization" = "Bearer $TOKEN" }
$holdings = Invoke-RestMethod -Uri "$BASE/core/v1/portfolio/portfolios/1/holdings/" -Headers $H
Write-Host "Holdings count: $($holdings.count)"
# Expected: > 0 (nếu có portfolio data)
```

**Manual smoke test checklist**:

| Item | Check |
|------|-------|
| `/dashboard` URL không 404 | ✓ |
| Stats header hiển thị market_value | ✓ |
| Holdings list/position deck có data | ✓ |
| Alert center hiển thị alerts | ✓ |
| Heatmap hiển thị (không blank) | ✓ |
| Console `F12` → 0 JS errors | ✓ |
| `/dashboard/legacy` vẫn render bình thường | ✓ |
| Network tab: `/core/v1/portfolio/...` calls thành công | ✓ |

---

## 8. DM-06 — Parity Validation (3-day protocol)

```powershell
# Chạy mỗi ngày trong 3 ngày trade — append kết quả vào parity report
$DATE = Get-Date -Format "yyyy-MM-dd"
$BASE = "http://localhost"
$TOKEN = "<your admin token>"
$H = @{ "Authorization" = "Bearer $TOKEN"; "Content-Type" = "application/json" }
$PORTFOLIO_ID = 1

Write-Host "=== Parity Check $DATE ==="

# 1. Portfolio summary từ core/v1/ (new dashboard path)
$summaryNew = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/summary/" -Headers $H

# 2. Portfolio summary từ /api/ (legacy compat path — same data)
$summaryLegacy = Invoke-RestMethod "$BASE/api/portfolio/portfolios/$PORTFOLIO_ID/summary/" -Headers $H

# 3. Holdings từ cả 2 paths
$holdingsNew = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/holdings/" -Headers $H
$holdingsLegacy = Invoke-RestMethod "$BASE/api/portfolio/portfolios/$PORTFOLIO_ID/holdings/" -Headers $H

# Compare
$marketValueDeltaPct = [math]::Abs($summaryNew.market_value - $summaryLegacy.market_value) / [math]::Max(1, $summaryLegacy.market_value) * 100
$holdingsMatch = $holdingsNew.count -eq $holdingsLegacy.count

Write-Host "Market value delta: $marketValueDeltaPct%"
Write-Host "Holdings match: $holdingsMatch ($($holdingsNew.count) vs $($holdingsLegacy.count))"
Write-Host "Summary market_value (new): $($summaryNew.market_value)"
Write-Host "Summary market_value (legacy): $($summaryLegacy.market_value)"

# Pass/fail
$PASS = ($marketValueDeltaPct -le 1.0) -and $holdingsMatch
Write-Host "=== PARITY $(if ($PASS) { 'PASS' } else { 'FAIL' }) for $DATE ==="
```

**Parity report format** (append sau mỗi ngày):

```markdown
## Ngày 1 — 2026-MM-DD
- Market value: new=X, legacy=X, delta=Y%
- Holdings count: new=N, legacy=N, match=true/false
- Status: PASS / FAIL
- Screenshot: [link]

## Ngày 2 — 2026-MM-DD
...

## Ngày 3 — 2026-MM-DD
...

## Sign-off
- Tech Lead: [name] — [date] — APPROVED
```

---

## 9. DM-07 — Decommission Validation

```powershell
# Verify tất cả pre-conditions trước khi delete

# Gate E: Clean build
Push-Location ./frontend; npm run build; Pop-Location

# Gate G: Sau khi delete — verify không còn reference
$hits = Select-String -Path "frontend/src" -Pattern "ModernDashboard" -Recurse
if ($hits) {
  Write-Host "[FAIL] Còn reference đến ModernDashboard:"
  $hits | ForEach-Object { Write-Host "  $($_.Filename):$($_.LineNumber)" }
} else {
  Write-Host "[PASS] Không còn reference nào"
}

# Verify file đã xóa
if (Test-Path "frontend/src/pages/modern/ModernDashboard.jsx") {
  Write-Host "[FAIL] File vẫn còn tồn tại!"
} else {
  Write-Host "[PASS] File đã được xóa"
}

# Final build verify
Push-Location ./frontend; npm run build; Pop-Location
Write-Host "Final build: $(if ($LASTEXITCODE -eq 0) { 'PASS' } else { 'FAIL' })"

# Verify governance artifacts updated
$LEDGER_UPDATED = (Get-Item "docs/CODE_CHANGE_AUDIT_LEDGER.md").LastWriteTime -gt (Get-Date).AddMinutes(-30)
Write-Host "Ledger updated: $LEDGER_UPDATED"

$MODULE_TREE_UPDATED = (Get-Item "module_tree_full.md").LastWriteTime -gt (Get-Date).AddMinutes(-30)
Write-Host "module_tree_full.md updated: $MODULE_TREE_UPDATED"
```

| Check | Expected | Status |
|-------|----------|--------|
| DM-06 parity report tồn tại với 3 ngày data | ✓ | |
| Tech Lead sign-off trong parity report | ✓ | |
| `ModernDashboard.jsx` đã bị xóa | ✓ | |
| Không còn reference `ModernDashboard` trong codebase | ✓ | |
| Build PASS sau khi xóa | ✓ | |
| `CODE_CHANGE_AUDIT_LEDGER.md` updated | ✓ | |
| `PROGRESS_DASHBOARD.md` updated | ✓ | |
| `module_tree_full.md` regenerated | ✓ | |
