# RUN SPEC AUDIT — SaaS Full Independence

**Ngày**: 2026-05-04  
**Dùng khi**: Audit code implementation có đúng spec không — chạy trước mỗi phase gate

---

## Cách dùng

Chạy từng section cho phase cần audit. Mỗi check ghi kết quả:
- `PASS` — implementation khớp spec
- `FAIL` — implementation không khớp spec (cần fix trước tiếp tục)
- `PARTIAL` — khớp một phần (cần note và quyết định)

---

## SPEC-AUDIT-B1: Proxy Gateway

```powershell
Write-Host "=== SPEC AUDIT B1 ===" -ForegroundColor Yellow

# SA-B1-01: legacy_proxy.py tồn tại
$exists = Test-Path "packages/core/backend/src/vninvest_core/legacy_proxy.py"
Write-Host "SA-B1-01 (proxy file exists): $(if ($exists) { 'PASS' } else { 'FAIL' })"

# SA-B1-02: httpx trong requirements
$httpx = Select-String -Path "packages/core/backend/requirements.txt" -Pattern "httpx"
Write-Host "SA-B1-02 (httpx in requirements): $(if ($httpx) { 'PASS' } else { 'FAIL' })"

# SA-B1-03: Proxy route cuối trong urls.py
$urlContent = Get-Content "packages/core/backend/src/vninvest_core/urls.py" -Raw
$proxyRoute = $urlContent -match "api/<path:remaining>"
$proxyIsLast = ($urlContent.IndexOf("api/<path:remaining>")) -gt ($urlContent.LastIndexOf("core/v1/"))
Write-Host "SA-B1-03 (proxy route exists): $(if ($proxyRoute) { 'PASS' } else { 'FAIL' })"
Write-Host "SA-B1-04 (proxy route is last): $(if ($proxyIsLast) { 'PASS' } else { 'FAIL' })"

# SA-B1-05: LEGACY_BACKEND_URL trong settings
$settings = Select-String -Path "packages/core/backend/src/vninvest_core/settings.py" -Pattern "LEGACY_BACKEND_URL"
Write-Host "SA-B1-05 (LEGACY_BACKEND_URL in settings): $(if ($settings) { 'PASS' } else { 'FAIL' })"

# SA-B1-06: nginx /api/ → core-api
$nginx = Get-Content "frontend/docker/nginx.conf" -Raw
$nginxOk = $nginx -match "location /api/" -and $nginx -match "core-api:8100" -and (-not ($nginx -match "location /api/[\s\S]*?backend:8000"))
Write-Host "SA-B1-06 (nginx /api/ → core-api): $(if ($nginxOk) { 'PASS' } else { 'FAIL' })"

# SA-B1-07: Port 8000 không exposed trong dev compose
$compose = Get-Content "docker-compose.dev.yml" -Raw
$port8000 = $compose -match '"8000:8000"'
Write-Host "SA-B1-07 (port 8000 not exposed): $(if (-not $port8000) { 'PASS' } else { 'FAIL' })"

# SA-B1-08: frontend không depends_on backend
$depOnBackend = $compose -match "depends_on[\s\S]*?backend[\s\S]*?service_healthy"
Write-Host "SA-B1-08 (frontend no depends_on backend): $(if (-not $depOnBackend) { 'PASS' } else { 'FAIL - check frontend.depends_on' })"

# SA-B1-09: Hop-by-hop headers strip trong proxy
$proxy = Get-Content "packages/core/backend/src/vninvest_core/legacy_proxy.py" -Raw
$hopByHop = $proxy -match "hop.by.hop|HOP_BY_HOP|connection|keep-alive|transfer-encoding"
Write-Host "SA-B1-09 (hop-by-hop handling): $(if ($hopByHop) { 'PASS' } else { 'FAIL' })"

# SA-B1-10: Timeout config
$timeoutOk = $proxy -match "timeout|connect.*5|read.*120"
Write-Host "SA-B1-10 (timeout configured): $(if ($timeoutOk) { 'PASS' } else { 'FAIL' })"

Write-Host "=== SPEC AUDIT B1 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B2: Auth Native

```powershell
Write-Host "=== SPEC AUDIT B2 ===" -ForegroundColor Yellow

$authViews = Get-Content "packages/core/backend/src/identity_access/views_auth.py" -Raw
$compatUrls = Get-Content "packages/core/backend/src/identity_access/compat_urls.py" -Raw

# SA-B2-01: Register view exists
Write-Host "SA-B2-01 (register view): $(if ($authViews -match 'register') { 'PASS' } else { 'FAIL' })"

# SA-B2-02: Register route exists
Write-Host "SA-B2-02 (register route): $(if ($compatUrls -match 'register') { 'PASS' } else { 'FAIL' })"

# SA-B2-03: Email backend config
$settings = Get-Content "packages/core/backend/src/vninvest_core/settings.py" -Raw
Write-Host "SA-B2-03 (EMAIL_HOST config): $(if ($settings -match 'EMAIL_HOST') { 'PASS' } else { 'FAIL' })"

# SA-B2-04: Verify email endpoint
Write-Host "SA-B2-04 (verify-email): $(if ($compatUrls -match 'verify-email') { 'PASS' } else { 'FAIL' })"

# SA-B2-05: Password reset endpoints
Write-Host "SA-B2-05 (password-reset): $(if ($compatUrls -match 'password-reset') { 'PASS' } else { 'FAIL' })"

# SA-B2-06: Migration script exists
$migScript = Test-Path "scripts/migrate_users_to_core.py"
Write-Host "SA-B2-06 (migration script): $(if ($migScript) { 'PASS' } else { 'FAIL' })"

# SA-B2-07: No hardcoded credentials
$noHardcode = -not ($authViews -match 'password\s*=\s*"[^"]+"')
Write-Host "SA-B2-07 (no hardcoded passwords): $(if ($noHardcode) { 'PASS' } else { 'FAIL - BLOCKER' })"

Write-Host "=== SPEC AUDIT B2 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B4: Portfolio (chạy trước cutover)

```powershell
Write-Host "=== SPEC AUDIT B4 ===" -ForegroundColor Yellow

$wsModels = Get-Content "packages/core/backend/src/user_workspace/models.py" -Raw
$wsViews = Get-Content "packages/core/backend/src/user_workspace/views.py" -Raw -ErrorAction SilentlyContinue

# SA-B4-01: SubAccount model
Write-Host "SA-B4-01 (SubAccount model): $(if ($wsModels -match 'class SubAccount') { 'PASS' } else { 'FAIL' })"

# SA-B4-02: Transaction model
Write-Host "SA-B4-02 (Transaction model): $(if ($wsModels -match 'class Transaction') { 'PASS' } else { 'FAIL' })"

# SA-B4-03: DecimalField cho price (không FloatField)
$noFloat = -not ($wsModels -match 'FloatField.*price|price.*FloatField')
Write-Host "SA-B4-03 (DecimalField for price): $(if ($noFloat) { 'PASS' } else { 'FAIL - use DecimalField' })"

# SA-B4-04: User scope filter trong views
$userFilter = $wsViews -match "request\.user|user=request\.user"
Write-Host "SA-B4-04 (user scope filter): $(if ($userFilter) { 'PASS' } else { 'FAIL - BLOCKER: user data exposure risk' })"

# SA-B4-05: Migration script exists
$migScript = Test-Path "scripts/migrate_portfolios_to_core.py"
Write-Host "SA-B4-05 (portfolio migration script): $(if ($migScript) { 'PASS' } else { 'FAIL' })"

# SA-B4-06: Parity report file từ shadow run
$parityFiles = Get-ChildItem "docs/evidence" -Filter "SFI-B4-parity-day*.json" -ErrorAction SilentlyContinue
Write-Host "SA-B4-06 (parity reports: $($parityFiles.Count) days): $(if ($parityFiles.Count -ge 3) { 'PASS' } else { 'FAIL - need 3 days' })"

# SA-B4-07: Parity >= 0.99 trong tất cả reports
if ($parityFiles.Count -ge 3) {
    $allPass = $true
    foreach ($f in $parityFiles) {
        $report = Get-Content $f.FullName | ConvertFrom-Json
        if ($report.parity_score -lt 0.99) {
            Write-Error "SA-B4-07 FAIL: $($f.Name) parity=$($report.parity_score) < 0.99"
            $allPass = $false
        }
    }
    Write-Host "SA-B4-07 (parity >= 0.99): $(if ($allPass) { 'PASS' } else { 'FAIL - CUTOVER BLOCKED' })"
}

Write-Host "=== SPEC AUDIT B4 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B5: AI Advisory

```powershell
Write-Host "=== SPEC AUDIT B5 ===" -ForegroundColor Yellow

$advModels = Get-Content "packages/core/backend/src/advisory/models.py" -Raw -ErrorAction SilentlyContinue
$advViews = Get-Content "packages/core/backend/src/advisory/views.py" -Raw -ErrorAction SilentlyContinue
$settings = Get-Content "packages/core/backend/src/vninvest_core/settings.py" -Raw

# SA-B5-01: AdvisorySession model
Write-Host "SA-B5-01 (AdvisorySession model): $(if ($advModels -match 'AdvisorySession') { 'PASS' } else { 'FAIL' })"

# SA-B5-02: AdvisoryComponent model
Write-Host "SA-B5-02 (AdvisoryComponent model): $(if ($advModels -match 'AdvisoryComponent') { 'PASS' } else { 'FAIL' })"

# SA-B5-03: OPENAI_API_KEY từ env (không hardcode)
$noHardcodeKey = -not ($settings -match "OPENAI_API_KEY\s*=\s*['\"]sk-")
Write-Host "SA-B5-03 (OPENAI_API_KEY from env): $(if ($noHardcodeKey) { 'PASS' } else { 'FAIL - BLOCKER' })"

# SA-B5-04: Token budget check
$budgetCheck = $advViews -match "token.*budget|budget.*token|TokenBudget"
Write-Host "SA-B5-04 (token budget check): $(if ($budgetCheck) { 'PASS' } else { 'PARTIAL - add if needed' })"

Write-Host "=== SPEC AUDIT B5 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B6: Admin Ops

```powershell
Write-Host "=== SPEC AUDIT B6 ===" -ForegroundColor Yellow

$adminViews = Get-Content "packages/core/backend/src/ops_audit/views.py" -Raw -ErrorAction SilentlyContinue
$signalAdmin = Get-Content "packages/core/backend/src/signal_intelligence/admin_views.py" -Raw -ErrorAction SilentlyContinue

# SA-B6-01: IsCoreOperator permission in admin views
$opsPerm = $adminViews -match "IsCoreOperator"
$sigPerm = $signalAdmin -match "IsCoreOperator"
Write-Host "SA-B6-01 (IsCoreOperator in ops_audit): $(if ($opsPerm) { 'PASS' } else { 'FAIL' })"
Write-Host "SA-B6-02 (IsCoreOperator in signal_admin): $(if ($sigPerm) { 'PASS' } else { 'FAIL' })"

Write-Host "=== SPEC AUDIT B6 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B7: WebSocket

```powershell
Write-Host "=== SPEC AUDIT B7 ===" -ForegroundColor Yellow

$asgi = Get-Content "packages/core/backend/src/vninvest_core/asgi.py" -Raw -ErrorAction SilentlyContinue
$consumers = Get-Content "packages/core/backend/src/signal_intelligence/consumers.py" -Raw -ErrorAction SilentlyContinue
$reqs = Get-Content "packages/core/backend/requirements.txt" -Raw

# SA-B7-01: channels in requirements
Write-Host "SA-B7-01 (channels in requirements): $(if ($reqs -match 'channels') { 'PASS' } else { 'FAIL' })"

# SA-B7-02: ASGI config
Write-Host "SA-B7-02 (ASGI ProtocolTypeRouter): $(if ($asgi -match 'ProtocolTypeRouter') { 'PASS' } else { 'FAIL' })"

# SA-B7-03: Consumer disconnect handler
Write-Host "SA-B7-03 (disconnect handler): $(if ($consumers -match 'async def disconnect') { 'PASS' } else { 'FAIL' })"

# SA-B7-04: Symbol sanitize
$sanitized = $consumers -match "re\.sub|replace|sanitize|upper\(\)|\.isalpha"
Write-Host "SA-B7-04 (symbol sanitize): $(if ($sanitized) { 'PASS' } else { 'PARTIAL - verify manually' })"

# SA-B7-05: nginx WebSocket routing
$nginx = Get-Content "frontend/docker/nginx.conf" -Raw
$wsRouting = $nginx -match "location /ws/" -and $nginx -match "core-api:8100" -and $nginx -match "Upgrade"
Write-Host "SA-B7-05 (nginx WS → core-api): $(if ($wsRouting) { 'PASS' } else { 'FAIL' })"

Write-Host "=== SPEC AUDIT B7 COMPLETE ===" -ForegroundColor Yellow
```

---

## SPEC-AUDIT-B8: Decommission (chạy trước merge)

```powershell
Write-Host "=== SPEC AUDIT B8 ===" -ForegroundColor Yellow

$urls = Get-Content "packages/core/backend/src/vninvest_core/urls.py" -Raw
$devCompose = Get-Content "docker-compose.dev.yml" -Raw
$prodCompose = Get-Content "docker-compose.prod.yml" -Raw

# SA-B8-01: Proxy route đã xóa
Write-Host "SA-B8-01 (proxy route removed): $(if (-not ($urls -match 'legacy_proxy')) { 'PASS' } else { 'FAIL' })"

# SA-B8-02: Backend không trong dev compose
Write-Host "SA-B8-02 (no backend in dev-compose): $(if (-not ($devCompose -match "^\s+backend:")) { 'PASS' } else { 'FAIL' })"

# SA-B8-03: Backend không trong prod compose
Write-Host "SA-B8-03 (no backend in prod-compose): $(if (-not ($prodCompose -match "^\s+backend:")) { 'PASS' } else { 'FAIL' })"

# SA-B8-04: LEGACY_BACKEND_URL removed từ settings
$settings = Get-Content "packages/core/backend/src/vninvest_core/settings.py" -Raw
Write-Host "SA-B8-04 (LEGACY_BACKEND_URL removed): $(if (-not ($settings -match 'LEGACY_BACKEND_URL')) { 'PASS' } else { 'FAIL' })"

Write-Host "=== SPEC AUDIT B8 COMPLETE ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Tất cả PASS → Có thể proceed với decommission" -ForegroundColor Green
```
