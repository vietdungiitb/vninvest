#!/usr/bin/env sh
set -eu

cd /app

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput

echo "[entrypoint] Starting Gunicorn (uvicorn workers)..."
exec gunicorn config.asgi:application \
    -k uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --workers ${GUNICORN_WORKERS:-2} \
    --timeout ${GUNICORN_TIMEOUT:-30} \
    --graceful-timeout 20 \
    --keep-alive 5 \
    --log-level info \
    --access-logfile -
