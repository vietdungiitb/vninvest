# HANDOFF — phiên tiếp theo: Wave 0 B0.2 (sau B0.1/PR #139)

- **Ngày:** 2026-10-14 · **Người bàn giao:** PM/Tech Lead (phiên B0.1)
- **Trạng thái Wave 0:** B0.1 DONE (PR #139 chờ merge) · B0.2–B0.6 chưa làm

## 1. B0.2 làm gì (kế tiếp)

`Portfolio` +`kind` (`manual`/`broker_backed`/`aggregate`) +`is_archived` +
bảng `PortfolioBrokerBinding` (portfolio, sub_account, role, is_default; unique).
Migration mới (đọc head trên `dev` SAU khi PR #139 merge — B0.1 thêm 0024/0025 nên
head sẽ là 0025). Test: kind default, binding unique, aggregate-read-only ở tầng
model (enforce ở B3.1, B0.2 chỉ schema). Chạy test trên VPS theo runbook §12.3
(DB tạm mới, vd `mbw0_b02`).

## 2. Quy trình VPS đã chứng minh (dùng lại nguyên văn)

```bash
# Local: code + commit slice (không chạy suite ở local)
# Push nhánh, rồi trên VPS:
cd /opt/vninvest && git fetch origin <nhanh> \
  && git worktree add /tmp/wt-<slice> origin/<nhanh>
# DB tạm: echo DROP/CREATE DATABASE <db> | docker exec -i vninvest-core-db psql -U vninvest -d vninvest_core
# Chạy: docker run --rm --network vninvest-staging_vninvest_network \
#   -v /tmp/wt-<slice>/packages/core/backend:/app \
#   -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/<db> \
#   -e DJANGO_DEBUG=1 --entrypoint python vninvest-core-api:staging \
#   manage.py test <labels> --noinput > /tmp/<slice>.log 2>&1
# (PW lấy server-side: PW=$(grep ^CORE_DB_PASSWORD= /opt/vninvest/compose.staging.env | cut -d= -f2-))
# Dọn: DROP DB + worktree remove --force + prune + rm log
```

- Fail-before: copy test mới sang worktree `origin/dev`, chạy (đỏ), xoá file.
- **Cấm quote lồng** trong lệnh SSH (xem WORKLOG §sự cố #5): không `"..."` trong `'...'`.

## 3. Bẫy đã gặp (đừng lặp lại)

1. Mọi migration mới làm gate `system-design` đỏ (C-003 + catalog) → regen `--write`
   (nhớ `PYTHONIOENCODING=utf-8`) + sửa tay số ở claims.json/01.01/06.01/README.
   Khai các file này vào claim TRƯỚC khi sửa.
2. `Edit` có thể vỡ EOL cả file → `node scripts/normalize-eol.mjs` + `git diff
   --numstat` trước mọi commit.
3. `makemigrations --check` cần `--skip-checks` nếu treo (chưa điều tra gốc).
4. Biến DB staging: `CORE_DB_PASSWORD`, user `vninvest`, host container
   `vninvest-core-db:5432`, image `vninvest-core-api:staging`, network
   `vninvest-staging_vninvest_network`.
5. `git push` dùng `GIT_TERMINAL_PROMPT=0`; PowerShell 5.1 không có `&&`.

## 4. Việc dang dở khác

- Claim `multibroker-plan` (nhánh `feat/multibroker-plan-research`) vẫn in-progress —
  giữ cho công việc tài liệu; REQ-001..005 CHƯA GỬI sang vnbroker.
- Sau khi PR #139 merge: `agent-cleanup.ps1 -Branch feat/mbw0-b01-subaccount -Execute`;
  B0.1 migration (0024/0025) thành head mới — B0.2 đọc head sau merge.
- FE trên VPS CHƯA KIỂM CHỨNG (thiếu node_modules) — slice FE đầu (Wave 2) phải
  chứng minh + sửa runbook §12.4.
