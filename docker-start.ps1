# Helper script to start Docker dev stack with GitHub token
# Usage: ./docker-start.ps1

$ErrorActionPreference = 'Stop'

# Export token (required by docker-compose.dev.yml)
$env:VNBROKER_GITHUB_TOKEN = "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"

Write-Host "🐋 Starting Docker dev stack with GitHub token..." -ForegroundColor Cyan
Write-Host "Token: $($env:VNBROKER_GITHUB_TOKEN.Substring(0, 20))..." -ForegroundColor Gray

# Start stack
docker compose -f docker-compose.dev.yml --env-file compose.dev.env up -d --build

Write-Host ""
Write-Host "✓ Docker services starting..." -ForegroundColor Green
Write-Host ""
Write-Host "Check status:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.dev.yml ps" -ForegroundColor Gray
Write-Host ""
Write-Host "Follow logs:" -ForegroundColor Yellow
Write-Host "  docker compose -f docker-compose.dev.yml logs -f" -ForegroundColor Gray
Write-Host ""
