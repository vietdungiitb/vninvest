# This file is sourced by PowerShell to set required environment variables for Docker dev stack
# Usage: . .\set-docker-env.ps1

$env:VNBROKER_GITHUB_TOKEN = "<YOUR_GITHUB_PAT_HERE>"

Write-Host "✓ Docker environment variables set" -ForegroundColor Green
Write-Host "  VNBROKER_GITHUB_TOKEN = $($env:VNBROKER_GITHUB_TOKEN.Substring(0,20))..." -ForegroundColor Gray
