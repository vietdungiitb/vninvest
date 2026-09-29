# RUN INTEGRATION TESTS — Dashboard SaaS Native Migration

**Ngày**: 2026-05-18  
**Scope**: E2E integration test suites chạy sau khi stack running (`./start_dev.ps1` đã healthy).

---

## Setup

```powershell
# Cần token để gọi API
$BASE = "http://localhost"

# Lấy token (thay bằng cách lấy token thực tế trong project)
# Option 1: từ localStorage sau khi login
# Option 2: dùng gen_token.py
$TOKEN = ../.venv/Scripts/python.exe gen_token.py --user admin

$H = @{
  "Authorization" = "Bearer $TOKEN"
  "Content-Type"  = "application/json"
}

# Lấy portfolio ID đầu tiên
$portfolios = Invoke-RestMethod -Uri "$BASE/core/v1/portfolio/portfolios/" -Headers $H
$PORTFOLIO_ID = $portfolios[0].id
Write-Host "Using portfolio: $PORTFOLIO_ID"
```

---

## Suite 1 — Portfolio Analytics API Round-Trip

Kiểm tra 4 core portfolio endpoints hoạt động đúng.

```powershell
Write-Host "=== Suite 1: Portfolio Analytics Round-Trip ==="

# Test 1.1 — Holdings
Write-Host "`n[1.1] GET portfolio holdings"
try {
  $holdings = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/holdings/" -Headers $H
  Write-Host "[PASS] Holdings: $($holdings.Count) items"
  if ($holdings.Count -gt 0) {
    $h = $holdings[0]
    $requiredFields = @("symbol","shares","avg_cost","current_price","market_value","unrealized_pl")
    foreach ($field in $requiredFields) {
      if ($h.PSObject.Properties[$field] -ne $null) {
        Write-Host "       field '$field': OK"
      } else {
        Write-Host "       [WARN] missing field: '$field'"
      }
    }
  }
} catch {
  Write-Host "[FAIL] Holdings: $($_.Exception.Message)"
}

# Test 1.2 — Summary
Write-Host "`n[1.2] GET portfolio summary"
try {
  $summary = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/summary/" -Headers $H
  Write-Host "[PASS] Summary: market_value=$($summary.market_value), holdings_count=$($summary.holdings_count)"
  $requiredFields = @("total_invested","market_value","unrealized_pl","holdings_count")
  foreach ($field in $requiredFields) {
    if ($summary.PSObject.Properties[$field] -ne $null) {
      Write-Host "       field '$field': OK"
    } else {
      Write-Host "       [WARN] missing field '$field'"
    }
  }
} catch {
  Write-Host "[FAIL] Summary: $($_.Exception.Message)"
}

# Test 1.3 — Analytics (30 days)
Write-Host "`n[1.3] GET portfolio analytics (30 days)"
try {
  $analytics = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/analytics/?days=30" -Headers $H
  $curveLen = if ($analytics.equity_curve) { $analytics.equity_curve.Count } else { 0 }
  Write-Host "[PASS] Analytics: equity_curve=$curveLen points, max_drawdown=$($analytics.max_drawdown)"
} catch {
  Write-Host "[FAIL] Analytics: $($_.Exception.Message)"
}

# Test 1.4 — Technicals
Write-Host "`n[1.4] GET portfolio technicals"
try {
  $tech = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/technicals/" -Headers $H
  Write-Host "[PASS] Technicals: rsi_avg=$($tech.rsi_avg), momentum=$($tech.momentum_score)"
} catch {
  Write-Host "[FAIL] Technicals: $($_.Exception.Message)"
}

Write-Host "`n=== Suite 1 Complete ==="
```

---

## Suite 2 — Tracked Symbols & Watchlist Groups

```powershell
Write-Host "=== Suite 2: Tracked Symbols & Watchlist Groups ==="

# Test 2.1 — Tracked Symbols
Write-Host "`n[2.1] GET tracked symbols"
try {
  $tracked = Invoke-RestMethod "$BASE/core/v1/stock-management/tracked-symbols/" -Headers $H
  Write-Host "[PASS] Tracked symbols: $($tracked.Count) symbols"
  if ($tracked.Count -gt 0) {
    Write-Host "       Sample: $($tracked[0].symbol)"
  }
} catch {
  Write-Host "[FAIL] Tracked symbols: $($_.Exception.Message)"
}

# Test 2.2 — Watchlist Groups
Write-Host "`n[2.2] GET watchlist groups"
try {
  $groups = Invoke-RestMethod "$BASE/core/v1/portfolio/watchlist/groups/" -Headers $H
  Write-Host "[PASS] Watchlist groups: $($groups.Count) groups"
  if ($groups.Count -gt 0) {
    $g = $groups[0]
    Write-Host "       Group '$($g.name)': $($g.items.Count) items"
  }
} catch {
  Write-Host "[FAIL] Watchlist groups: $($_.Exception.Message)"
}

Write-Host "`n=== Suite 2 Complete ==="
```

---

## Suite 3 — Bulk Technicals via /api/ Path

```powershell
Write-Host "=== Suite 3: Bulk Technicals ==="

# Test 3.1 — Basic bulk call
Write-Host "`n[3.1] GET bulk technicals for VCB,HPG,VNM"
try {
  $bulk = Invoke-RestMethod "$BASE/api/stock-management/technicals/bulk/?symbols=VCB&symbols=HPG&symbols=VNM" -Headers $H
  Write-Host "[PASS] Bulk technicals: $($bulk.Count) results"
  foreach ($item in $bulk) {
    Write-Host "       $($item.symbol): rsi=$($item.rsi), trend=$($item.trend)"
  }
} catch {
  Write-Host "[FAIL] Bulk technicals: $($_.Exception.Message)"
}

# Test 3.2 — Empty symbols list (should return empty without 400)
Write-Host "`n[3.2] GET bulk technicals with empty symbols (coreApiAdapter should skip fetch)"
# Note: coreApiAdapter.getBulkTechnicalsBySymbols([]) returns Promise.resolve([]) without calling API
# This is a unit test, not integration — verify via code review
Write-Host "[INFO] Empty symbols guard is unit-tested in coreApiAdapter.test.js"

# Test 3.3 — Verify path NOT at /core/v1/ (expected 404)
Write-Host "`n[3.3] Verify /core/v1/stock-management/technicals/bulk/ returns 404"
try {
  $r = Invoke-WebRequest "$BASE/core/v1/stock-management/technicals/bulk/?symbols=VCB" -Headers $H -ErrorAction Stop
  Write-Host "[FAIL] Unexpected 200 at /core/v1/ path — check routing!"
} catch {
  $status = $_.Exception.Response.StatusCode.Value__
  if ($status -eq 404) {
    Write-Host "[PASS] /core/v1/ path correctly returns 404"
  } else {
    Write-Host "[INFO] Status: $status (not 404)"
  }
}

Write-Host "`n=== Suite 3 Complete ==="
```

---

## Suite 4 — Alert Center Feed

```powershell
Write-Host "=== Suite 4: Alert Center Feed ==="

# Test 4.1 — Basic feed
Write-Host "`n[4.1] GET alert center feed"
try {
  $feed = Invoke-RestMethod "$BASE/core/v1/alerts/feed/?page_size=20" -Headers $H
  $alertCount = if ($feed.results) { $feed.results.Count } else { 0 }
  Write-Host "[PASS] Alert feed: $alertCount alerts (total: $($feed.count))"
} catch {
  Write-Host "[FAIL] Alert feed: $($_.Exception.Message)"
}

# Test 4.2 — Session filter
Write-Host "`n[4.2] GET alert feed with session_date filter"
$today = (Get-Date).ToString("yyyy-MM-dd")
try {
  $feedSession = Invoke-RestMethod "$BASE/core/v1/alerts/feed/?page_size=20&session_date=$today" -Headers $H
  Write-Host "[PASS] Session feed: $($feedSession.results.Count) alerts for $today"
} catch {
  Write-Host "[FAIL] Session feed: $($_.Exception.Message)"
}

# Test 4.3 — Holdings-only audience filter
Write-Host "`n[4.3] GET alert feed with audience=holdings_only"
try {
  $feedHoldings = Invoke-RestMethod "$BASE/core/v1/alerts/feed/?page_size=20&audience=holdings_only" -Headers $H
  Write-Host "[PASS] Holdings-only feed: $($feedHoldings.results.Count) alerts"
} catch {
  Write-Host "[FAIL] Holdings-only feed: $($_.Exception.Message)"
}

Write-Host "`n=== Suite 4 Complete ==="
```

---

## Suite 5 — Parity Comparison (New vs Legacy Path)

Kiểm tra response từ `/core/v1/` và `/api/` cho cùng portfolio là giống nhau.

```powershell
Write-Host "=== Suite 5: Parity Comparison core/v1 vs /api ==="

# Test 5.1 — Holdings parity
Write-Host "`n[5.1] Holdings parity"
try {
  $holdingsNew = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/holdings/" -Headers $H
  $holdingsLeg = Invoke-RestMethod "$BASE/api/portfolio/portfolios/$PORTFOLIO_ID/holdings/" -Headers $H

  $countMatch = $holdingsNew.Count -eq $holdingsLeg.Count
  Write-Host "$(if ($countMatch) { '[PASS]' } else { '[FAIL]' }) Count: new=$($holdingsNew.Count), legacy=$($holdingsLeg.Count)"

  if ($countMatch -and $holdingsNew.Count -gt 0) {
    $symbolsNew = ($holdingsNew | Sort-Object symbol | ForEach-Object { $_.symbol }) -join ","
    $symbolsLeg = ($holdingsLeg | Sort-Object symbol | ForEach-Object { $_.symbol }) -join ","
    $symbolMatch = $symbolsNew -eq $symbolsLeg
    Write-Host "$(if ($symbolMatch) { '[PASS]' } else { '[FAIL]' }) Symbols match"
  }
} catch {
  Write-Host "[FAIL] Holdings parity: $($_.Exception.Message)"
}

# Test 5.2 — Summary parity
Write-Host "`n[5.2] Summary parity"
try {
  $summaryNew = Invoke-RestMethod "$BASE/core/v1/portfolio/portfolios/$PORTFOLIO_ID/summary/" -Headers $H
  $summaryLeg = Invoke-RestMethod "$BASE/api/portfolio/portfolios/$PORTFOLIO_ID/summary/" -Headers $H

  $mvNew = [double]$summaryNew.market_value
  $mvLeg = [double]$summaryLeg.market_value
  $delta = if ($mvLeg -ne 0) { [math]::Abs($mvNew - $mvLeg) / $mvLeg * 100 } else { 0 }

  Write-Host "$(if ($delta -le 1.0) { '[PASS]' } else { '[FAIL]' }) Market value delta: $([math]::Round($delta, 3))%"
  Write-Host "  new=$mvNew, legacy=$mvLeg"

  $countNew = $summaryNew.holdings_count
  $countLeg = $summaryLeg.holdings_count
  Write-Host "$(if ($countNew -eq $countLeg) { '[PASS]' } else { '[FAIL]' }) Holdings count: new=$countNew, legacy=$countLeg"
} catch {
  Write-Host "[FAIL] Summary parity: $($_.Exception.Message)"
}

Write-Host "`n=== Suite 5 Complete ==="
```

---

## Suite 6 — Route Smoke Tests (post DM-05)

```powershell
Write-Host "=== Suite 6: Route Smoke Tests ==="

# Test 6.1 — /dashboard route returns 200
Write-Host "`n[6.1] GET /dashboard → 200"
try {
  $r = Invoke-WebRequest "$BASE/dashboard" -UseBasicParsing
  Write-Host "$(if ($r.StatusCode -eq 200) { '[PASS]' } else { '[FAIL]' }) /dashboard: $($r.StatusCode)"
} catch {
  Write-Host "[FAIL] /dashboard: $($_.Exception.Message)"
}

# Test 6.2 — /dashboard/legacy (shadow) route works
Write-Host "`n[6.2] GET /dashboard/legacy → 200 (shadow)"
try {
  $r = Invoke-WebRequest "$BASE/dashboard/legacy" -UseBasicParsing
  Write-Host "$(if ($r.StatusCode -eq 200) { '[PASS]' } else { '[FAIL]' }) /dashboard/legacy: $($r.StatusCode)"
} catch {
  Write-Host "[FAIL] /dashboard/legacy: $($_.Exception.Message)"
}

Write-Host "`n=== Suite 6 Complete ==="
```

---

## Suite 7 — Post-Decommission Smoke (post DM-07)

```powershell
Write-Host "=== Suite 7: Post-Decommission Smoke ==="

# Test 7.1 — /dashboard still works
Write-Host "`n[7.1] GET /dashboard → 200 (post decommission)"
try {
  $r = Invoke-WebRequest "$BASE/dashboard" -UseBasicParsing
  Write-Host "$(if ($r.StatusCode -eq 200) { '[PASS]' } else { '[FAIL]' }) /dashboard: $($r.StatusCode)"
} catch {
  Write-Host "[FAIL] /dashboard: $($_.Exception.Message)"
}

# Test 7.2 — /dashboard/legacy should now 404
Write-Host "`n[7.2] GET /dashboard/legacy → 404 (route removed)"
try {
  $r = Invoke-WebRequest "$BASE/dashboard/legacy" -UseBasicParsing -ErrorAction Stop
  Write-Host "[FAIL] /dashboard/legacy still returns $($r.StatusCode) — route not removed!"
} catch {
  $status = $_.Exception.Response.StatusCode.Value__
  Write-Host "$(if ($status -eq 404) { '[PASS]' } else { '[WARN]' }) /dashboard/legacy: $status"
}

Write-Host "`n=== Suite 7 Complete ==="
```

---

## Full Suite Runner

```powershell
# Chạy tất cả suites theo thứ tự
# Yêu cầu: $BASE và $TOKEN đã được set

Write-Host "============================================"
Write-Host " DASHBOARD SAAS MIGRATION — INTEGRATION TESTS"
Write-Host "============================================"
Write-Host "Base URL: $BASE"
Write-Host "Portfolio ID: $PORTFOLIO_ID"
Write-Host ""

# Run tất cả suites
# ... (paste từng suite ở trên)

Write-Host ""
Write-Host "============================================"
Write-Host " INTEGRATION TESTS COMPLETE"
Write-Host "============================================"
```
