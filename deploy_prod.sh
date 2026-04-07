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

echo "[2/5] Build containers"
docker compose --env-file .env.production build

echo "[3/5] Start services"
docker compose --env-file .env.production up -d

echo "[4/5] Check service status"
docker compose ps

echo "[5/5] Health check (container logs tail)"
docker compose logs --tail=80 backend

echo "Done. App should be reachable at http://<server-ip>/ (or your domain)."
