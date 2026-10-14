# HANDOFF — Phiên System-Design 2026-10-14 (PM/Tech Lead)

> 16 PR đã merge (#122–#137). Bộ hồ sơ `docs/system-design/` 43 file trên `dev`.
> Phiên kế tiếp đọc file này + `docs/system-design/README.md` §4 (bảng trạng thái)
> + `13.01` §2 (việc còn lại) là đủ ngữ cảnh.

## 1. Đã xong trong phiên (mỗi dòng 1 PR đã merge)

| PR | Slice | Nội dung | Ledger |
|---|---|---|---|
| #122 | Phase 1 | Governance + skeleton 13 phân hệ + topic-map + tools/gate | Entry 286 |
| #123 | 07.02 | Danh mục 1473 route máy sinh (khớp measure độc lập) | Entry 287 |
| #124 | 06 | Danh mục 107 model + 3 bất biến verify tay | Entry 288 |
| #125 | 04.01 | Bản đồ tính năng 7 cụm + cột tin cậy | Entry 289 |
| #126 | 07 remainder | Ma trận quyền + 16 mã lỗi + 30 AllowAny | Entry 290 |
| #127 | 05.01 | Trace 5 workflow end-to-end | Entry 291 |
| #128 | MODULES | 15 dossier v1 | Entry 292 |
| #129 | 02+03 | Nội dung 02.01 + 5 sơ đồ Mermaid | Entry 293 |
| #130 | Final v1 | 09/10/11 + 13.01 + 00.02 + 4 ADR (13/13 phân hệ) | Entry 294 |
| #131 | Phase 3.1 | Giải mã partner API (tenant self-admin, 3-4 lớp quyền) | Entry 295 |
| #132 | Phase 3.2 | Verdict advisory tenant FK (đúng thiết kế BYOK) | Entry 296 |
| #133 | Phase 3.3 | Runbook khôi phục 3 kịch bản | Entry 297 |
| #134 | Phase 3.4 | Sửa GAP 0-test sai + chạy 170 tests OK local | Entry 298 |
| #135 | Phase 3.5 | Ma trận test 186 file + phát hiện Edit im lặng | Entry 299 |
| #136 | Phase 3.6 | Verdict webhook signature (Entry tròn 300) | Entry 300 |
| #137 | Phase 3.7 | 2 test khóa Stripe verify-fail (16/16 OK) | Entry 301 |

Trạng thái gate lúc bàn giao: `--check` exit 0 (43 file · 204 citation · 40 chủ đề ·
6 claims · 1473 route · 107 model) · pre-push **22/0/0** · CI `scan` xanh cả 16 PR.

## 2. Việc chuyển phiên kế tiếp (theo thứ tự ưu tiên)

1. **Trace sâu `service_ops` SOC** (297 route, control plane lớn nhất chưa trace sâu)
   — dossier hiện ⚠.
2. **Xác minh chữ ký webhook `commercial`** — F-COM-01 đã đóng, còn F-COM-01b
   (test nhánh verify-fail): viết 1 test chữ ký sai → 400.
3. **Ma trận test theo app** (`10.01` §3 còn ghi "chưa có") — đếm cả
   `src/<app>/tests/` và `backend/tests/` (bài học slice p13).
4. **Diễn tập rollback** (`09.02` §6) + chốt RTO/RPO/retention — CẦN OWNER.
5. **C4 component** 2 app phức tạp (`user_workspace`, `identity_access`).
6. Nâng tin cậy dossier còn lại (signal tenant, advertising trademark, support tickets).

## 3. Môi trường chạy lại (đã verify trong phiên)

- BE test local: Postgres `127.0.0.1:5433` (container `vninvest-dev-core-db`),
  user `vninvest` / pass trong `compose.dev.env` (`CORE_DB_PASSWORD`),
  chạy bằng `packages/core/backend/.venv/Scripts/python.exe manage.py test <label>`.
- Bắt buộc env: `CORE_DATABASE_URL` + `DJANGO_DEBUG=1`.
- Test labels `backend/tests/`: tiền tố `tests.` (vd `tests.test_advisory_status`).
- `/app/tests/` KHÔNG có trong image staging — test ở `backend/tests/` chỉ chạy
  local/CI, đừng tìm trên container.
- Đọc kết quả test: grep `^Ran ` / `^OK` trong FULL log — tail log là output
  migrate, không phải kết quả.

## 4. Bẫy mới phát hiện trong phiên (đã ghi ledger, chưa vào `docs/LESSONS/`)

- **Edit báo success nhưng không persist** (oldString viết từ bản cũ, lẽ ra phải
  not-found). Quy tắc: mọi Edit xong phải đọc lại/grep xác minh + xem numstat
  trước commit. (Entry 299)
- **PowerShell ăn backtick** trong `node -e "..."` (double-quote): mọi script có
  backtick/regex phải viết ra file `.cjs` rồi chạy. (Entry 295+)
- **Script đếm 1 thư mục** (`src/<app>/`) bỏ sót `backend/tests/` — đếm cả hai.
  (Entry 298)
- **`--write` tự đếm file vừa sinh** — `_meta/` ra khỏi vòng quét viết tay.
  (Entry 287/288)
- **Hiển thị console escape backtick** (`\``) — kiểm tra bằng file/byte, đừng tin
  mắt khi thấy `\` lạ trong output. (Entry 295)

## 5. Câu hỏi chờ Owner (chưa có quyết định thì không làm)

1. RTO/RPO + retention backup (`09.02` §6).
2. P0-SEC-01: repo PUBLIC, history còn secret — purge + rotate (Owner đã biết).
3. `/core/v1/access/capabilities` AllowAny vì sao (F-IAA-02).
4. `LEGACY_BACKEND_URL` chưa set → `/api/v1/health` 503 qua proxy.

## 6. Cách mở phiên kế tiếp (protocol)

1. `git status` sạch + `git pull --ff-only` trên `dev`.
2. Nạp `project-lessons` theo tag trước mọi plan/claim.
3. Khai claim cuối `docs/CLAIMS.md`, commit riêng, branch `feat/<slice>-<agent>`.
4. Đóng slice: rebase → gate sau rebase → ledger Entry → claim done → push → PR.
