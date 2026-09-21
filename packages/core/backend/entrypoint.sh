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

    echo "[entrypoint] Repairing beat schedule (re-enable 4 critical jobs)..."
    python src/manage.py repair_beat_schedule || echo "[entrypoint] WARN: repair_beat_schedule failed, continuing"
fi

case "${ROLE}" in
  api)
    echo "[entrypoint] Starting daphne (port ${CORE_API_PORT:-8100})..."
    exec daphne \
      --bind 0.0.0.0 \
      --port "${CORE_API_PORT:-8100}" \
      vninvest_core.asgi:application
    ;;
  worker)
    WORKER_QUEUES="${CELERY_QUEUES:-celery}"
    WORKER_CONCURRENCY="${CELERY_CONCURRENCY:-2}"
    WORKER_POOL="${CELERY_POOL:-prefork}"
    # Slice E (QueueRecovery): recycle worker chống leak/OOM tích lũy ở job marathon
    # (deep-history/pre5y ăn RAM theo thời gian). 0 = tắt recycle (giữ hành vi cũ).
    WORKER_MAX_TASKS="${CELERY_MAX_TASKS_PER_CHILD:-0}"
    echo "[entrypoint] Starting Celery worker on queue(s): ${WORKER_QUEUES} (max-tasks-per-child: ${WORKER_MAX_TASKS})..."
    # shellcheck disable=SC2086
    if [ "${WORKER_MAX_TASKS}" -gt 0 ] 2>/dev/null; then
      exec celery -A vninvest_core worker --loglevel="${CELERY_LOG_LEVEL:-INFO}" --pool="${WORKER_POOL}" --concurrency="${WORKER_CONCURRENCY}" --queues="${WORKER_QUEUES}" --max-tasks-per-child="${WORKER_MAX_TASKS}" --without-heartbeat --without-gossip --without-mingle
    else
      exec celery -A vninvest_core worker --loglevel="${CELERY_LOG_LEVEL:-INFO}" --pool="${WORKER_POOL}" --concurrency="${WORKER_CONCURRENCY}" --queues="${WORKER_QUEUES}" --without-heartbeat --without-gossip --without-mingle
    fi
    ;;
  beat)
    echo "[entrypoint] Repairing beat schedule (re-enable 4 critical jobs)..."
    python src/manage.py repair_beat_schedule || echo "[entrypoint] WARN: repair_beat_schedule failed, continuing"
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
