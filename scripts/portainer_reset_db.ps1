# Portainer Reset Database & Containers Script
# Purpose: Reset vninvest stack when database password mismatches
# Usage: .\scripts\portainer_reset_db.ps1

param(
    [string]$PortainerURL = "https://your-portainer-ip:9443",
    [string]$StackName = "vninvest",
    [switch]$Confirm = $false
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "VNInvest Portainer Reset Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Generate new secure password
function Generate-SecurePassword {
    $length = 20
    $charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
    $password = ""
    $random = New-Object System.Random
    for ($i = 0; $i -lt $length; $i++) {
        $password += $charset[$random.Next($charset.Length)]
    }
    return $password
}

# Generate new Django secret
function Generate-DjangoSecret {
    $length = 50
    $charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    $secret = ""
    $random = New-Object System.Random
    for ($i = 0; $i -lt $length; $i++) {
        $secret += $charset[$random.Next($charset.Length)]
    }
    return $secret
}

Write-Host "Step 1: Generating new credentials..." -ForegroundColor Yellow
$newDBPassword = Generate-SecurePassword
$newDjangoSecret = Generate-DjangoSecret

Write-Host "  ✓ New DB Password: $newDBPassword" -ForegroundColor Green
Write-Host "  ✓ New Django Secret: $newDjangoSecret" -ForegroundColor Green
Write-Host ""

Write-Host "Step 2: Instructions for Portainer Reset" -ForegroundColor Yellow
Write-Host ""
Write-Host "  1. Go to Portainer UI: $PortainerURL" -ForegroundColor Cyan
Write-Host "  2. Navigate to: Stacks > $StackName > Containers" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Delete containers IN THIS ORDER:" -ForegroundColor Yellow
Write-Host "     a. vninvest-backend > Stop > Remove" -ForegroundColor Gray
Write-Host "     b. vninvest-celery-worker > Stop > Remove" -ForegroundColor Gray
Write-Host "     c. vninvest-celery-beat > Stop > Remove" -ForegroundColor Gray
Write-Host "     d. vninvest-redis > Stop > Remove" -ForegroundColor Gray
Write-Host "     e. vninvest-db > Stop > Remove" -ForegroundColor Gray
Write-Host ""
Write-Host "  4. Delete stack WITH volumes:" -ForegroundColor Yellow
Write-Host "     Stacks > $StackName > Delete Stack" -ForegroundColor Cyan
Write-Host "     [X] Confirm DELETE VOLUMES checkbox" -ForegroundColor Yellow
Write-Host ""
Write-Host "  5. Create new stack:" -ForegroundColor Yellow
Write-Host "     Stacks > Add Stack > Repository" -ForegroundColor Cyan
Write-Host "     Name: vninvest" -ForegroundColor Gray
Write-Host "     Repository: https://github.com/vietdungiitb/vninvest.git" -ForegroundColor Gray
Write-Host "     Reference: refs/heads/deploy" -ForegroundColor Gray
Write-Host "     Compose path: portainer-stack-nginx-proxy.yml" -ForegroundColor Gray
Write-Host ""
Write-Host "  6. Update Environment Variables:" -ForegroundColor Yellow
Write-Host "     Copy these values into Stack Environment:" -ForegroundColor Cyan
Write-Host ""

Write-Host "================================================" -ForegroundColor White
Write-Host "NEW ENVIRONMENT VARIABLES TO COPY" -ForegroundColor White
Write-Host "================================================" -ForegroundColor White
Write-Host ""

$envBlock = @"
# Domain and SSL
DOMAIN=vninvest.edusuccess.vn
LETSENCRYPT_EMAIL=vietdung@edusuccess.vn
PROXY_NETWORK=nginx-proxy_default

# Database
POSTGRES_DB=vninvest
POSTGRES_USER=postgres
POSTGRES_PASSWORD=$newDBPassword

# Django
DJANGO_SECRET_KEY=$newDjangoSecret
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=vninvest.edusuccess.vn,localhost,127.0.0.1

# Frontend/API origins
CORS_ALLOWED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
CSRF_TRUSTED_ORIGINS=https://vninvest.edusuccess.vn,http://vninvest.edusuccess.vn
FRONTEND_BASE_URL=https://vninvest.edusuccess.vn

# P2 Advisory Features
ADVISORY_BUDGET_DOWNGRADE_THRESHOLD_PCT=20
AI_PROVIDER_RATE_LIMIT_MAX_RETRIES=3
AI_PROVIDER_RATELIMIT_PAUSE_SECONDS=120
MAX_CHART_CONTEXT_BYTES=65536
ADVISORY_PROMPT_CACHE_TTL_SECONDS=900
VNBROKER_CIRCUIT_BREAKER_TIMEOUT_THRESHOLD=3
VNBROKER_CIRCUIT_BREAKER_COOLDOWN_SECONDS=1800

# Runtime flags
REALTIME_ENABLED=True
WATCHLIST_SYNC_ENABLED=True
WATCHLIST_SYNC_MINUTES=15
WATCHLIST_SYNC_DAYS=5
ENABLE_NEW_MARKET_VIEWS=False
ENABLE_NEW_TRADING_VIEWS=False

# OpenCore quota
OPEN_CORE_QUOTA_ENFORCEMENT_ENABLED=True
OPEN_CORE_COMMUNITY_API_CALLS_PER_DAY=300
OPEN_CORE_COMMUNITY_AI_REGENERATE_PER_DAY=0
OPEN_CORE_PRO_INDIVIDUAL_API_CALLS_PER_DAY=3000
OPEN_CORE_PRO_INDIVIDUAL_AI_REGENERATE_PER_DAY=30
OPEN_CORE_PRO_TEAM_API_CALLS_PER_DAY=10000
OPEN_CORE_PRO_TEAM_AI_REGENERATE_PER_DAY=120

# Celery and stream scheduling (optional)
STREAM_CONSUMER_INTERVAL=3
TICKER_PREFETCH_INTERVAL=20
ORDER_FLOW_DETECTION_ENABLED=True
ORDER_FLOW_DETECTION_INTERVAL_SECONDS=30

# DRF throttling (optional)
DRF_REALTIME_RATE=60/minute
DRF_REALTIME_TICKER_RATE=120/minute
DRF_REALTIME_INTRADAY_RATE=90/minute
"@

Write-Host $envBlock -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor White
Write-Host ""

# Save to clipboard (Windows only)
try {
    $envBlock | Set-Clipboard
    Write-Host "Environment block copied to clipboard!" -ForegroundColor Green
}
catch {
    Write-Host "Could not copy to clipboard, please copy manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Step 3: Deploy and Verify" -ForegroundColor Yellow
Write-Host "  1. Click Deploy in Portainer" -ForegroundColor Cyan
Write-Host "  2. Wait for all containers to start (wait 3-5 min)" -ForegroundColor Cyan
Write-Host "  3. Verify containers are Up, not in Created or Restarting" -ForegroundColor Cyan
Write-Host ""

Write-Host "Step 4: Health Check" -ForegroundColor Yellow
Write-Host "  Test these URLs after deploy:" -ForegroundColor Cyan
Write-Host "  * https://vninvest.edusuccess.vn/ (load frontend)" -ForegroundColor Green
Write-Host "  * https://vninvest.edusuccess.vn/api/health/ (return JSON)" -ForegroundColor Green
Write-Host "  * https://vninvest.edusuccess.vn/admin/ (load Django admin)" -ForegroundColor Green
Write-Host "  * https://vninvest.edusuccess.vn/api/admin-ops/runtime-kpi/advisory-metrics/ (P2 endpoint)" -ForegroundColor Green
Write-Host ""

Write-Host "Step 5: Troubleshoot if 502 persists" -ForegroundColor Yellow
Write-Host "  • Check backend container logs for errors" -ForegroundColor Cyan
Write-Host "  • Check that POSTGRES_PASSWORD matches exactly" -ForegroundColor Cyan
Write-Host "  * Restart services in order: db, redis, backend, celery" -ForegroundColor Cyan
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "CREDENTIALS SAVED TO FILE" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Save credentials to local file
$dateStamp = Get-Date -Format "yyyyMMdd_HHmmss"
$credFile = "c:\Mujoco Projects\vninvest\PORTAINER_RESET_CREDENTIALS_$dateStamp.txt"
$credContent = @"
VNInvest Portainer Reset - $(Get-Date)
=====================================

NEW DATABASE PASSWORD:
$newDBPassword

NEW DJANGO SECRET KEY:
$newDjangoSecret

ENVIRONMENT BLOCK (copy to Portainer):
$envBlock

⚠️  IMPORTANT: 
   - Keep this file safe and delete after Portainer deployment
   - Do NOT commit this file to git
   - Change these credentials in 30 days for security best practices
"@

$credContent | Out-File -FilePath $credFile -Encoding UTF8
Write-Host "Credentials saved to: $credFile" -ForegroundColor Green
Write-Host "  (Keep this file safe, delete after deployment)" -ForegroundColor Yellow
Write-Host ""

Write-Host "READY FOR RESET!" -ForegroundColor Green
Write-Host ""
