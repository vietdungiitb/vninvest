# SELF-AUDIT & TEST PROTOCOL — Full Independence Cutover (Mục tiêu C)

**Ngày**: 2026-05-13  
**Mục đích**: Test suite tự kiểm tra cho từng slice C1–C7 trước khi sign-off  
**Cách dùng**: Chạy từng section sau khi hoàn thành slice tương ứng; không mark done nếu chưa qua hết  

---

## Conventions

```
✅ PASS — output khớp expected
❌ FAIL — output sai, cần debug trước khi tiếp tục
⚠️  WARN — output chấp nhận được nhưng cần ghi chú
```

**Token PAT cho test** (dev environment):
```powershell
# Lấy PAT từ dev DB hoặc tạo mới
Push-Location ./backend
../.venv/Scripts/python.exe manage.py shell -c "from rest_framework_simplejwt.tokens import RefreshToken; from django.contrib.auth.models import User; u=User.objects.get(username='admin'); print('TOKEN:', ...)"
Pop-Location
# Hoặc dùng PAT từ identity_access
```

---

## C1 — Ingest core-beat

### C1-T1: Beat schedule entry tồn tại

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from django.conf import settings
key = 'ingest-price-board-60s'
if key in settings.CELERY_BEAT_SCHEDULE:
    entry = settings.CELERY_BEAT_SCHEDULE[key]
    print('PASS: key found')
    print('task:', entry['task'])
    print('schedule:', entry['schedule'])
    print('queue:', entry.get('options', {}).get('queue', 'MISSING'))
else:
    print('FAIL: key not found')
"
Pop-Location
```

**Expected**:
```
PASS: key found
task: data_ingest.tasks.fetch_and_upsert_price_board
schedule: 60.0
queue: realtime_prefetch
```

---

### C1-T2: SymbolSnapshot fresh sau 90 giây

```powershell
# Chạy sau khi rebuild core-beat (chờ ~90s)
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from market_serving.models import SymbolSnapshot
from django.utils.timezone import now

latest = SymbolSnapshot.objects.order_by('-fetched_at').first()
if not latest:
    print('FAIL: No SymbolSnapshot found')
else:
    age = (now() - latest.fetched_at).seconds
    print(f'Latest snapshot: {latest.symbol} @ {latest.fetched_at}')
    print(f'Age: {age}s')
    if age < 90:
        print('PASS: snapshot fresh')
    else:
        print('WARN: snapshot stale, may need more time')
"
Pop-Location
```

**Expected**: `PASS: snapshot fresh`

---

### C1-T3: core-beat logs không có error

```powershell
docker logs vninvest-core-beat-1 --tail 30 | Select-String "ERROR|fetch_and_upsert"
```

**Expected**: Thấy `fetch_and_upsert_price_board` task được gọi mà không có `ERROR`.

---

## C2 — Realtime native routes

**Setup**: Stop backend container trước khi chạy test này

```powershell
docker compose -f docker-compose.dev.yml stop backend
```

**PAT header** (thay YOUR_PAT):
```powershell
$H = @{ "Authorization" = "Bearer YOUR_PAT" }
$BASE = "http://localhost"
```

---

### C2-T1: ticker single symbol

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/ticker/VCB/" -Headers $H
Write-Host "Status: $($r.GetType().Name)"
Write-Host "symbol: $($r.symbol)"
Write-Host "price: $($r.price)"
```

**Expected** (✅): `symbol = "VCB"`, `price` là số (không null), HTTP 200

---

### C2-T2: tickers multi-symbol

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/tickers/?symbols=VCB,HPG,MSN" -Headers $H
Write-Host "Count: $($r.Count)"
$r | ForEach-Object { Write-Host "$($_.symbol): $($_.price)" }
```

**Expected**: Count = 3, mỗi item có symbol và price

---

### C2-T3: intraday

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/intraday/VCB/" -Headers $H
Write-Host "symbol: $($r.symbol)"
Write-Host "bars count: $($r.bars.Count)"
# WARN nếu bars empty với note 'intraday_not_available_in_native'
```

**Expected** (⚠️ acceptable): HTTP 200; `bars` có thể empty với `stale: true`

---

### C2-T4: price-board

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/price-board/VCB/" -Headers $H
Write-Host "symbol: $($r.symbol)"
Write-Host "price: $($r.price)"
Write-Host "stale: $($r.stale)"
```

**Expected** (✅): HTTP 200, `price` không null

---

### C2-T5: breadth

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/breadth/VCB/" -Headers $H
Write-Host "total: $($r.total)"
Write-Host "advancing: $($r.advancing)"
Write-Host "declining: $($r.declining)"
```

**Expected** (✅): HTTP 200, `total >= 0`

---

### C2-T6: whale-feed

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/whale-feed/VCB/" -Headers $H
Write-Host "symbol: $($r.symbol)"
Write-Host "alerts count: $($r.alerts.Count)"
```

**Expected** (⚠️ acceptable): HTTP 200; alerts có thể empty nếu DB trống

---

### C2-T7: symbol-investigation

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/symbol-investigation/VCB/" -Headers $H
Write-Host "symbol: $($r.symbol)"
Write-Host "company_name: $($r.company_name)"
Write-Host "exchange: $($r.exchange)"
```

**Expected** (✅): HTTP 200, company_name và exchange có dữ liệu

---

### C2-T8: rvol

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/rvol/VCB/" -Headers $H
Write-Host "rvol: $($r.rvol)"
Write-Host "today_volume: $($r.today_volume)"
```

**Expected** (✅): HTTP 200, `rvol` là số >= 0

---

### C2-T9: depth-chart

```powershell
$r = Invoke-RestMethod "$BASE/api/realtime/depth-chart/VCB/" -Headers $H
Write-Host "bids: $($r.bids.Count)"
Write-Host "asks: $($r.asks.Count)"
```

**Expected** (⚠️ acceptable): HTTP 200; bids/asks có thể empty với note

---

### C2-T10: Verify không còn bridge import

```powershell
Select-String -Pattern "RealtimeLegacyBridgeView" -Path "packages/core/backend/src/market_serving/api_urls.py"
```

**Expected** (✅): 0 matches

---

### C2 cleanup: Start backend lại

```powershell
docker compose -f docker-compose.dev.yml start backend
```

---

## C3 — Stock-management native routes

**Setup**: Stop backend container:

```powershell
docker compose -f docker-compose.dev.yml stop backend
```

---

### C3-T1: technicals bulk

```powershell
$r = Invoke-RestMethod "$BASE/api/stock-management/technicals/bulk/?symbols=VCB,HPG" -Headers $H
Write-Host "results count: $($r.results.Count)"
$r.results | ForEach-Object { Write-Host "$($_.symbol): $($_.price)" }
```

**Expected** (✅): HTTP 200, 2 results

---

### C3-T2: stock detail

```powershell
$r = Invoke-RestMethod "$BASE/api/stock-management/stocks/VCB/" -Headers $H
Write-Host "symbol: $($r.symbol)"
Write-Host "company_name: $($r.company_name)"
```

**Expected** (✅): HTTP 200

---

### C3-T3: overview

```powershell
$r = Invoke-RestMethod "$BASE/api/stock-management/stocks/VCB/overview/" -Headers $H
Write-Host "company_name: $($r.company_name)"
Write-Host "exchange: $($r.exchange)"
```

**Expected** (✅): HTTP 200

---

### C3-T4: chart (daily prices)

```powershell
$r = Invoke-RestMethod "$BASE/api/stock-management/stocks/VCB/chart/" -Headers $H
Write-Host "results count: $($r.results.Count)"
```

**Expected** (⚠️ acceptable): HTTP 200; results có thể empty nếu DailyPrice chưa có data

---

### C3-T5 đến C3-T11: Còn lại (order-flow, news, ai-advisory-*)

```powershell
foreach ($path in @("order-flow", "news", "news/ai-summary", "ai-advisory-session", "ai-advisory-observability")) {
    try {
        $r = Invoke-RestMethod "$BASE/api/stock-management/stocks/VCB/$path/" -Headers $H -ErrorAction Stop
        Write-Host "PASS: $path → 200"
    } catch {
        Write-Host "FAIL: $path → $($_.Exception.Message)"
    }
}
```

**Expected**: Tất cả trả HTTP 200 (dữ liệu có thể empty/graceful)

---

### C3 Verify không còn bridge import

```powershell
Select-String -Pattern "StockManagementLegacyBridgeView" -Path "packages/core/backend/src/market_data/public_urls.py"
```

**Expected** (✅): 0 matches

---

### C3 cleanup

```powershell
docker compose -f docker-compose.dev.yml start backend
```

---

## C4 — Portfolio analytics

**Prerequisite**: Cần ít nhất 1 transaction seed trong dev DB. Nếu chưa có:

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from django.contrib.auth.models import User
from user_workspace.models import Portfolio, Transaction
import datetime

user = User.objects.get(username='admin')
p, _ = Portfolio.objects.get_or_create(user=user, name='Test Portfolio', defaults={'is_default': True})
Transaction.objects.get_or_create(
    portfolio=p, symbol='VCB', transaction_type='BUY',
    date=datetime.date(2026, 1, 15), price=85000, quantity=100
)
print('Seed OK: 100 shares VCB @ 85000')
"
Pop-Location
```

---

### C4-T1: holdings non-empty

```powershell
$r = Invoke-RestMethod "$BASE/api/portfolio/holdings/" -Headers $H
Write-Host "Count: $($r.Count)"
if ($r.Count -gt 0) {
    $h = $r[0]
    Write-Host "symbol: $($h.symbol)"
    Write-Host "quantity: $($h.quantity)"
    Write-Host "unrealized_pnl: $($h.unrealized_pnl)"
    Write-Host "PASS: holdings non-empty"
} else {
    Write-Host "FAIL: holdings empty"
}
```

**Expected** (✅): Count > 0, `unrealized_pnl` là số

---

### C4-T2: summary

```powershell
$r = Invoke-RestMethod "$BASE/api/portfolio/summary/" -Headers $H
Write-Host "total_value: $($r.total_value)"
Write-Host "total_pnl: $($r.total_pnl)"
if ($r.total_value -gt 0) { Write-Host "PASS" } else { Write-Host "WARN: total_value = 0" }
```

**Expected** (✅): `total_value > 0`

---

### C4-T3: equity-curve (với DailyPrice data)

```powershell
$r = Invoke-RestMethod "$BASE/api/portfolio/equity-curve/" -Headers $H
Write-Host "dates count: $($r.dates.Count)"
Write-Host "values count: $($r.values.Count)"
if ($r.dates.Count -gt 0) { Write-Host "PASS" } else { Write-Host "WARN: empty (no DailyPrice data)" }
```

**Expected** (⚠️ acceptable nếu DailyPrice trống): HTTP 200

---

## C5 — Auth email verify

### C5-T1: Missing token → 400

```powershell
try {
    $r = Invoke-RestMethod "$BASE/api/auth/verify/" -Method POST -Body '{}' -ContentType "application/json" -ErrorAction Stop
    Write-Host "FAIL: Expected 400, got 200"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASS: 400 returned for missing token"
    } else {
        Write-Host "FAIL: Got $($_.Exception.Response.StatusCode)"
    }
}
```

---

### C5-T2: Invalid token → 400

```powershell
$body = '{"token": "invalid-token-12345"}'
try {
    $r = Invoke-RestMethod "$BASE/api/auth/verify/" -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    Write-Host "FAIL: Expected 400"
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASS: 400 for invalid token"
    } else {
        Write-Host "FAIL: $($_.Exception.Response.StatusCode)"
    }
}
```

---

### C5-T3: Endpoint không 502 (không bridge về legacy)

```powershell
docker compose -f docker-compose.dev.yml stop backend
try {
    $r = Invoke-RestMethod "$BASE/api/auth/verify/" -Method POST -Body '{"token":"x"}' -ContentType "application/json" -ErrorAction Stop
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "PASS: native 400 (not 502)"
    } elseif ($_.Exception.Response.StatusCode -eq 502) {
        Write-Host "FAIL: still bridging to backend"
    }
}
docker compose -f docker-compose.dev.yml start backend
```

---

## C6 — Misc stubs

### C6-T1: SubAccount → `[]`

```powershell
$r = Invoke-RestMethod "$BASE/api/account/sub-accounts/" -Headers $H
if ($r -is [array] -and $r.Count -eq 0) {
    Write-Host "PASS: empty array []"
} else {
    Write-Host "FAIL: got $($r | ConvertTo-Json)"
}
```

---

### C6-T2: Telegram → `not_available`

```powershell
$r = Invoke-RestMethod "$BASE/api/telegram/status/" -Headers $H
if ($r.status -eq "not_available") {
    Write-Host "PASS: status = not_available"
} else {
    Write-Host "FAIL: got $($r.status)"
}
```

---

## C7 — Decommission gates

### C7-Gate-A: Không còn bridge import trong market_serving

```powershell
$matches = Select-String -Pattern "legacy_bridge_response" -Path "packages/core/backend/src/market_serving/" -Recurse
if ($matches.Count -eq 0) {
    Write-Host "PASS Gate A: 0 matches in market_serving"
} else {
    Write-Host "FAIL Gate A: $($matches.Count) matches found:"
    $matches | ForEach-Object { Write-Host $_.ToString() }
}
```

---

### C7-Gate-B: Không còn bridge import trong market_data

```powershell
$matches = Select-String -Pattern "legacy_bridge_response" -Path "packages/core/backend/src/market_data/" -Recurse
if ($matches.Count -eq 0) { Write-Host "PASS Gate B" } else { Write-Host "FAIL Gate B: $($matches.Count)" }
```

---

### C7-Gate-C: api_urls.py không còn LegacyBridge

```powershell
$m = Select-String -Pattern "LegacyBridge" -Path "packages/core/backend/src/market_serving/api_urls.py"
if (-not $m) { Write-Host "PASS Gate C" } else { Write-Host "FAIL Gate C" }
```

---

### C7-Gate-D: public_urls.py không còn LegacyBridge

```powershell
$m = Select-String -Pattern "LegacyBridge" -Path "packages/core/backend/src/market_data/public_urls.py"
if (-not $m) { Write-Host "PASS Gate D" } else { Write-Host "FAIL Gate D" }
```

---

### C7-Gate-E: Evidence files tồn tại

```powershell
$required = @("CUT-C1", "CUT-C2", "CUT-C3", "CUT-C4", "CUT-C5", "CUT-C6")
$allPass = $true
foreach ($req in $required) {
    $found = Get-ChildItem "docs/evidence" -Filter "$req*" -ErrorAction SilentlyContinue
    if ($found) {
        Write-Host "PASS Gate E: $req evidence found"
    } else {
        Write-Host "FAIL Gate E: $req evidence MISSING"
        $allPass = $false
    }
}
if ($allPass) { Write-Host "Gate E: ALL PASS" }
```

---

### C7-Gate-F: SymbolSnapshot fresh

```powershell
Push-Location ./packages/core/backend
..\..\..\.venv\Scripts\python.exe manage.py shell -c "
from market_serving.models import SymbolSnapshot
from django.utils.timezone import now
latest = SymbolSnapshot.objects.order_by('-fetched_at').first()
if not latest:
    print('FAIL Gate F: no snapshot')
else:
    age = (now() - latest.fetched_at).seconds
    print(f'Age: {age}s')
    if age < 90:
        print('PASS Gate F: snapshot fresh')
    else:
        print('FAIL Gate F: snapshot stale')
"
Pop-Location
```

---

### C7-Gate-G: Smoke test với backend STOPPED

```powershell
docker compose -f docker-compose.dev.yml stop backend backend-worker
Start-Sleep -Seconds 5

$allPass = $true
$endpoints = @(
    "$BASE/api/realtime/ticker/VCB/",
    "$BASE/api/realtime/tickers/?symbols=VCB",
    "$BASE/api/stock-management/stocks/VCB/",
    "$BASE/api/stock-management/stocks/VCB/overview/",
    "$BASE/api/portfolio/holdings/",
    "$BASE/api/account/sub-accounts/",
    "$BASE/api/telegram/status/"
)
foreach ($ep in $endpoints) {
    try {
        $r = Invoke-RestMethod $ep -Headers $H -ErrorAction Stop
        Write-Host "PASS Gate G: $ep → 200"
    } catch {
        Write-Host "FAIL Gate G: $ep → $($_.Exception.Message)"
        $allPass = $false
    }
}
if ($allPass) { Write-Host "Gate G: ALL PASS — safe to decommission" }
```

---

### C7-T1: legacy_http_bridge.py đã xóa

```powershell
if (-not (Test-Path "packages/core/backend/src/vninvest_core/legacy_http_bridge.py")) {
    Write-Host "PASS C7-T1: bridge file deleted"
} else {
    Write-Host "FAIL C7-T1: bridge file still exists"
}
```

---

### C7-T2: Không còn import legacy_http_bridge trong source

```powershell
$m = Select-String -Pattern "legacy_http_bridge" -Path "packages/core/backend/src/" -Recurse -Include "*.py"
if ($m.Count -eq 0) {
    Write-Host "PASS C7-T2: 0 imports found"
} else {
    Write-Host "FAIL C7-T2: $($m.Count) imports found:"
    $m | ForEach-Object { Write-Host $_.ToString() }
}
```

---

### C7-T3: Docker state sau decommission

```powershell
$running = docker ps --format "{{.Names}}" | Select-String "backend"
if (-not $running) {
    Write-Host "PASS C7-T3: No backend containers running"
} else {
    Write-Host "FAIL C7-T3: Containers still running: $running"
}
```

---

### C7-T4: Final smoke test sau rebuild

```powershell
docker compose -f docker-compose.dev.yml up -d --build
Start-Sleep -Seconds 15  # Chờ stack khởi động

$criticalEndpoints = @(
    "$BASE/api/realtime/ticker/VCB/",
    "$BASE/api/stock-management/stocks/VCB/",
    "$BASE/api/portfolio/holdings/",
    "$BASE/api/account/sub-accounts/"
)
foreach ($ep in $criticalEndpoints) {
    try {
        Invoke-RestMethod $ep -Headers $H -ErrorAction Stop | Out-Null
        Write-Host "PASS: $ep"
    } catch {
        Write-Host "FAIL: $ep → $($_.Exception.Message)"
    }
}
```

---

## Pass criteria summary

| Slice | Mandatory passes | Acceptable warns |
|-------|-----------------|-----------------|
| C1 | C1-T1, C1-T2 | C1-T3 warn OK |
| C2 | C2-T1, C2-T2, C2-T4, C2-T5, C2-T10 | C2-T3 (intraday empty), C2-T6 (whale empty), C2-T9 (depth empty) |
| C3 | C3-T1, C3-T2, C3-T3, C3 bridge import check | C3-T4 (chart empty), C3-T5+ graceful |
| C4 | C4-T1 (holdings non-empty) | C4-T3 (equity-curve empty if no DailyPrice) |
| C5 | C5-T1, C5-T2, C5-T3 | — |
| C6 | C6-T1, C6-T2 | — |
| C7 | Gate A–G ALL, C7-T1, C7-T2, C7-T3, C7-T4 | — (no acceptable fails at C7) |

---

*Protocol này là self-contained. Developer chạy từng section sau khi code xong slice tương ứng.*
