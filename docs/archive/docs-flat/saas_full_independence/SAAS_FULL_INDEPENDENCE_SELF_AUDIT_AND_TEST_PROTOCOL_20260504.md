# SELF AUDIT & TEST PROTOCOL — SaaS Full Independence

**Ngày**: 2026-05-04  
**Scope**: Option B — validation protocol cho từng phase

---

## 1. Nguyên tắc validation

1. **Validation ngay sau mỗi slice** — không tích lũy nhiều slices mới validate
2. **Mỗi slice phải có evidence** trước khi đánh dấu Done trong taskboard
3. **Smoke test phải chạy được từ máy fresh** — không phụ thuộc state local
4. **Parity checks B4 là blocking gate** — không được bỏ qua hoặc rút ngắn

---

## 2. Phase B1 — Smoke test suite

Chạy toàn bộ sau khi rebuild `frontend` và `core-api`:

```powershell
# Setup
$BASE = "http://localhost"

# Test 1: nginx → core-api → proxy → legacy
curl -s "$BASE/api/health/" | ConvertFrom-Json | Select-Object status
# Expected: status = ok hoặc healthy

# Test 2: Auth vẫn hoạt động qua proxy
curl -s -X POST "$BASE/api/auth/token/" `
  -H "Content-Type: application/json" `
  -d '{"username":"testuser","password":"testpass"}' | ConvertFrom-Json | Select-Object access
# Expected: access token (hoặc 401 nếu user không tồn tại — KHÔNG phải 502)

# Test 3: Portfolio qua proxy
curl -s "$BASE/api/portfolio/portfolios/" | ConvertFrom-Json
# Expected: [] hoặc 401 — KHÔNG phải 502 hay 404

# Test 4: Realtime qua proxy
curl -s "$BASE/api/realtime/ticker/VIC/" | ConvertFrom-Json | Select-Object -First 3
# Expected: có price data

# Test 5: Whale feed qua proxy
curl -s "$BASE/api/realtime/whale-feed/VIC/" | ConvertFrom-Json | Select-Object count
# Expected: count field tồn tại

# Test 6: core-api native
curl -s "$BASE/core/v1/health" | ConvertFrom-Json
# Expected: status = healthy

# Test 7: Port 8000 không exposed
(docker ps --format "{{.Ports}}" | Select-String "8000") -eq $null
# Expected: True (không có kết quả)

# Test 8: Proxy không break admin
curl -s "$BASE/admin/" -o $null -w "%{http_code}"
# Expected: 302 (redirect to login) hoặc 200 — không phải 502
```

**Pass criteria**: Tất cả 8 tests pass. Lưu output vào evidence file.

---

## 3. Phase B2 — Auth flow test

```powershell
$BASE = "http://localhost"
$EMAIL = "testb2-$(Get-Random)@example.com"
$PASS = "TestB2Pass123"

# Test 1: Register
$regResult = curl -s -X POST "$BASE/api/auth/register/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$EMAIL`",`"password`":`"$PASS`",`"username`":`"testb2`"}" | ConvertFrom-Json
# Expected: id tồn tại, status 201

# Test 2: Check mailpit nhận email
Start-Sleep -Seconds 2
$emails = curl -s "http://localhost:8025/api/v1/messages" | ConvertFrom-Json
# Expected: $emails.total -gt 0

# Test 3: Login trước khi verify → phải fail
$loginResult = curl -s -X POST "$BASE/api/auth/token/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$EMAIL`",`"password`":`"$PASS`"}" | ConvertFrom-Json
# Expected: lỗi (account not verified)

# Test 4: Password reset request
curl -s -X POST "$BASE/api/auth/password-reset/request/" `
  -H "Content-Type: application/json" `
  -d "{`"email`":`"$EMAIL`"}" | ConvertFrom-Json
# Expected: 200 với message
```

---

## 4. Phase B3 — Parity test

```powershell
# Chạy parity comparison script
$SYMBOLS = @("VIC", "VHM", "TCB", "VCB", "FPT", "MWG", "HPG", "GAS", "VNM", "NVL",
             "MSN", "VPB", "STB", "SSI", "HDB", "ACB", "MBB", "PDR", "DXG", "CII")

$parityResults = @()
foreach ($sym in $SYMBOLS) {
    $core = curl -s "http://localhost/api/realtime/ticker/$sym/" | ConvertFrom-Json
    # Nếu đã có data trực tiếp từ legacy (trước khi cắt proxy):
    # $legacy = curl -s "http://localhost:8000/api/realtime/ticker/$sym/" | ConvertFrom-Json
    # So sánh $core.price với $legacy.price
    # Parity = abs(core.price - legacy.price) / legacy.price < 0.001
    $parityResults += @{ symbol = $sym; core_price = $core.price }
}
$parityResults | ConvertTo-Json | Out-File "docs/evidence/SFI-B3-parity-sample.json"
```

**Pass criteria**: Tất cả 20 symbols có data. Response time p95 < 200ms.

---

## 5. Phase B4 — Portfolio parity protocol

### Shadow run setup
```powershell
# Kiểm tra dual-write đang active
# Sau mỗi ngày trade, chạy script so sánh:
cd "C:\Mujoco Projects\vninvest"
.\.venv\Scripts\python.exe scripts/migrate_portfolios_to_core.py --dry-run --parity-check

# Output mong đợi:
# Legacy portfolios: 150
# Core portfolios: 150
# Matched: 149 (99.33%)
# Mismatched: 1
# P&L max diff: 0.008%
```

### Parity gate check (bắt buộc)
```powershell
# Chạy ngày 1, 2, 3
$day = 1
.\.venv\Scripts\python.exe scripts/portfolio_parity_check.py `
  --legacy-db "postgresql://postgres:devpassword@localhost:5432/vninvest" `
  --core-db "postgresql://postgres:devpassword@localhost:5433/vninvest_core" `
  --output "docs/evidence/SFI-B4-parity-day$day.json"

# Kiểm tra kết quả
$report = Get-Content "docs/evidence/SFI-B4-parity-day$day.json" | ConvertFrom-Json
if ($report.parity_score -lt 0.99) {
    Write-Error "CUTOVER BLOCKED: parity $($report.parity_score) < 0.99"
} else {
    Write-Host "PARITY OK: $($report.parity_score)"
}
```

**Hard gate**: 3 ngày liên tiếp đạt `parity_score >= 0.99` → mới được cutover.

---

## 6. Phase B7 — WebSocket test

```javascript
// Chạy trong browser console hoặc Node.js
const ws = new WebSocket('ws://localhost/ws/ticker/VIC/');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', JSON.parse(e.data));
ws.onerror = (e) => console.error('Error:', e);

// Expected trong 60s: ít nhất 3 messages với price data
setTimeout(() => ws.close(), 60000);
```

---

## 7. Pre-decommission gate checklist (B8)

Mỗi gate phải có evidence trước khi Tech Lead sign-off:

| Gate | Check | Evidence |
|------|-------|---------|
| A | Tất cả `/api/*` endpoint → 200 (không qua proxy) | `docs/evidence/SFI-B8-endpoint-check.json` |
| B | WebSocket ổn định ≥ 24h | Sentry zero WS errors |
| C | Zero 5xx errors trong 24h | Sentry error count = 0 |
| D | Portfolio parity final check ≥ 99% | `SFI-B4-parity-final.json` |
| E | Admin ops tất cả endpoints manual test pass | Test checklist signed |
| F | Backup core DB thành công ≥ 3 lần | Backup file checksums |
| G | k6 load test: p95 < 200ms at 500 VUs | `SFI-B8-k6-results.json` |

---

## 8. Regression test suite sau mỗi phase

Sau khi hoàn thành mỗi phase, chạy legacy test suites để đảm bảo không có regression:

```powershell
Push-Location ./backend
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_analytics_snapshot_api --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_order_flow --keepdb
../.venv/Scripts/python.exe manage.py test portfolio.tests.test_whale_orders_ssot_parity --keepdb
Pop-Location

Push-Location ./packages/core/backend
python manage.py test --keepdb
Pop-Location
```

**Pass criteria**: Tất cả tests pass. Không có test mới bị broken.

---

## 9. Security audit checklist (chạy một lần trước B8)

```powershell
# 1. CoreRouter block write check
docker exec vninvest-dev-core-api python -c "
from vninvest_core.db_router import CoreRouter
r = CoreRouter()
print('write legacy blocked:', not r.allow_migrate_model('legacy', None))
"
# Expected: write legacy blocked: True

# 2. ALLOWED_HOSTS không wildcard trong prod
docker exec vninvest-dev-core-api python -c "
import os; os.environ['DJANGO_DEBUG']='false'
from django.conf import settings
print('ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)
"
# Expected: list cụ thể, không phải ['*']

# 3. PAT hash dùng HMAC
grep -r "hmac" packages/core/backend/src/identity_access/ | grep -i "pat\|token"
# Expected: có kết quả (không phải plain sha256)

# 4. Không có default password trong prod compose
Select-String -Path "docker-compose.prod.yml" -Pattern "password.*=" | Where-Object { $_.Line -notmatch "\$\{" }
# Expected: không có kết quả
```
