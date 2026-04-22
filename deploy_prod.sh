#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.production ]; then
  echo "[ERROR] Missing .env.production at repo root"
  echo "Copy from .env.production.example and fill values."
  exit 1
fi

if [ ! -f backend/.env.production ]; then
  echo "[ERROR] Missing backend/.env.production"
  echo "Copy from backend/.env.production.example and fill values."
  exit 1
fi

echo "[1/5] Pull latest code"
git pull origin main

APP_RELEASE="${APP_RELEASE:-$(git rev-parse --short HEAD)}"
export APP_RELEASE

echo "[2/5] Build containers for APP_RELEASE=${APP_RELEASE}"
docker compose --env-file .env.production -f docker-compose.prod.yml build --pull backend celery_worker celery_beat frontend

echo "[3/5] Start services"
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --force-recreate backend celery_worker celery_beat frontend

echo "[4/5] Check service status"
docker compose --env-file .env.production -f docker-compose.prod.yml ps

echo "[5/5] Health check (container logs tail)"
docker compose --env-file .env.production -f docker-compose.prod.yml logs --tail=80 backend

echo "Done. App should be reachable at http://<server-ip>/ (or your domain)."
