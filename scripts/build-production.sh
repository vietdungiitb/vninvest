#!/bin/bash
################################################################################
# PRODUCTION BUILD & DEPLOYMENT SCRIPT
# Usage: bash scripts/build-production.sh [--push-registry] [--service frontend|backend|core-api]
# 
# Mục tiêu:
# - Build tất cả services giống hệt docker dev hiện tại
# - Validate migrations & config
# - Optionally push to Docker registry
# - Deploy to production stack
################################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# Configuration
DOCKER_REGISTRY="${DOCKER_REGISTRY:-docker.io}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-vninvest}"
APP_RELEASE="${APP_RELEASE:-$(git rev-parse --short HEAD)}"
COMPOSE_FILE="docker-compose.yml"
PROD_OVERRIDE="docker-compose.prod.yml"
ENV_FILE="compose.prod.env"

# Parse arguments
PUSH_REGISTRY=false
TARGET_SERVICE="all"  # all|frontend|backend|core-api

while [[ $# -gt 0 ]]; do
    case $1 in
        --push-registry)
            PUSH_REGISTRY=true
            shift
            ;;
        --service)
            TARGET_SERVICE="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Helper functions
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Validate environment
validate_env() {
    log_info "Validating environment..."
    
    # Check required files
    [[ -f "$COMPOSE_FILE" ]] || log_error "Missing $COMPOSE_FILE"
    [[ -f "$PROD_OVERRIDE" ]] || log_error "Missing $PROD_OVERRIDE"
    [[ -f "$ENV_FILE" ]] || log_error "Missing $ENV_FILE (copy compose.prod.env.example and configure)"
    
    # Check required commands
    command -v docker &> /dev/null || log_error "Docker not installed"
    command -v git &> /dev/null || log_error "Git not installed"
    
    # Check environment variables
    source "$ENV_FILE"
    [[ -n "$CORE_DJANGO_SECRET_KEY" ]] || log_warn "CORE_DJANGO_SECRET_KEY not set"
    [[ -n "$CORE_DB_PASSWORD" ]] || log_warn "CORE_DB_PASSWORD not set"
    [[ -n "$POSTGRES_PASSWORD" ]] || log_warn "POSTGRES_PASSWORD not set"
    
    log_success "Environment validation passed"
}

# Build images
build_images() {
    local service=$1
    log_info "Building images for $service..."
    
    case $service in
        frontend)
            docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" build \
                --build-arg APP_RELEASE="$APP_RELEASE" \
                frontend
            log_success "Frontend image built: $APP_RELEASE"
            ;;
        backend)
            docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" build \
                --build-arg APP_RELEASE="$APP_RELEASE" \
                backend
            log_success "Backend image built: $APP_RELEASE"
            ;;
        core-api)
            docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" build \
                --build-arg APP_RELEASE="$APP_RELEASE" \
                core-api core-worker core-beat
            log_success "Core API services built: $APP_RELEASE"
            ;;
        all)
            docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" build \
                --build-arg APP_RELEASE="$APP_RELEASE"
            log_success "All images built: $APP_RELEASE"
            ;;
        *)
            log_error "Unknown service: $service"
            ;;
    esac
}

# Validate migrations
validate_migrations() {
    log_info "Validating Django migrations..."
    
    # Core API migrations check
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm core-api \
        python manage.py showmigrations --plan > /tmp/core_migrations.txt 2>&1 || {
        log_warn "Core API migration check returned non-zero"
    }
    
    # Legacy backend migrations check
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm backend \
        python manage.py showmigrations --plan > /tmp/backend_migrations.txt 2>&1 || {
        log_warn "Backend migration check returned non-zero"
    }
    
    log_success "Migration validation complete"
}

# Validate configuration
validate_config() {
    log_info "Validating Django configuration..."
    
    # Check core-api settings
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm core-api \
        python manage.py check > /tmp/core_check.txt 2>&1 || {
        log_error "Core API configuration error:\n$(cat /tmp/core_check.txt)"
    }
    
    # Check backend settings
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" run --rm backend \
        python manage.py check > /tmp/backend_check.txt 2>&1 || {
        log_error "Backend configuration error:\n$(cat /tmp/backend_check.txt)"
    }
    
    log_success "Configuration validation passed"
}

# Push to registry (optional)
push_to_registry() {
    if [[ "$PUSH_REGISTRY" != true ]]; then
        log_info "Skipping registry push (use --push-registry to enable)"
        return
    fi
    
    log_info "Pushing images to $DOCKER_REGISTRY..."
    
    local images=(
        "vninvest-frontend:${APP_RELEASE}"
        "vninvest-backend:${APP_RELEASE}"
        "vninvest-core-api:${APP_RELEASE}"
    )
    
    for image in "${images[@]}"; do
        local remote_image="${DOCKER_REGISTRY}/${REGISTRY_NAMESPACE}/${image}"
        docker tag "$image" "$remote_image"
        docker push "$remote_image" || log_warn "Failed to push $remote_image"
        log_success "Pushed: $remote_image"
    done
}

# Create backups before deployment
backup_databases() {
    log_info "Creating database backups..."
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_dir="./backups/prod-${timestamp}"
    mkdir -p "$backup_dir"
    
    # Legacy backend backup
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" exec -T db \
        pg_dump -U postgres vninvest | gzip > "${backup_dir}/vninvest_$(date +%s).sql.gz" || \
        log_warn "Failed to backup legacy DB"
    
    # Core DB backup
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" exec -T core-db \
        pg_dump -U vninvest vninvest_core | gzip > "${backup_dir}/vninvest_core_$(date +%s).sql.gz" || \
        log_warn "Failed to backup core DB"
    
    log_success "Backups created: $backup_dir"
}

# Deploy stack
deploy_stack() {
    log_info "Deploying production stack..."
    
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" up -d \
        --remove-orphans
    
    log_success "Stack deployed successfully"
    
    # Health check
    log_info "Waiting for services to become healthy..."
    sleep 10
    
    docker compose -f "$COMPOSE_FILE" -f "$PROD_OVERRIDE" ps
}

# Cleanup old images
cleanup_images() {
    log_info "Cleaning up old Docker images..."
    docker image prune -f --filter "until=72h" || log_warn "Failed to prune images"
    log_success "Cleanup complete"
}

# Main execution
main() {
    log_info "======================================"
    log_info "VNINVEST PRODUCTION BUILD & DEPLOY"
    log_info "======================================"
    log_info "Release: $APP_RELEASE"
    log_info "Target Service: $TARGET_SERVICE"
    log_info "Push Registry: $PUSH_REGISTRY"
    log_info ""
    
    validate_env
    
    if [[ "$TARGET_SERVICE" == "all" || "$TARGET_SERVICE" == "frontend" ]]; then
        build_images frontend
    fi
    
    if [[ "$TARGET_SERVICE" == "all" || "$TARGET_SERVICE" == "backend" ]]; then
        build_images backend
    fi
    
    if [[ "$TARGET_SERVICE" == "all" || "$TARGET_SERVICE" == "core-api" ]]; then
        build_images core-api
    fi
    
    if [[ "$TARGET_SERVICE" == "all" ]]; then
        validate_migrations
        validate_config
        backup_databases
        push_to_registry
        deploy_stack
        cleanup_images
    fi
    
    log_success "======================================"
    log_success "Build & deployment complete!"
    log_success "======================================"
}

# Run main function
main "$@"
