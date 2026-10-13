#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Bootstrap VPS staging — chạy MỘT LẦN trên máy mới.
#
#   ssh user@14.225.255.47 'bash -s' < scripts/bootstrap-staging.sh
#
# Idempotent: chạy lại không phá. Mỗi bước đều `set -e` để dừng sớm.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/vninvest}"
STAGING_DOMAIN="${STAGING_DOMAIN:-}"
REPO_URL="${REPO_URL:-https://github.com/vietdungiitb/vninvest.git}"
REPO_BRANCH="${REPO_BRANCH:-dev}"

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[die ]\033[0m %s\n' "$*" >&2; exit 1; }

# ── 1. Kiểm tra RAM trước khi làm bất cứ gì ────────────────────────────────
# Mục đích của staging là thay local 13.7 GB thiếu RAM. VPS thiếu tệ hơn thì
# vô nghĩa — nói ngay từ đầu còn hơn deploy xong rồi mới biết.
log "Thông tin máy"
TOTAL_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
CPUS=$(nproc)
DISK_GB=$(df -BG --output=avail / | tail -1 | tr -dc '0-9')
echo "  RAM   : ${TOTAL_MB} MB"
echo "  CPU   : ${CPUS} vCPU"
echo "  Disk  : ${DISK_GB} GB trống ở /"

# 13 service + image build cần tối thiểu ~4 GB. Dưới ngưỡng này thì
# `docker compose up` sẽ OOM-kill chính nó giữa chừng.
NEED_MB=3800
if [ "$TOTAL_MB" -lt "$NEED_MB" ]; then
  warn "RAM ${TOTAL_MB} MB < ngưỡng khuyến nghị ${NEED_MB} MB."
  warn "Nếu VPS chỉ ~2 GB, hãy GIẢM resource trong compose.staging.env.example"
  warn "(mục RESOURCE) hoặc bỏ prometheus/grafana trước khi deploy."
fi
[ "$DISK_GB" -lt 20 ] && die "Disk ${DISK_GB} GB — không đủ cho image build (cần >= 20 GB)."

# ── 1b. Gói nền (git/gnupg/curl/ca-certificates) ──────────────────────────
# VPS Ubuntu trắng thường KHÔNG có `git` lẫn `gpg` (đã gặp thật 2026-10-13).
# Script cần cả hai: `gpg` cho keyring Docker (§2), `git` để clone repo (§3).
# Thiếu thì lỗi rất khó hiểu ở GIỮA script. Image cloud đôi khi còn có apt
# hỏng sẵn (`linux-firmware` thiếu gói con) ⇒ `--fix-broken` trước.
NEED_PKGS=""
command -v git  >/dev/null 2>&1 || NEED_PKGS="$NEED_PKGS git"
command -v gpg  >/dev/null 2>&1 || NEED_PKGS="$NEED_PKGS gnupg"
command -v curl >/dev/null 2>&1 || NEED_PKGS="$NEED_PKGS curl"
[ -d /etc/ssl/certs ] || NEED_PKGS="$NEED_PKGS ca-certificates"
if [ -n "$NEED_PKGS" ]; then
  log "Cài gói nền:$NEED_PKGS"
  export DEBIAN_FRONTEND=noninteractive
  dpkg --configure -a || true
  apt-get update -qq || true
  apt-get install -y -qq $NEED_PKGS \
    || { apt-get -y -qq --fix-broken install && apt-get install -y -qq $NEED_PKGS; }
fi

# ── 2. Docker ──────────────────────────────────────────────────────────────
if ! command -v docker >/dev/null 2>&1; then
  log "Cài Docker Engine + compose plugin"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg]" \
    "https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
else
  log "Docker đã có: $(docker --version)"
fi
docker compose version >/dev/null 2>&1 || die "Thiếu plugin 'docker compose' (v2). Cài docker-compose-plugin."

# Swap: Postgres + build Vite đều cần. Không có swap thì OOM-kill chứ không
# phải chậm — OOM-kill mất dữ liệu giữa chừng.
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  log "Tạo 4 GB swap (build Vite + Postgres cần, thiếu thì bị OOM-kill chứ không phải chậm)"
  fallocate -l 4G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=4096
  chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ── 3. Repo ────────────────────────────────────────────────────────────────
log "Clone repo vào ${APP_DIR}"
if [ ! -d "${APP_DIR}/.git" ]; then
  install -d -m 0755 "$(dirname "$APP_DIR")"
  git clone --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
else
  warn "Repo đã tồn tại — bỏ qua clone (deploy-staging.sh sẽ pull)"
fi
chmod +x "${APP_DIR}"/scripts/*staging.sh 2>/dev/null || true

# ── 4. Network ─────────────────────────────────────────────────────────────
# `docker-compose.prod.yml:592-593` khai `nginx-proxy_default` là
# `external: true`. Không có network này thì `docker compose up` fail ngay
# với "network ... declared as external, but could not be found".
log "Tạo network ngoài nginx-proxy_default (nếu chưa có)"
docker network inspect nginx-proxy_default >/dev/null 2>&1 \
  || docker network create nginx-proxy_default

# ── 5. Env file ────────────────────────────────────────────────────────────
if [ ! -f "${APP_DIR}/compose.staging.env" ]; then
  log "Tạo compose.staging.env từ template"
  cp "${APP_DIR}/compose.staging.env.example" "${APP_DIR}/compose.staging.env"
  chmod 600 "${APP_DIR}/compose.staging.env"
  warn "compose.staging.env ĐÃ TẠO nhưng còn placeholder <...>."
  warn "Phải điền TẤT CẢ giá trị trước khi deploy, nếu không"
  warn "'docker compose config' sẽ dừng ở lúc parse."
  echo
  echo "  Lệnh sinh secret:"
  echo "    openssl rand -base64 48   # CORE_DJANGO_SECRET_KEY, CORE_PAT_PEPPER"
  echo "    openssl rand -base64 24   # CORE_DB_PASSWORD, GRAFANA_ADMIN_PASSWORD"
  echo "    openssl rand -base64 32   # BROKER_SECRET_KEY"
  echo "    python3 -c \"from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())\""
  echo
else
  warn "compose.staging.env đã tồn tại — giữ nguyên (KHÔNG ghi đè secret)."
fi

# ── 6. Kiểm tra cấu hình NGAY, trước khi build ───────────────────────────
# `docker compose config` chỉ interpolate — không build, không pull. Rẻ và
# bắt lỗi placeholder trong ~2 giây, thay vì build 15 phút rồi mới biết.
log "Kiểm tra cấu hình (chưa build, chỉ interpolate)"
cd "$APP_DIR"
if docker compose \
      --env-file compose.staging.env \
      -f docker-compose.prod.yml \
      -f docker-compose.staging.yml \
      config --quiet; then
  echo "  OK — cấu hình hợp lệ."
else
  die "Cấu hình SAI. Sửa compose.staging.env rồi chạy lại."
fi

if [ -n "$STAGING_DOMAIN" ]; then
  log "Nhắc: trỏ DNS '$STAGING_DOMAIN' -> IP của VPS TRƯỚC khi deploy"
fi

cat <<EOF

─────────────────────────────────────────────────────────────────
Bootstrap xong. Bước tiếp theo:

  1. Sửa ${APP_DIR}/compose.staging.env  (điền hết placeholder <...>)
  2. ssh rồi chạy:  bash ${APP_DIR}/scripts/deploy-staging.sh
─────────────────────────────────────────────────────────────────
EOF