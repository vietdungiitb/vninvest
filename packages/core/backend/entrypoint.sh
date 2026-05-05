#!/bin/sh
# packages/core/backend/entrypoint.sh
# SM-P0.4: Production entrypoint for vninvest-core services.
# Usage: CMD ["api" | "worker" | "beat"]
#
# Container images are immutable — no runtime pip install, no source mounts.
set -eu

ROLE="${1:-api}"
cd /app
export PYTHONPATH=/app/src

echo "[entrypoint] Role: ${ROLE}"

# Shared pre-flight: run DB migrations on api startup only
if [ "${ROLE}" = "api" ]; then
    echo "[entrypoint] Running database migrations..."
    python src/manage.py migrate --noinput

    echo "[entrypoint] Collecting static files..."
    python src/manage.py collectstatic --noinput --clear || true
fi

case "${ROLE}" in
  api)
    echo "[entrypoint] Starting gunicorn (port ${CORE_API_PORT:-8100})..."
    exec gunicorn vninvest_core.wsgi:application \
        --bind "0.0.0.0:${CORE_API_PORT:-8100}" \
        --workers "${GUNICORN_WORKERS:-2}" \
        --threads "${GUNICORN_THREADS:-2}" \
        --worker-class "gthread" \
        --timeout "${GUNICORN_TIMEOUT:-30}" \
        --access-logfile "-" \
        --error-logfile "-" \
        --pythonpath /app/src
    ;;
  worker)
    echo "[entrypoint] Starting Celery worker..."
    exec celery -A vninvest_core worker \
        --loglevel="${CELERY_LOG_LEVEL:-INFO}" \
        --concurrency="${CELERY_CONCURRENCY:-2}" \
        --without-heartbeat \
        --without-gossip \
        --without-mingle
    ;;
  beat)
    echo "[entrypoint] Starting Celery beat..."
    exec celery -A vninvest_core beat \
        --loglevel="${CELERY_LOG_LEVEL:-INFO}" \
        --scheduler django_celery_beat.schedulers:DatabaseScheduler
    ;;
  *)
    echo "[entrypoint] ERROR: Unknown role '${ROLE}'. Must be one of: api | worker | beat"
    exit 1
    ;;
esac
