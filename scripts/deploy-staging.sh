#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Deploy / re-deploy staging trên VPS.
#
#   bash scripts/deploy-staging.sh              # deploy
#   bash scripts/deploy-staging.sh --verify     # chỉ kiểm tra, không deploy
#
# Idempotent, chạy lại được. `set -euo pipefail` ⇒ dừng ngay bước lỗi.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vninvest}"
REPO_BRANCH="${REPO_BRANCH:-dev}"
ENV_FILE="${APP_DIR}/compose.staging.env"
COMPOSE=(docker compose --env-file "$ENV_FILE"
         -f "$APP_DIR/docker-compose.prod.yml"
         -f "$APP_DIR/docker-compose.staging.yml")

VERIFY_ONLY=0
[ "${1:-}" = "--verify" ] && VERIFY_ONLY=1

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[die ]\033[0m %s\n' "$*" >&2; exit 1; }

cd "$APP_DIR"
[ -f "$ENV_FILE" ] || die "Thiếu $ENV_FILE — chạy bootstrap-staging.sh trước."

# ── Verify ─────────────────────────────────────────────────────────────────
verify() {
  log "Kiểm tra stack"
  local rc=0

  echo "--- container ---"
  "${COMPOSE[@]}" ps --format 'table {{.Service}}\t{{.State}}\t{{.Status}}' || rc=1

  echo
  echo "--- compose config (interpolate) ---"
  "${COMPOSE[@]}" config --quiet && ok "config hợp lệ" || { warn "config SAI"; rc=1; }

  echo
  echo "--- API health ---"
  local port
  port=$(grep -E '^STAGING_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 8080)
  if curl -fsS --max-time 10 "http://127.0.0.1:${port}/api/health/" >/dev/null 2>&1; then
    ok "GET /api/health/ = 2xx qua nginx của frontend"
  else
    # health endpoint đúng theo nginx.conf:201-223 là `/api/health` và
    # `/api/health/` (exact match). Thử cả hai.
    if curl -fsS --max-time 10 "http://127.0.0.1:${port}/api/health" >/dev/null 2>&1; then
      ok "GET /api/health = 2xx (bản không có dấu / cuối)"
    else
      warn "GET /api/health[ / ] KHÔNG trả 2xx — xem log core-api"
      rc=1
    fi
  fi

  echo
  echo "--- container chết / restart ---"
  local dead
  dead=$("${COMPOSE[@]}" ps --status exited --status restarting -q 2>/dev/null | wc -l)
  if [ "$dead" -eq 0 ]; then ok "không có container chết"; else warn "${dead} container chết/restart"; rc=1; fi

  echo
  echo "--- 5 service KHÔNG có healthcheck (prod compose) ---"
  echo "    core-worker · core-worker-realtime-prefetch · core-worker-realtime-stream"
  echo "    core-beat · redis-exporter — worker chết là KHÔNG ai báo."
  for svc in core-worker core-worker-realtime-prefetch core-worker-realtime-stream core-beat; do
    n=$("${COMPOSE[@]}" ps --services --filter "status=running" 2>/dev/null | grep -cx "$svc" || true)
    [ "$n" -eq 1 ] && ok "$svc đang chạy" || warn "$svc KHÔNG chạy"
  done

  return $rc
}

if [ "$VERIFY_ONLY" = "1" ]; then verify; exit $?; fi

# ── Deploy ─────────────────────────────────────────────────────────────────
log "Pull code mới nhất (${REPO_BRANCH})"
git fetch origin "$REPO_BRANCH"
git checkout "$REPO_BRANCH"
git pull --ff-only origin "$REPO_BRANCH"
git log -1 --format='  %h %ad %s' --date=short

# Kiểm tra NGAY sau khi pull: code mới có thể kéo theo migration mới, và
# `makemigrations --check` trong entrypoint chạy lúc container boot.
log "Cấu hình hợp lệ?"
"${COMPOSE[@]}" config --quiet || die "config SAI — sửa ${ENV_FILE}"

log "Build image (lần đầu chậm, có thể 10-20 phút)"
"${COMPOSE[@]}" build

log "Khởi động"
# `--wait` chờ healthcheck của các service có healthcheck. 5 worker không có
# healthcheck nên `--wait` không đợi chúng — verify() mới là chỗ kiểm.
"${COMPOSE[@]}" up -d --remove-orphans

log "Chờ API healthy (timeout 300s)"
deadline=$(( $(date +%s) + 300 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  if "${COMPOSE[@]}" ps core-api --format '{{.State}}' 2>/dev/null | grep -q running; then
    if curl -fsS --max-time 5 "http://127.0.0.1:$(grep -E '^STAGING_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 8080)/api/health/" >/dev/null 2>&1; then
      ok "API healthy"; break
    fi
  fi
  sleep 5
done

verify
rc=$?

log "Deploy xong"
"${COMPOSE[@]}" ps
echo
echo "Truy cập (port publish chỉ bind LOOPBACK — không lộ ra Internet):"
echo "  App (cong khai qua proxy): https://$(grep -E '^STAGING_DOMAIN=' "$ENV_FILE" | cut -d= -f2- || echo '<STAGING_DOMAIN>')/"
echo "  App (tren VPS)           : http://127.0.0.1:$(grep -E '^STAGING_HTTP_PORT=' "$ENV_FILE" | cut -d= -f2 || echo 8080)/"
echo "  Grafana (SSH tunnel)     : ssh -L 3001:127.0.0.1:3001 <user>@<VPS_IP>  ->  http://127.0.0.1:3001/"
echo "  Prometheus (SSH tunnel)  : ssh -L 9091:127.0.0.1:9091 <user>@<VPS_IP> ->  http://127.0.0.1:9091/"
echo
echo "Nếu service không lên:  ${COMPOSE[*]} logs --tail=100 <service>"
echo "Nếu migration lỗi:      ${COMPOSE[*]} logs core-api | grep -i migration"
exit $rc