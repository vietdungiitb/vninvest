# Tooling (2) - Lessons (Edit tool, git stash, EOL)

> Tach tu `tooling-traps.md` (2026-10-19) de **C1**: 1 file <= 120 dong (khong tinh dong trong).
> `tags: [edit, tool, fuzzy-match, stash, crlf, lf, eol, diff, numstat]`

## L-T03: `Edit` tool KHUỚP MỜ — `oldString` gõ sai vẫn sửa nhầm chỗ, KHÔNG báo lỗi

- **Nguyên nhân:** `oldString` được **đánh từ trí nhớ / từ output đã cắt** (file dài >50 KB bị tool cắt) thay vì copy **nguyên văn** từ file ⇒ tool khớp gần đúng và thay **nhầm biến**.
- **Hậu quả thật (2026-10-19, slice BE VNBroker):** trong `market_data/vnbroker_adapter.py`, tôi sửa khối `fetch_daily_history` với `oldString` ghi `start=start_date.isoformat()` — nhưng HEAD là `start=normalized_start_date.isoformat()`. Edit **không báo lỗi** mà áp bản của tôi ⇒ `start_date` là `None` khi caller không truyền ngày ⇒ `None.isoformat()` ⇒ **AttributeError ⇒ 2 test BE đỏ** (`test_runtime_dnse_source_falls_back_to_vci_for_daily_history`, `test_fetch_daily_history_uses_requested_source_quote_class`). Lỗi do **tôi** gây ra, không phải lỗi nền.
- **Khi nào gặp:** `tags: [edit, fuzzy, tool, replace, refactor, python, big-file]`
- **QUY TẮC:** "`oldString` phải là **văn bản nguyên văn** của file, copy từ `Read`/`grep` **ngay trước** lần sửa — KHÔNG gõ lại từ trí nhớ. Sau khi sửa, **`git diff` phải được đọc lại**: hunk có thay đổi ngoài ý định (biến đổi tên, đảo điều kiện) là dấu hiệu đã khớp mờ."
- **CHECKLIST:**
  - [ ] `oldString` lấy từ output thật của `Read`/`grep` vừa chạy, **không** gõ lại?
  - [ ] File > 50 KB (bị tool cắt output) thì đã đọc lại **đúng vùng** cần sửa?
  - [ ] Sau `Edit` đã `git diff` và đọc hunk đó **mắt thường** chưa? (không chỉ nhìn numstat)
  - [ ] Có biến nào trong hunk bị **đổi tên đột ngột** (vd `normalized_x` -> `x`) không? Đó là dấu hiệu khớp mờ.
- **Proof:** ledger Entry 385 §"BUG CỦA TÔI"; `packages/core/backend/src/market_data/vnbroker_adapter.py` (đã sửa lại `normalized_start_date`/`normalized_end_date`).

## L-T04: `git stash push/pop` ĐỔI LF→CRLF trên repo này — phải chạy `normalize-eol --fix` SAU MỖI lần stash

- **Nguyên nhân:** repo **HỖN TẠP** EOL (`core.autocrlf=false`, `.gitattributes` không chuẩn hoá file nguồn) ⇒ `git stash` ghi lại blob theo dạng CRLF của working tree, và `stash pop` trả file về **CRLF** dù blob gốc là LF.
- **Hậu quả thật (2026-10-19, 2 lần trong 1 phiên):** sau `git stash push` + `pop`, `git diff --numstat` **phình gấp 3–5 lần** (`vnbroker_adapter.py` 82/10 → 864/740; `views/vnbroker.py` 72/19 → 716/663). Nếu commit thẳng ⇒ PR chứa hàng nghìn dòng vô nghĩa. Pre-commit hook có chặn (`normalize-eol.mjs`) **nhưng phải chạy `--fix` thủ công** — mất thời gian và dễ bỏ sót file ngoài staging.
- **Khi nào gặp:** `tags: [git, stash, crlf, lf, eol, numstat, normalize-eol, baseline-check]`
- **QUY TẮC:** "Mỗi lần dùng `git stash` (kể cả để **đo baseline**) ⇒ `node scripts/normalize-eol.mjs --fix` rồi **kiểm `git diff --numstat`** trước khi làm bất cứ việc gì khác. `git stash` **KHÔNG** phải công cụ đo baseline an toàn — hãy backup file ra ngoài trước (`Copy-Item` ra thư mục tạm) rồi mới stash."
- **CHECKLIST:**
  - [ ] Đã backup file đang sửa ra ngoài repo **trước** khi stash? (dự phòng khi stash/pop hỏng)
  - [ ] Sau `stash pop` đã chạy `node scripts/normalize-eol.mjs --fix`?
  - [ ] `git diff --numstat` có khớp số dòng sửa dự kiến không? (L-G05)
  - [ ] Có file nào bị "dính" thay đổi của agent khác không? (L-A01)
- **Proof:** ledger Entry 385; `docs/LESSONS/tooling-traps.md` L-T01 (nguyen tac) + L-F04 (khong dung Get-Content|Set-Content).
