#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Dựng lớp reverse proxy + TLS cho staging (nginx-proxy + acme-companion).
#
#   bash scripts/deploy-nginx-proxy.sh
#
# ── Vì sao cần file này ───────────────────────────────────────────────────
#
# `docker-compose.prod.yml:592-593` khai network `nginx-proxy_default` là
# `external: true` và `:561-564` đặt `VIRTUAL_HOST` / `LETSENCRYPT_HOST` cho
# `frontend`. Tức app **đã được viết sẵn để nằm sau một nginx-proxy** — chỉ
# thiếu đúng cái proxy đó. Không có file này thì staging chạy được HTTP qua
# cổng publish, nhưng **không có domain, không có HTTPS**.
#
# nginx-proxy đọc label/env của container và **tự sinh vhost**, nên thêm
# domain mới = thêm 3 biến vào service đó, KHÔNG phải sửa file này.
#
# ── NGUỒN GỐC ──────────────────────────────────────────────────────────────
#
# `docker-compose.nginx-proxy.yml` + `compose.nginx-proxy.env.example` **KHÔNG
# phải do tôi viết** — tìm thấy untracked trong working tree lúc 10:08
# 2026-10-13, không có claim nào giữ, và tham chiếu file script này khi chưa
# tồn tại. Đã backup trước khi đụng:
#   %TEMP%\orphan-nginx-proxy-20261013-100907\
# Hai file đó đã qua `docker compose config --quiet` (exit 0).
#
# ── Thứ tự khởi động ───────────────────────────────────────────────────────
#
#   bootstrap-staging.sh  -> tạo network ngoài `nginx-proxy_default`
#   deploy-nginx-proxy.sh -> proxy + acme        (file này)
#   deploy-staging.sh     -> app (join network đó)
#
# Proxy nên chạy TRƯỚC app: acme-companion chỉ xin được cert khi vhost đã
# tồn tại, mà vhost sinh từ label của app. Chạy sau cũng được — cert sẽ được
# xin lại trong ~60s.
#
# ── Cảnh báo rate limit ────────────────────────────────────────────────────
#
# Let's Encrypt giới hạn **5 cert/domain/tuan**. Nếu chắc chắn muốn thử vòng
# xin cert mà không đụng rate limit thật, bỏ comment `ACME_CA_URI` trong
# `compose.nginx-proxy.env`. Cert staging **không được tin cậy** — chỉ dùng
# để kiểm tra dòng chảy, phải đổi lại trước khi ai đó dùng thật.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vninvest}"
ENV_FILE="${APP_DIR}/compose.nginx-proxy.env"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$APP_DIR/docker-compose.nginx-proxy.yml")

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m[ ok ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[die ]\033[0m %s\n' "$*" >&2; exit 1; }

[ -f "$APP_DIR/docker-compose.nginx-proxy.yml" ] || die "Thiếu ${APP_DIR}/docker-compose.nginx-proxy.yml"
[ -f "$ENV_FILE" ] || die "Thiếu ${ENV_FILE} — cp compose.nginx-proxy.env.example ${ENV_FILE} rồi điền LETSENCRYPT_EMAIL"

# ── Network ─────────────────────────────────────────────────────────────────
# `external: true` ⇒ compose KHÔNG tạo, chỉ attach. Thiếu network thì `up`
# fail với "network nginx-proxy_default declared as external, but could not be
# found". `bootstrap-staging.sh` tạo; ở đây tạo lại cho chắc (idempotent).
log "Đảm bảo network nginx-proxy_default tồn tại"
docker network inspect nginx-proxy_default >/dev/null 2>&1 \
  || docker network create nginx-proxy_default
docker network inspect nginx-proxy_default >/dev/null \
  && ok "network sẵn sàng"

# ── Cổng 80/443 ────────────────────────────────────────────────────────────
# Nếu đã có nginx hệ thống (Ubuntu mặc định) thì nó chiếm 80 ⇒ container
# không khởi động được. Báo rõ thay vì để lỗi khó hiểu kiểu "address in use".
log "Kiểm tra cổng 80/443"
for p in 80 443; do
  if ss -ltn "sport = :$p" 2>/dev/null | grep -q LISTEN; then
    holder=$(ss -ltnp "sport = :$p" 2>/dev/null | grep -o 'users:.*' | head -1)
    warn "Cổng $p đang bị chiếm: ${holder:-khong ro process}"
    warn "Nếu là nginx hệ thống, dừng nó trước:"
    warn "    systemctl disable --now nginx && systemctl mask nginx"
  else
    ok "cổng $p trống"
  fi
done

log "Kiểm tra cấu hình"
"${COMPOSE[@]}" config --quiet || die "config SAI — sửa ${ENV_FILE}"

log "Khởi động nginx-proxy + acme-companion"
"${COMPOSE[@]}" up -d

log "Chờ proxy sẵn sàng (timeout 120s)"
deadline=$(( $(date +%s) + 120 ))
ready=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  if curl -fsS --max-time 5 -o /dev/null http://127.0.0.1/ 2>/dev/null \
     || curl -sS --max-time 5 -o /dev/null http://127.0.0.1/ 2>/dev/null; then
    ready=1; break
  fi
  sleep 5
done
[ "$ready" = "1" ] && ok "nginx-proxy phản hồi trên :80" \
                  || warn "nginx-proxy chưa phản hồi trên :80 — xem log"

log "Trạng thái"
"${COMPOSE[@]}" ps

cat <<EOF

─────────────────────────────────────────────────────────────────
Proxy đang chạy. Bước tiếp theo:

  bash ${APP_DIR}/scripts/deploy-staging.sh

Sau đó app sẽ tự xuất hiện ở domain khai trong VIRTUAL_HOST.
Cert Let's Encrypt duoc xin tu dong khi vhost ton tai (~60s).
Xem progress:
  docker logs -f acme-companion
─────────────────────────────────────────────────────────────────
EOF