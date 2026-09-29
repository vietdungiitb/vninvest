# RUN INTEGRATION TESTS — SaaS Full Independence

**Ngày**: 2026-05-04  
**Chạy khi**: Sau mỗi phase hoàn thành, trước khi tiếp tục phase tiếp theo

---

## Setup chung

```powershell
# Đảm bảo dev stack đang chạy
docker ps --filter name=vninvest --format "table {{.Names}}\t{{.Status}}"
# Tất cả phải healthy

$BASE = "http://localhost"

# Lấy token test (nếu đã có user)
$TOKEN = (curl -s -X POST "$BASE/api/auth/token/" `
  -H "Content-Type: application/json" `
  -d '{"email":"test@vninvest.vn","password":"testpass123"}' | ConvertFrom-Json).access
$AUTH_HEADER = "Authorization: Bearer $TOKEN"
```

---

## Suite IT-B1: Proxy Gateway Integration

```powershell
Write-Host "=== IT-B1: Proxy Gateway ===" -ForegroundColor Cyan

# IT-B1-01: Health endpoint qua proxy
$r = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health/"
if ($r -ne "200") { Write-Error "IT-B1-01 FAIL: /api/health/ → $r" } else { Write-Host "IT-B1-01 PASS" }

# IT-B1-02: Auth endpoint native (không qua proxy)
$r = curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/token/" `
  -H "Content-Type: application/json" -d '{"email":"x","password":"x"}'
if ($r -ne "400" -and $r -ne "401") { Write-Error "IT-B1-02 FAIL: auth → $r" } else { Write-Host "IT-B1-02 PASS" }

# IT-B1-03: Portfolio qua proxy → không được 502
$r = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/portfolio/portfolios/"
if ($r -eq "502" -or $r -eq "504") { Write-Error "IT-B1-03 FAIL: portfolio → $r (proxy broken)" } else { Write-Host "IT-B1-03 PASS: → $r" }

# IT-B1-04: Realtime qua proxy
$r = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/realtime/ticker/VIC/"
if ($r -ne "200") { Write-Error "IT-B1-04 FAIL: ticker → $r" } else { Write-Host "IT-B1-04 PASS" }

# IT-B1-05: Whale feed qua proxy
$r = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/realtime/whale-feed/VIC/"
if ($r -ne "200") { Write-Error "IT-B1-05 FAIL: whale-feed → $r" } else { Write-Host "IT-B1-05 PASS" }

# IT-B1-06: Core native không bị proxy
$r = curl -s "$BASE/core/v1/health" | ConvertFrom-Json
if ($r.status -ne "healthy" -and $r.status -ne "ok") { Write-Error "IT-B1-06 FAIL: core health → $($r.status)" } else { Write-Host "IT-B1-06 PASS" }

# IT-B1-07: Port 8000 không exposed
$ports = docker ps --format "{{.Ports}}" | Select-String "8000"
if ($ports) { Write-Error "IT-B1-07 FAIL: port 8000 still exposed" } else { Write-Host "IT-B1-07 PASS" }

# IT-B1-08: Admin Django vẫn hoạt động (qua nginx → backend internal)
$r = curl -s -o /dev/null -w "%{http_code}" -L "$BASE/admin/"
if ($r -ne "200" -and $r -ne "302") { Write-Error "IT-B1-08 FAIL: admin → $r" } else { Write-Host "IT-B1-08 PASS" }

Write-Host "=== IT-B1 COMPLETE ===" -ForegroundColor Green
```

---

## Suite IT-B2: Auth Native Integration

```powershell
Write-Host "=== IT-B2: Auth Native ===" -ForegroundColor Cyan

$testEmail = "it-b2-$(Get-Random -Minimum 1000 -Maximum 9999)@test.vninvest.vn"
$testPass = "IntTest123!"

# IT-B2-01: Register
$reg = curl -s -w "\n%{http_code}" -X POST "$BASE/api/auth/register/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$testEmail`",`"password`":`"$testPass`",`"username`":`"itb2test`"}"
$code = ($reg -split "`n")[-1]
if ($code -ne "201") { Write-Error "IT-B2-01 FAIL: register → $code" } else { Write-Host "IT-B2-01 PASS" }

# IT-B2-02: Email received in mailpit
Start-Sleep -Seconds 3
$mails = (curl -s "http://localhost:8025/api/v1/messages" | ConvertFrom-Json).total
if ($mails -eq 0) { Write-Warning "IT-B2-02 WARN: no email in mailpit" } else { Write-Host "IT-B2-02 PASS: $mails emails" }

# IT-B2-03: Login before verify → should fail
$login = curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/token/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$testEmail`",`"password`":`"$testPass`"}"
if ($login -eq "200") { Write-Error "IT-B2-03 FAIL: unverified user got token" } else { Write-Host "IT-B2-03 PASS: unverified login blocked" }

# IT-B2-04: Password reset request
$pr = curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/password-reset/request/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$testEmail`"}"
if ($pr -ne "200") { Write-Error "IT-B2-04 FAIL: password-reset-request → $pr" } else { Write-Host "IT-B2-04 PASS" }

Write-Host "=== IT-B2 COMPLETE ===" -ForegroundColor Green
```

---

## Suite IT-B3: Market & Realtime Integration

```powershell
Write-Host "=== IT-B3: Market & Realtime ===" -ForegroundColor Cyan

$SYMBOLS = @("VIC", "VHM", "TCB", "VCB", "FPT")

foreach ($sym in $SYMBOLS) {
    # Ticker
    $r = curl -s "$BASE/api/realtime/ticker/$sym/" | ConvertFrom-Json
    if (-not $r.price -and -not $r.close) {
        Write-Error "IT-B3-ticker-$sym FAIL: no price field"
    } else { Write-Host "IT-B3-ticker-$sym PASS: price=$($r.price ?? $r.close)" }
    
    # Stock profile
    $r2 = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/stock-management/stocks/$sym/"
    if ($r2 -ne "200") { Write-Error "IT-B3-profile-$sym FAIL: → $r2" } else { Write-Host "IT-B3-profile-$sym PASS" }
}

# Whale feed
$wf = curl -s "$BASE/api/realtime/whale-feed/VIC/" | ConvertFrom-Json
if ($null -eq $wf) { Write-Error "IT-B3-whale-feed FAIL: null response" } else { Write-Host "IT-B3-whale-feed PASS" }

# Unified alerts
$ua = curl -s -o /dev/null -w "%{http_code}" "$BASE/api/realtime/unified-alerts/"
if ($ua -ne "200" -and $ua -ne "401") { Write-Error "IT-B3-unified-alerts FAIL: → $ua" } else { Write-Host "IT-B3-unified-alerts PASS" }

Write-Host "=== IT-B3 COMPLETE ===" -ForegroundColor Green
```

---

## Suite IT-B4: Portfolio Integration (chạy sau shadow run + cutover)

```powershell
Write-Host "=== IT-B4: Portfolio ===" -ForegroundColor Cyan

# Cần token authenticated
if (-not $TOKEN) { Write-Error "TOKEN required. Run auth first."; return }

# IT-B4-01: List portfolios
$portfolios = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/portfolios/" | ConvertFrom-Json
Write-Host "IT-B4-01: Got $($portfolios.Count) portfolios"

if ($portfolios.Count -gt 0) {
    $pid = $portfolios[0].id
    
    # IT-B4-02: Portfolio summary
    $summary = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/portfolios/$pid/summary/" | ConvertFrom-Json
    if (-not $summary.total_value) { Write-Error "IT-B4-02 FAIL: no total_value" } else { Write-Host "IT-B4-02 PASS: total_value=$($summary.total_value)" }
    
    # IT-B4-03: Holdings
    $holdings = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/portfolios/$pid/holdings/" | ConvertFrom-Json
    Write-Host "IT-B4-03: Got $($holdings.Count) holdings"
    
    # IT-B4-04: Transactions
    $subs = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/subaccounts/" | ConvertFrom-Json
    if ($subs.Count -gt 0) {
        $sid = $subs[0].id
        $txns = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/subaccounts/$sid/transactions/" | ConvertFrom-Json
        Write-Host "IT-B4-04: Got $($txns.Count) transactions for subaccount $sid"
    }
}

# IT-B4-05: Watchlist
$wl = curl -s -H $AUTH_HEADER "$BASE/api/portfolio/watchlist/groups/" | ConvertFrom-Json
Write-Host "IT-B4-05: Got $($wl.Count) watchlist groups"

Write-Host "=== IT-B4 COMPLETE ===" -ForegroundColor Green
```

---

## Suite IT-B7: WebSocket Integration

```powershell
Write-Host "=== IT-B7: WebSocket ===" -ForegroundColor Cyan

# Dùng wscat hoặc Node.js test script
# Cài wscat nếu chưa có: npm install -g wscat

$wsTestScript = @"
const ws = new WebSocket('ws://localhost/ws/ticker/VIC/');
let messageCount = 0;
ws.onopen = () => console.log('CONNECTED');
ws.onmessage = (e) => {
  messageCount++;
  const data = JSON.parse(e.data);
  console.log('MSG ' + messageCount + ':', data.price ?? data.close ?? JSON.stringify(data).substr(0,50));
  if (messageCount >= 3) {
    console.log('IT-B7 PASS: Received ' + messageCount + ' messages');
    ws.close();
    process.exit(0);
  }
};
ws.onerror = (e) => { console.error('IT-B7 FAIL: WS error'); process.exit(1); };
setTimeout(() => { console.error('IT-B7 FAIL: Timeout after 60s'); process.exit(1); }, 60000);
"@
$wsTestScript | node

Write-Host "=== IT-B7 COMPLETE ===" -ForegroundColor Green
```

---

## Suite IT-FULL: Regression suite (chạy sau mỗi phase)

```powershell
Write-Host "=== REGRESSION SUITE ===" -ForegroundColor Magenta

Push-Location ./backend
../.venv/Scripts/python.exe manage.py test `
  portfolio.tests.test_whale_analytics_snapshot_api `
  portfolio.tests.test_order_flow `
  portfolio.tests.test_whale_orders_ssot_parity `
  --keepdb 2>&1 | Tee-Object -FilePath "docs/evidence/regression-test-output.txt"
Pop-Location

Push-Location ./packages/core/backend
python manage.py test --keepdb 2>&1 | Tee-Object -AppendingFile "docs/evidence/regression-test-output.txt"
Pop-Location

Write-Host "Regression output: docs/evidence/regression-test-output.txt"
Write-Host "=== REGRESSION COMPLETE ===" -ForegroundColor Magenta
```

---

## K6 Load Test (chạy trước B8)

```powershell
# Cài k6: https://k6.io/docs/getting-started/installation/

k6 run infra/load-tests/api-load.js `
  --env BASE_URL=http://localhost `
  --out json=docs/evidence/SFI-B8-k6-results.json

# Pass criteria:
# http_req_duration{p(95)} < 200ms
# error_rate < 0.01 (< 1%)
```
