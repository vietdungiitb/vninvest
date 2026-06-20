#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Khởi động toàn bộ stack vninvest ở chế độ dev local, native core only.

.DESCRIPTION
    Script này:
      1. Build và khởi động tất cả Docker services core (db, redis, core-api, core-workers, core-beat, frontend)
      2. Đợi core-api healthy
      3. Kiểm tra drift hàng đợi Celery native

        Truy cập sau khi chạy:
        - App:       http://localhost/operations-center
        - Admin:     http://localhost/admin
        - API:       http://localhost:8001/core/v1/health
            - Mailpit:   http://localhost:8025
            - Core API log: docker compose logs -f core-api

.USAGE
    .\start_dev.ps1             # full build + up
    .\start_dev.ps1 -SkipBuild  # chỉ up (đã build rồi)
    .\start_dev.ps1 -Down       # dừng và xóa containers
#>
param(
    [switch]$SkipBuild,
    [switch]$Down,
    [switch]$FrontendOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-GitHubCliToken {
    $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghCommand) {
        return $null
    }

    try {
        $tokenOutput = & $ghCommand.Source auth token 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $null
        }

        $token = [string]::Join("`n", @($tokenOutput)).Trim()
        if ([string]::IsNullOrWhiteSpace($token)) {
            return $null
        }

        return $token
    } catch {
        return $null
    }
}
$SkipBuild = $false

$ComposeFiles = @("-f", "docker-compose.yml", "-f", "docker-compose.dev.yml")
$ComposeEnvFile = "compose.dev.env"
$ProjectName = "vninvest-dev"
$TargetServices = if ($FrontendOnly) { @("frontend") } else { @() }

function Write-Step($msg) {
    Write-Host ""
    Write-Host "===> $msg" -ForegroundColor Cyan
}

function Get-EnvValueFromFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [string]$Key
    )

    if (-not (Test-Path $Path)) {
        return $null
    }

    $escapedKey = [regex]::Escape($Key)
    foreach ($line in Get-Content $Path) {
        if ($line -match "^\s*${escapedKey}=(.*)$") {
            return $Matches[1].Trim()
        }
    }

    return $null
}

function Test-IsPlaceholderSecretValue {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ([string]::IsNullOrWhiteSpace($Value)) {
        return $true
    }

    $normalized = $Value.Trim().ToLowerInvariant()
    return @(
        'dummy',
        'changeme',
        'change-me',
        'replace-me',
        'replace_me',
        'your_token_here',
        'token',
        'unset'
    ) -contains $normalized
}

function Get-GitHubCliToken {
    $ghCommand = Get-Command gh -ErrorAction SilentlyContinue
    if (-not $ghCommand) {
        return $null
    }

    try {
        $tokenOutput = & $ghCommand.Source auth token 2>$null
        if ($LASTEXITCODE -ne 0) {
            return $null
        }

        $token = [string]::Join("`n", @($tokenOutput)).Trim()
        if ([string]::IsNullOrWhiteSpace($token)) {
            return $null
        }

        return $token
    }
    catch {
        return $null
    }
}

function Ensure-VnbrokerGitHubToken {
    $envToken = $env:VNBROKER_GITHUB_TOKEN
    $ghToken = Get-GitHubCliToken
    $composeToken = Get-EnvValueFromFile -Path (Join-Path $PSScriptRoot $ComposeEnvFile) -Key "VNBROKER_GITHUB_TOKEN"

    if (-not (Test-IsPlaceholderSecretValue -Value $ghToken)) {
        Write-Host "  Using GitHub CLI auth token for VNBROKER_GITHUB_TOKEN." -ForegroundColor DarkGray
        $token = $ghToken
    } elseif (-not (Test-IsPlaceholderSecretValue -Value $envToken)) {
        $token = $envToken
    } elseif (-not [string]::IsNullOrWhiteSpace($envToken)) {
        Write-Host "  Ignoring placeholder VNBROKER_GITHUB_TOKEN from current shell." -ForegroundColor Yellow
        $token = $null
    } else {
        $token = $null
    }

    if ([string]::IsNullOrWhiteSpace($token) -and -not (Test-IsPlaceholderSecretValue -Value $composeToken)) {
        $token = $composeToken
    }

    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "VNBROKER_GITHUB_TOKEN is missing. Please define it in compose.dev.env or your environment."
    }

    $env:VNBROKER_GITHUB_TOKEN = $token
}

function Invoke-Compose {
    param(
        [Parameter(ValueFromRemainingArguments = $true)]
        [string[]]$ComposeArgs
    )

    $composeCommand = @(
        "compose",
        "--env-file", $ComposeEnvFile,
        "-p", $ProjectName
    ) + $ComposeFiles + $ComposeArgs

    & docker @composeCommand
}

function Get-ContainerHealthStatus {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ContainerName
    )

    $previousErrorActionPreference = $ErrorActionPreference
    $nativeCommandErrPrefVar = Get-Variable -Name PSNativeCommandUseErrorActionPreference -ErrorAction SilentlyContinue
    if ($nativeCommandErrPrefVar) {
        $previousNativeCommandErrPref = $nativeCommandErrPrefVar.Value
        $PSNativeCommandUseErrorActionPreference = $false
    }
    $ErrorActionPreference = "Continue"

    try {
        $inspectJson = docker inspect $ContainerName 2>$null | Out-String
        if ($LASTEXITCODE -ne 0 -or -not $inspectJson) {
            return $null
        }

        $inspectObj = $inspectJson | ConvertFrom-Json
        if ($inspectObj -is [array]) {
            $inspectObj = $inspectObj | Select-Object -First 1
        }
        if (-not $inspectObj) {
            return $null
        }

        if (-not ($inspectObj.PSObject.Properties.Name -contains "State") -or -not $inspectObj.State) {
            return "unknown"
        }

        if (($inspectObj.State.PSObject.Properties.Name -contains "Health") -and $inspectObj.State.Health) {
            return [string]$inspectObj.State.Health.Status
        }

        if (($inspectObj.State.PSObject.Properties.Name -contains "Status") -and [string]$inspectObj.State.Status -eq "running") {
            return "running-no-healthcheck"
        }

        return "no-healthcheck"
    }
    catch {
        return $null
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
        if ($nativeCommandErrPrefVar) {
            $PSNativeCommandUseErrorActionPreference = $previousNativeCommandErrPref
        }
    }
}

# ── Down mode ─────────────────────────────────────────────────────────────────
if ($Down) {
    Write-Step "Dừng và xóa containers (volumes giữ nguyên)"
    $composeDownArgs = @("down", "--remove-orphans")
    Invoke-Compose @composeDownArgs
    Write-Host "Done." -ForegroundColor Green
    exit 0
}

# ── Bootstrap env files (tự động nếu thiếu) ─────────────────────────────────
Write-Step "Bootstrap env files"
$devEnvPath   = Join-Path $PSScriptRoot "compose.dev.env"
if (-not (Test-Path $devEnvPath)) {
    Write-Host "  compose.dev.env khong ton tai — chay bootstrap..." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "  compose.dev.env da co." -ForegroundColor DarkGray
}

Ensure-VnbrokerGitHubToken

# ── Kiểm tra Docker ──────────────────────────────────────────────────────────
Write-Step "Kiểm tra Docker"
try {
    docker info | Out-Null
} catch {
    Write-Host "Lỗi: Docker Desktop chưa chạy. Hãy khởi động Docker Desktop trước." -ForegroundColor Red
    exit 1
}

if ($FrontendOnly) {
    Write-Host "  Frontend-only refresh mode enabled." -ForegroundColor DarkGray
}

# ── Build image ──────────────────────────────────────────────────────────────
Write-Host "DEBUG SkipBuild value: '$SkipBuild', type: '$($SkipBuild.GetType().FullName)'"
if (-not $SkipBuild) {
    Write-Step "Build Docker images (lần đầu mất 3–5 phút)"
    $composeBuildArgs = @("build", "--parallel") + $TargetServices
    Invoke-Compose @composeBuildArgs
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose build failed with exit code $LASTEXITCODE. Aborting so stale images are not started."
    }
} else {
    Write-Step "Bỏ qua build (-SkipBuild)"
}

# ── Khởi động services ───────────────────────────────────────────────────────
Write-Step "Khởi động tất cả services"

# Tạo external volumes nếu chưa tồn tại (tránh lỗi volume not found khi compose up).
$requiredVolumes = @(
    "${ProjectName}_postgres_data",
    "${ProjectName}_redis_data"
)
$existingVolumes = docker volume ls --format "{{.Name}}"
foreach ($vol in $requiredVolumes) {
    if ($existingVolumes -notcontains $vol) {
        Write-Host "  - Create volume: $vol"
        docker volume create $vol | Out-Null
    }
}

# Dọn stale containers có tên cố định để tránh lỗi conflict khi compose up.
$devContainerNames = @(
    "vninvest-dev-db",
    "vninvest-dev-redis",
    "vninvest-dev-mailpit",
    "vninvest-dev-core-api",
    "vninvest-dev-core-worker",
    "vninvest-dev-core-worker-realtime-prefetch",
    "vninvest-dev-core-worker-realtime-stream",
    "vninvest-dev-core-worker-analytics",
    "vninvest-dev-core-worker-enrichment",
    "vninvest-dev-core-worker-manual",
    "vninvest-dev-core-beat",
    "vninvest-dev-frontend"
)
if ($FrontendOnly) {
    $devContainerNames = @("vninvest-dev-frontend")
}
foreach ($name in $devContainerNames) {
    $exists = docker ps -a --filter "name=^/${name}$" --format "{{.Names}}" 2>$null
    if ($exists -eq $name) {
        Write-Host "  - Remove stale container: $name"
        docker rm -f $name | Out-Null
    }
}

$composeUpArgs = @("up", "-d", "--remove-orphans") + $TargetServices
Invoke-Compose @composeUpArgs
if ($LASTEXITCODE -ne 0) {
    throw "docker compose up failed with exit code $LASTEXITCODE."
}

# ── Đợi core-api healthy ──────────────────────────────────────────────────────
Write-Step "Đợi core-api khởi động (tối đa 120 giây)..."
$maxRetries = 24
$retryDelay = 5
$healthy = $false

for ($i = 1; $i -le $maxRetries; $i++) {
    Start-Sleep -Seconds $retryDelay
    $status = Get-ContainerHealthStatus -ContainerName "vninvest-dev-core-api"
    if (-not $status) {
        # fallback: compose tạo tên có suffix
        $status = Get-ContainerHealthStatus -ContainerName "vninvest-dev-core-api-1"
    }
    Write-Host "  [$i/$maxRetries] core-api health: $status"
    if ($status -eq "healthy" -or $status -eq "running-no-healthcheck") {
        $healthy = $true
        break
    }
}

if (-not $healthy) {
    Write-Host ""
    Write-Host "WARN: core-api chưa healthy sau 2 phút. Kiểm tra log:" -ForegroundColor Yellow
    Write-Host "  docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs --tail=50 core-api" -ForegroundColor Yellow
    Write-Host "Vẫn tiếp tục các bước hậu khởi động (có thể core-api đang chạy nhưng healthcheck chưa pass)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 10
}

# ── Native scheduler sanity check ───────────────────────────────────────────
Write-Step "Kiểm tra scheduler queue native"
$coreApiContainer = docker ps --filter "name=core-api" --filter "status=running" --format "{{.Names}}" 2>$null | Select-Object -First 1
if (-not $coreApiContainer) {
    Write-Host "WARN: Không tìm thấy container core-api đang chạy, bỏ qua check_scheduler_queue_drift." -ForegroundColor Yellow
} else {
    Write-Host "  Container: $coreApiContainer"
    $queueDriftOutput = cmd /c "docker exec $coreApiContainer python src/manage.py check_scheduler_queue_drift --warn-only 2>&1"
    if ($queueDriftOutput) {
        $queueDriftOutput | ForEach-Object { Write-Host $_ }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARN: check_scheduler_queue_drift báo lỗi (exit code: $LASTEXITCODE). Tiếp tục để không chặn stack." -ForegroundColor Yellow
    }
}

# ── Done ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Stack native đã sẵn sàng!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  App        -> http://localhost/operations-center"
Write-Host "  Admin      -> http://localhost/admin"
Write-Host "  API        -> http://localhost:8001/core/v1/health"
Write-Host "  Mailpit    -> http://localhost:8026"
Write-Host ""
Write-Host "Useful commands:"
Write-Host "  Xem log core-api:  docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f core-api"
Write-Host "  Xem log beat:      docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f core-beat"
Write-Host "  Dừng stack:        .\start_dev.ps1 -Down"
Write-Host "  Smoke test API:    Invoke-RestMethod http://localhost:8001/core/v1/health"
Write-Host ""

# Smoke probes để xác nhận core-api/frontend đã sẵn sàng test thủ công.
Write-Step "Smoke checks (core-api + frontend)"
$backendOk = $false
$frontendOk = $false

try {
    $backendResp = Invoke-WebRequest -Uri "http://localhost:8001/core/v1/health" -UseBasicParsing -TimeoutSec 15
    if ($backendResp.StatusCode -ge 200 -and $backendResp.StatusCode -lt 500) {
        $backendOk = $true
    }
} catch {
    $backendOk = $false
}

try {
    $frontendResp = Invoke-WebRequest -Uri "http://localhost" -UseBasicParsing -TimeoutSec 15
    if ($frontendResp.StatusCode -ge 200 -and $frontendResp.StatusCode -lt 500) {
        $frontendOk = $true
    }
} catch {
    $frontendOk = $false
}

Write-Host ("  Core API health : " + ($(if ($backendOk) { "OK" } else { "FAIL" })))
Write-Host ("  Frontend health : " + ($(if ($frontendOk) { "OK" } else { "FAIL" })))

if (-not $backendOk -or -not $frontendOk) {
    Write-Host ""
    Write-Host "WARN: Co service chua san sang. Ban co the xem log bang cac lenh o tren." -ForegroundColor Yellow
}
