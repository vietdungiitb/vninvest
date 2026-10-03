#!/usr/bin/env bash
# BL-04: PostgreSQL automated backup — custom format + sha256 + 30-day retention.
# Cron (prod host): 0 2 * * * /opt/vninvest/infra/backup/pg-backup.sh >> /var/log/pg-backup.log 2>&1
# Required env: PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD BACKUP_DIR (ALERT_WEBHOOK optional)
set -euo pipefail

: "${PGHOST:?must be set}" "${PGDATABASE:?must be set}" "${PGUSER:?must be set}"
: "${PGPASSWORD:?must be set}" "${BACKUP_DIR:?must be set}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
TS="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/${PGDATABASE}_${TS}.dump"

mkdir -p "$BACKUP_DIR"
START=$(date +%s)
if pg_dump -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" -d "$PGDATABASE" -Fc -Z6 -f "$OUT"; then
  sha256sum "$OUT" > "${OUT}.sha256"
  SIZE=$(du -h "$OUT" | cut -f1)
  DUR=$(( $(date +%s) - START ))
  echo "[OK] $OUT size=$SIZE duration=${DUR}s"
else
  echo "[FAIL] pg_dump failed at $(date -u +%FT%TZ)" >&2
  [ -n "${ALERT_WEBHOOK:-}" ] && curl -sf -X POST "$ALERT_WEBHOOK" -d '{"text":"PG backup FAILED"}' || true
  exit 1
fi

# Retention: keep newest $RETENTION_DAYS dumps
ls -t "${BACKUP_DIR}/${PGDATABASE}_"*.dump 2>/dev/null | tail -n +$((RETENTION_DAYS + 1)) | xargs -r rm -f -- {}
ls -t "${BACKUP_DIR}/${PGDATABASE}_"*.dump.sha256 2>/dev/null | tail -n +$((RETENTION_DAYS + 1)) | xargs -r rm -f -- {} || true
echo "[OK] retention enforced (keep=$RETENTION_DAYS)"
