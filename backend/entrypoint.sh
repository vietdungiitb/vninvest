#!/usr/bin/env sh
set -eu

cd /app

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput

echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput

echo "[entrypoint] Starting Daphne..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
