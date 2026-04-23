param(
    [switch]$PurgeVolumes,
    [switch]$SkipBuild,
    [switch]$SkipSessionCloseBootstrap
)

$ErrorActionPreference = "Stop"

function Update-ListWithOrigin {
    param(
        [string]$Line,
        [string]$Origin
    )
    if ([string]::IsNullOrWhiteSpace($Line)) {
        return $Line
    }
    if ($Line -match "=") {
        $parts = $Line.Split("=", 2)
        $key = $parts[0]
        $value = $parts[1]
        $items = @()
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $items = $value.Split(",") | ForEach-Object { $_.Trim() } | Where-Object { $_ }
        }
        if (-not ($items -contains $Origin)) {
            $items += $Origin
        }
        return "$key=$($items -join ',')"
    }
    return $Line
}

Write-Host "[1/6] Checking Docker daemon..." -ForegroundColor Cyan
docker info | Out-Null

Write-Host "[2/6] Move to project root..." -ForegroundColor Cyan
Set-Location "C:\Mujoco Projects\vninvest"

Write-Host "[2.5/6] Ensure dev origins include :80..." -ForegroundColor Cyan
$envFile = "C:\Mujoco Projects\vninvest\backend\.env.dev"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    $newLines = @()
    foreach ($line in $lines) {
        if ($line.StartsWith("CORS_ALLOWED_ORIGINS=")) {
            $line = Update-ListWithOrigin -Line $line -Origin "http://localhost:80"
            $line = Update-ListWithOrigin -Line $line -Origin "http://127.0.0.1:80"
        }
        if ($line.StartsWith("CSRF_TRUSTED_ORIGINS=")) {
            $line = Update-ListWithOrigin -Line $line -Origin "http://localhost:80"
            $line = Update-ListWithOrigin -Line $line -Origin "http://127.0.0.1:80"
        }
        $newLines += $line
    }
    Set-Content -Path $envFile -Value $newLines -Encoding UTF8
}

Write-Host "[3/6] Stop known vninvest compose projects..." -ForegroundColor Cyan
$previousNativeCommandUseErrorActionPreference = $PSNativeCommandUseErrorActionPreference
$PSNativeCommandUseErrorActionPreference = $false
$previousErrorActionPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    docker compose -p vninvest-prod -f docker-compose.prod.yml down --remove-orphans *> $null
    docker compose -p vninvest-dev -f docker-compose.dev.yml down --remove-orphans *> $null
}
finally {
    $ErrorActionPreference = $previousErrorActionPreference
    $PSNativeCommandUseErrorActionPreference = $previousNativeCommandUseErrorActionPreference
}

Write-Host "[4/6] Remove ALL running/stopped containers (all stacks)..." -ForegroundColor Yellow
$allContainers = docker ps -aq
if ($allContainers) {
    docker rm -f $allContainers | Out-Null
}

Write-Host "[5/6] Cleanup unused Docker resources..." -ForegroundColor Cyan
docker network prune -f | Out-Null
if ($PurgeVolumes) {
    Write-Host "      Purging unused volumes..." -ForegroundColor Yellow
    docker volume prune -f | Out-Null
}

$requiredVolumes = @(
    "vninvest-dev_postgres_data",
    "vninvest-dev_redis_data"
)
foreach ($volumeName in $requiredVolumes) {
    $existingVolume = docker volume ls --filter "name=^${volumeName}$" --format "{{.Name}}"
    if ($existingVolume -ne $volumeName) {
        Write-Host "      Creating volume: $volumeName" -ForegroundColor Cyan
        docker volume create $volumeName | Out-Null
    }
}

Write-Host "[6/6] Start ONLY vninvest-dev stack..." -ForegroundColor Green
if ($SkipBuild) {
    docker compose -p vninvest-dev -f docker-compose.dev.yml up -d --remove-orphans
} else {
    docker compose -p vninvest-dev -f docker-compose.dev.yml up -d --build --remove-orphans
}

if (-not $SkipSessionCloseBootstrap) {
    Write-Host "[7/7] Bootstrap session close snapshots..." -ForegroundColor Cyan

    $backendReady = $false
    for ($attempt = 1; $attempt -le 30; $attempt++) {
        $health = docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" vninvest-dev-backend 2>$null
        if ($health -eq "healthy" -or $health -eq "running") {
            $backendReady = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if ($backendReady) {
        $bootstrapScript = @'
from portfolio.tasks_prefetch import offpeak_vnstock_ingest
result = offpeak_vnstock_ingest.run(days=7, max_symbols=200, trigger='dev_reset_bootstrap')
print(result)
'@

        $bootstrapOutput = $bootstrapScript | docker exec -i vninvest-dev-backend python manage.py shell 2>&1
        if ($LASTEXITCODE -ne 0) {
            Write-Host "      WARN: Session-close bootstrap failed (non-blocking)." -ForegroundColor Yellow
            if ($bootstrapOutput) {
                $bootstrapOutput | ForEach-Object { Write-Host "      $_" }
            }
        } else {
            Write-Host "      Session-close bootstrap done." -ForegroundColor Green
        }
    } else {
        Write-Host "      WARN: Backend not ready for session-close bootstrap (non-blocking)." -ForegroundColor Yellow
    }
}

Write-Host "" 
Write-Host "Done. Only project stack should be running now." -ForegroundColor Green
Write-Host "App: http://localhost"
Write-Host "API: http://localhost:8000/api/health/"
Write-Host "Mailpit: http://localhost:8026"
Write-Host ""
Write-Host "Quick check command:" -ForegroundColor DarkGray
Write-Host "docker ps --format \"table {{.Names}}`t{{.Status}}`t{{.Ports}}\""
