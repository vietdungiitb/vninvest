# WORKLOG — vninvest

> Nhật ký công việc. Mỗi dòng có **bằng chứng lệnh tái lập**, không ghi "PASS" cho thứ chưa chạy.
> Quy ước: `PASS` (đã chạy, xanh) · `FAIL` (đã chạy, đỏ) · `CHƯA CHẠY` (chưa chạy được).

## 2026-10-12 — Rotate secret · dọn branch · fix bug · audit toàn diện

| # | Task | Kết quả | Bằng chứng (lệnh) | Rủi ro | Next |
|---|---|---|---|---|---|
| 1 | Kiểm tra điều kiện L-S01 (không agent chạy) | PASS | `grep in-progress CLAIMS.md` → 0; `git status` sạch | — | — |
| 2 | Backup DB trước rotate | PASS | `pg_dump` schema + 2 bảng credential → `%TEMP%` | — | — |
| 3 | Đo tác động rotate (không đoán) | PASS | `UserDNSECredential`=0; `CorePATCredential`=252 → 210 chưa revoke → 209 hết hạn → **0 còn hiệu lực** | — | Hỏi Owner |
| 4 | Rotate `DNSE_CREDENTIAL_FERNET_KEY` + `CORE_PAT_PEPPER` | PASS | Fernet roundtrip PASS; PAT hash 64 hex; ghi vào `compose.dev.env` (local, không commit) | Mất **0** token thật | — |
| 5 | Chặn tái diễn (`.githooks/pre-commit`) | PASS | Repo thật: `ok.txt` rc=0 CHO QUA · `compose.dev.env` rc=1 CHAN · `.env` rc=1 CHAN · `compose.prod.env` rc=1 CHAN | — | — |
| 6 | Xoá branch đã merge | PASS | 16 branch, `merge-base --is-ancestor` = 0 | — | — |
| 7 | Xoá branch chưa merge | PASS | 24 branch diff **rỗng** (đã vào dev qua squash) + 3 branch doc đã hợp nhất vào ledger Entry 265–270 | **Có 1 sự cố tôi tạo**: tag an toàn trỏ vào commit trên `dev` ⇒ **không** bảo vệ commit branch. Đã verify nội dung vẫn còn trong `dev` | Đã xác minh không mất dữ liệu |
| 8 | Fix KBS realtime `None` | PASS | Trước `None` → sau `close=225500.0` | — | — |
| 9 | Bác bỏ claim sai của phiên trước | PASS | Chứng minh bằng thực nghiệm: 1 ngày **và** 2 ngày cùng `ValueError`; 5/30/120 ngày OK | — | — |
| 10 | Fix timestamp lệch 7h | PASS | assert: `14:35+00:00` vs `07:35+00:00` ⇒ lệch **7.0** | — | — |
| 11 | Fix `NameError` do xoá import | PASS | `market_data` 167/167 OK | — | — |
| 12 | Cài `ruff` (Owner cho phép) | PASS | `ruff 0.17.0` trong `.venv`; **không** thêm `requirements.txt` | — | — |
| 13 | Fix 8 lỗi `F821 NameError` | PASS | `ruff --select F821` → **All checks passed**; full BE 724 OK | — | — |
| 14 | Xoá CSS dead `vn-kpi__*` | PASS | `git grep` = 0 template dùng; `numstat` **0/36**; gate 25/25; test 45/45 | — | — |
| 15 | **Phát hiện P0: 147 file test không được chạy** | **FAIL** | `TOPLEVEL {'tests': 724}` · `HAS_market_data_tests False` · `USER_WORKSPACE_TESTS 2` (app có 21 file) | **CAO** | S1.1 |
| 16 | Đo 12 app bị bỏ | **FAIL (môi trường)** | 1 501 test → **218 errors**; 209/218 do `psycopg2.OperationalError` | Cao | Cần ≥4 GB RAM free |
| 17 | Full FE suite | PASS | `npm run test:components` → 128 file / **918 test** | — | — |
| 18 | pre-push gate (2 lần) | PASS | 21 PASS / 0 SKIP / 0 FAIL | — | — |
| 19 | Push 4 commit lên `dev` | PASS | `211c0b5d5` | — | — |
| 20 | Khôi phục 10 container worker | PASS | 19 container đang chạy | — | — |

### Chi tiết bug đã sửa

| Commit | File | Vấn đề |
|---|---|---|
| `5979cefaa` | `.githooks/pre-commit`, `.gitignore` | Thiếu `compose*.env` trong deny-list |
| `57022e823` | `vnbroker_adapter.py` | `fetch_realtime_price` trả `None`; timestamp lệch 7h |
| `30966a2f7` | `vnadmin.css` | 36 dòng dead code |
| `211c0b5d5` | 5 file | 8 lỗi `F821 NameError` |

### Bài học (Stage 8)

1. **L-T01 phạm 9 lần trong 1 phiên.** `Edit` tool trên Windows đổi LF→CRLF mỗi lần. Nếu không có `git diff --numstat` trước khi stage: `574/574` (thay vì 11/11), `1506/1484` (thay vì 28/6), `82/79` (thay vì 4/1).
2. **Claim phải kiểm lại.** "KBS cần ≥2 ngày" sai — chạy thật cho thấy cả 1 ngày lẫn 2 ngày đều lỗi, nguyên nhân thật là KBS **chưa có bar cho ngày đó**.
3. **Tag "an toàn" phải chứa commit cần giữ.** Tag tôi tạo trỏ vào commit trên `dev` ⇒ không bảo vệ gì. Phải tag **trước khi xoá** và trỏ tới **commit của branch**.
4. **"Full suite PASS" phải kèm số.** 724 OK trong khi tổng thực tế 2 225.

### Việc chưa làm

| Việc | Lý do |
|---|---|
| S1.1 sửa test discovery | Chưa bắt đầu — ưu tiên cao nhất session sau |
| S1.2 đo số lỗi thật | Host thiếu RAM (`vmmemWSL` 4.4 GB) |
| S1.3 fix `pytest` | Chưa làm (P1) |
| S1.4 cấu hình ruff | Cần Owner chọn mức |
| Purge git history | Cần Owner quyết (không thể hoàn tác) |
