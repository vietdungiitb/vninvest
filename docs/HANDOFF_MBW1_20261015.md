# HANDOFF — Wave 2 Broker Hub UI kế tiếp (sau Wave 1)

- **Ngày:** 2026-10-15 · **Người bàn giao:** PM/Tech Lead (phiên Wave 1)
- **Trạng thái:** Wave 0 ĐÓNG (6/6 merged) · B1.1 DONE (PR #146 merged) · **Wave 1 B1.2–B1.6 DONE** (PR chờ merge).
  Migration head: **0029** (Wave 1 không migration — `makemigrations --check` sạch).
- **Gate 3.8.0 giữ:** `requirements.txt:38` vẫn `vnbroker==3.7.2`.

## 1. Wave 2 làm gì (Broker Hub UI, P0/P1, ~9 ngày, 2 agent)

B2.1 `/broker`: 3 tile multi-account + badge capability · B2.2 connect
schema-driven 3 lane · B2.3 Account Manager 4 tab (Vị thế/Sổ lệnh/Khớp lệnh/Số dư,
mọi dòng badge provider + tiểu khoản) · B2.4 Sync Center · B2.5 chiều "nguồn"
trong holdings workspace · B2.6 hợp nhất 2 bề mặt broker về `/broker` · B2.7 i18n
VI/EN (`i18n:scan` 0 thiếu). Chi tiết: PLAN mục 4. API đã sẵn: 9 endpoint
`views_broker.py` + catalog 1483 (B1.6).

## 2. Quy trình VPS đã chứng minh (dùng lại nguyên văn)

```bash
# Local: code + commit slice (không chạy suite ở local)
# Push nhánh, rồi trên VPS:
git -C /tmp/wt-w1 fetch origin <nhanh> && git -C /tmp/wt-w1 reset --hard origin/<nhanh>
# DB tạm: echo CREATE DATABASE <db> | docker exec -i vninvest-core-db psql -U vninvest -d postgres
# Chạy: docker run --rm --network vninvest-staging_vninvest_network \
#   -v /tmp/wt-w1/packages/core/backend:/app \
#   -e CORE_DATABASE_URL=postgresql://vninvest:${PW}@vninvest-core-db:5432/<db> \
#   -e DJANGO_DEBUG=1 -e DJANGO_SETTINGS_MODULE=vninvest_core.settings \
#   --entrypoint python vninvest-core-api:staging \
#   -m django test <labels> --noinput
# (PW lấy server-side: PW=$(grep ^CORE_DB_PASSWORD= /opt/vninvest/compose.staging.env | cut -d= -f2-))
# Dọn: echo DROP DATABASE IF EXISTS <db> | docker exec -i ... + rm probe file /tmp
```

- Fail-before: copy test mới sang worktree `origin/dev`, chạy (đỏ), xoá file.
- **Cấm quote lồng** trong lệnh SSH: không `"..."` trong `'...'` — pipe qua stdin.
- Worktree còn trên VPS: `/tmp/wt-w1` (nhánh wave), `/tmp/wt-base` (dev) — dùng lại hoặc xoá sau merge.

## 3. Bẫy Wave 1 (đừng lặp lại)

1. Mock chỉ kiểu dữ liệu thật — MagicMock trong DRF Response gây đệ quy vô hạn + OOM container.
2. Test dính giờ VN (quiet 17:00–08:30) phải khóa `_beat_in_quiet_hours`; giữ 1 test phủ đường quiet thật.
3. `Edit` vỡ EOL cả file → `node scripts/normalize-eol.mjs` + `git diff --numstat` trước commit.
4. `makemigrations --check` cần `--skip-checks` nếu treo; B1.6 đổi route → regen system-design + sửa tay claims.json/01.01.
5. `git push` dùng `GIT_TERMINAL_PROMPT=0`; PowerShell 5.1 không có `&&`/`tail`/`grep`.

## 4. Việc dang dở khác

- Claim `multibroker-plan` vẫn in-progress (tài liệu); REQ-001..005 CHƯA GỬI sang vnbroker.
- FE trên VPS CHƯA KIỂM CHỨNG (thiếu node_modules) — slice FE đầu Wave 2 phải chứng minh + sửa runbook §12.4.
- Sau merge PR Wave 1: `agent-cleanup.ps1 -Branch feat/mbw1-sync-engine -Execute` + DROP worktree/DB tạm trên VPS.
