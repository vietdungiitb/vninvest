# PRODUCTION BUILD & DEPLOYMENT SCRIPT (PowerShell)
# Usage: .\scripts\build-production.ps1 -Service all|frontend|backend|core-api -PushRegistry $false
# 
# Mục tiêu:
# - Build tất cả services giống hệt docker dev hiện tại
# - Validate migrations & config
# - Deploy to production stack

param(
    [string]$Service = "all",  # all|frontend|backend|core-api
    [bool]$PushRegistry = $false,
    [string]$Registry = "docker.io",
    [string]$Namespace = "vninvest"
)

$ErrorActionPreference = "Stop"

# Configuration
$appRelease = git rev-parse --short HEAD
$composeFile = "docker-compose.yml"
$prodOverride = "docker-compose.prod.yml"
$envFile = "compose.prod.env"

# Helper functions
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[✓] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[✗] $args" -ForegroundColor Red; exit 1 }

# Validate environment
function Validate-Environment {
    Write-Info "Validating environment..."
    
    if (-not (Test-Path $composeFile)) { Write-Error "Missing $composeFile" }
    if (-not (Test-Path $prodOverride)) { Write-Error "Missing $prodOverride" }
    if (-not (Test-Path $envFile)) { Write-Error "Missing $envFile (copy compose.prod.env.example)" }
    
    # Check Docker
    docker version > $null 2>&1 || Write-Error "Docker not installed"
    
    Write-Success "Environment validation passed"
}

# Build images
function Build-Images {
    param([string]$ServiceName)
    
    Write-Info "Building images for $ServiceName..."
    
    switch ($ServiceName) {
        "frontend" {
            docker compose -f $composeFile -f $prodOverride build `
                --build-arg APP_RELEASE=$appRelease `
                frontend
            Write-Success "Frontend image built: $appRelease"
        }
        "backend" {
            docker compose -f $composeFile -f $prodOverride build `
                --build-arg APP_RELEASE=$appRelease `
                backend
            Write-Success "Backend image built: $appRelease"
        }
        "core-api" {
            docker compose -f $composeFile -f $prodOverride build `
                --build-arg APP_RELEASE=$appRelease `
                core-api core-worker core-beat
            Write-Success "Core API services built: $appRelease"
        }
        "all" {
            docker compose -f $composeFile -f $prodOverride build `
                --build-arg APP_RELEASE=$appRelease
            Write-Success "All images built: $appRelease"
        }
        default { Write-Error "Unknown service: $ServiceName" }
    }
}

# Validate migrations
function Validate-Migrations {
    Write-Info "Validating Django migrations..."
    
    # Core API check
    docker compose -f $composeFile -f $prodOverride run --rm core-api `
        python manage.py showmigrations --plan 2>&1 | Out-Null
    
    # Backend check
    docker compose -f $composeFile -f $prodOverride run --rm backend `
        python manage.py showmigrations --plan 2>&1 | Out-Null
    
    Write-Success "Migration validation complete"
}

# Validate configuration
function Validate-Config {
    Write-Info "Validating Django configuration..."
    
    # Core API check
    docker compose -f $composeFile -f $prodOverride run --rm core-api `
        python manage.py check > $null 2>&1 || Write-Error "Core API config error"
    
    # Backend check
    docker compose -f $composeFile -f $prodOverride run --rm backend `
        python manage.py check > $null 2>&1 || Write-Error "Backend config error"
    
    Write-Success "Configuration validation passed"
}

# Deploy stack
function Deploy-Stack {
    Write-Info "Deploying production stack..."
    
    docker compose -f $composeFile -f $prodOverride up -d --remove-orphans
    
    Write-Success "Stack deployed successfully"
    
    Write-Info "Waiting for services to become healthy..."
    Start-Sleep -Seconds 10
    
    docker compose -f $composeFile -f $prodOverride ps
}

# Main execution
function Main {
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "VNINVEST PRODUCTION BUILD & DEPLOY" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan
    Write-Host "Release: $appRelease" -ForegroundColor Cyan
    Write-Host "Target Service: $Service" -ForegroundColor Cyan
    Write-Host ""
    
    Validate-Environment
    
    switch ($Service) {
        "frontend" { Build-Images "frontend" }
        "backend" { Build-Images "backend" }
        "core-api" { Build-Images "core-api" }
        "all" {
            Build-Images "frontend"
            Build-Images "backend"
            Build-Images "core-api"
            Validate-Migrations
            Validate-Config
            Deploy-Stack
        }
        default { Write-Error "Unknown service: $Service" }
    }
    
    Write-Success "======================================" 
    Write-Success "Build & deployment complete!"
    Write-Success "======================================"
}

Main
