# This file is sourced by PowerShell to set required environment variables for Docker dev stack
# Usage: . .\set-docker-env.ps1

$env:VNBROKER_GITHUB_TOKEN = "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"

Write-Host "✓ Docker environment variables set" -ForegroundColor Green
Write-Host "  VNBROKER_GITHUB_TOKEN = $($env:VNBROKER_GITHUB_TOKEN.Substring(0,20))..." -ForegroundColor Gray
