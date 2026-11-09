# B6/B7 — evidence VPS + gates (a5-openclaw) — 2026-11-09

**Revision**: `809c2076c` · **Branch**: `feat/a5-openclaw` · **Base**: `0be88862c`.

## B6 TDD (chạy thật trên VPS staging `vninvest-core-api`, `docker cp` + restore)

1. **RED (fail-before)**: `docker cp` **chỉ** file test mới (chưa sửa code) vào container → `docker exec ... manage.py test --noinput tests.test_ai_client_openclaw.OpenClawSupportPositioningTests -v 2` → **FAIL** tại `test_a5...: assertIn('tính năng hỗ trợ đang chưa bật', detail)` — `AssertionError: 'tính năng hỗ trợ đang chưa bật' not found in 'dịch vụ openclaw chưa được cấu hình trên máy chủ...'`. Lỗi gốc đúng như B1 đo (`grep -c "tính năng hỗ trợ" = 0`).
2. **GREEN**: `docker cp` `openclaw.py` mới (sau `normalize-eol --fix`) → chạy lại test → **OK** (`Ran 1 test → OK`). Chạy lại sau normalize-eol để chứng minh EOL-fix không đổi hành vi → **OK** (`Ran 1 test in 0.001s → OK`).
3. **Full file**: `tests.test_ai_client_openclaw` (bypass pgbouncer bằng env override **per-exec**: thay host `pgbouncer:6432` → `core-db:5432`, script python trong container không in password): **`Ran 17 tests → OK` (exit 0)** — đếm `def test_` = 17 (16 cũ + 1 mới) khớp, gồm cả AC4 (test-connection 503 + audit) và AC5 (usage record) dùng DB thật qua kết nối trực tiếp.
   - Cản trở đã vượt: Django test DB qua pgbouncer mặc định fail `FATAL: no such database: test_vninvest_core` (pgbouncer chỉ map `vninvest_core`) — hạ tầng có sẵn, không liên quan slice (A1 cũng tránh test DB). Workaround không đổi code/container/staging, chỉ env của 1 lệnh exec; Django tự tạo + drop test DB.
4. **Restore**: `openclaw.py` khôi phục từ `git -C /opt/vninvest show HEAD:.../openclaw.py` (staging @ `5f9422694`) → **md5 khớp** `2f6c4ee76c98e5ee2d2403ac2c96d1e9`; `rm -rf /app/src/tests` (không có bản gốc vì `backend/tests/` không bake, `Dockerfile:65`); `git -C /opt/vninvest status --short` chỉ còn file dirty sẵn có (`M docker-compose.staging.yml` + 5 untracked hotfix) — **không còn gì của slice**. Lặp lại sau lần verify EOL: md5 khớp lần 2.

## B7 — Gates (chạy thật)

| Cổng | Kết quả |
|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` | **PASS** — 0 lỗi, 0 trùng migration (2 cảnh báo stale không chặn) |
| `node scripts/check-lessons.mjs` | **PASS** — 14 file, 57/60, sạch |
| `node scripts/normalize-eol.mjs` | **OK** — sau `--fix` (ban đầu 2 file CRLF, numstat không đổi sau fix) |
| `node scripts/check-experiment-env.mjs` | **PASS** — 1 dòng mới trong `origin/dev...HEAD`, 0 lệnh docker local |
| `node scripts/pre-push-gate.mjs` | **2 FAIL / 32 PASS / 2 SKIP** — giống baseline tại `0be88862c` (thiếu `node_modules/typescript`), pre-existing |

## B8

`AUDIT_B8_20261109.md` (phụ) — auditor độc lập: **PASS, 0 blocker, 0 major** trên `809c2076c`.

## CHƯA CHẠY

- FE/locale (`vi.js`/`en.js`): deferred (claim stale) — mục follow-up.
- `models.py:250` nhãn "System Default" (cần migration, coordinator): chưa chạm — follow-up.
- P0-1 (`requirements.txt` redis bump, deny-list): coordinator.
- BE suite toàn repo trên dev mới: chưa chạy (ngoài phạm vi slice; chỉ chạy file openclaw 17 tests).
- `tsc` FE: **CHƯA CHẠY** (không có thay FE, file không thuộc getcwd có node_modules — ghi CHƯA CHẠY thay vì PASS).
- E2E Playwright / ảnh chụp UI: **CHƯA CHẠY** (không thay UI).
