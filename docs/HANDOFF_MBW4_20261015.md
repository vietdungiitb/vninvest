# HANDOFF Wave 4 MBW4 — SOC Broker Ops (DONE, cho PR + cleanup)

Ngay: 2026-10-15 · Nhanh wave: `feat/mbw4-soc-ops` (da gop 2 slices, da push `f6375dcec`)
Claim: `mbw4-be` + `mbw4-fe` = done (merge → released) · Ledger: Entry 322
Plan: `docs/PLAN_WAVE4_SOC_OPS_20261015.md` rev 2 · Evidence: `docs/evidence/mbw4/`

## 1. Trang thai (nguon su that)

- Code xong + gop: BE (B4.0+B4.1+B4.2) + FE (B4.3) + drill (B4.4 co che) — disjoint tuyet doi, 0 conflict.
- Gate xanh: BE VPS 28/28 + makemigrations sach · FE VPS 7/7 + i18n 0 + build + bundle +6.4KB (khong regression) · tsc 0 · check-multi-agent 0 loi · pre-push 22/22.
- CHUA CHAY (ghi ro, cam bao PASS): E2E · full BE · ruff · B3.4 AlterField (staging 0024-0030 chua apply) · HTTP-path drill · doi chieu UI staging.

## 2. Con lai (phien tiep theo / owner)

1. Tao PR `feat/mbw4-soc-ops` -> `dev` (`pwsh -File scripts/agent-pr.ps1`), merge, claims → released.
2. Stage 8 cleanup: DROP DB `mbw4_be` + `mbw1_wave` (orphan da xac minh) + xoa worktree local (`agent-mbw4-be/fe`) + VPS (`/tmp/wt-mbw4-be`, `/tmp/wt-mbw4-fe`, `/tmp/wt-mbw4-merge`, `/tmp/wt-mbw4-base`) + `prune` + xoa nhanh slice local/remote.
3. No dai (ticket rieng): staging migrate 0024-0030 → moi danh gia B3.4 AlterField; staging thieu `DNSE_CREDENTIAL_FERNET_KEY`; nguong bundle operations-center (~2381KB) chua co budget rieng; health poll day can cache (audit Q3).

## 3. Quy trinh VPS da chung minh (dung lai nguyen van)

```bash
# BE (§12.3, nho CORE_DB_PASSWORD + FERNET tam cho test credential):
git -C /opt/vninvest worktree add /tmp/wt-<slice> origin/<nhanh>
#   -v /tmp/wt-<slice>/packages/core/backend:/app \
#   -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/<db> \
#   -e DJANGO_DEBUG=1 -e DJANGO_SETTINGS_MODULE=vninvest_core.settings \
#   -e DNSE_CREDENTIAL_FERNET_KEY="${FERNET_KEY}" \
#   --entrypoint python vninvest-core-api:staging \
#   -m django test <labels> --noinput
# (PW server-side, khong quote long; -m django chu thuong; scp script + chay de tranh vo quote/nested)
# FE (§12.4): /usr/bin/corepack npm (npm chi qua corepack); node_modules Linux npm ci lai
#   (mbw3 khong con); lock khong doi van ci lai vi khong con ban cuu.
```

## 4. Bay moi cua wave (da vao ledger Entry 322)

1. pre-push 4 FAIL gia → rerun cung tree 22/22 (transient, khong `--no-verify`).
2. Worktree moi checkout: thieu node_modules + drift → junction dung chung + `deploy.mjs` **tung checkout**.
3. PowerShell `>` ghi UTF-16 → chi Copy-Item/git-checkout (byte-safe), cam shell-op tren file repo.
4. SSH quote long vo → scp script + `bash` (tranh `|`/quote trong remote).
5. Auditor doc nham baseline (wave base thay vi slice BE) → cross-branch audit phai chi ro ref doi tac.
6. `t()` khong provider tra defaultValue → test i18n assert chu that.
