# This file is sourced by PowerShell to set required environment variables for Docker dev stack
# Usage: . .\set-docker-env.ps1

$env:VNBROKER_GITHUB_TOKEN = "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"

Write-Host "✓ Docker environment variables set" -ForegroundColor Green
Write-Host "  VNBROKER_GITHUB_TOKEN = $($env:VNBROKER_GITHUB_TOKEN.Substring(0,20))..." -ForegroundColor Gray
