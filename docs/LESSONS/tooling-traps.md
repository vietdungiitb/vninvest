# Tooling - Lessons (dong lenh, bang chung, git)

> `tags: [powershell, shell, numstat, git, line-ending, citation, evidence, diff]`

## L-F04: KHONG dung Get-Content | Set-Content de sua file nhieu dong - no GHEP file thanh 1 dong

- **Nguyên nhân:** $lines = Get-Content f tra ve **mang chuoi**, nhung
  $lines[i] = ... phai la **mang dong**. Noi Set-Content -Value  -NoNewline
  se ghi cac phan tu lien tiep khong phan biet ⇒ **mat toan bo newline**.
- **Hậu quả thật:** soc.components.css **3.482 dong → 1 dong**. Commit ghi
  "6 files changed, 175 insertions(+), 3944 deletions(-)".
- **Khi nào gặp:** moi lan can sua hang chuc dong mot file van ban lon bang vong lap
  PowerShell. Rat pho bien tren Windows.
- **QUY TẮC:** Dung **Edit tool** cho sua tung cho, hoac **script Node**
  voi lines.join("\n"). KHONG bao gio dung Get-Content | Set-Content
  de sua file nhieu dong.
- **CHECKLIST:**
  - [ ] git diff --stat co deletions **bat thuong** (vuot so dong sua) khong?
  - [ ] So dong cua file **co giam so voi HEAD** khong? (Measure-Object -Line)
  - [ ] Da doc lai file bang Read tool (doc dung encoding) truoc khi commit?
- **Proof:** commit f75ef6a86 — khoi phuc bang git show HEAD~1:<file>,
  chay lai toan bo fix (ke ca phan da sua trong commit hong).

## L-F07: Doc $LASTEXITCODE SAU khi pipeline = doc sai nhat (lam gate PASS khi FAIL)

- **Nguyen nhan:** $LASTEXITCODE lay cua **lenh cuoi cung** trong pipeline.
  
pm run lint | Select-String "..." ⇒ $LASTEXITCODE cua Select-String,
  khong phai cua 
pm.
- **Hau qua that:** bao "lint exit 1" trong khi 
pm run lint thuc te exit 0
  (0 errors). Neu dao chieu, bao nham cho bao cao that.
- **Khi nao gap:** moi khi can ca exit code **VA** muon hien thi output cung luc.
- **QUY TAC:** tach 2 buoc:
  `powershell
   = npm run lint 2>&1;  = ;  | Select-Object -Last 3
  `
  Tuong tu: dung script Node de chay va doc status, khong dua vao pipeline.
- **CHECKLIST:**
  - [ ] Co can ca exit code khong? -> tach khoi pipeline.
  - [ ] Bao cao nao co "exit" thi do bang lenh THAT chay, khong phai lenh doc output.

## L-T01: Viet file = doi line-ending - `git diff --numstat` la canh bao SOM NHAT

- **Nguyên nhân:** `Set-Content`/`Out-File`/`WriteAllText` tren Windows ghi CRLF;
  `ReadAllLines`+`WriteAllLines` **chuẩn hóa toàn file**. Repo này **thật sự hỗn
  tạp**: `CLAIMS.md` = 1127 LF + 32 CRLF, ledger thuần LF, `docs/LESSONS/*` phần
  lớn CRLF.
- **Hậu quả thật:** Sửa ~4 dòng `CLAIMS.md` mà `numstat` ra **+6/1** thay vì +4/0.
  Lần khác: `.map(l => l + "\n").join("\n")` chèn dòng trống giữa các dòng.
- **Khi nào gặp:** `tags: [git, line-ending, crlf, lf, numstat, diff, append]`
- **QUY TẮC:** Trước khi stage: `git diff --numstat`. **Mọi dòng đều khác** ⇒
  line-ending, không phải nội dung. Sửa file nhỏ bằng **Edit tool**; script buộc
  phải viết thì đọc byte gốc trước và giữ nguyên. Dùng
  `git ls-files --eol <path>` để hỏi chính xác dạng nào là "đúng" cho file đó.
- **CHECKLIST:**
  - [ ] `git diff --numstat` có đúng bằng số dòng sửa không?
  - [ ] File append-only (CLAIMS.md/ledger) đã giữ đúng line-ending gốc chưa?
  - [ ] Đã `git ls-files --eol` hỏi file đó dùng LF hay CRLF, **không** chuẩn hóa
        cả thư mục?
- **Proof:** `docs/audit-uiux/SESSION_LOG_WAVE10_20261010.md` §3.2; đo lại
  2026-10-10: `git ls-files --eol docs/LESSONS/` ⇒ `i/lf` cho mọi file nhưng
  `frontend.md` là `w/mixed`.

## L-T02: Citation DUNG SO DONG nhưng SAI FILE - moi kiem tra so dong deu pass

- **Nguyên nhân:** Trích dẫn `file:line` mà không mở **đúng file** đó ra đọc.
  Số dòng trùng khớp nên mọi kiểm tra "dòng có tồn tại" đều xanh.
- **Hậu quả thật:** Handoff wave 10 ghi `WhaleBubbleChart.jsx:319` cho claim
  `whale_order_count`; dòng 319 của file đó thật ra là `key: 'reference'`.
  Nguồn thật là `whaleAnalyticsSnapshotAdapter.js:319`. Sửa theo claim ⇒ **regression**.
- **Khi nào gặp:** `tags: [citation, evidence, audit, file:line, sha, proof]`
- **QUY TẮC:** Một citation là **(file, dòng, byte-giải mã thành)**, không phải
  (file, dòng). Mở đúng file, đọc đúng dòng, **trích nguyên văn** — rồi mới tin.
  Khi nghi ngờ, hỏi: *"nếu claim đúng, test sẵn có có đỏ không?"*
- **CHECKLIST:**
  - [ ] Đã mở **đúng file** trong citation và đọc đúng dòng đó chưa?
  - [ ] Trích nguyên văn dòng (không diễn giải từ trí nhớ) chưa?
  - [ ] Claim suất ra từ người khác đã được **kiểm lại** trước khi hành động chưa?
- **Proof:** `docs/CODE_CHANGE_AUDIT_LEDGER.md` `## Entry 264` §4 - 2/2 claim
  "bug thật" của wave 10 §4.3 hoá ra **sai**.

---

## 1.6. ✅ Đã sửa — văn bản bị hỏng do **escape sequence** (2026-10-10)

`docs/LESSONS/` từng có **ký tự bị nuốt**, làm câu ở `css-soc.md` và `tooling-traps.md`
thành vô nghĩa (`transition` → `ransition`). **Đã sửa xong.**

### Quy tắc đã chứng minh (9/9 vị trí)

Khi ghi file văn bản, chữ cái dùng làm ký tự escape bị **ăn**:

| Chuỗi ghi | Ký tự điều khiển | Chữ bị mất |
|---|---|---|
| `\a` | U+0007 (BEL) | `a` |
| `\b` | U+0008 (BS) | `b` |
| `\t` | U+0009 (TAB) | `t` |
| `\f` | U+000C (FF) | `f` |
| `\e` | U+001B (ESC) | `e` |

⇒ **MỘT ký tự điều khiển = ĐÚNG MỘT chữ cái đã mất.** Sửa = thay ký tự điều khiển bằng
chính chữ cái đó. Kiểm chứng trên: `animation` ×2 · `box-shadow` ×2 · `easing` ·
`bash` · `focus` · `font` · `aiSettings.module.css` · `file:line` · `f75ef6a86`
(commit thật, `git cat-file -t` xác nhận).

⚠ **Không dùng regex đại trên `\`**: nó sẽ phá `\\d+` trong chính file này và `"\n"`
trong `tooling-traps.md` — cả hai là nội dung **đúng**. Dry-run đã bắt được điều này
trước khi sửa.

⚠ Khi sửa file nhiều dòng trên Windows: dùng **script Node**, không dùng PowerShell
`.Replace`/`Set-Content` (xem `L-T01`). Và kiểm `git diff --numstat` sau khi sửa.

**Bài học đã vào sổ:** `L-T01` (line-ending), `L-T02` (citation sai file).
