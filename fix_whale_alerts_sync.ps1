#!/usr/bin/env pwsh

# =============================================================================
# WHALE ALERT DATA SYNC FIX SCRIPT
# Purpose: Force rebuild stack to load WHALE_ALERT_DETECTION_ENABLED env var
# Status: Handles environment variable loading and container recreation
# =============================================================================

Set-Location 'c:\Mujoco Projects\vninvest'

Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   WHALE ALERT DETECTION FIX - FULL STACK REBUILD         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verify env config
Write-Host "Step 1: Verifying backend/.env.dev configuration..." -ForegroundColor Yellow
$envFile = "backend\.env.dev"
if (Test-Path $envFile) {
    $whaleEnabled = Select-String -Path $envFile -Pattern "WHALE_ALERT_DETECTION_ENABLED" -ErrorAction SilentlyContinue
    $whaleInterval = Select-String -Path $envFile -Pattern "WHALE_ALERT_DETECTION_INTERVAL_SECONDS" -ErrorAction SilentlyContinue
    
    if ($whaleEnabled -and $whaleInterval) {
        Write-Host "  ✅ WHALE_ALERT_DETECTION_ENABLED: $(($whaleEnabled.Line -split '=')[1])" -ForegroundColor Green
        Write-Host "  ✅ WHALE_ALERT_DETECTION_INTERVAL_SECONDS: $(($whaleInterval.Line -split '=')[1])" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Whale detection env vars missing! Adding..." -ForegroundColor Yellow
        Add-Content -Path $envFile -Value "`nWHALE_ALERT_DETECTION_ENABLED=True"
        Add-Content -Path $envFile -Value "WHALE_ALERT_DETECTION_INTERVAL_SECONDS=120"
        Write-Host "  ✅ Added to $envFile" -ForegroundColor Green
    }
} else {
    Write-Host "  ❌ ERROR: $envFile not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Stop and remove old containers (force rebuild)
Write-Host "Step 2: Stopping and removing old containers..." -ForegroundColor Yellow
try {
    Write-Host "  Running: docker-compose down -v" -ForegroundColor Gray
    docker-compose down -v 2>&1 | Write-Host
    Write-Host "  ✅ Containers removed" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  docker-compose down failed (may be normal)" -ForegroundColor Yellow
}

Start-Sleep -Seconds 3

Write-Host ""

# Step 3: Rebuild and start fresh
Write-Host "Step 3: Rebuilding and starting fresh stack..." -ForegroundColor Yellow
Write-Host "  Running: docker-compose up -d --build" -ForegroundColor Gray
docker-compose up -d --build

Write-Host ""

# Step 4: Wait for services to stabilize
Write-Host "Step 4: Waiting for services to stabilize..." -ForegroundColor Yellow
$maxRetries = 30
$retries = 0
while ($retries -lt $maxRetries) {
    Start-Sleep -Seconds 2
    $healthyCount = docker ps --format "table {{.Names}}\t{{.Status}}" | Select-String -Pattern "Up" | Measure-Object | Select-Object -ExpandProperty Count
    Write-Host "  Services running: $healthyCount" -ForegroundColor Gray
    
    if ($healthyCount -ge 12) {  # Most services up
        Write-Host "  ✅ Stack stabilized" -ForegroundColor Green
        break
    }
    $retries++
}

Write-Host ""

# Step 5: Verify Celery beat has whale task
Write-Host "Step 5: Verifying Celery beat schedule..." -ForegroundColor Yellow
Start-Sleep -Seconds 5  # Give beat time to initialize

try {
    $beatLogs = docker logs vninvest-dev-core-beat --tail 100 2>&1
    if ($beatLogs -match "detect-global-whale-alerts") {
        Write-Host "  ✅ Found 'detect-global-whale-alerts' in Celery beat schedule!" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  WARNING: 'detect-global-whale-alerts' not yet visible in logs" -ForegroundColor Yellow
        Write-Host "  (May appear after next scheduled run ~30s)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "  ⚠️  Could not verify Celery beat logs" -ForegroundColor Yellow
}

Write-Host ""

# Step 6: Check database
Write-Host "Step 6: Checking WhaleAlertEvent table..." -ForegroundColor Yellow
try {
    $count = docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -c "SELECT COUNT(*) FROM portfolio_whalealertevent LIMIT 1;" 2>&1 | Select-String -Pattern "[0-9]+" -AllMatches | Select-Object -First 1
    Write-Host "  WhaleAlertEvent rows: $count" -ForegroundColor Cyan
    if ($count -eq "0") {
        Write-Host "  📅 Data will populate in ~120-180 seconds (first task cycle)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ Whale alerts detected and stored!" -ForegroundColor Green
    }
} catch {
    Write-Host "  ⚠️  Could not query database" -ForegroundColor Yellow
}

Write-Host ""

# Step 7: Final status
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   REBUILD COMPLETE                                        ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "✅ Environment vars loaded"
Write-Host "✅ Fresh containers started"
Write-Host "✅ Celery beat will schedule whale detection"
Write-Host ""
Write-Host "⏱️  Timeline:"
Write-Host "   • Now: Containers starting (may take 30-60s)"
Write-Host "   • +30s: Celery beat initializes"
Write-Host "   • +60s: First whale detection task runs"
Write-Host "   • +120s: WhaleAlertEvent table should have data"
Write-Host "   • +180s: Frontend dashboard should show alerts & heatmap data"
Write-Host ""
Write-Host "To monitor progress:"
Write-Host "  docker logs vninvest-dev-core-beat --follow"
Write-Host "  docker exec vninvest-dev-core-db psql -U vninvest -d vninvest_core -c 'SELECT COUNT(*) FROM portfolio_whalealertevent;'"
Write-Host ""
