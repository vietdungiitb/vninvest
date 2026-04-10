param(
    [switch]$PurgeVolumes,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Ensure-ListContainsOrigin {
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

Write-Host "[2.5/6] Ensure dev origins include :8080..." -ForegroundColor Cyan
$envFile = "C:\Mujoco Projects\vninvest\backend\.env.dev"
if (Test-Path $envFile) {
    $lines = Get-Content $envFile
    $newLines = @()
    foreach ($line in $lines) {
        if ($line.StartsWith("CORS_ALLOWED_ORIGINS=")) {
            $line = Ensure-ListContainsOrigin -Line $line -Origin "http://localhost:8080"
            $line = Ensure-ListContainsOrigin -Line $line -Origin "http://127.0.0.1:8080"
        }
        if ($line.StartsWith("CSRF_TRUSTED_ORIGINS=")) {
            $line = Ensure-ListContainsOrigin -Line $line -Origin "http://localhost:8080"
            $line = Ensure-ListContainsOrigin -Line $line -Origin "http://127.0.0.1:8080"
        }
        $newLines += $line
    }
    Set-Content -Path $envFile -Value $newLines -Encoding UTF8
}

Write-Host "[3/6] Stop known vninvest compose projects..." -ForegroundColor Cyan
docker compose -p vninvest -f docker-compose.yml down --remove-orphans 2>$null

docker compose -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml down --remove-orphans 2>$null

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

Write-Host "[6/6] Start ONLY vninvest-dev stack..." -ForegroundColor Green
if ($SkipBuild) {
    docker compose -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --remove-orphans
} else {
    docker compose -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build --remove-orphans
}

Write-Host "" 
Write-Host "Done. Only project stack should be running now." -ForegroundColor Green
Write-Host "App: http://localhost:8080"
Write-Host "API: http://localhost:8000/api/health/"
Write-Host "Mailpit: http://localhost:8026"
Write-Host ""
Write-Host "Quick check command:" -ForegroundColor DarkGray
Write-Host "docker ps --format \"table {{.Names}}`t{{.Status}}`t{{.Ports}}\""
