#!/usr/bin/env sh
# Cai hook rieng cho worktree hien tai.
#
# Dung `core.hooksPath` theo worktree (git >= 2.20 + extensions.worktreeConfig).
# Main working tree van dung .husky/ — KHONG bi thay doi.
#
# Chay 1 lan, dau tien, o moi worktree agent:
#     sh scripts/agent-install-hooks.sh

set -e
root=$(git rev-parse --show-toplevel)
cd "$root"

ver=$(git version | awk '{print $3}' | cut -d. -f1)
minor=$(git version | awk '{print $3}' | cut -d. -f2)
if [ "$ver" -lt 2 ] || { [ "$ver" -eq 2 ] && [ "$minor" -lt 20 ]; }; then
  echo "Can git >= 2.20 de core.hooksPath per-worktree. Ban dang co $(git --version)" >&2
  exit 1
fi

git config extensions.worktreeConfig true
git config --worktree core.hooksPath .githooks

chmod +x .githooks/pre-commit .githooks/pre-push 2>/dev/null || true

echo "Da cai hook cho worktree nay:"
echo "  branch    : $(git rev-parse --abbrev-ref HEAD)"
echo "  hooksPath : $(git config --worktree core.hooksPath)"
echo ""
echo "Kiem tra:"
echo "  worktree : $(git config --worktree core.hooksPath)"
echo "  main tree: $(git config --get core.hooksPath 2>/dev/null || echo '(khong doi)')"
echo ""
echo "Huy hook (khi debug):"
echo "  git config --worktree --unset core.hooksPath"
