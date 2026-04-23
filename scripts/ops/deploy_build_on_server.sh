#!/usr/bin/env bash
set -euo pipefail

# Usage example:
# APP_RELEASE=2026.04.23-local1 ./scripts/ops/deploy_build_on_server.sh
# Optional env:
#   STACK_FILE=portainer-stack-nginx-proxy.yml
#   BACKEND_IMAGE=vninvest-backend
#   FRONTEND_IMAGE=vninvest-frontend
#   DOMAIN_URL=https://vnivest.edusuccess.vn

STACK_FILE="${STACK_FILE:-portainer-stack-nginx-proxy.yml}"
OVERRIDE_FILE="${OVERRIDE_FILE:-compose.local-build.override.yml}"
BACKEND_IMAGE="${BACKEND_IMAGE:-vninvest-backend}"
FRONTEND_IMAGE="${FRONTEND_IMAGE:-vninvest-frontend}"
APP_RELEASE="${APP_RELEASE:-$(date +%Y.%m.%d-%H%M)}"
DOMAIN_URL="${DOMAIN_URL:-https://vnivest.edusuccess.vn}"

if [ ! -f "${STACK_FILE}" ]; then
  echo "ERROR: Cannot find stack file: ${STACK_FILE}"
  exit 1
fi

if [ ! -f "${OVERRIDE_FILE}" ]; then
  echo "ERROR: Cannot find override file: ${OVERRIDE_FILE}"
  exit 1
fi

echo "[1/8] Pull latest code from main"
git fetch origin
git checkout main
git pull origin main

echo "[2/8] Build backend image: ${BACKEND_IMAGE}:${APP_RELEASE}"
docker build -t "${BACKEND_IMAGE}:${APP_RELEASE}" ./backend

echo "[3/8] Build frontend image: ${FRONTEND_IMAGE}:${APP_RELEASE}"
docker build -t "${FRONTEND_IMAGE}:${APP_RELEASE}" ./frontend

echo "[4/8] Use compose override for local-build deploy: ${OVERRIDE_FILE}"

echo "[5/8] Export release variables for compose"
export BACKEND_IMAGE
export FRONTEND_IMAGE
export APP_RELEASE

echo "[6/8] Deploy updated containers"
docker compose -f "${STACK_FILE}" -f "${OVERRIDE_FILE}" up -d --remove-orphans

echo "[7/8] Run Django migration"
docker compose -f "${STACK_FILE}" -f "${OVERRIDE_FILE}" exec -T backend python manage.py migrate --noinput

echo "[8/8] Verify status + health"
docker compose -f "${STACK_FILE}" -f "${OVERRIDE_FILE}" ps
curl -fsS "${DOMAIN_URL}/api/health/" | head -c 500 || true

echo ""
echo "DONE: Build-on-server deployment completed"
echo "Release: ${APP_RELEASE}"
