# HANDOFF — Wave 1 B1.2 kế tiếp (sau B1.1/PR #146)

- **Ngày:** 2026-10-15 · **Người bàn giao:** PM/Tech Lead (phiên B1.1)
- **Trạng thái:** Wave 0 ĐÓNG (6/6 merged) · B1.1 DONE (PR #146 chờ merge) · B1.2+ chưa làm.
  Migration head sau merge: **0029** (B1.1 không migration).

## 1. Wave 1 B1.2 làm gì (kế tiếp — nối lane 3.7.2)

Nối `get_positions`/`get_holdings` cả 3 lane qua `BrokerSyncService` (vnbroker
**3.7.2**, gate 3.8.0 giữ): DNSE `market_type` bắt buộc (`STOCK`); SSI/TCBS
`get_holdings`; TCBS history giới hạn in-day + executions (không `get_order_history`
— đã gỡ). Test với **stub client** (không credential/mạng): DTO chuẩn + mapping
field phòng thủ. Đọc PLAN mục 4 + ADR-006 trước khi khai claim. DB tạm mới
(vd `mbw1_b12`).

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

## 3. Bẫy đã gặp (đừng lặp lại — bổ sung phiên B0.2)

1. (B0.2 mới) `git --work-tree=X checkout -f <sha>` **đổi HEAD của checkout chính**
   (detached) + skew index (M/D ảo), suýt làm hỏng checkout staging `/opt/vninvest`.
   Refresh worktree đúng: `git fetch` + `git --work-tree=X reset --hard <sha>`
   (không đổi HEAD), hoặc xoá + `worktree add` lại. Kiểm chứng vô hại bằng
   `git diff <sha-cu> --stat` (rỗng) trước khi `checkout -f` khôi phục.
2. (B0.2 mới) Helper test do leaf migration (`leaf_nodes`) vỡ ngay slice sau
   (0026 làm 3 test B0.1 `AttributeError`). Ghim tên migration + `project_state`
   tại đúng migration đó — miễn nhiễm leaf tương lai.
3. (B0.2 mới) Model mới (+1) làm C-002 đỏ theo (107→108), không chỉ C-003.
   Regen xong chạy `--check` rồi mới kết luận xanh.

## 4. Bẫy cũ (từ phiên B0.1, vẫn hiệu lực)

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

## 5. Việc dang dở khác

- Claim `multibroker-plan` (nhánh `feat/multibroker-plan-research`) vẫn in-progress —
  giữ cho công việc tài liệu; REQ-001..005 CHƯA GỬI sang vnbroker.
- Sau khi PR #139 merge: `agent-cleanup.ps1 -Branch feat/mbw0-b01-subaccount -Execute`;
  B0.1 migration (0024/0025) thành head mới — B0.2 đọc head sau merge.
- FE trên VPS CHƯA KIỂM CHỨNG (thiếu node_modules) — slice FE đầu (Wave 2) phải
  chứng minh + sửa runbook §12.4.
