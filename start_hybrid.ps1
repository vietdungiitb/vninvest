# start_hybrid.ps1
# Chế độ Hybrid: Backend + Frontend chạy trực tiếp cục bộ.
# Docker vẫn giữ: redis, postgres, celery_worker, celery_beat, mailpit.
# Dùng: .\start_hybrid.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path $MyInvocation.MyCommand.Path -Parent

Write-Host ""
Write-Host "======================================================"
Write-Host " HYBRID MODE  —  Backend local + Frontend local"
Write-Host "======================================================"

# ── Bước 1: Dừng backend và frontend Docker ───────────────────────
Write-Host ""
Write-Host "==> [1/4] Dung backend va frontend Docker..."
docker stop vninvest-dev-backend 2>$null
docker stop vninvest-dev-frontend 2>$null
Write-Host "    OK."

# ── Bước 2: Recreate DB container để expose port 5432 ────────────
Write-Host ""
Write-Host "==> [2/4] Dam bao Postgres expose port 5432 tren host..."
docker compose -f "$Root\docker-compose.yml" -f "$Root\docker-compose.dev.yml" `
    up -d --no-deps db --force-recreate 2>&1 | Out-Null

# Chờ Postgres sẵn sàng (tối đa 30s)
$waited = 0
Write-Host -NoNewline "    Cho Postgres..."
do {
    Start-Sleep -Seconds 1
    $waited++
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 5432)
        $tcp.Close()
        break
    } catch {}
} while ($waited -lt 30)

if ($waited -ge 30) {
    Write-Warning "Postgres chua san sang sau 30s. Kiem tra lai."
} else {
    Write-Host " san sang (${waited}s)."
}

# ── Bước 3: Backend local – Daphne :8000 ─────────────────────────
Write-Host ""
Write-Host "==> [3/4] Khoi dong Backend local (Daphne :8000)..."

# Truyền env override qua process scope (dotenv sẽ không ghi đè biến hệ thống)
$backendEnvVars = @"
`$env:DB_ENGINE = 'postgres'
`$env:POSTGRES_HOST = 'localhost'
`$env:POSTGRES_PORT = '5432'
`$env:POSTGRES_DB = 'vninvest'
`$env:POSTGRES_USER = 'postgres'
`$env:POSTGRES_PASSWORD = 'devpassword'
`$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080'
`$env:CSRF_TRUSTED_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:8080,http://127.0.0.1:8080'
Set-Location '$Root\backend'
.\start_backend.ps1
"@
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendEnvVars -WindowStyle Normal
Start-Sleep -Seconds 2

# ── Bước 4: Frontend local – npm start :8080 ─────────────────────
Write-Host ""
Write-Host "==> [4/4] Khoi dong Frontend local (:8080)..."
$frontendCmd = "`$env:PORT = '8080'; Set-Location '$Root\frontend'; npm start"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCmd -WindowStyle Normal

# ── Tóm tắt ──────────────────────────────────────────────────────
Write-Host ""
Write-Host "======================================================"
Write-Host " Hybrid mode dang chay:"
Write-Host "   Backend  : http://127.0.0.1:8000  (Daphne local)"
Write-Host "   Frontend : http://localhost:8080   (react-scripts)"
Write-Host "   Postgres : localhost:5432          (Docker)"
Write-Host "   Redis    : localhost:6379           (Docker)"
Write-Host "   Celery   : Docker (worker + beat)"
Write-Host "   Mailpit  : http://localhost:8026   (Docker)"
Write-Host "======================================================"
Write-Host " De quay lai full Docker: .\stop_hybrid.ps1"
Write-Host ""
