#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# Cấp quyền SSH key cho VPS staging (14.225.255.47).
#
# Chạy TRÊN VPS bằng user sẽ dùng để deploy — thường qua web console của nhà
# cung cấp (đăng nhập mật khẩu), vì SSH hiện CHƯA vào được.
#
#   bash vps-authorize-key.sh                    # thêm 2 key của repo cho user hiện tại
#   bash vps-authorize-key.sh --user ubuntu      # thêm cho user khác (cần root/sudo)
#   sudo bash vps-authorize-key.sh --harden      # thêm key + TẮT password auth
#   bash vps-authorize-key.sh "ssh-ed25519 AAAA... me@laptop"   # thêm key của bạn
#
# Idempotent: key đã có thì không thêm lại. Không đọc/tạo private key nào.
# Chạy lại nhiều lần không phá gì.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Public key của repo — an toàn để lưu trong git (đây chỉ là public key).
DEFAULT_KEYS=(
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAICUwxHQ2oOhLh7wQ5p9t3bZTYCEzhqs/YKl3BJwIGpnf copilot-deploy"
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIE3VIUMcFWAfu6TS71160Tp73D7MBrjC7h1MylJnPvdj vninvest-deploy-2026"
)

TARGET_USER=""
HARDEN=0
EXTRA_KEYS=()

usage() {
  cat <<'TXT'
vps-authorize-key.sh — thêm public key vào ~/.ssh/authorized_keys một cách idempotent.

Dùng:
  bash vps-authorize-key.sh                    # 2 key của repo cho user hiện tại
  bash vps-authorize-key.sh --user <name>      # cho user khác (cần root/sudo)
  sudo bash vps-authorize-key.sh --harden      # thêm key rồi TẮT password auth
  bash vps-authorize-key.sh "ssh-ed25519 AAAA... comment"   # thêm key khác

Tùy chọn:
  --user <name>   User đích (mặc định: user đang chạy, hoặc $SUDO_USER nếu chạy bằng sudo)
  --harden        Sau khi thêm key: tắt PasswordAuthentication (tạo file trong
                  /etc/ssh/sshd_config.d/). BẮT BUỘC chạy bằng root. Chỉ bật khi
                  đã xác nhận login bằng key thành công từ máy khác.
  -h, --help      In trợ giúp này.
TXT
}

while [ $# -gt 0 ]; do
  case "$1" in
    --user)      [ $# -ge 2 ] || { echo "--user cần tham số" >&2; exit 2; }; TARGET_USER="$2"; shift 2 ;;
    --user=*)    TARGET_USER="${1#*=}"; shift ;;
    --harden)    HARDEN=1; shift ;;
    -h|--help)   usage; exit 0 ;;
    ssh-*|ecdsa-*|sk-*|ecdsa-sk-*|ssh-sk-*) EXTRA_KEYS+=("$1"); shift ;;
    *)           echo "Tham số không hợp lệ: $1" >&2; usage >&2; exit 2 ;;
  esac
done

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[die ]\033[0m %s\n' "$*" >&2; exit 1; }

RUN_UID="${EUID:-$(id -u)}"
IS_ROOT=0
[ "$RUN_UID" -eq 0 ] && IS_ROOT=1

# ── Xác định user đích ────────────────────────────────────────────────────
if [ -z "$TARGET_USER" ]; then
  if [ "$IS_ROOT" -eq 1 ] && [ -n "${SUDO_USER:-}" ]; then
    TARGET_USER="$SUDO_USER"
  else
    TARGET_USER="$(id -un)"
  fi
fi
id "$TARGET_USER" >/dev/null 2>&1 || die "User '$TARGET_USER' không tồn tại trên máy này."

HOME_DIR="$(getent passwd "$TARGET_USER" | cut -d: -f6)"
[ -n "$HOME_DIR" ] && [ -d "$HOME_DIR" ] || die "Không tìm thấy home dir của '$TARGET_USER'."

SSH_DIR="$HOME_DIR/.ssh"
AUTH="$SSH_DIR/authorized_keys"
log "User đích: $TARGET_USER  (home: $HOME_DIR)"

# ── Thêm key (idempotent) ─────────────────────────────────────────────────
ALL_KEYS=("${DEFAULT_KEYS[@]}")
[ "${#EXTRA_KEYS[@]}" -gt 0 ] && ALL_KEYS+=("${EXTRA_KEYS[@]}")

mkdir -p "$SSH_DIR"
chmod 700 "$SSH_DIR"
touch "$AUTH"
chmod 600 "$AUTH"

added=0
present=0
for k in "${ALL_KEYS[@]}"; do
  [ -n "$k" ] || continue
  if grep -qF -- "$k" "$AUTH"; then
    present=$((present + 1))
    printf '  \033[1;32m[đã có ]\033[0m %s\n' "${k##* }"
  else
    printf '%s\n' "$k" >> "$AUTH"
    added=$((added + 1))
    printf '  \033[1;36m[thêm   ]\033[0m %s\n' "${k##* }"
  fi
done

sort -u "$AUTH" -o "$AUTH"
chmod 600 "$AUTH"

if [ "$IS_ROOT" -eq 1 ] && [ "$TARGET_USER" != "root" ]; then
  chown -R "$TARGET_USER":"$TARGET_USER" "$SSH_DIR"
fi

TOTAL="$(grep -c . "$AUTH" 2>/dev/null || echo 0)"
log "Xong: thêm $added · đã có $present · tổng $TOTAL key trong authorized_keys."

# ── Tùy chọn: tắt password auth ───────────────────────────────────────────
if [ "$HARDEN" -eq 1 ]; then
  [ "$IS_ROOT" -eq 1 ] || die "--harden cần chạy bằng root (sudo)."
  [ "${#ALL_KEYS[@]}" -gt 0 ] || die "Không có key nào → từ chối --harden (sẽ tự khoá SSH)."
  log "Harden sshd: tắt PasswordAuthentication"
  mkdir -p /etc/ssh/sshd_config.d
  cat > /etc/ssh/sshd_config.d/99-vninvest-hardening.conf <<'EOF'
# Do scripts/vps-authorize-key.sh --harden sinh ra.
# Xoá file này + restart ssh nếu cần đăng nhập lại bằng mật khẩu.
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  SSHD_BIN="$(command -v sshd || true)"
  if [ -n "$SSHD_BIN" ]; then
    "$SSHD_BIN" -t || die "sshd_config sai cú pháp — đã dừng, KHÔNG restart. Sửa file rồi thử lại."
  fi
  if systemctl restart ssh 2>/dev/null; then :; elif systemctl restart sshd 2>/dev/null; then :; else
    warn "Không restart được sshd tự động — restart thủ công: systemctl restart ssh"
  fi
  warn "Đã tắt password auth. KIỂM TRA login bằng key từ máy khác TRƯỚC khi đóng phiên này!"
fi

log "Bước tiếp theo (từ máy Windows của bạn):"
printf '  pwsh -File scripts/vps-ssh-check.ps1 -User %s\n' "$TARGET_USER"
printf '  ssh -i "$HOME/.ssh/id_ed25519" %s@14.225.255.47 "echo OK"\n' "$TARGET_USER"
