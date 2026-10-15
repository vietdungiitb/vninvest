# TEST_REPORT — Wave 3 Cô lập & gộp danh mục

- Ngày: 2026-10-15 · Người viết: supervisor/PM · Nhánh: `feat/mbw3-isolation`
- Plan: `docs/PLAN_WAVE3_ISOLATION_20261015.md` · Audit: `docs/AUDIT_MBW3_20261015.md`
  (0 blocker + 0 major, confidence medium) · Evidence: `docs/evidence/mbw3/`
- Lessons áp dụng: [L-001, L-002, L-003, L-004, L-006, L-007, L-008, L-A01,
  L-M01, L-M02, L-M03, L-V02, L-V03, L-T01] + TDD fail-before
- Quy tắc trung thực: PASS = đã chạy + exit code; chưa chạy = CHƯA CHẠY.

## 1. Gates (mỗi dòng 1 verdict — name và verdict cùng dòng)

| Gate (lệnh chính xác + nơi chạy) | Verdict | Bằng chứng |
|---|---|---|
| `node packages/web/scripts/check-multi-agent.mjs` (local) | Pass | 0 lỗi, 0 trùng migration (1 warning row Wave 1 cũ, ngoài phạm vi) |
| `npx tsc --noEmit` (packages/web, local §12.2) | Pass | exit 0 |
| `makemigrations --check --dry-run` (VPS §12.3) | Pass | No changes detected; leaf 0030→0029 |
| BE suite 12 labels broker (VPS, DB `mbw3_reg`) | Pass | 101/101 OK ×2 + guard module 22/22 (4/4 loop mới) |
| FE vitest 7 files (VPS §12.4) | Pass | 37/37 (6 file slice + route; mount crash đã sửa + rerun xanh) |
| `npm run i18n:scan:strict` (VPS §12.4) | Pass | exit 0 (warning defaultValue khác nhau pre-existing) |
| `npm run build` (VPS §12.4) | Pass | exit 0, 32.85s |
| Bundle BrokerHubPage / BrokerAccountPage post-mount (VPS) | Pass | 1361.0 KB / 1363.3 KB ≤ 1450, 0 echarts/xlsx |
| i18n PM verify runtime (local, node import) | Pass | 4/4 key `brokerWave3.*` VI+EN đủ dấu |
| Fail-before + control (BE 29/29 RED-base / FE 5/5 RED + 5/5 control) | Pass | evidence 2 slice, PM ký |
| pre-push-gate (local) | Pass | 22/22 sau `deploy.mjs` (drift deployed-copy, 0 file repo) |
| Full BE suite | CHƯA CHẠY | Nợ từ Wave 2 |
| ruff | CHƯA CHẠY | Nợ từ Wave 2 |
| E2E 2 SubAccount thật | CHƯA CHẠY | Ticket TEST-E2E riêng |
| B3.4 leftovers staging-read | CHƯA CHẠY | Schema staging chưa deploy; partial đúng contract |

## 2. AC (§9 plan)

AC1 ĐẠT (E2E đầu-cuối chờ BE+FE cùng deploy — panel đọc GET thật, test mock) ·
AC2 ĐẠT (convert + 3 codes + audit, test xanh) · AC3 ĐẠT (guard 5 write path +
banner FE + unknown fail-closed) · AC4 ĐẠT (response khớp DB) · AC5 ĐẠT
(filter scope + derived tách riêng) · AC6 ĐẠT (grep == 1 + contract xanh) ·
AC7 ĐẠT (0 reference chết) · AC8 ĐẠT PHÍA FE (pin + ghi giới hạn) ·
AC9 ĐẠT (bảng trên) · AC10 ĐẠT MỘT PHẦN (regression BE xanh + probe xong;
E2E/full/ruff CHƯA CHẠY đã khai).

## 3. Sự cố trong wave

1. Mount sup làm đỏ 4 test route (`api.getPortfolios is not a function`) —
   lỗi thật (adapter khuyết crash trang). Sửa: optional-read guard +
   rerun 37/37 xanh. Lesson: mount file ngoài scope phải chạy test của
   chính file đó, không chỉ test file mới.
2. Runbook §12.3 stale (`POSTGRES_PASSWORD` → `CORE_DB_PASSWORD`).
3. Claim viết tắt/ngoặc trong cột files bị gate cảnh báo (bẫy #8) — đã sửa.
