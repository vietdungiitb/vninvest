# Helper script to start Docker dev stack with GitHub token
# Usage: ./docker-start.ps1

$ErrorActionPreference = 'Stop'

# Export token (required by docker-compose.dev.yml). Prefer gh CLI / env if available.
if ([string]::IsNullOrWhiteSpace($env:VNBROKER_GITHUB_TOKEN)) {
  $env:VNBROKER_GITHUB_TOKEN = "<YOUR_GITHUB_PAT_HERE>"
}

Write-Host "🐋 Starting Docker dev stack with GitHub token..." -ForegroundColor Cyan
Write-Host "Token: $($env:VNBROKER_GITHUB_TOKEN.Substring(0, 20))..." -ForegroundColor Gray

# Start stack — requires BOTH compose files (base + dev override) and --env-file (start_dev.ps1 parity)
docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml up -d --build

Write-Host ""
Write-Host "✓ Docker services starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Check status:" -ForegroundColor Yellow
Write-Host "  docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml ps" -ForegroundColor Gray
Write-Host ""
Write-Host "Follow logs:" -ForegroundColor Yellow
Write-Host "  docker compose --env-file compose.dev.env -p vninvest-dev -f docker-compose.yml -f docker-compose.dev.yml logs -f" -ForegroundColor Gray
Write-Host ""
