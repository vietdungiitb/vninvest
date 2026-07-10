# This file is sourced by PowerShell to set required environment variables for Docker dev stack
# Usage: . .\set-docker-env.ps1

$env:VNBROKER_GITHUB_TOKEN = "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"

Write-Host "✓ Docker environment variables set" -ForegroundColor Green
Write-Host "  VNBROKER_GITHUB_TOKEN = $($env:VNBROKER_GITHUB_TOKEN.Substring(0,20))..." -ForegroundColor Gray
