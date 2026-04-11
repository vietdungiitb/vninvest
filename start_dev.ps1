#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Khởi động toàn bộ stack vninvest ở chế độ dev local.

.DESCRIPTION
    Script này:
      1. Build và khởi động tất cả Docker services (db, redis, backend, celery, frontend)
      2. Đợi backend healthy
      3. Seed demo data (testuser / test123) để test trực quan ngay lập tức

    Truy cập sau khi chạy:
    - App:       http://localhost       (username: testuser   / password: Test@123456)
      - Admin:     http://localhost/admin (username: admin      / password: admin123)
      - API:       http://localhost:8000/api/
      - Mailpit:   http://localhost:8025
      - Backend log: docker compose logs -f backend

.USAGE
    .\start_dev.ps1              # full build + seed
    .\start_dev.ps1 -SkipBuild  # chỉ up (đã build rồi)
    .\start_dev.ps1 -SkipSeed   # build + up không seed
    .\start_dev.ps1 -Down       # dừng và xóa containers
#>
param(
    [switch]$SkipBuild,
    [switch]$SkipSeed,
    [switch]$Down
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$ComposeFiles = @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml")
$ComposeEnvFile = "compose.dev.env"
$ProjectName = "vninvest-dev"

function Write-Step($msg) {
    Write-Host ""
    Write-Host "===> $msg" -ForegroundColor Cyan
}

function Invoke-Compose {
    docker compose --env-file $ComposeEnvFile -p $ProjectName @ComposeFiles @args
}

# ── Down mode ─────────────────────────────────────────────────────────────────
if ($Down) {
    Write-Step "Dừng và xóa containers (volumes giữ nguyên)"
    Invoke-Compose down --remove-orphans
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

# ── Kiểm tra Docker ──────────────────────────────────────────────────────────
Write-Step "Kiểm tra Docker"
try {
    docker info | Out-Null
} catch {
    Write-Host "Lỗi: Docker Desktop chưa chạy. Hãy khởi động Docker Desktop trước." -ForegroundColor Red
    exit 1
}

# ── Build image ──────────────────────────────────────────────────────────────
if (-not $SkipBuild) {
    Write-Step "Build Docker images (lần đầu mất 3–5 phút)"
    Invoke-Compose build --parallel
} else {
    Write-Step "Bỏ qua build (-SkipBuild)"
}

# ── Khởi động services ───────────────────────────────────────────────────────
Write-Step "Khởi động tất cả services"

# Dọn stale containers có tên cố định để tránh lỗi conflict khi compose up.
$devContainerNames = @(
    "vninvest-dev-db",
    "vninvest-dev-redis",
    "vninvest-dev-mailpit",
    "vninvest-dev-backend",
    "vninvest-dev-celery-worker",
    "vninvest-dev-celery-beat",
    "vninvest-dev-frontend"
)
foreach ($name in $devContainerNames) {
    $exists = docker ps -a --filter "name=^/${name}$" --format "{{.Names}}" 2>$null
    if ($exists -eq $name) {
        Write-Host "  - Remove stale container: $name"
        docker rm -f $name | Out-Null
    }
}

Invoke-Compose up -d --remove-orphans

# ── Đợi backend healthy ──────────────────────────────────────────────────────
Write-Step "Đợi backend khởi động (tối đa 120 giây)..."
$maxRetries = 24
$retryDelay = 5
$healthy = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    Start-Sleep -Seconds $retryDelay
    $status = docker inspect --format='{{.State.Health.Status}}' "vninvest-dev-backend" 2>$null
    if (-not $status) {
        # fallback: compose tạo tên có suffix
        $status = docker inspect --format='{{.State.Health.Status}}' "vninvest-dev-backend-1" 2>$null
    }
    Write-Host "  [$i/$maxRetries] backend health: $status"
    if ($status -eq "healthy") {
        $healthy = $true
        break
    }
}

if (-not $healthy) {
    Write-Host ""
    Write-Host "WARN: Backend chưa healthy sau 2 phút. Kiểm tra log:" -ForegroundColor Yellow
    Write-Host "  docker compose -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs --tail=50 backend" -ForegroundColor Yellow
    Write-Host "Vẫn tiếp tục seed (có thể backend đang chạy nhưng healthcheck chưa pass)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# ── Seed data ────────────────────────────────────────────────────────────────
if (-not $SkipSeed) {
    Write-Step "Seed demo data (testuser + admin + mock whale data)"

    $previousErrorActionPreference = $ErrorActionPreference
    $nativeCommandErrPrefVar = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    if ($nativeCommandErrPrefVar) {
        $nativeCommandErrPref = $nativeCommandErrPrefVar.Value
        $PSNativeCommandUseErrorActionPreference = $false
    }
    $ErrorActionPreference = "Continue"
    try {

        # Tìm tên container backend đúng
        $backendContainer = docker ps --filter "name=backend" --filter "status=running" --format "{{.Names}}" 2>$null | Select-Object -First 1
        if (-not $backendContainer) {
            Write-Host "Lỗi: Không tìm thấy container backend đang chạy." -ForegroundColor Red
            exit 1
        }
        Write-Host "  Container: $backendContainer"

        # Tạo superuser admin
        Write-Host "  Tạo superuser admin..."
        docker exec $backendContainer python manage.py shell -c @"
from django.contrib.auth.models import User
password = 'test@123456'
user, created = User.objects.get_or_create(username='admin', defaults={
    'email': 'admin@local.dev',
    'is_staff': True,
    'is_superuser': True,
})
user.email = 'admin@local.dev'
user.is_staff = True
user.is_superuser = True
user.set_password(password)
user.save()
print('Created admin / test@123456' if created else 'Updated admin password -> test@123456')
"@
        if ($LASTEXITCODE -ne 0) {
            throw "Tạo superuser admin thất bại (exit code: $LASTEXITCODE)."
        }

        # Seed demo data (testuser / test123 + mock intraday data)
        Write-Host "  Seed demo user + data..."
        docker exec $backendContainer python manage.py seed_demo_data 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Seed demo data thất bại (exit code: $LASTEXITCODE)."
        }

        # Seed securities groups (VN30, sectors) nếu chưa có
        Write-Host "  Seed securities groups..."
        docker exec $backendContainer python manage.py seed_securities_groups 2>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Seed securities groups thất bại (exit code: $LASTEXITCODE)."
        }

        Write-Host ""
        Write-Host "  Demo accounts:" -ForegroundColor Green
        Write-Host "    testuser  / Test@123456  (user thường, portfolio đầy đủ)" -ForegroundColor Green
        Write-Host "    admin     / test@123456 (superuser, vào /admin)" -ForegroundColor Green
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($nativeCommandErrPrefVar) {
            $PSNativeCommandUseErrorActionPreference = $nativeCommandErrPref
        }
    }
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Stack đã sẵn sàng!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App        -> http://localhost:8080"
Write-Host "  Admin      -> http://localhost:8080/admin   (admin / test@123456)"
Write-Host "  API        -> http://localhost:8000/api/"
Write-Host "  Mailpit    -> http://localhost:8026"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  Xem log backend:   docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f backend"
Write-Host "  Xem log celery:    docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f celery_worker"
Write-Host "  Dừng stack:        .\start_dev.ps1 -Down"
Write-Host "  Smoke test API:    Invoke-RestMethod http://localhost:8000/api/health/"
Write-Host ""
