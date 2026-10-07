# KẾ HOẠCH QUYẾT ĐỊNH 4 VIỆC TỒN ĐỌNG — Trình Owner

> Ngày: 2026-10-07 · Trạng thái: **chờ Owner quyết định**
> Cơ sở: `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md`
> Nguyên tắc: mỗi quyết định đều có **bằng chứng lệnh đã chạy**, không suy đoán.

---

## TÓM TẮT ĐIỀU QUYẾT ĐỊNH

| # | Việc | Khuyến nghị | Mức rủi ro nếu chọn sai |
|---|---|---|---|
| **1** | `owner-audit-fix` (8 claim) | **ĐÓNG — đã merge PR #73** | 🟢 Thấp (tự khép lại) |
| **2** | Xoá 2 branch remote stale | **XOÁ** | 🟢 Thấp |
| **3** | `docs/_workflow/` | **XOÁ** — không phải của dự án này | 🟢 Thấp |
| **4** | 2 file `OPEN_WORK` | **ĐỔI THỨ TỰ, không merge** — tránh trùng số hiệu | 🟠 TB |

**Tin tốt:** cả 4 việc đều **đã tự rõ hướng** sau khi kiểm chứng. Không cần thêm thông tin.

---

## QUYẾT ĐỊNH 1 — `owner-audit-fix`: ĐÃ MERGE, đóng claim

### Bằng chứng

```
$ gh pr list --head feat/openwork-ow02-03-04 --state all
[{"number":73,"state":"MERGED","mergedAt":"2026-10-04T08:23:20Z",
  "title":"fix(security): dong OW-02 (500 cho member) + OW-04 (Turnstile allowlist)"}]

$ gh api .../compare/dev...feat/openwork-ow02-03-04
status=behind ahead=0 behind=29 files=0          ← KHÔNG còn gì chưa merge

$ git diff --stat origin/dev...origin/feat/openwork-ow02-03-04
(rỗng)                                            ← nội dung đã nằm trong dev
```

### Kết luận

Branch **đã merge xong từ 2026-10-04** (3 ngày trước). 8 claim `in-progress` còn lại
(`CLAIMS.md:859-861, 940-942`) là **dữ liệu cũ chưa được đóng lại**, không phải
công việc đang dở. `behind=29` nghĩa là `dev` đã đi xa hơn 29 commit.

⚠ **Quan trọng:** Slice E/F/G (`test_login_upgrade.py`, `useOrderBook.test.js`,
`portfolio_analytics_views.py`) — cần xác nhận chúng đã vào `dev` qua PR khác hay chưa.

### Đề xuất

**Đóng 8 claim** bằng append dòng `superseded` vào cuối `docs/CLAIMS.md`:

```markdown
| closed-owner-audit-fix-20261007 | feat/portfolio-p0-20261005 | DONG 8 claim
  owner-audit-fix (L859-861, L940-942) - PR #73 MERGED 2026-10-04T08:23:20Z,
  git compare dev...feat/openwork-ow02-03-04 = ahead=0 files=0.
  Khong xoa dong cu (AGENT_PROTOCOL.md:67-68). | docs/CLAIMS.md | done | 2026-10-07 |
```

**Không cần** xoá branch `feat/openwork-ow02-03-04` (giữ để đối chiếu; đã 3 ngày).

---

## QUYẾT ĐỊNH 2 — Xoá 2 branch remote stale: **XOÁ**

### Bằng chứng

```
$ gh pr list --state open | Select-String "portfolio-w3-api|portfolio-exec-plan"
(không có kết quả)                                ← KHÔNG có PR mở nào

$ git log -1 --format="%ci" origin/feat/portfolio-w3-api
2026-09-30 13:34:01 +0700                          ← 7 ngày không hoạt động

$ git log -1 --format="%ci" origin/docs/portfolio-exec-plan-20260927
2026-09-27 22:37:00 +0700                          ← 10 ngày không hoạt động

$ Test-Path docs/evidence/wave3-api
False                                              ← thư mục đã bị xoá
```

Cả 2 đã bị đánh dấu hủy trong `CLAIMS.md:959` với bằng chứng không tiến triển.

### Đề xuất

```powershell
git push origin --delete feat/portfolio-w3-api
git push origin --delete docs/portfolio-exec-plan-20260927
```

⚠ Nếu Owner muốn giữ lịch sử, dùng `--delete` là xoá ref trên GitHub — **commit vẫn còn trong
git object store**, chỉ mất tên branch. Không thể hoàn tác bằng cách đổi tên lại nhưng
vẫn tra cứu được qua hash.

---

## QUYẾT ĐỊNH 3 — `docs/_workflow/`: **XOÁ**

### Bằng chứng

```
docs/_workflow/README.md:
  "- De bat: them `hooks:` vao ~/.hermes/config.yaml, chay `hermes hooks test`,
   `hermes hooks doctor`"
  "- Khong tu dong bat - chi co mau chuan bi. Can nguoi dung xac nhan truoc khi kich hoat."

docs/_workflow/VERIFICATION.md:
  "# ... sau khi thuc hien de xuat SDLC cho 6 duoi Hermes."
  "- pre_tool_call: 2 hook ... pre_llm_call: 3 hook"

docs/_workflow/LESSONS.md (128 bytes):
  "# Bai hoc tu quy trinh cho du an eoffice-be     ← PROJECT KHAC"
  "# Gan day: 2026-10-05 ... Chua co bai hoc nao (G7 chua chay)."

docs/_workflow/STATE.json:  stage 0-8 đều "CHUA CHAY"
docs/_workflow/gates.json:  commands duy nhất = "git ls-files | head -1"
                            gap: "can bo sung lenh typecheck/test"
```

### Kết luận

Đây là **template của hệ thống `hermes`** sinh cho **`eoffice-be`** (project khác),
đổi tên sang vninvest mà **không nội dung riêng**:
- 9/9 gate: `CHUA CHAY`
- Gate duy nhất: `git ls-files | head -1` — vô nghĩa
- Tự thừa nhận: *"can bo sung lenh typecheck/test truoc khi coi la du an hoan chinh"*
- `LESSONS.md` ghi rõ là của `eoffice-be`, 0 bài học

Repo này **đã có** hệ thống gate thật: `.githooks/pre-commit`, `.githooks/pre-push`,
`scripts/pre-push-gate.mjs` (17 gate, chạy lúc push vừa rồi). `docs/_workflow/` **thừa và gây nhiễu**.

### Đề xuất

**XOÁ 14 file.** Lý do bổ sung: nếu commit, mọi agent sau sẽ tưởng đây là nguồn
trạng thái gate chính — mâu thuẫn với `docs/LESSONS/` và `.githooks/` đang hoạt động.

⚠ Nếu Owner **đã cài `hermes`** và muốn dùng cho vninvest: phải **viết lại từ đầu** với
gate thật (`npm test`, `tsc`, `manage.py test`), không dùng bộn hiện tại.

---

## QUYẾT ĐỊNH 4 — 2 file `OPEN_WORK`: **ĐỔI THỨ TỰ, KHÔNG MERGE**

### Bằng chứng — 2 file dùng CÙNG số hiệu cho VIỆC KHÁC NHAU

| Số hiệu | `OPEN_WORK_20260927.md` | `OPEN_WORK_20260929.md` |
|---|---|---|
| **OW-01** | URL-routing `vninvest_core` ~50 lỗi — **ĐÃ ĐÓNG** (Entry 241) | Rotate 7 secret (SEC-01) — **CHƯA CHẠY** |
| **OW-02** | `commercial/views.py` 500 cho member — **đã merge PR #73** | Rotate `BROKER_SECRET_KEY` → `SecretStore` — **code xong, chưa đổi** |
| **OW-03** | `AuditLogListView` fail-closed SOC | Trả billing + bật CI — **CHƯA CHẠY** |
| **OW-04** | `STRICT_TURNSTILE_ENFORCEMENT` | Ledger quy trình — **ĐÃ XỬ LÝ** (ledger gỡ deny-list 2026-10-03) |
| **OW-05** | P0-SEC-01: 9 secret trong git history | `UserDNSEcredential` legacy store |
| **OW-06** | P0-LEGAL-01 đã bị bác | — (không có) |

⚠ **Nguy hiểm:** `AGENTS.md:58` ghi *"6 việc còn tồn đọng (OW-01..OW-06)"* → người đọc
sẽ tra `OW-01` trong file 27 và thấy **"ĐÃ ĐÓNG"**, bỏ sót việc rotate secret (P0).

### Đề xuất: **không merge nội dung** (vì đánh số đã xung đột)

Thay bằng **3 thao tác nhỏ, an toàn**:

| # | Việc | File | Ghi chú |
|---|---|---|---|
| 4a | **Đổi tên file** `OPEN_WORK_20260929.md` → `OPEN_WORK_SEC_20260929.md` | rename | Phân loại theo nhóm: 4/5 mục là SEC/billing |
| 4b | **Thêm header cảnh báo** vào file 29 | `OPEN_WORK_SEC_20260929.md` | Ghi rõ số hiệu OW-01..05 **KHÔNG liên quan** file 27 |
| 4c | **Sửa `AGENTS.md:58`** | deny-list → **cần Owner** | Trỏ cả 2 file + giải thích 2 hệ số độc lập |

Nội dung 4 header đề xuất:

```markdown
> ⚠ **HỆ SỐ ĐỘC LẬP — KHÔNG TRÙNG VỚI `OPEN_WORK_20260927.md`**
> File này nhóm việc **SEC / billing / CI** (ngày 2026-09-29).
> `OPEN_WORK_20260927.md` dùng CÙNG số hiệu OW-01..OW-05 cho việc **hoàn toàn khác**.
> Ví dụ: `OW-01` ở đây = rotate 7 secret (CHƯA CHẠY);
> `OW-01` ở file 27 = URL-routing (ĐÃ ĐÓNG, Entry 241).
> **Tra cứu phải ghi rõ tên file.** Không dùng số hiệu để tra.
```

### Việc đã đóng, không cần làm

- **OW-04 của file 29** ("ledger chưa ghi vì còn trong deny list") → **SAI**:
  `check-multi-agent.mjs` `DENY_LIST` không có `CODE_CHANGE_AUDIT_LEDGER.md`, và
  Entry 241 đã ghi ledger. Đóng mục này.
- **OW-01/OW-02/OW-03/OW-05 của file 27** → Entry 241 + PR #73 đã đóng.

---

## KẾ HOẠCH THỰC THI SAU KHI OWNER DUYỆT

### Phase 1 — Việc tôi tự làm được (không cần chờ)

| STT | Việc | Lệnh / file | Rủi ro |
|---|---|---|---|
| 1.1 | Append dòng đóng 8 claim `owner-audit-fix` | `docs/CLAIMS.md` (**cuối file**, commit riêng) | 🟢 |
| 1.2 | Đóng `opencode-portfolio-p0` L952 + `-b` L954 (đã `done`) | `docs/CLAIMS.md` cuối | 🟢 |
| 1.3 | Đóng `opencode-supersede-stale-claims` L958 | `docs/CLAIMS.md` cuối | 🟢 |
| 1.4 | Commit dở `REPORT_FINAL.md` | diff trước khi commit | 🟢 |
| 1.5 | Rename + thêm header cảnh báo file 29 | `git mv` + edit | 🟢 |
| 1.6 | Sửa `field-contract.test.js:28` (bỏ `import.meta`) | test đang chết | 🟡 |
| 1.7 | Tạo PR branch portfolio | `gh pr create` | 🟢 |

⚠ **Deny-list:** `docs/CLAIMS.md` chỉ được **append cuối file**. `AGENTS.md` trong deny-list →
mục 4c **phải Owner tự sửa** (tôi chỉ chuẩn bị nội dung đề xuất).

### Phase 2 — Cần Owner thao tác

| STT | Việc | Lệnh |
|---|---|---|
| 2.1 | Xoá 2 branch remote | `git push origin --delete feat/portfolio-w3-api` / `docs/portfolio-exec-plan-20260927` |
| 2.2 | Xoá `docs/_workflow/` (14 file) | `Remove-Item -Recurse docs\_workflow` |
| 2.3 | Sửa `AGENTS.md:58` (mục 4c) | áp dụng header cảnh báo |
| 2.4 | Quyết định SAFE-04 | làm tiếp hay `superseded` |

### Phase 3 — Cần môi trường (chưa có)

| STT | Việc | Blocker |
|---|---|---|
| 3.1 | Chạy BE test thật | `CORE_DATABASE_URL` chưa set → dựng Postgres |
| 3.2 | Chạy `agent-sync.ps1` | Cần `dev` mới nhất |

---

## Definition of Done

- [ ] `git status --short` sạch
- [ ] **0 claim `in-progress` actionable** trên repo
- [ ] Mọi append `CLAIMS.md` có proof (PR hash, commit hash, lệnh đã chạy)
- [ ] **0 dòng gốc** trong `CLAIMS.md` bị sửa/xoá
- [ ] 2 branch remote stale đã xoá (Owner)
- [ ] `docs/_workflow/` đã xoá (Owner)
- [ ] `field-contract.test.js` chạy được, **> 0 test pass**
- [ ] PR đã tạo, gate `17 PASS` xanh
- [ ] Báo cáo `CHƯA CHẠY`: BE test, Playwright, mobile, 25 file test còn lại

---

## Ma trận rủi ro

| Hành động | Nếu chọn sai | Mức | Phát hiện bằng |
|---|---|---|---|
| Đóng 8 claim `owner-audit-fix` | Mất dấu vết công việc đã merge | 🟢 Thấp | PR #73 còn trên GitHub |
| **Không** xoá branch remote | 2 branch nhiễu, agent mới tưởng còn việc | 🟢 Thấp | `git branch -a` |
| **Xoá** branch remote | Mất tên branch (commit vẫn còn) | 🟢 Thấp | Tra bằng hash |
| Xoá `docs/_workflow/` | Mất template `hermes` (nếu đang dùng) | 🟢 Thấp | Nội dung toàn `CHUA CHAY` |
| Merge 2 file `OPEN_WORK` | **Trùng số hiệu OW-01 = bỏ sót P0 rotate secret** | 🟠 TB | Đổi tên file, giữ tách biệt |
| Sửa `AGENTS.md` | Hunk gộp với agent khác, không tách được | 🟠 TB | Owner tự sửa khi merge |

---

## Câu hỏi cần Owner trả lời

| # | Câu hỏi | Khuyến nghị mặc định |
|---|---|---|
| Q1 | Có **PR #73** rồi — xác nhận đóng 8 claim? | Đóng |
| Q2 | Xoá 2 branch remote? | Xoá |
| Q3 | Có dùng `hermes` cho vninvest không? **Có** → phải viết lại gate; **Không** → xoá | Xoá |
| Q4 | Đổi tên file 29 thành `OPEN_WORK_SEC_20260929.md`? | Đổi |
| Q5 | SAFE-04 (15 write method chưa capability) — làm tiếp hay đóng? | Làm tiếp (P0 security) |
| Q6 | Có dựng Postgres để chạy BE test không? | Có — chưa có kết luận nào đáng tin |

---

## Tham chiếu

| File | Vai trò |
|---|---|
| `docs/AUDIT_CLAIMS_HANDOFFS_20261007.md` | Dữ liệu audit gốc |
| `docs/CLAIMS.md:855-861, 940-960` | 8 claim `owner-audit-fix` + bằng chứng hủy |
| `docs/OPEN_WORK_20260927.md` | OW-01..OW-06 (phần lớn đã đóng) |
| `docs/OPEN_WORK_20260929.md` | OW SEC/billing (4/5 còn mở) |
| `docs/CODE_CHANGE_AUDIT_LEDGER.md` Entry 241 | Đóng 4 mục file 27 |
| `docs/LESSONS/INDEX.md` | Bài học liên quan (`L-002`, `L-006`, `L-008`) |