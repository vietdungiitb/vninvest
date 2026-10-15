# HANDOFF — Phiên kế tiếp sau Wave 3 Cô lập & gộp danh mục (PR #151 merged)

- **Ngày:** 2026-10-15 · **Người bàn giao:** PM/supervisor Wave 3
- **Trạng thái:** Wave 0/1/2 ĐÓNG · **Wave 3 ĐÓNG (PR #151 merged `2ba62c781`)**.
  Migration head: **0030** (backfill DNSE broker_backed, idempotent). `vnbroker==3.7.2` (gate 3.8.0 giữ).
- **Chuỗi ledger:** Entry 321 (Wave 3 DONE). Claims `mbw3-be`/`mbw3-fe`/`mbw3-sup`: released.

## 1. Đã xong trong phiên này (đọc REPORT_FINAL_MBW3_20261015.md trước)

- Plan Wave 3 + audit độc lập 3 vòng: NEED_REVISION (O-1..O-4+F-05) → NEED_REVISION (O-5 convert) → AGREE.
- 2 agent song song theo tầng (BE/FE disjoint) + sup mount/loop → audit code 0 blocker + 1 major (F1) → loop đóng → gates VPS xanh → 1 PR #151 merged, trail giữ (merge commit).
- Gates cuối: BE 101/101 (12 labels, DB `mbw3_reg` đã dọn) + guard 22/22 · FE 37/37 + i18n:scan 0 + build 32.85s + bundle 1361.0/1363.3 KB (≤1450) · tsc 0 · makemigrations sạch · check-multi-agent 0 lỗi · pre-push 22/22.
- Cleanup: nhánh local + remote đã xoá (chạy sau mục này), worktree agent đã gỡ (junction-trước), VPS dọn DB + worktree (chạy sau mục này).

## 2. Việc kế tiếp: Wave 4 — SOC Broker Ops (P1, ~5 ngày)

Health lane · queue depth · top lỗi · credential expiry · UI kill-switch · audit viewer + CSV (PLAN_MULTI_BROKER_SYNC mục 4). Đọc PLAN mục 4 + ADR-005/006/007 trước khi khai claim.

## 3. Nợ phải trả (ticket mở, chưa ai làm)

| Ticket | Nội dung | Gốc |
|---|---|---|
| TEST-E2E | E2E 2 SubAccount thật (AC1/AC2/AC5-E2E, từ Wave 2) | HANDOFF_MBW2 §3 |
| B3.4-NOTNULL | `AlterField NOT NULL` khi leftovers = 0 (đếm sau deploy) | W2 REPORT_FINAL |
| FULL-BE | Full BE suite (nợ từ Wave 2) | TEST_REPORT §1 |
| RUFF | ruff (nợ từ Wave 2) | TEST_REPORT §1 |
| HYGIENE | Watchlist 400/404 trần pre-existing ngoài scope (audit F2) | AUDIT_MBW3 F2 |
| RUNBOOK-123 | Runbook §12.3 stale `POSTGRES_PASSWORD` → `CORE_DB_PASSWORD` (BE phát hiện, FE chỉ sửa §12.4) | be-gates.md §3 |

## 4. CHƯA CHẠY (đừng báo PASS)

E2E 2 SubAccount thật · full BE suite · ruff · B3.4 leftovers staging-read (đợi deploy 0030).

## 5. Bẫy đã gặp trong phiên (đừng lặp lại)

1. `global-config-drift` FAIL ở mọi checkout (deployed-copy stale) → `node tools/opencode-global/deploy.mjs` (0 file repo). Đừng `--no-verify`.
2. PowerShell `Get-Content|Set-Content -NoNewline` gộp CLAIMS.md thành 1 dòng (L-F04 y hệt) → khôi phục `git show HEAD:<f>` qua **cmd** (byte-exact, tránh PowerShell encoding) → sửa bằng edit tool. KHÔNG shell string-op trên file repo.
3. Ngoặc/chữ tự do trong cột `files` của claim bị gate cảnh báo — path thuần, ghi chú sang cột note (bẫy #8).
4. Mount file ngoài scope làm đỏ test của chính file đó (`getPortfolios is not a function` — lỗi thật) → optional-read guard + rerun.
5. Quote SSH: tránh `|` trong remote quotes (lệnh vỡ thành `command not found`); tách grep hoặc ghi file rồi đọc.
6. `worktree remove` khi còn `node_modules` Linux 733MB trong đó → mất, phải `npm ci` lại (lesson FE). Dời/symlink trước khi remove.
7. 2 worktree không checkout chung 1 branch → nhánh riêng merge vào nhánh tích hợp (giữ 1 PR).
8. `git checkout --` cấm (mất việc chưa commit) — dùng `git show HEAD:<f> > <f>`.

## 6. Quy trình VPS đã chứng minh (dùng lại nguyên văn)

```bash
# BE (§12.3, lưu ý biến CORE_DB_PASSWORD — §12.3 còn ghi sai):
git -C /opt/vninvest worktree add /tmp/wt-<slice> origin/<nhanh>
# DB: echo CREATE DATABASE <db> | docker exec -i vninvest-core-db psql -U vninvest -d postgres
# Chạy: docker run --rm --network vninvest-staging_vninvest_network \
#   -v /tmp/wt-<slice>/packages/core/backend:/app \
#   -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/<db> \
#   -e DJANGO_DEBUG=1 -e DJANGO_SETTINGS_MODULE=vninvest_core.settings \
#   --entrypoint python vninvest-core-api:staging \
#   -m django test <labels> --noinput
# (PW server-side từ CORE_DB_PASSWORD, không quote lồng; -m django chữ thường)
# Dọn: DROP DB + worktree remove --force + prune
# FE (§12.4 đã sửa): /usr/bin/corepack npm (npm chỉ có qua corepack);
#   node_modules Linux giữ tại /tmp/wt-mbw3-fe-vps — tái dùng khi lock trùng
#   (diff -q package-lock.json), symlink thay vì copy/move.
```
