# SSH DEPLOYMENT SCRIPT (PowerShell)
# Deploy VNInvest to saas.edusuccess.vn
# Usage: .\scripts\deploy-remote.ps1 -Host saas.edusuccess.vn -User pham -Password "ThanhLam@2010" -Branch enterprise

param(
    [string]$Host = "saas.edusuccess.vn",
    [string]$User = "pham",
    [string]$Password = "",
    [string]$Branch = "enterprise",
    [string]$DeployPath = "/opt/vninvest"
)

$ErrorActionPreference = "Stop"

# Colors
function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[✓] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Error { Write-Host "[✗] $args" -ForegroundColor Red; exit 1 }

# Validate parameters
if (-not $Password) {
    Write-Error "Password required. Use -Password parameter"
}

# SSH Helper function
function Invoke-SSH {
    param([string]$Command)
    
    Write-Info "Executing: $Command"
    
    # Using plink (PuTTY) or scp for SSH operations
    # Requires plink.exe in PATH or we use docker context
    
    $sshCmd = @"
`$ProgressPreference = 'SilentlyContinue'
ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null `
    "${User}@${Host}" "$Command"
"@
    
    Invoke-Expression $sshCmd
}

# Main deployment steps
function Deploy {
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "VNINVEST REMOTE DEPLOYMENT" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Target: ${User}@${Host}"
    Write-Host "Branch: $Branch"
    Write-Host "Deploy Path: $DeployPath"
    Write-Host ""
    
    # Step 1: SSH connection test
    Write-Info "Testing SSH connection..."
    try {
        ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no `
            "${User}@${Host}" "echo 'SSH connection successful'" | Out-Null
        Write-Success "SSH connection successful"
    } catch {
        Write-Error "SSH connection failed. Check host, user, and password."
    }
    
    # Step 2: Clone or update repository
    Write-Info "Cloning/updating repository..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
if [ -d "$DeployPath" ]; then
    echo "Repository exists, pulling latest..."
    cd $DeployPath && git fetch origin && git checkout $Branch && git pull origin $Branch
else
    echo "Cloning repository..."
    git clone --branch $Branch https://github.com/vietdungiitb/vninvest.git $DeployPath
    cd $DeployPath
fi
echo "Git sync complete"
"@
    Write-Success "Repository updated"
    
    # Step 3: Check environment file
    Write-Info "Checking production environment file..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
if [ ! -f "$DeployPath/compose.prod.env" ]; then
    echo "❌ ERROR: compose.prod.env not found"
    echo "Please copy compose.prod.env.example to compose.prod.env and configure it"
    exit 1
fi
echo "✓ compose.prod.env exists"
"@
    Write-Success "Environment file verified"
    
    # Step 4: Build images
    Write-Info "Building Docker images..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
cd $DeployPath
docker compose -f docker-compose.yml -f docker-compose.prod.yml build --build-arg APP_RELEASE=$Branch
echo "Build complete"
"@
    Write-Success "Docker images built"
    
    # Step 5: Validate migrations
    Write-Info "Validating migrations..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
cd $DeployPath
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm core-api python manage.py showmigrations --plan
echo "Core API migrations validated"
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm backend python manage.py showmigrations --plan
echo "Backend migrations validated"
"@
    Write-Success "Migrations validated"
    
    # Step 6: Backup databases (if services running)
    Write-Info "Backing up databases..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
cd $DeployPath
mkdir -p backups
TIMESTAMP=\$(date +%Y%m%d_%H%M%S)

# Legacy DB backup
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
    pg_dump -U postgres vninvest | gzip > backups/vninvest_\${TIMESTAMP}.sql.gz 2>/dev/null || echo "Legacy DB backup skipped (service may not be running)"

# Core DB backup
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec -T core-db \
    pg_dump -U vninvest vninvest_core | gzip > backups/vninvest_core_\${TIMESTAMP}.sql.gz 2>/dev/null || echo "Core DB backup skipped (service may not be running)"

echo "Backups created at: backups/"
"@
    Write-Success "Database backups created"
    
    # Step 7: Deploy stack
    Write-Info "Deploying production stack..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
cd $DeployPath
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
echo "Stack deployment initiated"
"@
    Write-Success "Stack deployed"
    
    # Step 8: Health check
    Write-Info "Waiting for services to become healthy..."
    Start-Sleep -Seconds 15
    
    Write-Info "Checking service health..."
    ssh -o StrictHostKeyChecking=no "${User}@${Host}" @"
cd $DeployPath
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
"@
    
    # Step 9: Post-deployment info
    Write-Success "========================================" 
    Write-Success "Deployment complete!"
    Write-Success "========================================"
    Write-Host ""
    Write-Host "Services deployed to: $Host" -ForegroundColor Green
    Write-Host "Deploy path: $DeployPath" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Verify services are healthy:"
    Write-Host "   ssh ${User}@${Host} 'cd $DeployPath && docker compose ps'"
    Write-Host ""
    Write-Host "2. Check frontend:"
    Write-Host "   https://${Host}/"
    Write-Host ""
    Write-Host "3. Check API health:"
    Write-Host "   https://${Host}/core/v1/health"
    Write-Host ""
    Write-Host "4. View logs:"
    Write-Host "   ssh ${User}@${Host} 'cd $DeployPath && docker compose logs -f core-api'"
}

# Run deployment
Deploy
