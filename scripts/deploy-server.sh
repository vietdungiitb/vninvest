#!/bin/bash
################################################################################
# REMOTE SSH DEPLOYMENT SCRIPT (Bash)
# Run on production server: bash scripts/deploy-server.sh
# Or from Windows PowerShell:
#   ssh user@host "cd /opt/vninvest && bash scripts/deploy-server.sh"
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DEPLOY_PATH="${DEPLOY_PATH:-.}"
BRANCH="${BRANCH:-enterprise}"
COMPOSE_FILE="docker-compose.yml"
PROD_OVERRIDE="docker-compose.prod.yml"

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

main() {
    log_info "========================================="
    log_info "VNINVEST PRODUCTION DEPLOYMENT"
    log_info "========================================="
    log_info "Deploy Path: $DEPLOY_PATH"
    log_info "Branch: $BRANCH"
    log_info ""
    
    # Change to deploy directory
    cd "$DEPLOY_PATH" || log_error "Deploy path not found: $DEPLOY_PATH"
    
    # Step 1: Verify prerequisites
    log_info "Verifying prerequisites..."
    [[ -f "$COMPOSE_FILE" ]] || log_error "Missing $COMPOSE_FILE"
    [[ -f "$PROD_OVERRIDE" ]] || log_error "Missing $PROD_OVERRIDE"
    [[ -f "compose.prod.env" ]] || log_error "Missing compose.prod.env (copy from compose.prod.env.example)"
    command -v docker &> /dev/null || log_error "Docker not installed"
    log_success "Prerequisites verified"
    
    # Step 2: Git sync
    log_info "Syncing code from git branch: $BRANCH..."
    git fetch origin
    git checkout "$BRANCH"
    git pull origin "$BRANCH"
    log_success "Code synced"
    
    # Step 3: Build images
    log_info "Building Docker images..."
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" build \
        --build-arg APP_RELEASE="$BRANCH"
    log_success "Images built"
    
    # Step 4: Run migrations
    log_info "Running database migrations..."
    
    # Core API migrations
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm core-api \
        python manage.py migrate || log_warn "Core API migrations may have failed"
    
    # Backend migrations
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm backend \
        python manage.py migrate || log_warn "Backend migrations may have failed"
    
    log_success "Migrations completed"
    
    # Step 5: Backup databases
    log_info "Backing up databases..."
    mkdir -p backups
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Legacy DB backup
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" exec -T db \
        pg_dump -U postgres vninvest | gzip > "backups/vninvest_${TIMESTAMP}.sql.gz" 2>/dev/null || \
        log_warn "Legacy DB backup skipped"
    
    # Core DB backup
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" exec -T core-db \
        pg_dump -U vninvest vninvest_core | gzip > "backups/vninvest_core_${TIMESTAMP}.sql.gz" 2>/dev/null || \
        log_warn "Core DB backup skipped"
    
    log_success "Backups created: backups/"
    
    # Step 6: Deploy stack
    log_info "Deploying production stack..."
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" up -d --remove-orphans
    log_success "Stack deployed"
    
    # Step 7: Health check
    log_info "Waiting for services to become healthy (15 seconds)..."
    sleep 15
    
    log_info "Service status:"
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" ps
    
    # Step 8: Verify endpoints
    log_info "Verifying API endpoints..."
    
    # Check core-api health
    if docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" exec -T core-api \
        curl -s http://127.0.0.1:8100/core/v1/health > /dev/null 2>&1; then
        log_success "Core API health check passed"
    else
        log_warn "Core API health check not responding yet"
    fi
    
    # Final summary
    log_success "========================================="
    log_success "DEPLOYMENT COMPLETE!"
    log_success "========================================="
    echo ""
    echo "Services deployed on: $(hostname)"
    echo "Deploy path: $DEPLOY_PATH"
    echo ""
    echo "Useful commands:"
    echo "  View logs:        docker compose logs -f core-api"
    echo "  Service status:   docker compose ps"
    echo "  Restart service:  docker compose restart core-api"
    echo "  Database backup:  ls -lh backups/"
    echo ""
}

main "$@"
